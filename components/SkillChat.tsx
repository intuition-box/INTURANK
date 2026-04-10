import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { Terminal, Send, Loader2, CheckCircle2, Zap, User, Bot, XCircle, ExternalLink, ShieldCheck, Layers, ChevronsDown } from 'lucide-react';
import { useAccount } from 'wagmi';
import { isAddress, isHex } from 'viem';
import {
  broadcastTransaction,
  intuitionChain,
  switchNetwork,
  getProxyApprovalStatus,
  grantProxyApproval,
  markProxyApproved,
  parseProtocolError,
  preflightSkillBroadcast,
  buildCreateAtomTxIntent,
  normalizeAtomLabel,
  stripMarkdownInlineDecorators,
  getAtomTermIdFromTxHash,
  getTripleTermIdFromTxHash,
  createTripleFromLabels,
} from '../services/web3';
import {
    CURRENCY_SYMBOL,
    FEE_PROXY_ADDRESS,
    getGeminiApiKey,
    getGroqApiKey,
    getOpenAiApiKey,
    CHAIN_ID,
} from '../constants';
import { INTUITION_SKILL_FULL_SYSTEM_PROMPT } from '../services/intuitionSkillPrompt';
import { generateSkillChatCompletion, formatSkillLlmError } from '../services/skillLlm';
import { parseSkillTxJsonBlock } from '../services/skillTxJson';
import { maybeFetchSkillLiveContext } from '../services/skillLiveContext';
import { logSkillEvent } from '../services/skillTelemetry';
import { toast } from './Toast';
import { playClick, playHover } from '../services/audio';

type TxBroadcastOutcome = 'pending' | 'success' | 'rejected' | 'failed';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    /** Which backend answered this assistant message (Skill: Groq → Gemini → OpenAI). */
    llmProvider?: 'gemini' | 'groq' | 'openai';
    txIntent?: any;
    txOutcome?: TxBroadcastOutcome;
    txHash?: string;
    txError?: string;
    /** Market / claim detail: atom or triple term id */
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

/** GraphQL or prose was fenced as ```json — do not run JSON5 tx parser (avoids false "Could not build transaction" on read-only answers). */
function looksLikeGraphQLFencedAsJson(raw: string): boolean {
    const s = raw.trim();
    if (s.startsWith('{')) return false;
    return /^(query|mutation|subscription)\b/i.test(s) || /^query\s+\w/i.test(s);
}

/** Only show parse/build errors to the user when the block was meant as a Sign & broadcast intent. */
function looksLikeIntuRankTxIntentJson(raw: string): boolean {
    const s = raw.trim();
    if (!s.startsWith('{')) return false;
    return (
        /"action"\s*:\s*"(createAtom|createTriple)"/.test(s) ||
        (/"to"\s*:/.test(s) && /"data"\s*:/.test(s) && /"(0x)?[0-9a-fA-F]{40}"/.test(s))
    );
}

/** If the model echoed template text instead of a real atom name, do not offer Sign & broadcast. */
function isPlaceholderAtomLabel(label: string): boolean {
    const s = label.trim().toLowerCase();
    if (!s) return true;
    if (s.includes('placeholder')) return true;
    const bad = new Set([
        'your atom name',
        'human-readable name for the atom',
        'human-readable name',
        'use the user\'s exact chosen name here, not a placeholder',
        'example',
        'tbd',
        'my atom',
        'test',
        'atom name',
        'label',
    ]);
    return bad.has(s);
}

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

type SkillChatProps = {
    /** e.g. playground uses viewport height; default fills parent */
    className?: string;
};

const SKILL_CHAT_STORAGE_KEY = 'inturank_skill_chat_v1';
/** Cap persisted history to keep localStorage small and snappy */
const SKILL_CHAT_MAX_MESSAGES = 48;

const DEFAULT_SKILL_MESSAGES: Message[] = [
    {
        role: 'assistant',
        content:
            "Hi. I run on the full upstream Intuition skill package (SKILL.md, GraphQL reference, schemas, workflows, deposit/redeem batch ops, simulation, fees) plus IntuRank-specific routing. Ask deep protocol questions or tell me what to create (atom or a claim like “Alice / trusts / Bob” with a 0.5 TRUST deposit). I reply in your language when I can. Connect your wallet when you are ready to Sign & broadcast.",
    },
];

