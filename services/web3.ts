
import { createPublicClient, createWalletClient, custom, http, parseEther, formatEther, pad, getAddress, isAddress, type Hex, stringToHex, toHex, keccak256, encodePacked, decodeEventLog } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { CHAIN_ID, NETWORK_NAME, RPC_URL, MULTI_VAULT_ABI, MULTI_VAULT_ADDRESS, EXPLORER_URL, FEE_PROXY_ADDRESS, FEE_PROXY_ABI, LINEAR_CURVE_ID, OFFSET_PROGRESSIVE_CURVE_ID, DISPLAY_DIVISOR, CURRENCY_SYMBOL, CURVE_OFFSET } from '../constants';
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

/** Send native TRUST to an address. Uses same provider as rest of app so wallet prompts. */
export const sendNativeTransfer = async (
  fromAccount: string,
  to: `0x${string}`,
  valueWei: bigint
): Promise<string> => {
  const provider = getProvider();
  if (!provider) throw new Error('Wallet not connected');
  const account = getAddress(fromAccount);
  
  // Estimate gas properly first to avoid "intrinsic gas too low" errors
  // Then let MetaMask handle gas price estimation to avoid display bugs
  let estimatedGas: bigint;
  try {
    estimatedGas = await publicClient.estimateGas({
      account: account as `0x${string}`,
      to,
      value: valueWei,
    });
    // Add 20% buffer for safety
    estimatedGas = (estimatedGas * 120n) / 100n;
  } catch {
    // Fallback to higher default if estimation fails
    estimatedGas = 100000n; // Higher default for L3s
  }
  
  // Use walletClient but DON'T set gasPrice - let MetaMask estimate it
  // This prevents MetaMask from showing wrong gas fees
  const walletClient = createWalletClient({
    chain: intuitionChain,
    transport: custom(provider),
    account: account as `0x${string}`,
  });
  
  const hash = await walletClient.sendTransaction({
    to,
    value: valueWei,
    account: account as `0x${string}`,
    gas: estimatedGas, // Use properly estimated gas
    // Don't set gasPrice - let MetaMask fetch from network to avoid display bugs
  });
  return hash;
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
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[] | undefined;
      if (!Array.isArray(accounts) || accounts.length === 0) return null;
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

/** Batch getShareBalance via multicall — reduces N RPC calls to 1. Returns map of "termId:curveId" -> shares string. */
const MULTICALL_BATCH_SIZE = 80;
export const getShareBalancesBatch = async (
  account: string,
  items: { termId: string; curveId: number }[]
): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  if (!items.length) return result;
  const checksumAccount = getAddress(account);
  for (let i = 0; i < items.length; i += MULTICALL_BATCH_SIZE) {
    const batch = items.slice(i, i + MULTICALL_BATCH_SIZE);
    const contracts = batch.map(({ termId, curveId }) => {
      const rawTermId = termId.startsWith('0x') ? termId : `0x${termId}`;
      const termIdBytes32 = pad(rawTermId as Hex, { size: 32 });
      return {
        address: MULTI_VAULT_ADDRESS as `0x${string}`,
        abi: MULTI_VAULT_ABI,
        functionName: 'getShares' as const,
        args: [checksumAccount, termIdBytes32, BigInt(curveId)] as const,
      };
    });
    try {
      const results = await publicClient.multicall({ contracts, allowFailure: true });
      batch.forEach(({ termId, curveId }, idx) => {
        const key = `${termId.toLowerCase()}:${curveId}`;
        const r = results[idx];
        result.set(key, r?.status === 'success' && r.result != null ? formatEther(r.result as bigint) : '0');
      });
    } catch {
      batch.forEach(({ termId, curveId }) => result.set(`${termId.toLowerCase()}:${curveId}`, '0'));
    }
  }
  return result;
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
            value: (totalCost * 102n) / 100n, // 2% safety buffer
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

const PROXY_APPROVAL_CACHE_KEY = 'inturank_proxy_approved';
const PROXY_APPROVAL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (approval is one-time on-chain)

function getProxyApprovalCache(addr: string): boolean {
    try {
        const raw = localStorage.getItem(PROXY_APPROVAL_CACHE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        const entry = data[addr.toLowerCase()];
        if (!entry?.ts) return false;
        if (Date.now() - entry.ts > PROXY_APPROVAL_CACHE_TTL_MS) return false;
        return true;
    } catch { return false; }
}

function setProxyApprovalCache(addr: string): void {
    try {
        const raw = localStorage.getItem(PROXY_APPROVAL_CACHE_KEY) || '{}';
        const data = JSON.parse(raw);
        data[addr.toLowerCase()] = { ts: Date.now() };
        localStorage.setItem(PROXY_APPROVAL_CACHE_KEY, JSON.stringify(data));
    } catch (_) {}
}

export const markProxyApproved = (walletAddress: string): void => {
    try {
        setProxyApprovalCache(getAddress(walletAddress));
    } catch (_) {}
};

/** Sync check for cached approval (no RPC). Use for instant UI feedback. */
export const hasCachedProxyApproval = (walletAddress: string): boolean =>
    getProxyApprovalCache(getAddress(walletAddress));

export const checkProxyApproval = async (walletAddress: string): Promise<boolean> => {
    const addr = getAddress(walletAddress);
    if (getProxyApprovalCache(addr)) return true;
    try {
        const approved = await publicClient.readContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'isApproved',
            args: [addr, getAddress(FEE_PROXY_ADDRESS), 1]
        } as any);
        const ok = Boolean(approved);
        if (ok) setProxyApprovalCache(addr);
        return ok;
    } catch (e) {
        return false;
    }
};

