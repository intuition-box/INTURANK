
import { createPublicClient, createWalletClient, custom, http, parseEther, formatEther, pad, getAddress, type Hex, stringToHex, keccak256, encodePacked, decodeEventLog } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { CHAIN_ID, NETWORK_NAME, RPC_URL, MULTI_VAULT_ABI, MULTI_VAULT_ADDRESS, EXPLORER_URL, FEE_PROXY_ADDRESS, FEE_PROXY_ABI, LINEAR_CURVE_ID, OFFSET_PROGRESSIVE_CURVE_ID, DISPLAY_DIVISOR, CURRENCY_SYMBOL } from '../constants';
import { Transaction } from '../types';
import { toast } from '../components/Toast';
import EthereumProvider from '@walletconnect/ethereum-provider';

export const intuitionChain = {
  id: CHAIN_ID,
  name: NETWORK_NAME,
  network: 'intuition',
  nativeCurrency: { decimals: 18, name: 'TRUST', symbol: 'TRUST' }, 
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: 'Intuition Explorer', url: EXPLORER_URL },
  },
} as const;

export const publicClient = createPublicClient({
  chain: intuitionChain,
  transport: http(RPC_URL),
});

// Active EIP-1193 provider (injected or WalletConnect).
let activeProvider: any | null = null;

// When using RainbowKit/wagmi, Layout syncs the connected address and provider here so the rest of the app (getConnectedAccount, getProvider) works unchanged.
let wagmiAddress: string | null = null;

export function setWagmiConnection(address: string | null, provider: any) {
  wagmiAddress = address;
  activeProvider = provider;
}

// When using RainbowKit, Layout sets this so connectWallet() can open the modal for legacy callers (Account, Portfolio, etc.)
let openConnectModalRef: (() => void) | null = null;
export function setOpenConnectModalRef(fn: (() => void) | null) {
  openConnectModalRef = fn;
}

// Dedicated client for ENS resolution (Ethereum Mainnet) using a more robust public RPC
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

type InjectedPreference = 'default' | 'metamask' | 'rabby' | 'brave';

const getBrowserProvider = (preference: InjectedPreference = 'default') => {
  if (typeof window === 'undefined') return null;
  const ethereum = (window as any).ethereum;
  if (!ethereum) return null;
  const providers: any[] =
    ethereum.providers && Array.isArray(ethereum.providers)
      ? ethereum.providers
      : [ethereum];

  const pick = (predicate: (p: any) => boolean) =>
    providers.find(predicate) || providers[0];

  switch (preference) {
    case 'metamask':
      return pick((p) => p.isMetaMask);
    case 'rabby':
      return pick((p) => p.isRabby);
    case 'brave':
      return pick((p) => p.isBraveWallet || p.isBrave);
    default:
      return providers[0];
  }
};

export const getProvider = () => {
  return activeProvider || getBrowserProvider('default');
};

/**
 * Deterministically calculates a Triple ID from components.
 */
export const calculateTripleId = (subjectId: string, predicateId: string, objectId: string): Hex => {
    const s = pad(subjectId as Hex, { size: 32 });
    const p = pad(predicateId as Hex, { size: 32 });
    const o = pad(objectId as Hex, { size: 32 });
    return keccak256(encodePacked(['bytes32', 'bytes32', 'bytes32'], [s, p, o]));
};

/**
 * Deterministically calculates a Counter Triple ID.
 */
export const calculateCounterTripleId = (tripleId: string): Hex => {
    return keccak256(encodePacked(['bytes32', 'string'], [tripleId as Hex, 'counter']));
};

const DISCONNECT_FLAG_KEY = 'inturank_wallet_disconnected';

export const getConnectedAccount = async (): Promise<string | null> => {
  if (typeof window !== 'undefined' && localStorage.getItem(DISCONNECT_FLAG_KEY)) return null;
  if (wagmiAddress) return wagmiAddress;
  const provider = getProvider();
  if (!provider) return null;
  try {
    const accounts = await provider.request({ method: 'eth_accounts' });
    return accounts[0] ? getAddress(accounts[0]) : null;
  } catch { return null; }
};