const SKILL_MD_COMPONENTS = {
    p: ({ children }: { children?: React.ReactNode }) => (
        <p className="mb-2 last:mb-0 text-[13px] text-slate-300 leading-[1.65]">{children}</p>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-slate-200">{children}</em>,
    ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className="my-2 pl-4 list-disc space-y-1 [overflow-wrap:anywhere]">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
        <ol className="my-2 pl-4 list-decimal space-y-1 [overflow-wrap:anywhere]">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
        <a
            href={href}
            className="text-intuition-primary hover:underline break-all"
            target="_blank"
            rel="noreferrer"
        >
            {children}
        </a>
    ),
    pre: ({ children }: { children?: React.ReactNode }) => (
        <pre className="overflow-x-auto rounded-lg bg-black/40 p-2 my-2 text-[11px] font-mono text-slate-200 border border-white/10">
            {children}
        </pre>
    ),
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
        const block = Boolean(className?.includes('language-'));
        if (block) {
            return <code className={className}>{children}</code>;
        }
        return (
            <code className="rounded bg-black/40 px-1 py-0.5 text-[11px] font-mono text-cyan-200/90">{children}</code>
        );
    },
    h1: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="text-sm font-bold text-white mt-3 mb-1 first:mt-0">{children}</h3>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="text-sm font-bold text-white mt-3 mb-1 first:mt-0">{children}</h3>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="text-sm font-bold text-white mt-3 mb-1 first:mt-0">{children}</h3>
    ),
};

function MarkdownSegment({ text }: { text: string }) {
    const t = text.trim();
    if (!t) return null;
    return (
        <div className="[overflow-wrap:anywhere]">
            <ReactMarkdown components={SKILL_MD_COMPONENTS as any}>{text}</ReactMarkdown>
        </div>
    );
}