const tryGrantWithProvider = async (provider: any, checksumAccount: `0x${string}`): Promise<string> => {
    const walletClient = createWalletClient({
        chain: intuitionChain,
        transport: custom(provider),
        account: checksumAccount,
    });
    const { request } = await publicClient.simulateContract({
        address: MULTI_VAULT_ADDRESS as `0x${string}`,
        abi: MULTI_VAULT_ABI,
        functionName: 'approve',
        account: checksumAccount,
        args: [getAddress(FEE_PROXY_ADDRESS), 1],
    } as any);
    return walletClient.writeContract(request);
};

export const grantProxyApproval = async (walletAddress: string): Promise<void> => {
    const checksumAccount = getAddress(walletAddress) as `0x${string}`;
    const primary = getProvider();
    const metaMask = getBrowserProvider('metamask');
    const fallback = getBrowserProvider('default');
    const providers = [primary, metaMask, fallback].filter(Boolean) as any[];
    if (!providers.length) throw new Error('Wallet not connected. Connect your wallet first.');
    let hash: string | undefined;
    let lastError: any;
    for (const provider of providers) {
        try {
            hash = await tryGrantWithProvider(provider, checksumAccount);
            break;
        } catch (e: any) {
            lastError = e;
        }
    }
    if (!hash) {
        const msg = String(lastError?.message || lastError?.error?.message || lastError?.reason || lastError?.shortMessage || lastError || '');
        const causeMsg = String(lastError?.cause?.message || lastError?.cause || '');
        const combined = msg + ' ' + causeMsg;
        if (/Extension ID|sendMessage|runtime\.sendMessage/i.test(combined)) {
            throw new Error('Wallet extension error. Try: refresh the page, disable other wallet extensions, or use a different browser.');
        }
        if (lastError?.code === 4001 || /reject/i.test(msg)) {
            throw new Error('Wallet not prompting. Try: refresh the page, disable other wallet extensions, or use Chrome with only MetaMask.');
        }
        throw lastError;
    }
    await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
    setProxyApprovalCache(checksumAccount);
    toast.success("HANDSHAKE_COMPLETE: Protocol enabled.");
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
    const rawMsg = error?.message || error?.toString() || "";
    const msg = rawMsg.toLowerCase();
    
    if (msg.includes("0xd76f6ff8")) return "PROTOCOL_APPROVAL_REQUIRED: Please 'Enable Protocol' first.";
    if (msg.includes("insufficient funds") || msg.includes("exceeds the balance")) return "INSUFFICIENT_TRUST_BALANCE";
    
    // MultiVault_InsufficientBalance() custom error selector
    if (msg.includes("0x7b0a37cf") || /MultiVault_InsufficientBalance/i.test(msg)) {
        const type = msg.includes("createatoms") ? "atom" : msg.includes("createtriples") ? "triple" : "protocol";
        return `INSUFFICIENT_TRUST_BALANCE: Not enough TRUST to cover the deposit plus ${type} creation cost. Reduce the deposit or add more TRUST.`;
    }
    if (msg.includes("user rejected")) return "USER_REJECTED_HANDSHAKE";
    
    // Gas estimation failures or unknown reverts
    if (msg.includes("gas estimation failed") || msg.includes("unknown reason") || msg.includes("execution reverted")) {
        return "TRANSACTION_REVERTED: The protocol rejected the transaction. This can happen if fees/deposits are incorrect or if the balance is too low.";
    }

    // Already a clear failure message
    if (msg.includes("creation failed")) return rawMsg.slice(0, 140) + (rawMsg.length > 140 ? "…" : "");
    
    // FeeProxy createTriples revert 0xd335ef46 (custom error: InsufficientDepositAmountToCoverFees)
    if (msg.includes("0xd335ef46") || /InsufficientDepositAmountToCoverFees/i.test(msg)) {
        return "INSUFFICIENT_FEE_COVERAGE: Protocol rejected the transaction due to insufficient fee coverage. Try adding 0.01 more TRUST to your deposit.";
    }
    
    if (msg.includes("createtriples") || (msg.includes("reverted") && msg.includes("triple"))) {
        return "Triple creation failed. Check: all 3 atoms exist on-chain, enough TRUST, and Enable Protocol.";
    }
    if (msg.includes("reverted") || msg.includes("contractfunctionrevertederror")) {
        if (msg.includes("createatoms")) {
            return "Transaction reverted during atom creation. Ensure you have enough TRUST balance for protocol fees and your deposit is at least 0.5 TRUST.";
        }
        return "Transaction reverted. Ensure all 3 atoms exist on-chain and you have enough TRUST.";
    }
    return rawMsg.slice(0, 120) + (rawMsg.length > 120 ? "…" : "");
};