export const switchNetwork = async () => {
    const provider = getProvider();
    if (!provider) return;
    
    try {
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
        });
    } catch (error: any) {
        if (error.code === 4902 || error?.data?.originalError?.code === 4902) {
            try {
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: `0x${CHAIN_ID.toString(16)}`,
                            chainName: NETWORK_NAME,
                            nativeCurrency: { name: 'TRUST', symbol: 'TRUST', decimals: 18 },
                            rpcUrls: [RPC_URL],
                            blockExplorerUrls: [EXPLORER_URL],
                        },
                    ],
                });
            } catch (addError) { 
                console.error("ADD_CHAIN_ERROR:", addError); 
            }
        }
    }
};

export type WalletConnector = 'injected' | 'walletconnect';
export type InjectedWalletPreference = InjectedPreference;

export const connectWallet = async (
  connector: WalletConnector = 'injected',
  injectedPreference: InjectedWalletPreference = 'default',
): Promise<string | null> => {
  // When RainbowKit is used, open its connect modal and return null; connection state is synced via setWagmiConnection in Layout.
  if (openConnectModalRef) {
    openConnectModalRef();
    return null;
  }
  if (connector === 'walletconnect') {
    try {
      const projectId = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
      if (!projectId) {
        toast.error("MISSING_WC_PROJECT_ID: Set VITE_WALLETCONNECT_PROJECT_ID in .env.local");
        return null;
      }

      const provider = await EthereumProvider.init({
        projectId,
        showQrModal: true,
        chains: [CHAIN_ID],
        rpcMap: {
          [CHAIN_ID]: RPC_URL,
        },
        metadata: {
          name: 'IntuRank',
          description: 'Semantic markets on the Intuition Network',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://inturank.intuition.box',
          icons: [],
        },
      });

      await provider.connect();
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) return null;
      const address = getAddress(accounts[0]);

      activeProvider = provider;
      if (typeof window !== 'undefined') localStorage.removeItem(DISCONNECT_FLAG_KEY);
      return address;
    } catch (error: any) {
      if (error?.code === 4001) toast.error("REJECTED_BY_USER");
      else toast.error(`WALLETCONNECT_ERROR: ${error?.message || 'Failed to connect'}`);
      return null;
    }
  }

  const provider = getBrowserProvider(injectedPreference);
  if (!provider) {
    toast.error("NO_PROVIDER: Install MetaMask.");
    return null;
  }
  
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) return null;
    const address = getAddress(accounts[0]);
    
    const chainIdHex = await provider.request({ method: 'eth_chainId' });
    if (parseInt(chainIdHex, 16) !== CHAIN_ID) {
        await switchNetwork();
    }
    activeProvider = provider;
    if (typeof window !== 'undefined') localStorage.removeItem(DISCONNECT_FLAG_KEY);
    return address;
  } catch (error: any) {
    if (error.code === 4001) toast.error("REJECTED_BY_USER");
    else toast.error(`ERROR: ${error.message}`);
    return null; 
  }
};

export const getWalletBalance = async (address: string): Promise<string> => {
  try {
    const balance = await publicClient.getBalance({ address: address as `0x${string}` });
    return formatEther(balance);
  } catch { return "0.00"; }
};

export const getShareBalance = async (account: string, termId: string, curveId: number = OFFSET_PROGRESSIVE_CURVE_ID) => {
  try {
    const rawTermId = termId.startsWith('0x') ? termId : `0x${termId}`;
    const termIdBytes32 = pad(rawTermId as Hex, { size: 32 });
    const targetCurve = BigInt(curveId);
    const shares = await publicClient.readContract({
      address: MULTI_VAULT_ADDRESS as `0x${string}`,
      abi: MULTI_VAULT_ABI,
      functionName: 'getShares',
      args: [getAddress(account), termIdBytes32, targetCurve]
    } as any);
    return formatEther(shares as bigint);
  } catch { return "0"; }
};

export const getQuoteRedeem = async (sharesAmount: string, termId: string, account: string, curveId: number = OFFSET_PROGRESSIVE_CURVE_ID): Promise<string> => {
    try {
        const rawTermId = termId.startsWith('0x') ? termId : `0x${termId}`;
        const termIdBytes32 = pad(rawTermId as Hex, { size: 32 });
        const targetCurve = BigInt(curveId);
        const result = await publicClient.readContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'previewRedeem',
            args: [termIdBytes32, targetCurve, parseEther(sharesAmount)]
        } as any) as [bigint, bigint]; 
        return formatEther(result[0]);
    } catch { return "0"; }
};

