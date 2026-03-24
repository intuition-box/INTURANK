import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Send, Loader2, CheckCircle2, Zap, User, Bot, XCircle, ExternalLink, ShieldCheck, Layers } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useAccount } from 'wagmi';
import { isAddress, isHex } from 'viem';
import {
  broadcastTransaction,
  intuitionChain,
  switchNetwork,
  checkProxyApproval,
  grantProxyApproval,
  markProxyApproved,
  parseProtocolError,
  preflightSkillBroadcast,
  buildCreateAtomTxIntent,
  normalizeAtomLabel,
  getAtomTermIdFromTxHash,
  getTripleTermIdFromTxHash,
  createTripleFromLabels,
} from '../services/web3';
import { MULTI_VAULT_ADDRESS, FEE_PROXY_ADDRESS, CURRENCY_SYMBOL, getGeminiApiKey, GEMINI_MODEL, CHAIN_ID } from '../constants';
import { toast } from './Toast';
import { playClick, playHover } from '../services/audio';

type TxBroadcastOutcome = 'pending' | 'success' | 'rejected' | 'failed';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    txIntent?: any;
    txOutcome?: TxBroadcastOutcome;
    txHash?: string;
    txError?: string;
    /** Market / claim detail — atom or triple term id */
    txTermId?: string;
    /** Extra atom txs when running createTripleFromLabels */
    txAtomHashes?: string[];
}

function isUserRejectionError(err: unknown): boolean {
    const e = err as { code?: number | string; cause?: { code?: number }; message?: string; shortMessage?: string };
    const code = e?.code ?? e?.cause?.code;
    if (code === 4001 || code === 'ACTION_REJECTED') return true;
    const s = `${e?.message ?? ''} ${e?.shortMessage ?? ''}`.toLowerCase();
    return /user reject|rejected|denied|cancel|cancelled|4001|action_rejected|user denied|request rejected|wallet.*reject|rejected the request/i.test(s);
}

const SYSTEM_PROMPT = `
You are the Intuition Skill Agent — you teach the Intuition Protocol in plain language and help users decide what to do on-chain. The app builds real transactions for them (atoms and triples → IntuRank FeeProxy + MultiVault); users should never have to paste raw hex.

PROTOCOL KNOWLEDGE:
- Atoms: identities/concepts. Creation uses a protocol fee plus a vault deposit in TRUST.
- Triples: claims linking three atoms (subject, predicate, object). Same fee + deposit idea.
- Vaults: atoms and triples have vaults; users stake TRUST.
- MultiVault: ${MULTI_VAULT_ADDRESS}
- FeeProxy: ${FEE_PROXY_ADDRESS}
- Chain ID: ${CHAIN_ID} (Intuition Mainnet)

CREATING A SINGLE ATOM (primary path — simple for everyone):
When the user wants to create one atom, explain briefly, then output EXACTLY one JSON block in this shape (no "data", no "to", no "value" — the app fills those in):
\`\`\`json
{
  "action": "createAtom",
  "label": "Human-readable name for the atom",
  "depositTrust": "0.5",
  "chainId": "1155",
  "description": "One line: what this atom is for"
}
\`\`\`
- depositTrust is the vault deposit in TRUST as a decimal string. Minimum is **0.5** (same bonding-curve floor as claims); use "0.5" or higher.
- If the user's wallet is not connected, say they must connect it first, then ask again.

CREATING A TRIPLE (CLAIM) FROM LABELS — app creates missing atoms automatically:
When the user wants a semantic claim (subject → predicate → object), use EXACTLY one JSON block:
\`\`\`json
{
  "action": "createTriple",
  "subject": "Alice",
  "predicate": "trusts",
  "object": "Bob",
  "depositTrust": "0.5",
  "chainId": "1155",
  "description": "One line: what this claim means"
}
\`\`\`
- **subject**, **predicate**, **object** are human-readable atom names OR existing \`0x\` term ids (66 hex chars). For text labels, the app creates any atom that does not exist yet, then submits the triple — **multiple wallet signatures** may be required (up to one per missing atom + one for the triple); this is normal.
- **depositTrust** minimum is **0.5** TRUST (vault deposit for the triple leg).
- Alternatively, users may pass three term ids if all atoms already exist.

ADVANCED / OTHER ACTIONS:
Only if the user explicitly needs deposits or other operations not covered above, you may describe what is needed; do not invent long hex strings.

GUIDELINES:
1. Default tone: helpful and clear — not everyone is a developer.
2. Answer questions about the protocol without forcing a transaction.
3. For "make an atom" / "create X", use the createAtom JSON block above.
4. For "link X to Y via Z" / "claim that…" / triple / synapse / claim, use the createTriple JSON block above.

CURRENT CONTEXT:
- MultiVault: ${MULTI_VAULT_ADDRESS}
- FeeProxy: ${FEE_PROXY_ADDRESS}
- Currency: ${CURRENCY_SYMBOL} (TRUST)

Always use markdown. Put the machine-readable JSON in a single \`\`\`json code block when the user should get a Sign & Broadcast button.
`;

