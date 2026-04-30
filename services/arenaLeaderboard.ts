/**
 * Arena rankers leaderboard: XP aggregated from recent portal-list stakes on the Intuition indexer (bounded scan).
 * Optional `postArenaTotalsMirrorOptional` can mirror rows to your backend; in-app truth remains the subgraph.
 */
import {
  fetchArenaLeaderboardXpRowsFromGraph,
  getAccountsByIds,
  resolveIntuitionAccountForWallet,
} from './graphql';

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

export async function fetchArenaPlayerLeaderboard(): Promise<ArenaPlayerRow[]> {
  const source = await fetchArenaLeaderboardXpRowsFromGraph(4200);
  if (source.length === 0) return [];

  source.sort((a, b) => b.xp - a.xp);
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
        address: addr,
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
      address: addr,
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