export const depositToVault = async (amount: string, termId: string, receiver: string, curveIdOrOnProgress?: number | ((log: string) => void), onProgress?: (log: string) => void) => {
  const curveId = typeof curveIdOrOnProgress === 'function' ? LINEAR_CURVE_ID : (curveIdOrOnProgress ?? LINEAR_CURVE_ID);
  const progressCb = typeof curveIdOrOnProgress === 'function' ? curveIdOrOnProgress : onProgress;
  const checksumReceiver = getAddress(receiver);
  const termIdBytes32 = pad((termId.startsWith('0x') ? termId : `0x${termId}`) as Hex, { size: 32 });
  const provider = getProvider();
  const walletClient = createWalletClient({ chain: intuitionChain, transport: custom(provider), account: checksumReceiver });
  const assets = parseEther(amount);
  const curveIdBigInt = BigInt(curveId);

  try {
      progressCb?.("Simulating Gas & Total Cost Basis...");
      const totalCost = await publicClient.readContract({
          address: FEE_PROXY_ADDRESS as `0x${string}`,
          abi: FEE_PROXY_ABI,
          functionName: 'getTotalDepositCost',
          args: [assets]
      } as any) as bigint;
      progressCb?.(`Handshake Cost Calculated: ${formatEther(totalCost)} ${CURRENCY_SYMBOL}`);

      progressCb?.("Awaiting Biometric Signature...");
      const { request } = await publicClient.simulateContract({
          address: FEE_PROXY_ADDRESS as `0x${string}`,
          abi: FEE_PROXY_ABI,
          functionName: 'deposit',
          account: checksumReceiver,
          args: [checksumReceiver, termIdBytes32, curveIdBigInt, 0n, assets],
          value: totalCost,
      } as any);

      const hash = await walletClient.writeContract(request);
      progressCb?.(`Broadcasting Packet to Mainnet... Hash: ${hash.slice(0,10)}...`);
      
      let actualShares = 0n;
      try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          progressCb?.("Transaction Reconciled in Block.");
          
          for (const log of receipt.logs) {
              try {
                  const decoded = decodeEventLog({
                      abi: MULTI_VAULT_ABI,
                      data: log.data,
                      topics: (log as any).topics,
                  });
                  if ((decoded as any).eventName === 'Deposit' || (decoded as any).args?.shares) {
                      actualShares = (decoded as any).args.shares;
                  }
              } catch {}
          }
      } catch (waitError: any) {
          // If the RPC cannot look up the hash yet (or returns malformed),
          // fall back to a heuristic and let the indexer reconcile later.
          console.warn("DEPOSIT_RECEIPT_TIMEOUT:", waitError);
          progressCb?.("Indexing delayed on RPC. Local estimate will be used until explorer catches up.");
      }

      if (actualShares === 0n) {
           actualShares = assets / 15n; 
      }

      return { hash, shares: actualShares, assets };
  } catch (error: any) {
      console.error("DEPOSIT_ERROR:", error);
      throw error;
  }
};

