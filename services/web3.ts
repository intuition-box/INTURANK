import { createPublicClient, createWalletClient, custom, http, parseEther, formatEther, pad, getAddress, type Hex, stringToHex, keccak256 } from 'viem';
import { CHAIN_ID, RPC_URL, MULTI_VAULT_ABI, MULTI_VAULT_ADDRESS } from '../constants';
import { Transaction } from '../types';

export const intuitionTestnet = {
  id: CHAIN_ID,
  name: 'Intuition Mainnet',
  network: 'intuition-mainnet',
  nativeCurrency: { decimals: 18, name: 'TRUST', symbol: 'TRUST' },
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

export const getConnectedAccount = async (): Promise<string | null> => {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      const walletClient = createWalletClient({
        chain: intuitionTestnet,
        transport: custom((window as any).ethereum),
      });
      const [address] = await walletClient.getAddresses();
      return address ? getAddress(address) : null;
    } catch { return null; }
  }
  return null;
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
    const curveIdBigInt = BigInt(curveId);

    const shares = await publicClient.readContract({
      address: MULTI_VAULT_ADDRESS as `0x${string}`,
      abi: MULTI_VAULT_ABI,
      functionName: 'getShares',
      args: [checksumAccount, termIdBytes32, curveIdBigInt]
    } as any);
    return formatEther(shares as unknown as bigint);
  } catch (e) { return "0"; }
};

// --- NEW: Fetch Protocol Config (Min Deposit) ---
export const getProtocolConfig = async () => {
  try {
    const config = await publicClient.readContract({
      address: MULTI_VAULT_ADDRESS as `0x${string}`,
      abi: MULTI_VAULT_ABI,
      functionName: 'generalConfig',
    }) as any;
    
    // Config struct from ABI: 
    // [admin, protocolMultisig, feeDenominator, trustBonding, minDeposit, minShare, atomDataMaxLength, feeThreshold]
    // minDeposit is at index 4
    const minDeposit = config[4] || config.minDeposit;
    return {
      minDeposit: formatEther(minDeposit),
      minDepositWei: minDeposit
    };
  } catch (e) {
    console.warn("Failed to fetch protocol config", e);
    // Fallback safe default of 0.001 TRUST if fetch fails
    return { minDeposit: "0.001", minDepositWei: parseEther("0.001") }; 
  }
};

export const connectWallet = async (): Promise<string | null> => {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      const walletClient = createWalletClient({
        chain: intuitionTestnet,
        transport: custom((window as any).ethereum),
      });
      const [address] = await walletClient.requestAddresses();
      try { await walletClient.switchChain({ id: intuitionTestnet.id }); } 
      catch (e) { await walletClient.addChain({ chain: intuitionTestnet }); }
      return address ? getAddress(address) : null;
    } catch (error) {
      console.error("Wallet connection failed:", error);
      return null; 
    }
  } else { 
    alert("Please install a wallet like MetaMask."); 
    return null; 
  }
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
  const curveIdBigInt = BigInt(curveId);
  
  // Simulate to catch errors like DepositBelowMinimum
  const { request, result } = await publicClient.simulateContract({
    address: MULTI_VAULT_ADDRESS as `0x${string}`,
    abi: MULTI_VAULT_ABI,
    functionName: 'depositBatch',
    account: checksumReceiver,
    args: [checksumReceiver, [termIdBytes32], [curveIdBigInt], [assets], [0n]],
    value: assets,
  });
  
  const hash = await walletClient.writeContract(request);
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
  const curveIdBigInt = BigInt(curveId);
  
  const { request, result } = await publicClient.simulateContract({
    address: MULTI_VAULT_ADDRESS as `0x${string}`,
    abi: MULTI_VAULT_ABI,
    functionName: 'redeemBatch',
    account: checksumReceiver,
    args: [checksumReceiver, [termIdBytes32], [curveIdBigInt], [shares], [0n]],
  });
  
  const hash = await walletClient.writeContract(request);
  const assets = (result as unknown as bigint[])[0];
  
  return { hash, assets };
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

export const switchNetwork = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    const walletClient = createWalletClient({
        chain: intuitionTestnet,
        transport: custom((window as any).ethereum),
    });
    try {
        await walletClient.switchChain({ id: intuitionTestnet.id });
    } catch (e) {
        try {
            await walletClient.addChain({ chain: intuitionTestnet });
        } catch (addError) {
            console.error("Failed to add chain", addError);
        }
    }
};

// --- ROBUST CHECK-OR-CREATE PATTERN FOR OPINIONS ---
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

  // 1. Fetch Protocol Config (Dynamic Min Deposit)
  const config = await getProtocolConfig();
  const baseFee = config.minDepositWei;

  // 2. Prepare Data
  const textHex = stringToHex(text);
  
  // 3. Deterministic ID Check (Hash of data)
  const commentAtomId = keccak256(textHex);

  // 4. Check if Exists On-Chain
  const exists = await publicClient.readContract({
    address: MULTI_VAULT_ADDRESS as `0x${string}`,
    abi: MULTI_VAULT_ABI,
    functionName: 'isTermCreated',
    args: [commentAtomId]
  }) as boolean;

  // 5. Create Atom if needed (Idempotent)
  if (!exists) {
    try {
      const { request: atomReq } = await publicClient.simulateContract({
        address: MULTI_VAULT_ADDRESS as `0x${string}`,
        abi: MULTI_VAULT_ABI,
        functionName: 'createAtoms',
        account: checksumAddress,
        args: [[textHex], [baseFee]],
        value: baseFee // Send minDeposit
      });
      const atomTx = await walletClient.writeContract(atomReq);
      await publicClient.waitForTransactionReceipt({ hash: atomTx });
    } catch (e: any) {
      console.warn("Atom creation skipped or failed (likely exists or parallel tx):", e);
    }
  }

  // 6. Create Triple (Agent -> HAS_OPINION -> Comment)
  const subjectId = pad(agentId as Hex, { size: 32 });
  const genericPredHex = stringToHex("HAS_OPINION");
  const predicateId = keccak256(genericPredHex);
  
  // Check predicate existence
  const predExists = await publicClient.readContract({
      address: MULTI_VAULT_ADDRESS as `0x${string}`,
      abi: MULTI_VAULT_ABI,
      functionName: 'isTermCreated',
      args: [predicateId]
  }) as boolean;

  if (!predExists) {
      try {
        const { request: predReq } = await publicClient.simulateContract({
            address: MULTI_VAULT_ADDRESS as `0x${string}`,
            abi: MULTI_VAULT_ABI,
            functionName: 'createAtoms',
            account: checksumAddress,
            args: [[genericPredHex], [baseFee]],
            value: baseFee
        });
        const predTx = await walletClient.writeContract(predReq);
        await publicClient.waitForTransactionReceipt({ hash: predTx });
      } catch (e) { console.warn("Predicate creation skipped"); }
  }

  // Finally create the Triple link
  // The 'InsufficientBalance' error happened here previously because value < minDeposit
  const { request: tripleReq } = await publicClient.simulateContract({
    address: MULTI_VAULT_ADDRESS as `0x${string}`,
    abi: MULTI_VAULT_ABI,
    functionName: 'createTriples',
    account: checksumAddress,
    args: [
      [subjectId],       
      [predicateId],     
      [commentAtomId],   
      [baseFee]        
    ],
    value: baseFee // Must match minDeposit
  });
  
  return await walletClient.writeContract(tripleReq);
};