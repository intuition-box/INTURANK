import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Loader2, Trophy } from 'lucide-react';
import { formatEther } from 'viem';
import {
  getPnlLeaderboard,
  getPnlLeaderboardPeriod,
  getPnlLeaderboardPeriodAccount,
  buildPnlLeaderboardPeriodArgs,
  buildPnlLeaderboardPeriodMinThresholdArgs,
  normalizeGraphqlIsoDate,
  prepareQueryIds,
  getPnlLeaderboardPeriodMinThreshold,
} from '../services/graphql';
import {
  CURRENCY_SYMBOL,
  SEASON_2_EPOCH_ID,
  SEASON_2_EPOCH_8_START,
  SEASON_2_EPOCH_8_END,
  SEASON_2_EPOCHS,
  computeSeason2DefaultEpochId,
} from '../constants';
import { playClick } from '../services/audio';

const HREF_NETWORK_PNL = '/stats?tab=pnl#network-pnl';
const HREF_SEASON2_PANEL = '/stats?tab=season2#season2-panel';

const PAGE_ROWS_PER_PAGE = 10;
const PAGE_FETCH_CAP = 500;

function epochIsCurrent(e: (typeof SEASON_2_EPOCHS)[number]): boolean {
  return 'isCurrent' in e && !!(e as { isCurrent?: boolean }).isCurrent;
}

function epochIsLiveNow(e: (typeof SEASON_2_EPOCHS)[number], nowMs: number = Date.now()): boolean {
  const s = new Date(e.start).getTime();
  const end = new Date(e.end).getTime();
  return nowMs >= s && nowMs <= end;
}

