const STORAGE_KEY = 'inturank-arena-pending-v1';

/** Row shape stored for batch review (matches `RankItem` fields we need on-chain/offline). */
export type ArenaPendingRow = {
  key: string;
  item: {
    id: string;
    kind: 'claim' | 'atom' | 'token';
    label: string;
    subtitle?: string;
    image?: string;
    imageSecondary?: string;
    versusLeftLabel?: string;
    versusRightLabel?: string;
    pairKind: string;
  };
  support: boolean;
  /** Integer ≥1; multiplies the session stake TRUST for this row */
  units: number;
};

type Store = Record<string, ArenaPendingRow[] | undefined>;

function readStore(): Store {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Store;
    }
    const legacy = parsed as { theme?: string; rows?: unknown };
    if (legacy?.theme && Array.isArray(legacy.rows)) {
      const t = String(legacy.theme);
      return { [t]: legacy.rows as ArenaPendingRow[] };
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeStore(s: Store) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Pending batch rows for the current Arena list (`listId` from `arenaListsRegistry`). */
export function loadPendingForList(listId: string): ArenaPendingRow[] {
  if (!listId) return [];
  const rows = readStore()[listId];
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (r) => r && typeof r === 'object' && r.key && r.item && typeof r.units === 'number'
  ) as ArenaPendingRow[];
}

export function savePendingForList(listId: string, rows: ArenaPendingRow[]) {
  if (!listId) return;
  const all = readStore();
  all[listId] = rows;
  writeStore(all);
}

export function clearPendingStorage() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearPendingForList(listId: string) {
  if (!listId) return;
  const all = readStore();
  delete all[listId];
  writeStore(all);
}

/** Total queued stances across all lists (for global FAB). */
export function getTotalPendingCount(): number {
  const s = readStore();
  let n = 0;
  for (const rows of Object.values(s)) {
    if (Array.isArray(rows)) n += rows.length;
  }
  return n;
}

/** Prefer the list with the most queued rows (tie: first in key order). */
export function getFirstListIdWithPending(): string | null {
  const s = readStore();
  let bestId: string | null = null;
  let bestN = 0;
  for (const [id, rows] of Object.entries(s)) {
    const n = Array.isArray(rows) ? rows.length : 0;
    if (n > bestN) {
      bestN = n;
      bestId = id;
    }
  }
  return bestId;
}
