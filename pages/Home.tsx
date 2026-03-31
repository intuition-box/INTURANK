
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ArrowRight, Shield, Activity, ChevronRight, ChevronUp, ChevronsUpDown, Binary, Box, HardDrive, Terminal, Cpu, Network, Mail, Sparkles, Heart, ShoppingCart, Trophy, Loader2, Flame, Zap } from 'lucide-react';
import { useEmailNotify } from '../contexts/EmailNotifyContext';
import { formatEther, getAddress } from 'viem';
import { playHover, playClick } from '../services/audio';
import { subscribeVisibilityAwareInterval } from '../services/visibility';
import { getAllAgents, buildHomeAtomSectionsFrom, getNewlyCreatedAtoms, getNetworkStats } from '../services/graphql';
import { CURRENCY_SYMBOL } from '../constants';
import { toast } from '../components/Toast';
import {
  getConnectedAccount,
  depositToVault,
  toggleWatchlist,
  isInWatchlist,
  getWalletBalance,
  getProxyApprovalStatus,
  grantProxyApproval,
  hasCachedProxyApproval,
} from '../services/web3';
import Logo from '../components/Logo';
import { Season2LeaderboardPanel } from '../components/Season2LeaderboardPanel';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MuiBox from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import TextField from '@mui/material/TextField';
interface InViewOptions extends IntersectionObserverInit {
  once?: boolean;
}

const useInView = (options: InViewOptions = {}) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        if (options.once) observer.unobserve(entry.target);
      } else if (!options.once) {
        setIsInView(false);
      }
    }, { threshold: 0.1, ...options });

    const currentRef = ref.current;
    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [options.once]);

  return [ref, isInView] as const;
};

const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; direction?: 'up' | 'down' | 'none' }> = ({ 
    children, 
    delay = 0, 
    className = "",
    direction = 'up'
}) => {
  const [ref, isInView] = useInView({ once: true });
  
  const getTransform = () => {
      if (!isInView) {
          if (direction === 'up') return 'translateY(16px)';
          if (direction === 'down') return 'translateY(-16px)';
          return 'scale(0.99)';
      }
      return 'translateY(0) scale(1)';
  };

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-500 ${className} ${
        isInView ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        transitionDelay: `${delay}ms`,
        transform: getTransform(),
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {children}
    </div>
  );
};

const TickerItem: React.FC<{ symbol: string, price: string, isUp: boolean }> = ({ symbol, price, isUp }) => (
  <div className="flex items-center gap-2 sm:gap-4 px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-r border-white/10 text-[9px] sm:text-[10px] font-black font-mono whitespace-nowrap bg-black/40 hover:bg-intuition-secondary/10 transition-all group">
    <span className="text-slate-300 tracking-[0.2em] group-hover:text-white transition-colors uppercase font-black">{symbol}</span>
    <span className="text-white tracking-tighter text-sm font-black">{price}</span>
    <span className={`px-1.5 py-0.5 rounded-sm font-black shadow-sm ${isUp ? 'text-intuition-success bg-intuition-success/10 text-glow-success' : 'text-intuition-secondary bg-intuition-secondary/20 shadow-[0_0_10px_rgba(255,0,85,0.2)] text-glow-red'}`}>
      {isUp ? '▲' : '▼'}{Math.floor(Math.random() * 8)}.{Math.floor(Math.random() * 9)}%
    </span>
  </div>
);

const MissionTerminal: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-32 relative">
      <Reveal delay={200}>
        <div className="bg-[#05080f] border-2 border-intuition-primary/40 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,243,255,0.15)] group transition-all duration-500">
          <div className="flex items-center justify-between px-6 py-4 bg-black/60 border-b border-white/5">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
              <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
            </div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.4em] font-black">mission_log.txt</div>
            <div className="w-12"></div>
          </div>
          
          <div className="p-8 md:p-16 font-mono space-y-10 relative">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-20"></div>
            
            <div className="text-intuition-primary text-sm md:text-base font-black tracking-widest flex items-center gap-3">
              <span className="animate-pulse">{">>"}</span> SYSTEM BOOT SEQUENCE INITIATED ...
            </div>
            
            <p className="text-slate-300 text-lg md:text-xl leading-relaxed font-black uppercase tracking-tight">
              The internet is broken. Information is abundant, but <span className="inline-block px-2 py-0.5 bg-intuition-primary/10 border border-intuition-primary/30 text-white text-glow-blue rounded-sm">trust</span> is scarce. We are drowning in noise, deepfakes, and sybil attacks.
            </p>
            
            <p className="text-slate-300 text-lg md:text-xl leading-relaxed font-black uppercase tracking-tight">
              IntuRank is how we act on that. Rank markets, follow leaders, and trade conviction on Intuition. Leaderboards, arenas, and live prices turn belief into positions you can size.
            </p>
            
            <p className="text-lg md:text-xl leading-relaxed font-black uppercase tracking-tight">
              <span className="text-intuition-success text-glow-success">We are building the credit score for everything.</span>{' '}
              <span className="text-slate-300">Not controlled by a bank, but by you. The market decides what is true when you rank and trade in IntuRank.</span>
            </p>
            
            <div className="text-intuition-primary text-sm md:text-base font-black tracking-widest flex items-center gap-2 pt-4 text-glow-blue">
              <span>{">>"}</span> AWAITING INPUT<span className="w-2.5 h-6 bg-intuition-primary animate-[pulse_0.8s_infinite] shadow-glow-blue"></span>
            </div>
          </div>
        </div>
      </Reveal>
      
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-intuition-primary/5 rounded-full blur-[80px] -z-10 animate-pulse"></div>
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-intuition-secondary/5 rounded-full blur-[80px] -z-10 animate-pulse delay-1000"></div>
    </div>
  );
};

interface SwipeToBuyProps {
  onConfirm: () => void;
  /** When true, swipe is inert (e.g. waiting for protocol proxy approval). */
  disabled?: boolean;
  /** Parent async work in flight — replaces track with status + spinner. */
  loading?: boolean;
  /** Distinguish pre-wallet prep vs waiting for wallet signature. */
  txPhase?: 'preparing' | 'wallet';
}

