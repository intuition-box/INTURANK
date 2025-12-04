export const CHAIN_ID = 1155;
export const NETWORK_NAME = "Intuition Mainnet";
export const RPC_URL = "https://rpc.intuition.systems/http";
export const GRAPHQL_URL = "https://mainnet.intuition.sh/v1/graphql";
export const EXPLORER_URL = "https://explorer.intuition.systems";
export const CURRENCY_SYMBOL = "TRUST";

// Standard MultiVault ABI (Updated with Atom/Triple Creation and Custom Errors)
export const MULTI_VAULT_ABI = [
  // --- Core Functions ---
  {
    "type": "function",
    "name": "depositBatch",
    "stateMutability": "payable",
    "inputs": [
      { "name": "receiver", "type": "address" },
      { "name": "termIds", "type": "bytes32[]" },
      { "name": "curveIds", "type": "uint256[]" },
      { "name": "assets", "type": "uint256[]" },
      { "name": "minShares", "type": "uint256[]" }
    ],
    "outputs": [
      { "name": "shares", "type": "uint256[]" }
    ]
  },
  {
    "type": "function",
    "name": "redeemBatch",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "receiver", "type": "address" },
      { "name": "termIds", "type": "bytes32[]" },
      { "name": "curveIds", "type": "uint256[]" },
      { "name": "shares", "type": "uint256[]" },
      { "name": "minAssets", "type": "uint256[]" }
    ],
    "outputs": [
      { "name": "assets", "type": "uint256[]" }
    ]
  },
  {
    "type": "function",
    "name": "getShares",
    "stateMutability": "view",
    "inputs": [
      { "name": "account", "type": "address" },
      { "name": "termId", "type": "bytes32" },
      { "name": "curveId", "type": "uint256" }
    ],
    "outputs": [
      { "name": "", "type": "uint256" }
    ]
  },
  {
    "type": "function",
    "name": "createAtoms",
    "stateMutability": "payable",
    "inputs": [
      { "name": "data", "type": "bytes[]" },
      { "name": "assets", "type": "uint256[]" }
    ],
    "outputs": [
      { "name": "", "type": "bytes32[]" }
    ]
  },
  {
    "type": "function",
    "name": "createTriples",
    "stateMutability": "payable",
    "inputs": [
      { "name": "subjectIds", "type": "bytes32[]" },
      { "name": "predicateIds", "type": "bytes32[]" },
      { "name": "objectIds", "type": "bytes32[]" },
      { "name": "assets", "type": "uint256[]" }
    ],
    "outputs": [
      { "name": "", "type": "bytes32[]" }
    ]
  },
  {
    "type": "function",
    "name": "isTermCreated",
    "stateMutability": "view",
    "inputs": [
      { "name": "termId", "type": "bytes32" }
    ],
    "outputs": [
      { "name": "", "type": "bool" }
    ]
  },
  {
    "type": "function",
    "name": "generalConfig",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [
      { "name": "admin", "type": "address" },
      { "name": "protocolMultisig", "type": "address" },
      { "name": "feeDenominator", "type": "uint256" },
      { "name": "trustBonding", "type": "address" },
      { "name": "minDeposit", "type": "uint256" },
      { "name": "minShare", "type": "uint256" },
      { "name": "atomDataMaxLength", "type": "uint256" },
      { "name": "feeThreshold", "type": "uint256" }
    ]
  },
  
  // --- Custom Errors (Vital for debugging) ---
  { "type": "error", "name": "MultiVault_DepositBelowMinimumDeposit", "inputs": [] },
  { "type": "error", "name": "MultiVault_InsufficientBalance", "inputs": [] },
  { "type": "error", "name": "MultiVault_ArraysNotSameLength", "inputs": [] },
  { "type": "error", "name": "MultiVault_AtomExists", "inputs": [{ "name": "atomData", "type": "bytes" }] },
  { "type": "error", "name": "MultiVault_AtomDoesNotExist", "inputs": [{ "name": "atomId", "type": "bytes32" }] },
  { "type": "error", "name": "MultiVault_TermDoesNotExist", "inputs": [{ "name": "termId", "type": "bytes32" }] },
  { "type": "error", "name": "MultiVault_DepositOrRedeemZeroShares", "inputs": [] },
  { "type": "error", "name": "MultiVault_SlippageExceeded", "inputs": [] },
  { "type": "error", "name": "MultiVault_ActionExceedsMaxAssets", "inputs": [] },
  { "type": "error", "name": "MultiVault_ActionExceedsMaxShares", "inputs": [] },
  { "type": "error", "name": "MultiVault_SenderNotApproved", "inputs": [] }
] as const;

// Correct MultiVault Address for Intuition Mainnet
export const MULTI_VAULT_ADDRESS = "0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e";