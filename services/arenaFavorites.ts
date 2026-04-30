/** Browser-persisted favorite Arena lists (quick switch + starred lane picker). */

const STORAGE_KEY = 'inturank-arena-favorite-list-ids-v1';

export function loadArenaFavoriteListIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveArenaFavoriteListIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* ignore quota / privacy mode */
  }
}
