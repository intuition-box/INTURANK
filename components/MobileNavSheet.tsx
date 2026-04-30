/**
 * MobileNavSheet — bottom sheet launched from the center FAB on mobile.
 * Holds every destination so the floating bar can stay tight (5 slots).
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X, TrendingUp, Users, Activity, Send, UserCircle, Cpu, Globe, FileText,
  BarChart2, HeartPulse, Coins, Plus, Swords, Wallet, LogOut, ExternalLink,
} from 'lucide-react';
import { playClick, playHover } from '../services/audio';

const TRUST_SWAP_URL = 'https://aero.drome.eth.limo/swap?from=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&to=0x6cd905df2ed214b22e0d48ff17cd4200c1c6d8a3&chain0=8453&chain1=8453';

interface SheetItem {
  label: string;
  desc: string;
  to: string;
  icon: React.ReactNode;
  external?: boolean;
  accent: 'cyan' | 'magenta' | 'gold' | 'green' | 'purple' | 'slate';
}

const SECTIONS: Array<{ heading: string; items: SheetItem[] }> = [
  {
    heading: 'Markets',
    items: [
      { label: 'Markets', desc: 'Atoms, triples, lists', to: '/markets', icon: <TrendingUp size={20} />, accent: 'cyan' },
      { label: 'Activity', desc: 'Live network feed', to: '/feed', icon: <Globe size={20} />, accent: 'cyan' },
      { label: 'Compare', desc: 'Atom vs atom', to: '/compare', icon: <Swords size={20} />, accent: 'magenta' },
    ],
  },
  {
    heading: 'You',
    items: [
      { label: 'Portfolio', desc: 'Your positions', to: '/portfolio', icon: <Users size={20} />, accent: 'cyan' },
      { label: 'Profile', desc: 'Identity + badges', to: '/account', icon: <UserCircle size={20} />, accent: 'purple' },
      { label: 'Send Trust', desc: 'Transfer ₸', to: '/send-trust', icon: <Send size={20} />, accent: 'gold' },
    ],
  },
  {
    heading: 'Play',
    items: [
      { label: 'The Arena', desc: 'Climb the ranks', to: '/climb', icon: <Activity size={20} />, accent: 'magenta' },
      { label: 'Leaderboard', desc: 'Top rankers', to: '/stats', icon: <BarChart2 size={20} />, accent: 'gold' },
      { label: 'Skill Agent', desc: 'Intuition AI', to: '/skill-playground', icon: <Cpu size={20} />, accent: 'purple' },
    ],
  },
  {
    heading: 'More',
    items: [
      { label: 'Get Trust', desc: 'Swap to ₸ on Aerodrome', to: TRUST_SWAP_URL, icon: <Coins size={20} />, accent: 'green', external: true },
      { label: 'Documentation', desc: 'How IntuRank works', to: '/documentation', icon: <FileText size={20} />, accent: 'slate' },
      { label: 'System Health', desc: 'Live KPIs', to: '/health', icon: <HeartPulse size={20} />, accent: 'slate' },
    ],
  },
];

const accentClasses: Record<SheetItem['accent'], { ring: string; bg: string; icon: string; glow: string }> = {
  cyan: {
    ring: 'border-intuition-primary/35',
    bg: 'bg-intuition-primary/8',
    icon: 'text-intuition-primary',
    glow: 'shadow-[0_8px_24px_rgba(0,243,255,0.18)]',
  },
  magenta: {
    ring: 'border-intuition-secondary/40',
    bg: 'bg-intuition-secondary/10',
    icon: 'text-intuition-secondary',
    glow: 'shadow-[0_8px_24px_rgba(255,30,109,0.18)]',
  },
  gold: {
    ring: 'border-intuition-warning/40',
    bg: 'bg-intuition-warning/10',
    icon: 'text-intuition-warning',
    glow: 'shadow-[0_8px_24px_rgba(250,204,21,0.18)]',
  },
  green: {
    ring: 'border-intuition-success/40',
    bg: 'bg-intuition-success/10',
    icon: 'text-intuition-success',
    glow: 'shadow-[0_8px_24px_rgba(0,255,157,0.18)]',
  },
  purple: {
    ring: 'border-intuition-purple/40',
    bg: 'bg-intuition-purple/10',
    icon: 'text-intuition-purple',
    glow: 'shadow-[0_8px_24px_rgba(168,85,247,0.18)]',
  },
  slate: {
    ring: 'border-white/10',
    bg: 'bg-white/[0.04]',
    icon: 'text-slate-300',
    glow: 'shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
  },
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  walletAddress?: string | null;
}

const MobileNavSheet: React.FC<Props> = ({ open, onClose, onCreate, onConnect, onDisconnect, walletAddress }) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleNavigate = () => {
    playClick();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center md:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => {
          playClick();
          onClose();
        }}
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      />

      <div
        className="relative w-full max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[2rem] border-t border-x border-intuition-primary/20 bg-gradient-to-b from-[#0a0e1a] via-[#06080f] to-[#020308] shadow-[0_-30px_80px_rgba(0,0,0,0.8),0_-1px_0_rgba(0,243,255,0.18)] animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        <div className="sticky top-0 z-10 px-5 pt-3 pb-3 bg-gradient-to-b from-[#0a0e1a] via-[#0a0e1a]/95 to-[#0a0e1a]/0 backdrop-blur-sm">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/15 mb-4" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono tracking-[0.32em] text-intuition-primary/80 uppercase font-black">
                Navigate
              </p>
              <h2 className="text-xl font-display font-black text-white tracking-wide mt-0.5">
                Where to next?
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                playClick();
                onClose();
              }}
              className="h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 active:scale-95 transition-transform"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-5 pb-2 pt-1 space-y-6">
          <button
            type="button"
            onClick={() => {
              playClick();
              onClose();
              onCreate();
            }}
            className="w-full relative overflow-hidden flex items-center gap-4 px-5 py-4 rounded-2xl bg-gradient-to-r from-intuition-secondary via-intuition-secondary to-intuition-purple text-white shadow-[0_18px_48px_rgba(255,30,109,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] active:scale-[0.98] transition-transform"
          >
            <span className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center shadow-inner">
              <Plus size={24} strokeWidth={2.5} />
            </span>
            <span className="text-left flex-1 min-w-0">
              <span className="block text-sm font-display font-black uppercase tracking-[0.18em]">
                Create Atom or Claim
              </span>
              <span className="block text-[11px] font-mono opacity-80 mt-0.5">
                Mint a new identity, predicate, or signed claim
              </span>
            </span>
          </button>

          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="text-[10px] font-mono uppercase tracking-[0.32em] text-slate-500 font-black mb-3 px-1">
                {section.heading}
              </p>
              <div className="space-y-2.5">
                {section.items.map((item) => {
                  const a = accentClasses[item.accent];
                  const inner = (
                    <>
                      <span className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center border ${a.ring} ${a.bg} ${a.icon} ${a.glow}`}>
                        {item.icon}
                      </span>
                      <span className="flex-1 min-w-0 text-left">
                        <span className="flex items-center gap-2 text-[15px] font-semibold text-white">
                          <span className="truncate">{item.label}</span>
                          {item.external && <ExternalLink size={12} className="text-slate-500 shrink-0" />}
                        </span>
                        <span className="block text-[12px] text-slate-400 truncate mt-0.5">
                          {item.desc}
                        </span>
                      </span>
                    </>
                  );
                  const cls = 'flex items-center gap-4 px-3 py-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] active:bg-white/[0.05] active:scale-[0.99] transition-transform';
                  if (item.external) {
                    return (
                      <a
                        key={item.label}
                        href={item.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleNavigate}
                        onMouseEnter={playHover}
                        className={cls}
                      >
                        {inner}
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={handleNavigate}
                      onMouseEnter={playHover}
                      className={cls}
                    >
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="pt-2">
            {walletAddress ? (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  onClose();
                  onDisconnect();
                }}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-4 rounded-2xl border border-intuition-danger/40 bg-intuition-danger/10 text-intuition-danger font-mono font-black text-[11px] tracking-[0.28em] uppercase active:scale-[0.99] transition-transform"
              >
                <LogOut size={16} /> End Session
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  onClose();
                  onConnect();
                }}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-4 rounded-2xl bg-gradient-to-r from-intuition-primary to-cyan-300 text-black font-mono font-black text-[11px] tracking-[0.28em] uppercase shadow-[0_12px_36px_rgba(0,243,255,0.3)] active:scale-[0.99] transition-transform"
              >
                <Wallet size={16} /> Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileNavSheet;
