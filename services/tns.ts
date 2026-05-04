/**
 * Trust Name Service (.trust) — Intuition mainnet naming layer (@samoris/tns-sdk).
 * Display priority: TNS (on-chain reverse + subgraph `.trust`) → ENS → full checksummed wallet address.
 *
 * Intuition RPC endpoints often omit or delay `eth_chainId`; ethers v6 JsonRpcProvider then fails to start unless we pin
 * chain 1155 with `{ staticNetwork }`. Without that, `lookupAddress` / `resolve` silently fail and the UI falls back to hex.
 */
import {
  CONTRACT_ADDRESSES,
  TNS_REGISTRY_ABI,
  TNS_RESOLVER_ABI,
  namehash,
  normalise,
  toFullName,
  TNSClient,
} from '@samoris/tns-sdk';
import { Contract, JsonRpcProvider, Network, ZeroAddress } from 'ethers';
import { getAddress, isAddress } from 'viem';
import { CHAIN_ID, RPC_URL } from '../constants';
import {
  getAccountsByIds,
  getAccountTrustNameLabelForWallet,
  resolveIntuitionAccountForWallet,
  searchAccountsByLabelSuggest,
} from './graphql';
import {
  isGraphResolvableAddress,
  resolveENS,
  reverseResolveENS,
  toAddress,
} from './web3';

let client: TNSClient | null = null;

const intuitionStaticNetwork = Network.from(CHAIN_ID);

function createTNSReadProvider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL, intuitionStaticNetwork, {
    staticNetwork: intuitionStaticNetwork,
  });
}

export function getTNSClient(): TNSClient {
  if (!client) {
    client = new TNSClient({ provider: createTNSReadProvider() });
  }
  return client;
}

/**
 * Canonical `label.trust` from user input (`SAMORIS.TRUST`, `samoris`, etc.).
 * Returns null if the string is not shaped like a TNS query (e.g. ENS-only).
 */
export function canonicalTrustFullName(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.toLowerCase().endsWith('.eth')) return null;
  const lower = raw.toLowerCase();
  if (raw.includes('.') && !lower.endsWith('.trust')) return null;

  const labelPart = lower.endsWith('.trust') ? raw.slice(0, raw.length - '.trust'.length) : raw;
  const label = normalise(labelPart);
  if (!label || !/^[a-z0-9-]+$/.test(label)) return null;
  return toFullName(label);
}

const TRUST_PRIMARY_HINT_PREFIX = 'inturank_tns_primary_v1:';

/** Dispatched when session TNS hint updates so header chrome refetches labels without remounting the wallet. */
export const TRUST_DISPLAY_UPDATED_EVENT = 'inturank-trust-display-updated';

/** Remember a `.trust` search selection so `/profile/0x…` can show the name before reverse records sync. */
export function rememberTrustNameForProfile(walletChecksum: string, trustQuery: string): void {
  const full = canonicalTrustFullName(trustQuery);
  if (!full) return;
  let keys = walletChecksum.trim();
  try {
    keys = getAddress(walletChecksum.trim() as `0x${string}`);
  } catch {
    /* keep trimmed raw */
  }
  try {
    sessionStorage.setItem(TRUST_PRIMARY_HINT_PREFIX + keys.toLowerCase(), full);
  } catch {
    /* quota / private mode */
  }
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(TRUST_DISPLAY_UPDATED_EVENT, { detail: { address: keys } }));
  } catch {
    /* ignore */
  }
}

function readStoredTrustPrimaryHint(walletChecksum: string): string | null {
  try {
    return sessionStorage.getItem(TRUST_PRIMARY_HINT_PREFIX + walletChecksum.toLowerCase());
  } catch {
    return null;
  }
}

/**
 * Resolve a `.trust` name to a wallet: resolver `addr` record first, then **registry owner**
 * (many registrations exist without `addr` set yet — `resolve()` alone returns null).
 */
export async function resolveTrustNameToAddress(rawInput: string): Promise<string | null> {
  const full = canonicalTrustFullName(rawInput);
  if (!full) return null;

  try {
    const viaAddr = await getTNSClient().resolve(full);
    if (viaAddr && isAddress(viaAddr)) return getAddress(viaAddr as `0x${string}`);
  } catch {
    /* ignore */
  }

  try {
    const node = namehash(full);
    const registry = new Contract(CONTRACT_ADDRESSES.registry, TNS_REGISTRY_ABI, createTNSReadProvider());
    const owner: string = await registry.owner(node);
    if (
      owner &&
      typeof owner === 'string' &&
      owner.toLowerCase() !== ZeroAddress.toLowerCase()
    ) {
      return getAddress(owner as `0x${string}`);
    }
  } catch {
    /* ignore */
  }

  return null;
}