const SwipeToBuy: React.FC<SwipeToBuyProps> = ({ onConfirm, disabled, loading = false, txPhase = 'preparing' }) => {
  const [progress, setProgress] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  /** Must not rely on React state for release — state updates async and broke mouseup handling. */
  const dragActiveRef = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  useEffect(() => {
    if (loading) setProgress(0);
  }, [loading]);

  const updateProgress = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const raw = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, raw));
    progressRef.current = clamped;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setProgress(clamped));
  }, []);

  const finishDrag = useCallback(
    (clientX: number) => {
      if (!dragActiveRef.current) return;
      updateProgress(clientX);
      dragActiveRef.current = false;
      setIsSwiping(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const p = progressRef.current;
      if (p > 0.65) {
        setProgress(1);
        queueMicrotask(() => {
          onConfirmRef.current();
        });
      } else {
        setProgress(0);
      }
    },
    [updateProgress]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || loading) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    dragActiveRef.current = true;
    setIsSwiping(true);
    progressRef.current = 0;
    setProgress(0);
    updateProgress(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current) return;
    e.preventDefault();
    updateProgress(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current) return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    finishDrag(e.clientX);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    finishDrag(e.clientX);
  };

  if (loading) {
    const title = txPhase === 'wallet' ? 'Confirm in wallet' : 'Preparing transaction';
    const sub =
      txPhase === 'wallet'
        ? 'Check your wallet extension — approve the deposit.'
        : 'Verifying protocol & preparing your deposit…';
    return (
      <div
        className="relative w-full min-h-[52px] rounded-full border-2 border-intuition-primary/50 bg-[#050814]/90 flex items-center gap-3 px-4 py-2.5 shadow-[inset_0_0_20px_rgba(0,243,255,0.08)]"
        role="status"
        aria-busy="true"
        aria-label={title}
      >
        <Loader2 className="w-5 h-5 text-intuition-primary animate-spin shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[11px] font-black font-display text-white uppercase tracking-[0.18em] truncate">{title}</span>
          <span className="text-[10px] text-slate-500 font-mono leading-snug">{sub}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-intuition-primary/15 overflow-hidden rounded-b-full">
          <div className="h-full w-2/5 max-w-[45%] bg-intuition-primary/70 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={`relative w-full h-12 rounded-full swipe-to-buy-track border-2 overflow-hidden select-none group touch-none ${
        disabled ? 'border-slate-600/50 opacity-50 pointer-events-none' : 'border-intuition-primary/40'
      }`}
      style={{ cursor: disabled ? 'not-allowed' : isSwiping ? 'grabbing' : 'grab', touchAction: 'none' }}
      aria-disabled={disabled}
    >
      {/* Progress fill */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-intuition-primary/20 to-intuition-primary/5 transition-opacity duration-200"
        style={{ opacity: progress > 0 ? 1 : 0.4, width: `${progress * 100}%` }}
      />
      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <span className="text-[11px] font-black font-display text-slate-400 group-hover:text-intuition-primary/90 transition-colors uppercase tracking-[0.2em]">
          {disabled ? 'Enable protocol above' : progress > 0.65 ? '◆ RELEASE TO CONFIRM ◆' : '→ SWIPE TO BUY →'}
        </span>
      </div>
      {/* Thumb: ignore pointer so drags always hit the track (stable coordinates) */}
      <div
        className="absolute top-1 bottom-1 w-9 rounded-full swipe-to-buy-thumb bg-intuition-primary text-black flex items-center justify-center font-black text-base will-change-transform pointer-events-none"
        style={{
          left: `calc(0.25rem + ${progress} * (100% - 2.75rem))`,
          transition: isSwiping ? 'none' : 'left 0.15s ease-out',
        }}
      >
        →
      </div>
    </div>
  );
};

interface SwipeCardProps {
  agent: any;
  onSwipeBuy: (agent: any, amount: string) => void;
}

const SwipeTradeCard: React.FC<SwipeCardProps> = ({ agent, onSwipeBuy }) => {
  const [amount, setAmount] = useState<string>('');
  const price = parseFloat(formatEther(BigInt(agent.currentSharePrice || '0')) || 0).toFixed(4);

  return (
    <div className="relative min-w-[320px] sm:min-w-[360px] max-w-sm snap-center">
      <div className="absolute -inset-0.5 bg-gradient-to-br from-intuition-primary/40 via-intuition-secondary/40 to-transparent rounded-[2.5rem] opacity-40 blur-2 group-hover:opacity-70 transition-opacity" />
      <div className="relative rounded-[2.5rem] bg-gradient-to-br from-[#050712] via-[#050814] to-[#020308] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.9)] p-6 flex flex-col gap-5 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center">
            {agent.image ? (
              <img src={agent.image} alt={agent.label} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-black text-intuition-primary">
                {agent.label?.slice(0, 2) ?? 'IN'}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="text-xs font-mono uppercase tracking-[0.35em] text-slate-500">
              Trending Atom
            </div>
            <div className="text-white font-display font-black text-lg truncate">{agent.label}</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.25em] text-slate-400">
          <span>Spot Price</span>
          <span className="text-intuition-primary text-glow-blue">
            {price} {CURRENCY_SYMBOL}
          </span>
        </div>

        <div className="bg-black/40 rounded-3xl border border-white/10 p-4 flex flex-col gap-3">
          <label className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400">
            TRUST TO DEPLOY
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-intuition-primary/70 focus:ring-1 focus:ring-intuition-primary/70"
              placeholder="0.0"
            />
            <button
              type="button"
              onClick={() => setAmount('100')}
              className="px-3 py-1.5 rounded-full text-[10px] font-mono font-black uppercase tracking-[0.3em] bg-white/5 text-slate-200 border border-white/10 hover:bg-intuition-primary hover:text-black hover:border-intuition-primary transition-all"
            >
              MAX
            </button>
          </div>
          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.25em]">
            Approx. {amount ? (Number(amount) * Number(price)).toFixed(3) : '0.000'} {CURRENCY_SYMBOL}
          </div>
        </div>

        <SwipeToBuy onConfirm={() => onSwipeBuy(agent, amount)} />
      </div>
    </div>
  );
};

// --- Stacked cards: vertical swipe = next/prev, horizontal = buy/watchlist (no buttons) ---
const SWIPE_THRESHOLD = 44;
const SWIPE_VERTICAL_THRESHOLD = 32;

const formatTimeAgo = (ts: number): string => {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'} ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const d = Math.floor(hr / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};

interface StackedAtomCardProps {
  agent: any;
  dragX: number;
  dragY: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  isInWatchlist: boolean;
  isBackCard?: boolean;
  showRoi?: boolean;
  showCreatedAgo?: boolean;
}

const StackedAtomCard: React.FC<StackedAtomCardProps> = ({ agent, dragX, dragY, onSwipeRight, onSwipeLeft, isInWatchlist, isBackCard, showRoi, showCreatedAgo }) => {
  const [timeAgo, setTimeAgo] = useState('');
  useEffect(() => {
    if (!showCreatedAgo || !agent?.createdAt) return;
    const tick = () => setTimeAgo(formatTimeAgo(agent.createdAt));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [showCreatedAgo, agent?.createdAt]);
  const price = parseFloat(formatEther(BigInt(agent.currentSharePrice || '0')) || '0').toFixed(4);
  const marketCapRaw = agent.marketCap ? parseFloat(agent.marketCap) : 0;
  const formatCompact = (value: number) => {
    if (!value || !Number.isFinite(value)) return '0';
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(2);
  };
  const marketCapDisplay = formatCompact(marketCapRaw);

  // Classic Pokémon card: fixed size — all cards same height regardless of image
  const cardClass = 'relative w-full max-w-[280px] h-[420px] rounded-[12px] overflow-hidden select-none touch-none flex-shrink-0 flex flex-col';
  const isFront = !isBackCard;

  const cardInner = (
    <div className={`${cardClass} atom-card ${isFront ? 'atom-card-front' : ''}`}>
      {isFront && <div className="atom-card-glitter rounded-[12px]" />}
      {/* Swipe hints — only on front when dragging */}
      {isFront && (
      <div className="absolute left-2 right-2 top-20 flex items-center justify-between pointer-events-none z-10">
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-150 ${
            dragX < -30 ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ background: 'rgba(220,38,38,0.9)', color: '#fff', border: '2px solid #991b1b' }}
        >
          <Heart size={12} className="fill-white" />
          <span className="text-[9px] font-bold uppercase">Watchlist</span>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-150 ${
            dragX > 30 ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ background: 'rgba(34,197,94,0.9)', color: '#fff', border: '2px solid #15803d' }}
        >
          <span className="text-[9px] font-bold uppercase">Infuse</span>
          <ShoppingCart size={12} />
        </div>
      </div>
      )}

      {/* HEADER — Pokémon-style name bar with type badge + HP */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/40 bg-gradient-to-r from-[#0f1623] via-[#0a0f1a] to-[#0f1623] flex-shrink-0 relative">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#00f3ff] via-[#00f3ff]/70 to-[#ff1e6d]/70 rounded-r shadow-[0_0_8px_rgba(0,243,255,0.3)]" />
        <div className="flex items-center gap-1.5 pl-2">
          <span className="text-[8px] font-black uppercase tracking-wider text-amber-200 px-2 py-0.5 rounded-md bg-amber-500/30 border border-amber-500/60 shadow-sm">
            {(agent.type || 'ATOM').slice(0, 5)}
          </span>
          {isFront && (
            <span className="text-[7px] font-black uppercase tracking-widest text-amber-400/90 px-1.5 py-0.5 rounded border border-amber-500/50 bg-gradient-to-r from-amber-500/20 to-transparent shadow-[0_0_8px_rgba(250,204,21,0.2)]">
              EX
            </span>
          )}
          {isInWatchlist && isFront && <Heart size={10} className="text-rose-500 fill-rose-500" />}
        </div>
        <h3 className="flex-1 text-center text-sm font-black text-amber-100 truncate mx-2 font-display drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]">
          {agent.label || 'Unnamed'}
        </h3>
        <div className="flex items-center gap-1">
          <span className="w-5 h-5 rounded-full bg-red-500 border-2 border-red-700 flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_rgba(220,38,38,0.5)]">
            <span className="text-[8px] font-black text-white">HP</span>
          </span>
          <span className="text-base font-black text-red-400 tabular-nums">{marketCapDisplay}</span>
          <span className="text-[8px] font-bold text-amber-400 uppercase">{CURRENCY_SYMBOL}</span>
        </div>
      </div>

      {/* ARTWORK — holographic foil area + rainbow strip at bottom (Pokémon-style) */}
      <div className={`relative flex flex-col items-center p-4 pt-3 pb-2 h-[160px] flex-shrink-0 ${agent.image ? 'atom-card-artwork-image' : 'atom-card-artwork'}`}>
        <div className="relative w-full h-[118px] rounded-lg overflow-hidden flex items-center justify-center">
          {agent.image ? (
            <img src={agent.image} alt={agent.label} className="w-full h-full object-cover object-center" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1520] to-[#0a0f1a] rounded-lg border border-amber-500/20">
              <span className="text-4xl font-black text-amber-400/80">{agent.label?.slice(0, 2) ?? '—'}</span>
            </div>
          )}
        </div>
        {/* Holographic rainbow strip — like premium Pokémon foil cards */}
        <div
          className="w-full h-2.5 rounded-b-lg mt-1.5 opacity-90 shrink-0"
          style={{
            background: 'linear-gradient(90deg, #ff1e6d, #facc15, #00f3ff, #a855f7, #ff1e6d)',
            backgroundSize: '200% 100%',
            animation: 'holo-rainbow 4s ease-in-out infinite',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 8px rgba(250,204,21,0.1)',
          }}
        />
      </div>

      {/* ATTACKS — energy symbols + attack names */}
      <div className="px-3 py-2 space-y-2 bg-gradient-to-b from-[#0a0f1a] to-[#06090f] flex-shrink-0">
        <div className="atom-card-attack flex items-center gap-2 px-3 py-2">
          <span className="w-7 h-7 rounded-full energy-fire flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-black text-white">$</span>
          </span>
          <span className="text-[10px] font-black text-amber-200/90 uppercase flex-1">Market Cap</span>
          <span className="text-sm font-black text-red-400 tabular-nums">{marketCapDisplay} {CURRENCY_SYMBOL}</span>
        </div>
        <div className="atom-card-attack flex items-center gap-2 px-3 py-2">
          <span className="w-7 h-7 rounded-full energy-electric flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-black text-amber-950">P</span>
          </span>
          <span className="text-[10px] font-black text-amber-200/90 uppercase flex-1">Spot Price</span>
          <div className="text-right">
            <span className="text-sm font-black text-amber-100 tabular-nums">{price} {CURRENCY_SYMBOL}</span>
            {showRoi && (
              <p className="text-[9px] font-bold text-emerald-600 mt-0.5">
                {(() => {
                  const p = parseFloat(price || '0');
                  if (!Number.isFinite(p)) return '';
                  const raw = (p - 1) * 100;
                  const clamped = Math.max(-99.9, Math.min(999.9, raw));
                  const sign = clamped > 0 ? '+' : '';
                  return `${sign}${clamped.toFixed(1)}% ROI`;
                })()}
              </p>
            )}
          </div>
        </div>

        {/* MINTED — always reserve space so all cards same height (IntuRank blue when active) */}
        <div className={`px-3 py-2 h-[44px] flex flex-col justify-center rounded-lg ${showCreatedAgo ? 'atom-card-ex-rule' : 'bg-transparent border border-transparent'}`}>
          {showCreatedAgo && (
            <>
              <p className="text-[9px] font-black text-[#38bdf8] uppercase mb-0.5">◆ Minted ◆</p>
              <p className="text-[11px] font-bold text-slate-300 tabular-nums">{timeAgo || '—'}</p>
            </>
          )}
        </div>
      </div>

      {/* INTURANK branding — logo + text, soft glow */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
        <Logo className="w-5 h-5 object-contain" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#facc15]" style={{ textShadow: '0 0 8px rgba(250,204,21,0.3)' }}>INTURANK</span>
      </div>
    </div>
  );

  // Back cards: full content but subtle (less visible, shows details)
  if (isBackCard) {
    return (
      <div className="pointer-events-none" style={{ opacity: 0.38 }}>
        {cardInner}
      </div>
    );
  }
  return cardInner;
};

interface AtomSectionCarouselProps {
  title: string;
  subtitle: string;
  agents: any[];
  walletAddress: string | undefined;
  onSwipeRight: (agent: any) => void;
  onSwipeLeft: (agent: any) => void;
  isInWatchlist: (id: string) => boolean;
  showRoi?: boolean;
  showCreatedAgo?: boolean;
  /** BUY cyan #00f3ff | WATCHLIST magenta #ff1e6d | BROWSE yellow #facc15 */
  sectionColor?: string;
}

const AtomSectionCarousel: React.FC<AtomSectionCarouselProps> = ({ title, subtitle, agents, walletAddress, onSwipeRight, onSwipeLeft, isInWatchlist, showRoi, showCreatedAgo, sectionColor = '#00f3ff' }) => {
  const [index, setIndex] = useState(0);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragXYRef = useRef({ x: 0, y: 0 });
  const total = agents.length;
  const currentAgent = total > 0 ? agents[index % total] : null;
  const prevAgent = total > 1 ? agents[(index - 1 + total) % total] : null;
  const nextAgent = total > 1 ? agents[(index + 1) % total] : null;

  dragXYRef.current = { x: dragX, y: dragY };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const start = { x, y };
    setDragStart(start);
    dragStartRef.current = start;
    setDragX(0);
    setDragY(0);
    dragXYRef.current = { x: 0, y: 0 };
  };

  // Window-level move/end so swipe stays fluid when finger/mouse leaves the card
  useEffect(() => {
    if (dragStartRef.current == null) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const x = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const y = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const start = dragStartRef.current!;
      const dx = x - start.x;
      const dy = y - start.y;
      dragXYRef.current = { x: dx, y: dy };
      setDragX(dx);
      setDragY(dy);
    };
    const onEnd = () => {
      if (dragStartRef.current == null) return;
      const { x: dx, y: dy } = dragXYRef.current;
      const cur = total > 0 ? agents[index % total] : null;
      const isVertical = Math.abs(dy) > Math.abs(dx);
      if (isVertical && Math.abs(dy) > SWIPE_VERTICAL_THRESHOLD) {
        playClick();
        if (dy < 0) setIndex((i) => (i + 1) % total);
        else setIndex((i) => (i - 1 + total) % total);
      } else if (!isVertical && Math.abs(dx) > SWIPE_THRESHOLD && cur) {
        playClick();
        if (dx > 0) onSwipeRight(cur);
        else onSwipeLeft(cur);
      }
      dragStartRef.current = null;
      setDragStart(null);
      setDragX(0);
      setDragY(0);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [dragStart, index, total, agents, onSwipeRight, onSwipeLeft]);

  const handleEndLocal = () => {
    if (dragStartRef.current == null) return;
    const dx = dragX;
    const dy = dragY;
    const isVertical = Math.abs(dy) > Math.abs(dx);
    if (isVertical && Math.abs(dy) > SWIPE_VERTICAL_THRESHOLD) {
      playClick();
      if (dy < 0) setIndex((i) => (i + 1) % total);
      else setIndex((i) => (i - 1 + total) % total);
    } else if (!isVertical && Math.abs(dx) > SWIPE_THRESHOLD && currentAgent) {
      playClick();
      if (dx > 0) onSwipeRight(currentAgent);
      else onSwipeLeft(currentAgent);
    }
    dragStartRef.current = null;
    setDragStart(null);
    setDragX(0);
    setDragY(0);
  };

  if (total === 0) {
    return (
      <MuiBox sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div className="w-full text-center mb-2">
          <h3 className="text-xs sm:text-sm font-black font-display text-white tracking-[0.2em] mb-1 uppercase">{title}</h3>
          <div
            className="h-0.5 w-12 mx-auto rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${sectionColor}, transparent)`,
              boxShadow: `0 0 8px ${sectionColor}50`,
            }}
          />
        </div>
        <p className="text-[9px] font-mono text-slate-500 tracking-[0.2em] uppercase mb-4">{subtitle}</p>
        <div className="w-full max-w-[280px] min-h-[320px] flex flex-col items-center justify-center">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `${sectionColor}40`, borderTopColor: sectionColor }}
          />
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-3">Loading atoms…</p>
        </div>
      </MuiBox>
    );
  }

  const isDragging = dragStart != null;

  return (
    <MuiBox sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div className="w-full text-center mb-2">
        <h3 className="text-xs sm:text-sm font-black font-display text-white tracking-[0.2em] mb-1 uppercase drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">{title}</h3>
        <div
          className="h-0.5 w-12 mx-auto rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${sectionColor}, transparent)`,
            boxShadow: `0 0 8px ${sectionColor}50`,
          }}
        />
      </div>
      <p className="text-[9px] font-mono text-slate-500 tracking-[0.2em] uppercase mb-3">{subtitle}</p>

      <MuiBox
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        onMouseUp={handleEndLocal}
        onMouseLeave={handleEndLocal}
        onTouchEnd={handleEndLocal}
        sx={{
          position: 'relative',
          width: '100%',
          minHeight: 520,
          pt: 3,
          pb: 3,
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* Above: previous card peeks from top — more visible */}
        {prevAgent && (
          <div className="absolute left-1/2 z-[1] pointer-events-none" style={{ top: 0, transform: 'translateX(-50%) translateY(-8px) scale(0.82)' }}>
            <StackedAtomCard agent={prevAgent} dragX={0} dragY={0} onSwipeRight={() => {}} onSwipeLeft={() => {}} isInWatchlist={walletAddress && prevAgent ? isInWatchlist(prevAgent.id) : false} isBackCard showRoi={showRoi} showCreatedAgo={showCreatedAgo} />
          </div>
        )}
        {/* Below: next card peeks from bottom — more visible */}
        {nextAgent && (
          <div className="absolute left-1/2 z-[1] pointer-events-none" style={{ bottom: 0, transform: 'translateX(-50%) translateY(8px) scale(0.82)' }}>
            <StackedAtomCard agent={nextAgent} dragX={0} dragY={0} onSwipeRight={() => {}} onSwipeLeft={() => {}} isInWatchlist={walletAddress && nextAgent ? isInWatchlist(nextAgent.id) : false} isBackCard showRoi={showRoi} showCreatedAgo={showCreatedAgo} />
          </div>
        )}
        {/* Current: centered */}
        <div
          className="absolute left-1/2 z-10 will-change-transform w-full max-w-[280px]"
          style={{
            top: '50%',
            transform: `translate(calc(-50% + ${dragX}px), calc(-50% + ${dragY}px))`,
            transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
          }}
        >
          <StackedAtomCard
            agent={currentAgent}
            dragX={dragX}
            dragY={dragY}
            onSwipeRight={() => currentAgent && onSwipeRight(currentAgent)}
            onSwipeLeft={() => currentAgent && onSwipeLeft(currentAgent)}
            isInWatchlist={walletAddress && currentAgent ? isInWatchlist(currentAgent.id) : false}
            showRoi={showRoi}
            showCreatedAgo={showCreatedAgo}
          />
        </div>
      </MuiBox>

      <p className="text-[10px] font-mono mt-2 tabular-nums tracking-[0.25em] px-3 py-1.5 rounded-lg bg-black/50 border border-white/10" style={{ boxShadow: `0 0 8px ${sectionColor}20` }}>
        <span className="font-semibold" style={{ color: sectionColor, textShadow: `0 0 4px ${sectionColor}40` }}>{String(index + 1).padStart(2, '0')}</span>
        <span className="text-slate-500 mx-1">/</span>
        <span className="text-slate-400">{String(total).padStart(2, '0')}</span>
      </p>
    </MuiBox>
  );
};

