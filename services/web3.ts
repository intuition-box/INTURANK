
import { createPublicClient, createWalletClient, custom, http, parseEther, formatEther, pad, isAddress, getAddress, type Hex, stringToHex, keccak256, encodePacked, hexToString } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { CHAIN_ID, NETWORK_NAME, RPC_URL, MULTI_VAULT_ABI, MULTI_VAULT_ADDRESS, EXPLORER_URL } from '../constants';
import { Transaction } from '../types';

export const intuitionChain = {
  id: CHAIN_ID,
  name: NETWORK_NAME,
  network: 'intuition',
  nativeCurrency: { decimals: 18, name: 'ETH', symbol: 'ETH' }, 
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
} as const;

export const publicClient = createPublicClient({
  chain: intuitionChain,
  transport: http(RPC_URL),
});

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com')
});

export const parseProtocolError = (error: any): string => {
  const errStr = error?.message || error?.toString() || "";
  console.debug("[INTERNAL_LOG] PARSING_EXCEPTION:", error);
  
  if (errStr.includes("User rejected")) return "Transaction cancelled in wallet.";
  if (errStr.includes("MultiVault_InsufficientAssets")) return "Insufficient TRUST for this operation.";
  if (errStr.includes("MultiVault_SlippageExceeded")) return "Price moved too fast. Try a smaller amount.";
  if (errStr.includes("MultiVault_DepositBelowMinimumDeposit")) return "Amount below protocol minimum requirements.";
  if (errStr.includes("InsufficientBalance")) return "Insufficient native ETH for gas fees.";
  if (errStr.includes("Requested entity was not found")) return "Indexer catching up — please wait 30s and try again.";
  
  return "Protocol execution failed. Market state may have shifted.";
};

export const resolveENS = async (name: string): Promise<string | null> => {
    try {
        if (!name.includes('.')) return null;
        return await mainnetClient.getEnsAddress({ name: normalize(name) });
    } catch { return null; }
};

const LOCAL_TX_KEY = 'inturank_ledger_v2';
export const saveLocalTransaction = (tx: Transaction, account: string) => {
  console.info("[INTERNAL_LOG] SYNCING_LOCAL_LEDGER:", tx.id);
  const key = `${LOCAL_TX_KEY}_${account.toLowerCase()}`;
  const current: Transaction[] = JSON.parse(localStorage.getItem(key) || '[]');
  localStorage.setItem(key, JSON.stringify([tx, ...current].slice(0, 50)));
};

export const getLocalTransactions = (account: string): Transaction[] => {
  return JSON.parse(localStorage.getItem(`${LOCAL_TX_KEY}_${account.toLowerCase()}`) || '[]');
};

export const getWatchlist = (account: string): string[] => {
  if (!account) return [];
  return JSON.parse(localStorage.getItem(`inturank_watchlist_${account.toLowerCase()}`) || '[]');
};

const WALLET_PERSIST_KEY = 'inturank_session_active';
export const disconnectWallet = () => {
    console.info("[INTERNAL_LOG] TERMINATING_SESSION");
    localStorage.removeItem(WALLET_PERSIST_KEY);
};

export const toggleWatchlist = (id: string, account?: string | null): boolean => {
    if (!account) return false;
    const key = `inturank_watchlist_${account.toLowerCase()}`;
    const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    const isAdded = !list.includes(id);
    const newList = isAdded ? [id, ...list] : list.filter(item => item !== id);
    localStorage.setItem(key, JSON.stringify(newList));
    window.dispatchEvent(new CustomEvent('watchlist-updated', { detail: { account } }));
    return isAdded;
};

export const isInWatchlist = (id: string, account?: string | null): boolean => {
    if (!account) return false;
    const list: string[] = JSON.parse(localStorage.getItem(`inturank_watchlist_${account.toLowerCase()}`) || '[]');
    return list.includes(id);
};

export const getConnectedAccount = async (): Promise<string | null> => {
  if (!localStorage.getItem(WALLET_PERSIST_KEY)) return null;
  if ((window as any).ethereum) {
    try {
      const walletClient = createWalletClient({ chain: intuitionChain, transport: custom((window as any).ethereum) });
      const [address] = await walletClient.getAddresses();
      return address ? getAddress(address) : null;
    } catch { return null; }
  }
  return null;
};

