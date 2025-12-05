import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, Menu, X, TrendingUp, Users, BarChart2, Home as HomeIcon, Terminal, LogOut, Copy, ChevronDown, AlertTriangle } from 'lucide-react';
import { connectWallet, getConnectedAccount, getClientChainId, switchNetwork } from '../services/web3';
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
  const [chainId, setChainId] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Check for existing connection on load
  useEffect(() => {
    const checkConnection = async () => {
      // Only auto-connect if user has previously connected (optional: check localStorage)
      // For now, we check if authorized
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsWalletDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleConnect = async () => {
    playClick();
    // This is now passed to the modal, which awaits it.
    const address = await connectWallet();
    if (address) {
        setWalletAddress(address);
        setIsWalletModalOpen(false); // Close modal on success inside Layout too as backup
        const cId = await getClientChainId();
        setChainId(cId);
    }
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    playClick();
    e.stopPropagation();
    setWalletAddress(null);
    setIsWalletDropdownOpen(false);
    // Optionally clear localStorage if you implement persistence later
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

  const navItems = [
    { label: 'SYSTEM_ROOT', path: '/', icon: <HomeIcon size={16} /> },
    { label: 'MKTS_EXPLORER', path: '/markets', icon: <TrendingUp size={16} /> },
    { label: 'PLAYER_STATS', path: '/dashboard', icon: <Users size={16} /> },
    { label: 'HIGH_SCORES', path: '/stats', icon: <BarChart2 size={16} /> },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-intuition-dark text-slate-300 flex flex-col font-sans selection:bg-intuition-primary selection:text-black">
      
      <WalletModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
        onConnect={handleConnect} 
      />

      {/* HUD Top Bar */}
      <nav className="fixed top-0 w-full z-50 border-b border-intuition-primary/30 bg-intuition-dark/90 backdrop-blur-md shadow-[0_0_20px_rgba(0,243,255,0.1)]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div 
              className="flex items-center flex-shrink-0 gap-3 group cursor-pointer hover-glitch"
              onMouseEnter={playHover}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded bg-intuition-dark border border-intuition-primary flex items-center justify-center text-intuition-primary shadow-[0_0_10px_rgba(0,243,255,0.4)] group-hover:shadow-[0_0_20px_rgba(0,243,255,0.6)] transition-all duration-500 group-hover:rotate-180 clip-path-slant">
                  <Logo />
                </div>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-intuition-primary rounded-full animate-pulse"></div>
              </div>
              <div className="flex flex-col">
                <Link to="/" onClick={playClick} className="text-xl font-black tracking-wider text-white font-display group-hover:text-intuition-primary transition-colors">
                  INTU<span className="text-intuition-primary group-hover:text-white transition-colors">RANK</span>
                </Link>
                <span className="hidden md:block text-[10px] text-intuition-primary/70 font-mono tracking-[0.2em] group-hover:tracking-[0.3em] transition-all">V.1.0.4 ALPHA</span>
              </div>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onMouseEnter={playHover}
                  onClick={playClick}
                  className={`group relative flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-wider font-mono transition-all duration-300 clip-path-slant border overflow-hidden ${
                    isActive(item.path)
                      ? 'text-intuition-dark bg-intuition-primary border-intuition-primary shadow-[0_0_15px_rgba(0,243,255,0.4)]'
                      : 'text-slate-400 border-transparent bg-white/5 hover:bg-intuition-primary/10 hover:text-intuition-primary hover:border-intuition-primary/50'
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
            </div>

            {/* Wallet Button & Dropdown */}
            <div className="flex items-center gap-3">
              {walletAddress && chainId !== CHAIN_ID && (
                  <button 
                      onClick={async () => {
                          playClick();
                          await switchNetwork();
                      }}
                      className="hidden md:flex items-center gap-2 px-4 py-2 bg-intuition-danger text-black font-bold font-mono text-xs clip-path-slant hover:bg-white transition-colors animate-pulse"
                  >
                      <AlertTriangle size={14} />
                      SWITCH TO MAINNET
                  </button>
              )}

              <div className="hidden md:block relative" ref={dropdownRef}>
                <button
                  onClick={walletAddress ? toggleDropdown : openModal}
                  onMouseEnter={playHover}
                  className={`group relative flex items-center gap-2 px-6 py-2 font-mono text-xs font-bold tracking-wide transition-all duration-300 clip-path-slant border cursor-pointer z-50 ${
                    walletAddress
                      ? 'bg-intuition-success/10 border-intuition-success text-intuition-success shadow-[0_0_10px_rgba(0,255,157,0.2)]'
                      : 'bg-intuition-primary/10 border-intuition-primary text-intuition-primary hover:bg-intuition-primary/20'
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

                {/* Dropdown Menu */}
                {isWalletDropdownOpen && walletAddress && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-black border border-intuition-primary/50 shadow-[0_0_20px_rgba(0,243,255,0.2)] z-[60] clip-path-slant animate-in fade-in slide-in-from-top-2 duration-200">
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
              {navItems.map((item) => (
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
                  <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-intuition-primary to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                </Link>
              ))}
              
              {walletAddress ? (
                 <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
                    <div className="px-3 text-[10px] font-mono text-slate-500 uppercase">Connected: {walletAddress.slice(0,6)}...</div>
                    {chainId !== CHAIN_ID && (
                      <button 
                          onClick={async () => {
                              playClick();
                              await switchNetwork();
                              setIsMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-intuition-danger text-black font-mono font-bold clip-path-slant hover-glow animate-pulse"
                      >
                          <AlertTriangle size={14} /> SWITCH TO MAINNET
                      </button>
                    )}
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
                    // Use connectWallet directly for mobile functionality instead of opening modal
                    connectWallet();
                  }}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 border border-intuition-primary text-intuition-primary font-mono font-bold bg-intuition-primary/10 clip-path-slant hover-glow group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out"></div>
                  <Wallet size={16} className="group-hover:rotate-12 transition-transform" />
                  CONNECT_WALLET
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-grow pt-16 retro-grid relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-intuition-primary/20 bg-intuition-dark py-8 md:py-12 mt-auto z-20 relative">
        <div className="w-full px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
          
          {/* System Status */}
          <div className="flex flex-col gap-2 items-center md:items-start">
             <div className="flex items-center gap-2 text-[10px] font-mono text-intuition-primary/60 uppercase tracking-widest hover-glitch cursor-help" onMouseEnter={playHover}>
                 <div className="w-2 h-2 bg-intuition-success animate-pulse shadow-[0_0_8px_rgba(0,255,157,0.6)]"></div>
                 System Online
             </div>
             <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                 Chain_ID [{CHAIN_ID}] :: v.1.0.4
             </div>
          </div>

          {/* Powered By Badge - CENTERPIECE */}
          <div className="flex flex-col items-center justify-center gap-4 group cursor-pointer" onMouseEnter={playHover}>
             <div className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.4em] group-hover:text-intuition-primary transition-colors">
                Powered By
             </div>
             <a href="https://intuition.systems" target="_blank" rel="noreferrer" onClick={playClick} className="flex items-center gap-4">
                {/* Intuition Icon SVG - Custom Recreation of the Logo */}
                <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white group-hover:text-intuition-primary transition-all duration-500 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] group-hover:drop-shadow-[0_0_20px_rgba(0,243,255,0.6)] group-hover:rotate-180">
                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="4" strokeOpacity="0.3" strokeLinecap="round" strokeDasharray="10 5" />
                    <path d="M50 10 A40 40 0 0 1 90 50" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                    <path d="M50 90 A40 40 0 0 1 10 50" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="4" />
                    <circle cx="50" cy="50" r="10" fill="currentColor" />
                </svg>
                {/* Intuition Text Logo */}
                <div className="flex flex-col text-left">
                    <span className="text-3xl font-display font-bold tracking-[0.25em] text-white group-hover:text-intuition-primary transition-colors drop-shadow-lg leading-none">
                        INTUITION
                    </span>
                    <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-intuition-primary to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                </div>
             </a>
          </div>

          {/* Social Links */}
          <div className="flex gap-4">
             <a 
               href="https://github.com/0xdopewilly/INTURANK" 
               target="_blank" 
               rel="noreferrer" 
               onMouseEnter={playHover} 
               onClick={playClick}
               className="group p-2 bg-white/5 border border-white/10 hover:border-intuition-primary/50 hover:bg-intuition-primary/10 rounded transition-all hover:scale-110"
               title="Github"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-intuition-primary transition-colors">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
             </a>
             <a 
               href="https://x.com/inturank" 
               target="_blank" 
               rel="noreferrer" 
               onMouseEnter={playHover} 
               onClick={playClick}
               className="group p-2 bg-white/5 border border-white/10 hover:border-intuition-primary/50 hover:bg-intuition-primary/10 rounded transition-all hover:scale-110"
               title="Twitter / X"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-intuition-primary transition-colors">
                  <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
                  <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
                </svg>
             </a>
             <a 
               href="https://t.me/inturank" 
               target="_blank" 
               rel="noreferrer" 
               onMouseEnter={playHover} 
               onClick={playClick}
               className="group p-2 bg-white/5 border border-white/10 hover:border-intuition-primary/50 hover:bg-intuition-primary/10 rounded transition-all hover:scale-110"
               title="Telegram"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-intuition-primary transition-colors">
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
                </svg>
             </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;