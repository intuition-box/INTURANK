import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Wallet, Menu, X, TrendingUp, Users, BarChart2, Terminal, LogOut, Copy, ChevronDown, AlertTriangle, Globe, Layers, ArrowRightLeft, Activity, Home, UserCircle, Search, Github, Plus, Shield, ExternalLink, BookOpen, MessageSquare, Twitter, Send, Coins, HeartPulse, FileText, ChevronsRight, BadgeCheck } from 'lucide-react';
import { connectWallet, getConnectedAccount, getClientChainId, switchNetwork, disconnectWallet } from '../services/web3';
import { CHAIN_ID } from '../constants';
import { playHover, playClick } from '../services/audio';
import Logo from './Logo';
import WalletModal from './WalletModal';
import { toast } from './Toast';

interface LayoutProps {
  children: React.ReactNode;
}

const TRUST_SWAP_URL = "https://aero.drome.eth.limo/swap?from=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&to=0x6cd905df2ed214b22e0d48ff17cd4200c1c6d8a3&chain0=8453&chain1=8453";

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
    <circle cx="30" cy="30" r="4" fill="#00f3ff" className="animate-pulse" />
  </svg>
);

interface NavItemProps {
  to: string;
  label: string;
  icon: any;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, label, icon, active, onClick }) => (
  <Link
    to={to}
    onClick={() => { playClick(); onClick(); }}
    onMouseEnter={playHover}
    className={`group relative flex items-center gap-2 px-6 py-2.5 text-[10px] font-black tracking-widest font-mono transition-all duration-300 clip-path-slant border-2 ${
      active
        ? 'text-black bg-intuition-primary border-intuition-primary shadow-[0_0_25px_rgba(0,243,255,0.4)]'
        : 'text-slate-400 border-slate-900/50 hover:text-white hover:border-intuition-primary/40 hover:bg-intuition-primary/5'
    }`}
  >
    <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3 bg-white transition-all duration-500 ${active ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'}`}></div>
    {icon}
    <span>{label}</span>
  </Link>
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isIntelOpen, setIsIntelOpen] = useState(false);
  const [chainId, setChainId] = useState<number>(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const intelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkConnection = async () => {
      const account = await getConnectedAccount();
      if (account) setWalletAddress(account);
      const cId = await getClientChainId();
      setChainId(cId);
    };
    checkConnection();

    if ((window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', (chainIdHex: string) => {
        setChainId(parseInt(chainIdHex, 16));
      });
      (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) setWalletAddress(accounts[0]);
        else setWalletAddress(null);
      });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsWalletDropdownOpen(false);
      }
      if (intelRef.current && !intelRef.current.contains(event.target as Node)) {
        setIsIntelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleConnect = async () => {
    playClick();
    const address = await connectWallet();
    if (address) {
      setWalletAddress(address);
      setIsWalletModalOpen(false);
      const cId = await getClientChainId();
      setChainId(cId);
      toast.success("UPLINK_ESTABLISHED: Identity synchronized.");
    } else {
        setIsWalletModalOpen(false);
    }
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    playClick();
    e.stopPropagation();
    disconnectWallet();
    setWalletAddress(null);
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

  const openModal = () => {
    playClick();
    setIsWalletModalOpen(true);
  }

  const handleNewSignal = () => {
    playClick();
    setIsMenuOpen(false);
    navigate('/coming-soon');
  };

  const mainNavItems = [
    { label: 'SYSTEM_ROOT', path: '/', icon: <Home size={14} /> },
    { label: 'MARKETS', path: '/markets', icon: <TrendingUp size={14} /> },
    { label: 'ACTIVITY', path: '/feed', icon: <Globe size={14} /> },
    { label: 'PORTFOLIO', path: '/portfolio', icon: <Users size={14} /> },
  ];

  const intelItems = [
    { label: 'DOCUMENTATION', path: '/documentation', icon: <FileText size={14} /> },
    { label: 'LEADERBOARD', path: '/stats', icon: <BarChart2 size={14} /> },
    { label: 'CONFLICT_COMPARE', path: '/compare', icon: <ArrowRightLeft size={14} /> },
    { label: 'SECTOR_INDEXES', path: '/indexes', icon: <Layers size={14} /> },
    { label: 'SYSTEM_HEALTH', path: '/health', icon: <HeartPulse size={14} /> },
  ];

  if (walletAddress) {
    intelItems.push({
      label: 'REPUTATION',
      path: `/profile/${walletAddress}`,
      icon: <UserCircle size={14} />
    });
  }

  const isActive = (path: string) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  const isIntelActive = intelItems.some(i => location.pathname.startsWith(i.path));

  return (
    <div className="min-h-screen bg-intuition-dark text-slate-300 flex flex-col font-sans selection:bg-intuition-primary selection:text-black">

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnect={handleConnect}
      />

      <nav className="fixed top-0 w-full z-50 border-b-2 border-intuition-primary/10 bg-black/95 backdrop-blur-2xl shadow-[0_0_30px_rgba(0,243,255,0.05)]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">

            <div
              className="flex items-center flex-shrink-0 gap-4 group cursor-pointer"
              onMouseEnter={playHover}
            >
              <div className="relative group-hover:scale-105 transition-transform duration-500">
                <div className="w-11 h-11 rounded-none bg-black border-2 border-intuition-primary flex items-center justify-center text-intuition-primary shadow-[0_0_15px_rgba(0,243,255,0.3)] group-hover:shadow-[0_0_25px_rgba(0,243,255,0.5)] transition-all duration-500 clip-path-slant">
                  <Logo className="w-6 h-6 text-intuition-primary group-hover:rotate-12 transition-transform" />
                </div>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-intuition-secondary rounded-full animate-pulse shadow-[0_0_15px_#ff1e6d]"></div>
              </div>
              <div className="flex flex-col group-hover:translate-x-1 transition-transform duration-300">
                <Link to="/" onClick={playClick} className="text-xl font-black tracking-widest text-white font-display transition-all duration-500 text-glow-blue group-hover:text-intuition-primary">
                  INTU<span className="text-intuition-primary group-hover:text-white">RANK</span>
                </Link>
                <span className="hidden md:block text-[9px] text-intuition-primary/60 font-mono tracking-[0.2em] uppercase font-black">V.1.3.1 STABLE</span>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-1.5">
              {mainNavItems.map((item) => (
                <NavItem 
                  key={item.path} 
                  to={item.path} 
                  label={item.label} 
                  icon={item.icon} 
                  active={isActive(item.path)} 
                  onClick={() => setIsMenuOpen(false)} 
                />
              ))}

              <div className="relative" ref={intelRef}>
                <button
                  onClick={() => { playClick(); setIsIntelOpen(!isIntelOpen); }}
                  onMouseEnter={playHover}
                  className={`group relative flex items-center gap-2 px-6 py-2.5 text-[10px] font-black tracking-widest font-mono transition-all duration-300 clip-path-slant border-2 ${isIntelActive || isIntelOpen
                    ? 'text-intuition-primary border-intuition-primary/40 bg-white/5'
                    : 'text-slate-400 border-slate-900/50 hover:text-white hover:border-intuition-primary/40 hover:bg-intuition-primary/5'
                    }`}
                >
                  <Activity size={14} /> INTEL <ChevronDown size={10} className={`transition-transform duration-300 ${isIntelOpen ? 'rotate-180' : ''}`} />
                </button>

                {isIntelOpen && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-black border-2 border-intuition-primary/30 shadow-[0_0_50px_rgba(0,0,0,1)] z-[60] clip-path-slant p-1 animate-in slide-in-from-top-2">
                    <div className="bg-[#080a12] p-1">
                      {intelItems.map(item => (
                        <Link
                          key={item.label}
                          to={item.path}
                          onClick={() => { playClick(); setIsIntelOpen(false); }}
                          onMouseEnter={playHover}
                          className={`flex items-center gap-3 px-4 py-3 text-[9px] font-black font-mono tracking-widest hover:bg-intuition-primary hover:text-black transition-colors uppercase ${isActive(item.path) ? 'text-intuition-primary bg-white/5' : 'text-slate-400'}`}
                        >
                          {item.icon} {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={TRUST_SWAP_URL}
                target="_blank"
                rel="noreferrer"
                onMouseEnter={playHover}
                onClick={playClick}
                className="group relative hidden md:flex items-center gap-2 px-6 py-2.5 text-[10px] font-black tracking-widest font-mono transition-all duration-300 clip-path-slant border-2 border-intuition-success/40 text-intuition-success hover:bg-intuition-success hover:text-black shadow-[0_0_15px_rgba(0,255,157,0.2)]"
              >
                <Coins size={14} /> GET_TRUST
              </a>

              <button
                onClick={handleNewSignal}
                onMouseEnter={playHover}
                className="group relative hidden md:flex items-center gap-2 px-6 py-2.5 text-[10px] font-black tracking-widest font-mono transition-all duration-300 clip-path-slant bg-intuition-secondary text-white shadow-[0_0_20px_rgba(255,30,109,0.4)] hover:bg-white hover:text-intuition-secondary active:scale-95 border-2 border-transparent"
              >
                <Plus size={16} /> NEW_SIGNAL
              </button>

              {walletAddress && chainId !== CHAIN_ID && (
                <button
                  onClick={async () => { playClick(); await switchNetwork(); }}
                  className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-intuition-danger text-white font-black font-mono text-[9px] clip-path-slant animate-pulse shadow-[0_0_15px_#ff1e6d]"
                >
                  <AlertTriangle size={14} /> WRONG_NET
                </button>
              )}

              <div className="hidden md:block relative" ref={dropdownRef}>
                <button
                  onClick={walletAddress ? toggleDropdown : openModal}
                  onMouseEnter={playHover}
                  className={`group relative flex items-center gap-2 px-5 py-2.5 font-mono text-[10px] font-black tracking-widest transition-all duration-300 clip-path-slant border-2 cursor-pointer ${walletAddress
                    ? 'bg-black border-intuition-success/40 text-intuition-success shadow-[0_0_15px_rgba(0,255,157,0.1)] hover:border-intuition-success'
                    : 'bg-black border-slate-800 text-white hover:border-intuition-primary hover:text-intuition-primary'
                    }`}
                >
                  <Wallet size={14} className={walletAddress ? "text-intuition-success" : "text-intuition-primary"} />
                  <span>
                    {walletAddress ? (
                      <span className="flex items-center gap-2">
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        <ChevronDown size={12} className={`transition-transform duration-300 ${isWalletDropdownOpen ? 'rotate-180' : ''}`} />
                      </span>
                    ) : (
                      <span>UPLINK</span>
                    )}
                  </span>
                </button>

                {isWalletDropdownOpen && walletAddress && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-black border-2 border-intuition-primary/30 shadow-[0_0_50px_rgba(0,0,0,1)] z-[60] clip-path-slant animate-in fade-in zoom-in duration-200">
                    <div className="p-1 space-y-0.5 bg-[#080a12]">
                      <div className="px-4 py-3 border-b border-white/5 text-[9px] font-black font-mono text-slate-500 uppercase tracking-[0.3em] mb-1">
                        Terminal Access
                      </div>
                      <button
                        onClick={handleCopyAddress}
                        onMouseEnter={playHover}
                        className="w-full flex items-center gap-4 px-4 py-4 text-left text-[10px] font-black font-mono text-slate-300 hover:bg-white/5 hover:text-intuition-primary transition-colors uppercase tracking-widest"
                      >
                        <Copy size={14} /> COPY_IDENT_HASH
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
                )}
              </div>
            </div>

            <div className="lg:hidden">
              <button
                onClick={() => { playClick(); setIsMenuOpen(!isMenuOpen); }}
                className="text-intuition-primary p-3 border-2 border-slate-900 rounded-none bg-black clip-path-slant shadow-lg active:scale-95 transition-transform"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="lg:hidden bg-black/98 backdrop-blur-2xl border-b-2 border-intuition-primary/20 absolute w-full z-[100] animate-in slide-in-from-top-4 duration-300">
            <div className="px-4 pt-4 pb-10 space-y-2">
              {[...mainNavItems, ...intelItems].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => { playClick(); setIsMenuOpen(false); }}
                  className={`flex items-center gap-4 px-5 py-4 border-2 text-[10px] font-black font-mono tracking-widest clip-path-slant transition-all ${isActive(item.path)
                    ? 'text-black bg-intuition-primary border-intuition-primary'
                    : 'text-slate-400 border-slate-900 hover:text-white bg-white/5'
                    }`}
                >
                  {item.icon} {item.label}
                </Link>
              ))}

              <a
                href={TRUST_SWAP_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => { playClick(); setIsMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-3 px-5 py-4 border-2 border-intuition-success text-intuition-success font-black font-mono text-[10px] tracking-widest clip-path-slant mt-6 hover:bg-intuition-success hover:text-black transition-all"
              >
                <Coins size={18} /> ACQUIRE_$TRUST_TOKEN
              </a>

              <button
                onClick={handleNewSignal}
                className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-intuition-secondary text-white font-black font-mono text-[10px] tracking-widest clip-path-slant shadow-xl mt-2 border-2 border-transparent active:scale-95 transition-transform"
              >
                <Plus size={18} /> NEW_SIGNAL_INBOUND
              </button>

              {walletAddress ? (
                <button
                  onClick={handleDisconnect}
                  className="w-full py-4 border-2 border-intuition-danger text-intuition-danger font-mono font-black text-[10px] tracking-widest bg-intuition-danger/5 clip-path-slant mt-2"
                >
                  EXIT_SECURE_SESSION
                </button>
              ) : (
                <button
                  onClick={() => { playClick(); setIsMenuOpen(false); setIsWalletModalOpen(true); }}
                  className="w-full py-4 border-2 border-intuition-primary text-intuition-primary font-mono font-black text-[10px] tracking-widest bg-intuition-primary/5 clip-path-slant mt-2"
                >
                  ESTABLISH_NEURAL_LINK
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="flex-grow pt-20 retro-grid relative z-10">
        {children}
      </main>

      <footer className="border-t border-white/5 bg-[#020308] py-24 mt-auto z-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-intuition-primary/[0.04] to-transparent pointer-events-none"></div>
        <div className="max-w-[1600px] mx-auto px-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-20 mb-24">

            <div className="md:col-span-2 space-y-10">
              <div className="flex items-center gap-6 group cursor-pointer" onMouseEnter={playHover}>
                <div className="w-16 h-16 border-2 border-intuition-primary rounded-none flex items-center justify-center text-intuition-primary group-hover:shadow-[0_0_30px_rgba(0,243,255,0.5)] group-hover:scale-110 transition-all duration-700 clip-path-slant">
                  <Logo className="w-9 h-9 group-hover:rotate-12 transition-transform" />
                </div>
                <span className="text-5xl font-display font-black tracking-tight text-white group-hover:text-intuition-primary transition-all duration-500 uppercase text-glow-blue">
                  INTU<span className="group-hover:text-white transition-colors">RANK</span>
                </span>
              </div>
              <p className="text-slate-200 font-mono text-sm leading-relaxed max-w-lg uppercase tracking-wider font-black opacity-80">
                Quantifying reputation as a tradable asset on the Intuition Network. Establishing the global source of truth via semantic dynamics.
              </p>
              <div className="flex flex-wrap gap-6">
                <a href="https://x.com/inturank" target="_blank" rel="noreferrer" 
                   onMouseEnter={playHover}
                   className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-none border border-white/10 text-slate-400 hover:text-white hover:border-intuition-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:-translate-y-1 transition-all duration-300 clip-path-slant group">
                  <Twitter size={24} className="group-hover:scale-110 transition-transform" />
                </a>
                <a href="https://github.com/intuition-box/INTURANK" target="_blank" rel="noreferrer" 
                   onMouseEnter={playHover}
                   className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-none border border-white/10 text-slate-400 hover:text-white hover:border-intuition-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:-translate-y-1 transition-all duration-300 clip-path-slant group">
                  <Github size={24} className="group-hover:scale-110 transition-transform" />
                </a>
                <a href="https://discord.gg/gz62ER2e7a" target="_blank" rel="noreferrer" 
                   onMouseEnter={playHover}
                   className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-none border border-white/10 text-slate-400 hover:text-white hover:border-intuition-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:-translate-y-1 transition-all duration-300 clip-path-slant group">
                  <DiscordIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </a>
                <a href="https://t.me/inturank" target="_blank" rel="noreferrer" 
                   onMouseEnter={playHover}
                   className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-none border border-white/10 text-slate-400 hover:text-white hover:border-intuition-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:-translate-y-1 transition-all duration-300 clip-path-slant group">
                  <Send size={24} className="group-hover:scale-110 transition-transform" />
                </a>
                <a href="https://inturank.medium.com" target="_blank" rel="noreferrer" 
                   onMouseEnter={playHover}
                   className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-none border border-white/10 text-slate-400 hover:text-white hover:border-intuition-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:-translate-y-1 transition-all duration-300 clip-path-slant group">
                  <MediumIcon className="w-7 h-7 group-hover:scale-110 transition-transform" />
                </a>
              </div>
            </div>

            <div className="space-y-8">
              <h4 className="text-[12px] font-black font-display text-intuition-primary uppercase tracking-[0.6em]">Protocol_Nodes</h4>
              <nav className="flex flex-col gap-5 font-mono text-[12px] text-slate-200 uppercase font-black">
                <Link to="/markets" className="hover:text-intuition-primary transition-colors flex items-center gap-3 group">
                   <ChevronsRight size={14} className="text-intuition-primary/0 group-hover:text-intuition-primary transition-all -ml-5 group-hover:ml-0" /> Market_Terminal
                </Link>
                <Link to="/feed" className="hover:text-intuition-primary transition-colors flex items-center gap-3 group">
                   <ChevronsRight size={14} className="text-intuition-primary/0 group-hover:text-intuition-primary transition-all -ml-5 group-hover:ml-0" /> Global_Activity
                </Link>
                <Link to="/stats" className="hover:text-intuition-primary transition-colors flex items-center gap-3 group">
                   <ChevronsRight size={14} className="text-intuition-primary/0 group-hover:text-intuition-primary transition-all -ml-5 group-hover:ml-0" /> Network_Scores
                </Link>
                <Link to="/portfolio" className="hover:text-intuition-primary transition-colors flex items-center gap-3 group">
                   <ChevronsRight size={14} className="text-intuition-primary/0 group-hover:text-intuition-primary transition-all -ml-5 group-hover:ml-0" /> Asset_Ledger
                </Link>
              </nav>
            </div>

            <div className="space-y-8">
              <h4 className="text-[12px] font-black font-display text-intuition-secondary uppercase tracking-[0.6em] text-glow-red">Ecosystem_Hub</h4>
              <nav className="flex flex-col gap-5 font-mono text-[12px] text-slate-200 uppercase font-black">
                <Link to="/documentation" className="hover:text-intuition-secondary transition-colors flex items-center gap-3 group">
                   <ChevronsRight size={14} className="text-intuition-secondary/0 group-hover:text-intuition-secondary transition-all -ml-5 group-hover:ml-0" /> Documentation <FileText size={12} />
                </Link>
                <a href={TRUST_SWAP_URL} target="_blank" rel="noreferrer" className="text-intuition-success hover:text-white transition-colors flex items-center gap-3 group">
                   <ChevronsRight size={14} className="text-intuition-success/0 group-hover:text-intuition-success transition-all -ml-5 group-hover:ml-0" /> Liquidity_Uplink ($TRUST) <ExternalLink size={12} />
                </a>
                <a href="https://intuition.systems" target="_blank" rel="noreferrer" className="hover:text-intuition-secondary transition-colors flex items-center gap-3 group">
                   <ChevronsRight size={14} className="text-intuition-secondary/0 group-hover:text-intuition-secondary transition-all -ml-5 group-hover:ml-0" /> Intuition_Home <ExternalLink size={12} />
                </a>
                <a href="https://docs.intuition.systems" target="_blank" rel="noreferrer" className="hover:text-intuition-secondary transition-colors flex items-center gap-3 group">
                   <ChevronsRight size={14} className="text-intuition-secondary/0 group-hover:text-intuition-secondary transition-all -ml-5 group-hover:ml-0" /> Core_Docs <BookOpen size={12} />
                </a>
                <a href="https://explorer.intuition.systems" target="_blank" rel="noreferrer" className="hover:text-intuition-secondary transition-colors flex items-center gap-3 group">
                   <ChevronsRight size={14} className="text-intuition-secondary/0 group-hover:text-intuition-secondary transition-all -ml-5 group-hover:ml-0" /> Network_Explorer <Globe size={12} />
                </a>
              </nav>
            </div>

          </div>

          <div className="pt-16 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 items-center justify-items-center gap-12">
            <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest font-black text-center md:text-left justify-self-start">
              Sector_04_ARES // Version_1.3.1_STABLE // © 2025 IntuRank_Systems
            </div>

            <div className="flex flex-col items-center group/powered relative">
              <span className="text-[11px] font-black font-mono text-slate-500 uppercase tracking-[0.8em] mb-4 group-hover/powered:text-white transition-all duration-500">Powered By</span>
              <a href="https://intuition.systems" target="_blank" rel="noreferrer" className="flex items-center gap-8 no-underline">
                <IntuitionTargetLogo />
                <span className="text-6xl font-display font-black tracking-[0.25em] text-white group-hover/powered:text-intuition-primary transition-all duration-700 uppercase text-glow-blue">
                  INTUITION
                </span>
              </a>
              <div className="absolute -bottom-6 w-48 h-px bg-gradient-to-r from-transparent via-intuition-primary/40 to-transparent"></div>
            </div>

            <div className="flex items-center justify-center md:justify-end gap-3 text-[10px] font-black font-mono text-intuition-secondary uppercase tracking-[0.5em] text-glow-red justify-self-end">
              <div className="w-2.5 h-2.5 bg-intuition-secondary animate-pulse shadow-[0_0_15px_#ff1e6d]"></div>
              System_Broadcasting_Live
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;