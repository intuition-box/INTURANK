import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Loader2, Trophy } from 'lucide-react';
import { formatEther } from 'viem';
import {
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
/** Period RPCs return a capped list; account lookup must scan enough rows or “your rank” stays empty even when you have epoch PnL. */
const EPOCH_QUERY_LIMIT = 2500;

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
  const epochMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!epochMenuOpen && !sortMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (epochMenuRef.current?.contains(t) || sortMenuRef.current?.contains(t)) return;
      setEpochMenuOpen(false);
      setSortMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [epochMenuOpen, sortMenuOpen]);

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
          const qLimit = Math.min(fetchCap, EPOCH_QUERY_LIMIT);
          const minThresholdArgs = buildPnlLeaderboardPeriodMinThresholdArgs(startIso, endIso, { limit: qLimit });
          const [pnlMin, pnlPeriod] = await Promise.all([
            getPnlLeaderboardPeriodMinThreshold(minThresholdArgs, qLimit),
            getPnlLeaderboardPeriod(periodArgs, qLimit),
          ]);
          raw = pnlMin.length > 0 ? pnlMin : pnlPeriod.length > 0 ? pnlPeriod : [];
        }

        if (raw.length > 0) {
          setPnlTop(sortRows(raw).slice(0, fetchCap));
        } else {
          /** Do not substitute all-time PnL here — it looked like epoch data and confused “no rank” messaging. */
          setPnlTop([]);
        }
      } catch (e) {
        console.warn('Season 2 PnL period fetch failed:', e);
        setPnlTop([]);
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

  /** Row we already fetched for the table — use for “your position” when API rank lookup missed a wide list. */
  const userRowOnBoard = useMemo(() => {
    if (userRankInSortedBoard == null || userRankInSortedBoard < 1) return null;
    return pnlTop[userRankInSortedBoard - 1] ?? null;
  }, [pnlTop, userRankInSortedBoard]);

  const userHasEpochRow = userPnlPosition != null || userRankInSortedBoard != null;

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
          { limit: EPOCH_QUERY_LIMIT }
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
        const all = await getPnlLeaderboardPeriod(args, EPOCH_QUERY_LIMIT);
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
        setUserPnlPosition(null);
      } catch {
        setUserPnlPosition(null);
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
        className={`min-w-0 rounded-[1.65rem] border border-intuition-primary/20 bg-[#03050d]/[0.94] shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_36px_rgba(0,243,255,0.08),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/[0.04] backdrop-blur-xl backdrop-saturate-150 ${
          isHome ? 'p-4 sm:p-5' : 'p-5 sm:p-8'
        }`}
      >
        <div className="flex flex-col gap-4">
          <header className={`space-y-3 border-b border-white/[0.07] ${isHome ? 'pb-3' : 'pb-4'}`}>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1.5 text-amber-100/95 shadow-[0_0_20px_rgba(251,191,36,0.12)] backdrop-blur-sm">
                <Trophy size={15} className="shrink-0 text-amber-400" aria-hidden />
                <span className="font-sans text-[11px] font-semibold uppercase tracking-wide">Season 2</span>
              </span>
              {isHome ? (
                <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">Leaderboard</h2>
              ) : (
                <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">Wanna rank up?</h2>
              )}
            </div>
            {!isHome && (
              <p className="max-w-2xl font-sans text-sm leading-relaxed text-slate-400">
                Realized PnL for the selected epoch ({PAGE_ROWS_PER_PAGE} rows per page). All-time rankings live under{' '}
                <span className="font-medium text-slate-300">TOP PnL</span>.
              </p>
            )}
            {!isHome && (
              <p className="max-w-2xl font-sans text-sm leading-relaxed text-slate-400">
                Stake and trade on{' '}
                <Link
                  to="/#trending-atoms"
                  onClick={playClick}
                  className="font-medium text-intuition-primary transition-colors hover:text-cyan-200"
                >
                  Trending Atoms
                </Link>{' '}
                to move up the board.
              </p>
            )}
            {isHome && (
              <p className="font-sans text-xs text-slate-500">
                Trade during the epoch to climb ·{' '}
                <a
                  href="#trending-atoms"
                  className="font-medium text-intuition-primary/90 hover:text-intuition-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    playClick();
                    document.getElementById('trending-atoms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  Trending atoms
                </a>
              </p>
            )}
          </header>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-4">
            <div className="flex flex-wrap gap-3 sm:gap-4 flex-1 min-w-0">
              <div ref={epochMenuRef} className="relative z-20 flex flex-col gap-1.5 min-w-[160px] w-full sm:w-[min(100%,260px)]">
                <label className="font-sans text-xs font-medium text-slate-400" htmlFor="season2-epoch-trigger">
                  Epoch
                </label>
                <button
                  id="season2-epoch-trigger"
                  type="button"
                  aria-expanded={epochMenuOpen}
                  aria-haspopup="listbox"
                  onClick={() => {
                    playClick();
                    setSortMenuOpen(false);
                    setEpochMenuOpen((open) => !open);
                  }}
                  className="inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-[#080b12]/90 px-3 py-2.5 text-left text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-colors hover:border-intuition-primary/35 hover:bg-[#0a1018]/95"
                >
                  <span className="flex flex-col items-start min-w-0 text-left">
                    <span className="font-medium text-slate-100 truncate w-full">
                      {selectedEpoch.label}
                      {epochIsLiveNow(selectedEpoch) || epochIsCurrent(selectedEpoch) ? (
                        <span className="text-amber-400/90 font-normal"> · Current</span>
                      ) : null}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate w-full mt-0.5">{selectedEpoch.range}</span>
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                </button>
                {epochMenuOpen && (
                  <div
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(70vh,22rem)] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#060910]/95 shadow-[0_16px_48px_rgba(0,0,0,0.65)] backdrop-blur-xl text-xs font-mono"
                  >
                    {SEASON_2_EPOCHS.map((epoch) => (
                      <button
                        key={epoch.id}
                        type="button"
                        role="option"
                        aria-selected={epoch.id === selectedEpoch.id}
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
              <div ref={sortMenuRef} className="relative z-20 flex flex-col gap-1.5 min-w-[160px] w-full sm:w-[200px]">
                <label className="font-sans text-xs font-medium text-slate-400" htmlFor="season2-sort-trigger">
                  Sort by
                </label>
                <button
                  id="season2-sort-trigger"
                  type="button"
                  aria-expanded={sortMenuOpen}
                  aria-haspopup="listbox"
                  onClick={() => {
                    playClick();
                    setEpochMenuOpen(false);
                    setSortMenuOpen((open) => !open);
                  }}
                  className="inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-[#080b12]/90 px-3 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-colors hover:border-intuition-primary/35 hover:bg-[#0a1018]/95"
                >
                  <span>{sortMetric === 'REALIZED_PNL' ? 'Realized PnL' : 'Realized ROI %'}</span>
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                </button>
                {sortMenuOpen && (
                  <div
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-50 mt-1 rounded-2xl border border-white/[0.12] bg-[#060910]/95 shadow-[0_16px_48px_rgba(0,0,0,0.65)] backdrop-blur-xl text-xs font-mono"
                  >
                    <button
                      type="button"
                      role="option"
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
                      role="option"
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

          {walletAddress && userHasEpochRow && !pnlLoading && (
            <div className="rounded-2xl border border-intuition-primary/20 bg-intuition-primary/[0.06] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-intuition-primary font-display font-black text-lg tabular-nums">
                    #{userRankInSortedBoard ?? userPnlPosition?.rank ?? '—'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Your wallet</p>
                    <p className="text-sm font-semibold text-white truncate max-w-[220px]">
                      {(userRowOnBoard as any)?.account_label ||
                        userPnlPosition?.account_label ||
                        `${(walletAddress || '').slice(0, 8)}...${(walletAddress || '').slice(-4)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm font-mono">
                  {(() => {
                    const row = userRowOnBoard as any;
                    const pctRaw =
                      row?.realized_pnl_pct != null
                        ? Number(row.realized_pnl_pct)
                        : row?.pnl_pct != null
                          ? Number(row.pnl_pct)
                          : userPnlPosition?.pnl_pct != null
                            ? Number(userPnlPosition.pnl_pct)
                            : null;
                    if (pctRaw == null || !Number.isFinite(pctRaw)) return null;
                    const pct = Math.abs(pctRaw) <= 1 ? pctRaw * 100 : pctRaw;
                    return (
                      <span className="text-intuition-success font-semibold">
                        +{pct.toFixed(1)}% ROI
                      </span>
                    );
                  })()}
                  {(() => {
                    const row = userRowOnBoard as any;
                    const raw = row?.total_pnl_raw ?? userPnlPosition?.total_pnl_raw;
                    if (!raw) return null;
                    try {
                      return (
                        <span className="text-slate-300">
                          +
                          {parseFloat(formatEther(BigInt(raw))).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          {CURRENCY_SYMBOL}
                        </span>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              </div>
            </div>
          )}
          {walletAddress && !userHasEpochRow && !pnlLoading && (
            <div className="mx-auto max-w-lg space-y-1 rounded-2xl border border-white/[0.08] bg-[#05070c]/80 px-4 py-4 text-center backdrop-blur-sm sm:px-5">
              <p className="font-sans text-sm font-medium leading-relaxed text-slate-300">
                {pnlTop.length > 0 ? 'No row for your wallet in this snapshot.' : 'No leaderboard rows for this window yet.'}
              </p>
              {pnlTop.length > 0 ? (
                <p className="font-sans text-xs text-slate-500">Trade during the epoch or check the full board.</p>
              ) : (
                <p className="font-sans text-xs text-slate-500">Indexing may still be catching up.</p>
              )}
            </div>
          )}
          {!walletAddress && (
            <div className="mx-auto max-w-lg rounded-2xl border border-white/[0.08] bg-[#05070c]/70 px-4 py-4 text-center backdrop-blur-sm">
              <p className="font-sans text-sm text-slate-400">Connect a wallet to see your epoch rank.</p>
            </div>
          )}

          <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#060910]/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left font-mono border-collapse min-w-[520px] text-xs sm:text-sm">
            <thead className="bg-black/50 border-b border-white/[0.07]">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-3.5 w-16 sm:w-20 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide font-sans">
                  Rank
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-3.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide font-sans">
                  User
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-3.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide font-sans">
                  PnL
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-3.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide font-sans">
                  ROI %
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-3.5 w-16 sm:w-24" aria-hidden />
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
                            <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-slate-800 sm:h-12 sm:w-12">
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
                            className="inline-flex rounded-full border border-intuition-primary/45 bg-intuition-primary/15 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-intuition-primary transition-colors hover:bg-intuition-primary hover:text-black"
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
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={HREF_SEASON2_PANEL}
            onClick={playClick}
            className="group inline-flex items-center gap-2 rounded-full border border-intuition-primary/45 bg-intuition-primary/10 px-5 py-3 font-mono text-xs font-black uppercase tracking-[0.15em] text-intuition-primary shadow-[0_0_24px_rgba(0,243,255,0.15)] backdrop-blur-sm transition-all hover:border-intuition-primary hover:bg-intuition-primary/20 hover:text-white hover:shadow-[0_0_32px_rgba(0,243,255,0.25)] sm:text-sm"
          >
            Full board
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to={HREF_NETWORK_PNL}
            onClick={playClick}
            className="group inline-flex items-center gap-2 rounded-full border border-amber-400/45 bg-amber-400/10 px-5 py-3 font-mono text-xs font-black uppercase tracking-[0.15em] text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.12)] backdrop-blur-sm transition-all hover:bg-amber-400/18 hover:shadow-[0_0_28px_rgba(251,191,36,0.2)] sm:text-sm"
          >
            <Trophy size={17} className="transition-transform group-hover:scale-105" />
            Network PnL
          </Link>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
