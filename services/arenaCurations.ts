/**
 * Per-wallet ledger of every Arena YES/NO pick the user has confirmed on-chain through IntuRank.
 * Backed by localStorage, grouped by listId so the Portfolio can render "Curated lists" instantly
 * (subgraph is the source of truth, but this guarantees instant feedback while indexers catch up).
 */

const STORAGE_KEY = 'inturank-arena-curations-v1';
const MAX_PICKS_PER_LIST = 200;
const MAX_LISTS_PER_WALLET = 60;

export type ArenaCurationPick = {
  /** Stable key for de-dupe (composite of listId+itemId+ts on insert). */
  key: string;
  /** Persisted Arena/portal list id (matches getArenaListById ids). */
  listId: string;
  /** Snapshot of the list title when the pick was made (lists rarely rename). */
  listTitle: string;
  /** Item term id (atom). */
  itemId: string;
  /** Snapshot of the item label. */
  itemLabel: string;
  /** Optional image preserved for the panel. */
  itemImage?: string;
  /** YES = membership, NO = counter. */
  support: boolean;
  /** Per-row TRUST size as a string (formatEther output). */
  trustLabel: string;
  /** Submission tx hash (best-effort, may be empty if we lost it). */
  txHash?: string;
  /** Wall-clock millis at confirmation time. */
  ts: number;
};

type WalletFile = Record<string, ArenaCurationPick[]>;

function loadFile(): WalletFile {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as WalletFile;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveFile(data: WalletFile) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

function normalizeWallet(addr: string | null | undefined): string | null {
  const w = addr?.trim().toLowerCase();
  if (!w?.startsWith('0x') || w.length !== 42) return null;
  return w;
}

/** Append picks for a wallet, deduping by composite key and trimming to the max-per-list cap. */
export function recordArenaCurationPicks(
  address: string | null | undefined,
  picks: Omit<ArenaCurationPick, 'key' | 'ts'>[],
  now: number = Date.now(),
): void {
  const wallet = normalizeWallet(address);
  if (!wallet || picks.length === 0) return;

  const file = loadFile();
  const current = Array.isArray(file[wallet]) ? [...file[wallet]!] : [];
  const seenKeys = new Set(current.map((p) => p.key));

  for (const pick of picks) {
    if (!pick.listId || !pick.itemId) continue;
    const key = `${pick.listId}::${pick.itemId}::${now}::${seenKeys.size}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    current.push({ ...pick, key, ts: now });
  }

  // Cap per-list while preserving most-recent picks first.
  const byList = new Map<string, ArenaCurationPick[]>();
  for (const p of current) {
    const arr = byList.get(p.listId) ?? [];
    arr.push(p);
    byList.set(p.listId, arr);
  }
  const trimmed: ArenaCurationPick[] = [];
  for (const arr of byList.values()) {
    arr.sort((a, b) => b.ts - a.ts);
    trimmed.push(...arr.slice(0, MAX_PICKS_PER_LIST));
  }
  trimmed.sort((a, b) => b.ts - a.ts);
  file[wallet] = trimmed;

  // Cap total wallets in the file (oldest dropped).
  const wallets = Object.keys(file);
  if (wallets.length > MAX_LISTS_PER_WALLET) {
    const ranked = wallets
      .map((w) => ({ w, lastTs: Math.max(...(file[w] ?? []).map((p) => p.ts), 0) }))
      .sort((a, b) => b.lastTs - a.lastTs);
    const keep = new Set(ranked.slice(0, MAX_LISTS_PER_WALLET).map((r) => r.w));
    for (const w of wallets) if (!keep.has(w)) delete file[w];
  }

  saveFile(file);
  try {
    window.dispatchEvent(new CustomEvent('inturank-arena-curations-updated'));
  } catch {
    /* ignore */
  }
}

export function getArenaCurationsForWallet(
  address: string | null | undefined,
): ArenaCurationPick[] {
  const wallet = normalizeWallet(address);
  if (!wallet) return [];
  const file = loadFile();
  return Array.isArray(file[wallet]) ? [...file[wallet]!] : [];
}

export type ArenaCurationGroup = {
  listId: string;
  listTitle: string;
  picks: ArenaCurationPick[];
  yesCount: number;
  noCount: number;
  lastTs: number;
};

/** Group a wallet's picks by list, sorted by most-recent activity first. */
export function getArenaCurationGroupsForWallet(
  address: string | null | undefined,
): ArenaCurationGroup[] {
  const picks = getArenaCurationsForWallet(address);
  const groups = new Map<string, ArenaCurationGroup>();
  for (const p of picks) {
    const existing = groups.get(p.listId);
    if (existing) {
      existing.picks.push(p);
      if (p.support) existing.yesCount += 1;
      else existing.noCount += 1;
      existing.lastTs = Math.max(existing.lastTs, p.ts);
      if (p.listTitle && !existing.listTitle) existing.listTitle = p.listTitle;
    } else {
      groups.set(p.listId, {
        listId: p.listId,
        listTitle: p.listTitle || 'Untitled list',
        picks: [p],
        yesCount: p.support ? 1 : 0,
        noCount: p.support ? 0 : 1,
        lastTs: p.ts,
      });
    }
  }
  for (const g of groups.values()) {
    g.picks.sort((a, b) => b.ts - a.ts);
  }
  return [...groups.values()].sort((a, b) => b.lastTs - a.lastTs);
}

export function clearArenaCurationsForWallet(address: string | null | undefined): void {
  const wallet = normalizeWallet(address);
  if (!wallet) return;
  const file = loadFile();
  if (!file[wallet]) return;
  delete file[wallet];
  saveFile(file);
  try {
    window.dispatchEvent(new CustomEvent('inturank-arena-curations-updated'));
  } catch {
    /* ignore */
  }
}
