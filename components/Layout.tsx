
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, Menu, X, TrendingUp, Users, BarChart2, Home as HomeIcon, Terminal, LogOut, Copy, ChevronDown, AlertTriangle, PlusCircle, Globe, Layers, ArrowRightLeft, Activity, Home, UserCircle, Search, Github } from 'lucide-react';
import { connectWallet, getConnectedAccount, getClientChainId, switchNetwork, disconnectWallet } from '../services/web3';
import { CHAIN_ID } from '../constants';
import { playHover, playClick } from '../services/audio';
import Logo from './Logo';
import WalletModal from './WalletModal';

interface LayoutProps {
  children: React.ReactNode;
}

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
    }
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    playClick();
    e.stopPropagation();
    disconnectWallet(); // Clear persistence
    setWalletAddress(null);
    setIsWalletDropdownOpen(false);
  };

  const handleCopyAddress = (e: React.MouseEvent) => {
    playClick();
    e.stopPropagation();
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setIsWalletDropdownOpen(false);
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

  // Core Navigation
  const mainNavItems = [
    { label: 'SYSTEM_ROOT', path: '/', icon: <Home size={16} /> },
    { label: 'MARKETS', path: '/markets', icon: <TrendingUp size={16} /> },
    { label: 'PORTFOLIO', path: '/portfolio', icon: <Users size={16} /> },
    { label: 'LEADERBOARD', path: '/stats', icon: <BarChart2 size={16} /> },
  ];

  // Analytics Group (Intel)
  const intelItems = [
    { label: 'FEED', path: '/feed', icon: <Globe size={16} /> },
    { label: 'COMPARE', path: '/compare', icon: <ArrowRightLeft size={16} /> },
    { label: 'INDEXES', path: '/indexes', icon: <Layers size={16} /> },
    // Directory & Reputation
    { label: 'TRADER_DIRECTORY', path: '/stats', icon: <Search size={16} /> }, 
  ];

  if (walletAddress) {
      intelItems.push({ 
          label: 'MY_REPUTATION', 
          path: `/profile/${walletAddress}`, 
          icon: <UserCircle size={16} /> 
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

      <nav className="fixed top-0 w-full z-50 border-b border-intuition-primary/30 bg-intuition-dark/90 backdrop-blur-md shadow-[0_0_20px_rgba(0,243,255,0.15)]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div 
              className="flex items-center flex-shrink-0 gap-3 group cursor-pointer hover-glitch"
              onMouseEnter={playHover}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded bg-intuition-dark border border-intuition-primary flex items-center justify-center text-intuition-primary shadow-[0_0_15px_rgba(0,243,255,0.5)] group-hover:shadow-[0_0_25px_rgba(0,243,255,0.8)] transition-all duration-500 group-hover:rotate-180 clip-path-slant">
                  <Logo />
                </div>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-intuition-primary rounded-full animate-pulse shadow-[0_0_10px_#00f3ff]"></div>
              </div>
              <div className="flex flex-col">
                <Link to="/" onClick={playClick} className="text-xl font-black tracking-wider text-white font-display group-hover:text-intuition-primary transition-colors text-glow">
                  INTU<span className="text-intuition-primary group-hover:text-white transition-colors">RANK</span>
                </Link>
                <span className="hidden md:block text-[10px] text-intuition-primary/70 font-mono tracking-[0.2em] group-hover:tracking-[0.3em] transition-all">V.1.1.0 BETA</span>
              </div>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-2">
              {mainNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onMouseEnter={playHover}
                  onClick={playClick}
                  className={`group relative flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-wider font-mono transition-all duration-300 clip-path-slant border overflow-hidden ${
                    isActive(item.path)
                      ? 'text-intuition-dark bg-intuition-primary border-intuition-primary shadow-[0_0_20px_rgba(0,243,255,0.5)]'
                      : 'text-slate-400 border-transparent bg-white/5 hover:bg-intuition-primary/10 hover:text-intuition-primary hover:border-intuition-primary/50 hover:shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                  }`}
                >
                  <div className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110 group-hover:text-intuition-primary">
                    {item.icon}
                  </div>
                  {item.label}
                  
                  {!isActive(item.path) && (
                    <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-intuition-primary to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                  )}
                </Link>
              ))}

              {/* INTEL Dropdown */}
              <div className="relative" ref={intelRef}>
                  <button 
                    onClick={() => { playClick(); setIsIntelOpen(!isIntelOpen); }}
                    onMouseEnter={playHover}
                    className={`group relative flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-wider font-mono transition-all duration-300 clip-path-slant border overflow-hidden ${
                        isIntelActive || isIntelOpen
                          ? 'text-intuition-primary border-intuition-primary bg-intuition-primary/10 shadow-[0_0_20px_rgba(0,243,255,0.3)]'
                          : 'text-slate-400 border-transparent bg-white/5 hover:bg-intuition-primary/10 hover:text-intuition-primary hover:border-intuition-primary/50 hover:shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                      }`}
                  >
                      <Activity size={16} /> INTEL <ChevronDown size={12} className={`transition-transform duration-300 ${isIntelOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isIntelOpen && (
                      <div className="absolute top-full right-0 mt-2 w-72 bg-black border border-intuition-primary/50 shadow-[0_0_30px_rgba(0,243,255,0.3)] z-[60] clip-path-slant p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                          {intelItems.map(item => (
                              <Link 
                                key={item.label}
                                to={item.path}
                                onClick={() => { playClick(); setIsIntelOpen(false); }}
                                className={`flex items-center gap-3 px-4 py-3 text-xs font-bold font-mono hover:bg-intuition-primary/10 hover:text-intuition-primary transition-colors group ${isActive(item.path) ? 'text-intuition-primary' : 'text-slate-400'}`}
                              >
                                  {item.icon} {item.label}
                              </Link>
                          ))}
                      </div>
                  )}
              </div>
            </div>

            {/* Wallet Button */}
            <div className="flex items-center gap-3">
              {walletAddress && chainId !== CHAIN_ID && (
                  <button 
                      onClick={async () => {
                          playClick();
                          await switchNetwork();
                      }}
                      className="hidden md:flex items-center gap-2 px-4 py-2 bg-intuition-danger text-black font-bold font-mono text-xs clip-path-slant hover:bg-white transition-colors animate-pulse shadow-[0_0_15px_rgba(255,0,85,0.5)]"
                  >
                      <AlertTriangle size={14} /> WRONG NET
                  </button>
              )}

              <div className="hidden md:block relative" ref={dropdownRef}>
                <button
                  onClick={walletAddress ? toggleDropdown : openModal}
                  onMouseEnter={playHover}
                  className={`group relative flex items-center gap-2 px-6 py-2 font-mono text-xs font-bold tracking-wide transition-all duration-300 clip-path-slant border cursor-pointer z-50 ${
                    walletAddress
                      ? 'bg-intuition-success/10 border-intuition-success text-intuition-success shadow-[0_0_15px_rgba(0,255,157,0.4)] hover:shadow-[0_0_25px_rgba(0,255,157,0.6)]'
                      : 'bg-intuition-primary/10 border-intuition-primary text-intuition-primary hover:bg-intuition-primary/20 shadow-[0_0_15px_rgba(0,243,255,0.3)] hover:shadow-[0_0_25px_rgba(0,243,255,0.5)]'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out"></div>
                  
                  <div className="transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 relative z-10">
                    <Wallet size={14} />
                  </div>
                  <span className="relative z-10">
                    {walletAddress ? (
                      <span className="flex items-center gap-2">
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        <ChevronDown size={12} className={`transition-transform duration-300 ${isWalletDropdownOpen ? 'rotate-180' : ''}`}/>
                      </span>
                    ) : (
                      <span>CONNECT_WALLET</span>
                    )}
                  </span>
                </button>

                {isWalletDropdownOpen && walletAddress && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-black border border-intuition-primary/50 shadow-[0_0_30px_rgba(0,243,255,0.3)] z-[60] clip-path-slant animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-1 space-y-1">
                        <div className="px-4 py-2 border-b border-white/10 text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">
                          System Access
                        </div>
                        <button 
                          onClick={handleCopyAddress}
                          onMouseEnter={playHover}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-mono text-slate-300 hover:bg-intuition-primary/10 hover:text-intuition-primary transition-colors group"
                        >
                          <Copy size={14} className="group-hover:scale-110 transition-transform"/> 
                          COPY_ADDRESS
                        </button>
                        <button 
                          onClick={handleDisconnect}
                          onMouseEnter={playHover}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-mono text-intuition-danger hover:bg-intuition-danger/10 transition-colors group border-t border-white/5"
                        >
                          <LogOut size={14} className="group-hover:translate-x-1 transition-transform"/> 
                          DISCONNECT_SYSTEM
                        </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => {
                    playClick();
                    setIsMenuOpen(!isMenuOpen);
                }}
                className="text-intuition-primary hover:text-white p-2 border border-intuition-primary/30 rounded bg-intuition-primary/10 hover-glow clip-path-slant group"
              >
                <div className="group-hover:rotate-180 transition-transform duration-500">
                   {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-intuition-dark/95 backdrop-blur-xl border-b border-intuition-primary/30 absolute w-full z-[100] animate-in slide-in-from-top-2">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {[...mainNavItems, ...intelItems].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                      playClick();
                      setIsMenuOpen(false);
                  }}
                  className={`group relative block px-3 py-3 rounded border text-sm font-bold font-mono clip-path-slant transition-all hover-glow overflow-hidden ${
                    isActive(item.path)
                      ? 'text-intuition-dark bg-intuition-primary border-intuition-primary shadow-[0_0_10px_rgba(0,243,255,0.2)]'
                      : 'text-slate-400 border-transparent hover:text-intuition-primary hover:border-intuition-primary/30 bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="group-hover:rotate-12 transition-transform duration-300">
                        {item.icon}
                    </div>
                    {item.label}
                  </div>
                </Link>
              ))}
              
              {walletAddress ? (
                 <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
                    <button
                      onClick={handleDisconnect}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-intuition-danger text-intuition-danger font-mono font-bold bg-intuition-danger/10 clip-path-slant hover-glow"
                    >
                      DISCONNECT
                    </button>
                 </div>
              ) : (
                <button
                  onClick={() => {
                    playClick();
                    setIsMenuOpen(false);
                    connectWallet();
                  }}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 border border-intuition-primary text-intuition-primary font-mono font-bold bg-intuition-primary/10 clip-path-slant hover-glow"
                >
                  CONNECT_WALLET
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="flex-grow pt-16 retro-grid relative z-10">
        {children}
      </main>

      <footer className="border-t border-intuition-primary/20 bg-intuition-dark py-8 md:py-12 mt-auto z-20 relative shadow-[0_-5px_20px_rgba(0,243,255,0.05)]">
        <div className="w-full px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
          
          <div className="flex flex-col gap-2 items-center md:items-start">
             <div className="flex items-center gap-2 text-[10px] font-mono text-intuition-primary/60 uppercase tracking-widest hover-glitch cursor-help" onMouseEnter={playHover}>
                 <div className="w-2 h-2 bg-intuition-success animate-pulse shadow-[0_0_8px_rgba(0,255,157,0.8)]"></div>
                 System Online
             </div>
             <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                 Chain_ID [{CHAIN_ID}] :: v.1.1.0
             </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 group cursor-pointer" onMouseEnter={playHover}>
             <div className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.4em] group-hover:text-intuition-primary transition-colors">
                Powered By
             </div>
             <a href="https://intuition.systems" target="_blank" rel="noreferrer" onClick={playClick} className="flex items-center gap-4">
                <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white group-hover:text-intuition-primary transition-all duration-500 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] group-hover:drop-shadow-[0_0_20px_rgba(0,243,255,0.8)] group-hover:rotate-180">
                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="4" strokeOpacity="0.3" strokeLinecap="round" strokeDasharray="10 5" />
                    <path d="M50 10 A40 40 0 0 1 90 50" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                    <path d="M50 90 A40 40 0 0 1 10 50" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="4" />
                    <circle cx="50" cy="50" r="10" fill="currentColor" />
                </svg>
                <div className="flex flex-col text-left">
                    <span className="text-3xl font-display font-bold tracking-[0.25em] text-white group-hover:text-intuition-primary transition-colors drop-shadow-lg leading-none text-glow">
                        INTUITION
                    </span>
                    <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-intuition-primary to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                </div>
             </a>
          </div>

          <div className="flex gap-6 items-center">
             <a href="https://github.com/intuition-box/INTURANK" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-intuition-primary transition-all duration-300 hover:scale-125 hover:drop-shadow-[0_0_15px_rgba(0,243,255,0.6)] hover:-translate-y-1" title="GitHub">
                <Github size={24} />
             </a>
             <a href="https://x.com/inturank" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-intuition-primary transition-all duration-300 hover:scale-125 hover:drop-shadow-[0_0_15px_rgba(0,243,255,0.6)] hover:-translate-y-1" title="X (Twitter)">
                {/* X Logo SVG */}
                <svg viewBox="0 0 24 24" aria-hidden="true" className="w-6 h-6 fill-current"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>
             </a>
             <a href="https://t.me/inturank" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-intuition-primary transition-all duration-300 hover:scale-125 hover:drop-shadow-[0_0_15px_rgba(0,243,255,0.6)] hover:-translate-y-1" title="Telegram">
                {/* Telegram Logo SVG */}
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
             </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;