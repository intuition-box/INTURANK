export const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE === 'true';

/** `VITE_ARENA_ENABLED=true` → full Arena at `/climb`. Otherwise `/climb` shows a coming-soon placeholder (nav unchanged). */
export const ARENA_ENABLED = import.meta.env.VITE_ARENA_ENABLED === 'true';

/** Parse VITE_GEMINI_API_KEY (single key or comma-separated keys) and return one. Picks randomly when multiple. */
export const getGeminiApiKey = (): string => {
  const raw = String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
  if (!raw) return '';
  const keys = raw.split(',').map(k => k.trim()).filter(Boolean);
  if (keys.length === 0) return '';
  return keys[Math.floor(Math.random() * keys.length)];
};

/**
 * Gemini model when Groq fails and Gemini fallback runs (`generateContent`).
 * Set `VITE_GEMINI_MODEL` in `.env.local` to pin a model ID (e.g. `gemini-2.0-flash`) if the default is unavailable for your key.
 */
export const GEMINI_MODEL =
  (import.meta.env.VITE_GEMINI_MODEL as string | undefined)?.trim() || 'gemini-2.5-flash';

/** OpenAI API key — fallback after Groq/Gemini (platform.openai.com — ChatGPT Plus does not include API access). */
export const getOpenAiApiKey = (): string => {
  const raw = String(import.meta.env.VITE_OPENAI_API_KEY ?? '').trim();
  if (!raw) return '';
  const keys = raw.split(',').map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return '';
  return keys[Math.floor(Math.random() * keys.length)];
};