export const connectWallet = async (): Promise<string | null> => {
  if (!(window as any).ethereum) return null;
  try {
    console.info("[INTERNAL_LOG] HANDSHAKE_START");
    const walletClient = createWalletClient({ chain: intuitionChain, transport: custom((window as any).ethereum) });
    const [address] = await walletClient.requestAddresses();
    localStorage.setItem(WALLET_PERSIST_KEY, 'true');
    console.info("[INTERNAL_LOG] HANDSHAKE_SUCCESS:", address);
    return address ? getAddress(address) : null;
  } catch (err) { 
    console.error("[INTERNAL_LOG] HANDSHAKE_FAILED", err);
    return null; 
  }
};

export const getWalletBalance = async (address: string): Promise<string> => {
  try {
    const balance = await publicClient.getBalance({ address: address as `0x${string}` });
    return formatEther(balance);
  } catch { return "0.00"; }
};

export const getShareBalance = async (account: string, termId: string, curveId: number = 1): Promise<string> => {
  try {
    const rawTermId = termId.startsWith('0x') ? termId : `0x${termId}`;
    const termIdBytes32 = pad(rawTermId as Hex, { size: 32 });
    const shares = await publicClient.readContract({
      address: MULTI_VAULT_ADDRESS as `0x${string}`,
      abi: MULTI_VAULT_ABI,
      functionName: 'getShares',
      args: [getAddress(account), termIdBytes32, BigInt(curveId || 1)]
    } as any);
    return formatEther(shares as bigint);
  } catch { return "0"; }
};

export const getQuoteRedeem = async (sharesAmount: string, termId: string, account: string, curveId: number = 1): Promise<string> => {
    try {
        const rawTermId = termId.startsWith('0x') ? termId : `0x${termId}`;
        const termIdBytes32 = pad(rawTermId as Hex, { size: 32 });
        const result = await publicClient.readContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'previewRedeem',
            args: [termIdBytes32, BigInt(curveId || 1), parseEther(sharesAmount)]
        } as any) as [bigint, bigint]; 
        return formatEther(result[0]);
    } catch { return "0"; }
};

export const getProtocolConfig = async () => {
    try {
        const config: any = await publicClient.readContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'getGeneralConfig',
        } as any);
        return { minDeposit: formatEther(config.minDeposit), minShare: formatEther(config.minShare) };
    } catch { return { minDeposit: '0.001', minShare: '0.001' }; }
};

export const depositToVault = async (amount: string, termId: string, receiver: string, curveId: number = 1) => {
  console.info("[INTERNAL_LOG] DEPOSIT_ATTEMPT:", { amount, termId });
  const checksumReceiver = getAddress(receiver);
  const termIdBytes32 = pad((termId.startsWith('0x') ? termId : `0x${termId}`) as Hex, { size: 32 });
  const walletClient = createWalletClient({ chain: intuitionChain, transport: custom((window as any).ethereum), account: checksumReceiver });
  const assets = parseEther(amount);
  
  try {
    const { request, result } = await publicClient.simulateContract({
      address: MULTI_VAULT_ADDRESS as `0x${string}`,
      abi: MULTI_VAULT_ABI,
      functionName: 'depositBatch',
      account: checksumReceiver,
      args: [checksumReceiver, [termIdBytes32], [BigInt(curveId || 1)], [assets], [0n]],
      value: assets,
    });
    const hash = await walletClient.writeContract(request as any);
    console.info("[INTERNAL_LOG] DEPOSIT_SUBMITTED:", hash);
    return { hash, shares: (result as bigint[])[0] };
  } catch (err) {
    console.error("[INTERNAL_LOG] DEPOSIT_REJECTED", err);
    throw err;
  }
};

