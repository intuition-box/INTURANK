/**
 * MobileHome — purpose-built mobile landing.
 * Loads only on mobile viewports; the full desktop `Home` page stays untouched.
 *
 * Visual language: layered glass cards, bold gradients, generous radii,
 * and a hierarchy that fits a thumb's reach (hero → actions → pulse → discovery).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  TrendingUp, Activity, Send, Cpu, ArrowRight, ArrowUpRight, Crown, Flame,
  Sparkles, Zap, BarChart2, Wallet, Plus, Trophy, ChevronRight, ArrowLeftRight,
} from 'lucide-react';
import { getNetworkStats, getAllAgents } from '../services/graphql';
import { fetchArenaPlayerLeaderboard, inturankLeaderboardTotalXp, type ArenaPlayerRow } from '../services/arenaLeaderboard';
import { fetchArenaXpRecordForWallet } from '../services/arenaXp';
import { getProtocolXpTotal, PROTOCOL_XP_UPDATED_EVENT } from '../services/protocolXp';
import { formatMarketValue, safeWeiToEther } from '../services/analytics';
import { CurrencySymbol } from '../components/CurrencySymbol';
import { HomeWelcomeStrip } from '../components/HomeWelcomeStrip';
import { playClick, playHover } from '../services/audio';
import { DEFAULT_PROFILE_AVATAR_URL } from '../constants';

interface NetworkStats {
  tvl: string;
  atoms: number;
  signals: number;
  positions: number;
}

interface TrendingItem {
  id: string;
  label: string;
  type: string;
  marketCap: string;
  image?: string | null;
}

function shortAddr(a: string): string {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function compact(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

const QuickActions: Array<{
  to: string;
  label: string;
  icon: React.ReactNode;
  ring: string;
  bg: string;
  fg: string;
}> = [
  {
    to: '/markets',
    label: 'Markets',
    icon: <TrendingUp size={20} strokeWidth={2.4} />,
    ring: 'border-intuition-primary/40',
    bg: 'bg-intuition-primary/10',
    fg: 'text-intuition-primary',
  },
  {
    to: '/climb',
    label: 'Arena',
    icon: <Activity size={20} strokeWidth={2.4} />,
    ring: 'border-intuition-secondary/40',
    bg: 'bg-intuition-secondary/10',
    fg: 'text-intuition-secondary',
  },
  {
    to: '/send-trust',
    label: 'Send ₸',
    icon: <Send size={20} strokeWidth={2.4} />,
    ring: 'border-intuition-warning/40',
    bg: 'bg-intuition-warning/10',
    fg: 'text-intuition-warning',
  },
  {
    to: '/skill-playground',
    label: 'Skill',
    icon: <Cpu size={20} strokeWidth={2.4} />,
    ring: 'border-intuition-purple/40',
    bg: 'bg-intuition-purple/10',
    fg: 'text-intuition-purple',
  },
];

const MobileHome: React.FC = () => {
  const { address: walletAddress, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [rankers, setRankers] = useState<ArenaPlayerRow[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingRankers, setLoadingRankers] = useState(true);

  const [arenaSelf, setArenaSelf] = useState({ xp: 0, duels: 0 });
  const [, setProtocolXpTick] = useState(0);

  useEffect(() => {
    const onProto = () => setProtocolXpTick((n) => n + 1);
    window.addEventListener(PROTOCOL_XP_UPDATED_EVENT, onProto);
    return () => window.removeEventListener(PROTOCOL_XP_UPDATED_EVENT, onProto);
  }, []);

  const activityXp = walletAddress ? getProtocolXpTotal(walletAddress) : 0;
  useEffect(() => {
    if (!walletAddress) {
      setArenaSelf({ xp: 0, duels: 0 });
      return;
    }
    let cancelled = false;
    fetchArenaXpRecordForWallet(walletAddress)
      .then((rec) => {
        if (!cancelled) setArenaSelf({ xp: rec.xp, duels: rec.duels });
      })
      .catch(() => {
        if (!cancelled) setArenaSelf({ xp: 0, duels: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  useEffect(() => {
    let cancelled = false;
    getNetworkStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingTrending(true);
    getAllAgents(6, 0, 'desc')
      .then((res) => {
        if (cancelled) return;
        const items: TrendingItem[] = (res.items ?? []).slice(0, 6).map((it: any) => ({
          id: String(it.id),
          label: String(it.label ?? '').slice(0, 64),
          type: String(it.type ?? 'ATOM'),
          marketCap: String(it.marketCap ?? '0'),
          image: it.image ?? null,
        }));
        setTrending(items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingTrending(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingRankers(true);
    fetchArenaPlayerLeaderboard(walletAddress ?? undefined)
      .then((rows) => {
        if (cancelled) return;
        setRankers((rows ?? []).slice(0, 4));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingRankers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const tvlEther = stats ? safeWeiToEther(stats.tvl) : 0;
  const atoms = stats?.atoms ?? 0;
  const signals = stats?.signals ?? 0;

  return (
    <div className="w-full min-w-0 px-4 pt-3 pb-36 space-y-8 text-slate-200 max-[380px]:px-3">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] p-5 pb-6 border border-intuition-primary/25 bg-gradient-to-br from-[#06112a] via-[#0a0e1c] to-[#150724] shadow-[0_18px_60px_rgba(0,243,255,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]">
        {/* glow accents */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-12 h-44 w-44 rounded-full bg-intuition-primary/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-intuition-secondary/20 blur-3xl"
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-mono tracking-[0.32em] uppercase text-intuition-primary/80 font-black">
              {isConnected ? 'Welcome back' : 'Welcome'}
            </p>
            <h1 className="mt-1 text-2xl font-display font-black text-white tracking-tight leading-none">
              {isConnected ? 'Ranker' : 'IntuRank'}
              <span className="text-intuition-primary">.</span>
            </h1>
            <p className="mt-1.5 text-[12px] text-slate-400 font-mono">
              {isConnected ? shortAddr(walletAddress ?? '') : 'Trust intelligence layer'}
            </p>
          </div>
          {isConnected && (
            <div className="shrink-0 h-12 w-12 rounded-2xl border border-white/10 overflow-hidden bg-black/30 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
              {walletAddress ? (
                <img
                  src={DEFAULT_PROFILE_AVATAR_URL}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
          )}
        </div>

        <div className="relative mt-5 rounded-2xl border border-white/8 bg-black/35 backdrop-blur-md p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-mono tracking-[0.28em] uppercase text-slate-400 font-black">
                Your XP
              </p>
              <div
                className="mt-1 flex items-baseline gap-2"
                title={`Arena ${arenaSelf.xp.toLocaleString()} · Activity ${activityXp.toLocaleString()} (this browser)`}
              >
                <span className="text-3xl font-display font-black text-white leading-none tracking-tight">
                  {compact(arenaSelf.xp + activityXp)}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  · {compact(arenaSelf.duels)} duels
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {isConnected
                  ? 'Arena from the graph · activity from trades & creates on this device.'
                  : 'Connect to start earning XP.'}
              </p>
            </div>
            <Link
              to={isConnected ? '/climb' : '#'}
              onClick={(e) => {
                if (!isConnected) {
                  e.preventDefault();
                  openConnectModal?.();
                  return;
                }
                playClick();
              }}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-intuition-primary to-cyan-300 text-black text-[11px] font-mono font-black uppercase tracking-[0.16em] active:scale-95 transition-transform shadow-[0_10px_28px_rgba(0,243,255,0.35)]"
            >
              {isConnected ? (
                <>
                  Climb <ArrowUpRight size={14} strokeWidth={2.5} />
                </>
              ) : (
                <>
                  <Wallet size={14} /> Connect
                </>
              )}
            </Link>
          </div>
        </div>

        {/* network pulse — slightly larger tap/read zones */}
        <div className="relative mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="min-w-0 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-3.5 sm:px-3">
            <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-slate-500 font-black truncate">
              TVL
            </p>
            <p className="mt-1.5 text-[15px] sm:text-base font-display font-black text-white leading-none truncate">
              <CurrencySymbol size="sm" leading className="shrink-0" />
              {formatMarketValue(tvlEther)}
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-3.5 sm:px-3">
            <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-slate-500 font-black truncate">
              Atoms
            </p>
            <p className="mt-1.5 text-[15px] sm:text-base font-display font-black text-intuition-primary leading-none truncate">
              {compact(atoms)}
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-3.5 sm:px-3">
            <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-slate-500 font-black truncate">
              Claims
            </p>
            <p className="mt-1.5 text-[15px] sm:text-base font-display font-black text-intuition-secondary leading-none truncate">
              {compact(signals)}
            </p>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS — 2×2 rows so tiles aren’t micro-columns */}
      <section aria-label="Quick actions">
        <div className="grid grid-cols-2 gap-3">
          {QuickActions.map((q) => (
            <Link
              key={q.label}
              to={q.to}
              onClick={() => playClick()}
              onMouseEnter={playHover}
              className="group flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 active:scale-[0.98] transition-transform"
            >
              <span
                className={`shrink-0 h-11 w-11 flex items-center justify-center rounded-xl border ${q.ring} ${q.bg} ${q.fg} shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
              >
                {q.icon}
              </span>
              <span className="min-w-0 text-left text-[11px] font-mono font-black uppercase tracking-[0.14em] text-slate-100 leading-tight">
                {q.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <HomeWelcomeStrip variant="mobile" />

      {/* TRENDING MARKETS — wider cards so titles don’t crush-wrap */}
      <section>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-intuition-secondary shrink-0" strokeWidth={2.4} />
            <h2 className="text-[13px] font-display font-black uppercase tracking-[0.2em] text-white">
              Trending
            </h2>
          </div>
          <Link
            to="/markets"
            onClick={() => playClick()}
            className="flex shrink-0 items-center gap-0.5 text-[11px] font-mono text-intuition-primary font-black uppercase tracking-[0.16em]"
          >
            View all <ChevronRight size={14} />
          </Link>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute right-0 top-6 bottom-0 w-12 z-[1] bg-gradient-to-l from-[#020308] via-[#020308]/80 to-transparent" aria-hidden />
          <p className="flex items-center justify-end gap-1 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-cyan-400/80 mb-2 pr-0.5">
            <ArrowLeftRight size={12} strokeWidth={2.4} className="opacity-90" aria-hidden />
            Swipe
          </p>
          <div className="-mx-4 px-4 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-none pb-1">
          <div className="flex gap-3.5 min-w-min pr-5">
            {loadingTrending && trending.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="snap-start shrink-0 w-[min(82vw,19.5rem)] h-[11.5rem] rounded-2xl border border-white/[0.06] bg-white/[0.03] animate-pulse"
                  />
                ))
              : trending.map((t, idx) => {
                  const cap = parseFloat(String(t.marketCap ?? '0'));
                  const capN = Number.isFinite(cap) ? cap : 0;
                  const typeShort =
                    t.type.length > 10 ? `${t.type.slice(0, 8)}…` : t.type;
                  return (
                    <Link
                      key={t.id}
                      to={`/markets/${t.id}`}
                      onClick={() => playClick()}
                      title={t.label}
                      className="snap-start shrink-0 w-[min(82vw,19.5rem)] flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a1424] via-[#080d1a] to-[#0a0612] p-4 active:scale-[0.99] transition-transform shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <span className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border border-intuition-primary/30 bg-intuition-primary/10 text-intuition-primary text-[10px] font-mono font-black uppercase tracking-wider overflow-hidden">
                          {t.image ? (
                            <img src={t.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span>{t.type === 'CLAIM' ? 'C' : 'A'}</span>
                          )}
                        </span>
                        <span
                          className={`max-w-[46%] truncate text-right text-[9px] font-mono font-black uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border ${
                            t.type === 'CLAIM'
                              ? 'border-intuition-secondary/40 text-intuition-secondary bg-intuition-secondary/10'
                              : 'border-intuition-primary/40 text-intuition-primary bg-intuition-primary/10'
                          }`}
                          title={t.type}
                        >
                          {typeShort}
                        </span>
                      </div>
                      <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2 min-h-[2.625rem]">
                        {t.label || `Atom #${idx + 1}`}
                      </p>
                      <div className="mt-auto pt-3 border-t border-white/5">
                        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500 font-black">
                          Market cap
                        </p>
                        <p className="text-[15px] font-display font-black text-white leading-none mt-1 tabular-nums">
                          <CurrencySymbol size="sm" leading />
                          {formatMarketValue(capN)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
          </div>
          </div>
        </div>
      </section>

      {/* TOP RANKERS PREVIEW */}
      <section className="rounded-[1.75rem] border border-white/[0.07] bg-gradient-to-b from-[#06080f] to-[#020308] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <Crown size={16} className="text-intuition-warning shrink-0" strokeWidth={2.4} />
            <h2 className="text-[13px] font-display font-black uppercase tracking-[0.2em] text-white truncate">
              Top rankers
            </h2>
          </div>
          <Link
            to="/stats?tab=rankers"
            onClick={() => playClick()}
            className="flex shrink-0 items-center gap-0.5 text-[11px] font-mono text-intuition-primary font-black uppercase tracking-[0.16em]"
          >
            Leaderboard <ChevronRight size={14} />
          </Link>
        </div>

        {loadingRankers && rankers.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[3.25rem] rounded-2xl border border-white/[0.05] bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : rankers.length > 0 ? (
          <ul className="space-y-2">
            {rankers.map((r, idx) => {
              const isPodium = idx < 3;
              const podiumColor =
                idx === 0
                  ? 'text-intuition-warning'
                  : idx === 1
                    ? 'text-slate-200'
                    : 'text-amber-700';
              return (
                <li
                  key={r.address}
                  className="flex items-center gap-2.5 pl-2 pr-2.5 py-2 rounded-2xl border border-white/[0.06] bg-white/[0.025]"
                >
                  <span
                    className={`shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-[11px] font-display font-black border ${
                      isPodium
                        ? 'border-intuition-warning/40 bg-intuition-warning/10'
                        : 'border-white/10 bg-white/[0.04]'
                    } ${isPodium ? podiumColor : 'text-slate-300'}`}
                  >
                    {idx + 1}
                  </span>
                  <span className="shrink-0 h-8 w-8 rounded-full overflow-hidden border border-white/10 bg-black/30">
                    <img
                      src={r.image || DEFAULT_PROFILE_AVATAR_URL}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </span>
                  <span className="flex-1 min-w-0 pr-1">
                    <span className="block text-[12px] font-semibold text-white truncate">
                      {r.label}
                    </span>
                    <span className="block text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                      {compact(r.duels)} duels · {compact(r.atomsRanked)} atoms
                    </span>
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[12px] font-display font-black text-intuition-primary tabular-nums">
                    <Zap size={12} className="text-intuition-primary shrink-0" strokeWidth={2.6} />
                    {compact(inturankLeaderboardTotalXp(r))}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-6 text-center text-slate-500 text-[12px]">
            No rankers yet. Be the first to climb.
          </div>
        )}
      </section>

      {/* Activity · Portfolio · Create — one row, three columns */}
      <section className="grid grid-cols-3 gap-2 sm:gap-2.5">
        <Link
          to="/feed"
          onClick={() => playClick()}
          className="flex min-h-[8.5rem] flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0d1422] to-[#08101c] p-2.5 pt-3 text-center active:scale-[0.99] transition-transform sm:p-3"
        >
          <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center border border-intuition-primary/35 bg-intuition-primary/10 text-intuition-primary">
            <Sparkles size={16} strokeWidth={2.4} />
          </div>
          <span className="text-[11px] font-display font-black text-white leading-tight sm:text-[12px]">Activity</span>
          <span className="hidden text-[9px] leading-snug text-slate-500 min-[360px]:line-clamp-2 min-[360px]:block">
            Live atoms, claims, and stakes.
          </span>
          <span className="mt-auto inline-flex items-center gap-0.5 text-[9px] font-mono font-black uppercase tracking-[0.12em] text-intuition-primary">
            Feed <ArrowRight size={10} />
          </span>
        </Link>
        <Link
          to="/portfolio"
          onClick={() => playClick()}
          className="flex min-h-[8.5rem] flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#1a0a1c] to-[#0a0610] p-2.5 pt-3 text-center active:scale-[0.99] transition-transform sm:p-3"
        >
          <div className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center border border-intuition-secondary/35 bg-intuition-secondary/10 text-intuition-secondary">
            <BarChart2 size={16} strokeWidth={2.4} />
          </div>
          <span className="text-[11px] font-display font-black text-white leading-tight sm:text-[12px]">Portfolio</span>
          <span className="hidden text-[9px] leading-snug text-slate-500 min-[360px]:line-clamp-2 min-[360px]:block">
            Positions, PnL, reputation.
          </span>
          <span className="mt-auto inline-flex items-center gap-0.5 text-[9px] font-mono font-black uppercase tracking-[0.12em] text-intuition-secondary">
            Open <ArrowRight size={10} />
          </span>
        </Link>
        <Link
          to="/create"
          onClick={() => playClick()}
          className="group relative flex min-h-[8.5rem] flex-col items-center gap-2 overflow-hidden rounded-2xl border border-intuition-primary/25 bg-gradient-to-b from-[#001a26] via-[#0a0612] to-[#1a0617] p-2.5 pt-3 text-center shadow-[0_12px_32px_rgba(0,243,255,0.12)] active:scale-[0.99] transition-transform sm:p-3"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-intuition-secondary/10 to-transparent opacity-60"
          />
          <span className="relative h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-intuition-primary to-intuition-secondary text-black flex items-center justify-center shadow-[0_6px_16px_rgba(0,243,255,0.35)]">
            <Plus size={18} strokeWidth={2.6} />
          </span>
          <span className="relative text-[10px] font-display font-black uppercase tracking-[0.12em] text-white leading-tight sm:text-[11px] sm:tracking-[0.14em]">
            Create
          </span>
          <span className="relative hidden text-[9px] leading-snug text-slate-400 min-[360px]:line-clamp-2 min-[360px]:block">
            Atom or claim
          </span>
          <span className="relative mt-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-intuition-primary group-active:scale-95 transition-transform">
            <ArrowRight size={12} />
          </span>
        </Link>
      </section>

      {/* FOOTNOTE — extra air above dock */}
      <p className="text-center text-[10px] font-mono uppercase tracking-[0.28em] text-slate-600 pt-2 pb-1 flex items-center justify-center gap-2">
        <Trophy size={11} className="text-intuition-warning/70 shrink-0" /> IntuRank mobile · live
      </p>
    </div>
  );
};

export default MobileHome;