interface BuySidePanelProps {
  agent: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (agentLabel: string) => void;
  walletAddress: string | undefined;
  openConnectModal: (() => void) | undefined;
}

const BuySidePanel: React.FC<BuySidePanelProps> = ({ agent, isOpen, onClose, onSuccess, walletAddress, openConnectModal }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState('0');
  /** null = loading / unknown; false = show enable CTA; true = fee proxy approved */
  const [proxyApproved, setProxyApproved] = useState<boolean | null>(null);
  const [enablingProxy, setEnablingProxy] = useState(false);
  const [txPhase, setTxPhase] = useState<'preparing' | 'wallet'>('preparing');
  const price = agent ? parseFloat(formatEther(BigInt(agent.currentSharePrice || '0')) || '0').toFixed(4) : '0';

  useEffect(() => {
    if (isOpen && walletAddress) {
      getWalletBalance(walletAddress).then((b) => setWalletBalance(b || '0'));
    } else {
      setWalletBalance('0');
    }
  }, [isOpen, walletAddress]);

  useEffect(() => {
    if (!isOpen || !walletAddress) {
      setProxyApproved(null);
      return;
    }
    const addr = getAddress(walletAddress as `0x${string}`);
    // Instant UI: localStorage says they already enabled for this address
    setProxyApproved(hasCachedProxyApproval(addr) ? true : null);
    let cancelled = false;
    getProxyApprovalStatus(addr)
      .then((ok) => {
        if (!cancelled) setProxyApproved(ok);
      })
      .catch(() => {
        if (!cancelled) setProxyApproved(hasCachedProxyApproval(addr));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, walletAddress]);

  const handleEnableProxy = async () => {
    if (!walletAddress || enablingProxy) return;
    const acc = (await getConnectedAccount()) ?? getAddress(walletAddress as `0x${string}`);
    if (!acc) {
      toast.error('Wallet not ready.');
      return;
    }
    setEnablingProxy(true);
    try {
      playClick();
      toast.info('Confirm approval in your wallet…');
      await grantProxyApproval(acc);
      setProxyApproved(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Protocol enable failed.');
    } finally {
      setEnablingProxy(false);
    }
  };

  const handleConfirm = async () => {
    if (loading) return;
    if (!walletAddress) {
      openConnectModal?.();
      return;
    }
    const trimmed = (amount || '').trim();
    if (!trimmed || Number(trimmed) <= 0) {
      toast.error('Enter amount to deploy.');
      return;
    }
    setLoading(true);
    setTxPhase('preparing');
    try {
      const acc = (await getConnectedAccount()) ?? getAddress(walletAddress as `0x${string}`);
      if (!acc) {
        toast.error('Wallet not ready.');
        return;
      }
      const fastPath = hasCachedProxyApproval(acc);
      const approved = await getProxyApprovalStatus(acc, {
        readRetries: fastPath ? 1 : 5,
        readDelayMs: 280,
      });
      if (!approved) {
        setProxyApproved(false);
        toast.error(
          'Could not confirm protocol proxy on-chain. If you just enabled it, wait a few seconds and try again.'
        );
        return;
      }
      setProxyApproved(true);
      setTxPhase('wallet');
      playClick();
      toast.info('Confirm in your wallet…');
      await depositToVault(trimmed, agent.id, acc, 1, (log) => toast.info(log));
      toast.success('Acquisition complete.');
      onSuccess(agent.label || 'this atom');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Transaction failed.');
    } finally {
      setLoading(false);
      setTxPhase('preparing');
    }
  };

  const swipeDisabled = Boolean(walletAddress && proxyApproved !== true);

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={() => {
        playClick();
        onClose();
      }}
      slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' } } }}
      PaperProps={{
        className: 'execution-deck',
        sx: {
          width: { xs: 320, sm: 360 },
          maxWidth: '92vw',
          height: 'auto',
          top: '22%',
          transform: 'translateY(-50%)',
          bottom: 'auto',
          maxHeight: 600,
          borderTopLeftRadius: 16,
          borderBottomLeftRadius: 16,
          overflow: 'hidden',
          bgcolor: '#020308',
          borderLeft: '2px solid rgba(0,243,255,0.5)',
          boxShadow: '0 0 24px rgba(0,243,255,0.12), 0 0 80px rgba(0,0,0,0.9)',
          animation: 'execution-pulse 3s ease-in-out infinite',
        },
      }}
    >
      <MuiBox sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Orbitron', sans-serif" }}>
        <MuiBox
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid rgba(0,243,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(0,243,255,0.06) 0%, transparent 100%)',
          }}
        >
          <MuiBox>
            <Typography
              sx={{
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 900,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                fontSize: 12,
                color: '#00f3ff',
                textShadow: '0 0 8px rgba(0,243,255,0.4)',
              }}
            >
              Buy
            </Typography>
            <Typography sx={{ fontFamily: "'Fira Code', monospace", fontSize: 9, color: 'rgba(0,243,255,0.6)', letterSpacing: '0.2em', mt: 0.25 }}>
              EXECUTION_DECK
            </Typography>
          </MuiBox>
          <IconButton onClick={() => { playClick(); onClose(); }} aria-label="Close" size="small" sx={{ color: 'rgba(148,163,184,0.9)', '&:hover': { color: '#00f3ff', bgcolor: 'rgba(0,243,255,0.1)' } }}>
            <Typography component="span" sx={{ fontSize: '1.1rem', lineHeight: 1 }}>&times;</Typography>
          </IconButton>
        </MuiBox>
        {agent && (
          <MuiBox sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
            <MuiBox sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(5,8,20,0.6)', border: '1px solid rgba(0,243,255,0.2)' }}>
              <MuiBox
                className="execution-deck-asset-icon"
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: '#050814',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '1px solid rgba(0,243,255,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {agent.image ? (
                  <img src={agent.image} alt={agent.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Typography sx={{ color: '#00f3ff', fontWeight: 700, fontSize: 16 }}>
                    {agent.label?.slice(0, 2)}
                  </Typography>
                )}
              </MuiBox>
              <MuiBox sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 14, color: '#fff', noWrap: true }}>
                  {agent.label}
                </Typography>
                <MuiBox sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontFamily: "'Fira Code', monospace", fontSize: 10, color: 'rgba(148,163,184,0.8)', letterSpacing: '0.1em' }}>
                    SPOT
                  </Typography>
                  <Typography sx={{ fontFamily: "'Fira Code', monospace", fontSize: 13, color: '#00f3ff', fontWeight: 700 }}>
                    {price} {CURRENCY_SYMBOL}
                  </Typography>
                </MuiBox>
                {walletAddress && (
                  <Typography sx={{ fontFamily: "'Fira Code', monospace", fontSize: 11, color: 'rgba(0,255,157,0.9)', mt: 0.5 }}>
                    Balance: {parseFloat(walletBalance).toFixed(4)} {CURRENCY_SYMBOL}
                  </Typography>
                )}
              </MuiBox>
            </MuiBox>
            <MuiBox sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(5,8,20,0.4)', border: '1px solid rgba(0,243,255,0.15)' }}>
              <Typography
                sx={{ mb: 1, fontFamily: "'Fira Code', monospace", fontSize: 10, color: 'rgba(148,163,184,0.9)', letterSpacing: '0.2em', textTransform: 'uppercase' }}
              >
                Amount to deposit
              </Typography>
              <MuiBox sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  type="number"
                  inputProps={{ min: 0, step: 0.01 }}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 12,
                      bgcolor: '#050814',
                      fontSize: 14,
                      '& fieldset': { borderColor: 'rgba(0,243,255,0.3)' },
                      '&:hover fieldset': { borderColor: 'rgba(0,243,255,0.5)', boxShadow: '0 0 8px rgba(0,243,255,0.1)' },
                      '&.Mui-focused fieldset': { borderColor: 'rgba(0,243,255,0.8)', borderWidth: 2, boxShadow: '0 0 16px rgba(0,243,255,0.2)' },
                    },
                  }}
                />
                <IconButton
                  onClick={() => setAmount(parseFloat(walletBalance).toFixed(4))}
                  sx={{
                    bgcolor: '#050814',
                    borderRadius: 2,
                    px: 1.5,
                    border: '1px solid rgba(0,243,255,0.4)',
                    '&:hover': { bgcolor: 'rgba(0,243,255,0.15)', borderColor: 'rgba(0,243,255,0.7)', boxShadow: '0 0 12px rgba(0,243,255,0.2)' },
                  }}
                  aria-label="Max amount"
                >
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
                    MAX
                  </Typography>
                </IconButton>
              </MuiBox>
              <Typography sx={{ mt: 0.75, fontSize: 11, color: 'rgba(148,163,184,0.8)', fontFamily: "'Fira Code', monospace" }}>
                ≈ {amount ? (Number(amount) * Number(price)).toFixed(3) : '0'} {CURRENCY_SYMBOL}
              </Typography>
            </MuiBox>
            {walletAddress && proxyApproved === null && (
              <MuiBox sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <Loader2 size={14} className="animate-spin shrink-0 text-intuition-primary" />
                <Typography sx={{ fontSize: 10, color: 'rgba(148,163,184,0.85)', fontFamily: "'Fira Code', monospace" }}>
                  Checking protocol…
                </Typography>
              </MuiBox>
            )}
            {walletAddress && proxyApproved === false && (
              <MuiBox
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: 9,
                    color: 'rgba(251,191,36,0.95)',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                  }}
                >
                  Protocol proxy
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'rgba(226,232,240,0.88)', lineHeight: 1.45 }}>
                  Approve the fee proxy once so deposits can run through the protocol.
                </Typography>
                <button
                  type="button"
                  onClick={handleEnableProxy}
                  disabled={enablingProxy}
                  className="w-full py-2.5 px-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all bg-amber-500/90 text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed border border-amber-400/50"
                >
                  {enablingProxy ? 'Waiting for wallet…' : 'Enable protocol'}
                </button>
              </MuiBox>
            )}
            <MuiBox sx={{ pt: 2 }}>
              <Typography sx={{ mb: 1.5, fontFamily: "'Fira Code', monospace", fontSize: 9, color: 'rgba(0,243,255,0.6)', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
                DEPLOY
              </Typography>
              <SwipeToBuy
                onConfirm={handleConfirm}
                disabled={swipeDisabled}
                loading={loading}
                txPhase={txPhase}
              />
            </MuiBox>
          </MuiBox>
        )}
      </MuiBox>
    </Drawer>
  );
};