export const redeemFromVault = async (sharesAmount: string, termId: string, receiver: string, curveId: number = 1) => {
  console.info("[INTERNAL_LOG] REDEEM_ATTEMPT:", { sharesAmount, termId });
  const checksumReceiver = getAddress(receiver);
  const termIdBytes32 = pad((termId.startsWith('0x') ? termId : `0x${termId}`) as Hex, { size: 32 });
  const walletClient = createWalletClient({ chain: intuitionChain, transport: custom((window as any).ethereum), account: checksumReceiver });
  const shares = parseEther(sharesAmount);
  
  try {
    const { request, result } = await publicClient.simulateContract({
      address: MULTI_VAULT_ADDRESS as `0x${string}`,
      abi: MULTI_VAULT_ABI,
      functionName: 'redeemBatch',
      account: checksumReceiver,
      args: [checksumReceiver, [termIdBytes32], [BigInt(curveId || 1)], [shares], [0n]],
    });
    const hash = await walletClient.writeContract(request as any);
    console.info("[INTERNAL_LOG] REDEEM_SUBMITTED:", hash);
    return { hash, assets: (result as bigint[])[0] };
  } catch (err) {
    console.error("[INTERNAL_LOG] REDEEM_REJECTED", err);
    throw err;
  }
};

export const publishOpinion = async (text: string, agentId: string, side: "TRUST" | "DISTRUST", wallet: string) => {
  console.info("[INTERNAL_LOG] OPINION_ATTEMPT:", { text, agentId, side });
  const checksumAddress = getAddress(wallet);
  const walletClient = createWalletClient({ chain: intuitionChain, transport: custom((window as any).ethereum), account: checksumAddress });
  const textHex = stringToHex(text);
  const fee = parseEther("0.0001");
  const commentId = keccak256(textHex);
  
  const exists = await publicClient.readContract({
    address: MULTI_VAULT_ADDRESS as `0x${string}`,
    abi: MULTI_VAULT_ABI,
    functionName: 'isTermCreated',
    args: [commentId]
  } as any);
  
  if (!exists) {
      const { request: atomReq } = await publicClient.simulateContract({
        address: MULTI_VAULT_ADDRESS as `0x${string}`,
        abi: MULTI_VAULT_ABI,
        functionName: 'createAtoms',
        account: checksumAddress,
        args: [[textHex], [fee]],
        value: fee
      });
      const atomTx = await walletClient.writeContract(atomReq as any);
      await publicClient.waitForTransactionReceipt({ hash: atomTx });
  }
  
  const subjectId = pad(agentId as Hex, { size: 32 });
  const predicateId = keccak256(stringToHex("SIGNALED"));
  
  const { request: tripleReq } = await publicClient.simulateContract({
    address: MULTI_VAULT_ADDRESS as `0x${string}`,
    abi: MULTI_VAULT_ABI,
    functionName: 'createTriples',
    account: checksumAddress,
    args: [[subjectId], [predicateId], [commentId], [fee]],
    value: fee
  });
  
  const hash = await walletClient.writeContract(tripleReq as any);
  console.info("[INTERNAL_LOG] OPINION_SUBMITTED:", hash);
  return hash;
};

export const switchNetwork = async () => {
  if (!(window as any).ethereum) return;
  try {
    await (window as any).ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
    });
  } catch (error: any) {
    if (error.code === 4902) {
      await (window as any).ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${CHAIN_ID.toString(16)}`,
          chainName: NETWORK_NAME,
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [EXPLORER_URL],
        }],
      });
    }
  }
};

export const getClientChainId = async (): Promise<number> => {
  try { return await publicClient.getChainId(); } catch { return 0; }
};

export const fetchAtomNameFromChain = async (atomId: string): Promise<string | null> => {
  try {
    const rawTermId = atomId.startsWith('0x') ? atomId : `0x${atomId}`;
    const data = await publicClient.readContract({
      address: MULTI_VAULT_ADDRESS as `0x${string}`,
      abi: MULTI_VAULT_ABI,
      functionName: 'getAtom',
      args: [pad(rawTermId as Hex, { size: 32 })]
    } as any);
    if (data && data !== '0x') {
        const decoded = hexToString(data as Hex);
        return decoded.replace(/\0/g, '').trim() || null;
    }
    return null;
  } catch { return null; }
};
