export const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE === 'true';

/** Parse VITE_GEMINI_API_KEY (single key or comma-separated keys) and return one. Picks randomly when multiple. */
export const getGeminiApiKey = (): string => {
  const raw = String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
  if (!raw) return '';
  const keys = raw.split(',').map(k => k.trim()).filter(Boolean);
  if (keys.length === 0) return '';
  return keys[Math.floor(Math.random() * keys.length)];
};

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

/** Season 2 / current epoch for period-based PnL leaderboard (get_pnl_leaderboard_period) */
export const SEASON_2_EPOCH_ID = 8;

/** Human-readable date range for Epoch 8 (Season 2 current period) — matches Intuition portal */
export const SEASON_2_EPOCH_8_DATE_RANGE = 'Feb 24, 4:00 PM – Mar 10, 4:00 PM';

/** ISO date strings for Epoch 8 — required by get_pnl_leaderboard_period (p_start_date, p_end_date) */
export const SEASON_2_EPOCH_8_START = '2026-02-24T16:00:00Z';
export const SEASON_2_EPOCH_8_END = '2026-03-10T16:00:00Z';

/** Season 2 Epoch schedule for homepage / stats selectors. Approximate 14-day epochs. */
export const SEASON_2_EPOCHS = [
  {
    id: 9,
    label: 'Epoch 9',
    range: 'Mar 10, 3:00 PM – Mar 24, 3:00 PM',
    start: '2026-03-10T15:00:00Z',
    end: '2026-03-24T15:00:00Z',
    isCurrent: true,
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
] as const;

export const MULTI_VAULT_ADDRESS = "0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e";
export const FEE_PROXY_ADDRESS = "0xCbFe767E67d04fBD58f8e3b721b8d07a73D16c93";
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
      { "internalType": "uint256", "name": "minShares", "type": "uint256" },
      { "internalType": "uint256", "name": "assets", "type": "uint256" }
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
    "inputs": [
      { "internalType": "bytes", "name": "data", "type": "bytes" },
      { "internalType": "uint256", "name": "deposit", "type": "uint256" },
      { "internalType": "uint256", "name": "curveId", "type": "uint256" }
    ],
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
      { "indexed": true, "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes", "name": "data", "type": "bytes" }
    ],
    "name": "AtomCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "indexed": true, "internalType": "bytes32", "name": "subjectId", "type": "bytes32" },
      { "indexed": true, "internalType": "bytes32", "name": "predicateId", "type": "bytes32" },
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
      { "indexed": true, "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes", "name": "data", "type": "bytes" }
    ],
    "name": "AtomCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "termId", "type": "bytes32" },
      { "indexed": true, "internalType": "bytes32", "name": "subjectId", "type": "bytes32" },
      { "indexed": true, "internalType": "bytes32", "name": "predicateId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "objectId", "type": "bytes32" }
    ],
    "name": "TripleCreated",
    "type": "event"
  }
] as const;