/** Keeps chat readable: raw JSON from the model lives in a disclosure instead of inline. */
function AssistantMessageBody({ content }: { content: string }) {
    const parts: React.ReactNode[] = [];
    let last = 0;
    const re = /```json\s*([\s\S]*?)```/gi;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(content)) !== null) {
        if (m.index > last) {
            parts.push(<MarkdownSegment key={key++} text={content.slice(last, m.index)} />);
        }
        parts.push(
            <details key={key++} className="mt-3 rounded-xl border border-white/10 bg-black/30 text-left">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-slate-500 font-sans hover:text-slate-300 [&::-webkit-details-marker]:hidden flex items-center gap-2">
                    <span className="text-intuition-primary/90">▸</span> Technical details (JSON)
                </summary>
                <pre className="max-h-40 overflow-auto border-t border-white/5 p-3 text-[10px] leading-relaxed text-slate-400 font-mono">{m[1].trim()}</pre>
            </details>
        );
        last = m.index + m[0].length;
    }
    if (last === 0) {
        return <MarkdownSegment text={content} />;
    }
    if (last < content.length) {
        parts.push(<MarkdownSegment key={key++} text={content.slice(last)} />);
    }
    return <div className="space-y-1">{parts}</div>;
}

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
        return cleaned.slice(-SKILL_CHAT_MAX_MESSAGES).map((m) =>
            /* A stale "pending" from a previous session disables Sign & broadcast; clear it. */
            m.txOutcome === 'pending' ? { ...m, txOutcome: undefined, txError: undefined } : m
        );
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
    /** When true, new messages keep the view pinned to the bottom; false if user scrolled up to read. */
    const stickToBottomRef = useRef(true);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);

    const checkScrollPosition = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
        const nearBottom = gap < 100;
        stickToBottomRef.current = nearBottom;
        const scrollable = el.scrollHeight > el.clientHeight + 40;
        setShowJumpToLatest(!nearBottom && scrollable);
    }, []);

    const jumpToLatest = useCallback(() => {
        playClick();
        const el = scrollRef.current;
        if (!el) return;
        stickToBottomRef.current = true;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        requestAnimationFrame(() => {
            checkScrollPosition();
        });
    }, [checkScrollPosition]);

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
        getProxyApprovalStatus(address)
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
        if (!stickToBottomRef.current) return;
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => checkScrollPosition());
    }, [messages, loading, checkScrollPosition]);

    useEffect(() => {
        requestAnimationFrame(() => checkScrollPosition());
    }, [checkScrollPosition]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        stickToBottomRef.current = true;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            if (!getGeminiApiKey() && !getGroqApiKey() && !getOpenAiApiKey()) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'assistant',
                        content:
                            'Add `VITE_GROQ_API_KEY` (preferred) and/or `VITE_GEMINI_API_KEY` and/or `VITE_OPENAI_API_KEY` to `.env.local` to use the agent.',
                    },
                ]);
                return;
            }

            let promptUserMsg = userMsg;
            try {
                const live = await maybeFetchSkillLiveContext(userMsg);
                if (live) {
                    promptUserMsg = `${userMsg}\n\n---\n${live}\n---`;
                    logSkillEvent({ level: 'debug', event: 'skill.chat.live_context_attached' });
                }
            } catch (e) {
                logSkillEvent({ level: 'warn', event: 'skill.chat.live_context_error', error: e });
            }

            const { text: responseText, provider } = await generateSkillChatCompletion({
                systemPrompt: INTUITION_SKILL_FULL_SYSTEM_PROMPT,
                history: messages.slice(1).map((m) => ({ role: m.role, content: m.content })),
                userMsg: promptUserMsg,
            });

            if (import.meta.env.DEV) {
                console.info(`[Intuition Skill] Reply via: ${provider}`);
            }

            logSkillEvent({
                level: 'info',
                event: 'skill.chat.reply',
                detail: { provider, chars: responseText.length },
            });

            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
            let txIntent: any = null;
            let contentAppend = '';
            if (jsonMatch) {
                const jsonBlockBody = jsonMatch[1];
                if (looksLikeGraphQLFencedAsJson(jsonBlockBody)) {
                    /* Model put GraphQL in a json fence; skip tx pipeline — answer text is still shown. */
                } else try {
                    const parsed = parseSkillTxJsonBlock(jsonBlockBody);
                    if (parsed.action === 'createAtom') {
                        if (!address) {
                            contentAppend =
                                '\n\n_(Connect your wallet and send the same message again to build the transaction.)_';
                        } else {
                            const label = stripMarkdownInlineDecorators(String(parsed.label ?? '').trim());
                            const depositTrust = String(parsed.depositTrust ?? '0').trim();
                            if (isPlaceholderAtomLabel(label)) {
                                contentAppend =
                                    '\n\n_(No on-chain preview: use a specific atom name in your message if you want to create one.)_';
                            } else {
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
                        }
                    } else if (parsed.action === 'createTriple') {
                        if (!address) {
                            contentAppend =
                                '\n\n_(Connect your wallet and send the same message again to continue.)_';
                        } else {
                            const subject = stripMarkdownInlineDecorators(String(parsed.subject ?? '').trim());
                            const predicate = stripMarkdownInlineDecorators(String(parsed.predicate ?? '').trim());
                            const object = stripMarkdownInlineDecorators(String(parsed.object ?? '').trim());
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
                    if (looksLikeIntuRankTxIntentJson(jsonBlockBody)) {
                        contentAppend = `\n\n_(Could not build transaction: ${extractErrorText(e)})_`;
                    }
                }
            }

            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: responseText + contentAppend, txIntent, llmProvider: provider },
            ]);
            logSkillEvent({
                level: 'info',
                event: 'skill.chat.message_saved',
                detail: { has_tx_intent: Boolean(txIntent) },
            });
        } catch (error: unknown) {
            console.error('Skill LLM error:', error);
            logSkillEvent({ level: 'error', event: 'skill.chat.llm_failed', error });
            setMessages((prev) => [...prev, { role: 'assistant', content: formatSkillLlmError(error) }]);
        } finally {
            setLoading(false);
        }
    };

    const executeTx = async (intent: any, messageIndex: number) => {
        try {
        playClick();
        if (!address) {
            toast.error("Connect wallet first");
            return;
        }

        logSkillEvent({
            level: 'info',
            event: 'skill.tx.start',
            detail: { action: String(intent?.action ?? ''), message_index: messageIndex },
        });

        const cid = parseInt(String(intent.chainId ?? CHAIN_ID), 10);
        if (cid !== CHAIN_ID) {
            toast.error(`Switch wallet to Intuition Mainnet (chain ${CHAIN_ID})`);
            return;
        }

        /** Triple pipeline: create missing atoms (sequential txs) then triple. No single calldata. */
        if (String(intent?.action ?? '') === 'tripleFromLabels') {
            try {
                await switchNetwork();
                const approved = await getProxyApprovalStatus(address);
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
                logSkillEvent({
                    level: 'info',
                    event: 'skill.tx.success',
                    detail: { action: 'tripleFromLabels', tx_hash_prefix: String(result.tripleHash).slice(0, 12) },
                });
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
                logSkillEvent({
                    level: userRejected ? 'info' : 'warn',
                    event: userRejected ? 'skill.tx.rejected' : 'skill.tx.failed',
                    detail: { action: 'tripleFromLabels', message: shortErr.slice(0, 200) },
                });
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
                const approved = await getProxyApprovalStatus(address);
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
            logSkillEvent({
                level: 'info',
                event: 'skill.tx.success',
                detail: { action, tx_hash_prefix: String(hash).slice(0, 12) },
            });
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
            logSkillEvent({
                level: userRejected ? 'info' : 'warn',
                event: userRejected ? 'skill.tx.rejected' : 'skill.tx.failed',
                detail: { action, message: shortErr.slice(0, 200) },
            });
        }
        } catch (unexpected: unknown) {
            logSkillEvent({
                level: 'error',
                event: 'skill.tx.unexpected',
                error: unexpected,
                detail: { message_index: messageIndex },
            });
            toast.error('Unexpected error. Try again.');
            setMessages((prev) =>
                prev.map((msgItem, idx) =>
                    idx === messageIndex
                        ? {
                              ...msgItem,
                              txOutcome: 'failed' as const,
                              txError: extractErrorText(unexpected),
                          }
                        : msgItem
                )
            );
        }
    };

    return (
        <div
            className={`flex flex-col h-full min-h-0 max-h-full w-full min-w-0 bg-[#0b0d12] border border-white/[0.08] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.45)] overflow-hidden ring-1 ring-white/[0.04] ${className}`}
        >
            {/* Header — standard chat toolbar */}
            <header className="shrink-0 flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 border-b border-white/[0.06] bg-[#0f1117]">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-intuition-primary/15 text-intuition-primary border border-intuition-primary/25">
                        <Terminal size={17} strokeWidth={2} aria-hidden />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white font-sans tracking-tight leading-tight">Skill agent</span>
                        <span className="text-[11px] text-slate-500 font-sans leading-tight mt-0.5">Intuition Mainnet · chain {CHAIN_ID}</span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        playClick();
                        try {
                            localStorage.removeItem(SKILL_CHAT_STORAGE_KEY);
                        } catch {
                            /* ignore */
                        }
                        stickToBottomRef.current = true;
                        setMessages(DEFAULT_SKILL_MESSAGES);
                        toast.info('Chat cleared');
                    }}
                    onMouseEnter={playHover}
                    className="shrink-0 text-xs font-medium text-slate-400 hover:text-white font-sans rounded-lg px-2.5 py-1.5 border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intuition-primary/40"
                >
                    Clear chat
                </button>
            </header>

            {address && (
                <div className="shrink-0 border-b border-white/[0.06] px-3 py-2 sm:px-4 bg-[#08090c]">
                    {protocolReady === null ? (
                        <p className="text-xs text-slate-500 font-sans">Checking permissions…</p>
                    ) : protocolReady ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-400/95 font-sans">
                            <ShieldCheck size={14} className="shrink-0" />
                            <span>Ready to sign. TRUST allowance is set.</span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-amber-100/90 leading-snug min-w-0 font-sans">
                                Allow IntuRank to move TRUST for atoms and triples (same as Create). Your wallet will open once.
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
                                        toast.success('You can sign transactions now.');
                                    } catch (e: unknown) {
                                        toast.error(parseProtocolError(e) || extractErrorText(e) || 'Could not enable protocol');
                                    } finally {
                                        setEnablingProtocol(false);
                                    }
                                }}
                                disabled={enablingProtocol}
                                onMouseEnter={playHover}
                                className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm rounded-lg border border-amber-300/80"
                            >
                                {enablingProtocol ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                Enable
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Message list — scroll container; aria-live for screen readers */}
            <div className="relative flex flex-1 min-h-0 min-w-0 flex-col">
                <div
                    ref={scrollRef}
                    onScroll={checkScrollPosition}
                    role="log"
                    aria-relevant="additions"
                    aria-label="Skill conversation"
                    className="min-h-0 flex-1 min-w-0 overflow-y-auto overflow-x-clip overscroll-y-contain px-3 py-4 sm:px-4 sm:py-5 space-y-4 bg-[#060708] scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.35)_transparent]"
                >
                {messages.map((m, i) => {
                    const otherTxPending = messages.some((mm, idx) => mm.txOutcome === 'pending' && idx !== i);
                    return (
                    <div key={i} className={`flex w-full min-w-0 ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}>
                        <div
                            className={`flex gap-2.5 sm:gap-3 w-full min-w-0 ${m.role === 'user' ? 'flex-row-reverse max-w-[min(100%,28rem)] ml-auto' : 'max-w-[min(100%,40rem)]'}`}
                        >
                            <div
                                className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full ${m.role === 'user' ? 'bg-intuition-primary/20 text-intuition-primary' : 'bg-white/[0.06] text-slate-300 border border-white/[0.08]'}`}
                                aria-hidden
                            >
                                {m.role === 'user' ? <User size={15} strokeWidth={2} /> : <Bot size={15} strokeWidth={2} />}
                            </div>
                            <div className="min-w-0 flex-1 space-y-4">
                                <div
                                    className={`px-3.5 py-3 sm:px-4 sm:py-3.5 max-w-full min-w-0 rounded-2xl ${m.role === 'user' ? 'rounded-br-md bg-intuition-primary/[0.14] border border-intuition-primary/25 text-white' : 'rounded-bl-md bg-[#12151c] border border-white/[0.07] text-slate-200'} shadow-sm`}
                                >
                                    {m.role === 'assistant' ? (
                                        <div className="text-[13px] leading-[1.65] text-slate-300 font-sans">
                                            <AssistantMessageBody content={m.content} />
                                            {m.llmProvider && (
                                                <p
                                                    className="mt-3 pt-2.5 border-t border-white/[0.06] text-[10px] text-slate-500 font-mono tracking-wide"
                                                    title="Which API served this reply (Groq first; Gemini/OpenAI if fallback ran)."
                                                >
                                                    Reply via:{' '}
                                                    <span className="text-slate-400">
                                                        {m.llmProvider === 'gemini'
                                                            ? 'Google Gemini'
                                                            : m.llmProvider === 'groq'
                                                              ? 'Groq'
                                                              : 'OpenAI'}
                                                    </span>
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-[13px] leading-[1.65] font-sans text-white/95 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                            {m.content}
                                        </div>
                                    )}
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
                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-semibold font-sans min-w-0">
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
                                                            : 'text-amber-200'
                                                }`}
                                            >
                                                {m.txOutcome === 'pending' && 'Waiting for wallet'}
                                                {m.txOutcome === 'success' && 'Confirmed on-chain'}
                                                {m.txOutcome === 'rejected' && 'Cancelled'}
                                                {m.txOutcome === 'failed' && 'Failed'}
                                                {!m.txOutcome && 'Review transaction'}
                                            </span>
                                        </div>

                                        {(m.txOutcome === undefined || m.txOutcome === 'pending') && (
                                            <div className="rounded-xl bg-black/35 border border-white/10 p-4 text-xs sm:text-sm text-slate-400 font-sans space-y-3">
                                                {m.txIntent.action === 'tripleFromLabels' ? (
                                                    <>
                                                        <p className="text-xs text-violet-200/95 font-medium font-sans flex items-center gap-2">
                                                            <Layers size={14} className="shrink-0" />
                                                            Triple (missing atoms are created first)
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
                                                        <p className="text-xs text-slate-500 leading-relaxed font-sans">
                                                            You may need to approve more than one transaction in order. That is normal.
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        {m.txIntent.txBuiltIn && (
                                                            <p className="text-xs text-cyan-300/90 font-medium font-sans mb-1">
                                                                New atom (built in-app)
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
                                                <p className="text-xs text-amber-100/90 font-sans leading-relaxed [overflow-wrap:anywhere]">
                                                    {m.txIntent?.action === 'tripleFromLabels'
                                                        ? 'Approve each prompt in your wallet in order.'
                                                        : 'Approve or reject in your wallet.'}
                                                </p>
                                            </div>
                                        )}

                                        {m.txOutcome === 'success' && (
                                            <div className="rounded-xl bg-black/40 border border-emerald-500/25 p-4 space-y-4">
                                                <p className="text-xs font-semibold text-emerald-400/95 font-sans">
                                                    Done
                                                </p>
                                                <p className="text-sm text-slate-300 font-sans leading-relaxed">
                                                    Your transaction is on-chain.
                                                </p>
                                                {m.txAtomHashes && m.txAtomHashes.length > 0 && (
                                                    <p className="text-xs text-slate-500 font-sans leading-relaxed">
                                                        Also signed {m.txAtomHashes.length} atom transaction{m.txAtomHashes.length > 1 ? 's' : ''}. See the explorer for details.
                                                    </p>
                                                )}
                                                {m.txHash ? (
                                                    <div className="space-y-2">
                                                        <span className="text-xs font-medium text-slate-500 block font-sans">
                                                            {m.txIntent?.action === 'tripleFromLabels' ? 'Triple transaction' : 'Transaction'}
                                                        </span>
                                                        <p
                                                            className="text-[11px] font-mono text-slate-200 break-all"
                                                            title={m.txHash}
                                                        >
                                                            {m.txHash.slice(0, 14)}…{m.txHash.slice(-12)}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs font-sans text-slate-500">Hash unavailable.</p>
                                                )}
                                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1">
                                                    {m.txHash && (
                                                        <a
                                                            href={`${intuitionChain.blockExplorers.default.url}/tx/${m.txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center justify-center gap-2 px-5 py-3 border-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 font-semibold text-sm rounded-xl transition-colors font-sans"
                                                        >
                                                            <ExternalLink size={16} /> Explorer
                                                        </a>
                                                    )}
                                                    {m.txTermId && (
                                                        <Link
                                                            to={`/markets/${m.txTermId}`}
                                                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl shadow-[0_0_24px_rgba(16,185,129,0.25)] transition-colors font-sans"
                                                        >
                                                            <ExternalLink size={16} />
                                                            {m.txIntent?.action === 'tripleFromLabels' ? 'Open claim' : 'Open atom'}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {m.txOutcome === 'rejected' && (
                                            <p className="text-sm text-red-200/95 font-sans leading-relaxed">
                                                Declined in wallet.
                                            </p>
                                        )}

                                        {m.txOutcome === 'failed' && (
                                            <p className="text-sm text-red-200/95 font-sans leading-relaxed">
                                                {m.txError || 'Something went wrong.'}
                                            </p>
                                        )}

                                        {!m.txOutcome && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (otherTxPending) {
                                                        toast.info(
                                                            'Another transaction is still waiting for your wallet. Approve or reject it first.'
                                                        );
                                                        return;
                                                    }
                                                    void executeTx(m.txIntent, i);
                                                }}
                                                disabled={!address}
                                                title={
                                                    !address
                                                        ? 'Connect your wallet'
                                                        : otherTxPending
                                                          ? 'Another wallet request is pending'
                                                          : 'Sign and broadcast'
                                                }
                                                className={`w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-all rounded-lg border border-amber-300/90 hover:border-white disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_24px_rgba(245,158,11,0.3)] font-sans ${!address || otherTxPending ? 'opacity-60' : ''}`}
                                            >
                                                <CheckCircle2 size={20} /> Sign &amp; broadcast
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    );
                })}
                {loading && (
                    <div className="flex justify-start w-full min-w-0" aria-live="polite" aria-busy="true">
                        <div className="flex gap-2.5 sm:gap-3 items-center min-w-0 max-w-[min(100%,40rem)] text-slate-400 text-sm font-sans">
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.08] text-slate-400" aria-hidden>
                                <Bot size={15} strokeWidth={2} />
                            </div>
                            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/[0.07] bg-[#12151c] px-4 py-2.5 shadow-sm">
                                <span className="text-[13px] text-slate-400">Thinking</span>
                                <span className="flex gap-1" aria-hidden>
                                    {[0, 1, 2].map((dot) => (
                                        <span
                                            key={dot}
                                            className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce"
                                            style={{ animationDelay: `${dot * 0.12}s` }}
                                        />
                                    ))}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
                </div>

                {showJumpToLatest && (
                    <button
                        type="button"
                        onClick={jumpToLatest}
                        onMouseEnter={playHover}
                        className="pointer-events-auto absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-[#14161f]/95 px-3 py-1.5 text-[11px] font-semibold font-sans text-slate-200 shadow-lg backdrop-blur-md hover:bg-[#1a1d28] hover:border-intuition-primary/35 hover:text-intuition-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intuition-primary/45"
                        aria-label="Jump to latest message"
                    >
                        <ChevronsDown size={14} className="shrink-0 opacity-90" aria-hidden />
                        Jump to latest
                    </button>
                )}
            </div>

            {/* Composer — fixed footer, standard enter-to-send */}
            <div className="shrink-0 px-3 pt-2 pb-3 sm:px-4 sm:pb-4 bg-[#0a0c10] border-t border-white/[0.08]">
                <div className="relative flex items-end gap-2">
                    <label htmlFor="skill-chat-input" className="sr-only">
                        Message to Skill agent
                    </label>
                    <textarea
                        id="skill-chat-input"
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
                        placeholder="Message…"
                        autoComplete="off"
                        className="w-full min-h-[48px] max-h-[200px] resize-none rounded-xl border border-white/[0.1] bg-[#12151c] py-3 pl-3.5 pr-[3.25rem] text-sm text-white font-sans leading-relaxed placeholder:text-slate-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)] transition-shadow focus:border-intuition-primary/45 focus:outline-none focus:ring-2 focus:ring-intuition-primary/25"
                    />
                    <button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={!input.trim() || loading}
                        aria-label="Send message"
                        className="absolute right-1.5 bottom-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-intuition-primary/25 text-intuition-primary hover:bg-intuition-primary/40 disabled:pointer-events-none disabled:opacity-35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intuition-primary/50"
                    >
                        <Send size={17} strokeWidth={2} aria-hidden />
                    </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 px-0.5">
                    <p className="text-[10px] text-slate-600 font-sans select-none">
                        <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px font-mono text-[9px] text-slate-500">Enter</kbd>
                        {' '}to send ·{' '}
                        <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px font-mono text-[9px] text-slate-500">Shift</kbd>
                        +
                        <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px font-mono text-[9px] text-slate-500">Enter</kbd>
                        {' '}new line
                    </p>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                    {[
                        { short: 'Create an atom', full: 'Create an atom called IntuRank Sandbox with 0.5 TRUST deposit' },
                        { short: 'Alice trusts Bob', full: 'Create a triple: subject Alice, predicate trusts, object Bob, deposit 0.5 TRUST' },
                        { short: 'Atoms vs triples', full: 'What is the difference between an atom and a triple?' },
                        { short: 'Contract addresses', full: 'What are the FeeProxy and MultiVault addresses used in this app?' },
                    ].map((suggestion, i) => (
                        <button
                            key={i}
                            type="button"
                            title={suggestion.full}
                            onClick={() => setInput(suggestion.full)}
                            className="shrink-0 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.14] text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors rounded-lg font-sans max-w-[220px] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intuition-primary/35"
                        >
                            {suggestion.short}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SkillChat;