/** Model for OpenAI fallback (`gpt-4o-mini` is cost-effective). */
export const OPENAI_MODEL =
  (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() || 'gpt-4o-mini';

/** Groq (console.groq.com) — primary LLM for Skill + in-app AI; OpenAI-compatible, fast free tier. */
export const getGroqApiKey = (): string => {
  const raw = String(import.meta.env.VITE_GROQ_API_KEY ?? '').trim();
  if (!raw) return '';
  const keys = raw.split(',').map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return '';
  return keys[Math.floor(Math.random() * keys.length)];
};

/** Groq chat model id (see https://console.groq.com/docs/models). */
export const GROQ_MODEL =
  (import.meta.env.VITE_GROQ_MODEL as string | undefined)?.trim() || 'llama-3.3-70b-versatile';

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export const CHAIN_ID = 1155;
export const NETWORK_NAME = "Intuition Mainnet";
export const RPC_URL = "https://rpc.intuition.systems/http";
/**
 * Core Intuition Graph endpoint.
 * In dev, ALWAYS use /v1/graphql so Vite proxies to mainnet (avoids CORS + rate limits).
 * In production, use VITE_GRAPHQL_URL from env or fallback.
 */
export const GRAPHQL_URL =
  import.meta.env.DEV ? "/v1/graphql" : (import.meta.env.VITE_GRAPHQL_URL || "https://mainnet.intuition.sh/v1/graphql");
export const EXPLORER_URL = "https://explorer.intuition.systems";
export const CURRENCY_SYMBOL = "₸";

/** Semantic app release; keep `package.json` `"version"` in sync. */
export const APP_VERSION = '2.0.0';
/** Short label for UI chrome (sidebar wordmark, certification strings). */
export const APP_VERSION_DISPLAY = 'V.2.0';

/** Shared page hero typography (matches Markets and Documentation). */
export const PAGE_HERO_EYEBROW = 'text-sm text-slate-500 font-sans';
export const PAGE_HERO_TITLE =
  'text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white font-display tracking-tight leading-[1.12]';
export const PAGE_HERO_BODY = 'text-[15px] text-slate-400 leading-relaxed font-sans';

/** Season 2 / fallback epoch id when no window matches (keep aligned with latest shipped epoch) */
export const SEASON_2_EPOCH_ID = 11;

/** Human-readable date range for Epoch 8 (Season 2 current period) — matches Intuition portal */
export const SEASON_2_EPOCH_8_DATE_RANGE = 'Feb 24, 4:00 PM – Mar 10, 4:00 PM';

/** ISO date strings for Epoch 8 — required by get_pnl_leaderboard_period (p_start_date, p_end_date) */
export const SEASON_2_EPOCH_8_START = '2026-02-24T16:00:00Z';
export const SEASON_2_EPOCH_8_END = '2026-03-10T16:00:00Z';

export type Season2EpochDef = {
  id: number;
  label: string;
  range: string;
  start: string;
  end: string;
  /** Manual override; if unset, `computeSeason2DefaultEpochId()` uses date windows + env */
  isCurrent?: boolean;
};

/** Season 2 Epoch schedule for homepage / stats selectors. Approximate 14-day epochs. New epochs: add at top, set `isCurrent` or rely on date range. */
export const SEASON_2_EPOCHS: Season2EpochDef[] = [
  {
    id: 11,
    label: 'Epoch 11',
    range: 'Apr 7, 3:00 PM UTC – Apr 21, 3:00 PM UTC',
    start: '2026-04-07T15:00:00Z',
    end: '2026-04-21T15:00:00Z',
  },
  {
    id: 10,
    label: 'Epoch 10',
    range: 'Mar 24, 3:00 PM UTC – Apr 7, 3:00 PM UTC',
    start: '2026-03-24T15:00:00Z',
    end: '2026-04-07T15:00:00Z',
  },
  {
    id: 9,
    label: 'Epoch 9',
    range: 'Mar 10, 3:00 PM UTC – Mar 24, 3:00 PM UTC',
    start: '2026-03-10T15:00:00Z',
    /** Ends the instant Epoch 10 starts (same boundary the API uses for period queries). */
    end: '2026-03-24T15:00:00Z',
  },
  {
    id: 8,
    label: 'Epoch 8',
    range: SEASON_2_EPOCH_8_DATE_RANGE,
    start: SEASON_2_EPOCH_8_START,
    end: SEASON_2_EPOCH_8_END,
  },
  {
    id: 7,
    label: 'Epoch 7',
    range: 'Feb 10, 4:00 PM – Feb 24, 4:00 PM',
    start: '2026-02-10T16:00:00Z',
    end: '2026-02-24T16:00:00Z',
  },
  {
    id: 6,
    label: 'Epoch 6',
    range: 'Jan 27, 4:00 PM – Feb 10, 4:00 PM',
    start: '2026-01-27T16:00:00Z',
    end: '2026-02-10T16:00:00Z',
  },
  {
    id: 5,
    label: 'Epoch 5',
    range: 'Jan 13, 4:00 PM – Jan 27, 4:00 PM',
    start: '2026-01-13T16:00:00Z',
    end: '2026-01-27T16:00:00Z',
  },
  {
    id: 4,
    label: 'Epoch 4',
    range: 'Dec 30, 4:00 PM – Jan 13, 4:00 PM',
    start: '2025-12-30T16:00:00Z',
    end: '2026-01-13T16:00:00Z',
  },
  {
    id: 3,
    label: 'Epoch 3',
    range: 'Dec 16, 4:00 PM – Dec 30, 4:00 PM',
    start: '2025-12-16T16:00:00Z',
    end: '2025-12-30T16:00:00Z',
  },
  {
    id: 2,
    label: 'Epoch 2',
    range: 'Dec 2, 4:00 PM – Dec 16, 4:00 PM',
    start: '2025-12-02T16:00:00Z',
    end: '2025-12-16T16:00:00Z',
  },
  {
    id: 1,
    label: 'Epoch 1',
    range: 'Nov 18, 4:00 PM – Dec 2, 4:00 PM',
    start: '2025-11-18T16:00:00Z',
    end: '2025-12-02T16:00:00Z',
  },
];

/**
 * Default selected epoch in Season 2 UIs.
 * 1) `VITE_SEASON2_CURRENT_EPOCH_ID` if set and valid
 * 2) Epoch whose [start,end] contains `now` (auto-updates when calendar crosses)
 * 3) Any entry with `isCurrent: true`
 * 4) Latest epoch that has already started (by highest id)
 */
export function computeSeason2DefaultEpochId(nowMs: number = Date.now()): number {
  const envRaw = import.meta.env.VITE_SEASON2_CURRENT_EPOCH_ID as string | undefined;
  if (envRaw) {
    const n = Number(String(envRaw).trim());
    if (Number.isFinite(n) && SEASON_2_EPOCHS.some((e) => e.id === n)) return n;
  }
  const now = nowMs;
  const byDesc = [...SEASON_2_EPOCHS].sort((a, b) => b.id - a.id);
  for (const e of byDesc) {
    const s = new Date(e.start).getTime();
    const end = new Date(e.end).getTime();
    if (now >= s && now <= end) return e.id;
  }
  for (const e of byDesc) {
    if (e.isCurrent) return e.id;
  }
  for (const e of byDesc) {
    const s = new Date(e.start).getTime();
    if (now >= s) return e.id;
  }
  return byDesc[0]?.id ?? SEASON_2_EPOCH_ID;
}

/** Resolved epoch row for “current” Season 2 period (badges, copy). */
export function getResolvedSeason2EpochForNow(nowMs?: number): Season2EpochDef {
  const id = computeSeason2DefaultEpochId(nowMs);
  return SEASON_2_EPOCHS.find((e) => e.id === id) ?? SEASON_2_EPOCHS[0];
}

export const MULTI_VAULT_ADDRESS = "0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e";
/** IntuitionFeeProxy (intuition-box template) — update when redeploying. */
export const FEE_PROXY_ADDRESS = "0x1a13606A0a3C392214527c896b4cD0E9C0af82E8";
export const OFFSET_PROGRESSIVE_CURVE_ADDRESS = "0x23afF95153aa88D28B9B97Ba97629E05D5fD335d";
/** Curve ID 1 = Linear (stable). Curve ID 2 = Offset Progressive (exponential). */
export const LINEAR_CURVE_ID = 1;
export const OFFSET_PROGRESSIVE_CURVE_ID = 2;

// Standard Semantic Predicates & Objects
export const IS_PREDICATE_ID = "0x0000000000000000000000000000000000000000000000000000000000000001";
export const DISTRUST_ATOM_ID = "0x0000000000000000000000000000000000000000000000000000000000003a74";
/** List predicate — used for "add identity to list" (triple: subject=atom, predicate=this, object=list) */
export const LIST_PREDICATE_ID = "0x7ec36d201c842dc787b45cb5bb753bea4cf849be3908fb1b0a7d067c3c3cc1f5";

// Protocol Pricing Constants
export const CURVE_SLOPE = 30000000000000000000n; // 3 * 10^19
export const CURVE_OFFSET = 500000000000000000n; // 5 * 10^17
export const DISPLAY_DIVISOR = 100000;

export const FEE_PROXY_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "receiver", "type": "address" },
      { "internalType": "bytes[]", "name": "data", "type": "bytes[]" },
      { "internalType": "uint256[]", "name": "assets", "type": "uint256[]" },
      { "internalType": "uint256", "name": "curveId", "type": "uint256" }
    ],
    "name": "createAtoms",
    "outputs": [{ "internalType": "bytes32[]", "name": "atomIds", "type": "bytes32[]" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "receiver", "type": "address" },
      { "internalType": "bytes32[]", "name": "subjectIds", "type": "bytes32[]" },
      { "internalType": "bytes32[]", "name": "predicateIds", "type": "bytes32[]" },
      { "internalType": "bytes32[]", "name": "objectIds", "type": "bytes32[]" },
      { "internalType": "uint256[]", "name": "assets", "type": "uint256[]" },
      { "internalType": "uint256", "name": "curveId", "type": "uint256" }
    ],
    "name": "createTriples",
    "outputs": [{ "internalType": "bytes32[]", "name": "tripleIds", "type": "bytes32[]" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "receiver", "type": "address" },
      { "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "internalType": "uint256", "name": "curveId", "type": "uint256" },
      { "internalType": "uint256", "name": "minShares", "type": "uint256" }
    ],
    "name": "deposit",
    "outputs": [{ "internalType": "uint256", "name": "shares", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "depositAmount", "type": "uint256" }
    ],
    "name": "getTotalDepositCost",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "depositCount", "type": "uint256" },
      { "internalType": "uint256", "name": "totalDeposit", "type": "uint256" },
      { "internalType": "uint256", "name": "multiVaultCost", "type": "uint256" }
    ],
    "name": "getTotalCreationCost",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAtomCost",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTripleCost",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "id", "type": "bytes32" }
    ],
    "name": "isTermCreated",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "creator", "type": "address" },
      { "indexed": true, "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes", "name": "atomData", "type": "bytes" },
      { "indexed": false, "internalType": "address", "name": "atomWallet", "type": "address" }
    ],
    "name": "AtomCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "creator", "type": "address" },
      { "indexed": true, "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "subjectId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "predicateId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "objectId", "type": "bytes32" }
    ],
    "name": "TripleCreated",
    "type": "event"
  },
  // Custom errors for createTriples revert decoding (0xd335ef46 and related)
  { "type": "error", "name": "InsufficientDepositAmountToCoverFees", "inputs": [] },
  { "type": "error", "name": "AtomDoesNotExist", "inputs": [{ "name": "atomId", "type": "bytes32" }] },
  { "type": "error", "name": "TripleExists", "inputs": [{ "name": "s", "type": "bytes32" }, { "name": "p", "type": "bytes32" }, { "name": "o", "type": "bytes32" }] },
  { "type": "error", "name": "MinimumDeposit", "inputs": [] }
] as const;