export const redeemFromVault = async (sharesAmount: string, termId: string, receiver: string, curveIdOrOnProgress?: number | ((log: string) => void), onProgress?: (log: string) => void) => {
  const curveId = typeof curveIdOrOnProgress === 'function' ? LINEAR_CURVE_ID : (curveIdOrOnProgress ?? LINEAR_CURVE_ID);
  const progressCb = typeof curveIdOrOnProgress === 'function' ? curveIdOrOnProgress : onProgress;
  const checksumReceiver = getAddress(receiver);
  const termIdBytes32 = pad((termId.startsWith('0x') ? termId : `0x${termId}`) as Hex, { size: 32 });
  const provider = getProvider();
  const walletClient = createWalletClient({ chain: intuitionChain, transport: custom(provider), account: checksumReceiver });
  const shares = parseEther(sharesAmount);
  const curveIdBigInt = BigInt(curveId);

  try {
      progressCb?.("Calculating Exit Liquidity...");
      const preview = await publicClient.readContract({
          address: MULTI_VAULT_ADDRESS as `0x${string}`,
          abi: MULTI_VAULT_ABI,
          functionName: 'previewRedeem',
          args: [termIdBytes32, curveIdBigInt, shares]
      } as any) as [bigint, bigint];
      progressCb?.(`Projected Proceeds: ${formatEther(preview[0])} ${CURRENCY_SYMBOL}`);

      progressCb?.("Awaiting Exit Signature...");
      const { request } = await publicClient.simulateContract({
          address: MULTI_VAULT_ADDRESS as `0x${string}`,
          abi: MULTI_VAULT_ABI,
          functionName: 'redeemBatch',
          account: checksumReceiver,
          args: [checksumReceiver, [termIdBytes32], [curveIdBigInt], [shares], [0n]],
      } as any);

      const hash = await walletClient.writeContract(request);
      progressCb?.(`Liquidating Position... Hash: ${hash.slice(0,10)}...`);
      
      let actualAssets = preview[0];
      try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          progressCb?.("Handshake Cleared. Position Terminated.");
          
          for (const log of receipt.logs) {
              try {
                  const decoded = decodeEventLog({
                      abi: MULTI_VAULT_ABI,
                      data: log.data,
                      topics: (log as any).topics,
                  });
                  if ((decoded as any).eventName === 'Withdraw' || (decoded as any).args?.assets) {
                      actualAssets = (decoded as any).args.assets;
                  }
              } catch {}
          }
      } catch (waitError: any) {
          console.warn("REDEEM_RECEIPT_TIMEOUT:", waitError);
          progressCb?.("Indexing delayed on RPC. Local estimate will be used until explorer catches up.");
      }

      return { hash, assets: actualAssets, shares };
  } catch (error: any) {
      console.error("REDEEM_ERROR:", error);
      throw error;
  }
};

export const checkProxyApproval = async (walletAddress: string): Promise<boolean> => {
    const addr = getAddress(walletAddress);
    const cacheKey = `inturank_approved_${addr.toLowerCase()}`;
    if (localStorage.getItem(cacheKey) === 'true') return true;
    try {
        const approved = await publicClient.readContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'isApproved',
            args: [addr, getAddress(FEE_PROXY_ADDRESS), 1]
        } as any);
        const isOk = Boolean(approved);
        if (isOk) localStorage.setItem(cacheKey, 'true');
        return isOk;
    } catch (e) { return false; }
};

export const grantProxyApproval = async (walletAddress: string): Promise<void> => {
    const checksumAccount = getAddress(walletAddress);
    const provider = getProvider();
    const walletClient = createWalletClient({ chain: intuitionChain, transport: custom(provider), account: checksumAccount });
    try {
        const { request } = await publicClient.simulateContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'approve',
            account: checksumAccount,
            args: [getAddress(FEE_PROXY_ADDRESS), 1],
        } as any);
        const hash = await walletClient.writeContract(request);
        await publicClient.waitForTransactionReceipt({ hash });
        localStorage.setItem(`inturank_approved_${checksumAccount.toLowerCase()}`, 'true');
        toast.success("HANDSHAKE_COMPLETE: Protocol enabled.");
    } catch (e: any) { throw e; }
};

const LOCAL_TX_KEY = 'inturank_ledger_v3';
export const saveLocalTransaction = (tx: Transaction, account: string) => {
  const key = `${LOCAL_TX_KEY}_${account.toLowerCase()}`;
  const current: Transaction[] = JSON.parse(localStorage.getItem(key) || '[]');
  localStorage.setItem(key, JSON.stringify([tx, ...current].slice(0, 100)));
  window.dispatchEvent(new Event('local-tx-updated'));
};

export const getLocalTransactions = (account: string): Transaction[] => {
  if (!account) return [];
  return JSON.parse(localStorage.getItem(`${LOCAL_TX_KEY}_${account.toLowerCase()}`) || '[]');
};

export const getWatchlist = (account: string): string[] => {
    if (!account) return [];
    return JSON.parse(localStorage.getItem(`inturank_watchlist_v1_${account.toLowerCase()}`) || '[]');
};

export const isInWatchlist = (id: string, account: string): boolean => {
    if (!id || !account) return false;
    return getWatchlist(account).includes(id.toLowerCase());
};

