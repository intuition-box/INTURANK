import React from 'react';
import { ArenaXpToken } from './ArenaXpToken';

/**
 * Single source of truth for the "IntuRank XP" stat across the app.
 *
 * Total = Arena XP (from ranks) + Activity XP (from protocol actions).
 * Three sizes so Profile, Arena and Explorer can share the same numbers without drift.
 */
export type IntuRankXpBadgeSize = 'sm' | 'md' | 'lg';

const SIZE_PRESETS: Record<
  IntuRankXpBadgeSize,
  {
    container: string;
    label: string;
    total: string;
    breakdown: string;
    token: number;
  }
> = {
  sm: {
    container: 'gap-3 rounded-2xl px-3 py-2.5',
    label: 'text-[9px] tracking-[0.2em]',
    total: 'text-xl',
    breakdown: 'text-[9px]',
    token: 28,
  },
  md: {
    container: 'gap-4 rounded-2xl px-4 py-3',
    label: 'text-[10px] tracking-[0.2em]',
    total: 'text-3xl',
    breakdown: 'text-[10px]',
    token: 40,
  },
  lg: {
    container: 'gap-5 rounded-3xl px-5 py-4 sm:px-6 sm:py-5',
    label: 'text-[11px] tracking-[0.22em]',
    total: 'text-4xl sm:text-5xl',
    breakdown: 'text-[11px]',
    token: 56,
  },
};

export interface IntuRankXpBadgeProps {
  /** Arena XP (from ranks). */
  arenaXp: number;
  /** Activity XP (from protocol actions: market buys, sends, claim creation, etc.). */
  activityXp: number;
  size?: IntuRankXpBadgeSize;
  /** Optional rank number from the leaderboard — rendered as a small chip. */
  rank?: number | null;
  /** When true, hides the breakdown line (Arena · Activity). Useful in tight spaces. */
  compact?: boolean;
  className?: string;
  /** Shown when the connected wallet hasn't loaded yet — keeps layout stable. */
  loading?: boolean;
}

export const IntuRankXpBadge: React.FC<IntuRankXpBadgeProps> = ({
  arenaXp,
  activityXp,
  size = 'md',
  rank,
  compact = false,
  className = '',
  loading = false,
}) => {
  const preset = SIZE_PRESETS[size];
  const total = Math.max(0, Math.round((arenaXp || 0) + (activityXp || 0)));
  const showBreakdown = !compact && (arenaXp > 0 || activityXp > 0);

  return (
    <div
      className={`relative flex items-center overflow-hidden border border-intuition-primary/40 ${preset.container} ${className}`}
      style={{
        background:
          'linear-gradient(135deg, rgba(0,243,255,0.08) 0%, rgba(8,15,28,0.85) 55%, rgba(2,6,12,0.95) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 28px rgba(0,243,255,0.12)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 18% 30%, rgba(34,211,238,0.16), transparent 55%), radial-gradient(circle at 80% 80%, rgba(232,197,71,0.06), transparent 65%)',
        }}
        aria-hidden
      />
      <ArenaXpToken size={preset.token} className="relative z-10 shrink-0" />
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`font-mono font-black uppercase text-intuition-primary/90 ${preset.label}`}
            style={{ letterSpacing: '0.18em' }}
          >
            IntuRank XP
          </p>
          {typeof rank === 'number' && rank > 0 ? (
            <span className="inline-flex items-center rounded-md border border-amber-400/45 bg-amber-500/[0.12] px-1.5 py-0.5 text-[8px] font-mono font-black uppercase tracking-widest text-amber-200">
              Rank #{rank}
            </span>
          ) : null}
        </div>
        <p
          className={`font-display font-black tabular-nums tracking-tight text-white leading-none mt-1 ${preset.total}`}
        >
          {loading ? '—' : total.toLocaleString()}
        </p>
        {showBreakdown ? (
          <p className={`font-mono font-semibold text-slate-400 mt-1.5 ${preset.breakdown}`}>
            <span className="text-intuition-primary/85">Arena {arenaXp.toLocaleString()}</span>
            <span className="text-slate-600 mx-1.5">·</span>
            <span className="text-amber-300/85">Activity {activityXp.toLocaleString()}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default IntuRankXpBadge;
