import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, Radio, RefreshCw, Users } from 'lucide-react';
import { isAddress } from 'viem';
import { playClick, playHover } from '../services/audio';
import { fetchRecentArenaPortalRankingFeed, type ArenaPortalRankingFeedItem } from '../services/graphql';
import { EXPLORER_URL } from '../constants';
import { subscribeVisibilityAwareInterval } from '../services/visibility';
import { portalListIdFromTermId } from '../services/arenaListsRegistry';

function climbHrefForListTerm(listTermId: string): string {
  const id = /^0x[0-9a-fA-F]{64}$/.test(listTermId) ? portalListIdFromTermId(listTermId) : listTermId;
  return `/climb?list=${encodeURIComponent(id)}`;
}

function formatFeedWhen(blockNumber: number): string {
  if (!blockNumber) return '—';
  return `#${blockNumber.toLocaleString()}`;
}

export type ArenaRankingPulseVariant = 'compact' | 'explorer';

type Props = {
  className?: string;
  /** `explorer` = full-width Climb view; `compact` = slim card (sidebar). */
  variant?: ArenaRankingPulseVariant;
  /** When set, explorer defaults to this wallet’s rows only (toggle expands to everyone on-chain). */
  viewerAddress?: string | null;
};

/**
 * Wispear-style sentence feed for Arena: who ranked what YES/NO on which list (portal triple index).
 * Separate from global Activity — only Arena-shaped portal claims.
 */
