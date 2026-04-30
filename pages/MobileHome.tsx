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
  Sparkles, Zap, BarChart2, Wallet, Plus, Trophy, ChevronRight,
} from 'lucide-react';
import { getNetworkStats, getAllAgents } from '../services/graphql';
import { fetchArenaPlayerLeaderboard, type ArenaPlayerRow } from '../services/arenaLeaderboard';
import { fetchArenaXpRecordForWallet } from '../services/arenaXp';
import { getProtocolXpTotal, PROTOCOL_XP_UPDATED_EVENT } from '../services/protocolXp';
import { formatMarketValue, safeWeiToEther } from '../services/analytics';
import { CurrencySymbol } from '../components/CurrencySymbol';
import { playClick, playHover } from '../services/audio';

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

function avatarFromAddress(addr?: string | null): string {
  if (!addr) return '';
  return `https://effigy.im/a/${addr}.png`;
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
    fetchArenaPlayerLeaderboard()
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
  }, []);

  const tvlEther = stats ? safeWeiToEther(stats.tvl) : 0;
  const atoms = stats?.atoms ?? 0;
  const signals = stats?.signals ?? 0;

  return (
    <div className="px-4 pt-2 pb-2 space-y-6 text-slate-200">
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
                  src={avatarFromAddress(walletAddress)}
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

        {/* network pulse */}
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-slate-500 font-black">
              TVL
            </p>
            <p className="mt-1 text-base font-display font-black text-white leading-none">
              <CurrencySymbol size="sm" leading />
              {formatMarketValue(tvlEther)}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-slate-500 font-black">
              Atoms
            </p>
            <p className="mt-1 text-base font-display font-black text-intuition-primary leading-none">
              {compact(atoms)}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-slate-500 font-black">
              Claims
            </p>
            <p className="mt-1 text-base font-display font-black text-intuition-secondary leading-none">
              {compact(signals)}
            </p>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section>
        <div className="grid grid-cols-4 gap-2.5">
          {QuickActions.map((q) => (
            <Link
              key={q.label}
              to={q.to}
              onClick={() => playClick()}
              onMouseEnter={playHover}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 active:scale-95 transition-transform"
            >
              <span
                className={`h-12 w-12 flex items-center justify-center rounded-2xl border ${q.ring} ${q.bg} ${q.fg} shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
              >
                {q.icon}
              </span>
              <span className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-slate-300">
                {q.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* TRENDING MARKETS */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-intuition-secondary" strokeWidth={2.4} />
            <h2 className="text-[13px] font-display font-black uppercase tracking-[0.22em] text-white">
              Trending
            </h2>
          </div>
          <Link
            to="/markets"
            onClick={() => playClick()}
            className="flex items-center gap-1 text-[11px] font-mono text-intuition-primary font-black uppercase tracking-[0.18em]"
          >
            View all <ChevronRight size={14} />
          </Link>
        </div>

        <div className="-mx-4 px-4 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-none">
          <div className="flex gap-3 min-w-min pr-4">
            {loadingTrending && trending.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="snap-start shrink-0 w-44 h-40 rounded-2xl border border-white/[0.06] bg-white/[0.03] animate-pulse"
                  />
                ))
              : trending.map((t, idx) => {
                  const cap = safeWeiToEther(t.marketCap);
                  return (
                    <Link
                      key={t.id}
                      to={`/markets/${t.id}`}
                      onClick={() => playClick()}
                      className="snap-start shrink-0 w-44 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a1424] via-[#080d1a] to-[#0a0612] p-4 active:scale-[0.98] transition-transform shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="h-9 w-9 rounded-xl flex items-center justify-center border border-intuition-primary/30 bg-intuition-primary/10 text-intuition-primary text-[10px] font-mono font-black uppercase tracking-wider overflow-hidden">
                          {t.image ? (
                            <img src={t.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span>{t.type === 'CLAIM' ? 'C' : 'A'}</span>
                          )}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${
                            t.type === 'CLAIM'
                              ? 'border-intuition-secondary/40 text-intuition-secondary bg-intuition-secondary/10'
                              : 'border-intuition-primary/40 text-intuition-primary bg-intuition-primary/10'
                          }`}
                        >
                          {t.type}
                        </span>
                      </div>
                      <p className="text-[12px] font-semibold text-white leading-snug line-clamp-2 min-h-[2.4rem]">
                        {t.label || `Atom #${idx + 1}`}
                      </p>
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500 font-black">
                          Market cap
                        </p>
                        <p className="text-[14px] font-display font-black text-white leading-none mt-1">
                          <CurrencySymbol size="sm" leading />
                          {formatMarketValue(cap)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
          </div>
        </div>
      </section>

      {/* TOP RANKERS PREVIEW */}
      <section className="rounded-[1.75rem] border border-white/[0.07] bg-gradient-to-b from-[#06080f] to-[#020308] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-intuition-warning" strokeWidth={2.4} />
            <h2 className="text-[13px] font-display font-black uppercase tracking-[0.22em] text-white">
              Top rankers
            </h2>
          </div>
          <Link
            to="/stats?tab=rankers"
            onClick={() => playClick()}
            className="flex items-center gap-1 text-[11px] font-mono text-intuition-primary font-black uppercase tracking-[0.18em]"
          >
            Leaderboard <ChevronRight size={14} />
          </Link>
        </div>

        {loadingRankers && rankers.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl border border-white/[0.05] bg-white/[0.02] animate-pulse" />
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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.025]"
                >
                  <span
                    className={`shrink-0 h-8 w-8 flex items-center justify-center rounded-xl text-[12px] font-display font-black border ${
                      isPodium
                        ? 'border-intuition-warning/40 bg-intuition-warning/10'
                        : 'border-white/10 bg-white/[0.04]'
                    } ${isPodium ? podiumColor : 'text-slate-300'}`}
                  >
                    {idx + 1}
                  </span>
                  <span className="shrink-0 h-9 w-9 rounded-full overflow-hidden border border-white/10 bg-black/30">
                    <img
                      src={r.image || avatarFromAddress(r.address)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-white truncate">
                      {r.label}
                    </span>
                    <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                      {compact(r.duels)} duels · {compact(r.atomsRanked)} atoms
                    </span>
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-display font-black text-intuition-primary">
                    <Zap size={12} className="text-intuition-primary" strokeWidth={2.6} />
                    {compact(r.arenaXp)}
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

      {/* DISCOVER STRIP */}
      <section className="grid grid-cols-2 gap-3">
        <Link
          to="/feed"
          onClick={() => playClick()}
          className="rounded-2xl p-4 border border-white/[0.07] bg-gradient-to-br from-[#0d1422] to-[#08101c] active:scale-[0.98] transition-transform"
        >
          <div className="h-9 w-9 rounded-xl flex items-center justify-center border border-intuition-primary/35 bg-intuition-primary/10 text-intuition-primary mb-3">
            <Sparkles size={18} strokeWidth={2.4} />
          </div>
          <p className="text-[13px] font-display font-black text-white tracking-wide">Activity</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            Live atoms, claims, and stakes across the network.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-intuition-primary">
            Open feed <ArrowRight size={12} />
          </span>
        </Link>
        <Link
          to="/portfolio"
          onClick={() => playClick()}
          className="rounded-2xl p-4 border border-white/[0.07] bg-gradient-to-br from-[#1a0a1c] to-[#0a0610] active:scale-[0.98] transition-transform"
        >
          <div className="h-9 w-9 rounded-xl flex items-center justify-center border border-intuition-secondary/35 bg-intuition-secondary/10 text-intuition-secondary mb-3">
            <BarChart2 size={18} strokeWidth={2.4} />
          </div>
          <p className="text-[13px] font-display font-black text-white tracking-wide">Portfolio</p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            Your positions, PnL and reputation at a glance.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-intuition-secondary">
            Open portfolio <ArrowRight size={12} />
          </span>
        </Link>
      </section>

      {/* CREATE CTA */}
      <section>
        <Link
          to="/create"
          onClick={() => playClick()}
          className="group relative overflow-hidden flex items-center gap-4 rounded-[1.75rem] p-4 border border-intuition-primary/25 bg-gradient-to-r from-[#001a26] via-[#0a0612] to-[#1a0617] shadow-[0_18px_48px_rgba(0,243,255,0.18),0_18px_48px_rgba(255,30,109,0.12)]"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-intuition-secondary/15 to-transparent"
          />
          <span className="relative shrink-0 h-12 w-12 rounded-2xl bg-gradient-to-br from-intuition-primary to-intuition-secondary text-black flex items-center justify-center shadow-[0_8px_24px_rgba(0,243,255,0.4)]">
            <Plus size={22} strokeWidth={2.6} />
          </span>
          <span className="relative flex-1 min-w-0">
            <span className="block text-[13px] font-display font-black uppercase tracking-[0.18em] text-white">
              Create atom or claim
            </span>
            <span className="block text-[11px] text-slate-400 mt-0.5">
              Mint a new identity or signed claim in seconds.
            </span>
          </span>
          <span className="relative shrink-0 h-9 w-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-intuition-primary group-active:scale-95 transition-transform">
            <ArrowRight size={16} />
          </span>
        </Link>
      </section>

      {/* FOOTNOTE */}
      <p className="text-center text-[10px] font-mono uppercase tracking-[0.32em] text-slate-600 pb-2 flex items-center justify-center gap-2">
        <Trophy size={11} className="text-intuition-warning/70" /> IntuRank Mobile · Live
      </p>
    </div>
  );
};

export default MobileHome;
