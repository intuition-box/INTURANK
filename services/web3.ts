import { createPublicClient, createWalletClient, custom, http, parseEther, formatEther, pad, isAddress, getAddress, type Hex, stringToHex, keccak256, encodePacked, hexToString } from 'viem';
import { CHAIN_ID, RPC_URL, MULTI_VAULT_ABI, MULTI_VAULT_ADDRESS, EXPLORER_URL } from '../constants';
import { Transaction } from '../types';

export const intuitionTestnet = {
  id: CHAIN_ID,
  name: 'Intuition Mainnet',
  network: 'intuition',
  nativeCurrency: { decimals: 18, name: 'ETH', symbol: 'ETH' }, 
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
} as const;

export const publicClient = createPublicClient({
  chain: intuitionTestnet,
  transport: http(RPC_URL),
});

// --- Local Transaction Helpers ---
const LOCAL_TX_KEY = 'inturank_local_transactions';
export const saveLocalTransaction = (tx: Transaction, account: string) => {
  const key = `${LOCAL_TX_KEY}_${account.toLowerCase()}`;
  const currentStr = localStorage.getItem(key);
  const current: Transaction[] = currentStr ? JSON.parse(currentStr) : [];
  const updated = [tx, ...current].slice(0, 50);
  localStorage.setItem(key, JSON.stringify(updated));
};

export const getLocalTransactions = (account: string): Transaction[] => {
  const key = `${LOCAL_TX_KEY}_${account.toLowerCase()}`;
  const currentStr = localStorage.getItem(key);
  return currentStr ? JSON.parse(currentStr) : [];
};

// --- Connection Persistence Helper ---
const WALLET_CONNECTED_KEY = 'inturank_wallet_connected';

export const disconnectWallet = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(WALLET_CONNECTED_KEY);
    }
};

// --- Watchlist Helpers (Auth Protected) ---
const getWatchlistKey = (account: string) => `inturank_watchlist_${account.toLowerCase()}`;

export const getWatchlist = (account?: string | null): string[] => {
    if (!account) return [];
    try {
        const stored = localStorage.getItem(getWatchlistKey(account));
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

export const toggleWatchlist = (id: string, account?: string | null): boolean => {
    if (!account) return false;
    
    const list = getWatchlist(account);
    const normalizedId = id.toLowerCase();
    const idx = list.findIndex(item => item.toLowerCase() === normalizedId);
    
    let newList;
    const isAdded = idx === -1;
    
    if (isAdded) {
        newList = [id, ...list]; // Add to top
    } else {
        newList = list.filter(item => item.toLowerCase() !== normalizedId);
    }
    
    localStorage.setItem(getWatchlistKey(account), JSON.stringify(newList));
    
    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent('watchlist-updated', { detail: { account } }));
    
    return isAdded;
};

export const isInWatchlist = (id: string, account?: string | null): boolean => {
    if (!account) return false;
    const list = getWatchlist(account);
    return list.some(item => item.toLowerCase() === id.toLowerCase());
};
// --------------------------------

// --- Fallback Name Resolution ---
export const fetchAtomNameFromChain = async (termId: string): Promise<string | null> => {
    try {
        const rawTermId = termId.startsWith('0x') ? termId : `0x${termId}`;
        const termIdBytes32 = pad(rawTermId as Hex, { size: 32 });
        
        const data = await publicClient.readContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'getAtom',
            args: [termIdBytes32]
        } as any) as Hex;

        if (!data || data === '0x') return null;

        const decoded = hexToString(data);
        const clean = decoded.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
        
        return clean.length > 1 ? clean : null;
    } catch (e) {
        return null;
    }
};

export const getConnectedAccount = async (): Promise<string | null> => {
  if (typeof window !== 'undefined') {
    // Prevent auto-connect if user explicitly disconnected previously
    if (!localStorage.getItem(WALLET_CONNECTED_KEY)) {
        return null;
    }

    if ((window as any).ethereum) {
        try {
        const walletClient = createWalletClient({
            chain: intuitionTestnet,
            transport: custom((window as any).ethereum),
        });
        const [address] = await walletClient.getAddresses();
        return address ? getAddress(address) : null;
        } catch { return null; }
    }
  }
  return null;
};

export const getClientChainId = async (): Promise<number> => {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      const chainIdHex = await (window as any).ethereum.request({ method: 'eth_chainId' });
      return parseInt(chainIdHex, 16);
    } catch { return 0; }
  }
  return 0;
};

