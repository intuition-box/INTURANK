import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, TrendingUp, Filter, Tag, Zap, Activity, ShieldCheck, Loader2, Database, ChevronDown, ArrowDown, Star, LayoutGrid, Grid, Info } from 'lucide-react';
import { formatEther } from 'viem';
import { getAllAgents, searchGlobalAgents } from '../services/graphql';
import { playHover, playClick } from '../services/audio';
import { Account } from '../types';
import { getWatchlist, getConnectedAccount } from '../services/web3';
import { toast } from '../components/Toast';

type SortOption = 'MCAP_DESC' | 'MCAP_ASC' | 'VOL_DESC' | 'VOL_ASC' | 'PRICE_DESC' | 'PRICE_ASC' | 'TRUST_DESC' | 'TRUST_ASC';
type ViewMode = 'GRID' | 'HEATMAP';

const Markets: React.FC = () => {
  const [agents, setAgents] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [serverResults, setServerResults] = useState<Account[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('GRID');
  const [account, setAccount] = useState<string | null>(null);
  
  // Sorting State - Default to Market Cap High
  const [sortOption, setSortOption] = useState<SortOption>('MCAP_DESC');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  
  // Debounce ref
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAllAgents();
        setAgents(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    
    getConnectedAccount().then(setAccount);

    // Initial Watchlist load
    if (account) setWatchlistIds(getWatchlist(account));

    // Listen for watchlist updates from other components
    const handleWatchUpdate = (e: any) => {
        const updatedAccount = e.detail?.account;
        // Only update if it concerns the current user or global
        if (updatedAccount && account && updatedAccount.toLowerCase() === account.toLowerCase()) {
            setWatchlistIds(getWatchlist(account));
        }
    };
    window.addEventListener('watchlist-updated', handleWatchUpdate);

    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('watchlist-updated', handleWatchUpdate);
    };
  }, [account]);

  // Handle Server-Side Search Debounce
  useEffect(() => {
     if (searchTimeout.current) clearTimeout(searchTimeout.current);

     const term = searchTerm.trim();
     
     if (term.length < 2) {
         setServerResults([]);
         setIsSearching(false);
         return;
     }

     setIsSearching(true);
     searchTimeout.current = setTimeout(async () => {
        try {
            const results = await searchGlobalAgents(term);
            setServerResults(results);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
     }, 600); 

     return () => clearTimeout(searchTimeout.current);
  }, [searchTerm]);

  const filteredAgents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    
    // Combine local agents and server results
    const combinedMap = new Map<string, Account>();
    agents.forEach(a => combinedMap.set(a.id.toLowerCase(), a));
    serverResults.forEach(a => combinedMap.set(a.id.toLowerCase(), a));
    
    let candidates = Array.from(combinedMap.values());

    // 0. WATCHLIST FILTER
    if (showWatchlistOnly) {
        candidates = candidates.filter(a => watchlistIds.some(wid => wid.toLowerCase() === a.id.toLowerCase()));
    }

    // 1. STRICT SEARCH FILTERING
    if (term) {
        candidates = candidates.filter(agent => {
            const label = (agent.label || '').toLowerCase();
            const id = agent.id.toLowerCase();
            
            if (term.startsWith('0x')) {
                return id.includes(term);
            }
            
            if (label.includes(term)) return true;
            if (term.length > 5 && id.includes(term)) return true;
            if (id === term) return true;

            return false;
        });
    }

    // 2. SORTING MATRIX
    return candidates.sort((a, b) => {
        const getAssets = (x: Account) => parseFloat(formatEther(BigInt(x.totalAssets || '0')));
        const getShares = (x: Account) => parseFloat(formatEther(BigInt(x.totalShares || '0')));
        
        // Spot Price from Graph (if available) or calculated
        const getSpotPrice = (x: Account) => {
            if (x.currentSharePrice && x.currentSharePrice !== "0") {
                return parseFloat(formatEther(BigInt(x.currentSharePrice)));
            }
            // Fallback to average price if spot unavailable
            return getShares(x) > 0 ? getAssets(x) / getShares(x) : 0;
        };

        const getMarketCap = (x: Account) => getShares(x) * getSpotPrice(x);

        const getTrust = (x: Account) => {
             const p = getSpotPrice(x);
             // Pivot around 1.0 being neutral (50)
             if (p <= 0) return 50;
             return Math.min(99, Math.max(1, 50 + (Math.log10(p) * 25)));
        };

        switch (sortOption) {
            case 'MCAP_DESC': return getMarketCap(b) - getMarketCap(a);
            case 'MCAP_ASC': return getMarketCap(a) - getMarketCap(b);
            case 'VOL_DESC': return getAssets(b) - getAssets(a);
            case 'VOL_ASC': return getAssets(a) - getAssets(b);
            case 'PRICE_DESC': return getSpotPrice(b) - getSpotPrice(a);
            case 'PRICE_ASC': return getSpotPrice(a) - getSpotPrice(b);
            case 'TRUST_DESC': return getTrust(b) - getTrust(a);
            case 'TRUST_ASC': return getTrust(a) - getTrust(b);
            default: return 0;
        }
    });
  }, [agents, searchTerm, serverResults, sortOption, showWatchlistOnly, watchlistIds]);

  const toggleSort = (option: SortOption) => {
      setSortOption(option);
      setIsSortOpen(false);
      playClick();
  };

  const toggleWatchlistFilter = () => {
      playClick();
      if (!account && !showWatchlistOnly) {
          toast.error("CONNECT WALLET TO VIEW WATCHLIST");
          return;
      }
      setShowWatchlistOnly(!showWatchlistOnly);
  };

  const getSortLabel = (opt: SortOption) => {
      switch(opt) {
          case 'MCAP_DESC': return 'M.CAP (HIGH)';
          case 'MCAP_ASC': return 'M.CAP (LOW)';
          case 'VOL_DESC': return 'VOLUME (HIGH)';
          case 'VOL_ASC': return 'VOLUME (LOW)';
          case 'PRICE_DESC': return 'PRICE (HIGH)';
          case 'PRICE_ASC': return 'PRICE (LOW)';
          case 'TRUST_DESC': return 'TRUST (HIGH)';
          case 'TRUST_ASC': return 'TRUST (LOW)';
      }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-10 pb-20">
      {/* Arcade Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-6 border-b border-intuition-primary/20 pb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3 font-display tracking-wide text-glow">
            <Activity className="text-intuition-primary animate-pulse" size={32} />
            MARKET_EXPLORER
          </h1>
          <p className="text-intuition-primary/60 mt-2 font-mono text-xs md:text-sm">
            &gt;&gt; SELECT_AGENT_TO_TRADE
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center w-full md:w-auto">
            {/* View Mode Toggle (Explicit Text) */}
            <div className="flex gap-1 border border-intuition-border p-1 bg-black clip-path-slant">
                <button 
                    onClick={() => { playClick(); setViewMode('GRID'); }}
                    className={`flex items-center gap-2 px-4 py-3 text-[10px] font-bold font-mono transition-colors ${viewMode === 'GRID' ? 'bg-intuition-primary text-black' : 'text-slate-500 hover:text-white'}`}
                >
                    <LayoutGrid size={14} /> GRID VIEW
                </button>
                <button 
                    onClick={() => { playClick(); setViewMode('HEATMAP'); }}
                    className={`flex items-center gap-2 px-4 py-3 text-[10px] font-bold font-mono transition-colors ${viewMode === 'HEATMAP' ? 'bg-intuition-primary text-black' : 'text-slate-500 hover:text-white'}`}
                >
                    <Grid size={14} /> HEATMAP
                </button>
            </div>

            {/* Watchlist Filter */}
            <button 
                onClick={toggleWatchlistFilter}
                className={`flex items-center justify-center gap-2 px-4 py-3 bg-intuition-dark border rounded-none text-xs font-mono font-bold clip-path-slant transition-all hover:bg-intuition-primary/10 ${showWatchlistOnly ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-intuition-border text-slate-500 hover:border-yellow-500/50 hover:text-yellow-500'}`}
                title="Toggle Watchlist"
            >
                <Star size={16} fill={showWatchlistOnly ? "currentColor" : "none"} />
            </button>

            {/* Search Bar */}
            <div className="relative group flex-1 w-full md:w-auto">
              <input 
                  type="text" 
                  placeholder="SEARCH NAME OR 0x..." 
                  className="w-full md:w-72 bg-intuition-dark border border-intuition-border rounded-none py-3 pl-10 pr-10 text-intuition-primary font-mono text-sm focus:outline-none focus:border-intuition-primary focus:shadow-[0_0_15px_rgba(0,243,255,0.2)] transition-all placeholder-intuition-primary/30 uppercase clip-path-slant"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={playHover}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-intuition-primary/50 group-hover:text-intuition-primary transition-colors" size={16} />
              
              {isSearching && (
                 <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 size={16} className="text-intuition-primary animate-spin" />
                 </div>
              )}
            </div>

            {/* Sort Matrix Button */}
            <div className="relative" ref={sortRef}>
                <button 
                    onClick={() => { setIsSortOpen(!isSortOpen); playClick(); }}
                    className={`flex items-center justify-between gap-2 px-4 py-3 w-full md:min-w-[180px] bg-intuition-dark border border-intuition-border text-xs font-mono font-bold text-intuition-primary clip-path-slant hover:bg-intuition-primary/10 hover:border-intuition-primary transition-all ${isSortOpen ? 'border-intuition-primary shadow-[0_0_15px_rgba(0,243,255,0.2)]' : ''}`}
                >
                    <div className="flex items-center gap-2">
                        <Filter size={14} />
                        {getSortLabel(sortOption)}
                    </div>
                    <ChevronDown size={14} className={`transition-transform duration-300 ${isSortOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSortOpen && (
                    <div className="absolute right-0 top-full mt-2 w-full md:w-64 bg-black border border-intuition-primary/50 shadow-[0_0_30px_rgba(0,243,255,0.15)] z-50 clip-path-slant p-1 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="bg-intuition-dark/90 p-2 space-y-1">
                            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest px-2 py-1 mb-1 border-b border-white/5">Sort Matrix</div>
                            
                            <button onClick={() => toggleSort('MCAP_DESC')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono hover:bg-intuition-primary/20 hover:text-white transition-colors group ${sortOption === 'MCAP_DESC' ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-400'}`}>
                                <span>M.CAP (HIGH)</span> <TrendingUp size={12} className="group-hover:scale-110" />
                            </button>
                            <button onClick={() => toggleSort('VOL_DESC')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono hover:bg-intuition-primary/20 hover:text-white transition-colors group ${sortOption === 'VOL_DESC' ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-400'}`}>
                                <span>VOLUME (HIGH)</span> <TrendingUp size={12} className="group-hover:scale-110" />
                            </button>
                            <button onClick={() => toggleSort('PRICE_DESC')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono hover:bg-intuition-primary/20 hover:text-white transition-colors group ${sortOption === 'PRICE_DESC' ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-400'}`}>
                                <span>PRICE (HIGH)</span> <Tag size={12} className="group-hover:scale-110" />
                            </button>
                            
                            <div className="h-px bg-white/10 my-1"></div>

                            <button onClick={() => toggleSort('MCAP_ASC')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono hover:bg-intuition-primary/20 hover:text-white transition-colors group ${sortOption === 'MCAP_ASC' ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-500'}`}>
                                <span>M.CAP (LOW)</span> <ArrowDown size={12} className="group-hover:scale-110" />
                            </button>
                            <button onClick={() => toggleSort('PRICE_ASC')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono hover:bg-intuition-primary/20 hover:text-white transition-colors group ${sortOption === 'PRICE_ASC' ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-500'}`}>
                                <span>PRICE (LOW)</span> <ArrowDown size={12} className="group-hover:scale-110" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Heatmap Explanation / Legend */}
      {viewMode === 'HEATMAP' && (
          <div className="mb-8 p-4 bg-black border border-intuition-border clip-path-slant animate-in fade-in slide-in-from-top-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-3">
                      <Info className="text-intuition-primary" size={18} />
                      <div className="text-xs font-mono text-slate-400">
                          <strong className="text-white uppercase">Heatmap Visualization:</strong> Tiles are colored based on Price Strength relative to 1.0 TRUST/Share.
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto bg-slate-900/50 p-2 rounded border border-slate-800">
                      <div className="text-[10px] font-mono font-bold text-rose-500 whitespace-nowrap">BELOW PEG (&lt;1.0)</div>
                      <div className="h-2 w-full md:w-48 bg-gradient-to-r from-rose-600 via-slate-600 to-emerald-500 rounded-full"></div>
                      <div className="text-[10px] font-mono font-bold text-emerald-500 whitespace-nowrap">ABOVE PEG (&gt;1.0)</div>
                  </div>
              </div>
          </div>
      )}

      {/* Market Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
           {[...Array(10)].map((_, i) => (
             <div key={i} className="h-[320px] bg-intuition-card/50 animate-pulse border border-intuition-border/50 relative overflow-hidden clip-path-slant">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-intuition-primary/5 to-transparent -translate-y-full animate-[shimmer_1.5s_infinite]"></div>
             </div>
           ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-intuition-border bg-intuition-card/30 clip-path-slant flex flex-col items-center justify-center gap-4">
            <Database size={48} className="text-intuition-border" />
            <p className="text-intuition-primary/50 text-lg font-mono">
               {showWatchlistOnly ? 'WATCHLIST_EMPTY' : isSearching ? 'SEARCHING GLOBAL MATRIX...' : 'NO_DATA_FOUND_ON_NETWORK'}
            </p>
            {showWatchlistOnly ? (
                <p className="text-xs text-slate-500 max-w-md">
                    Star agents in their profile to track them here.
                </p>
            ) : searchTerm && !isSearching && (
                <p className="text-xs text-slate-500 max-w-md">
                    We scanned the entire Intuition graph for "{searchTerm}" but found no matching Agents.
                    <br/>Try searching by exact Contract Address (0x...) or a specific Label.
                </p>
            )}
        </div>
      ) : viewMode === 'HEATMAP' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {filteredAgents.map(agent => {
                const assets = agent.totalAssets ? parseFloat(formatEther(BigInt(agent.totalAssets))) : 0;
                const shares = agent.totalShares ? parseFloat(formatEther(BigInt(agent.totalShares))) : 0;
                
                // Prioritize Spot Price
                let price = 0;
                if (agent.currentSharePrice && agent.currentSharePrice !== "0") {
                    price = parseFloat(formatEther(BigInt(agent.currentSharePrice)));
                } else {
                    price = shares > 0 ? assets / shares : 0;
                }
                
                // Recalibrated Trust Score: Pivot around 1.0 (Neutral = 50)
                let strength = 50;
                if (price > 0) {
                    strength = Math.min(99, Math.max(1, 50 + (Math.log10(price) * 25)));
                }
                
                // Color Logic
                let bgClass = 'bg-slate-800';
                if (strength > 75) bgClass = 'bg-emerald-500';
                else if (strength > 60) bgClass = 'bg-emerald-700';
                else if (strength > 50) bgClass = 'bg-slate-600'; // Neutral/Slight Trust
                else if (strength > 40) bgClass = 'bg-rose-700';
                else bgClass = 'bg-rose-600';

                // Market Cap for display in small
                const marketCap = shares * price;

                return (
                    <Link 
                        key={agent.id} 
                        to={`/markets/${agent.id}`}
                        onClick={playClick}
                        className={`aspect-square p-2 flex flex-col justify-between hover:scale-105 transition-transform duration-300 relative group overflow-hidden ${bgClass} border border-black/20`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="text-[10px] font-black font-display text-white/90 truncate leading-tight z-10 drop-shadow-md">
                            {agent.label || agent.id.slice(0,6)}
                        </div>
                        <div className="text-[8px] font-mono text-white/80 z-10 flex justify-between">
                            <span>{strength.toFixed(0)}</span>
                            <span>{marketCap > 0 ? `${marketCap.toFixed(1)}T` : '-'}</span>
                        </div>
                    </Link>
                );
            })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {filteredAgents.map((agent) => {
             const assets = agent.totalAssets ? parseFloat(formatEther(BigInt(agent.totalAssets))) : 0;
             const shares = agent.totalShares ? parseFloat(formatEther(BigInt(agent.totalShares))) : 0;
             
             // Prioritize Spot Price
             let price = 0;
             if (agent.currentSharePrice && agent.currentSharePrice !== "0") {
                 price = parseFloat(formatEther(BigInt(agent.currentSharePrice)));
             } else {
                 price = shares > 0 ? assets / shares : 0;
             }

             const marketCap = shares * price;

             // Pivot around 1.0 (Neutral = 50)
             let strength = 50;
             if (price > 0) {
                 strength = Math.min(99, Math.max(1, 50 + (Math.log10(price) * 25)));
             }

             const trustPct = strength.toFixed(0);
             const distrustPct = (100 - strength).toFixed(0);
             const isHot = assets > 100; // Keep hot based on TVL liquidity depth
             const repScore = Math.floor(strength);

             let rank = 'D';
             let rankColor = 'text-slate-500';
             let rankBorder = 'border-slate-800';
             let rankBg = 'bg-slate-900/50';
             let barColor = 'bg-slate-700';
             let shadow = '';
             
             if (repScore >= 90) {
                 rank = 'S';
                 rankColor = 'text-yellow-400';
                 rankBorder = 'border-yellow-500/50';
                 rankBg = 'bg-yellow-900/20';
                 barColor = 'bg-yellow-400';
                 shadow = 'shadow-[0_0_15px_rgba(250,204,21,0.2)]';
             } else if (repScore >= 75) {
                 rank = 'A';
                 rankColor = 'text-purple-400';
                 rankBorder = 'border-purple-500/50';
                 rankBg = 'bg-purple-900/20';
                 barColor = 'bg-purple-400';
                 shadow = 'shadow-[0_0_10px_rgba(168,85,247,0.2)]';
             } else if (repScore >= 60) {
                 rank = 'B';
                 rankColor = 'text-cyan-400';
                 rankBorder = 'border-cyan-500/50';
                 rankBg = 'bg-cyan-900/20';
                 barColor = 'bg-cyan-400';
                 shadow = 'shadow-[0_0_10px_rgba(6,182,212,0.2)]';
             } else if (repScore >= 40) {
                 rank = 'C';
                 rankColor = 'text-emerald-400';
                 rankBorder = 'border-emerald-500/50';
                 rankBg = 'bg-emerald-900/20';
                 barColor = 'bg-emerald-400';
             }

             return (
              <Link 
                key={agent.id} 
                to={`/markets/${agent.id}`}
                onClick={playClick}
                onMouseEnter={playHover}
                className="group relative flex flex-col bg-[#05080f] border border-intuition-border transition-all duration-300 overflow-hidden clip-path-slant hover-glow hover:-translate-y-2"
              >
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-intuition-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-intuition-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-intuition-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-intuition-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="h-36 bg-slate-900/50 relative p-4 border-b border-intuition-border group-hover:border-intuition-primary/30 transition-colors">
                   <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                   
                   <div className="relative z-10 flex justify-between items-start mb-3">
                      <span className="text-[10px] font-mono text-intuition-primary/60 bg-black/50 px-1 border border-intuition-primary/20 group-hover:text-intuition-primary group-hover:border-intuition-primary/50 transition-colors">ID: {agent.id.slice(0,6)}</span>
                      <div className="flex gap-2">
                          <div className={`relative flex items-stretch border ${rankBorder} ${rankBg} ${shadow} clip-path-slant pr-2 h-6`}>
                              <div className={`w-1 mr-2 ${barColor} ${rank === 'S' ? 'animate-pulse' : ''}`}></div>
                              <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">CLS</span>
                                  <span className={`text-base font-black font-display italic leading-none ${rankColor} ${rank === 'S' ? 'text-glow' : ''}`}>{rank}</span>
                              </div>
                          </div>

                          <span className={`px-2 py-0.5 text-[10px] font-bold font-mono flex items-center gap-1 border h-6 clip-path-slant ${repScore > 80 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : repScore > 50 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>
                             <ShieldCheck size={10} /> REP: {repScore}
                          </span>
                          {isHot && (
                            <span className="px-2 py-0.5 bg-intuition-warning/20 border border-intuition-warning text-intuition-warning text-[10px] font-bold font-mono flex items-center gap-1 animate-pulse h-6 clip-path-slant">
                            <Zap size={10} /> HOT
                            </span>
                          )}
                      </div>
                   </div>

                   <div className="flex items-center gap-4 relative z-10">
                      <div className="w-14 h-14 bg-black border border-intuition-primary/50 p-0.5 shadow-[0_0_10px_rgba(0,243,255,0.2)] group-hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-shadow">
                          {agent.image ? (
                             <img src={agent.image} alt={agent.label} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                          ) : (
                             <div className="w-full h-full flex items-center justify-center text-intuition-primary font-bold text-xl bg-intuition-primary/10">
                                {agent.label?.[0]?.toUpperCase() || '?'}
                             </div>
                          )}
                      </div>
                      <div className="flex-1">
                          <h3 className="text-white font-bold font-display text-lg leading-tight line-clamp-2 group-hover:text-intuition-primary transition-colors group-hover:text-glow">
                             {agent.label || 'UNKNOWN_AGENT'}
                          </h3>
                          <p className="text-[10px] text-slate-500 font-mono mt-1">TYPE: {agent.type?.toUpperCase() || 'ATOM'}</p>
                      </div>
                   </div>
                </div>

                <div className="p-4 flex-1 flex flex-col bg-gradient-to-b from-intuition-dark to-[#02040a]">
                   <div className="mb-5 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono font-bold uppercase tracking-wider">
                         <span className="text-intuition-success">TRUST {trustPct}%</span>
                         <span className="text-intuition-danger">{distrustPct}% DISTRUST</span>
                      </div>
                      <div className="w-full h-3 bg-black border border-slate-800 flex relative clip-path-slant">
                         <div className="absolute inset-0 grid grid-cols-10 pointer-events-none">
                            {[...Array(9)].map((_, i) => <div key={i} className="border-r border-black/50 h-full"></div>)}
                         </div>
                         <div style={{ width: `${trustPct}%` }} className="h-full bg-intuition-success/80 shadow-[0_0_10px_rgba(0,255,157,0.4)] transition-all duration-1000"></div>
                         <div style={{ width: `${distrustPct}%` }} className="h-full bg-intuition-danger/80 shadow-[0_0_10px_rgba(255,0,85,0.4)] transition-all duration-1000"></div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-2 mb-4 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="py-1.5 bg-intuition-success/10 border border-intuition-success/30 text-intuition-success text-xs font-bold font-mono text-center clip-path-slant">
                         TRUST
                      </div>
                      <div className="py-1.5 bg-intuition-danger/10 border border-intuition-danger/30 text-intuition-danger text-xs font-bold font-mono text-center clip-path-slant">
                         DISTRUST
                      </div>
                   </div>

                   <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500 group-hover:text-intuition-primary/70 transition-colors">
                      <div className="flex items-center gap-1 text-intuition-secondary">
                         <Activity size={10} />
                         M.CAP: {marketCap.toFixed(2)}
                      </div>
                      <div className="flex items-center gap-1">
                         <Tag size={10} />
                         SPOT: {price.toFixed(3)}
                      </div>
                   </div>
                </div>
              </Link>
             );
          })}
        </div>
      )}
    </div>
  );
};

export default Markets;