export const publishOpinion = async (text: string, agentId: string, side: string, wallet: string): Promise<string | undefined> => {
    try {
        return keccak256(stringToHex(`${text}-${agentId}-${side}-${Date.now()}`));
    } catch (e) { return undefined; }
};

/** Build atom data bytes for FeeProxy. Uses formats the protocol accepts: Account = address hex; Thing/Person/Organization = plain text name (avoids getAtomCost revert on JSON). */
const buildAtomDataHex = (metadata: any): `0x${string}` => {
    let atomStr = '';
    if (metadata?.type === 'Account' && metadata?.address && isAddress(metadata.address)) {
        atomStr = getAddress(metadata.address);
    } else {
        atomStr = (metadata?.name && typeof metadata.name === 'string') ? metadata.name.trim() : 'Atom';
    }
    return stringToHex(atomStr || 'Atom');
};

export const createIdentityAtom = async (metadata: any, depositAmount: string, receiver: string, onProgress?: (log: string) => void): Promise<{ hash: `0x${string}`; termId?: `0x${string}` }> => {
    const checksumReceiver = getAddress(receiver);
    const depositBigInt = parseEther(depositAmount);
    const dataHex = buildAtomDataHex(metadata);
    
    const provider = getProvider();
    const walletClient = createWalletClient({ chain: intuitionChain, transport: custom(provider), account: checksumReceiver });

    try {
        onProgress?.("Verifying Protocol Approval...");
        const approved = await checkProxyApproval(receiver);
        if (!approved) {
            onProgress?.("Awaiting Protocol Handshake...");
            await grantProxyApproval(receiver);
        }

        onProgress?.("Simulating Protocol Cost...");
        
        const totalCost = await getAtomCreationCost(metadata, depositAmount);

        onProgress?.(`Handshake Cost: ${formatEther(totalCost)} ${CURRENCY_SYMBOL}`);
        onProgress?.("Awaiting Identity Signature...");

        let request: any;
        try {
            const simulation = await publicClient.simulateContract({
                address: FEE_PROXY_ADDRESS as `0x${string}`,
                abi: FEE_PROXY_ABI,
                functionName: 'createAtoms',
                account: checksumReceiver,
                args: [checksumReceiver, [dataHex], [depositBigInt], BigInt(LINEAR_CURVE_ID)],
                value: totalCost, // cost already includes safety buffer
            } as any);
            request = simulation.request;
        } catch (simulationError: any) {
            console.warn("ATOM_SIMULATION_FAILED:", simulationError);
            const parsed = parseProtocolError(simulationError);
            // Search for keywords case-insensitively
            const upper = parsed.toUpperCase();
            if (upper.includes("REVERTED") || upper.includes("BALANCE") || upper.includes("FEE")) {
                throw new Error(parsed);
            }
            throw simulationError;
        }

        const hash = await walletClient.writeContract(request);
        onProgress?.(`Broadcasting Identity... Hash: ${hash.slice(0,10)}...`);

        let termId: `0x${string}` | undefined;
        try {
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            onProgress?.("Identity Anchored in Block.");
            
            for (const log of receipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: MULTI_VAULT_ABI,
                        data: log.data,
                        topics: (log as any).topics,
                    });
                    if ((decoded as any).eventName === 'AtomCreated' || (decoded as any).args?.termId) {
                        termId = (decoded as any).args.termId;
                    }
                } catch {}
            }
        } catch (e) {
            console.warn("RECEIPT_WAIT_ERROR:", e);
        }

        window.dispatchEvent(new Event('local-tx-updated'));
        return { hash, termId };
    } catch (error: any) {
        console.error('createIdentityAtom failed:', error?.message || error);
        const parsed = parseProtocolError(error);
        const upper = parsed.toUpperCase();
        if (upper.includes("REVERTED") || upper.includes("BALANCE") || upper.includes("FEE")) {
            throw new Error(parsed);
        }
        throw error;
    }
};

