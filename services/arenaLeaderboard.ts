/**
 * Arena rankers leaderboard.
 * - Source priority: configured mirror URL → portal-list-scoped subgraph aggregation.
 *   The graph scan is now restricted to portal lists IntuRank surfaces in Arena and re-attributes
 *   FeeProxy/MultiVault batch creators back to the actual depositor (vault `positions` lookup).
 * - Mirror URL: `VITE_ARENA_LEADERBOARD_URL` or `${VITE_INTURANK_API_URL|VITE_EMAIL_API_URL}/api/arena-leaderboard`
 *   returning `{ leaderboard }` or an array.
 * - Opt-out: `VITE_ARENA_USE_GLOBAL_GRAPH_LEADERBOARD=false` → mirror-only (returns []).
 *
 * Portfolio / personal XP still come from subgraph (see graphql); POST mirror from `postArenaTotalsMirrorOptional` is optional telemetry.
 */
import {
  fetchArenaLeaderboardXpRowsFromGraph,
  getAccountsByIds,
  resolveIntuitionAccountForWallet,
} from './graphql';
import { ARENA_USE_GLOBAL_GRAPH_LEADERBOARD, getArenaLeaderboardMirrorUrl } from '../constants';

export interface ArenaPlayerRow {
  rank: number;
  address: string;
  label: string;
  image?: string;
  arenaXp: number;
  duels: number;
  atomsRanked: number;
  listsPlayed: number;
  updatedAt: number;
}

type RawLb = {
  address: string;
  xp: number;
  duels: number;
  atomsRanked: number;
  listsPlayed: number;
  updatedAt: number;
};

function normWallet(a: unknown): string | null {
  const s = String(a ?? '').trim().toLowerCase();
  if (!s.startsWith('0x') || s.length < 6) return null;
  return s;
}

async function fetchArenaLeaderboardMirrorRows(): Promise<RawLb[] | null> {
  const url = getArenaLeaderboardMirrorUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    });
    if (!res.ok) return null;
    const body = await res.json();
    const arr = Array.isArray(body)
      ? body
      : body?.leaderboard ?? body?.rows ?? body?.players ?? body?.data;
    if (!Array.isArray(arr) || arr.length === 0) return null;

    const out: RawLb[] = [];
    for (const row of arr) {
      const addr = normWallet(row?.address ?? row?.wallet ?? row?.id);
      if (!addr) continue;
      const xp = typeof row?.xp === 'number' ? row.xp : Number(row?.xp ?? row?.arenaXp ?? 0);
      if (!Number.isFinite(xp) || xp <= 0) continue;
      const duels = typeof row?.duels === 'number' ? row.duels : Number(row?.duels ?? xp);
      const atomsRanked =
        typeof row?.atomsRanked === 'number' ? row.atomsRanked : Number(row?.atomsRanked ?? row?.atoms ?? duels);
      const listsPlayed =
        typeof row?.listsPlayed === 'number' ? row.listsPlayed : Number(row?.listsPlayed ?? row?.lists ?? 0);
      const updatedAt =
        typeof row?.updatedAt === 'number' ? row.updatedAt : Number(row?.updatedAt ?? row?.t ?? 0);
      out.push({
        address: addr,
        xp: Math.floor(xp),
        duels: Number.isFinite(duels) ? Math.max(0, Math.floor(duels)) : 0,
        atomsRanked: Number.isFinite(atomsRanked) ? Math.max(0, Math.floor(atomsRanked)) : 0,
        listsPlayed: Number.isFinite(listsPlayed) ? Math.max(0, Math.floor(listsPlayed)) : 0,
        updatedAt: Number.isFinite(updatedAt) ? Math.floor(updatedAt) : 0,
      });
    }
    out.sort((a, b) => b.xp - a.xp);
    return out.length ? out : null;
  } catch {
    return null;
  }
}

async function leaderboardSourceRows(): Promise<RawLb[]> {
  const mirror = await fetchArenaLeaderboardMirrorRows();
  if (mirror && mirror.length > 0) return mirror;

  /**
   * Portal-scoped subgraph aggregation is the canonical fallback — it now filters by Arena lists
   * and re-attributes FeeProxy/MultiVault batch creators back to the depositor (vault `positions`
   * lookup). Legacy env flag is kept as a noop reference for migration tracking.
   */
  void ARENA_USE_GLOBAL_GRAPH_LEADERBOARD;
  return fetchArenaLeaderboardXpRowsFromGraph(4200);
}

export async function fetchArenaPlayerLeaderboard(): Promise<ArenaPlayerRow[]> {
  let source = await leaderboardSourceRows();
  if (source.length === 0) return [];

  source = [...source].sort((a, b) => b.xp - a.xp);
  const byAddr = new Map(source.map((r) => [r.address.toLowerCase(), r]));
  const addrs = source.map((r) => r.address);

  const graphMap = await getAccountsByIds(addrs);
  const merged: Omit<ArenaPlayerRow, 'rank'>[] = [];

  for (const addr of addrs) {
    const row = byAddr.get(addr.toLowerCase());
    const xp = row?.xp ?? 0;
    if (xp <= 0 || !row) continue;

    const atomsRanked = row.atomsRanked ?? row.duels;
    const listsPlayed = row.listsPlayed ?? 0;

    const id = resolveIntuitionAccountForWallet(addr, graphMap);
    if (!id) {
      merged.push({
        address: addr.toLowerCase(),
        label: `${addr.slice(0, 6)}…${addr.slice(-4)}`,
        image: `https://effigy.im/a/${addr}.png`,
        arenaXp: xp,
        duels: row.duels,
        atomsRanked,
        listsPlayed,
        updatedAt: row.updatedAt ?? 0,
      });
      continue;
    }
    const label = id.label.length > 48 ? `${id.label.slice(0, 46)}…` : id.label;
    merged.push({
      address: addr.toLowerCase(),
      label,
      image: id.image,
      arenaXp: xp,
      duels: row.duels,
      atomsRanked,
      listsPlayed,
      updatedAt: row.updatedAt ?? 0,
    });
  }

  merged.sort((a, b) => b.arenaXp - a.arenaXp);
  return merged.slice(0, 30).map((m, i) => ({ ...m, rank: i + 1 }));
}