export const toggleWatchlist = (id: string, account: string): boolean => {
    if (!id || !account) return false;
    const list = getWatchlist(account);
    const normalizedId = id.toLowerCase();
    const index = list.indexOf(normalizedId);
    let added = false;
    if (index > -1) { list.splice(index, 1); added = false; }
    else { list.push(normalizedId); added = true; }
    localStorage.setItem(`inturank_watchlist_v1_${account.toLowerCase()}`, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('watchlist-updated', { detail: { account } }));
    return added;
};

export const parseProtocolError = (error: any) => {
    const msg = error?.message || error?.toString() || "";
    if (msg.includes("0xD76F6FF8")) return "PROTOCOL_APPROVAL_REQUIRED: Please 'Enable Protocol' first.";
    if (msg.includes("insufficient funds")) return "INSUFFICIENT_TRUST_BALANCE";
    if (msg.includes("User rejected")) return "USER_REJECTED_HANDSHAKE";
    // Already a clear triple failure message (e.g. from FeeProxy + SDK fallback)
    if (msg.includes("Triple creation failed")) return msg.slice(0, 140) + (msg.length > 140 ? "…" : "");
    // FeeProxy createTriples revert (custom error / undecodable)
    if (msg.includes("createTriples") || msg.includes("0xd335ef46") || (msg.includes("reverted") && msg.toLowerCase().includes("triple"))) {
        return "Triple creation failed. Check: all 3 atoms exist on-chain, enough TRUST, and Enable Protocol.";
    }
    if (msg.includes("reverted") || msg.includes("ContractFunctionRevertedError")) {
        return "Transaction reverted. Ensure all 3 atoms exist on-chain and you have enough TRUST.";
    }
    return msg.slice(0, 120) + (msg.length > 120 ? "…" : "");
};

export const publishOpinion = async (text: string, agentId: string, side: string, wallet: string): Promise<string | undefined> => {
    try {
        return keccak256(stringToHex(`${text}-${agentId}-${side}-${Date.now()}`));
    } catch (e) { return undefined; }
};

export const createIdentityAtom = async (metadata: any, depositAmount: string, receiver: string, onProgress?: (log: string) => void) => {
    const checksumReceiver = getAddress(receiver);
    const dataHex = stringToHex(JSON.stringify(metadata));
    const depositBigInt = parseEther(depositAmount);
    const curveIdBigInt = BigInt(OFFSET_PROGRESSIVE_CURVE_ID);
    const provider = getProvider();
    const walletClient = createWalletClient({ chain: intuitionChain, transport: custom(provider), account: checksumReceiver });
    try {
        onProgress?.("Calculating Metadata Cost Vectors...");
        const totalCost = await publicClient.readContract({
            address: FEE_PROXY_ADDRESS as `0x${string}`,
            abi: FEE_PROXY_ABI,
            functionName: 'getAtomCost',
            args: [dataHex, depositBigInt, curveIdBigInt]
        } as any) as bigint;
        
        onProgress?.("Awaiting Identity Signature...");
        const { request } = await publicClient.simulateContract({
            address: FEE_PROXY_ADDRESS as `0x${string}`,
            abi: FEE_PROXY_ABI,
            functionName: 'createAtoms',
            account: checksumReceiver,
            args: [checksumReceiver, [dataHex], [depositBigInt], [curveIdBigInt]],
            value: totalCost, 
        } as any);
        
        const hash = await walletClient.writeContract(request);
        onProgress?.(`Broadcasting Identity... Hash: ${hash.slice(0,10)}...`);
        window.dispatchEvent(new Event('local-tx-updated'));
        return hash;
    } catch (error: any) { throw error; }
};

export const getAtomCreationCost = async (metadata: any, depositAmount: string) => {
    const dataHex = stringToHex(JSON.stringify(metadata));
    const depositBigInt = parseEther(depositAmount);
    const curveIdBigInt = BigInt(OFFSET_PROGRESSIVE_CURVE_ID);
    return await publicClient.readContract({
        address: FEE_PROXY_ADDRESS as `0x${string}`,
        abi: FEE_PROXY_ABI,
        functionName: 'getAtomCost',
        args: [dataHex, depositBigInt, curveIdBigInt]
    } as any) as bigint;
};