function extractErrorText(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
        const e = error as Record<string, unknown>;
        if (typeof e.message === 'string') return e.message;
        const nested = e.error;
        if (nested && typeof nested === 'object' && nested !== null && 'message' in nested) {
            return String((nested as { message?: string }).message ?? '');
        }
    }
    return String(error ?? '');
}

function formatGeminiError(error: unknown): string {
    const raw = extractErrorText(error);
    const lower = raw.toLowerCase();
    try {
        const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string } };
        const m = parsed?.error?.message;
        if (m && typeof m === 'string') {
            if (parsed.error?.code === 403 || /leaked|invalid|revoked|permission/i.test(m)) {
                return (
                    'API access denied (403). Google flagged this key—often because it was exposed in git, a screenshot, or a public repo. ' +
                    'Create a new key at https://aistudio.google.com/apikey , put it in `.env.local` as `VITE_GEMINI_API_KEY=...`, restart `npm run dev`, and never commit keys.'
                );
            }
            return `Gemini: ${m.slice(0, 280)}${m.length > 280 ? '…' : ''}`;
        }
    } catch {
        /* not JSON */
    }
    if (raw.includes('403') || lower.includes('leaked') || lower.includes('api key was reported')) {
        return (
            'API access denied. Your Gemini key may be revoked or flagged as leaked. ' +
            'Create a new key at https://aistudio.google.com/apikey , set `VITE_GEMINI_API_KEY` in `.env.local`, restart the dev server, and keep keys out of git.'
        );
    }
    if (lower.includes('429') || lower.includes('resource exhausted') || lower.includes('quota')) {
        return 'Gemini rate limit or quota exceeded. Wait a few minutes or check billing/quotas in Google AI Studio.';
    }
    const short = raw.length > 320 ? raw.slice(0, 317) + '…' : raw;
    return `Request failed: ${short}`;
}

type SkillChatProps = {
    /** e.g. playground uses viewport height; default fills parent */
    className?: string;
};

const SKILL_CHAT_STORAGE_KEY = 'inturank_skill_chat_v1';
const SKILL_CHAT_MAX_MESSAGES = 120;

const DEFAULT_SKILL_MESSAGES: Message[] = [
    {
        role: 'assistant',
        content:
            "SYSTEM_ONLINE. I'm the Intuition Skill Agent — ask in plain English (e.g. “create an atom called Cool Project with 0.1 TRUST deposit”). I'll explain and, when you're ready, give you a Sign & Broadcast button — the app builds the transaction for you.",
    },
];

function loadSkillChatMessages(): Message[] {
    if (typeof window === 'undefined') return DEFAULT_SKILL_MESSAGES;
    try {
        const raw = localStorage.getItem(SKILL_CHAT_STORAGE_KEY);
        if (!raw) return DEFAULT_SKILL_MESSAGES;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SKILL_MESSAGES;
        const cleaned = parsed.filter(
            (m: unknown) =>
                m !== null &&
                typeof m === 'object' &&
                ((m as Message).role === 'user' || (m as Message).role === 'assistant') &&
                typeof (m as Message).content === 'string'
        ) as Message[];
        if (cleaned.length === 0) return DEFAULT_SKILL_MESSAGES;
        return cleaned.slice(-SKILL_CHAT_MAX_MESSAGES);
    } catch {
        return DEFAULT_SKILL_MESSAGES;
    }
}