const ArenaRankingPulse: React.FC<Props> = ({ className, variant = 'compact', viewerAddress }) => {
  const [items, setItems] = useState<ArenaPortalRankingFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllRankers, setShowAllRankers] = useState(false);

  const fetchLimit = variant === 'explorer' ? 48 : 26;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (variant === 'explorer' && !viewerAddress?.trim() && !showAllRankers) {
        setItems([]);
        return;
      }
      const onlyCreators =
        variant === 'explorer' && viewerAddress?.trim() && !showAllRankers
          ? [viewerAddress.trim()]
          : undefined;
      const rows = await fetchRecentArenaPortalRankingFeed(fetchLimit, { onlyCreators });
      setItems(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load Arena pulse');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchLimit, variant, viewerAddress, showAllRankers]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const stopInterval = subscribeVisibilityAwareInterval(() => void load(), 50_000);
    const onChainUp = () => void load();
    window.addEventListener('inturank-arena-onchain-updated', onChainUp);
    return () => {
      stopInterval();
      window.removeEventListener('inturank-arena-onchain-updated', onChainUp);
    };
  }, [load]);

  const shell =
    variant === 'explorer'
      ? `rounded-[1.75rem] border border-white/[0.09] bg-gradient-to-b from-[#0a1018]/95 to-black/90 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.55)]`
      : `rounded-2xl border border-white/[0.08] bg-black/35 backdrop-blur-sm`;

  const explorerSubtitle =
    variant === 'explorer' && showAllRankers ? (
      <>
        Everyone staking on <span className="text-slate-400 font-medium">portal lists IntuRank shows in Arena</span> — same activity you’d see on the wider Intuition graph for those lists.
      </>
    ) : variant === 'explorer' ? (
      <>
        Your wallet’s YES / NO stakes on{' '}
        <span className="text-slate-400 font-medium">portal lists IntuRank shows in Arena</span>. Toggle “All rankers” to see everyone on-chain for those lists.
      </>
    ) : (
      <>
        Rankings from wallets on <span className="text-slate-400 font-medium">portal lists IntuRank shows in Arena</span>{' '}
        (same live lists as browse). Full sentences here even when the Intuition portal explorer only shows deposits for some NO vaults.
      </>
    );

  return (
    <section
      className={`${shell} overflow-hidden ${className ?? ''}`}
      aria-label={variant === 'explorer' ? 'Arena explorer' : 'Arena ranking pulse'}
    >
      <div className="flex items-start justify-between gap-2 px-3.5 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-white/[0.06]">
        <div className="min-w-0 flex items-start gap-2 sm:gap-3">
          <div
            className={`shrink-0 rounded-lg border border-emerald-500/35 bg-emerald-950/40 flex items-center justify-center ${
              variant === 'explorer' ? 'w-10 h-10 sm:w-11 sm:h-11' : 'w-8 h-8'
            }`}
          >
            <Radio
              className={`text-emerald-400/95 stroke-[2.2] ${variant === 'explorer' ? 'w-5 h-5' : 'w-4 h-4'}`}
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400/90">
              {variant === 'explorer' ? 'Arena explorer' : 'Arena pulse'}
            </p>
            <p className="text-[11px] sm:text-sm text-slate-500 leading-snug mt-0.5 max-w-2xl">{explorerSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {variant === 'explorer' ? (
            <button
              type="button"
              onClick={() => {
                playClick();
                setShowAllRankers((v) => !v);
              }}
              aria-pressed={showAllRankers}
              title={showAllRankers ? 'Show only your wallet' : 'Show all wallets on these lists'}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] transition-colors ${
                showAllRankers
                  ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-200'
                  : 'border-slate-700/90 bg-black/50 text-slate-400 hover:text-emerald-200 hover:border-emerald-500/35'
              }`}
            >
              <Users className="w-3.5 h-3.5 opacity-90" aria-hidden />
              {showAllRankers ? 'All rankers' : 'My rankings'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              playClick();
              void load();
            }}
            className="shrink-0 p-1.5 rounded-lg border border-slate-700/90 bg-black/50 text-slate-500 hover:text-emerald-300 hover:border-emerald-500/35 disabled:opacity-40 transition-colors"
            aria-label="Refresh Arena pulse"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div
        className={`overflow-y-auto overscroll-contain px-3 sm:px-5 py-3 [scrollbar-width:thin] ${
          variant === 'explorer' ? 'max-h-[min(72vh,820px)] min-h-[280px]' : 'max-h-[min(420px,52vh)] py-2'
        }`}
      >
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
            <Loader2 className="w-7 h-7 text-emerald-400/80 animate-spin" />
            <span className="text-[10px] font-semibold uppercase tracking-widest">Pulling rankings…</span>
          </div>
        ) : error ? (
          <p className="text-[11px] text-rose-300/95 px-1 py-4 text-center">{error}</p>
        ) : variant === 'explorer' && !viewerAddress?.trim() && !showAllRankers ? (
          <p className="text-[11px] text-slate-500 px-1 py-6 text-center leading-relaxed">
            Connect your wallet to see your Arena rankings here — or switch to <strong className="text-slate-400">All rankers</strong> to browse chain-wide activity on IntuRank&apos;s portal lists.
          </p>
        ) : items.length === 0 ? (
          <p className="text-[11px] text-slate-500 px-1 py-6 text-center leading-relaxed">
            {variant === 'explorer' && !showAllRankers && viewerAddress?.trim()
              ? 'No indexed stakes from your wallet on these lists yet. After you submit a batch, lines appear when the subgraph syncs — or open All rankers to verify on-chain activity.'
              : 'No indexed Arena rankings yet. Submit a batch on a portal list — lines appear after the subgraph syncs.'}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((row) => (
              <li
                key={`${row.claimTermId}-${row.blockNumber}`}
                className="rounded-xl border border-white/[0.06] bg-slate-950/55 px-2.5 py-2 hover:border-emerald-500/20 transition-colors"
              >
                <p className="text-[11px] leading-snug text-slate-200">
                  {isAddress(row.creatorId as `0x${string}`) ? (
                    <Link
                      to={`/profile/${encodeURIComponent(row.creatorId)}`}
                      onClick={playClick}
                      onMouseEnter={playHover}
                      className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300 hover:from-white hover:to-emerald-200 underline-offset-2 hover:underline"
                    >
                      {row.creatorLabel}
                    </Link>
                  ) : (
                    <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300">
                      {row.creatorLabel}
                    </span>
                  )}{' '}
                  <span className="text-slate-500 font-medium">ranked</span>{' '}
                  <span
                    className={`font-black uppercase text-[10px] px-1.5 py-0.5 rounded-md ${
                      row.support ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/18 text-rose-300'
                    }`}
                  >
                    {row.support ? 'Yes' : 'No'}
                  </span>{' '}
                  <span className="text-slate-500 font-medium">for</span>{' '}
                  <span className="font-semibold text-white">{row.subjectLabel}</span>{' '}
                  <span className="text-slate-500 font-medium">in</span>{' '}
                  <Link
                    to={climbHrefForListTerm(row.listTermId)}
                    onClick={playClick}
                    onMouseEnter={playHover}
                    className="text-intuition-primary font-bold hover:text-white underline-offset-2 hover:underline"
                  >
                    {row.listLabel}
                  </Link>
                </p>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="text-[9px] font-mono text-slate-600">{formatFeedWhen(row.blockNumber)}</span>
                  <a
                    href={EXPLORER_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={playClick}
                    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500 hover:text-cyan-300 transition-colors"
                  >
                    Explorer
                    <ExternalLink className="w-3 h-3 opacity-70" aria-hidden />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default ArenaRankingPulse;
