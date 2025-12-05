export const CHAIN_ID = 1155;
export const NETWORK_NAME = "Intuition Mainnet";
export const RPC_URL = "https://rpc.intuition.systems/http";
export const GRAPHQL_URL = "https://mainnet.intuition.sh/v1/graphql";
export const EXPLORER_URL = "https://explorer.intuition.systems";
export const CURRENCY_SYMBOL = "TRUST";

// Standard MultiVault ABI (Updated with Atom/Triple Creation and Custom Errors)
export const MULTI_VAULT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AccessControlBadConfirmation",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "neededRole",
        "type": "bytes32"
      }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EnforcedPause",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ExpectedPause",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FailedCall",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "balance",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "needed",
        "type": "uint256"
      }
    ],
    "name": "InsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidInitialization",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      }
    ],
    "name": "MultiVaultCore_AtomDoesNotExist",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVaultCore_InvalidAdmin",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      }
    ],
    "name": "MultiVaultCore_TermDoesNotExist",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      }
    ],
    "name": "MultiVaultCore_TripleDoesNotExist",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_ActionExceedsMaxAssets",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_ActionExceedsMaxShares",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_ArraysNotSameLength",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_AtomDataTooLong",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "atomId",
        "type": "bytes32"
      }
    ],
    "name": "MultiVault_AtomDoesNotExist",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "atomData",
        "type": "bytes"
      }
    ],
    "name": "MultiVault_AtomExists",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_BurnFromZeroAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_BurnInsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_CannotApproveOrRevokeSelf",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_CannotDirectlyInitializeCounterTriple",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_DefaultCurveMustBeInitializedViaCreatePaths",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_DepositBelowMinimumDeposit",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_DepositOrRedeemZeroShares",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_DepositTooSmallToCoverMinShares",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_EpochNotTracked",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_HasCounterStake",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_InsufficientAssets",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_InsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "remainingShares",
        "type": "uint256"
      }
    ],
    "name": "MultiVault_InsufficientRemainingSharesInVault",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_InsufficientSharesInVault",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_InvalidArrayLength",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_InvalidEpoch",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_NoAtomDataProvided",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_OnlyAssociatedAtomWallet",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_RedeemerNotApproved",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_SenderNotApproved",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_SlippageExceeded",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      }
    ],
    "name": "MultiVault_TermDoesNotExist",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MultiVault_TermNotTriple",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "subjectId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "predicateId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "objectId",
        "type": "bytes32"
      }
    ],
    "name": "MultiVault_TripleExists",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotInitializing",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "enum ApprovalTypes",
        "name": "approvalType",
        "type": "uint8"
      }
    ],
    "name": "ApprovalTypeUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "atomCreationProtocolFee",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "atomWalletDepositFee",
        "type": "uint256"
      }
    ],
    "name": "AtomConfigUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "atomData",
        "type": "bytes"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "atomWallet",
        "type": "address"
      }
    ],
    "name": "AtomCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "AtomWalletDepositFeeCollected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "atomWalletOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "feesClaimed",
        "type": "uint256"
      }
    ],
    "name": "AtomWalletDepositFeesClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "registry",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "defaultCurveId",
        "type": "uint256"
      }
    ],
    "name": "BondingCurveConfigUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "assetsAfterFees",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalShares",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "enum VaultType",
        "name": "vaultType",
        "type": "uint8"
      }
    ],
    "name": "Deposited",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "admin",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "protocolMultisig",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "feeDenominator",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "trustBonding",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "minDeposit",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "minShare",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "atomDataMaxLength",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "feeThreshold",
        "type": "uint256"
      }
    ],
    "name": "GeneralConfigUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "version",
        "type": "uint64"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Paused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "int256",
        "name": "valueAdded",
        "type": "int256"
      },
      {
        "indexed": false,
        "internalType": "int256",
        "name": "personalUtilization",
        "type": "int256"
      }
    ],
    "name": "PersonalUtilizationAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "int256",
        "name": "valueRemoved",
        "type": "int256"
      },
      {
        "indexed": false,
        "internalType": "int256",
        "name": "personalUtilization",
        "type": "int256"
      }
    ],
    "name": "PersonalUtilizationRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "ProtocolFeeAccrued",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "destination",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "ProtocolFeeTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalShares",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "fees",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "enum VaultType",
        "name": "vaultType",
        "type": "uint8"
      }
    ],
    "name": "Redeemed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "sharePrice",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalAssets",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalShares",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "enum VaultType",
        "name": "vaultType",
        "type": "uint8"
      }
    ],
    "name": "SharePriceChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "int256",
        "name": "valueAdded",
        "type": "int256"
      },
      {
        "indexed": true,
        "internalType": "int256",
        "name": "totalUtilization",
        "type": "int256"
      }
    ],
    "name": "TotalUtilizationAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "int256",
        "name": "valueRemoved",
        "type": "int256"
      },
      {
        "indexed": true,
        "internalType": "int256",
        "name": "totalUtilization",
        "type": "int256"
      }
    ],
    "name": "TotalUtilizationRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "tripleCreationProtocolFee",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "atomDepositFractionForTriple",
        "type": "uint256"
      }
    ],
    "name": "TripleConfigUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "subjectId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "predicateId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "objectId",
        "type": "bytes32"
      }
    ],
    "name": "TripleCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Unpaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "entryFee",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "exitFee",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "protocolFee",
        "type": "uint256"
      }
    ],
    "name": "VaultFeesUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "entryPoint",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "atomWarden",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "atomWalletBeacon",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "atomWalletFactory",
        "type": "address"
      }
    ],
    "name": "WalletConfigUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "ATOM_SALT",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "BURN_ADDRESS",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "COUNTER_SALT",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_BATCH_SIZE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "TRIPLE_SALT",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "atomWallet",
        "type": "address"
      }
    ],
    "name": "accumulatedAtomWalletDepositFees",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "accumulatedFees",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      }
    ],
    "name": "accumulatedProtocolFees",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "accumulatedFees",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "internalType": "enum ApprovalTypes",
        "name": "approvalType",
        "type": "uint8"
      }
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "atomId",
        "type": "bytes32"
      }
    ],
    "name": "atom",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "atomConfig",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "atomCreationProtocolFee",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "atomWalletDepositFee",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      }
    ],
    "name": "atomDepositFractionAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "bondingCurveConfig",
    "outputs": [
      {
        "internalType": "address",
        "name": "registry",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "defaultCurveId",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "calculateAtomId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "subjectId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "predicateId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "objectId",
        "type": "bytes32"
      }
    ],
    "name": "calculateCounterTripleId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "subjectId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "predicateId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "objectId",
        "type": "bytes32"
      }
    ],
    "name": "calculateTripleId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      }
    ],
    "name": "claimAtomWalletDepositFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "atomId",
        "type": "bytes32"
      }
    ],
    "name": "computeAtomWalletAddr",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      }
    ],
    "name": "convertToAssets",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      }
    ],
    "name": "convertToShares",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes[]",
        "name": "data",
        "type": "bytes[]"
      },
      {
        "internalType": "uint256[]",
        "name": "assets",
        "type": "uint256[]"
      }
    ],
    "name": "createAtoms",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32[]",
        "name": "subjectIds",
        "type": "bytes32[]"
      },
      {
        "internalType": "bytes32[]",
        "name": "predicateIds",
        "type": "bytes32[]"
      },
      {
        "internalType": "bytes32[]",
        "name": "objectIds",
        "type": "bytes32[]"
      },
      {
        "internalType": "uint256[]",
        "name": "assets",
        "type": "uint256[]"
      }
    ],
    "name": "createTriples",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentEpoch",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      }
    ],
    "name": "currentSharePrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minShares",
        "type": "uint256"
      }
    ],
    "name": "deposit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "bytes32[]",
        "name": "termIds",
        "type": "bytes32[]"
      },
      {
        "internalType": "uint256[]",
        "name": "curveIds",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "assets",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "minShares",
        "type": "uint256[]"
      }
    ],
    "name": "depositBatch",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "shares",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      }
    ],
    "name": "entryFeeAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      }
    ],
    "name": "exitFeeAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "generalConfig",
    "outputs": [
      {
        "internalType": "address",
        "name": "admin",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "protocolMultisig",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "feeDenominator",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "trustBonding",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "minDeposit",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minShare",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "atomDataMaxLength",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "feeThreshold",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "atomId",
        "type": "bytes32"
      }
    ],
    "name": "getAtom",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAtomConfig",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "atomCreationProtocolFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "atomWalletDepositFee",
            "type": "uint256"
          }
        ],
        "internalType": "struct AtomConfig",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAtomCost",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAtomWarden",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getBondingCurveConfig",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "registry",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "defaultCurveId",
            "type": "uint256"
          }
        ],
        "internalType": "struct BondingCurveConfig",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tripleId",
        "type": "bytes32"
      }
    ],
    "name": "getCounterIdFromTripleId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getGeneralConfig",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "admin",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "protocolMultisig",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "feeDenominator",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "trustBonding",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "minDeposit",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "minShare",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "atomDataMaxLength",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "feeThreshold",
            "type": "uint256"
          }
        ],
        "internalType": "struct GeneralConfig",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tripleId",
        "type": "bytes32"
      }
    ],
    "name": "getInverseTripleId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      }
    ],
    "name": "getShares",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      }
    ],
    "name": "getTotalUtilizationForEpoch",
    "outputs": [
      {
        "internalType": "int256",
        "name": "",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tripleId",
        "type": "bytes32"
      }
    ],
    "name": "getTriple",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTripleConfig",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "tripleCreationProtocolFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "atomDepositFractionForTriple",
            "type": "uint256"
          }
        ],
        "internalType": "struct TripleConfig",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTripleCost",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "counterId",
        "type": "bytes32"
      }
    ],
    "name": "getTripleIdFromCounterId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getUserLastActiveEpoch",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      }
    ],
    "name": "getUserUtilizationForEpoch",
    "outputs": [
      {
        "internalType": "int256",
        "name": "",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      }
    ],
    "name": "getUserUtilizationInEpoch",
    "outputs": [
      {
        "internalType": "int256",
        "name": "",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      }
    ],
    "name": "getVault",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getVaultFees",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "entryFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "exitFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "protocolFee",
            "type": "uint256"
          }
        ],
        "internalType": "struct VaultFees",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      }
    ],
    "name": "getVaultType",
    "outputs": [
      {
        "internalType": "enum VaultType",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getWalletConfig",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "entryPoint",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "atomWarden",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "atomWalletBeacon",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "atomWalletFactory",
            "type": "address"
          }
        ],
        "internalType": "struct WalletConfig",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "admin",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "protocolMultisig",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "feeDenominator",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "trustBonding",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "minDeposit",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "minShare",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "atomDataMaxLength",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "feeThreshold",
            "type": "uint256"
          }
        ],
        "internalType": "struct GeneralConfig",
        "name": "_generalConfig",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "atomCreationProtocolFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "atomWalletDepositFee",
            "type": "uint256"
          }
        ],
        "internalType": "struct AtomConfig",
        "name": "_atomConfig",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "tripleCreationProtocolFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "atomDepositFractionForTriple",
            "type": "uint256"
          }
        ],
        "internalType": "struct TripleConfig",
        "name": "_tripleConfig",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "entryPoint",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "atomWarden",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "atomWalletBeacon",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "atomWalletFactory",
            "type": "address"
          }
        ],
        "internalType": "struct WalletConfig",
        "name": "_walletConfig",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "entryFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "exitFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "protocolFee",
            "type": "uint256"
          }
        ],
        "internalType": "struct VaultFees",
        "name": "_vaultFees",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "registry",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "defaultCurveId",
            "type": "uint256"
          }
        ],
        "internalType": "struct BondingCurveConfig",
        "name": "_bondingCurveConfig",
        "type": "tuple"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "atomId",
        "type": "bytes32"
      }
    ],
    "name": "isAtom",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      }
    ],
    "name": "isCounterTriple",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "isTermCreated",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      }
    ],
    "name": "isTriple",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      }
    ],
    "name": "maxRedeem",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      }
    ],
    "name": "personalUtilization",
    "outputs": [
      {
        "internalType": "int256",
        "name": "utilizationAmount",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      }
    ],
    "name": "previewAtomCreate",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "assetsAfterFixedFees",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "assetsAfterFees",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      }
    ],
    "name": "previewDeposit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "assetsAfterFees",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      }
    ],
    "name": "previewRedeem",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "assetsAfterFees",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "sharesUsed",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      }
    ],
    "name": "previewTripleCreate",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "assetsAfterFixedFees",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "assetsAfterFees",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      }
    ],
    "name": "protocolFeeAmount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minAssets",
        "type": "uint256"
      }
    ],
    "name": "redeem",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "bytes32[]",
        "name": "termIds",
        "type": "bytes32[]"
      },
      {
        "internalType": "uint256[]",
        "name": "curveIds",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "shares",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "minAssets",
        "type": "uint256[]"
      }
    ],
    "name": "redeemBatch",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "received",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "callerConfirmation",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "atomCreationProtocolFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "atomWalletDepositFee",
            "type": "uint256"
          }
        ],
        "internalType": "struct AtomConfig",
        "name": "_atomConfig",
        "type": "tuple"
      }
    ],
    "name": "setAtomConfig",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "registry",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "defaultCurveId",
            "type": "uint256"
          }
        ],
        "internalType": "struct BondingCurveConfig",
        "name": "_bondingCurveConfig",
        "type": "tuple"
      }
    ],
    "name": "setBondingCurveConfig",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "admin",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "protocolMultisig",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "feeDenominator",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "trustBonding",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "minDeposit",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "minShare",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "atomDataMaxLength",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "feeThreshold",
            "type": "uint256"
          }
        ],
        "internalType": "struct GeneralConfig",
        "name": "_generalConfig",
        "type": "tuple"
      }
    ],
    "name": "setGeneralConfig",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "tripleCreationProtocolFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "atomDepositFractionForTriple",
            "type": "uint256"
          }
        ],
        "internalType": "struct TripleConfig",
        "name": "_tripleConfig",
        "type": "tuple"
      }
    ],
    "name": "setTripleConfig",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "entryFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "exitFee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "protocolFee",
            "type": "uint256"
          }
        ],
        "internalType": "struct VaultFees",
        "name": "_vaultFees",
        "type": "tuple"
      }
    ],
    "name": "setVaultFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "entryPoint",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "atomWarden",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "atomWalletBeacon",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "atomWalletFactory",
            "type": "address"
          }
        ],
        "internalType": "struct WalletConfig",
        "name": "_walletConfig",
        "type": "tuple"
      }
    ],
    "name": "setWalletConfig",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      }
    ],
    "name": "sweepAccumulatedProtocolFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalTermsCreated",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      }
    ],
    "name": "totalUtilization",
    "outputs": [
      {
        "internalType": "int256",
        "name": "utilizationAmount",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tripleId",
        "type": "bytes32"
      }
    ],
    "name": "triple",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tripleConfig",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "tripleCreationProtocolFee",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "atomDepositFractionForTriple",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "userEpochHistory",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "epoch",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "vaultFees",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "entryFee",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "exitFee",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "protocolFee",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "walletConfig",
    "outputs": [
      {
        "internalType": "address",
        "name": "entryPoint",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "atomWarden",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "atomWalletBeacon",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "atomWalletFactory",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Correct MultiVault Address for Intuition Mainnet
export const MULTI_VAULT_ADDRESS = "0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e";