import { formatEther } from 'viem';
import { Account, Triple, Transaction } from '../types';
import { formatDisplayedShares } from './analytics';
import { CURRENCY_SYMBOL } from '../constants';

/**
 * Fixed context so market summaries read “Intuition smart” (aligned with Skill / IntuRank copy),
 * not like raw vault dumps. LLMs may still drift; prompts + normalization tighten output.
 */
export const MARKET_BRIEF_PRODUCT_CONTEXT = `
PRODUCT CONTEXT (authoritative wording — use for tone and protocol facts, not invented numbers):
- **Intuition** is an open protocol: a semantic graph of **atoms** (identities/concepts) and **triples** (claims subject → predicate → object), with **TRUST** staked in vaults on bonding curves. It is the on-chain trust and reputation layer for those claims.
- **IntuRank** (spell exactly **IntuRank**, I-N-T-U-R-A-N-K) is the explorer and rankings **app** on that network — markets, portfolios, comparisons — built for readers and traders; it is not a separate chain.
- In DATA below, vault balances are real on-chain values; ${CURRENCY_SYMBOL} in the UI denotes TRUST for this deployment.
`.trim();

/** Atoms whose label is the protocol or app name — lead with meaning, not only raw wei. */
export function isProtocolCanonLabel(label: string | undefined): 'intuition' | 'inturank' | null {
  const t = (label ?? '').trim().toLowerCase();
  if (t === 'intuition') return 'intuition';
  if (t === 'inturank') return 'inturank';
  return null;
}