const SkillChat: React.FC<SkillChatProps> = ({ className = '' }) => {
    const { address } = useAccount();
    const [messages, setMessages] = useState<Message[]>(loadSkillChatMessages);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [protocolReady, setProtocolReady] = useState<boolean | null>(null);
    const [enablingProtocol, setEnablingProtocol] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const txBusy = messages.some((m) => m.txOutcome === 'pending');

    /** Grow textarea with content; cap height so long prompts scroll inside the box. */
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const maxPx = 200;
        el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
    }, [input]);

    useEffect(() => {
        try {
            localStorage.setItem(
                SKILL_CHAT_STORAGE_KEY,
                JSON.stringify(messages.slice(-SKILL_CHAT_MAX_MESSAGES))
            );
        } catch (e) {
            console.warn('Skill chat: could not persist history', e);
        }
    }, [messages]);

    useEffect(() => {
        if (!address) {
            setProtocolReady(null);
            return;
        }
        let cancelled = false;
        checkProxyApproval(address)
            .then((ok) => {
                if (!cancelled) setProtocolReady(ok);
            })
            .catch(() => {
                if (!cancelled) setProtocolReady(false);
            });
        return () => {
            cancelled = true;
        };
    }, [address]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const apiKey = getGeminiApiKey();
            if (!apiKey) {
                setMessages(prev => [...prev, { role: 'assistant', content: "Neural uplink restricted. VITE_GEMINI_API_KEY is missing." }]);
                return;
            }

            const ai = new GoogleGenAI({ apiKey });
            
            // Format history for the models.generateContent API
            const contents = [
                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                { role: 'model', parts: [{ text: "UNDERSTOOD. Systems initialized." }] },
                ...messages.slice(1).map(m => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content }],
                })),
                { role: 'user', parts: [{ text: userMsg }] }
            ];

            const result = await ai.models.generateContent({
                model: GEMINI_MODEL,
                contents,
            });
            const responseText = (result.text ?? (result as any).candidates?.[0]?.content?.parts?.[0]?.text) || "NO_SIGNAL_RECEIVED";

            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
            let txIntent: any = null;
            let contentAppend = '';
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
                    if (parsed.action === 'createAtom') {
                        if (!address) {
                            contentAppend =
                                '\n\n_(Connect your wallet, then send the same message again — the app will build the transaction for you.)_';
                        } else {
                            const label = String(parsed.label ?? '').trim();
                            const depositTrust = String(parsed.depositTrust ?? '0').trim();
                            const built = await buildCreateAtomTxIntent(address, label, depositTrust);
                            const onChainName = normalizeAtomLabel(label);
                            txIntent = {
                                action: 'createAtoms',
                                to: built.to,
                                data: built.data,
                                value: built.valueWei.toString(),
                                chainId: String(CHAIN_ID),
                                description:
                                    typeof parsed.description === 'string'
                                        ? parsed.description
                                        : `Create atom "${onChainName}"`,
                                txBuiltIn: true,
                                builtinLabel: onChainName,
                                builtinDepositTrust: depositTrust,
                                builtinDataHex: built.dataHex,
                            };
                        }
                    } else if (parsed.action === 'createTriple') {
                        if (!address) {
                            contentAppend =
                                '\n\n_(Connect your wallet, then send the same message again — the app will build the pipeline for you.)_';
                        } else {
                            const subject = String(parsed.subject ?? '').trim();
                            const predicate = String(parsed.predicate ?? '').trim();
                            const object = String(parsed.object ?? '').trim();
                            const depositTrust = String(parsed.depositTrust ?? '0').trim();
                            if (!subject || !predicate || !object) {
                                contentAppend = '\n\n_(createTriple JSON needs subject, predicate, and object.)_';
                            } else {
                                txIntent = {
                                    action: 'tripleFromLabels',
                                    subjectLabel: subject,
                                    predicateLabel: predicate,
                                    objectLabel: object,
                                    depositTrust,
                                    chainId: String(CHAIN_ID),
                                    description:
                                        typeof parsed.description === 'string'
                                            ? parsed.description
                                            : `Claim: ${subject} → ${predicate} → ${object}`,
                                };
                            }
                        }
                    } else {
                        txIntent = parsed;
                    }
                } catch (e) {
                    console.error('Failed to parse or build tx intent', e);
                    contentAppend = `\n\n_(Could not build transaction: ${extractErrorText(e)})_`;
                }
            }

            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: responseText + contentAppend, txIntent },
            ]);
        } catch (error: unknown) {
            console.error("Gemini Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: formatGeminiError(error) }]);
        } finally {
            setLoading(false);
        }
    };

    const executeTx = async (intent: any, messageIndex: number) => {
        playClick();
        if (!address) {
            toast.error("Connect wallet first");
            return;
        }

        const cid = parseInt(String(intent.chainId ?? CHAIN_ID), 10);
        if (cid !== CHAIN_ID) {
            toast.error(`Switch wallet to Intuition Mainnet (chain ${CHAIN_ID})`);
            return;
        }

        /** Triple pipeline: create missing atoms (sequential txs) then triple — no single calldata. */
        if (String(intent?.action ?? '') === 'tripleFromLabels') {
            try {
                await switchNetwork();
                const approved = await checkProxyApproval(address);
                if (!approved) {
                    await grantProxyApproval(address);
                    markProxyApproved(address);
                }
            } catch (setupErr: unknown) {
                const userRejected = isUserRejectionError(setupErr);
                const errText = userRejected
                    ? "Protocol approval cancelled in wallet"
                    : parseProtocolError(setupErr) || extractErrorText(setupErr) || "Network or protocol setup failed";
                toast.error(errText.length > 140 ? errText.slice(0, 137) + "…" : errText);
                setMessages((prev) =>
                    prev.map((msgItem, idx) =>
                        idx === messageIndex
                            ? {
                                  ...msgItem,
                                  txOutcome: userRejected ? ("rejected" as const) : ("failed" as const),
                                  txError: userRejected ? undefined : errText,
                              }
                            : msgItem
                    )
                );
                return;
            }
            setProtocolReady(true);
            setMessages((prev) =>
                prev.map((msgItem, idx) =>
                    idx === messageIndex ? { ...msgItem, txOutcome: "pending" as const, txError: undefined } : msgItem
                )
            );
            try {
                const result = await createTripleFromLabels(
                    String(intent.subjectLabel ?? ''),
                    String(intent.predicateLabel ?? ''),
                    String(intent.objectLabel ?? ''),
                    String(intent.depositTrust ?? '0.5'),
                    address,
                    (msg) => toast.info(msg)
                );
                toast.success("Triple broadcast confirmed.");
                window.dispatchEvent(new Event('local-tx-updated'));
                setMessages((prev) =>
                    prev.map((msgItem, idx) =>
                        idx === messageIndex
                            ? {
                                  ...msgItem,
                                  txOutcome: "success" as const,
                                  txHash: result.tripleHash,
                                  txTermId: String(result.tripleTermId),
                                  txAtomHashes: result.atomTxHashes.map(String),
                                  txError: undefined,
                              }
                            : msgItem
                    )
                );
            } catch (error: unknown) {
                const userRejected = isUserRejectionError(error);
                const errText = parseProtocolError(error) || extractErrorText(error) || "Triple pipeline failed";
                const shortErr = errText.length > 160 ? errText.slice(0, 157) + "…" : errText;
                setMessages((prev) =>
                    prev.map((msgItem, idx) =>
                        idx === messageIndex
                            ? {
                                  ...msgItem,
                                  txOutcome: userRejected ? ("rejected" as const) : ("failed" as const),
                                  txError: userRejected ? undefined : shortErr,
                              }
                            : msgItem
                    )
                );
                if (userRejected) toast.error("Transaction cancelled in wallet");
                else toast.error(shortErr.length > 140 ? shortErr.slice(0, 137) + "…" : shortErr);
            }
            return;
        }

        const to = intent?.to as string | undefined;
        const dataRaw = intent?.data as string | undefined;
        if (!to || !isAddress(to)) {
            toast.error("Invalid transaction target (to)");
            return;
        }
        if (!dataRaw || !isHex(dataRaw)) {
            toast.error("Invalid calldata (data must be 0x-hex)");
            return;
        }
        let valueWei: bigint;
        try {
            valueWei = BigInt(String(intent.value ?? '0'));
        } catch {
            toast.error("Invalid value (wei string)");
            return;
        }

        const action = String(intent?.action ?? '');
        const toLc = to.toLowerCase();
        const targetsFeeProxy = toLc === FEE_PROXY_ADDRESS.toLowerCase();
        // createAtoms / createTriples / deposit via FeeProxy require MultiVault operator approval.
        const needsProxy =
            action === 'createTriples' || action === 'deposit' || targetsFeeProxy;

        // Protocol approval must happen BEFORE preflight for FeeProxy calls.
        try {
            await switchNetwork();
            if (needsProxy) {
                const approved = await checkProxyApproval(address);
                if (!approved) {
                    await grantProxyApproval(address);
                    markProxyApproved(address);
                }
            }
        } catch (setupErr: unknown) {
            const userRejected = isUserRejectionError(setupErr);
            const errText = userRejected
                ? "Protocol approval cancelled in wallet"
                : parseProtocolError(setupErr) || extractErrorText(setupErr) || "Network or protocol setup failed";
            toast.error(errText.length > 140 ? errText.slice(0, 137) + "…" : errText);
            setMessages((prev) =>
                prev.map((msgItem, idx) =>
                    idx === messageIndex
                        ? {
                              ...msgItem,
                              txOutcome: userRejected ? ("rejected" as const) : ("failed" as const),
                              txError: userRejected ? undefined : errText,
                          }
                        : msgItem
                )
            );
            return;
        }

        setProtocolReady(true);

        const preflight = await preflightSkillBroadcast(address, to as `0x${string}`, valueWei, dataRaw as `0x${string}`);
        if (!preflight.ok) {
            const errMsg = preflight.message;
            toast.error(errMsg.length > 140 ? errMsg.slice(0, 137) + "…" : errMsg);
            setMessages((prev) =>
                prev.map((msgItem, idx) =>
                    idx === messageIndex
                        ? { ...msgItem, txOutcome: "failed" as const, txError: errMsg }
                        : msgItem
                )
            );
            return;
        }

        setMessages((prev) =>
            prev.map((msgItem, idx) =>
                idx === messageIndex ? { ...msgItem, txOutcome: "pending" as const, txError: undefined } : msgItem
            )
        );

        try {
            const hash = await broadcastTransaction(address, to as `0x${string}`, valueWei, dataRaw as `0x${string}`);
            toast.success("Transaction broadcasted!");
            let txTermId: string | undefined;
            try {
                if (intent.txBuiltIn && intent.builtinDataHex) {
                    txTermId = await getAtomTermIdFromTxHash(hash as `0x${string}`, intent.builtinDataHex as `0x${string}`);
                } else if (targetsFeeProxy && action === 'createAtoms') {
                    txTermId = await getAtomTermIdFromTxHash(hash as `0x${string}`);
                } else if (targetsFeeProxy && action === 'createTriples') {
                    txTermId = await getTripleTermIdFromTxHash(hash as `0x${string}`);
                }
            } catch {
                /* non-fatal */
            }
            setMessages((prev) =>
                prev.map((msgItem, idx) =>
                    idx === messageIndex
                        ? {
                              ...msgItem,
                              txOutcome: 'success' as const,
                              txHash: hash,
                              txTermId,
                              txError: undefined,
                          }
                        : msgItem
                )
            );
        } catch (error: unknown) {
            const userRejected = isUserRejectionError(error);
            const errText = parseProtocolError(error) || extractErrorText(error) || "Execution failed";
            const shortErr = errText.length > 160 ? errText.slice(0, 157) + "…" : errText;
            setMessages((prev) =>
                prev.map((msgItem, idx) =>
                    idx === messageIndex
                        ? {
                              ...msgItem,
                              txOutcome: userRejected ? ('rejected' as const) : ('failed' as const),
                              txError: userRejected ? undefined : shortErr,
                          }
                        : msgItem
                )
            );
            if (userRejected) {
                toast.error("Transaction cancelled in wallet");
            } else {
                toast.error(shortErr.length > 140 ? shortErr.slice(0, 137) + "…" : shortErr);
            }
        }
    };

    return (
        <div
            className={`flex flex-col h-full min-h-0 max-h-full w-full min-w-0 bg-[#050505] border-2 border-intuition-primary/20 clip-path-slant shadow-2xl overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="shrink-0 bg-intuition-primary/10 border-b border-intuition-primary/30 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Terminal size={18} className="text-intuition-primary" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Intuition Skill Agent</span>
                        <span className="text-[8px] font-mono text-intuition-primary uppercase animate-pulse">Ready for uplink</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            playClick();
                            try {
                                localStorage.removeItem(SKILL_CHAT_STORAGE_KEY);
                            } catch {
                                /* ignore */
                            }
                            setMessages(DEFAULT_SKILL_MESSAGES);
                            toast.info('Chat history cleared');
                        }}
                        onMouseEnter={playHover}
                        className="text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-intuition-primary transition-colors px-1.5 py-1"
                    >
                        Clear history
                    </button>
                    <div className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-[8px] font-black text-green-400 uppercase tracking-widest">
                        Mainnet_v1.2
                    </div>
                </div>
            </div>

            {address && (
                <div className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6 bg-black/60">
                    {protocolReady === null ? (
                        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">Checking protocol access…</p>
                    ) : protocolReady ? (
                        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono text-emerald-400/90">
                            <ShieldCheck size={14} className="shrink-0" />
                            <span>IntuRank protocol enabled — you can sign transactions below.</span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[10px] sm:text-[11px] font-mono text-amber-200/90 leading-snug min-w-0">
                                One-time step: allow IntuRank to move your TRUST for atoms/triples (same as Create flow). Your wallet will open when you tap the button.
                            </p>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!address) return;
                                    playClick();
                                    setEnablingProtocol(true);
                                    try {
                                        await switchNetwork();
                                        await grantProxyApproval(address);
                                        markProxyApproved(address);
                                        setProtocolReady(true);
                                        toast.success('Protocol enabled. Try Sign & Broadcast again.');
                                    } catch (e: unknown) {
                                        toast.error(parseProtocolError(e) || extractErrorText(e) || 'Could not enable protocol');
                                    } finally {
                                        setEnablingProtocol(false);
                                    }
                                }}
                                disabled={enablingProtocol}
                                onMouseEnter={playHover}
                                className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-[9px] sm:text-[10px] uppercase tracking-widest rounded-lg border border-amber-300/80"
                            >
                                {enablingProtocol ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                Enable protocol
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Scroll only here — flex-1 + min-h-0 so the panel height stays fixed and old messages scroll up */}
            <div 
                ref={scrollRef}
                className="min-h-0 flex-1 min-w-0 overflow-y-auto overflow-x-clip overscroll-y-contain p-4 sm:p-6 space-y-6 custom-scrollbar"
            >
                {messages.map((m, i) => (
                    <div key={i} className={`flex w-full min-w-0 ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`flex gap-4 w-full min-w-0 max-w-[min(100%,56rem)] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 shrink-0 flex items-center justify-center border-2 ${m.role === 'user' ? 'border-intuition-primary text-intuition-primary' : 'border-[#ff1e6d] text-[#ff1e6d]'} clip-path-slant bg-black`}>
                                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className="min-w-0 flex-1 space-y-4">
                                <div className={`p-4 max-w-full min-w-0 ${m.role === 'user' ? 'bg-intuition-primary/10 border-intuition-primary/30' : 'bg-white/5 border-white/10'} border clip-path-slant`}>
                                    <div className={`text-xs leading-relaxed font-mono ${m.role === 'user' ? 'text-white' : 'text-slate-300'} whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
                                        {m.content}
                                    </div>
                                </div>
                                {m.txIntent && (
                                    <div
                                        className={[
                                            'w-full max-w-full min-w-0 rounded-2xl border transition-[min-height,padding,box-shadow] duration-500 ease-out backdrop-blur-sm',
                                            !m.txOutcome &&
                                                'bg-gradient-to-b from-amber-950/50 to-black/80 border-amber-500/40 p-5 sm:p-6 space-y-5 shadow-[0_0_48px_rgba(245,158,11,0.12)] ring-1 ring-amber-400/15',
                                            m.txOutcome === 'pending' &&
                                                'min-h-[min(16rem,48vh)] skill-tx-pending-glow bg-gradient-to-b from-amber-950/60 to-black/90 border-amber-400/50 p-5 sm:p-6 space-y-5 shadow-[0_0_56px_rgba(245,158,11,0.18)] ring-1 ring-amber-300/20',
                                            m.txOutcome === 'success' &&
                                                'bg-gradient-to-b from-emerald-950/55 to-black/85 border-emerald-400/50 p-5 sm:p-6 space-y-4 shadow-[0_0_40px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/20',
                                            m.txOutcome === 'rejected' &&
                                                'bg-red-950/40 border-red-500/70 p-5 sm:p-6 space-y-4 shadow-[0_0_24px_rgba(239,68,68,0.14)]',
                                            m.txOutcome === 'failed' &&
                                                'bg-red-950/40 border-red-600/70 p-5 sm:p-6 space-y-4 shadow-[0_0_24px_rgba(239,68,68,0.14)]',
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                    >
                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-black uppercase tracking-widest text-xs sm:text-sm min-w-0">
                                            {m.txOutcome === 'success' &&
                                                <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />}
                                            {m.txOutcome === 'rejected' &&
                                                <XCircle size={22} className="text-red-400 shrink-0" />}
                                            {m.txOutcome === 'failed' &&
                                                <XCircle size={22} className="text-red-500 shrink-0" />}
                                            {m.txOutcome === 'pending' && (
                                                <Loader2 size={22} className="text-amber-400 shrink-0 animate-spin" />
                                            )}
                                            {!m.txOutcome && <Zap size={22} className="text-amber-400 shrink-0" />}
                                            <span
                                                className={`min-w-0 [overflow-wrap:anywhere] ${
                                                    m.txOutcome === 'success'
                                                        ? 'text-emerald-400'
                                                        : m.txOutcome === 'rejected' || m.txOutcome === 'failed'
                                                          ? 'text-red-400'
                                                          : m.txOutcome === 'pending'
                                                            ? 'text-amber-300'
                                                            : 'text-amber-400'
                                                }`}
                                            >
                                                {m.txOutcome === 'pending' && 'Awaiting signature'}
                                                {m.txOutcome === 'success' && 'Successful'}
                                                {m.txOutcome === 'rejected' && 'User rejected transaction'}
                                                {m.txOutcome === 'failed' && 'Transaction failed'}
                                                {!m.txOutcome && 'Proposed transaction'}
                                            </span>
                                        </div>

                                        {(m.txOutcome === undefined || m.txOutcome === 'pending') && (
                                            <div className="rounded-xl bg-black/35 border border-white/10 p-4 text-xs sm:text-sm text-slate-400 font-mono space-y-3">
                                                {m.txIntent.action === 'tripleFromLabels' ? (
                                                    <>
                                                        <p className="text-[10px] text-violet-300/95 uppercase tracking-[0.15em] font-black flex items-center gap-2">
                                                            <Layers size={14} className="shrink-0" />
                                                            Built in-app — FeeProxy (atoms + triple)
                                                        </p>
                                                        <div className="space-y-2 text-[11px] sm:text-xs">
                                                            <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                                                                <span className="text-slate-500">Subject</span>
                                                                <span className="text-white font-bold text-right break-all">{m.txIntent.subjectLabel}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                                                                <span className="text-slate-500">Predicate</span>
                                                                <span className="text-white font-bold text-right break-all">{m.txIntent.predicateLabel}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                                                                <span className="text-slate-500">Object</span>
                                                                <span className="text-white font-bold text-right break-all">{m.txIntent.objectLabel}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-4">
                                                                <span className="text-slate-500">Deposit (triple)</span>
                                                                <span className="text-white font-bold">{m.txIntent.depositTrust} {CURRENCY_SYMBOL}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 leading-relaxed">
                                                            Missing atoms are created first. Your wallet may ask for <strong className="text-slate-400">several signatures in order</strong> — this is expected (EOA wallets cannot batch into one tap).
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        {m.txIntent.txBuiltIn && (
                                                            <p className="text-[10px] text-cyan-400/90 uppercase tracking-widest mb-1">
                                                                Built in-app — FeeProxy.createAtoms (no pasted hex)
                                                            </p>
                                                        )}
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                                                                <span className="text-slate-500">Action</span>
                                                                <span className="text-white font-bold">{m.txIntent.action}</span>
                                                            </div>
                                                            {m.txIntent.txBuiltIn && m.txIntent.builtinLabel != null && (
                                                                <>
                                                                    <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                                                                        <span className="text-slate-500">Atom</span>
                                                                        <span className="text-white font-bold text-right break-all">{m.txIntent.builtinLabel}</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                                                                        <span className="text-slate-500">Deposit</span>
                                                                        <span className="text-white font-bold">
                                                                            {m.txIntent.builtinDepositTrust} {CURRENCY_SYMBOL}
                                                                        </span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {m.txIntent.value != null && (
                                                                <div className="flex justify-between gap-4 pt-1">
                                                                    <span className="text-slate-500">Total send</span>
                                                                    <span className="text-white font-bold">
                                                                        {(Number(m.txIntent.value) / 1e18).toFixed(4)} {CURRENCY_SYMBOL}
                                                                        {m.txIntent.txBuiltIn && (
                                                                            <span className="text-slate-500 text-[10px] font-normal"> (fee + deposit)</span>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {m.txOutcome === 'pending' && (
                                            <div className="space-y-4 pt-1">
                                                <div className="h-2.5 rounded-full bg-black/50 border border-amber-500/30 overflow-hidden">
                                                    <div
                                                        className="h-full w-[200%] skill-tx-roll-strip opacity-90"
                                                        style={{
                                                            background:
                                                                'linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.15) 20%, rgba(251,191,36,0.55) 50%, rgba(245,158,11,0.15) 80%, transparent 100%)',
                                                        }}
                                                    />
                                                </div>
                                                <div className="h-2 rounded-full bg-black/40 border border-amber-500/20 overflow-hidden opacity-80">
                                                    <div
                                                        className="h-full w-[200%] skill-tx-roll-strip opacity-70"
                                                        style={{
                                                            animationDelay: '0.35s',
                                                            background:
                                                                'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.08) 25%, rgba(253,230,138,0.4) 50%, rgba(251,191,36,0.08) 75%, transparent 100%)',
                                                        }}
                                                    />
                                                </div>
                                                <p className="text-[11px] sm:text-xs text-amber-200/90 font-mono leading-relaxed [overflow-wrap:anywhere]">
                                                    {m.txIntent?.action === 'tripleFromLabels'
                                                        ? 'Signing pipeline — approve each transaction in your wallet in order (atoms first if any are missing, then the triple).'
                                                        : 'Waiting for your wallet. Approve or reject the transaction there.'}
                                                </p>
                                            </div>
                                        )}

                                        {m.txOutcome === 'success' && (
                                            <div className="rounded-xl bg-black/40 border border-emerald-500/25 p-4 space-y-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/90">
                                                    Transaction details
                                                </p>
                                                <p className="text-xs sm:text-sm text-slate-300 font-mono leading-relaxed">
                                                    Broadcast confirmed. Your transaction succeeded and is on-chain.
                                                </p>
                                                {m.txAtomHashes && m.txAtomHashes.length > 0 && (
                                                    <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                                                        This run also signed <span className="text-slate-400">{m.txAtomHashes.length}</span> atom transaction
                                                        {m.txAtomHashes.length > 1 ? 's' : ''} — check the explorer for each hash if needed.
                                                    </p>
                                                )}
                                                {m.txHash ? (
                                                    <div className="space-y-2">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">
                                                            {m.txIntent?.action === 'tripleFromLabels' ? 'Triple tx hash' : 'Transaction hash'}
                                                        </span>
                                                        <p
                                                            className="text-[11px] font-mono text-slate-200 break-all"
                                                            title={m.txHash}
                                                        >
                                                            {m.txHash.slice(0, 14)}…{m.txHash.slice(-12)}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] font-mono text-slate-500">Tx hash unavailable.</p>
                                                )}
                                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
                                                    {m.txHash && (
                                                        <a
                                                            href={`${intuitionChain.blockExplorers.default.url}/tx/${m.txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center justify-center gap-2 px-5 py-3 border-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl transition-colors"
                                                        >
                                                            <ExternalLink size={16} /> View in explorer
                                                        </a>
                                                    )}
                                                    {m.txTermId && (
                                                        <Link
                                                            to={`/markets/${m.txTermId}`}
                                                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl shadow-[0_0_24px_rgba(16,185,129,0.25)] transition-colors"
                                                        >
                                                            <ExternalLink size={16} />
                                                            {m.txIntent?.action === 'tripleFromLabels' ? 'View claim' : 'View atom'}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {m.txOutcome === 'rejected' && (
                                            <p className="text-xs sm:text-sm text-red-200/95 font-mono leading-relaxed">
                                                You cancelled or declined this transaction in your wallet (or closed the
                                                prompt).
                                            </p>
                                        )}

                                        {m.txOutcome === 'failed' && (
                                            <p className="text-xs sm:text-sm text-red-200/95 font-mono leading-relaxed">
                                                {m.txError || 'The transaction could not be completed.'}
                                            </p>
                                        )}

                                        {!m.txOutcome && (
                                            <button
                                                type="button"
                                                onClick={() => executeTx(m.txIntent, i)}
                                                disabled={txBusy}
                                                className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm uppercase tracking-widest transition-all rounded-lg border border-amber-300/90 hover:border-white disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(245,158,11,0.3)]"
                                            >
                                                <CheckCircle2 size={20} /> Sign &amp; Broadcast
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start w-full min-w-0">
                        <div className="flex gap-4 items-center min-w-0 max-w-[min(100%,56rem)] text-slate-500 font-mono text-[10px] animate-pulse">
                            <div className="w-8 h-8 flex items-center justify-center border-2 border-slate-800 clip-path-slant bg-black">
                                <Bot size={16} />
                            </div>
                            <span>PROCESSING_COGNITIVE_REQUEST...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="shrink-0 p-4 bg-black border-t border-white/10">
                <div className="relative flex items-end">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            if (e.shiftKey) return;
                            if ((e.nativeEvent as KeyboardEvent).isComposing) return;
                            e.preventDefault();
                            void handleSend();
                        }}
                        rows={1}
                        placeholder="Ask to create an atom (e.g. create atom called My Node with 0.5 TRUST)…"
                        className="w-full bg-white/5 border border-white/20 py-3 pl-4 pr-14 text-xs text-white font-mono focus:border-intuition-primary outline-none clip-path-slant placeholder:text-slate-600 min-h-[52px] max-h-[200px] resize-none overflow-y-auto leading-relaxed"
                    />
                    <button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={!input.trim() || loading}
                        className="absolute right-2 bottom-2 p-2 text-intuition-primary hover:text-white disabled:opacity-40 transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <div className="mt-3 flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {[
                        'Create an atom called "IntuRank Sandbox" with 0.5 TRUST deposit',
                        'Create a triple: subject "Alice", predicate "trusts", object "Bob" — depositTrust 0.5 — output createTriple JSON',
                        "Make a claim that Intuition rocks — subject Intuition, predicate is, object awesome — 0.5 TRUST",
                        "What is the difference between an atom and a triple?",
                        "List the FeeProxy and MultiVault addresses for this app",
                    ].map((suggestion, i) => (
                        <button
                            key={i}
                            onClick={() => setInput(suggestion)}
                            className="shrink-0 px-3 py-1.5 bg-white/5 hover:bg-intuition-primary/20 border border-white/10 hover:border-intuition-primary/40 text-[9px] font-black text-slate-500 hover:text-intuition-primary uppercase tracking-widest transition-all clip-path-slant"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SkillChat;