export const getAtomCreationCost = async (metadata: any, depositAmount: string): Promise<bigint> => {
    const assets = parseEther(depositAmount || '0');
    let atomFee = parseEther('0.15');
    try {
        // Query MultiVault for the current base atom cost
        const actualAtomFee = await publicClient.readContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'getAtomCost',
        } as any) as bigint;
        if (actualAtomFee > 0n) atomFee = actualAtomFee;
    } catch (e) {
        console.warn("Failed to fetch atom cost from MultiVault, using fallback 0.15");
    }

    try {
        // Use getTotalCreationCost on FeeProxy to include proxy fees, matching triple logic
        const cost = await publicClient.readContract({
            address: FEE_PROXY_ADDRESS as `0x${string}`,
            abi: FEE_PROXY_ABI,
            functionName: 'getTotalCreationCost',
            args: [1n, assets, atomFee]
        } as any) as bigint;
        // Include 15% safety buffer in the reported cost to ensure UI/Wallet alignment
        return (cost * 115n) / 100n;
    } catch {
        // Fallback: base fee + assets + 15% proxy fee + 15% safety buffer
        const raw = (atomFee + assets) * 115n / 100n;
        return (raw * 115n) / 100n;
    }
};

export const estimateAtomGas = async (account: string, metadata: any, depositAmount: string) => {
    const checksumAccount = getAddress(account);
    const depositBigInt = parseEther(depositAmount || '0');
    const dataHex = buildAtomDataHex(metadata);
    try {
        const totalCost = await getAtomCreationCost(metadata, depositAmount);
        const gas = await publicClient.estimateContractGas({
            address: FEE_PROXY_ADDRESS as `0x${string}`,
            abi: FEE_PROXY_ABI,
            functionName: 'createAtoms',
            account: checksumAccount,
            args: [checksumAccount, [dataHex], [depositBigInt], BigInt(LINEAR_CURVE_ID)],
            value: totalCost,
        } as any);
        const gasPrice = await publicClient.getGasPrice();
        return gas * gasPrice;
    } catch (error) { return parseEther('0.0008'); }
};

/**
 * Returns the minimum deposit (assets) required for claim/triple creation.
 * Uses CURVE_OFFSET (0.1 T) as the protocol minimum for the bonding curve.
 */
export const getMinClaimDeposit = async (): Promise<string> => {
    return formatEther(CURVE_OFFSET);
};

/**
 * Returns the base protocol triple cost from MultiVault (excluding any IntuRank proxy fee).
 */
