/**
 * IntuRank Badge System — Gamified profile ranks
 * Badge tiers: Apex (1st), Elite (2nd), Rising (3rd), Scout (4th+)
 */
import { getPnlLeaderboardPeriodAccount, buildPnlLeaderboardPeriodArgs } from './graphql';
import { getTopPositions } from './graphql';
import { formatEther } from 'viem';
import { getResolvedSeason2EpochForNow } from '../constants';

const normalize = (x: string) => (x ? x.toLowerCase() : '');

export type BadgeTier = 'apex' | 'elite' | 'rising' | 'scout';

export const BADGE_NAMES: Record<BadgeTier, string> = {
  apex: 'Apex',
  elite: 'Elite',
  rising: 'Rising',
  scout: 'Scout',
};

export const BADGE_COLORS: Record<BadgeTier, string> = {
  apex: 'amber',
  elite: 'slate',
  rising: 'amber',
  scout: 'slate',
};

export function getTierForRank(rank: number): BadgeTier {
  if (rank <= 1) return 'apex';
  if (rank <= 2) return 'elite';
  if (rank <= 3) return 'rising';
  return 'scout';
}

export interface LeaderboardRank {
  leaderboard: string;
  rank: number;
  tier: BadgeTier;
}

export interface UserBadges {
  bestTier: BadgeTier;
  bestRank: number | null;
  ranks: LeaderboardRank[];
}

/** Fetches user's rank across leaderboards. Returns best tier and all ranks. */
export async function getUserLeaderboardRanks(address: string): Promise<UserBadges> {
  const addr = normalize(address);
  const ranks: LeaderboardRank[] = [];

  // 1. PnL Season 2 (current epoch)
  const currentEpoch = getResolvedSeason2EpochForNow();
  try {
    const args = buildPnlLeaderboardPeriodArgs(currentEpoch.start, currentEpoch.end);
    const pnlRow = await getPnlLeaderboardPeriodAccount(address, args);
    if (pnlRow?.rank != null) {
      ranks.push({
        leaderboard: `PnL · ${currentEpoch.label}`,
        rank: pnlRow.rank,
        tier: getTierForRank(pnlRow.rank),
      });
    }
  } catch {
    // ignore
  }

  // 2. Top stakers (global)
  try {
    const positions = await getTopPositions(1500);
    const userMap = new Map<string, number>();
    positions.forEach((pos: any) => {
      const accId = pos.account_id;
      if (!accId) return;
      const shares = BigInt(pos.shares || '0');
      const vaultAssets = BigInt(pos.vault?.total_assets || '0');
      const vaultShares = BigInt(pos.vault?.total_shares || '1');
      const valueWei = vaultShares > 0n ? (shares * vaultAssets) / vaultShares : 0n;
      const valueEth = parseFloat(formatEther(valueWei));
      const current = userMap.get(accId) || 0;
      userMap.set(accId, current + valueEth);
    });
    const sorted = Array.from(userMap.entries()).sort((a, b) => b[1] - a[1]);
    const idx = sorted.findIndex(([id]) => normalize(id) === addr);
    if (idx >= 0) {
      ranks.push({
        leaderboard: 'Top Stakers',
        rank: idx + 1,
        tier: getTierForRank(idx + 1),
      });
    }
  } catch {
    // ignore
  }

  // Best tier = highest rank (lowest number)
  const bestRankEntry = ranks.length > 0 ? ranks.reduce((a, b) => (a.rank < b.rank ? a : b)) : null;
  const bestRank = bestRankEntry?.rank ?? null;
  const bestTier = bestRankEntry ? getTierForRank(bestRankEntry.rank) : 'scout';

  return { bestTier, bestRank, ranks };
}