export const addNetwork = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
            await (window as any).ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${CHAIN_ID.toString(16)}`,
                    chainName: 'Intuition Mainnet',
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: [RPC_URL],
                    blockExplorerUrls: [EXPLORER_URL || 'https://explorer.intuition.systems'],
                }],
            });
        } catch (error) {
            console.error("Failed to add network:", error);
        }
    }
};

export const switchNetwork = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
            await (window as any).ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
            });
        } catch (switchError: any) {
            if (
                switchError.code === 4902 || 
                switchError.data?.originalError?.code === 4902 ||
                switchError.message?.toLowerCase().includes('unrecognized') ||
                switchError.message?.toLowerCase().includes('unknown')
            ) {
                await addNetwork();
            } else {
                console.error("Switch network error:", switchError);
                await addNetwork();
            }
        }
    }
};

export const getWalletBalance = async (address: string): Promise<string> => {
  try {
    const balance = await publicClient.getBalance({ address: address as `0x${string}` });
    return formatEther(balance);
  } catch (e) { return "0.00"; }
};

export const getShareBalance = async (account: string, termId: string, curveId: number = 0): Promise<string> => {
  try {
    const rawTermId = termId.startsWith('0x') ? termId : `0x${termId}`;
    const termIdBytes32 = pad(rawTermId as Hex, { size: 32 });
    const checksumAccount = getAddress(account);

    const shares = await publicClient.readContract({
      address: MULTI_VAULT_ADDRESS as `0x${string}`,
      abi: MULTI_VAULT_ABI,
      functionName: 'getShares',
      args: [checksumAccount, termIdBytes32, BigInt(curveId)]
    } as unknown as any);
    return formatEther(shares as unknown as bigint);
  } catch (e) { return "0"; }
};

export const getProtocolConfig = async () => {
    try {
        const config: any = await publicClient.readContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'getGeneralConfig',
        } as any);
        
        return {
            minDeposit: formatEther(config.minDeposit),
            minShare: formatEther(config.minShare)
        };
    } catch (e) {
        return { minDeposit: '0.001', minShare: '0.001' }; 
    }
};

export const getQuoteRedeem = async (sharesAmount: string, termId: string, account: string, curveId: number = 0): Promise<string> => {
    try {
        const rawTermId = termId.startsWith('0x') ? termId : `0x${termId}`;
        const termIdBytes32 = pad(rawTermId as Hex, { size: 32 });
        const sharesWei = parseEther(sharesAmount);
        
        const result = await publicClient.readContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'previewRedeem',
            args: [termIdBytes32, BigInt(curveId), sharesWei]
        } as any) as [bigint, bigint]; 

        return formatEther(result[0]);
    } catch (e) {
        return "0";
    }
};

export const connectWallet = async (): Promise<string | null> => {
  if (typeof window !== 'undefined') {
    if ((window as any).ethereum) {
      try {
        const walletClient = createWalletClient({
          chain: intuitionTestnet,
          transport: custom((window as any).ethereum),
        });
        const [address] = await walletClient.requestAddresses();
        try { 
            await walletClient.switchChain({ id: intuitionTestnet.id }); 
        } catch (e) { 
            try { await switchNetwork(); } catch (e2) { console.warn("Auto-switch failed", e2); }
        }
        
        // Persist connected state
        if (address) {
            localStorage.setItem(WALLET_CONNECTED_KEY, 'true');
        }
        
        return address ? getAddress(address) : null;
      } catch (error) {
        console.error("Wallet connection failed:", error);
        return null; 
      }
    } else {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const currentUrl = window.location.href.split('//')[1];
        const deepLink = `https://metamask.app.link/dapp/${currentUrl}`;
        window.location.href = deepLink;
        return null;
      } else {
        alert("Please install a wallet like MetaMask."); 
        return null; 
      }
    }
  }
  return null;
};

export const depositToVault = async (amount: string, termId: string, receiver: string, curveId: number = 0) => {
  if (typeof window === 'undefined' || !(window as any).ethereum) throw new Error("No wallet");
  const checksumReceiver = getAddress(receiver);
  const rawTermId = termId.startsWith('0x') ? termId : `0x${termId}`;
  const termIdBytes32 = pad(rawTermId as Hex, { size: 32 });
  const walletClient = createWalletClient({
    chain: intuitionTestnet,
    transport: custom((window as any).ethereum),
    account: checksumReceiver,
  });
  const assets = parseEther(amount);
  
  const { request, result } = await publicClient.simulateContract({
    address: MULTI_VAULT_ADDRESS as `0x${string}`,
    abi: MULTI_VAULT_ABI,
    functionName: 'depositBatch',
    account: checksumReceiver,
    args: [checksumReceiver, [termIdBytes32], [BigInt(curveId)], [assets], [0n]],
    value: assets,
  });
  
  const hash = await walletClient.writeContract(request as any);
  const shares = (result as unknown as bigint[])[0]; 
  
  return { hash, shares };
};

