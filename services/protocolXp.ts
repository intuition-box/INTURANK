import {
  PROTOCOL_XP_ADD_TO_LIST,
  PROTOCOL_XP_CREATE_ATOM,
  PROTOCOL_XP_CREATE_CLAIM,
  PROTOCOL_XP_MARKET_ACQUIRE,
  PROTOCOL_XP_SEND_TRUST,
  PROTOCOL_XP_SKILL_TRIPLE,
} from '../constants';
import { toast } from '../components/Toast';
import { playXpChime } from './audio';

export const PROTOCOL_XP_UPDATED_EVENT = 'intrank-protocol-xp-updated';

const STORAGE_KEY = 'intrank-protocol-xp-v4';

const LEGACY_PROTOCOL_XP_KEYS = ['intrank-protocol-xp-v3', 'intrank-protocol-xp-v2', 'intrank-protocol-xp-v1'] as const;

export type ProtocolXpReasonKey =
  | 'market_acquire'
  | 'create_atom'
  | 'create_claim'
  | 'add_to_list'
  | 'send_trust'
  | 'skill_onchain';

type PerAddress = {
  total: number;
  seenHashes: Record<string, true>;
};

type LedgerFile = Record<string, PerAddress>;

function loadLedger(): LedgerFile {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LedgerFile;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLedger(data: LedgerFile): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

/** Drop activity XP ledger (current + legacy keys). */
export function clearProtocolXpLedger(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    for (const k of LEGACY_PROTOCOL_XP_KEYS) window.localStorage.removeItem(k);
    window.dispatchEvent(new CustomEvent(PROTOCOL_XP_UPDATED_EVENT, { detail: {} }));
  } catch {
    /* ignore */
  }
}

/** Cap seen tx hashes per wallet so storage stays bounded. */
function pruneHashes(seen: Record<string, true>, maxKeys = 400): Record<string, true> {
  const keys = Object.keys(seen);
  if (keys.length <= maxKeys) return seen;
  const tail = keys.slice(-maxKeys);
  const next: Record<string, true> = {};
  for (const k of tail) next[k] = true;
  return next;
}

const REASON_LABEL: Record<ProtocolXpReasonKey, string> = {
  market_acquire: 'Market purchase',
  create_atom: 'Atom created',
  create_claim: 'Claim created',
  add_to_list: 'Added to list',
  send_trust: 'TRUST sent',
  skill_onchain: 'Intuition Skill',
};

function emitUpdated(addressLc: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(PROTOCOL_XP_UPDATED_EVENT, {
      detail: { address: addressLc },
    })
  );
}

function postMirrorOptional(opts: {
  address: string;
  total: number;
  delta: number;
  reasonKey: ProtocolXpReasonKey;
  txHash?: string | null;
}): void {
  const url = (import.meta.env.VITE_ARENA_LEADERBOARD_URL as string | undefined)?.trim();
  if (!url) return;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'protocol_xp',
      address: opts.address,
      protocolXpTotal: opts.total,
      protocolXpDelta: opts.delta,
      reason: opts.reasonKey,
      txHash: opts.txHash ?? undefined,
      t: Date.now(),
    }),
  }).catch(() => {});
}

/** Local activity XP total for a wallet (not Arena indexer XP). */
export function getProtocolXpTotal(address: string | null | undefined): number {
  if (!address?.trim()) return 0;
  const lc = address.toLowerCase();
  const ledger = loadLedger();
  return ledger[lc]?.total ?? 0;
}

/**
 * Persist + UX for a qualifying on-chain action. Dedupes by `txHash` when provided.
 * Does not replace Arena XP; combine in UI where you want “total motivating” XP.
 */
export function notifyProtocolXpEarned(opts: {
  address: string | null | undefined;
  amount: number;
  reasonKey: ProtocolXpReasonKey;
  txHash?: string | null;
}): boolean {
  const { address, amount, reasonKey, txHash } = opts;
  if (!address?.trim() || !Number.isFinite(amount) || amount <= 0) return false;

  const addrLc = address.toLowerCase();
  const h = typeof txHash === 'string' && txHash.startsWith('0x') ? txHash.toLowerCase() : null;

  const ledger = loadLedger();
  let entry = ledger[addrLc] ?? { total: 0, seenHashes: {} };

  if (h && entry.seenHashes[h]) {
    return false;
  }

  if (h) {
    entry.seenHashes = { ...entry.seenHashes, [h]: true };
    entry.seenHashes = pruneHashes(entry.seenHashes);
  }

  entry = { ...entry, total: entry.total + Math.floor(amount) };
  ledger[addrLc] = entry;
  saveLedger(ledger);

  playXpChime();
  toast.success(`+${Math.floor(amount)} XP — ${REASON_LABEL[reasonKey]}`);
  emitUpdated(addrLc);
  postMirrorOptional({
    address: addrLc,
    total: entry.total,
    delta: Math.floor(amount),
    reasonKey,
    txHash: h ?? undefined,
  });
  return true;
}

/** Map env-friendly reason strings to canonical XP amounts for Skill / shared call sites. */
export function protocolXpAmountFor(reasonKey: ProtocolXpReasonKey): number {
  switch (reasonKey) {
    case 'market_acquire':
      return PROTOCOL_XP_MARKET_ACQUIRE;
    case 'create_atom':
      return PROTOCOL_XP_CREATE_ATOM;
    case 'create_claim':
      return PROTOCOL_XP_CREATE_CLAIM;
    case 'add_to_list':
      return PROTOCOL_XP_ADD_TO_LIST;
    case 'send_trust':
      return PROTOCOL_XP_SEND_TRUST;
    case 'skill_onchain':
      return PROTOCOL_XP_SKILL_TRIPLE;
    default:
      return 0;
  }
}