function formatTrustRough(wei: string | undefined): string {
  if (!wei) return '0';
  const s = formatEther(BigInt(wei));
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `~${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `~${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `~${n.toFixed(2)}`;
  return `~${n.toFixed(4)}`;
}

function formatSharesRough(agent: Account): string {
  if (!agent.totalShares) return '0';
  const s = formatDisplayedShares(agent.totalShares);
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `~${(n / 1000).toFixed(1)}k`;
  return `~${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function buildMarketBriefLlmPrompt(
  agent: Account,
  triples: Triple[],
  history: Transaction[],
  triplesContext: string,
): string {
  const label = agent.label || 'Unknown';
  const canon = isProtocolCanonLabel(agent.label);
  const assetsHuman = formatTrustRough(agent.totalAssets);
  const sharesHuman = formatSharesRough(agent);
  const triplesCount = triples?.length ?? 0;
  const historyCount = history?.length ?? 0;

  const canonBlock =
    canon === 'intuition'
      ? `
CANONICAL NAME (entry label is "Intuition" — the protocol’s own atom):
- Sentence 1 MUST explain what **Intuition** is as a **protocol** (semantic graph: atoms + triples/claims, TRUST in vaults, reputation layer). Use **no numbers** in sentence 1 if you can — this is the “what is Intuition?” line, not the balance.
- Sentence 2 MUST cover **this page’s vault** on IntuRank in natural language: roughly how much TRUST, roughly how many shares, how many linked claims, and that there is recent activity — say “dozens of recent activities” style, not “50 rows.”
- BANNED phrasing (do not use): a title line like "Intuition:" then a second clause; "The Intuition has…" (sounds like a duplicate); leading with "vault balance of … TRUST units" as the **first** sentence; sounding like a filled-in form or spreadsheet.
- Prefer: "The Intuition Protocol …" / "the protocol …" then "On this IntuRank page, this atom’s vault holds about … TRUST …"
- Do not call the protocol "a THING." Say "the protocol," "this atom," or "this market entry."
`
      : canon === 'inturank'
        ? `
CANONICAL NAME (entry label is "IntuRank"):
- Sentence 1 MUST explain **IntuRank** as the **app** (explorer/rankings on Intuition) and how it relates to the protocol — not only vault numbers.
- Sentence 2 MUST summarize this entry’s vault (rounded TRUST), linked claims count, and activity using DATA below.
- Spell the product **IntuRank** correctly.
`
        : `
GENERIC ENTRY:
- Sentence 1: Who or what this entry represents (use the label and type from DATA).
- Sentence 2: Vault size in human terms (rounded), linked claims, and activity — still readable, not a spreadsheet.
`;

  return `${MARKET_BRIEF_PRODUCT_CONTEXT}

You write exactly **two short sentences** for the AI summary card on a market page.

STYLE:
- Sound like a knowledgeable Intuition user: clear, neutral, helpful — not robotic, not a data dump.
- Use the **rounded** figures from DATA (do not paste 10+ decimal places). Prefer "about 564k TRUST" over "564,339 TRUST units" when large.
- Never output the word "THING" as a placeholder. Never lead with only "The asset balance is…" for protocol-canonical names (see above).
- Do not use "Name: …" as a headline. Do not repeat the same proper noun awkwardly ("Intuition … The Intuition has …").
- Do not convert TRUST to fiat. Do not invent countries, unrelated games, celebrities, or entities not named in DATA.

${canonBlock}

DATA (for this page only):
- Entry label: "${label}"
- Entry type: ${agent.type || 'Standard'}
- Vault TRUST total (rounded for speech): ${assetsHuman} TRUST
- Shares (rounded): ${sharesHuman}
- Linked claims (triples): ${triplesCount}
- Recent activity rows listed: ${historyCount}
- Sample relationships: [${triplesContext || 'none listed'}]`;
}

function normalizeMarketBriefPreambles(raw: string): string {
  let t = raw.trim();
  if (!t) return t;
  t = t.replace(/^here'?s\s+(a\s+)?(quick\s+)?(summary|overview|brief)\s+of\s+[^.!?]+[.!?:]\s*/i, '');
  t = t.replace(/^here'?s\s+(a\s+)?(summary|overview|brief)\s*:\s*/i, '');
  t = t.replace(/^summary\s*:\s*/i, '');
  t = t.replace(/^this\s+(is\s+)?(a\s+)?(summary|overview)\s+of\s+[^.!?]+[.!?:]\s*/i, '');
  t = t.replace(/\n{2,}/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * Final pass on LLM text: strip bad habits + label-specific fixes (e.g. "Intuition: The Intuition has…").
 */
export function polishMarketBriefOutput(raw: string, agent: Account): string {
  let t = normalizeMarketBriefPreambles(raw);
  const canon = isProtocolCanonLabel(agent.label);

  if (canon === 'intuition') {
    t = t.replace(/^Intuition\s*:\s*/i, '');
    t = t.replace(/\bThe Intuition has\b/gi, 'This atom’s vault has');
    t = t.replace(/\bIntuition has a vault balance\b/gi, 'This atom’s vault holds');
    t = t.replace(/\b([\d,]+)\s+TRUST units\b/gi, 'about $1 TRUST');
    t = t.replace(/\b\d+\s+rows of recent on-chain activity\b/gi, (m) => {
      const n = parseInt(m.match(/\d+/)?.[0] ?? '', 10);
      return Number.isFinite(n) && n >= 10 ? 'substantial recent on-chain activity' : 'recent on-chain activity';
    });
  }
  if (canon === 'inturank') {
    t = t.replace(/^IntuRank\s*:\s*/i, '');
    t = t.replace(/\bThe IntuRank has\b/gi, 'This entry’s vault has');
  }

  t = t.replace(/\b(this|the|This|The)\s+THING\b/gi, (_, lead: string) => `${lead} atom`);
  t = t.replace(/\bTHING\b/g, 'atom');
  t = t.replace(/\d+\.\d{6,}/g, (m) => {
    const n = parseFloat(m);
    if (!Number.isFinite(n)) return m;
    if (n >= 10_000) return Math.round(n).toLocaleString();
    if (n >= 100) return n.toFixed(1);
    return n.toFixed(2);
  });
  return t.trim();
}
