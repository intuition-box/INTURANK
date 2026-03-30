/**
 * Arena players: local rankers only (Arena XP > 0) who resolve to an Intuition account identity on Graph.
 * Remote aggregation stays optional via VITE_ARENA_LEADERBOARD_URL in arenaXp sync.
 */
import { getAccountsByIds, resolveIntuitionAccountForWallet } from './graphql';
import { getArenaLeaderboardSource } from './arenaXp';

export interface ArenaPlayerRow {
  rank: number;
  address: string;
  label: string;
  image?: string;
  arenaXp: number;
  duels: number;
  /** Last time this wallet’s arena stats were updated (ms). */
  updatedAt: number;
}

export async function fetchArenaPlayerLeaderboard(): Promise<ArenaPlayerRow[]> {
  const source = getArenaLeaderboardSource();
  if (source.length === 0) return [];

  source.sort((a, b) => b.xp - a.xp);
  const byAddr = new Map(source.map((r) => [r.address.toLowerCase(), r]));
  const addrs = source.map((r) => r.address);

  const graphMap = await getAccountsByIds(addrs);
  const merged: Omit<ArenaPlayerRow, 'rank'>[] = [];

  for (const addr of addrs) {
    const row = byAddr.get(addr.toLowerCase());
    const xp = row?.xp ?? 0;
    if (xp <= 0) continue;
    const id = resolveIntuitionAccountForWallet(addr, graphMap);
    if (!id) continue;
    const label = id.label.length > 48 ? `${id.label.slice(0, 46)}…` : id.label;
    merged.push({
      address: addr,
      label,
      image: id.image,
      arenaXp: xp,
      duels: row?.duels ?? 0,
      updatedAt: row?.updatedAt ?? 0,
    });
  }

  merged.sort((a, b) => b.arenaXp - a.arenaXp);
  return merged.slice(0, 30).map((m, i) => ({ ...m, rank: i + 1 }));
}