export const getTripleCost = async (): Promise<string> => {
    try {
        const tripleCost = await publicClient.readContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'getTripleCost',
        } as any) as bigint;
        return formatEther(tripleCost < parseEther('0.15') ? parseEther('0.15') : tripleCost);
    } catch {
        return formatEther(parseEther('0.15'));
    }
};

/**
 * Returns the total cost (deposit + triple cost + proxy fee) for creating a claim.
 * Uses FeeProxy.getTotalCreationCost so the IntuRank fee is included.
 */
export const getTotalTripleCreationCost = async (depositAmount: string): Promise<string> => {
    const assets = parseEther(depositAmount || '0');
    try {
        // Base triple cost (prefer FeeProxy for consistent calculation)
        let tripleCost: bigint;
        try {
            tripleCost = await publicClient.readContract({
                address: FEE_PROXY_ADDRESS as `0x${string}`,
                abi: FEE_PROXY_ABI,
                functionName: 'getTripleCost',
            } as any) as bigint;
        } catch {
            tripleCost = parseEther('0.15');
        }

        if (tripleCost < parseEther('0.15')) tripleCost = parseEther('0.15');

        // Ask FeeProxy for the full creation cost
        const total = await publicClient.readContract({
            address: FEE_PROXY_ADDRESS as `0x${string}`,
            abi: FEE_PROXY_ABI,
            functionName: 'getTotalCreationCost',
            args: [1n, assets, tripleCost],
        } as any) as bigint;

        // Include 15% safety buffer in the reported cost
        return formatEther((total * 115n) / 100n);
    } catch {
        // Fallback heuristic: base triple cost (0.15) + deposit + 15% proxy fee + 15% safety buffer
        const tripleCost = parseEther('0.15');
        const raw = (tripleCost + assets) * 115n / 100n;
        const totalWithBuffer = (raw * 115n) / 100n;
        return formatEther(totalWithBuffer);
    }
};

export const padTermId = (id: string): `0x${string}` =>
    pad((id.startsWith('0x') ? id : `0x${id}`) as Hex, { size: 32 }) as `0x${string}`;

export const validateTripleAtomsExist = async (subjectId: string, predicateId: string, objectId: string): Promise<{ ok: boolean; missing: string[] }> => {
    const ids = [
        { id: subjectId, role: 'Subject' },
        { id: predicateId, role: 'Predicate' },
        { id: objectId, role: 'Object' },
    ];
    const missing: string[] = [];
    for (const { id, role } of ids) {
        try {
            const termId = padTermId(id);
            let exists = false;
            try {
                exists = await publicClient.readContract({
                    address: MULTI_VAULT_ADDRESS as `0x${string}`,
                    abi: MULTI_VAULT_ABI,
                    functionName: 'isTermCreated',
                    args: [termId],
                } as any) as boolean;
            } catch {
                try {
                    exists = await publicClient.readContract({
                        address: FEE_PROXY_ADDRESS as `0x${string}`,
                        abi: FEE_PROXY_ABI,
                        functionName: 'isTermCreated',
                        args: [termId],
                    } as any) as boolean;
                } catch {}
            }
            if (!exists) missing.push(`${role} (${id.slice(0, 10)}…)`);
        } catch {
            missing.push(`${role} (${id.slice(0, 10)}…)`);
        }
    }
    return { ok: missing.length === 0, missing };
};

