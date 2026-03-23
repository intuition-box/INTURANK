import { createWalletClient, custom, parseEther, type Hex, getAddress } from 'viem';
import type { WriteConfig, ReadConfig, GlobalSearchOptions, SemanticSearchOptions } from '@0xintuition/sdk';
import {
  createAtomFromString,
  createAtomFromThing,
  createTripleStatement,
  getAtomDetails,
  globalSearch,
  semanticSearch,
  intuitionMainnet,
  getMultiVaultAddressFromChainId,
} from '@0xintuition/sdk';
import { publicClient, intuitionChain, getConnectedAccount, getProvider, padTermId, parseProtocolError } from './web3';
import { MULTI_VAULT_ABI, FEE_PROXY_ADDRESS, FEE_PROXY_ABI, LINEAR_CURVE_ID } from '../constants';

/**
 * MultiVault address resolved via the official Intuition SDK.
 * This stays in sync with protocol deployments across networks.
 */
const MULTI_VAULT_ADDRESS: `0x${string}` = getMultiVaultAddressFromChainId(
  intuitionMainnet.id,
) as `0x${string}`;

/**
 * Internal helper to construct a WriteConfig bound to the
 * currently connected browser wallet (MetaMask / EIP-1193).
 */
const getWriteConfig = async (): Promise<WriteConfig | null> => {
  if (typeof window === 'undefined') return null;

  const account = await getConnectedAccount();
  const provider = getProvider();

  if (!account || !provider) return null;

  const walletClient = createWalletClient({
    chain: intuitionChain,
    transport: custom(provider),
    account: account as `0x${string}`,
  });

  const config: WriteConfig = {
    address: MULTI_VAULT_ADDRESS,
    publicClient: publicClient as any,
    walletClient: walletClient as any,
  };

  return config;
};

/**
 * Read-only configuration for protocol helper functions
 * that don't require a signer.
 */
const readConfig: ReadConfig = {
  address: MULTI_VAULT_ADDRESS,
  publicClient: publicClient as any,
};

export const intuitionSdkConfig = {
  chain: intuitionMainnet,
  multiVaultAddress: MULTI_VAULT_ADDRESS,
  readConfig,
};

/**
 * High-level helper to create a plain-text atom from a string.
 *
 * - `text`: the atom's data payload (e.g. "TypeScript", "Vitalik Buterin")
 * - `deposit`: optional TRUST deposit as a decimal string (e.g. "0.01")
 */
export const createStringAtom = async (
  text: string,
  deposit?: string,
) => {
  const config = await getWriteConfig();
  if (!config) throw new Error('Wallet not connected or provider unavailable');

  const depositAmount = deposit ? parseEther(deposit) : 0n;

  return createAtomFromString(config, text, depositAmount);
};

/**
 * Create a rich "Thing" atom with JSON-LD style metadata.
 * This uses the Intuition SDK's IPFS + Pinata integration behind the scenes.
 */
export const createThingAtom = async (
  thing: { name: string; description?: string; image?: string; url?: string },
  deposit: string,
) => {
  const config = await getWriteConfig();
  if (!config) throw new Error('Wallet not connected or provider unavailable');

  const depositAmount = parseEther(deposit);
  return createAtomFromThing(config, thing as any, depositAmount);
};

/**
 * Convenience helper to create a single triple statement:
 * (subject, predicate, object) with an optional TRUST deposit.
 *
 * All IDs should be Intuition atom IDs (termIds, as Hex strings).
 */
export const createSingleTriple = async (
  subjectId: Hex,
  predicateId: Hex,
  objectId: Hex,
  deposit: string,
) => {
  const config = await getWriteConfig();
  if (!config) throw new Error('Wallet not connected or provider unavailable');

  const depositAmount = parseEther(deposit);
  const sId = padTermId(subjectId);
  const pId = padTermId(predicateId);
  const oId = padTermId(objectId);

  // 1. Get base triple cost from MultiVault
  let tripleCost: bigint;
  try {
      tripleCost = await publicClient.readContract({
          address: MULTI_VAULT_ADDRESS,
          abi: MULTI_VAULT_ABI,
          functionName: 'getTripleCost',
      }) as bigint;
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
          args: [1n, depositAmount, tripleCost],
      } as any) as bigint;
  } catch (e) {
      const raw = tripleCost + depositAmount;
      // Use 15% fallback fee to be safe if contract call fails
      totalCost = (raw * 115n) / 100n;
  }

  // Add 10% safety buffer to satisfy proxy fee checks and handle fluctuations
  const valueToSend = (totalCost * 110n) / 100n;

  // 3. Create triple via FeeProxy to support direct funding from wallet
  try {
      const account = getAddress(config.walletClient.account?.address as string);
      const { request } = await publicClient.simulateContract({
          address: FEE_PROXY_ADDRESS as `0x${string}`,
          abi: FEE_PROXY_ABI,
          functionName: 'createTriples',
          account,
          args: [account, [sId], [pId], [oId], [depositAmount], BigInt(LINEAR_CURVE_ID)],
          value: valueToSend,
      } as any);

      return config.walletClient.writeContract(request as any);
  } catch (error: any) {
      const parsed = parseProtocolError(error);
      if (parsed.includes("REVERTED") || parsed.includes("BALANCE") || parsed.includes("FEE")) {
          throw new Error(parsed);
      }
      throw error;
  }
};

/**
 * Read-only helper to fetch full atom metadata from the Intuition API.
 */
export const fetchAtomDetails = async (atomId: Hex) => {
  return getAtomDetails(atomId);
};

/**
 * Text search across atoms, accounts, triples, and collections.
 * Thin wrapper over `globalSearch` from the SDK.
 */
export const searchIntuition = async (
  query: string,
  options: GlobalSearchOptions = {},
) => {
  return globalSearch(query, options);
};

/**
 * Semantic search wrapper. Returns atoms/triples that are
 * embedding-similar to the provided text query.
 */
export const semanticSearchIntuition = async (
  query: string,
  options: SemanticSearchOptions = { limit: 10 },
) => {
  return semanticSearch(query, options);
};