const Home: React.FC = () => {
  const { openEmailNotify } = useEmailNotify();
  const [tickerData, setTickerData] = useState<any[]>([]);
  const [stats, setStats] = useState({ tvl: "0", atoms: 0, signals: 0, positions: 0 });
  const [atomSections, setAtomSections] = useState<{ roiDaily: any[]; byMarketcap: any[]; newlyCreated: any[] }>({ roiDaily: [], byMarketcap: [], newlyCreated: [] });
  const [buyPanelAgent, setBuyPanelAgent] = useState<any | null>(null);
  const [acquisitionSuccess, setAcquisitionSuccess] = useState<{ agentLabel: string } | null>(null);
  const { openConnectModal } = useConnectModal();
  const { address: walletAddress } = useAccount();

  const [season2Anchor, setSeason2Anchor] = useState<HTMLElement | null>(null);
  const [season2LoadEnabled, setSeason2LoadEnabled] = useState(false);

  useEffect(() => {
    if (!season2Anchor) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeason2LoadEnabled(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSeason2LoadEnabled(true);
      },
      { rootMargin: '360px 0px', threshold: 0.01 }
    );
    io.observe(season2Anchor);
    return () => io.disconnect();
  }, [season2Anchor]);

  useEffect(() => {
    const initData = async () => {
      try {
        const [agentsData, netStats, newlyCreated] = await Promise.all([
          getAllAgents(40, 0).catch(() => ({ items: [] as any[], hasMore: false })),
          getNetworkStats().catch(() => ({ tvl: '0', atoms: 0, signals: 0, positions: 0 })),
          getNewlyCreatedAtoms(10).catch(() => []),
        ]);
        const agents = agentsData.items || [];
        const topAgents = agents.slice(0, 15).map((a) => {
          const assets = parseFloat(formatEther(BigInt(a.totalAssets || '0')));
          const shares = parseFloat(formatEther(BigInt(a.totalShares || '0')));
          const price = shares > 0 ? (assets / shares).toFixed(4) : '0.0001';
          return { symbol: (a.label || 'NODE').toUpperCase().slice(0, 12), price, isUp: Math.random() > 0.45 };
        });
        setTickerData(topAgents);
        setAtomSections(buildHomeAtomSectionsFrom(agents, newlyCreated, 10));
        setStats(netStats);
      } catch (e) {
        console.error(e);
      }
    };
    initData();
  }, []);

  // Live polling for NEWLY CREATED — lightweight (events + vaults only, no duplicate getAllAgents)
  useEffect(() => {
    const poll = async () => {
      const raw = await getNewlyCreatedAtoms(20).catch(() => []);
      if (raw.length > 0) setAtomSections((prev) => ({ ...prev, newlyCreated: raw }));
    };
    return subscribeVisibilityAwareInterval(poll, 5000);
  }, []);

  useEffect(() => {
    const onWatchlistUpdate = () => setAtomSections((prev) => ({ ...prev }));
    window.addEventListener('watchlist-updated', onWatchlistUpdate);
    return () => window.removeEventListener('watchlist-updated', onWatchlistUpdate);
  }, []);

  const volumeValue = parseFloat(formatEther(BigInt(stats.tvl)));
  const formattedVolume = volumeValue > 0 
    ? volumeValue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "0.0";

  return (
    <div className="relative flex flex-col min-h-screen bg-intuition-dark selection:bg-intuition-secondary selection:text-white w-full min-w-0 max-w-[100vw] overflow-x-hidden">
      {/* Success popup: portaled to body so it stays viewport-centered */}
      {acquisitionSuccess && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-backdrop-fade-fluid"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={() => setAcquisitionSuccess(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Acquisition successful"
        >
          <div
            className="relative w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-modal-pop-fluid"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -inset-[1px] rounded-[2.5rem] bg-gradient-to-br from-intuition-primary/60 via-intuition-secondary/40 to-intuition-primary/50 opacity-90 blur-[0.5px]" />
            <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-[#050712] via-[#0a0e1a] to-[#050712] border border-white/10" />
            <div className="relative p-8 sm:p-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-intuition-primary/30 to-intuition-secondary/20 border-2 border-intuition-primary/50 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(0,243,255,0.25)]">
                <Sparkles className="w-10 h-10 text-intuition-primary" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black font-display text-white mb-3 tracking-tight">
                Yayyy, you did it!
              </h3>
              <p className="text-slate-300 text-sm sm:text-base font-mono leading-relaxed mb-2">
                You just added TRUST to <span className="text-intuition-primary font-semibold">{acquisitionSuccess.agentLabel}</span>. Your position is live on the protocol.
              </p>
              <p className="text-slate-400 text-xs font-mono uppercase tracking-[0.3em] mb-8">
                Check out your positions below
              </p>
              <Link
                to="/portfolio"
                onClick={() => { playClick(); setAcquisitionSuccess(null); }}
                onMouseEnter={playHover}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-intuition-primary/20 to-intuition-secondary/20 border-2 border-intuition-primary/60 text-intuition-primary font-black font-mono text-sm uppercase tracking-[0.25em] hover:from-intuition-primary/30 hover:to-intuition-secondary/30 hover:border-intuition-primary hover:text-white hover:shadow-[0_0_35px_rgba(0,243,255,0.4)] transition-all duration-300"
              >
                Check out your positions
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button
                type="button"
                onClick={() => { playClick(); setAcquisitionSuccess(null); }}
                className="mt-6 text-slate-500 hover:text-slate-300 text-xs font-mono uppercase tracking-widest transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 1. TRENDING ATOMS — gamified arena */}
      <section id="trending-atoms" className="relative overflow-x-hidden overflow-y-visible min-w-0 py-12 sm:py-20 border-b border-white/5 scroll-mt-6" style={{ paddingLeft: 'clamp(1.5rem, 6vw, 4rem)', paddingRight: 'clamp(1.5rem, 6vw, 4rem)' }}>
        {/* Arena background: grid + gradients */}
        <div className="absolute inset-0 bg-[#030508]" />
        <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: 'linear-gradient(rgba(0,243,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,243,255,0.03) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_140%_100%_at_50%_-30%,rgba(0,243,255,0.12),_transparent_55%)] pointer-events-none animate-arena-pulse" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_80%_60%,rgba(255,30,109,0.08),_transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_20%_80%,rgba(250,204,21,0.05),_transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.5)_100%)] pointer-events-none" />
        <div className="relative mx-auto z-10 min-w-0 w-full" style={{ maxWidth: 1280 }}>
          <Reveal delay={80}>
            <div className="text-center mb-10">
              {/* Arcade-style tagline */}
              <p className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.4em] text-intuition-primary/90 mb-3 animate-neon-flicker">
                ◆ PICK YOUR NEXT PLAY ◆
              </p>
              <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black font-display tracking-tighter uppercase leading-[0.9] mb-3">
                <span className="block text-white text-glow-white drop-shadow-[0_0_16px_rgba(255,255,255,0.2)]">TRENDING</span>
                <span className="block text-intuition-secondary text-glow-red mt-1 drop-shadow-[0_0_20px_rgba(255,30,109,0.25)]">ATOMS</span>
              </h2>
              <p className="text-sm sm:text-base max-w-2xl mx-auto leading-relaxed mb-8 font-display text-[13px] sm:text-[15px] tracking-wide">
                <span className="text-slate-400">The arena is open. </span>
                <span className="font-black text-intuition-primary text-glow-blue">Stake. Swipe. Climb.</span>
                <span className="text-white font-semibold"> Dominate.</span>
              </p>
              {/* Arcade control hints — soft glow, easy on the eyes */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <div className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/70 border-2 border-[#00f3ff] shadow-[0_0_16px_rgba(0,243,255,0.25)] hover:shadow-[0_0_24px_rgba(0,243,255,0.35)] transition-all duration-300">
                  <ArrowRight size={18} className="text-[#00f3ff]" />
                  <span className="text-[11px] font-black font-display uppercase tracking-widest text-[#00f3ff]">→ BUY</span>
                </div>
                <div className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/70 border-2 border-[#ff1e6d] shadow-[0_0_16px_rgba(255,30,109,0.25)] hover:shadow-[0_0_24px_rgba(255,30,109,0.35)] transition-all duration-300">
                  <Heart size={18} className="text-[#ff1e6d]" />
                  <span className="text-[11px] font-black font-display uppercase tracking-widest text-[#ff1e6d]">← WATCHLIST</span>
                </div>
                <div className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/70 border-2 border-[#facc15] shadow-[0_0_16px_rgba(250,204,21,0.25)] hover:shadow-[0_0_24px_rgba(250,204,21,0.35)] transition-all duration-300">
                  <ChevronsUpDown size={18} className="text-[#facc15]" />
                  <span className="text-[11px] font-black font-display uppercase tracking-widest text-[#facc15]">⇅ BROWSE</span>
                </div>
                <Link
                  to="/climb"
                  onClick={playClick}
                  onMouseEnter={playHover}
                  className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/70 border-2 border-amber-400/70 shadow-[0_0_16px_rgba(251,191,36,0.25)] hover:shadow-[0_0_24px_rgba(251,191,36,0.35)] transition-all duration-300"
                >
                  <Trophy size={18} className="text-amber-400" />
                  <span className="text-[11px] font-black font-display uppercase tracking-widest text-amber-400">Climb the ranks</span>
                </Link>
              </div>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 md:gap-8 min-w-0">
            <Reveal delay={150}>
              <div className="group relative rounded-2xl p-4 sm:p-5 flex flex-col items-center min-w-0 w-full max-w-full overflow-visible transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
                style={{
                  background: 'linear-gradient(145deg, rgba(255,30,109,0.08) 0%, rgba(5,8,20,0.98) 50%, rgba(0,243,255,0.03) 100%)',
                  border: '2px solid rgba(255,30,109,0.6)',
                  boxShadow: '0 0 24px rgba(255,30,109,0.15), 0 20px 50px rgba(0,0,0,0.5)',
                }}
              >
                <div className="absolute inset-0 animate-slot-shimmer pointer-events-none" />
                <div className="absolute top-3 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ff1e6d]/20 border border-[#ff1e6d]/70 shadow-[0_0_12px_rgba(255,30,109,0.2)] animate-badge-bounce">
                  <Flame size={14} className="text-[#ff1e6d]" />
                  <span className="text-[10px] font-black font-display uppercase tracking-wider text-[#ff1e6d]">HOT</span>
                </div>
                <AtomSectionCarousel
                  title="Top by ROI (daily)"
                  subtitle="Updates daily · most activity"
                  agents={atomSections.roiDaily}
                  walletAddress={walletAddress}
                  onSwipeRight={(a) => setBuyPanelAgent(a)}
                  onSwipeLeft={(a) => {
                    if (!walletAddress) { openConnectModal?.(); return; }
                    const added = toggleWatchlist(a.id, walletAddress);
                    toast.success(added ? 'Added to watchlist' : 'Removed from watchlist');
                  }}
                  isInWatchlist={(id) => (walletAddress ? isInWatchlist(id, walletAddress) : false)}
                  showRoi
                  sectionColor="#ff1e6d"
                />
              </div>
            </Reveal>
            <Reveal delay={280}>
              <div className="group relative rounded-2xl p-4 sm:p-5 flex flex-col items-center min-w-0 w-full max-w-full overflow-visible transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
                style={{
                  background: 'linear-gradient(145deg, rgba(0,243,255,0.08) 0%, rgba(5,8,20,0.98) 50%, rgba(168,85,247,0.03) 100%)',
                  border: '2px solid rgba(0,243,255,0.6)',
                  boxShadow: '0 0 24px rgba(0,243,255,0.15), 0 20px 50px rgba(0,0,0,0.5)',
                }}
              >
                <div className="absolute inset-0 animate-slot-shimmer pointer-events-none" />
                <div className="absolute top-3 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00f3ff]/20 border border-[#00f3ff]/70 shadow-[0_0_12px_rgba(0,243,255,0.2)] animate-badge-bounce" style={{ animationDelay: '0.3s' }}>
                  <Zap size={14} className="text-[#00f3ff]" />
                  <span className="text-[10px] font-black font-display uppercase tracking-wider text-[#00f3ff]">MOON</span>
                </div>
                <AtomSectionCarousel
                  title="Top by market cap"
                  subtitle="Largest reputation markets"
                  agents={atomSections.byMarketcap}
                  walletAddress={walletAddress}
                  onSwipeRight={(a) => setBuyPanelAgent(a)}
                  onSwipeLeft={(a) => {
                    if (!walletAddress) { openConnectModal?.(); return; }
                    const added = toggleWatchlist(a.id, walletAddress);
                    toast.success(added ? 'Added to watchlist' : 'Removed from watchlist');
                  }}
                  isInWatchlist={(id) => (walletAddress ? isInWatchlist(id, walletAddress) : false)}
                  sectionColor="#00f3ff"
                />
              </div>
            </Reveal>
            <Reveal delay={410}>
              <div className="group relative rounded-2xl p-4 sm:p-5 flex flex-col items-center min-w-0 w-full max-w-full overflow-visible transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
                style={{
                  background: 'linear-gradient(145deg, rgba(250,204,21,0.06) 0%, rgba(5,8,20,0.98) 50%, rgba(34,197,94,0.03) 100%)',
                  border: '2px solid rgba(250,204,21,0.6)',
                  boxShadow: '0 0 24px rgba(250,204,21,0.15), 0 20px 50px rgba(0,0,0,0.5)',
                }}
              >
                <div className="absolute inset-0 animate-slot-shimmer pointer-events-none" />
                <div className="absolute top-3 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#facc15]/20 border border-[#facc15]/70 shadow-[0_0_12px_rgba(250,204,21,0.2)] animate-badge-bounce" style={{ animationDelay: '0.6s' }}>
                  <Sparkles size={14} className="text-[#facc15]" />
                  <span className="text-[10px] font-black font-display uppercase tracking-wider text-[#facc15]">NEW</span>
                </div>
                <AtomSectionCarousel
                  title="Newly created"
                  subtitle="Fresh atoms as they appear"
                  agents={atomSections.newlyCreated}
                  walletAddress={walletAddress}
                  onSwipeRight={(a) => setBuyPanelAgent(a)}
                  onSwipeLeft={(a) => {
                    if (!walletAddress) { openConnectModal?.(); return; }
                    const added = toggleWatchlist(a.id, walletAddress);
                    toast.success(added ? 'Added to watchlist' : 'Removed from watchlist');
                  }}
                  isInWatchlist={(id) => (walletAddress ? isInWatchlist(id, walletAddress) : false)}
                  showCreatedAgo
                  sectionColor="#facc15"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 2. SEASON 2 LEADERBOARD — live snippet (expanded view on /stats) */}
      <section
        ref={setSeason2Anchor}
        className="relative overflow-hidden min-w-0 py-12 sm:py-16 border-b border-white/5 bg-gradient-to-b from-[#060a12] via-[#050810] to-[#04060a]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(251,191,36,0.06),_transparent_50%)] pointer-events-none" />
        <div
          className="relative max-w-6xl mx-auto min-w-0 w-full px-4 sm:px-6 md:px-8"
          style={{ paddingLeft: 'clamp(1.5rem, 5vw, 4rem)', paddingRight: 'clamp(1.5rem, 5vw, 4rem)' }}
        >
          <Reveal delay={80}>
            <Season2LeaderboardPanel variant="home" loadEnabled={season2LoadEnabled} />
          </Reveal>
        </div>
      </section>

      {/* 3. CTA — third */}
      <section className="relative overflow-hidden min-w-0 py-20 sm:py-28 md:py-32 border-b border-white/5 bg-gradient-to-b from-[#050810] to-[#04060a]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(0,243,255,0.03),transparent)] pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center" style={{ paddingLeft: 'clamp(1.5rem, 5vw, 4rem)', paddingRight: 'clamp(1.5rem, 5vw, 4rem)' }}>
          <Reveal delay={100}>
            <div className="relative rounded-[2rem] sm:rounded-[2.5rem] p-12 sm:p-16 md:p-20 border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
              <div className="absolute -inset-px rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-b from-intuition-primary/20 via-transparent to-intuition-secondary/20 opacity-60 -z-10" />
              <p className="text-slate-400 text-base sm:text-lg mb-6 font-medium">
                Still can&apos;t find what to buy?
              </p>
              <p className="text-slate-100 text-xl sm:text-2xl md:text-3xl mb-10 leading-relaxed">
                Our <Link to="/markets" onClick={playClick} className="text-intuition-primary font-semibold hover:text-intuition-primary/80 transition-colors">Markets</Link> page has a wide variety of Atoms — stake to earn {CURRENCY_SYMBOL}, or trade the <span className="text-intuition-secondary font-semibold">exponential curve</span> for higher rewards.
              </p>
              <Link
                to="/markets"
                onClick={playClick}
                className="group inline-flex items-center gap-3 px-10 sm:px-12 py-5 sm:py-6 rounded-2xl bg-gradient-to-r from-intuition-primary/15 to-intuition-secondary/15 border border-intuition-primary/40 text-white font-semibold text-base sm:text-lg hover:from-intuition-primary/25 hover:to-intuition-secondary/25 hover:border-intuition-primary/60 hover:shadow-[0_0_30px_rgba(0,243,255,0.15)] transition-all duration-300"
              >
                Explore Markets
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-0.5 transition-transform text-intuition-primary" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* System pulse — below LB and Trending Atoms */}
      <div className="w-full min-w-0 border-y-2 border-intuition-secondary/20 bg-black/90 py-1 overflow-hidden flex items-stretch group relative z-20 shadow-2xl">
         <div className="bg-black z-30 px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex items-center gap-2 sm:gap-4 border-r-2 border-intuition-secondary/40 shadow-[25px_0_45px_rgba(0,0,0,1)] shrink-0">
            <div className="w-3 h-3 rounded-full bg-intuition-secondary animate-pulse-fast shadow-[0_0_15px_#ff0055]"></div>
            <span className="text-[9px] sm:text-[11px] font-black font-display text-white tracking-[0.2em] sm:tracking-[0.3em] uppercase text-glow-white whitespace-nowrap">SYSTEM_PULSE</span>
         </div>
         <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar">
            <div className="flex w-max min-h-full animate-marquee group-hover:[animation-play-state:paused]">
               <div className="flex shrink-0">
                  {tickerData.length > 0 ? tickerData.map((item, i) => (
                     <TickerItem key={i} symbol={item.symbol} price={item.price} isUp={item.isUp} />
                  )) : <div className="px-8 sm:px-20 text-[9px] sm:text-[10px] font-mono text-slate-300 animate-pulse uppercase tracking-[0.5em] font-black">Establishing neural uplink...</div>}
               </div>
               <div className="flex shrink-0">
                  {tickerData.length > 0 ? tickerData.map((item, i) => (
                     <TickerItem key={`d-${i}`} symbol={item.symbol} price={item.price} isUp={item.isUp} />
                  )) : null}
               </div>
            </div>
         </div>
      </div>

      <BuySidePanel
        agent={buyPanelAgent}
        isOpen={!!buyPanelAgent}
        onClose={() => setBuyPanelAgent(null)}
        onSuccess={(agentLabel) => setAcquisitionSuccess({ agentLabel })}
        walletAddress={walletAddress}
        openConnectModal={openConnectModal}
      />

      <div className="py-16 sm:py-24 md:py-40 bg-[#04060b] relative overflow-hidden border-b border-white/5 min-w-0">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-intuition-secondary/[0.06] rounded-full blur-[140px] pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 min-w-0">
          <div className="mb-12 md:mb-24 flex flex-col md:flex-row justify-between items-end gap-8 md:gap-10">
            <Reveal className="max-w-3xl min-w-0">
                <div className="flex items-center gap-3 text-intuition-secondary font-black font-mono text-[10px] sm:text-xs mb-6 sm:mb-8 tracking-[0.4em] sm:tracking-[0.6em] uppercase text-glow-red">
                    <Binary size={18} className="sm:w-5 sm:h-5" /> Protocol_Engineering
                </div>
                <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black text-white font-display leading-[0.85] tracking-tighter uppercase mb-4 md:mb-6 text-glow-white">
                  SEMANTIC<br/><span className="text-intuition-secondary text-glow-red">DYNAMICS</span>
                </h2>
                <p className="text-slate-200 text-base sm:text-lg md:text-xl font-mono uppercase tracking-widest leading-relaxed font-black">
                  Mapping global consensus with cryptographic precision.
                </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 min-w-0">
              {[
                  { num: "01", icon: <Shield size={40}/>, color: "text-intuition-primary text-glow-blue", border: "border-intuition-primary/30", glow: "hover:border-intuition-primary hover:shadow-glow-blue", title: "VERIFIED_ATOMS", desc: "Every unique identity is anchored as a persistent primitive in the graph, ready for valuation." },
                  { num: "02", icon: <Binary size={40}/>, color: "text-intuition-secondary text-glow-red", border: "border-intuition-secondary/40", glow: "hover:border-intuition-secondary hover:shadow-glow-red", title: "LOGIC_TRIPLES", desc: "Claims are structured as machine-readable semantic links, creating a network of truth." },
                  { num: "03", icon: <Activity size={40}/>, color: "text-white text-glow-white", border: "border-white/20", glow: "hover:border-white hover:shadow-2xl", title: "STAKE_CONSENSUS", desc: "Conviction is quantified through capital allocation, making deception economically irrational." }
              ].map((item, i) => (
                  <Reveal key={i} delay={200 + (i * 150)}>
                      <div className={`min-w-0 p-6 sm:p-8 md:p-10 bg-black border-2 ${item.border} ${item.glow} motion-hover-lift clip-path-slant group relative overflow-hidden h-full flex flex-col hover:shadow-[0_0_40px_rgba(255,0,85,0.25)]`}>
                          <div className="absolute top-0 right-0 p-2 sm:p-4 text-[4rem] sm:text-[5rem] md:text-[7rem] font-black text-white/5 font-display italic pointer-events-none group-hover:text-intuition-secondary/10 transition-colors">{item.num}</div>
                          <div className={`w-16 h-16 sm:w-20 sm:h-20 bg-white/5 border-2 ${item.border} flex items-center justify-center ${item.color} group-hover:scale-110 transition-all duration-700 mb-6 sm:mb-10 clip-path-slant shadow-2xl shrink-0`}>
                              {item.icon}
                          </div>
                          <h4 className={`text-lg sm:text-xl md:text-2xl font-black font-display text-white mb-4 md:mb-6 uppercase group-hover:text-intuition-secondary transition-all break-words ${item.num === '02' ? 'text-glow-red' : 'group-hover:text-glow-white'}`}>{item.title}</h4>
                          <p className="text-slate-300 font-mono text-xs sm:text-sm leading-relaxed tracking-wider uppercase font-black opacity-100 min-w-0">{item.desc}</p>
                      </div>
                  </Reveal>
              ))}
          </div>
        </div>
      </div>

      <div className="py-40 bg-intuition-dark relative border-y-2 border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10">
          <Reveal className="mb-20 flex items-center gap-6">
            <div className="w-12 h-12 bg-intuition-secondary/10 border border-intuition-secondary flex items-center justify-center clip-path-slant shadow-glow-red">
                <Activity className="text-intuition-secondary animate-pulse" size={24} />
            </div>
            <h2 className="text-4xl md:text-5xl font-black font-display text-white tracking-tight uppercase text-glow-red">The network in numbers</h2>
          </Reveal>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            <Reveal delay={100}><div className="min-w-0"><StatBox label="TRUST locked" value={formattedVolume} sub={`Total ${CURRENCY_SYMBOL} in markets`} icon={<Box size={18}/>} color="secondary" /></div></Reveal>
            <Reveal delay={200}><div className="min-w-0"><StatBox label="Identities" value={stats.atoms.toLocaleString()} sub="People, projects & topics" icon={<HardDrive size={18}/>} color="primary" /></div></Reveal>
            <Reveal delay={300}><div className="min-w-0"><StatBox label="Claims" value={stats.signals.toLocaleString()} sub="Statements on the graph" icon={<Binary size={18}/>} color="secondary" /></div></Reveal>
            <Reveal delay={400}><div className="min-w-0"><StatBox label="Open positions" value={stats.positions.toLocaleString()} sub="Active stakes" icon={<Activity size={18}/>} color="primary" /></div></Reveal>
          </div>
        </div>
      </div>

      <section id="email-alerts" className="py-20 sm:py-28 md:py-32 relative overflow-hidden border-y-2 border-amber-400/30 bg-[#04060b] min-w-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_30%,rgba(251,191,36,0.1),_transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_70%,rgba(168,85,247,0.06),_transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] retro-grid pointer-events-none" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Reveal delay={100}>
            <div className="inline-flex items-center gap-3 px-4 py-2 mb-6 bg-black/60 border-2 border-amber-400/70 text-amber-300 font-mono uppercase tracking-[0.5em] text-[10px] font-black clip-path-slant shadow-[0_0_28px_rgba(251,191,36,0.3)]">
              <Mail size={20} className="shrink-0" />
              EMAIL ALERTS
            </div>
            <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black font-display text-white uppercase tracking-tighter mb-4 text-glow-white leading-tight">
              Get notified about activity on your claims<br className="hidden sm:block" /> <span className="text-amber-300 text-glow-gold">via email</span>
            </h3>
            <p className="text-slate-300 font-mono text-sm sm:text-base max-w-xl mx-auto mb-10 leading-relaxed">
              When others buy or sell in claims you hold, we’ll notify you in the app and by email. Connect your wallet and add your email below.
            </p>
            <button
              type="button"
              onClick={() => { playClick(); openEmailNotify(); }}
              onMouseEnter={playHover}
              className="btn-cyber px-8 py-4 text-sm sm:text-base bg-amber-400 text-black font-black tracking-[0.2em] border-2 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.4)] hover:bg-amber-300 hover:border-amber-300 hover:shadow-[0_0_40px_rgba(251,191,36,0.5),0_0_0_1px_rgba(168,85,247,0.3)] active:scale-[0.98] transition-all duration-300 inline-flex items-center gap-3 motion-hover-scale"
            >
              <Mail size={18} />
              GET EMAIL ALERTS
            </button>
          </Reveal>
        </div>
      </section>

      <MissionTerminal />

    </div>
  );
};

const StatBox = ({ label, value, sub, icon, color }: any) => {
    const isRed = color === 'secondary';
    const borderClass = isRed ? 'border-intuition-secondary/40 hover:border-intuition-secondary' : 'border-intuition-primary/30 hover:border-intuition-primary';
    const textClass = isRed ? 'group-hover:text-intuition-secondary' : 'group-hover:text-intuition-primary';
    const glowClass = isRed ? 'text-glow-red' : 'text-glow-blue';
    const bgClass = isRed ? 'bg-intuition-secondary shadow-glow-red' : 'bg-intuition-primary shadow-glow-blue';

    const valStr = value.toString();
    const valLength = valStr.length;
    
    const getFontSize = () => {
        if (valLength > 14) return 'text-base sm:text-lg md:text-xl';
        if (valLength > 12) return 'text-lg sm:text-xl md:text-2xl';
        if (valLength > 10) return 'text-xl sm:text-2xl md:text-3xl';
        if (valLength > 8) return 'text-2xl sm:text-3xl md:text-4xl';
        return 'text-3xl sm:text-4xl md:text-5xl';
    };

    return (
      <div className={`relative p-8 bg-[#02040a] group motion-hover-lift flex flex-col h-72 overflow-hidden border-2 ${borderClass} shadow-2xl clip-path-slant select-none hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] min-w-0`}>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] opacity-10 pointer-events-none"></div>
        
        <div className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 ${isRed ? 'border-intuition-secondary/60' : 'border-intuition-primary/60'} opacity-40 group-hover:opacity-100 transition-opacity duration-500`}></div>
        <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 ${isRed ? 'border-intuition-secondary/60' : 'border-intuition-primary/60'} opacity-40 group-hover:opacity-100 transition-opacity duration-500`}></div>
        
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-40 pointer-events-none"></div>
        
        <div className="flex justify-between items-start mb-6 relative z-10 shrink-0">
            <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-slate-300 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-bold text-balance group-hover:text-white transition-colors [text-shadow:0_0_24px_rgba(255,255,255,0.12)]">{label}</span>
                <div className={`h-[2px] w-12 ${isRed ? 'bg-intuition-secondary' : 'bg-intuition-primary'} opacity-70 group-hover:w-full transition-all duration-1000`}></div>
            </div>
            <div className={`p-3 bg-black border border-white/10 rounded-none clip-path-slant transition-all duration-500 group-hover:scale-110 group-hover:border-current shadow-inner shrink-0 ${textClass}`}>
                {icon}
            </div>
        </div>

        <div className="flex-1 flex items-center justify-start relative z-10 min-h-0 min-w-0 overflow-hidden">
            <div title={valStr} className={`font-black text-white font-display transition-all duration-500 tracking-tighter w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-[1.35] group-hover:scale-[1.02] ${getFontSize()} ${glowClass}`}>
                {value}
            </div>
        </div>

        <div className="mt-auto relative z-10 pt-4 flex items-center justify-between gap-3 border-t border-white/10">
            <div className="text-slate-300 font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.12em] font-semibold leading-snug text-balance group-hover:text-white transition-colors flex items-start gap-2 min-w-0">
                <div className={`w-2 h-2 mt-0.5 shrink-0 ${bgClass.split(' ')[0]} animate-pulse shadow-[0_0_10px_currentColor] clip-path-slant`}></div>
                <span>{sub}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                <span className="text-[9px] font-semibold font-mono uppercase tracking-wide">Live</span>
                <Network size={14} className="text-slate-400 opacity-90" aria-hidden />
            </div>
        </div>
        
        <div className={`absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-${isRed ? 'intuition-secondary' : 'intuition-primary'}/10 to-transparent -translate-y-full group-hover:animate-[scanline_3s_linear_infinite] pointer-events-none`}></div>

        <div className={`absolute bottom-0 left-0 h-1.5 w-full ${bgClass.split(' ')[0]} scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left shadow-[0_0_20px_currentColor]`}></div>
      </div>
    );
};

export default Home;
