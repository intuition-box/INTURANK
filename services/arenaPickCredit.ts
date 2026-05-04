import { ARENA_XP_PER_RANK_PICK } from '../constants';

const STORAGE_KEY = 'intrank-arena-pick-count-v1';

type PickCountFile = Record<string, number>;

function loadCounts(): PickCountFile {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PickCountFile;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCounts(data: PickCountFile): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

/** Increment successful on-chain Arena ranking rows for this wallet (vault stakes count as picks). */
export function recordArenaRankingPicks(address: string | null | undefined, pickCount: number): void {
  const w = address?.trim().toLowerCase();
  if (!w?.startsWith('0x') || pickCount <= 0) return;
  const m = loadCounts();
  m[w] = (m[w] ?? 0) + pickCount;
  saveCounts(m);
}

export function getArenaRankingPickCount(address: string | null | undefined): number {
  const w = address?.trim().toLowerCase();
  if (!w?.startsWith('0x')) return 0;
  return loadCounts()[w] ?? 0;
}

/** XP floor from picks submitted from this browser until the indexer attributes portal triples to your wallet. */
export function arenaPickCreditXp(address: string | null | undefined): number {
  return getArenaRankingPickCount(address) * ARENA_XP_PER_RANK_PICK;
}

export function clearArenaPickCreditLedger(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
