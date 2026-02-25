import { createWalletClient, custom, parseEther, type Hex } from 'viem';
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
import { publicClient, intuitionChain, getConnectedAccount, getProvider } from './web3';

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
  thing: Record<string, unknown>,
  deposit: string,
) => {
  const config = await getWriteConfig();
  if (!config) throw new Error('Wallet not connected or provider unavailable');

  const depositAmount = parseEther(deposit);
  return createAtomFromThing(config, thing, depositAmount);
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

  return createTripleStatement(config, {
    args: [
      [subjectId],
      [predicateId],
      [objectId],
      [depositAmount],
    ],
    value: depositAmount,
  });
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
  options?: GlobalSearchOptions,
) => {
  return globalSearch(query, options);
};

/**
 * Semantic search wrapper. Returns atoms/triples that are
 * embedding-similar to the provided text query.
 */
export const semanticSearchIntuition = async (
  query: string,
  options?: SemanticSearchOptions,
) => {
  return semanticSearch(query, options);
};