export const MULTI_VAULT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" },
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "uint8", "name": "approvalType", "type": "uint8" }
    ],
    "name": "isApproved",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "uint8", "name": "approvalType", "type": "uint8" }
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" },
      { "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "internalType": "uint256", "name": "curveId", "type": "uint256" }
    ],
    "name": "getShares",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "internalType": "uint256", "name": "curveId", "type": "uint256" },
      { "internalType": "uint256", "name": "shares", "type": "uint256" }
    ],
    "name": "previewRedeem",
    "outputs": [
      { "internalType": "uint256", "name": "assetsAfterFees", "type": "uint256" },
      { "internalType": "uint256", "name": "sharesUsed", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
        { "internalType": "address", "name": "receiver", "type": "address" },
        { "internalType": "bytes32[]", "name": "termIds", "type": "bytes32[]" },
        { "internalType": "uint256[]", "name": "curveIds", "type": "uint256[]" },
        { "internalType": "uint256[]", "name": "shares", "type": "uint256[]" },
        { "internalType": "uint256[]", "name": "minAssets", "type": "uint256[]" }
    ],
    "name": "redeemBatch",
    "outputs": [{ "internalType": "uint256[]", "name": "received", "type": "uint256[]" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "id", "type": "bytes32" }],
    "name": "isTermCreated",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes[]", "name": "data", "type": "bytes[]" },
      { "internalType": "uint256[]", "name": "assets", "type": "uint256[]" }
    ],
    "name": "createAtoms",
    "outputs": [{ "internalType": "bytes32[]", "name": "", "type": "bytes32[]" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32[]", "name": "subjectIds", "type": "bytes32[]" },
      { "internalType": "bytes32[]", "name": "predicateIds", "type": "bytes32[]" },
      { "internalType": "bytes32[]", "name": "objectIds", "type": "bytes32[]" },
      { "internalType": "uint256[]", "name": "assets", "type": "uint256[]" }
    ],
    "name": "createTriples",
    "outputs": [{ "internalType": "bytes32[]", "name": "", "type": "bytes32[]" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTripleCost",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAtomCost",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "creator", "type": "address" },
      { "indexed": true, "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes", "name": "atomData", "type": "bytes" },
      { "indexed": false, "internalType": "address", "name": "atomWallet", "type": "address" }
    ],
    "name": "AtomCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "creator", "type": "address" },
      { "indexed": true, "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "subjectId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "predicateId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "objectId", "type": "bytes32" }
    ],
    "name": "TripleCreated",
    "type": "event"
  }
] as const;