export const createSemanticTriple = async (subjectId: string, predicateId: string, objectId: string, depositAmount: string, receiver: string, onProgress?: (log: string) => void, skipValidation?: boolean) => {
    const assets = parseEther(depositAmount);
    if (assets < CURVE_OFFSET) {
        throw new Error(`Minimum deposit is ${formatEther(CURVE_OFFSET)} TRUST. You provided ${depositAmount}.`);
    }
    if (!skipValidation) {
        onProgress?.("Verifying atoms on-chain...");
        const { ok, missing } = await validateTripleAtomsExist(subjectId, predicateId, objectId);
        if (!ok) {
            throw new Error(`Atom(s) not found on-chain: ${missing.join(', ')}. Create them first or pick existing atoms from search.`);
        }
    }
    const checksumReceiver = getAddress(receiver);
    const sId = padTermId(subjectId);
    const pId = padTermId(predicateId);
    const oId = padTermId(objectId);
    const provider = getProvider();
    const walletClient = createWalletClient({ chain: intuitionChain, transport: custom(provider), account: checksumReceiver });

    try {
        onProgress?.("Simulating Synapse Parameters...");

        // 1. Get base triple cost from MultiVault (via FeeProxy or direct)
        let tripleCost: bigint;
        try {
            tripleCost = await publicClient.readContract({
                address: FEE_PROXY_ADDRESS as `0x${string}`,
                abi: FEE_PROXY_ABI,
                functionName: 'getTripleCost',
            } as any) as bigint;
        } catch {
            tripleCost = parseEther('0.15');
        }

        if (tripleCost < parseEther('0.15')) tripleCost = parseEther('0.15');

        // 2. Get total cost via FeeProxy (required for direct native token funding)
        let totalCost: bigint;
        try {
            totalCost = await publicClient.readContract({
                address: FEE_PROXY_ADDRESS as `0x${string}`,
                abi: FEE_PROXY_ABI,
                functionName: 'getTotalCreationCost',
                args: [1n, assets, tripleCost],
            } as any) as bigint;
        } catch (e) {
            const raw = tripleCost + assets;
            // Use 15% proxy fee fallback if contract call fails
            totalCost = (raw * 115n) / 100n;
        }

        const valueToSend = totalCost; // buffer already included in totalCost from getTotalTripleCreationCost

        onProgress?.(`Handshake Cost: ${formatEther(valueToSend)} ${CURRENCY_SYMBOL}`);
        onProgress?.("Awaiting Synapse Signature...");
        
        // 3. Create triple via FeeProxy (handles direct native TRUST funding to user's vault balance)
        let request: any;
        try {
            const simulation = await publicClient.simulateContract({
                address: FEE_PROXY_ADDRESS as `0x${string}`,
                abi: FEE_PROXY_ABI,
                functionName: 'createTriples',
                account: checksumReceiver,
                args: [checksumReceiver, [sId], [pId], [oId], [assets], BigInt(LINEAR_CURVE_ID)],
                value: valueToSend,
            } as any);
            request = simulation.request;
        } catch (simulationError: any) {
            console.warn("SIMULATION_FAILED:", simulationError);
            const parsed = parseProtocolError(simulationError);
            const upper = parsed.toUpperCase();
            if (upper.includes("REVERTED") || upper.includes("BALANCE") || upper.includes("FEE")) {
                throw new Error(parsed);
            }
            throw simulationError;
        }

        const hash = await walletClient.writeContract(request);
        
        onProgress?.(`Broadcasting Triple... Hash: ${hash.slice(0,10)}...`);
        window.dispatchEvent(new Event('local-tx-updated'));
        return hash;
    } catch (error: any) {
        console.error('createSemanticTriple failed:', error?.message || error);
        const parsed = parseProtocolError(error);
        const upper = parsed.toUpperCase();
        if (upper.includes("REVERTED") || upper.includes("BALANCE") || upper.includes("FEE")) {
            throw new Error(parsed);
        }
        throw error;
    }
};

export const switchNetworkManual = async () => switchNetwork();
export const getClientChainId = async () => CHAIN_ID;
export const fetchAtomNameFromChain = async (id: string) => null;

/**
 * Normalizes an address-like id to a 42-char checksummed address.
 * Handles both 42-char addresses and 66-char padded format (0x0000...0000 + addr).
 * Returns null when the id is not a valid address.
 */
export const toAddress = (id: string | null | undefined): string | null => {
  if (!id || typeof id !== 'string') return null;
  const t = id.trim();
  if (t.length === 42 && t.startsWith('0x') && isAddress(t)) {
    try { return getAddress(t); } catch { return null; }
  }
  if (t.length === 66 && t.startsWith('0x000000000000000000000000')) {
    const unpadded = '0x' + t.slice(26);
    if (isAddress(unpadded)) {
      try { return getAddress(unpadded); } catch { return null; }
    }
  }
  return null;
};

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
export const getProtocolConfig = async () => ({ minDeposit: '0.5' });