/** Subgraph `accounts.label` when it’s useful for display (not redundant hex / “Trader 0x…” placeholders). */
function graphPreferredWalletLabel(lab: string | undefined | null): string | null {
  const t = lab?.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.endsWith('.trust')) return t;
  if (/^0x[a-f0-9]{40}$/i.test(t)) return null;
  if (/^trader\s+0x/i.test(lower)) return null;
  const collapsed = t.replace(/…/g, '...');
  if (/^0x[a-f0-9]{4,12}\.{3}[a-f0-9]{4}$/i.test(collapsed)) return null;
  if (/^0x[a-f0-9]{6}\.{3}[a-f0-9]{4}$/i.test(collapsed)) return null;
  if (t.length < 3) return null;
  return t;
}

async function resolveWalletLabelFromGraph(walletAddress: string): Promise<string | null> {
  try {
    const map = await getAccountsByIds([walletAddress]);
    const hit = resolveIntuitionAccountForWallet(walletAddress, map);
    return graphPreferredWalletLabel(hit?.label ?? null);
  } catch {
    return null;
  }
}

/** Reverse lookup: wallet → primary `.trust` name, or null. */
export async function reverseResolveTNS(walletAddress: string): Promise<string | null> {
  try {
    const chk = getAddress(walletAddress.trim() as `0x${string}`);
    const strict = await getTNSClient().lookupAddress(chk);
    if (typeof strict === 'string' && strict.toLowerCase().endsWith('.trust')) return strict;
    return await reverseTrustWhenAddrUnsetButReverseAndOwnerMatch(chk);
  } catch {
    return null;
  }
}

/**
 * SDK `lookupAddress` requires resolver addr(forward) === wallet. Many names only set reverse + NFT ownership.
 * If reverse record names a `.trust` node whose **registry owner** is this wallet, treat it as primary.
 */
async function reverseTrustWhenAddrUnsetButReverseAndOwnerMatch(walletAddress: string): Promise<string | null> {
  try {
    const chk = getAddress(walletAddress.trim() as `0x${string}`);
    const reverseNode = namehash(`${chk.toLowerCase().slice(2)}.addr.reverse`);
    const registry = new Contract(CONTRACT_ADDRESSES.registry, TNS_REGISTRY_ABI, createTNSReadProvider());
    const resolverAddr: string = await registry.resolver(reverseNode);
    if (!resolverAddr || resolverAddr.toLowerCase() === ZeroAddress.toLowerCase()) return null;

    const resolver = new Contract(resolverAddr, TNS_RESOLVER_ABI, createTNSReadProvider());
    const nameStr: string = await resolver.name(reverseNode);
    if (!nameStr || typeof nameStr !== 'string') return null;
    const full = canonicalTrustFullName(nameStr);
    if (!full) return null;

    const forwardNode = namehash(full);
    const owner: string = await registry.owner(forwardNode);
    if (!owner || owner.toLowerCase() === ZeroAddress.toLowerCase()) return null;
    if (owner.toLowerCase() !== chk.toLowerCase()) return null;

    return full;
  } catch {
    return null;
  }
}

