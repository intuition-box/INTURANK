export const CHAIN_ID = 1155;
export const NETWORK_NAME = "Intuition Mainnet";
export const RPC_URL = "https://rpc.intuition.systems/http";
export const GRAPHQL_URL = "https://mainnet.intuition.sh/v1/graphql";
export const EXPLORER_URL = "https://explorer.intuition.systems";
export const CURRENCY_SYMBOL = "₸";

export const MULTI_VAULT_ADDRESS = "0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e";
export const FEE_PROXY_ADDRESS = "0xCbFe767E67d04fBD58f8e3b721b8d07a73D16c93";
export const OFFSET_PROGRESSIVE_CURVE_ADDRESS = "0x23afF95153aa88D28B9B97Ba97629E05D5fD335d";
export const OFFSET_PROGRESSIVE_CURVE_ID = 1;

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
  }
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