export const redeemFromVault = async (sharesAmount: string, termId: string, receiver: string, curveId: number = 0) => {
  if (typeof window === 'undefined' || !(window as any).ethereum) throw new Error("No wallet");
  const checksumReceiver = getAddress(receiver);
  const rawTermId = termId.startsWith('0x') ? termId : `0x${termId}`;
  const termIdBytes32 = pad(rawTermId as Hex, { size: 32 });
  const walletClient = createWalletClient({
    chain: intuitionTestnet,
    transport: custom((window as any).ethereum),
    account: checksumReceiver,
  });
  const shares = parseEther(sharesAmount);
  
  const { request, result } = await publicClient.simulateContract({
    address: MULTI_VAULT_ADDRESS as `0x${string}`,
    abi: MULTI_VAULT_ABI,
    functionName: 'redeemBatch',
    account: checksumReceiver,
    args: [checksumReceiver, [termIdBytes32], [BigInt(curveId)], [shares], [0n]],
  });
  
  const hash = await walletClient.writeContract(request as any);
  const assets = (result as unknown as bigint[])[0];
  
  return { hash, assets };
};

export const publishOpinion = async (
  text: string,
  agentId: string,
  side: "TRUST" | "DISTRUST",
  wallet: string
) => {
  if (!(window as any).ethereum) throw new Error("No wallet");

  const checksumAddress = getAddress(wallet);
  const walletClient = createWalletClient({
    chain: intuitionTestnet,
    transport: custom((window as any).ethereum),
    account: checksumAddress,
  });

  const textHex = stringToHex(text);
  const atomFee = parseEther("0.0001");
  const tripleFee = parseEther("0.0001");

  const commentAtomId = keccak256(textHex);

  const exists = await publicClient.readContract({
    address: MULTI_VAULT_ADDRESS as `0x${string}`,
    abi: MULTI_VAULT_ABI,
    functionName: 'isTermCreated',
    args: [commentAtomId]
  } as unknown as any) as boolean;

  if (!exists) {
    try {
      const { request: atomReq } = await publicClient.simulateContract({
        address: MULTI_VAULT_ADDRESS as `0x${string}`,
        abi: MULTI_VAULT_ABI,
        functionName: 'createAtoms',
        account: checksumAddress,
        args: [[textHex], [atomFee]],
        value: atomFee
      });
      const atomTx = await walletClient.writeContract(atomReq as any);
      await publicClient.waitForTransactionReceipt({ hash: atomTx });
    } catch (e: any) {
      console.warn("Atom creation skipped or failed:", e);
    }
  }

  const subjectId = pad(agentId as Hex, { size: 32 });
  const genericPredHex = stringToHex("HAS_OPINION");
  const predicateId = keccak256(genericPredHex);
  
  const predExists = await publicClient.readContract({
      address: MULTI_VAULT_ADDRESS as `0x${string}`,
      abi: MULTI_VAULT_ABI,
      functionName: 'isTermCreated',
      args: [predicateId]
  } as unknown as any) as boolean;

  if (!predExists) {
      try {
        const { request: predReq } = await publicClient.simulateContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'createAtoms',
            account: checksumAddress,
            args: [[genericPredHex], [atomFee]],
            value: atomFee
        });
        const predTx = await walletClient.writeContract(predReq as any);
        await publicClient.waitForTransactionReceipt({ hash: predTx });
      } catch (e) { console.warn("Predicate creation skipped"); }
  }

  const { request: tripleReq } = await publicClient.simulateContract({
    address: MULTI_VAULT_ADDRESS as `0x${string}`,
    abi: MULTI_VAULT_ABI,
    functionName: 'createTriples',
    account: checksumAddress,
    args: [
      [subjectId],       
      [predicateId],     
      [commentAtomId],   
      [tripleFee]        
    ],
    value: tripleFee
  });
  
  return await walletClient.writeContract(tripleReq as any);
};