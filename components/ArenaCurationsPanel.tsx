import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ListChecks, Sparkles, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react';
import {
  getArenaCurationGroupsForWallet,
  type ArenaCurationGroup,
} from '../services/arenaCurations';
import { playClick, playHover } from '../services/audio';

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function formatRelative(ts: number, now: number): string {
  const diffMs = ts - now;
  const absMs = Math.abs(diffMs);
  if (absMs < 60_000) return RELATIVE_FORMAT.format(Math.round(diffMs / 1000), 'second');
  if (absMs < 3_600_000) return RELATIVE_FORMAT.format(Math.round(diffMs / 60_000), 'minute');
  if (absMs < 86_400_000) return RELATIVE_FORMAT.format(Math.round(diffMs / 3_600_000), 'hour');
  return RELATIVE_FORMAT.format(Math.round(diffMs / 86_400_000), 'day');
}

function CurationListCard({
  group,
  expanded,
  onToggle,
}: {
  group: ArenaCurationGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  const now = Date.now();
  const total = group.picks.length;
  const top = expanded ? group.picks : group.picks.slice(0, 4);
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-slate-950/85 via-black to-black shadow-[0_18px_42px_rgba(0,0,0,0.55)] transition-colors hover:border-intuition-primary/30"
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_top_left,rgba(0,243,255,0.08),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(232,197,71,0.08),transparent_55%)]" />
      <div className="relative z-10 p-4 sm:p-5">
        <div className="flex flex-nowrap items-start justify-between gap-2 sm:gap-3 mb-3 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black font-mono text-intuition-primary/85 uppercase tracking-[0.28em] mb-1">
              List · curated by you
            </p>
            <p className="text-base sm:text-lg font-black text-white tracking-tight truncate" title={group.listTitle}>
              {group.listTitle}
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-1">
              Last pick {formatRelative(group.lastTs, now)} · {total} pick{total === 1 ? '' : 's'}
            </p>
          </div>
          <Link
            to={`/climb?list=${encodeURIComponent(group.listId)}`}
            onClick={() => playClick()}
            onMouseEnter={playHover}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.18em] text-slate-300 hover:border-intuition-primary/40 hover:text-intuition-primary transition-colors whitespace-nowrap"
          >
            Open in Arena
            <ExternalLink size={11} />
          </Link>
        </div>
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
            <ThumbsUp size={11} />
            Yes {group.yesCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/[0.08] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
            <ThumbsDown size={11} />
            No {group.noCount}
          </span>
        </div>
        <div className="space-y-1.5">
          {top.map((pick) => (
            <div
              key={pick.key}
              className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/40 px-2.5 py-1.5"
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-black text-[9px] uppercase shrink-0 ${
                  pick.support
                    ? 'border border-emerald-500/40 bg-emerald-500/[0.15] text-emerald-300'
                    : 'border border-rose-500/40 bg-rose-500/[0.15] text-rose-300'
                }`}
                aria-label={pick.support ? 'YES' : 'NO'}
              >
                {pick.support ? 'Y' : 'N'}
              </span>
              <span className="text-[12px] text-slate-200 truncate flex-1" title={pick.itemLabel}>
                {pick.itemLabel}
              </span>
              <span className="text-[10px] font-mono tabular-nums text-slate-500 shrink-0">
                {pick.trustLabel} TRUST
              </span>
              {pick.txHash ? (
                <a
                  href={`https://intuition.explorer.caldera.xyz/tx/${pick.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-600 hover:text-intuition-primary transition-colors shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  title="View on explorer"
                >
                  <ExternalLink size={12} />
                </a>
              ) : null}
            </div>
          ))}
        </div>
        {total > 4 ? (
          <button
            type="button"
            onClick={() => {
              playClick();
              onToggle();
            }}
            onMouseEnter={playHover}
            className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-intuition-primary transition-colors"
          >
            {expanded ? 'Collapse' : `Show all ${total}`}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const ArenaCurationsPanel: React.FC<{ address: string | null | undefined }> = ({ address }) => {
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const handler = () => setTick((n) => n + 1);
    window.addEventListener('inturank-arena-curations-updated', handler);
    window.addEventListener('inturank-arena-onchain-updated', handler);
    return () => {
      window.removeEventListener('inturank-arena-curations-updated', handler);
      window.removeEventListener('inturank-arena-onchain-updated', handler);
    };
  }, []);

  const groups = useMemo(() => getArenaCurationGroupsForWallet(address), [address, tick]);

  if (!address) return null;
  if (groups.length === 0) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-black/65 px-5 sm:px-6 py-6 sm:py-7 shadow-[0_18px_46px_rgba(0,0,0,0.55)] flex flex-row flex-nowrap items-center gap-3 sm:gap-4 min-w-0">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-intuition-primary/10 border border-intuition-primary/20 shrink-0">
          <ListChecks className="w-5 h-5 text-intuition-primary" strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-[0.28em] mb-1">
            Curated lists · empty
          </p>
          <p className="text-sm sm:text-base text-slate-200 font-bold leading-snug">
            Your YES / NO picks land here once you confirm them in the Arena.
          </p>
        </div>
        <Link
          to="/climb"
          onClick={() => playClick()}
          onMouseEnter={playHover}
          className="inline-flex items-center gap-2 rounded-xl bg-intuition-primary px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.22em] text-black shadow-[0_0_24px_rgba(0,243,255,0.35)] hover:bg-white transition-colors shrink-0"
        >
          <Sparkles size={13} />
          Rank a list
        </Link>
      </div>
    );
  }

  const visibleGroups = showAll ? groups : groups.slice(0, 4);
  const totalPicks = groups.reduce((sum, g) => sum + g.picks.length, 0);

  return (
    <div className="bg-black border border-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
      <div className="px-4 sm:px-5 md:px-6 xl:px-8 py-4 sm:py-5 md:py-6 border-b border-slate-900 bg-white/[0.03] flex flex-row flex-nowrap items-center justify-between gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-intuition-primary/10 border border-intuition-primary/20 shrink-0">
            <ListChecks className="w-4 h-4 sm:w-5 sm:h-5 text-intuition-primary" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-white font-display uppercase tracking-[0.2em]">
              Curated Lists
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-wider mt-0.5">
              {groups.length} list{groups.length === 1 ? '' : 's'} · {totalPicks} confirmed pick{totalPicks === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Link
          to="/climb?view=explorer"
          onClick={() => playClick()}
          onMouseEnter={playHover}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-700 bg-black/50 px-2.5 py-2 sm:px-3 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.22em] text-slate-300 hover:border-intuition-primary/40 hover:text-intuition-primary transition-colors whitespace-nowrap"
        >
          See in Explorer
          <ExternalLink size={11} />
        </Link>
      </div>
      <div className="p-4 sm:p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visibleGroups.map((g) => (
          <CurationListCard
            key={g.listId}
            group={g}
            expanded={expanded.has(g.listId)}
            onToggle={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(g.listId)) next.delete(g.listId);
                else next.add(g.listId);
                return next;
              })
            }
          />
        ))}
      </div>
      {groups.length > 4 ? (
        <div className="px-4 sm:px-5 md:px-6 pb-5 flex justify-center">
          <button
            type="button"
            onClick={() => {
              playClick();
              setShowAll((v) => !v);
            }}
            onMouseEnter={playHover}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-intuition-primary/30 hover:text-intuition-primary transition-colors"
          >
            {showAll ? 'Show fewer lists' : `Show all ${groups.length} lists`}
            {showAll ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default ArenaCurationsPanel;