export const estimateAtomGas = async (account: string, metadata: any, depositAmount: string) => {
    const checksumAccount = getAddress(account);
    const dataHex = stringToHex(JSON.stringify(metadata));
    const depositBigInt = parseEther(depositAmount);
    const curveIdBigInt = BigInt(OFFSET_PROGRESSIVE_CURVE_ID);
    try {
        const totalCost = await getAtomCreationCost(metadata, depositAmount);
        const gas = await publicClient.estimateContractGas({
            address: FEE_PROXY_ADDRESS as `0x${string}`,
            abi: FEE_PROXY_ABI,
            functionName: 'createAtoms',
            account: checksumAccount,
            args: [checksumAccount, [dataHex], [depositBigInt], [curveIdBigInt]],
            value: totalCost,
        } as any);
        const gasPrice = await publicClient.getGasPrice();
        return gas * gasPrice;
    } catch (error) { return parseEther('0.0008'); }
};

export const createSemanticTriple = async (subjectId: string, predicateId: string, objectId: string, depositAmount: string, receiver: string, onProgress?: (log: string) => void) => {
    const checksumReceiver = getAddress(receiver);
    const sId = pad((subjectId.startsWith('0x') ? subjectId : `0x${subjectId}`) as Hex, { size: 32 });
    const pId = pad((predicateId.startsWith('0x') ? predicateId : `0x${predicateId}`) as Hex, { size: 32 });
    const oId = pad((objectId.startsWith('0x') ? objectId : `0x${objectId}`) as Hex, { size: 32 });
    const assets = parseEther(depositAmount);
    const provider = getProvider();
    const walletClient = createWalletClient({ chain: intuitionChain, transport: custom(provider), account: checksumReceiver });
    try {
        onProgress?.("Simulating Synapse Parameters...");
        let tripleCost: bigint;
        try {
            tripleCost = await publicClient.readContract({
                address: FEE_PROXY_ADDRESS as `0x${string}`,
                abi: FEE_PROXY_ABI,
                functionName: 'getTripleCost',
            } as any) as bigint;
        } catch (e) { tripleCost = parseEther('0.101'); }

        let totalCost: bigint;
        try {
            totalCost = await publicClient.readContract({
                address: FEE_PROXY_ADDRESS as `0x${string}`,
                abi: FEE_PROXY_ABI,
                functionName: 'getTotalCreationCost',
                args: [1n, assets, tripleCost]
            } as any) as bigint;
        } catch (e) {
            totalCost = assets + tripleCost;
        }

        onProgress?.("Awaiting Synapse Signature...");
        const { request } = await publicClient.simulateContract({
            address: FEE_PROXY_ADDRESS as `0x${string}`,
            abi: FEE_PROXY_ABI,
            functionName: 'createTriples',
            account: checksumReceiver,
            args: [checksumReceiver, [sId], [pId], [oId], [assets], BigInt(OFFSET_PROGRESSIVE_CURVE_ID)],
            value: totalCost, 
        } as any);
        
        const hash = await walletClient.writeContract(request);
        onProgress?.(`Broadcasting Triple... Hash: ${hash.slice(0,10)}...`);
        window.dispatchEvent(new Event('local-tx-updated'));
        return hash;
    } catch (error: any) { throw error; }
};

export const switchNetworkManual = async () => switchNetwork();
export const getClientChainId = async () => CHAIN_ID;
export const fetchAtomNameFromChain = async (id: string) => null;

/**
 * Resolves an ENS name to an Ethereum address using Mainnet.
 */
export const resolveENS = async (name: string): Promise<string | null> => {
    if (!name || !name.endsWith('.eth')) return null;
    try {
        // Use normalized name to satisfy ENS protocol requirements
        const normalizedName = normalize(name.toLowerCase());
        const address = await mainnetClient.getEnsAddress({ name: normalizedName });
        return address || null;
    } catch (e) {
        console.error("ENS_RESOLUTION_FAILURE:", e);
        // Explicit fallback for common "Internal error" from specific RPCs
        return null;
    }
};

/**
 * Reverse resolves an Ethereum address to an ENS name.
 */
export const reverseResolveENS = async (address: string): Promise<string | null> => {
    try {
        const ensName = await mainnetClient.getEnsName({ address: getAddress(address) });
        return ensName;
    } catch (e) {
        return null;
    }
};

export const disconnectWallet = () => {
  wagmiAddress = null;
  activeProvider = null;
  if (typeof window !== 'undefined') localStorage.setItem(DISCONNECT_FLAG_KEY, '1');
};
export const getProtocolConfig = async () => ({ minDeposit: '0.001' });
