import { Link, useLocation, useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect, useConnect, useConfig } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { Wallet, Menu, X, TrendingUp, Users, BarChart2, LogOut, Copy, ChevronDown, AlertTriangle, Globe, ArrowRightLeft, Activity, Home, UserCircle, Search, Github, Plus, Shield, ExternalLink, BookOpen, MessageSquare, Twitter, Send, Coins, HeartPulse, FileText, ChevronsRight, BadgeCheck, Volume2, VolumeX, Swords, Cpu } from 'lucide-react';
import { switchNetwork, disconnectWallet, setWagmiConnection, setOpenConnectModalRef } from '../services/web3';
import { APP_VERSION, APP_VERSION_DISPLAY, CHAIN_ID } from '../constants';
import { playHover, playClick, getSoundEnabled, setSoundEnabled } from '../services/audio';
import Logo from './Logo';
import NotificationBar from './NotificationBar';
import { toast } from './Toast';
import { setEmailFailureHandler, maybeSendDailyDigest } from '../services/emailNotifications';
import { mergeFollowsFromServer } from '../services/follows';
import ProfileBadgeWidget from './ProfileBadgeWidget';

interface LayoutProps {
  children: React.ReactNode;
}

const TRUST_SWAP_URL = "https://aero.drome.eth.limo/swap?from=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&to=0x6cd905df2ed214b22e0d48ff17cd4200c1c6d8a3&chain0=8453&chain1=8453";

/** Module-level nav config — stable icon references so React.memo(NavItem) works and hover doesn’t thrash. */
const MAIN_NAV_ITEMS: Array<{
  label: string;
  path: string;
  icon: React.ReactNode;
  variant?: 'gold';
}> = [
  { label: 'MARKETS', path: '/markets', icon: <TrendingUp size={18} strokeWidth={2} /> },
  { label: 'PORTFOLIO', path: '/portfolio', icon: <Users size={18} strokeWidth={2} /> },
  { label: 'THE ARENA', path: '/climb', icon: <Activity size={18} strokeWidth={2} /> },
  { label: 'SEND TRUST', path: '/send-trust', icon: <Send size={18} strokeWidth={2} />, variant: 'gold' },
  { label: 'PROFILE', path: '/account', icon: <UserCircle size={18} strokeWidth={2} /> },
  { label: 'INTUITION_SKILL', path: '/skill-playground', icon: <Cpu size={18} strokeWidth={2} /> },
];

const VERSUS_NAV_ITEMS = [{ label: 'BATTLEGROUND', path: '/climb', icon: <Swords size={18} strokeWidth={2} /> }];

const EXPLORE_NAV_ITEMS: Array<{
  label: string;
  path: string;
  icon: React.ReactNode;
  external?: boolean;
}> = [
  { label: 'ACTIVITY', path: '/feed', icon: <Globe size={18} strokeWidth={2} /> },
  { label: 'DOCUMENTATION', path: '/documentation', icon: <FileText size={18} strokeWidth={2} /> },
  { label: 'LEADERBOARD', path: '/stats', icon: <BarChart2 size={18} strokeWidth={2} /> },
  { label: 'GET TRUST', path: TRUST_SWAP_URL, icon: <Coins size={18} strokeWidth={2} />, external: true },
];

const MONITOR_NAV_ITEMS = [{ label: 'System health', path: '/health', icon: <HeartPulse size={18} strokeWidth={2} /> }];

const ALL_MOBILE_NAV_ITEMS = [...MAIN_NAV_ITEMS, ...VERSUS_NAV_ITEMS, ...EXPLORE_NAV_ITEMS, ...MONITOR_NAV_ITEMS];

const MediumIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42zM24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75c.66 0 1.19 2.58 1.19 5.75z" />
  </svg>
);

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const IntuitionTargetLogo = () => (
  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover/powered:scale-110 transition-transform duration-700">
    <circle cx="30" cy="30" r="28" stroke="#00f3ff" strokeWidth="1" strokeOpacity="0.2" />
    <circle cx="30" cy="30" r="20" stroke="#00f3ff" strokeWidth="1" strokeOpacity="0.4" />
    <circle cx="30" cy="30" r="12" stroke="#00f3ff" strokeWidth="2" />
    <circle cx="30" cy="30" r="4" fill="#00f3ff" />
  </svg>
);

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  /** Gold accent for Send Trust — distinct from cyan primary nav */
  variant?: 'default' | 'gold' | 'success';
  /** Opens in new tab (e.g. Get Trust swap) — uses <a>, not router Link */
  external?: boolean;
}