export const Season2LeaderboardPanel: React.FC<{
  /** `home` = snippet on landing; `page` = expanded Season 2 tab on /stats */
  variant?: 'home' | 'page';
  /** Max rows to fetch (defaults: home 10, expanded page 500 for client-side pagination) */
  maxRows?: number;
  /** When false, skip GraphQL until true (e.g. home: load when section scrolls into view). */
  loadEnabled?: boolean;
}> = ({ variant = 'page', maxRows: maxRowsProp, loadEnabled = true }) => {
  const isHome = variant === 'home';
  const fetchCap = maxRowsProp ?? (isHome ? 10 : PAGE_FETCH_CAP);
  const [pnlTop, setPnlTop] = useState<any[]>([]);
  const [pnlLoading, setPnlLoading] = useState(true);
  const [userPnlPosition, setUserPnlPosition] = useState<{
    rank: number;
    account_label?: string;
    total_pnl_raw?: string;
    pnl_pct?: number;
  } | null>(null);
  const { address: walletAddress } = useAccount();
  const [selectedEpochId, setSelectedEpochId] = useState<number>(() => computeSeason2DefaultEpochId());
  const [sortMetric, setSortMetric] = useState<'REALIZED_PNL' | 'REALIZED_ROI_PCT'>('REALIZED_PNL');
  const [epochMenuOpen, setEpochMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [page, setPage] = useState(1);

  const selectedEpoch =
    SEASON_2_EPOCHS.find((e) => e.id === selectedEpochId) ||
    SEASON_2_EPOCHS.find((e) => e.id === SEASON_2_EPOCH_ID) ||
    SEASON_2_EPOCHS[0];

  useEffect(() => {
    if (!loadEnabled) return;

    const sortRows = (rows: any[]) =>
      [...rows].sort((a: any, b: any) => {
        if (sortMetric === 'REALIZED_ROI_PCT') {
          const av = Number(a.realized_pnl_pct ?? a.pnl_pct ?? 0);
          const bv = Number(b.realized_pnl_pct ?? b.pnl_pct ?? 0);
          return bv - av;
        }
        const parseValue = (row: any) => {
          if (row.realized_pnl_formatted != null) {
            const num = Number(String(row.realized_pnl_formatted).replace(/[^\d.-]/g, ''));
            if (Number.isFinite(num)) return num;
          }
          try {
            return parseFloat(formatEther(BigInt(row.total_pnl_raw || '0')));
          } catch {
            return 0;
          }
        };
        return parseValue(b) - parseValue(a);
      });

    const fetchPnl = async () => {
      setPnlLoading(true);
      const epoch = selectedEpoch || {
        id: SEASON_2_EPOCH_ID,
        start: SEASON_2_EPOCH_8_START,
        end: SEASON_2_EPOCH_8_END,
      };
      try {
        const startIso = normalizeGraphqlIsoDate(String(epoch.start));
        const endIso = normalizeGraphqlIsoDate(String(epoch.end));
        const periodArgs = buildPnlLeaderboardPeriodArgs(startIso, endIso, { limit: fetchCap });

        let raw: any[] = [];

        if (isHome) {
          /** Home teaser: one query only — min-threshold is slow and rarely needed for top 10 vs period. */
          const pnlPeriod = await getPnlLeaderboardPeriod(periodArgs, fetchCap);
          raw = pnlPeriod.length > 0 ? pnlPeriod : [];
        } else {
          const minThresholdArgs = buildPnlLeaderboardPeriodMinThresholdArgs(startIso, endIso, { limit: fetchCap });
          const [pnlMin, pnlPeriod] = await Promise.all([
            getPnlLeaderboardPeriodMinThreshold(minThresholdArgs, fetchCap),
            getPnlLeaderboardPeriod(periodArgs, fetchCap),
          ]);
          raw = pnlMin.length > 0 ? pnlMin : pnlPeriod.length > 0 ? pnlPeriod : [];
        }

        if (raw.length > 0) {
          setPnlTop(sortRows(raw).slice(0, fetchCap));
        } else {
          const fallback = await getPnlLeaderboard(0, fetchCap);
          setPnlTop((fallback || []).slice(0, fetchCap));
        }
      } catch (e) {
        console.warn('Season 2 PnL period fetch failed, using fallback:', e);
        try {
          const fallback = await getPnlLeaderboard(0, fetchCap);
          setPnlTop((fallback || []).slice(0, fetchCap));
        } catch (e2) {
          console.error('PnL leaderboard fetch failed:', e2);
          setPnlTop([]);
        }
      } finally {
        setPnlLoading(false);
      }
    };
    fetchPnl();
  }, [selectedEpochId, sortMetric, fetchCap, loadEnabled, isHome]);

  useEffect(() => {
    setPage(1);
  }, [selectedEpochId, sortMetric]);

  const homeRowsOrdered = useMemo(() => {
    const top10 = pnlTop.slice(0, 10);
    if (!walletAddress || top10.length === 0) return top10;
    const walletVariants = prepareQueryIds(walletAddress);
    const userInTop = top10.find((x: any) => {
      const id = (x.account_id || '').trim();
      return walletVariants.some((v) => v.toLowerCase() === id.toLowerCase());
    });
    return userInTop ? [userInTop, ...top10.filter((x: any) => x !== userInTop)] : top10;
  }, [pnlTop, walletAddress]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_ROWS_PER_PAGE;
    return pnlTop.slice(start, start + PAGE_ROWS_PER_PAGE);
  }, [pnlTop, page]);

  const totalPages = Math.max(1, Math.ceil(pnlTop.length / PAGE_ROWS_PER_PAGE) || 1);

  /** Position in the client-sorted board (1-based). Prefer over API `rank` when the user appears in `pnlTop`. */
  const userRankInSortedBoard = useMemo(() => {
    if (!walletAddress || pnlTop.length === 0) return null;
    const variants = prepareQueryIds(walletAddress);
    const idx = pnlTop.findIndex((e: any) => {
      const id = (e.account_id || '').trim();
      return variants.some((v) => v.toLowerCase() === id.toLowerCase());
    });
    return idx >= 0 ? idx + 1 : null;
  }, [walletAddress, pnlTop]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages, pnlTop.length]);

  useEffect(() => {
    if (!loadEnabled) return;
    if (!walletAddress) {
      setUserPnlPosition(null);
      return;
    }
    const fetchUserPosition = async () => {
      try {
        const epoch = selectedEpoch || {
          id: SEASON_2_EPOCH_ID,
          start: SEASON_2_EPOCH_8_START,
          end: SEASON_2_EPOCH_8_END,
        };
        const args = buildPnlLeaderboardPeriodArgs(
          normalizeGraphqlIsoDate(String(epoch.start)),
          normalizeGraphqlIsoDate(String(epoch.end)),
          { limit: 250 }
        );
        const pos = await getPnlLeaderboardPeriodAccount(walletAddress, args);
        if (pos) {
          setUserPnlPosition({
            rank: pos.rank,
            account_label: pos.account_label,
            total_pnl_raw: pos.total_pnl_raw,
            pnl_pct: pos.pnl_pct,
          });
          return;
        }
        const all = await getPnlLeaderboardPeriod(args, 250);
        if (all && all.length > 0) {
          const variants = prepareQueryIds(walletAddress);
          const found = all.find((e: any) => {
            const id = (e.account_id || '').trim();
            return variants.some((v) => v.toLowerCase() === id.toLowerCase());
          });
          setUserPnlPosition(
            found
              ? {
                  rank: found.rank,
                  account_label: found.account_label,
                  total_pnl_raw: found.total_pnl_raw,
                  pnl_pct: found.pnl_pct,
                }
              : null
          );
          return;
        }
        const fallback = await getPnlLeaderboard(0, 250);
        const variants = prepareQueryIds(walletAddress);
        const found = fallback?.find((e: any) => {
          const id = (e.account_id || '').trim();
          return variants.some((v) => v.toLowerCase() === id.toLowerCase());
        });
        setUserPnlPosition(
          found
            ? {
                rank: found.rank,
                account_label: found.account_label,
                total_pnl_raw: found.total_pnl_raw,
                pnl_pct: found.pnl_pct,
              }
            : null
        );
      } catch {
        try {
          const fallback = await getPnlLeaderboard(0, 250);
          const variants = prepareQueryIds(walletAddress);
          const found = fallback?.find((e: any) => {
            const id = (e.account_id || '').trim();
            return variants.some((v) => v.toLowerCase() === id.toLowerCase());
          });
          setUserPnlPosition(
            found
              ? {
                  rank: found.rank,
                  account_label: found.account_label,
                  total_pnl_raw: found.total_pnl_raw,
                  pnl_pct: found.pnl_pct,
                }
              : null
          );
        } catch {
          setUserPnlPosition(null);
        }
      }
    };
    fetchUserPosition();
  }, [walletAddress, selectedEpochId, loadEnabled]);

  useEffect(() => {
    if (!loadEnabled || !walletAddress || pnlLoading || pnlTop.length === 0) return;
    const variants = prepareQueryIds(walletAddress);
    const idx = pnlTop.findIndex((e: any) => {
      const id = (e.account_id || '').trim();
      return variants.some((v) => v.toLowerCase() === id.toLowerCase());
    });
    if (idx >= 0) {
      const pos = pnlTop[idx];
      setUserPnlPosition({
        rank: idx + 1,
        account_label: pos.account_label,
        total_pnl_raw: pos.total_pnl_raw,
        pnl_pct: pos.pnl_pct,
      });
    }
  }, [walletAddress, pnlTop, pnlLoading, loadEnabled]);

  return (
    <div
      id={isHome ? 'home-season2-snippet' : 'season2-panel'}
      className={`min-w-0 ${isHome ? '' : 'scroll-mt-28'}`}
    >
      <div
        className={`min-w-0 rounded-2xl border border-white/[0.08] bg-[#05080c]/90 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] ${
          isHome ? 'p-5 sm:p-6' : 'p-5 sm:p-8'
        }`}
      >
        <div className="flex flex-col gap-5 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-3 min-w-0">
              <div className="inline-flex items-center gap-2.5 rounded-xl border border-amber-400/35 bg-amber-400/[0.07] px-3.5 py-2 text-amber-200/95">
                <Trophy size={18} className="shrink-0 text-amber-400" aria-hidden />
                <span className="font-display font-black uppercase tracking-[0.2em] text-[11px] sm:text-xs">
                  Season 2 leaderboard
                </span>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-display text-white tracking-tight">
                  Wanna rank up?
                </h2>
                {!isHome && (
                  <p className="mt-1.5 text-[13px] text-slate-500 font-sans leading-snug max-w-xl">
                    Epoch realized PnL · {PAGE_ROWS_PER_PAGE} rows per page · Network-wide rankings are under{' '}
                    <span className="text-slate-400">TOP PnL</span>.
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-600 mb-1">Active window</p>
              <p className="text-xs text-slate-400 font-mono leading-relaxed max-w-[280px] sm:ml-auto">
                {selectedEpoch.range}
              </p>
            </div>
          </div>

          <p className="text-[13px] sm:text-sm text-slate-400 font-sans leading-relaxed max-w-2xl">
            Stake and trade on{' '}
            {isHome ? (
              <a
                href="#trending-atoms"
                onClick={(e) => {
                  e.preventDefault();
                  playClick();
                  document.getElementById('trending-atoms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="font-semibold text-intuition-primary hover:text-white transition-colors underline-offset-2 decoration-intuition-primary/40 hover:decoration-intuition-primary"
              >
                Trending Atoms
              </a>
            ) : (
              <Link
                to="/#trending-atoms"
                onClick={playClick}
                className="font-semibold text-intuition-primary hover:text-white transition-colors underline-offset-2 decoration-intuition-primary/40 hover:decoration-intuition-primary"
              >
                Trending Atoms
              </Link>
            )}{' '}
            to climb the board.
          </p>

          <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6 pt-1 border-t border-white/[0.06]">
            <div className="flex flex-wrap gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="flex flex-col gap-1.5 min-w-[160px]">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Epoch</span>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setEpochMenuOpen((open) => !open);
                  }}
                  className="inline-flex items-center justify-between gap-3 rounded-lg border border-white/[0.12] bg-black/50 px-3 py-2.5 text-left text-xs font-mono text-slate-100 hover:border-amber-400/40 hover:bg-white/[0.03] transition-colors w-full sm:min-w-[200px]"
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-semibold text-[13px] truncate">
                      {selectedEpoch.label}
                      {epochIsLiveNow(selectedEpoch) || epochIsCurrent(selectedEpoch) ? (
                        <span className="text-amber-400/90 font-normal"> · Current</span>
                      ) : null}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">{selectedEpoch.range}</span>
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                </button>
                {epochMenuOpen && (
                  <div className="relative z-30 w-full sm:max-w-xs rounded-lg border border-white/[0.1] bg-[#0a0f14] shadow-2xl text-xs font-mono">
                    {SEASON_2_EPOCHS.map((epoch) => (
                      <button
                        key={epoch.id}
                        type="button"
                        onClick={() => {
                          playClick();
                          setSelectedEpochId(epoch.id);
                          setEpochMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left hover:bg-white/[0.04] first:rounded-t-lg last:rounded-b-lg ${
                          epoch.id === selectedEpoch.id ? 'text-amber-300 bg-white/[0.03]' : 'text-slate-200'
                        }`}
                      >
                        <span className="block truncate">
                          {epoch.label}
                          {epochIsLiveNow(epoch) || epochIsCurrent(epoch) ? (
                            <span className="text-amber-400/80"> · Current</span>
                          ) : null}
                        </span>
                        <span className="block text-[10px] text-slate-500 truncate mt-0.5">{epoch.range}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 min-w-[160px]">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Sort</span>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setSortMenuOpen((open) => !open);
                  }}
                  className="inline-flex items-center justify-between gap-3 rounded-lg border border-white/[0.12] bg-black/50 px-3 py-2.5 text-xs font-mono text-slate-100 hover:border-amber-400/40 hover:bg-white/[0.03] transition-colors w-full sm:min-w-[200px]"
                >
                  <span className="text-[13px]">{sortMetric === 'REALIZED_PNL' ? 'Realized PnL' : 'Realized ROI%'}</span>
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                </button>
                {sortMenuOpen && (
                  <div className="relative z-30 w-full sm:max-w-xs rounded-lg border border-white/[0.1] bg-[#0a0f14] shadow-2xl text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setSortMetric('REALIZED_PNL');
                        setSortMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 text-left hover:bg-white/[0.04] rounded-t-lg ${
                        sortMetric === 'REALIZED_PNL' ? 'text-amber-300' : 'text-slate-200'
                      }`}
                    >
                      Realized PnL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setSortMetric('REALIZED_ROI_PCT');
                        setSortMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 text-left hover:bg-white/[0.04] rounded-b-lg ${
                        sortMetric === 'REALIZED_ROI_PCT' ? 'text-amber-300' : 'text-slate-200'
                      }`}
                    >
                      Realized ROI%
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {walletAddress && userPnlPosition && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-intuition-primary font-display font-black text-lg tabular-nums">
                    #{userRankInSortedBoard ?? userPnlPosition.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Your position</p>
                    <p className="text-sm font-semibold text-white truncate max-w-[220px]">
                      {userPnlPosition.account_label ||
                        `${(walletAddress || '').slice(0, 8)}...${(walletAddress || '').slice(-4)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm font-mono">
                  {userPnlPosition.pnl_pct != null && (
                    <span className="text-intuition-success font-semibold">
                      +
                      {(Math.abs(Number(userPnlPosition.pnl_pct)) <= 1
                        ? Number(userPnlPosition.pnl_pct) * 100
                        : Number(userPnlPosition.pnl_pct)
                      ).toFixed(1)}
                      % ROI
                    </span>
                  )}
                  {userPnlPosition.total_pnl_raw && (
                    <span className="text-slate-300">
                      +
                      {parseFloat(formatEther(BigInt(userPnlPosition.total_pnl_raw))).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      {CURRENCY_SYMBOL}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          {walletAddress && !userPnlPosition && !pnlLoading && (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-3 bg-black/20">
              <p className="text-[12px] text-slate-500 font-sans">
                No rank for this epoch yet — trade during this window to appear on the board.
              </p>
            </div>
          )}
          {!walletAddress && (
            <div className="rounded-xl border border-white/[0.06] px-4 py-2.5 bg-black/25">
              <p className="text-[12px] text-slate-500 font-sans">
                Connect a wallet to see your rank for this epoch.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden min-w-0">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left font-mono border-collapse min-w-[520px] text-xs sm:text-sm">
            <thead className="bg-black/60 border-b border-white/10">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 w-16 sm:w-20 text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  RANK
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">USER</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  PNL
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  ROI%
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 w-16 sm:w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pnlLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 sm:px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-10 h-10 text-intuition-primary animate-spin" />
                      <span className="text-slate-500 font-mono text-sm uppercase tracking-wider">Loading leaderboard…</span>
                    </div>
                  </td>
                </tr>
              ) : pnlTop.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 sm:px-6 py-16 text-center text-slate-500 font-mono text-sm uppercase tracking-wider">
                    No leaderboard data available
                  </td>
                </tr>
              ) : (
                (() => {
                  const ordered = isHome ? homeRowsOrdered : pageRows;
                  const walletVariants = walletAddress ? prepareQueryIds(walletAddress) : [];
                  return ordered.map((e: any, i: number) => {
                    let pnlDisplay = '';
                    if (e.realized_pnl_formatted != null) {
                      pnlDisplay = String(e.realized_pnl_formatted);
                    } else {
                      try {
                        const pnlEth = parseFloat(formatEther(BigInt(e.total_pnl_raw || '0')));
                        pnlDisplay = `${pnlEth.toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })} ${CURRENCY_SYMBOL}`;
                      } catch {
                        pnlDisplay = `0.0 ${CURRENCY_SYMBOL}`;
                      }
                    }
                    const pctRaw =
                      e.realized_pnl_pct != null
                        ? Number(e.realized_pnl_pct)
                        : e.pnl_pct != null
                          ? Number(e.pnl_pct)
                          : 0;
                    const pct = Math.abs(pctRaw) <= 1 ? pctRaw * 100 : pctRaw;
                    const id = (e.account_id || '').trim();
                    const isUser = walletAddress && walletVariants.some((v) => v.toLowerCase() === id.toLowerCase());
                    const label = e.account_label || `${(e.account_id || '').slice(0, 10)}...${(e.account_id || '').slice(-6)}`;
                    /** List position after client sort — do not use API `rank` (that reflects server order, not Realized PnL / ROI sort). */
                    const displayRank = isHome
                      ? i + 1
                      : (page - 1) * PAGE_ROWS_PER_PAGE + i + 1;
                    const rankColor =
                      displayRank === 1
                        ? 'text-amber-400'
                        : displayRank === 2
                          ? 'text-slate-300'
                          : displayRank === 3
                            ? 'text-amber-600'
                            : 'text-slate-500';
                    return (
                      <tr
                        key={`${e.account_id || 'row'}-${i}-${page}`}
                        id={!isHome && page === 1 && i === 0 ? 'season2-champions' : undefined}
                        className={`hover:bg-white/5 transition-colors ${isUser ? 'bg-intuition-primary/10 border-l-4 border-l-intuition-primary' : ''}`}
                      >
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                          <span className={`font-black font-display text-sm sm:text-lg ${rankColor}`}>#{displayRank}</span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-slate-800 overflow-hidden flex-shrink-0 border border-white/10">
                              <img
                                src={e.account_image || `https://effigy.im/a/${e.account_id}.png`}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="font-bold text-white text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[200px]">
                              {label}
                            </span>
                            {isUser && (
                              <span className="text-[9px] font-mono text-intuition-primary uppercase tracking-wider px-2 py-0.5 rounded bg-intuition-primary/20 shrink-0">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-black text-intuition-success text-xs sm:text-base">
                          {pnlDisplay}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-bold text-intuition-success text-xs sm:text-sm">
                          {pct >= 0 ? '+' : ''}
                          {pct.toFixed(1)}%
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                          <Link
                            to={`/profile/${e.account_id}`}
                            onClick={playClick}
                            className="inline-flex px-3 py-1.5 rounded-lg bg-intuition-primary/20 border border-intuition-primary/50 text-intuition-primary font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-intuition-primary hover:text-black transition-colors"
                          >
                            Profile
                          </Link>
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isHome && !pnlLoading && pnlTop.length > 0 && (
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => {
              playClick();
              setPage((p) => Math.max(1, p - 1));
            }}
            disabled={page <= 1}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 text-white/90 hover:bg-white/10 hover:border-white/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-sans text-white tabular-nums min-w-[5rem] text-center">
            Page {page}
            {totalPages > 1 ? ` / ${totalPages}` : ''}
          </span>
          <button
            type="button"
            onClick={() => {
              playClick();
              setPage((p) => Math.min(totalPages, p + 1));
            }}
            disabled={page >= totalPages}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 text-white/90 hover:bg-white/10 hover:border-white/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {isHome && (
        <div className="flex flex-wrap gap-4 items-center">
          <Link
            to={HREF_SEASON2_PANEL}
            onClick={playClick}
            className="group inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-intuition-primary/20 to-intuition-secondary/20 border-2 border-intuition-primary/50 text-intuition-primary font-black font-mono text-sm uppercase tracking-[0.2em] hover:from-intuition-primary/30 hover:to-intuition-secondary/30 hover:border-intuition-primary hover:text-white hover:shadow-[0_0_30px_rgba(0,243,255,0.3)] transition-all duration-300"
          >
            Open Season 2 board
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to={HREF_NETWORK_PNL}
            onClick={playClick}
            className="group inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-amber-400/10 border-2 border-amber-400/50 text-amber-300 font-black font-mono text-sm uppercase tracking-[0.2em] hover:bg-amber-400/20 hover:border-amber-400 hover:text-amber-200 hover:shadow-[0_0_30px_rgba(251,191,36,0.2)] transition-all duration-300"
          >
            <Trophy size={18} className="group-hover:scale-110 transition-transform" />
            Network PnL top list
          </Link>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
