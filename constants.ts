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
 * In dev, use /v1/graphql so Vite proxies to mainnet (avoids CORS).
 * In production, use full URL or VITE_GRAPHQL_URL from env.
 */
export const GRAPHQL_URL =
  import.meta.env.VITE_GRAPHQL_URL ||
  (import.meta.env.DEV ? "/v1/graphql" : "https://mainnet.intuition.sh/v1/graphql");
export const EXPLORER_URL = "https://explorer.intuition.systems";
export const CURRENCY_SYMBOL = "₸";

/** Season 2 / current epoch for period-based PnL leaderboard (get_pnl_leaderboard_period) */
export const SEASON_2_EPOCH_ID = 8;

/** Human-readable date range for Epoch 8 (Season 2 current period) — matches Intuition portal */
export const SEASON_2_EPOCH_8_DATE_RANGE = 'Feb 24, 4:00 PM – Mar 10, 4:00 PM';

/** ISO date strings for Epoch 8 — required by get_pnl_leaderboard_period (p_start_date, p_end_date) */
export const SEASON_2_EPOCH_8_START = '2026-02-24T16:00:00Z';
export const SEASON_2_EPOCH_8_END = '2026-03-10T16:00:00Z';

export const MULTI_VAULT_ADDRESS = "0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e";
export const FEE_PROXY_ADDRESS = "0xCbFe767E67d04fBD58f8e3b721b8d07a73D16c93";
export const OFFSET_PROGRESSIVE_CURVE_ADDRESS = "0x23afF95153aa88D28B9B97Ba97629E05D5fD335d";
/** Curve ID 1 = Linear (stable). Curve ID 2 = Offset Progressive (exponential). */
export const LINEAR_CURVE_ID = 1;
export const OFFSET_PROGRESSIVE_CURVE_ID = 2;

// Standard Semantic Predicates & Objects
export const IS_PREDICATE_ID = "0x0000000000000000000000000000000000000000000000000000000000000001";
export const DISTRUST_ATOM_ID = "0x0000000000000000000000000000000000000000000000000000000000003a74";

// Protocol Pricing Constants
export const CURVE_SLOPE = 30000000000000000000n; // 3 * 10^19
export const CURVE_OFFSET = 100000000000000000n; // 10^17
export const DISPLAY_DIVISOR = 100000;

export const FEE_PROXY_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "receiver", "type": "address" },
      { "internalType": "bytes[]", "name": "data", "type": "bytes[]" },
      { "internalType": "uint256[]", "name": "assets", "type": "uint256[]" },
      { "internalType": "uint256[]", "name": "curveIds", "type": "uint256[]" }
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
  }
] as const;