export async function walletDisplayMeta(walletAddress: string | null | undefined): Promise<{
  primaryLabel: string;
  /** True when label is a registered TNS or ENS name (UI may show raw address as subtitle). */
  isNamed: boolean;
}> {
  if (!walletAddress?.trim()) return { primaryLabel: '', isNamed: false };
  try {
    const chk = getAddress(walletAddress.trim() as `0x${string}`);

    const hintedFirst = readStoredTrustPrimaryHint(chk);
    if (hintedFirst) {
      const ownerAddr = await resolveTrustNameToAddress(hintedFirst);
      if (ownerAddr?.toLowerCase() === chk.toLowerCase()) {
        const label = canonicalTrustFullName(hintedFirst) ?? hintedFirst;
        return { primaryLabel: label, isNamed: true };
      }
    }

    const tns = await reverseResolveTNS(chk);
    if (tns) {
      try {
        sessionStorage.setItem(TRUST_PRIMARY_HINT_PREFIX + chk.toLowerCase(), tns);
      } catch {
        /* ignore */
      }
      return { primaryLabel: tns, isNamed: true };
    }

    const trustTagged = await getAccountTrustNameLabelForWallet(chk);
    if (trustTagged?.toLowerCase().endsWith('.trust')) {
      return { primaryLabel: trustTagged, isNamed: true };
    }

    const ens = await reverseResolveENS(chk);
    if (ens) return { primaryLabel: ens, isNamed: true };

    const graphTrust = await resolveWalletLabelFromGraph(chk);
    if (graphTrust?.toLowerCase().endsWith('.trust')) {
      return { primaryLabel: graphTrust, isNamed: true };
    }

    return { primaryLabel: chk, isNamed: false };
  } catch {
    try {
      const chk = getAddress(walletAddress.trim() as `0x${string}`);
      return { primaryLabel: chk, isNamed: false };
    } catch {
      const s = walletAddress.trim();
      return {
        primaryLabel: s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s,
        isNamed: false,
      };
    }
  }
}

/** Single string for badges / sentences (TNS → ENS → full checksummed wallet). */
export async function bestWalletDisplayLabel(walletAddress: string | null | undefined): Promise<string> {
  const m = await walletDisplayMeta(walletAddress);
  return m.primaryLabel;
}

/**
 * Profile / command search: `0x…`, `name.trust`, bare trust labels (SDK resolves), or `name.eth` via ENS.
 */
export async function resolveProfileSearchInput(query: string): Promise<{ address: string | null; error?: string }> {
  const q = query.trim();
  if (!q) return { address: null, error: 'Enter an address or name' };

  try {
    if (isAddress(q)) return { address: getAddress(q as `0x${string}`) };
  } catch {
    return { address: null, error: 'Invalid address' };
  }

  if (q.toLowerCase().endsWith('.eth')) {
    const resolved = await resolveENS(q);
    if (!resolved) return { address: null, error: 'ENS name not found' };
    const t = toAddress(resolved);
    if (t && isGraphResolvableAddress(t)) {
      try {
        return { address: getAddress(t as `0x${string}`) };
      } catch {
        return { address: null, error: 'ENS resolved to an invalid address' };
      }
    }
    return { address: null, error: 'ENS did not resolve to a valid address' };
  }

  const trustResolved = await resolveTrustNameToAddress(q);
  if (trustResolved) return { address: trustResolved };

  try {
    const resolved = await getTNSClient().resolveName(q);
    if (resolved && isAddress(resolved)) return { address: getAddress(resolved as `0x${string}`) };
  } catch {
    /* ignore */
  }

  try {
    const matches = await searchAccountsByLabelSuggest(q);
    for (const m of matches || []) {
      const id = m?.id?.trim();
      if (id && isAddress(id)) {
        try {
          return { address: getAddress(id as `0x${string}`) };
        } catch {
          /* next */
        }
      }
    }
  } catch {
    /* ignore */
  }

  return { address: null, error: 'Could not resolve. Try a full address, name.trust, or name.eth.' };
}

/** Resolve follow / notification identity: hex address, `.trust`, `.eth`, or SDK bare trust label. */
export async function resolveFollowIdentityToAddress(identityId: string): Promise<string | null> {
  const raw = identityId.trim();
  if (!raw) return null;

  const direct = toAddress(raw);
  if (direct && isGraphResolvableAddress(direct)) {
    try {
      return getAddress(direct as `0x${string}`);
    } catch {
      return direct;
    }
  }

  try {
    if (!raw.toLowerCase().endsWith('.eth')) {
      const tTrust = await resolveTrustNameToAddress(raw);
      if (tTrust) return tTrust;
      const n = await getTNSClient().resolveName(raw);
      if (n && isAddress(n)) return getAddress(n as `0x${string}`);
    }
  } catch {
    /* ignore */
  }

  if (raw.toLowerCase().endsWith('.eth')) {
    const e = await resolveENS(raw);
    if (!e) return null;
    const t = toAddress(e);
    if (t && isGraphResolvableAddress(t)) {
      try {
        return getAddress(t as `0x${string}`);
      } catch {
        return t;
      }
    }
    if (isGraphResolvableAddress(e)) {
      try {
        return getAddress(e as `0x${string}`);
      } catch {
        return e;
      }
    }
  }

  return null;
}
