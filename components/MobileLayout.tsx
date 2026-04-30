/**
 * MobileLayout — top app-bar + floating bottom dock with center FAB.
 * Used in place of the desktop `Layout` chrome whenever `useIsMobile()` is true.
 *
 * Bottom dock slots (left → right):
 *   Home · Markets · ⊕ FAB (opens MobileNavSheet) · Arena · Profile
 *
 * The center FAB intentionally surfaces every other destination via a sheet so
 * the dock stays clean and finger-friendly, per spec.
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect, useConfig } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import {
  Home, TrendingUp, Activity, UserCircle, Plus, Wallet, Search, ChevronDown,
} from 'lucide-react';
import {
  switchNetwork, disconnectWallet, setWagmiConnection, setOpenConnectModalRef,
} from '../services/web3';
import { CHAIN_ID } from '../constants';
import { playHover, playClick } from '../services/audio';
import Logo from './Logo';
import NotificationBar from './NotificationBar';
import { toast } from './Toast';
import { setEmailFailureHandler, maybeSendDailyDigest } from '../services/emailNotifications';
import { mergeFollowsFromServer } from '../services/follows';
import MobileNavSheet from './MobileNavSheet';
import ArenaBatchFab from './ArenaBatchFab';
import { ARENA_BATCH_MODE } from '../constants';

interface Props {
  children: React.ReactNode;
}

interface DockItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const DOCK: { left: DockItem[]; right: DockItem[] } = {
  left: [
    { label: 'Home', path: '/', icon: <Home size={20} strokeWidth={2.2} /> },
    { label: 'Markets', path: '/markets', icon: <TrendingUp size={20} strokeWidth={2.2} /> },
  ],
  right: [
    { label: 'Arena', path: '/climb', icon: <Activity size={20} strokeWidth={2.2} /> },
    { label: 'You', path: '/account', icon: <UserCircle size={20} strokeWidth={2.2} /> },
  ],
};

function shortAddr(a: string): string {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

const DockButton = memo(function DockButton({
  item,
  active,
  onSelect,
}: {
  item: DockItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Link
      to={item.path}
      onClick={() => {
        playClick();
        onSelect();
      }}
      onMouseEnter={playHover}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={`group flex flex-col items-center justify-center gap-0.5 min-w-[3.5rem] py-1.5 rounded-2xl transition-colors ${
        active ? 'text-intuition-primary' : 'text-slate-500 active:text-slate-200'
      }`}
    >
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-2xl transition-all ${
          active
            ? 'bg-intuition-primary/15 ring-1 ring-intuition-primary/40 shadow-[0_0_18px_rgba(0,243,255,0.25)]'
            : 'group-active:bg-white/5'
        }`}
      >
        {item.icon}
        {active && (
          <span className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-intuition-primary shadow-[0_0_8px_rgba(0,243,255,0.8)]" />
        )}
      </span>
      <span
        className={`text-[10px] font-mono font-black tracking-[0.18em] uppercase leading-none ${
          active ? 'text-intuition-primary' : 'text-slate-500'
        }`}
      >
        {item.label}
      </span>
    </Link>
  );
});

const MobileLayout: React.FC<Props> = ({ children }) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [walletDropOpen, setWalletDropOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { openConnectModal } = useConnectModal();
  const { address: walletAddress, isConnected, chainId = 0 } = useAccount();
  const { disconnect } = useDisconnect();
  const wagmiConfig = useConfig();

  const pathname = location.pathname;

  const isActive = useCallback(
    (path: string) => {
      if (path === '/') return pathname === '/';
      return pathname.startsWith(path);
    },
    [pathname],
  );

  // Mirror Layout.tsx: wire wagmi → web3 service so legacy code paths still work.
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
        const injected =
          typeof window !== 'undefined'
            ? (window as unknown as { ethereum?: unknown }).ethereum
            : undefined;
        if (!cancelled) setWagmiConnection(walletAddress, (injected as typeof window.ethereum) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, walletAddress, wagmiConfig]);

  useEffect(() => {
    setOpenConnectModalRef(() => openConnectModal?.());
    return () => setOpenConnectModalRef(null);
  }, [openConnectModal]);

  useEffect(() => {
    setEmailFailureHandler((m) => toast.error(m));
    return () => setEmailFailureHandler(null);
  }, []);

  useEffect(() => {
    if (walletAddress) maybeSendDailyDigest(walletAddress).catch(() => {});
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) mergeFollowsFromServer(walletAddress).catch(() => {});
  }, [walletAddress]);

  // Auto-close any open sheets/drops on route change so navigation feels snappy.
  useEffect(() => {
    setSheetOpen(false);
    setWalletDropOpen(false);
  }, [pathname]);

  const handleConnect = () => {
    playClick();
    openConnectModal?.();
  };

  const handleDisconnect = () => {
    playClick();
    disconnect();
    setWagmiConnection(null, null);
    disconnectWallet();
    toast.info('Session ended');
  };

  const goCreate = () => {
    navigate('/create');
  };

  return (
    <div className="min-h-screen bg-intuition-dark text-slate-200 font-sans selection:bg-intuition-primary selection:text-black">
      {/* Top app bar */}
      <header
        className="fixed top-0 inset-x-0 z-[150] backdrop-blur-xl bg-[#03050d]/82 border-b border-white/[0.06]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <Link
            to="/"
            onClick={() => playClick()}
            className="flex items-center gap-2.5 min-w-0 no-underline"
            aria-label="IntuRank home"
          >
            <span className="h-9 w-9 shrink-0 rounded-2xl bg-gradient-to-br from-slate-900 via-black to-slate-950 border border-intuition-primary/60 flex items-center justify-center shadow-[0_0_14px_rgba(0,243,255,0.28)] p-1.5">
              <Logo className="h-full w-full object-contain" />
            </span>
            <span className="text-base font-display font-black tracking-[0.18em] truncate">
              <span className="text-white">INTU</span>
              <span className="text-intuition-primary" style={{ textShadow: '0 0 12px rgba(0,243,255,0.6)' }}>
                RANK
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              to="/markets"
              onClick={() => playClick()}
              aria-label="Search markets"
              className="h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 active:scale-95 transition-transform"
            >
              <Search size={18} />
            </Link>
            <NotificationBar walletAddress={walletAddress ?? null} />
            {walletAddress ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setWalletDropOpen((p) => !p);
                  }}
                  className="h-10 px-2.5 flex items-center gap-1.5 rounded-full border border-intuition-primary/30 bg-intuition-primary/8 text-intuition-primary text-[11px] font-mono font-black tracking-[0.12em] active:scale-95 transition-transform"
                >
                  <span className="h-2 w-2 rounded-full bg-intuition-success shadow-[0_0_6px_rgba(0,255,157,0.7)]" />
                  {shortAddr(walletAddress)}
                  <ChevronDown size={12} />
                </button>
                {walletDropOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close wallet menu"
                      className="fixed inset-0 z-[160]"
                      onClick={() => setWalletDropOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 z-[170] w-56 rounded-2xl border border-intuition-primary/30 bg-[#03050d]/97 shadow-[0_24px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          if (walletAddress) navigator.clipboard.writeText(walletAddress);
                          toast.success('Address copied');
                          setWalletDropOpen(false);
                        }}
                        className="w-full px-4 py-3.5 text-left text-[11px] font-mono font-black tracking-[0.18em] uppercase text-slate-200 hover:bg-white/5"
                      >
                        Copy address
                      </button>
                      <Link
                        to="/account"
                        onClick={() => {
                          playClick();
                          setWalletDropOpen(false);
                        }}
                        className="block px-4 py-3.5 text-[11px] font-mono font-black tracking-[0.18em] uppercase text-slate-200 hover:bg-white/5"
                      >
                        Profile
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setWalletDropOpen(false);
                          handleDisconnect();
                        }}
                        className="w-full px-4 py-3.5 text-left text-[11px] font-mono font-black tracking-[0.18em] uppercase text-intuition-danger hover:bg-intuition-danger/10 border-t border-white/5"
                      >
                        Disconnect
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                className="h-10 px-3 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-intuition-primary to-cyan-300 text-black text-[11px] font-mono font-black tracking-[0.16em] uppercase shadow-[0_8px_22px_rgba(0,243,255,0.3)] active:scale-95 transition-transform"
              >
                <Wallet size={14} /> Connect
              </button>
            )}
          </div>
        </div>

        {walletAddress && chainId !== CHAIN_ID && (
          <button
            type="button"
            onClick={async () => {
              playClick();
              await switchNetwork();
            }}
            className="w-full px-4 py-2 text-[10px] font-mono font-black tracking-[0.18em] uppercase text-white bg-intuition-danger active:opacity-90"
          >
            Wrong network — tap to switch
          </button>
        )}
      </header>

      {/* Main scrollable content. pt offset = topbar height; pb offset = dock height + safe area. */}
      <main
        className="relative mobile-contain min-w-0 w-full max-w-full overflow-x-clip"
        style={{
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(6.5rem + env(safe-area-inset-bottom))',
        }}
      >
        <div key={location.pathname} className="animate-page-enter min-h-full min-w-0 w-full">
          {children}
        </div>
      </main>

      {ARENA_BATCH_MODE && <ArenaBatchFab />}

      {/* Floating bottom dock */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-[180] flex items-end justify-center pointer-events-none"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto relative mx-3 w-full max-w-[26rem]">
          <div className="grid grid-cols-5 items-end gap-1 rounded-[1.75rem] border border-white/10 bg-[#06080f]/95 backdrop-blur-2xl px-2 pt-2 pb-2 shadow-[0_24px_48px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,243,255,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]">
            {DOCK.left.map((it) => (
              <DockButton
                key={it.path}
                item={it}
                active={isActive(it.path)}
                onSelect={() => setSheetOpen(false)}
              />
            ))}

            {/* Center FAB */}
            <div className="flex items-end justify-center">
              <button
                type="button"
                aria-label={sheetOpen ? 'Close menu' : 'Open menu'}
                onClick={() => {
                  playClick();
                  setSheetOpen((p) => !p);
                }}
                className={`relative -mt-7 h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 ${
                  sheetOpen
                    ? 'bg-gradient-to-br from-intuition-primary to-cyan-300 text-black rotate-45 shadow-[0_18px_40px_rgba(0,243,255,0.45),0_0_0_4px_rgba(0,243,255,0.18)]'
                    : 'bg-gradient-to-br from-intuition-secondary via-intuition-secondary to-intuition-purple text-white shadow-[0_18px_40px_rgba(255,30,109,0.45),0_0_0_4px_rgba(255,30,109,0.16)]'
                }`}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full ring-1 ring-white/20 pointer-events-none"
                />
                <Plus size={26} strokeWidth={2.5} />
              </button>
            </div>

            {DOCK.right.map((it) => (
              <DockButton
                key={it.path}
                item={it}
                active={isActive(it.path)}
                onSelect={() => setSheetOpen(false)}
              />
            ))}
          </div>
        </div>
      </nav>

      <MobileNavSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={goCreate}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        walletAddress={walletAddress}
      />
    </div>
  );
};

export default MobileLayout;