const NavItem = memo(function NavItem({
  to,
  label,
  icon,
  active,
  onClick,
  variant = 'default',
  external = false,
}: NavItemProps) {
  const isGold = variant === 'gold';
  const isSuccess = variant === 'success';
  const activeCls = isGold
    ? 'text-black bg-intuition-warning border-intuition-warning shadow-[0_0_14px_rgba(250,204,21,0.5)] ring-1 ring-amber-400/45'
    : isSuccess
      ? 'text-black bg-intuition-success border-intuition-success shadow-[0_0_14px_rgba(0,255,157,0.45)] ring-1 ring-intuition-success/40'
      : 'text-black bg-intuition-primary border-intuition-primary shadow-[0_0_12px_rgba(0,243,255,0.35)] ring-1 ring-intuition-primary/40';
  const idleCls = isGold
    ? 'text-amber-200/95 border border-amber-500/35 bg-gradient-to-br from-amber-950/50 to-black/60 hover:text-amber-50 hover:border-amber-400/75 hover:bg-amber-500/12 hover:shadow-[0_0_18px_rgba(250,204,21,0.22)]'
    : isSuccess
      ? 'text-intuition-success border border-intuition-success/35 bg-intuition-success/5 hover:text-intuition-success hover:border-intuition-success/70 hover:bg-intuition-success/12 hover:shadow-[0_0_16px_rgba(0,255,157,0.22)]'
      : 'text-slate-400 border-transparent bg-white/5 hover:text-white hover:border-intuition-primary/60 hover:bg-intuition-primary/15';

  const cls = `relative flex items-center gap-0 group-hover/sidebar:gap-2.5 group-focus-within/sidebar:gap-2.5 justify-center group-hover/sidebar:justify-start group-focus-within/sidebar:justify-start px-2 group-hover/sidebar:px-4 group-focus-within/sidebar:px-4 sm:group-hover/sidebar:px-5 sm:group-focus-within/sidebar:px-5 py-2.5 min-h-[44px] text-[10px] font-black tracking-[0.25em] font-mono rounded-xl sm:rounded-full border min-w-0 motion-reduce:transition-none motion-reduce:duration-0 transition-[gap,padding,background-color,border-color,color,box-shadow] duration-200 ease-out ${
    active ? activeCls : idleCls
  }`;

  const handleActivate = () => {
    playClick();
    onClick();
  };

  const inner = (
    <>
      <span className="shrink-0 flex items-center justify-center w-5 [&>svg]:shrink-0">{icon}</span>
      <span className="whitespace-nowrap overflow-hidden text-left max-w-0 opacity-0 motion-reduce:transition-none motion-reduce:duration-0 transition-opacity duration-200 ease-out group-hover/sidebar:max-w-[13rem] xl:group-hover/sidebar:max-w-[15rem] group-hover/sidebar:opacity-100 group-focus-within/sidebar:max-w-[13rem] xl:group-focus-within/sidebar:max-w-[15rem] group-focus-within/sidebar:opacity-100 flex-1 min-w-0">
        {label}
      </span>
    </>
  );

  if (external) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        title={label}
        onClick={handleActivate}
        onMouseEnter={playHover}
        className={cls}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link to={to} title={label} onClick={handleActivate} onMouseEnter={playHover} className={cls}>
      {inner}
    </Link>
  );
});

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [isIntelOpen, setIsIntelOpen] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(() => getSoundEnabled());

  const { openConnectModal } = useConnectModal();
  const wagmiConfig = useConfig();
  // useAccount in wagmi v2 does not support `select`; passing { select } still returns the full account object,
  // which made `walletAddress` an object and broke `.slice()` in ProfileBadgeWidget etc.
  const { address: walletAddress, isConnected, chainId = 0 } = useAccount();
  const { disconnect } = useDisconnect();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const intelRef = useRef<HTMLDivElement>(null);
  const sidebarAsideRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Sync RainbowKit/wagmi → web3 (getProvider / sendTransaction). Do not use connector.getProvider():
  // some connectors exposed via React do not implement it; getWalletClient uses the live connection.
  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setWagmiConnection(null, null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const wc = await getWalletClient(wagmiConfig, {
          chainId: CHAIN_ID,
          account: walletAddress as `0x${string}`,
          assertChainId: false,
        });
        const eip1193 = {
          request: (args: { method: string; params?: readonly unknown[] | object }) =>
            wc.request(args as Parameters<(typeof wc)['request']>[0]),
        };
        if (!cancelled) setWagmiConnection(walletAddress, eip1193 as unknown as typeof window.ethereum);
      } catch {
        const injected = typeof window !== 'undefined' ? (window as unknown as { ethereum?: unknown }).ethereum : undefined;
        if (!cancelled) setWagmiConnection(walletAddress, (injected as typeof window.ethereum) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, walletAddress, wagmiConfig]);

  // Let legacy connectWallet() calls (Account, Portfolio, etc.) open the RainbowKit modal
  useEffect(() => {
    setOpenConnectModalRef(() => openConnectModal?.());
    return () => setOpenConnectModalRef(null);
  }, [openConnectModal]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      const t = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(t)) {
        setIsWalletDropdownOpen(false);
      }
      if (intelRef.current && !intelRef.current.contains(t)) {
        setIsIntelOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, []);

  // Surface email delivery failures to the user (e.g. follow alerts, activity notifications)
  useEffect(() => {
    setEmailFailureHandler((msg) => toast.error(msg));
    return () => setEmailFailureHandler(null);
  }, []);

  // When wallet is set and user has daily digest, send digest if 24h passed and queue has items
  useEffect(() => {
    if (walletAddress) maybeSendDailyDigest(walletAddress).catch(() => {});
  }, [walletAddress]);

  // Merge follows from backend on connect (fills gaps when local was non-empty but server had more)
  useEffect(() => {
    if (walletAddress) mergeFollowsFromServer(walletAddress).catch(() => {});
  }, [walletAddress]);

  const openModal = () => {
    playClick();
    openConnectModal?.();
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    playClick();
    e.stopPropagation();
    disconnect();
    setWagmiConnection(null, null);
    disconnectWallet();
    setIsWalletDropdownOpen(false);
    toast.info("NEURAL_LINK_TERMINATED");
  };

  const handleCopyAddress = (e: React.MouseEvent) => {
    playClick();
    e.stopPropagation();
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setIsWalletDropdownOpen(false);
      toast.success("IDENT_HASH_COPIED");
    }
  };

  const toggleDropdown = () => {
    playClick();
    setIsWalletDropdownOpen(prev => !prev);
  };

  const handleNewSignal = () => {
    playClick();
    setIsMenuOpen(false);
    navigate('/create');
  };

  const pathname = location.pathname;

  const isActive = useCallback((path: string) => {
    if (path === '/' && pathname !== '/') return false;
    return pathname.startsWith(path);
  }, [pathname]);

  const closeSidebarNav = useCallback(() => {
    setIsMenuOpen(false);
    setIsIntelOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-intuition-dark text-slate-300 flex font-sans selection:bg-intuition-primary selection:text-black">
      {/* Desktop side nav — full-height dock (flush left/top/bottom), icon rail expands on hover */}
      <aside
        ref={sidebarAsideRef}
        className="group/sidebar hidden lg:flex fixed inset-y-0 left-0 z-[105] flex-col rounded-none rounded-r-2xl xl:rounded-r-3xl bg-[#020308] border-y-0 border-l-0 border-r border-slate-800/80 shadow-[2px_0_16px_rgba(0,0,0,0.35)] overflow-hidden contain-[layout] transform-gpu motion-reduce:transition-none motion-reduce:duration-0 transition-[width] duration-200 ease-out w-[4.5rem] hover:w-72 xl:hover:w-80 focus-within:w-72 xl:focus-within:w-80 hover:shadow-[4px_0_24px_rgba(0,0,0,0.45)] focus-within:shadow-[4px_0_24px_rgba(0,0,0,0.45)]"
      >
        <Link
          to="/"
          onClick={() => {
            playClick();
          }}
          onMouseEnter={playHover}
          aria-label="IntuRank home"
          className="flex h-16 shrink-0 items-center gap-3 px-2.5 group-hover/sidebar:px-4 group-focus-within/sidebar:px-4 border-b border-slate-800/50 justify-center group-hover/sidebar:justify-start group-focus-within/sidebar:justify-start min-w-0 overflow-visible relative z-10 no-underline outline-none focus-visible:ring-2 focus-visible:ring-intuition-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020308] motion-reduce:transition-none transition-[gap,padding] duration-200 ease-out"
        >
          <div className="shrink-0 flex items-center justify-center">
            <div
              className="rounded-xl bg-gradient-to-br from-slate-900 via-black to-slate-950 border border-intuition-primary/70 flex items-center justify-center text-intuition-primary shadow-[0_0_14px_rgba(0,243,255,0.3)] overflow-hidden p-2 box-border"
              style={{ width: 52, height: 52 }}
            >
              <Logo className="h-8 w-8 max-h-[85%] max-w-[85%] object-contain object-center" />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col max-w-0 opacity-0 overflow-visible motion-reduce:transition-none motion-reduce:duration-0 transition-opacity duration-200 ease-out group-hover/sidebar:max-w-full group-hover/sidebar:opacity-100 group-focus-within/sidebar:max-w-full group-focus-within/sidebar:opacity-100">
            <span className="text-xl font-black tracking-[0.18em] font-display whitespace-nowrap min-w-0">
              <span className="text-[#f8fafc]" style={{ textShadow: '0 0 12px rgba(0,243,255,0.35)' }}>
                INTU
              </span>
              <span className="text-[#00f3ff]" style={{ textShadow: '0 0 14px rgba(0,243,255,0.55)' }}>
                RANK
              </span>
            </span>
            <span className="text-[9px] text-slate-500 font-mono tracking-[0.25em] uppercase font-black whitespace-nowrap">
              {APP_VERSION_DISPLAY}
            </span>
          </div>
        </Link>

        <div className="flex-1 flex flex-col px-3 py-3 gap-4 overflow-y-auto overflow-x-clip min-h-0 overscroll-contain">
          <nav
            className="rounded-2xl border border-intuition-primary/30 bg-gradient-to-b from-intuition-primary/[0.08] to-transparent p-2.5 space-y-2 shadow-[inset_0_1px_0_0_rgba(0,243,255,0.15)]"
            aria-label="Primary navigation"
          >
            <div className="hidden group-hover/sidebar:block group-focus-within/sidebar:block px-2 pb-2 border-b border-white/5">
              <p className="text-[10px] font-mono text-intuition-primary uppercase tracking-[0.28em] font-black">
                Main
              </p>
            </div>
            {MAIN_NAV_ITEMS.map((item) => (
              <NavItem
                key={`${item.label}-${item.path}`}
                to={item.path}
                label={item.label}
                icon={item.icon}
                active={isActive(item.path)}
                onClick={closeSidebarNav}
                variant={item.variant}
              />
            ))}
          </nav>

          <div ref={intelRef} className="space-y-4 flex flex-col min-h-0">
            <nav className="space-y-2" aria-label="Versus">
              <div className="hidden group-hover/sidebar:block group-focus-within/sidebar:block px-3 pb-1">
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.25em] font-black">Versus</p>
              </div>
              {VERSUS_NAV_ITEMS.map((item) => (
                <NavItem
                  key={`${item.path}-${item.label}`}
                  to={item.path}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(item.path)}
                  onClick={closeSidebarNav}
                />
              ))}
            </nav>

            <nav className="space-y-2" aria-label="Explore">
              <div className="hidden group-hover/sidebar:block group-focus-within/sidebar:block px-3 pb-1">
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.25em] font-black">Explore</p>
              </div>
              {EXPLORE_NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.external ? `explore-ext-${item.label}` : item.path}
                  to={item.path}
                  label={item.label}
                  icon={item.icon}
                  active={item.external ? false : isActive(item.path)}
                  onClick={closeSidebarNav}
                  external={item.external}
                  variant={item.external ? 'success' : 'default'}
                />
              ))}
            </nav>

            <nav className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-2" aria-label="Monitor">
              <div className="hidden group-hover/sidebar:block group-focus-within/sidebar:block px-2 pb-1">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.25em] font-black">Monitor</p>
              </div>
              {MONITOR_NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.path}
                  to={item.path}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(item.path)}
                  onClick={closeSidebarNav}
                />
              ))}
            </nav>
          </div>
        </div>

        <div className="px-2 group-hover/sidebar:px-4 group-focus-within/sidebar:px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 border-t border-slate-800/50 shrink-0 flex h-14 items-center justify-center group-hover/sidebar:justify-start group-focus-within/sidebar:justify-start gap-2 motion-reduce:transition-none motion-reduce:duration-0 transition-[gap,padding] duration-200 ease-out">
          <Wallet size={16} className={`shrink-0 ${walletAddress ? 'text-intuition-primary' : 'text-slate-600'}`} aria-hidden />
          <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap truncate text-[9px] font-mono text-slate-500 uppercase tracking-[0.25em] motion-reduce:transition-none motion-reduce:duration-0 transition-opacity duration-200 ease-out group-hover/sidebar:max-w-[14rem] group-hover/sidebar:opacity-100 group-focus-within/sidebar:max-w-[14rem] group-focus-within/sidebar:opacity-100">
            {walletAddress ? 'Connected' : 'No session'}
          </span>
        </div>
      </aside>

      {/* Main column: offset = collapsed rail width; sidebar expands over content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 w-full lg:ml-[4.5rem]">
        <nav className="lg:hidden fixed top-0 w-full z-50 bg-black/95 border-b border-slate-900/70 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.45)]">
          <div className="w-full px-3 sm:px-6 max-w-[100vw] min-w-0">
            <div className="flex items-center justify-between h-16 min-w-0">
              <Link
                to="/"
                onClick={playClick}
                onMouseEnter={playHover}
                aria-label="IntuRank home"
                className="flex items-center flex-shrink-0 gap-3 min-w-0 no-underline outline-none focus-visible:ring-2 focus-visible:ring-intuition-primary/80 rounded-xl"
              >
                <div className="group-hover:scale-105 transition-transform duration-150 shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-900 via-black to-slate-950 border border-intuition-primary/70 flex items-center justify-center text-intuition-primary shadow-[0_0_14px_rgba(0,243,255,0.3)] overflow-hidden p-2 box-border">
                    <Logo className="h-7 w-7 sm:h-8 sm:w-8 max-h-[85%] max-w-[85%] object-contain object-center" />
                  </div>
                </div>
                <span className="text-lg font-black tracking-[0.18em] font-display whitespace-nowrap min-w-0">
                  <span className="text-[#f8fafc]" style={{ textShadow: '0 0 12px rgba(0,243,255,0.35)' }}>
                    INTU
                  </span>
                  <span className="text-[#00f3ff]" style={{ textShadow: '0 0 14px rgba(0,243,255,0.55)' }}>
                    RANK
                  </span>
                </span>
              </Link>

              <div className="lg:hidden flex items-center gap-2">
                <NotificationBar walletAddress={walletAddress ?? null} />
                <button
                  onClick={() => {
                    playClick();
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  className="text-intuition-primary p-3 min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-800 rounded-full bg-black/90 shadow-lg active:scale-95 transition-transform"
                >
                  {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </div>
            </div>
          </div>

          {isMenuOpen && (
            <>
              <div
                className="lg:hidden fixed inset-0 top-[4rem] z-[99] bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                aria-hidden
              />
              <div className="lg:hidden absolute w-full left-0 top-full z-[100] bg-black border-b-2 border-intuition-primary/20 max-h-[85vh] overflow-y-auto overflow-x-clip shadow-[0_25px_80px_rgba(0,0,0,1)] animate-in slide-in-from-top-2 fade-in duration-500">
                <div className="px-4 pl-5 pt-4 pb-10 space-y-2 max-w-[100vw] bg-black">
                  {ALL_MOBILE_NAV_ITEMS.map((item, index) => {
                    const ext = 'external' in item && item.external;
                    const mobileCls = `relative flex items-center gap-3 min-w-0 pl-5 pr-5 py-4 border-2 text-[9px] sm:text-[10px] font-black font-mono tracking-widest transition-all rounded-2xl animate-in fade-in slide-in-from-left-4 duration-300 fill-mode-both ${
                      ext
                        ? 'text-intuition-success border-intuition-success/45 bg-intuition-success/8 hover:bg-intuition-success/15 hover:border-intuition-success'
                        : isActive(item.path)
                          ? item.variant === 'gold'
                            ? 'text-black bg-intuition-warning border-intuition-warning shadow-[0_0_20px_rgba(250,204,21,0.35)]'
                            : 'text-black bg-intuition-primary border-intuition-primary'
                          : item.variant === 'gold'
                            ? 'text-amber-200 border-amber-500/45 bg-amber-950/35 hover:text-amber-50 hover:border-amber-400 hover:bg-amber-500/10'
                            : 'text-slate-400 border-slate-900 hover:text-white bg-white/5'
                    }`;
                    const delay = { animationDelay: `${index * 45}ms` };
                    const close = () => {
                      playClick();
                      setIsMenuOpen(false);
                    };
                    if (ext) {
                      return (
                        <a
                          key={`${item.label}-ext`}
                          href={item.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={close}
                          style={delay}
                          className={mobileCls}
                        >
                          <span className="shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                          <span className="min-w-0 break-words uppercase">{item.label}</span>
                        </a>
                      );
                    }
                    return (
                      <Link
                        key={`${item.label}-${item.path}`}
                        to={item.path}
                        onClick={close}
                        style={delay}
                        className={mobileCls}
                      >
                        {isActive(item.path) && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-black rounded-r" />
                        )}
                        <span className="shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                        <span className="min-w-0 break-words uppercase">{item.label}</span>
                      </Link>
                    );
                  })}

                  <a
                    href={TRUST_SWAP_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      playClick();
                      setIsMenuOpen(false);
                    }}
                    style={{ animationDelay: `${ALL_MOBILE_NAV_ITEMS.length * 45}ms` }}
                    className="w-full flex items-center justify-center gap-3 px-5 py-4 border-2 border-intuition-success text-intuition-success font-black font-mono text-[10px] tracking-widest rounded-full mt-6 hover:bg-intuition-success hover:text-black transition-all animate-in fade-in slide-in-from-left-4 duration-300 fill-mode-both"
                  >
                    <Coins size={18} /> ACQUIRE_₸_TOKEN
                  </a>

                  <button
                    type="button"
                    onClick={handleNewSignal}
                    aria-label="Create a new atom or claim"
                    style={{
                      animationDelay: `${(ALL_MOBILE_NAV_ITEMS.length + 1) * 45}ms`,
                    }}
                    className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-intuition-secondary text-white font-black font-mono text-[10px] tracking-widest rounded-full shadow-xl mt-2 border-2 border-transparent active:scale-95 transition-transform animate-in fade-in slide-in-from-left-4 duration-300 fill-mode-both"
                  >
                    <Plus size={18} /> NEW ATOM OR CLAIM
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      setSoundEnabledState(next);
                      if (next) playClick();
                    }}
                    style={{
                      animationDelay: `${(ALL_MOBILE_NAV_ITEMS.length + 2) * 45}ms`,
                    }}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 border-2 border-slate-700 text-slate-300 font-mono font-black text-[10px] tracking-widest rounded-2xl mt-2 animate-in fade-in slide-in-from-left-4 duration-300 fill-mode-both"
                  >
                    <span className="flex items-center gap-3">
                      {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                      Sound effects
                    </span>
                    <span
                      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-sm border-2 transition-colors ${
                        soundEnabled
                          ? 'border-intuition-primary bg-intuition-primary/30'
                          : 'border-slate-600 bg-slate-800'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 translate-x-0.5 rounded-sm bg-white transition-transform ${
                          soundEnabled ? 'translate-x-4' : ''
                        }`}
                      />
                    </span>
                  </button>

                  {walletAddress ? (
                    <button
                      onClick={handleDisconnect}
style={{
                        animationDelay: `${(ALL_MOBILE_NAV_ITEMS.length + 3) * 45}ms`,
                      }}
                    className="w-full py-4 border-2 border-intuition-danger text-intuition-danger font-mono font-black text-[10px] tracking-widest bg-intuition-danger/5 rounded-2xl mt-2 animate-in fade-in slide-in-from-left-4 duration-300 fill-mode-both"
                    >
                      EXIT_SECURE_SESSION
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        playClick();
                        setIsMenuOpen(false);
                        openModal();
                      }}
                      style={{
                        animationDelay: `${(ALL_MOBILE_NAV_ITEMS.length + 3) * 45}ms`,
                      }}
                      className="w-full py-4 border-2 border-intuition-primary text-intuition-primary font-mono font-black text-[10px] tracking-widest bg-intuition-primary/5 rounded-2xl mt-2 animate-in fade-in slide-in-from-left-4 duration-300 fill-mode-both"
                    >
                      ESTABLISH_NEURAL_LINK
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </nav>

        {/* Desktop top bar — IntuRank pill cluster: cyan rim + pink CTA, matches sidebar / mobile */}
        <div className="hidden lg:flex h-14 shrink-0 items-center w-full border-b border-intuition-primary/10 bg-[#020308]/90 backdrop-blur-md supports-[backdrop-filter]:bg-[#020308]/82 relative z-[100] overflow-visible">
          <div className="flex w-full min-w-0 items-center justify-end gap-3 pl-4 pr-[max(1rem,env(safe-area-inset-right))] lg:pr-8">
            {walletAddress && chainId !== CHAIN_ID && (
              <button
                onClick={async () => {
                  playClick();
                  await switchNetwork();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-intuition-danger text-white text-[11px] font-semibold font-sans rounded-full shrink-0 shadow-[0_0_18px_rgba(255,30,109,0.35)] ring-1 ring-white/10 transition-transform active:scale-[0.98]"
              >
                <AlertTriangle size={14} strokeWidth={2} /> Wrong network
              </button>
            )}

            <div className="flex items-center gap-2 rounded-full border border-intuition-primary/30 bg-gradient-to-b from-intuition-primary/[0.09] to-black/50 pl-2 pr-2 py-1.5 shadow-[inset_0_1px_0_0_rgba(0,243,255,0.18)] overflow-visible ring-1 ring-intuition-primary/15">
            <NotificationBar walletAddress={walletAddress ?? null} />

            <button
              type="button"
              onClick={handleNewSignal}
              onMouseEnter={playHover}
              aria-label="Create a new atom or claim"
              title="Create atom or claim"
              className="hidden lg:inline-flex items-center gap-2 px-4 sm:px-5 py-2 min-h-0 text-xs font-semibold font-sans text-white rounded-full bg-intuition-secondary hover:brightness-110 active:scale-[0.98] border border-white/15 shadow-[0_0_22px_rgba(255,30,109,0.45)] hover:shadow-[0_0_32px_rgba(255,30,109,0.55)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intuition-secondary/50"
            >
              <Plus size={16} strokeWidth={2.5} className="shrink-0" aria-hidden />
              <span className="hidden xl:inline whitespace-nowrap">Create atom or claim</span>
              <span className="xl:hidden">Create</span>
            </button>

            <div className="relative flex items-center">
              {walletAddress ? (
                <ProfileBadgeWidget
                  address={walletAddress}
                  isDropdownOpen={isWalletDropdownOpen}
                  onToggleDropdown={toggleDropdown}
                  dropdownRef={dropdownRef}
                >
                  <div className="absolute right-0 mt-3 w-72 z-[110] rounded-3xl animate-dropdown-panel-in border border-intuition-primary/35 bg-[#03050d]/[0.97] shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_28px_rgba(0,243,255,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-black/40">
                      <div className="p-1.5 space-y-0.5 rounded-[1.35rem] bg-gradient-to-b from-white/[0.07] to-[#03050d]">
                        <div className="px-4 py-3 border-b border-white/5 text-[9px] font-black font-mono text-slate-500 uppercase tracking-[0.3em] mb-1">
                          Terminal Access
                        </div>
                    <a
                      href={TRUST_SWAP_URL}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        playClick();
                        setIsWalletDropdownOpen(false);
                      }}
                      onMouseEnter={playHover}
                      className="w-full flex items-center gap-4 px-4 py-4 text-left text-[10px] font-black font-mono text-intuition-success hover:bg-white/5 transition-colors uppercase tracking-widest"
                    >
                      <Coins size={14} /> GET_TRUST
                    </a>
                    <button
                      onClick={handleCopyAddress}
                      onMouseEnter={playHover}
                      className="w-full flex items-center gap-4 px-4 py-4 text-left text-[10px] font-black font-mono text-slate-300 hover:bg-white/5 hover:text-intuition-primary transition-colors uppercase tracking-widest"
                    >
                      <Copy size={14} /> COPY_IDENT_HASH
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !soundEnabled;
                        setSoundEnabled(next);
                        setSoundEnabledState(next);
                        if (next) playClick();
                      }}
                      onMouseEnter={playHover}
                      className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left text-[10px] font-black font-mono text-slate-300 hover:bg-white/5 hover:text-intuition-primary transition-colors uppercase tracking-widest border-t border-white/5"
                    >
                      <span className="flex items-center gap-4">
                        {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        Sound effects
                      </span>
                      <span
                        className={`inline-flex h-5 w-9 shrink-0 items-center rounded-sm border-2 transition-colors ${
                          soundEnabled
                            ? 'border-intuition-primary bg-intuition-primary/30'
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 translate-x-0.5 rounded-sm bg-white transition-transform ${
                            soundEnabled ? 'translate-x-4' : ''
                          }`}
                        />
                      </span>
                    </button>
                    <button
                      onClick={handleDisconnect}
                      onMouseEnter={playHover}
                      className="w-full flex items-center gap-4 px-4 py-4 text-left text-[10px] font-black font-mono text-intuition-danger hover:bg-intuition-danger/10 transition-colors border-t border-white/5 uppercase tracking-widest"
                    >
                      <LogOut size={14} /> TERMINATE_SYNC
                    </button>
                  </div>
                </div>
                </ProfileBadgeWidget>
              ) : (
                <button
                  onClick={openModal}
                  onMouseEnter={playHover}
                  className="flex items-center gap-2 px-4 py-2 font-sans text-xs font-semibold rounded-full border border-intuition-primary/40 bg-intuition-primary/10 text-intuition-primary hover:bg-intuition-primary/20 hover:shadow-[0_0_20px_rgba(0,243,255,0.2)] transition-all"
                >
                  <Wallet size={16} className="shrink-0" strokeWidth={2} />
                  Connect wallet
                </button>
              )}
            </div>
            </div>
          </div>
        </div>

        <main
          className={`flex-grow pt-16 lg:pt-0 retro-grid relative z-0 mobile-contain min-w-0 w-full max-w-full ${
            pathname === '/documentation' ? 'overflow-x-visible' : 'overflow-x-clip'
          }`}
        >
          <div
            key={location.pathname}
            className={`animate-page-enter min-h-full min-w-0 w-full ${
              pathname === '/documentation' ? 'overflow-x-visible' : 'overflow-x-clip'
            }`}
          >
            {children}
          </div>
        </main>

        <footer className="border-t border-white/5 bg-[#020308] py-12 md:py-24 mt-auto z-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-intuition-primary/[0.04] to-transparent pointer-events-none" />
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16 lg:gap-20 mb-12 md:mb-24 items-start">
              <div className="md:col-span-2 space-y-10">
                <div
                  className="flex items-center gap-6 group cursor-pointer"
                  onMouseEnter={playHover}
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 border-2 border-intuition-primary rounded-3xl flex items-center justify-center text-intuition-primary group-hover:shadow-[0_0_55px_rgba(0,243,255,0.7)] group-hover:scale-110 group-hover:rotate-3 transition-all duration-700 overflow-hidden p-2 sm:p-2.5 bg-gradient-to-br from-slate-900 via-black to-slate-950">
                    <Logo className="w-full h-full max-h-[88%] max-w-[88%] object-contain" />
                  </div>
                  <span className="text-3xl sm:text-4xl md:text-5xl font-display font-black tracking-tight text-white group-hover:text-intuition-primary transition-all duration-500 uppercase text-glow-blue">
                    INTU<span className="group-hover:text-white transition-colors">RANK</span>
                  </span>
                </div>
                <p className="text-slate-200 font-mono text-sm leading-relaxed max-w-lg uppercase tracking-wider font-black opacity-80">
                  Quantifying reputation as a tradable asset on the Intuition Network. Establishing
                  the global source of truth via semantic dynamics.
                </p>
                <div className="flex flex-wrap gap-6">
                  <a
                    href="https://x.com/inturank"
                    target="_blank"
                    rel="noreferrer"
                    onMouseEnter={playHover}
                    className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:border-intuition-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:-translate-y-1 transition-all duration-300 group"
                  >
                    <Twitter size={24} className="group-hover:scale-110 transition-transform" />
                  </a>
                  <a
                    href="https://github.com/intuition-box/INTURANK"
                    target="_blank"
                    rel="noreferrer"
                    onMouseEnter={playHover}
                    className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:border-intuition-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:-translate-y-1 transition-all duration-300 group"
                  >
                    <Github size={24} className="group-hover:scale-110 transition-transform" />
                  </a>
                  <a
                    href="https://discord.gg/gz62ER2e7a"
                    target="_blank"
                    rel="noreferrer"
                    onMouseEnter={playHover}
                    className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:border-intuition-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:-translate-y-1 transition-all duration-300 group"
                  >
                    <DiscordIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </a>
                  <a
                    href="https://t.me/inturank"
                    target="_blank"
                    rel="noreferrer"
                    onMouseEnter={playHover}
                    className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:border-intuition-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:-translate-y-1 transition-all duration-300 group"
                  >
                    <Send size={24} className="group-hover:scale-110 transition-transform" />
                  </a>
                  <a
                    href="https://inturank.medium.com"
                    target="_blank"
                    rel="noreferrer"
                    onMouseEnter={playHover}
                    className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:border-intuition-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:-translate-y-1 transition-all duration-300 group"
                  >
                    <MediumIcon className="w-7 h-7 group-hover:scale-110 transition-transform" />
                  </a>
                </div>
              </div>

              <div className="flex flex-col gap-5 min-w-0">
                <h4 className="text-sm sm:text-base font-bold font-display text-intuition-primary tracking-wide leading-none">
                  Explore
                </h4>
                <nav className="flex flex-col gap-3.5 font-sans text-[15px] sm:text-base text-slate-200 font-semibold leading-snug">
                  <Link
                    to="/markets"
                    className="hover:text-intuition-primary transition-colors flex items-center gap-3 min-h-[2.5rem] group"
                  >
                    <ChevronsRight size={18} className="shrink-0 text-intuition-primary/0 group-hover:text-intuition-primary transition-all -ml-5 group-hover:ml-0" />
                    Markets
                  </Link>
                  <Link
                    to="/feed"
                    className="hover:text-intuition-primary transition-colors flex items-center gap-3 min-h-[2.5rem] group"
                  >
                    <ChevronsRight size={18} className="shrink-0 text-intuition-primary/0 group-hover:text-intuition-primary transition-all -ml-5 group-hover:ml-0" />
                    Activity
                  </Link>
                  <Link
                    to="/stats"
                    className="hover:text-intuition-primary transition-colors flex items-center gap-3 min-h-[2.5rem] group"
                  >
                    <ChevronsRight size={18} className="shrink-0 text-intuition-primary/0 group-hover:text-intuition-primary transition-all -ml-5 group-hover:ml-0" />
                    Leaderboard
                  </Link>
                  <Link
                    to="/portfolio"
                    className="hover:text-intuition-primary transition-colors flex items-center gap-3 min-h-[2.5rem] group"
                  >
                    <ChevronsRight size={18} className="shrink-0 text-intuition-primary/0 group-hover:text-intuition-primary transition-all -ml-5 group-hover:ml-0" />
                    Portfolio
                  </Link>
                </nav>
              </div>

              <div className="flex flex-col gap-5 min-w-0">
                <h4 className="text-sm sm:text-base font-bold font-display text-intuition-secondary tracking-wide leading-none text-glow-red">
                  Ecosystem
                </h4>
                <nav className="flex flex-col gap-3.5 font-sans text-[15px] sm:text-base text-slate-200 font-semibold leading-snug">
                  <Link
                    to="/documentation"
                    className="hover:text-intuition-secondary transition-colors flex items-center gap-3 min-h-[2.5rem] group"
                  >
                    <ChevronsRight size={18} className="shrink-0 text-intuition-secondary/0 group-hover:text-intuition-secondary transition-all -ml-5 group-hover:ml-0" />
                    <span className="flex items-center gap-2 flex-wrap">
                      Documentation <FileText size={16} className="opacity-80 shrink-0" />
                    </span>
                  </Link>
                  <a
                    href={TRUST_SWAP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-intuition-success hover:text-white transition-colors flex items-center gap-3 min-h-[2.5rem] group"
                  >
                    <ChevronsRight size={18} className="shrink-0 text-intuition-success/0 group-hover:text-intuition-success transition-all -ml-5 group-hover:ml-0" />
                    <span className="flex items-center gap-2 flex-wrap">
                      Get Trust <ExternalLink size={16} className="opacity-90 shrink-0" />
                    </span>
                  </a>
                  <a
                    href="https://intuition.systems"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-intuition-secondary transition-colors flex items-center gap-3 min-h-[2.5rem] group"
                  >
                    <ChevronsRight size={18} className="shrink-0 text-intuition-secondary/0 group-hover:text-intuition-secondary transition-all -ml-5 group-hover:ml-0" />
                    <span className="flex items-center gap-2 flex-wrap">
                      Intuition home <ExternalLink size={16} className="opacity-80 shrink-0" />
                    </span>
                  </a>
                  <a
                    href="https://docs.intuition.systems"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-intuition-secondary transition-colors flex items-center gap-3 min-h-[2.5rem] group"
                  >
                    <ChevronsRight size={18} className="shrink-0 text-intuition-secondary/0 group-hover:text-intuition-secondary transition-all -ml-5 group-hover:ml-0" />
                    <span className="flex items-center gap-2 flex-wrap">
                      Intuition docs <BookOpen size={16} className="opacity-80 shrink-0" />
                    </span>
                  </a>
                  <a
                    href="https://explorer.intuition.systems"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-intuition-secondary transition-colors flex items-center gap-3 min-h-[2.5rem] group"
                  >
                    <ChevronsRight size={18} className="shrink-0 text-intuition-secondary/0 group-hover:text-intuition-secondary transition-all -ml-5 group-hover:ml-0" />
                    <span className="flex items-center gap-2 flex-wrap">
                      Block explorer <Globe size={16} className="opacity-80 shrink-0" />
                    </span>
                  </a>
                </nav>
              </div>
            </div>

            <div className="pt-16 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 items-center justify-items-center gap-12">
              <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest font-black text-center md:text-left justify-self-start">
                v{APP_VERSION} · © 2025 IntuRank
              </div>

              <div className="flex flex-col items-center group/powered relative">
                <span className="text-[11px] font-black font-mono text-slate-500 uppercase tracking-[0.8em] mb-4 group-hover/powered:text-white transition-all duration-500">
                  Powered By
                </span>
                <a
                  href="https://intuition.systems"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-8 no-underline"
                >
                  <IntuitionTargetLogo />
                  <span className="text-3xl md:text-5xl lg:text-6xl font-display font-black tracking-[0.25em] text-white group-hover/powered:text-intuition-primary transition-all duration-700 uppercase text-glow-blue">
                    INTUITION
                  </span>
                </a>
                <div className="absolute -bottom-6 w-48 h-px bg-gradient-to-r from-transparent via-intuition-primary/40 to-transparent" />
              </div>

              <div className="flex items-center justify-center md:justify-end gap-3 text-[10px] font-black font-mono text-intuition-secondary uppercase tracking-[0.5em] text-glow-red justify-self-end">
                <div className="w-2.5 h-2.5 bg-intuition-secondary shadow-[0_0_15px_#ff1e6d] motion-safe:animate-pulse" />
                Live
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout;