
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Search, TrendingUp, Filter, Tag, Zap, Activity, ShieldCheck, Loader2, Database, ChevronDown, Star, LayoutGrid, Grid, Hexagon, Network, Layers, ArrowRight, Shield, User, Globe, Cpu, Component, Boxes, ScanSearch, Hash, Users, BadgeCheck, UserCog } from 'lucide-react';
import { formatEther } from 'viem';
import { getAllAgents, searchGlobalAgents, getLists, getTopClaims } from '../services/graphql';
import { playHover, playClick } from '../services/audio';
import { Account } from '../types';
import { getWatchlist, getConnectedAccount } from '../services/web3';
import { toast } from '../components/Toast';
import { calculateTrustScore, calculateAgentPrice, formatMarketValue, calculateMarketCap, formatLargeNumber, isSystemVerified } from '../services/analytics';
import { CURRENCY_SYMBOL } from '../constants';
import { CurrencySymbol } from '../components/CurrencySymbol';

type SortOption = 'MCAP_DESC' | 'MCAP_ASC' | 'VOL_DESC' | 'VOL_ASC' | 'PRICE_DESC' | 'PRICE_ASC' | 'TRUST_DESC' | 'TRUST_ASC';
type ViewMode = 'GRID' | 'HEATMAP';
type MarketSegment = 'NODES' | 'SYNAPSES' | 'VECTORS';

const Markets: React.FC = () => {
  const navigate = useNavigate();
  const { address: wagmiAddress } = useAccount();
  const [agents, setAgents] = useState<Account[]>([]);
  const [lists, setLists] = useState<any[]>([]); 
  const [claims, setClaims] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [serverResults, setServerResults] = useState<Account[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('GRID');
  const [activeSegment, setActiveSegment] = useState<MarketSegment>('NODES');
  const [account, setAccount] = useState<string | null>(null);
  
  const [sortOption, setSortOption] = useState<SortOption>('MCAP_DESC');
  const [isSortOpen, setIsSortOpen] = useState(false);
  
  // Pagination State
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 40;

  const sortRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
        setDebouncedTerm(searchTerm);
    }, 400); 
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setOffset(0);
    setHasMore(true);
    try {
        if (activeSegment === 'NODES') {
            const res = await getAllAgents(PAGE_SIZE, 0);
            setAgents(res.items);
            setHasMore(res.hasMore);
        } else if (activeSegment === 'SYNAPSES') {
            const res = await getTopClaims(PAGE_SIZE, 0);
            setClaims(res.items);
            setHasMore(res.hasMore);
        } else if (activeSegment === 'VECTORS') {
            const res = await getLists(PAGE_SIZE, 0);
            setLists(res.items);
            setHasMore(res.hasMore);
        }
    } catch (error) {
        console.warn("[INTERNAL_LOG] INITIAL_FETCH_ERROR", error);
    } finally {
        setLoading(false);
    }
  }, [activeSegment]);

  const fetchMoreData = useCallback(async () => {
      if (loadingMore || !hasMore || loading || debouncedTerm.trim().length > 0) return;
      setLoadingMore(true);
      const nextOffset = offset + PAGE_SIZE;
      try {
          let res: { items: any[], hasMore: boolean } = { items: [], hasMore: false };
          if (activeSegment === 'NODES') {
              res = await getAllAgents(PAGE_SIZE, nextOffset);
              setAgents(prev => [...prev, ...res.items]);
          } else if (activeSegment === 'SYNAPSES') {
              res = await getTopClaims(PAGE_SIZE, nextOffset);
              setClaims(prev => [...prev, ...res.items]);
          } else if (activeSegment === 'VECTORS') {
              res = await getLists(PAGE_SIZE, nextOffset);
              setLists(prev => [...prev, ...res.items]);
          }
          
          setHasMore(res.hasMore);
          setOffset(nextOffset);
      } catch (error) {
          console.warn("[INTERNAL_LOG] FETCH_MORE_ERROR", error);
      } finally {
          setLoadingMore(false);
      }
  }, [activeSegment, offset, hasMore, loading, loadingMore, debouncedTerm]);

  useEffect(() => {
      fetchInitialData();
  }, [fetchInitialData, sortOption]);

  // Sync account from wagmi so watchlist/UI react when user connects
  useEffect(() => {
    setAccount(wagmiAddress ?? null);
  }, [wagmiAddress]);

  useEffect(() => {
    if (account) setWatchlistIds(getWatchlist(account));

    const handleWatchUpdate = (e: any) => {
        const updatedAccount = e.detail?.account;
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

  useEffect(() => {
     const term = debouncedTerm.trim();
     if (term.length < 2) {
         setServerResults([]);
         setIsSearching(false);
         return;
     }
     setIsSearching(true);
     searchGlobalAgents(term)
        .then(setServerResults)
        .catch(() => setServerResults([]))
        .finally(() => setIsSearching(false));
  }, [debouncedTerm]);

  // Infinite Scroll Observer
  useEffect(() => {
      const observer = new IntersectionObserver(
          entries => {
              if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && debouncedTerm.trim().length === 0) {
                  fetchMoreData();
              }
          },
          { threshold: 0.1 }
      );

      if (observerTarget.current) {
          observer.observe(observerTarget.current);
      }

      return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, fetchMoreData, debouncedTerm]);

  const filteredItems = useMemo(() => {
    const term = debouncedTerm.trim().toLowerCase();
    let candidates: any[] = [];

    if (activeSegment === 'VECTORS') candidates = lists;
    else if (activeSegment === 'SYNAPSES') candidates = claims;
    else {
        const combinedMap = new Map<string, Account>();
        agents.forEach(a => combinedMap.set(a.id.toLowerCase(), a));
        serverResults.forEach(a => combinedMap.set(a.id.toLowerCase(), a));
        candidates = Array.from(combinedMap.values()).filter(a => a.type !== 'CLAIM' && a.type !== 'LIST');
    }

    if (activeSegment === 'NODES') {
        if (showWatchlistOnly) {
            candidates = candidates.filter(a => watchlistIds.some(wid => wid.toLowerCase() === a.id.toLowerCase()));
        }
        if (term) {
            candidates = candidates.filter(agent => {
                const label = (agent.label || '').toLowerCase();
                const id = agent.id.toLowerCase();
                return label.includes(term) || id.includes(term);
            });
        }
        // Client-side sort remains for the loaded buffer
        return candidates.sort((a, b) => {
            const getPrice = (x: Account) => calculateAgentPrice(x.totalAssets || '0', x.totalShares || '0', x.currentSharePrice);
            const getTrust = (x: Account) => calculateTrustScore(x.totalAssets || '0', x.totalShares || '0', x.currentSharePrice);
            const getMarketCapVal = (x: Account) => calculateMarketCap(x.marketCap || x.totalAssets || '0', x.totalShares || '0', x.currentSharePrice);

            switch (sortOption) {
                case 'MCAP_DESC': return getMarketCapVal(b) - getMarketCapVal(a);
                case 'MCAP_ASC': return getMarketCapVal(a) - getMarketCapVal(b);
                case 'VOL_DESC': return parseFloat(formatEther(BigInt(b.totalAssets || '0'))) - parseFloat(formatEther(BigInt(a.totalAssets || '0')));
                case 'VOL_ASC': return parseFloat(formatEther(BigInt(a.totalAssets || '0'))) - parseFloat(formatEther(BigInt(b.totalAssets || '0')));
                case 'PRICE_DESC': return getPrice(b) - getPrice(a);
                case 'PRICE_ASC': return getPrice(a) - getPrice(b);
                case 'TRUST_DESC': return getTrust(b) - getTrust(a);
                case 'TRUST_ASC': return getTrust(a) - getTrust(b);
                default: return 0;
            }
        });
    }

    if (term) {
        candidates = candidates.filter(item => {
            if (activeSegment === 'VECTORS') return (item.label || '').toLowerCase().includes(term);
            if (activeSegment === 'SYNAPSES') return (item.subject?.label || '').toLowerCase().includes(term) || (item.object?.label || '').toLowerCase().includes(term);
            return false;
        });
    }
    return candidates;
  }, [agents, lists, claims, debouncedTerm, serverResults, sortOption, showWatchlistOnly, watchlistIds, activeSegment]);

  const toggleSort = (option: SortOption) => { setSortOption(option); setIsSortOpen(false); playClick(); };
  
  const toggleWatchlistFilter = () => {
      playClick();
      if (!account) { toast.error("WALLET_CONNECTION_REQUIRED"); return; }
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
    <div className="w-full min-w-0 overflow-x-hidden px-4 sm:px-6 lg:px-8 pt-12 pb-32">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8 border-b border-white/5 pb-10 relative z-10">
        <div className="relative z-10 space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-intuition-primary/80 mobile-break">
            <span className="text-[11px] font-black font-mono tracking-widest uppercase">
              {">_"} SECTOR_ANALYSIS_SYSTEM_V1.5.0_ARES
            </span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-[5rem] font-black text-white font-display tracking-tighter uppercase text-glow-blue leading-tight py-2 mobile-break min-w-0">
            MARKET_CORE
          </h1>
          <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 border border-intuition-primary/30 bg-intuition-primary/5 clip-path-slant group">
                  <Globe size={12} className="text-intuition-primary group-hover:animate-spin-slow" />
                  <span className="text-[10px] font-black font-mono text-intuition-primary uppercase tracking-widest">
                    GLB_CONVERGENCE: <span className="text-white">209</span>
                  </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 border border-intuition-secondary/30 bg-intuition-secondary/5 clip-path-slant group">
                  <Activity size={12} className="text-intuition-secondary animate-pulse" />
                  <span className="text-[10px] font-black font-mono text-intuition-secondary uppercase tracking-widest">
                    NET_THROUGHPUT: <span className="text-white">STABLE</span>
                  </span>
              </div>
          </div>
        </div>
        
        <div className="flex bg-black border-2 border-slate-900 p-1 clip-path-slant relative z-10 h-fit self-center">
            {(['NODES', 'SYNAPSES', 'VECTORS'] as MarketSegment[]).map((seg) => {
                const isActive = activeSegment === seg;
                return (
                    <button 
                        key={seg}
                        onClick={() => { setActiveSegment(seg); playClick(); }}
                        onMouseEnter={playHover}
                        className={`px-8 py-3 flex items-center gap-3 font-mono text-[11px] font-black uppercase transition-all clip-path-slant ${isActive ? 'text-black bg-intuition-primary shadow-[0_0_25px_rgba(0,243,255,0.4)]' : 'text-slate-500 hover:text-white'}`}
                    >
                        {seg === 'NODES' ? <Hexagon size={16} /> : seg === 'SYNAPSES' ? <Network size={16} /> : <Layers size={16} />} 
                        {seg}
                    </button>
                );
            })}
        </div>
      </div>

      <div className={`flex flex-col lg:flex-row gap-6 items-stretch lg:items-center w-full mb-10 relative ${isSortOpen ? 'z-[60]' : 'z-40'}`}>
            {activeSegment === 'NODES' && (
                <div className="flex gap-1 border-2 border-slate-900 p-1 bg-black clip-path-slant">
                    <button 
                        onClick={() => { playClick(); setViewMode('GRID'); }}
                        className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black font-mono transition-all ${viewMode === 'GRID' ? 'bg-intuition-primary text-white shadow-lg' : 'text-slate-600 hover:text-white'}`}
                    >
                        <LayoutGrid size={14} /> GRID
                    </button>
                    <button 
                        onClick={() => { playClick(); setViewMode('HEATMAP'); }}
                        className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black font-mono transition-all ${viewMode === 'HEATMAP' ? 'bg-intuition-primary text-white shadow-lg' : 'text-slate-600 hover:text-white'}`}
                    >
                        <Grid size={14} /> HEATMAP
                    </button>
                </div>
            )}

            {activeSegment === 'NODES' && (
                <div className="p-[2px] bg-slate-900 clip-path-slant">
                  <button 
                      onClick={toggleWatchlistFilter}
                      className={`flex items-center justify-center gap-2 px-6 py-3 bg-black rounded-none text-[10px] font-black font-mono clip-path-slant transition-all ${showWatchlistOnly ? 'text-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'text-slate-600 hover:text-white'}`}
                  >
                      <Star size={16} fill={showWatchlistOnly ? "currentColor" : "none"} />
                  </button>
                </div>
            )}

            <div className="relative group flex-1 p-[2px] bg-slate-900 clip-path-slant focus-within:bg-intuition-primary/50 transition-colors">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-intuition-primary z-10">
                  <Search size={18} className="group-focus-within:animate-pulse" />
              </div>
              <input 
                  type="text" 
                  placeholder={`QUERY_GLOBAL_DATABASE_${activeSegment}...`} 
                  className="w-full bg-black rounded-none py-4 pl-12 pr-12 text-white font-mono text-xs focus:outline-none transition-all placeholder-slate-800 uppercase tracking-widest clip-path-slant"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={playHover}
              />
              {isSearching && <div className="absolute right-5 top-1/2 -translate-y-1/2"><Loader2 size={18} className="text-intuition-primary animate-spin" /></div>}
            </div>

            {activeSegment === 'NODES' && (
                <div className="relative" ref={sortRef}>
                    <div className={`p-[2px] clip-path-slant transition-colors ${isSortOpen ? 'bg-intuition-primary' : 'bg-slate-900 hover:bg-intuition-primary/50'}`}>
                        <button 
                            onClick={() => { setIsSortOpen(!isSortOpen); playClick(); }}
                            className={`flex items-center justify-between gap-4 sm:gap-6 min-h-[44px] px-4 sm:px-6 py-3 sm:py-4 min-w-[160px] sm:min-w-[220px] bg-black text-[9px] sm:text-[10px] font-black font-mono text-intuition-primary clip-path-slant transition-all`}
                        >
                            <div className="flex items-center gap-3"><Filter size={14} />{getSortLabel(sortOption)}</div>
                            <ChevronDown size={14} className={`transition-transform duration-300 ${isSortOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                    {isSortOpen && (
                        <div className="absolute right-0 top-full mt-2 w-full bg-intuition-primary p-[1px] shadow-[0_0_50px_rgba(0,0,0,1)] z-[100] clip-path-slant">
                            <div className="bg-[#0a0a0a] p-1 clip-path-slant">
                                {[
                                    { opt: 'MCAP_DESC', label: 'M.CAP (HIGH)', icon: TrendingUp },
                                    { opt: 'VOL_DESC', label: 'VOLUME (HIGH)', icon: Activity },
                                    { opt: 'PRICE_DESC', label: 'PRICE (HIGH)', icon: Tag },
                                    { opt: 'TRUST_DESC', label: 'TRUST (HIGH)', icon: ShieldCheck }
                                ].map((item) => (
                                    <button 
                                        key={item.opt}
                                        onClick={() => toggleSort(item.opt as any)} 
                                        className={`w-full min-h-[44px] flex items-center justify-between px-4 py-3 text-[9px] font-black font-mono hover:bg-intuition-primary hover:text-black transition-all uppercase tracking-widest ${sortOption === item.opt ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-500'}`}
                                    >
                                        <span>{item.label}</span> <item.icon size={12} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
      </div>

      {loading && offset === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
           {[...Array(8)].map((_, i) => (
             <div key={i} className="h-[320px] bg-black border-2 border-white/5 animate-pulse relative overflow-hidden clip-path-slant">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
             </div>
           ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-32 border-2 border-dashed border-slate-900 bg-black/40 clip-path-slant flex flex-col items-center justify-center gap-6">
            <Shield size={64} className="text-slate-900" />
            <p className="text-slate-700 text-lg font-black font-mono uppercase tracking-[0.4em]">{showWatchlistOnly ? 'SECTOR_WATCHLIST_EMPTY' : 'NULL_DATA_RECOVERED'}</p>
        </div>
      ) : activeSegment === 'VECTORS' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5 relative z-10">
              {filteredItems.map((list) => (
                  <Link 
                    key={list.id} 
                    to={`/markets/${list.id}`} 
                    className="group relative flex flex-col p-6 bg-slate-950/80 backdrop-blur-xl border border-slate-800 hover:border-intuition-primary transition-all shadow-[0_0_60px_rgba(0,0,0,1)] overflow-hidden min-h-[350px]"
                    style={{ 
                        clipPath: 'polygon(50% 0%, 100% 15%, 100% 85%, 50% 100%, 0% 85%, 0% 15%)' 
                    }}
                    onClick={playClick}
                    onMouseEnter={playHover}
                  >
                      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,243,255,0.05)_1px,transparent_1px)] bg-[size:16px:16px] opacity-10 pointer-events-none"></div>
                      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-intuition-primary/30 to-transparent"></div>
                      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-intuition-primary/30 to-transparent"></div>

                      <div className="absolute top-[12%] right-[10%] text-right z-20">
                          <div className="text-[6px] font-black font-mono text-intuition-primary animate-pulse uppercase tracking-[0.1em]">04-ARES</div>
                      </div>
                      
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-intuition-primary/5 to-transparent -translate-y-full group-hover:animate-[scanline_4s_linear_infinite] pointer-events-none"></div>

                      <div className="flex flex-col items-center justify-center flex-1 relative z-10 mb-6 mt-4">
                          <div className="relative mb-6 group-hover:scale-105 transition-transform duration-700">
                              <div className="absolute inset-0 bg-intuition-primary blur-[25px] opacity-5 group-hover:opacity-20 transition-all duration-1000 rounded-full scale-125"></div>
                              <div className="absolute -inset-8 border border-dashed border-intuition-primary/15 rounded-full animate-spin-slow group-hover:border-intuition-primary/30 transition-all"></div>
                              <div className="absolute -inset-4 border border-white/5 rounded-full opacity-30 group-hover:scale-110 transition-all"></div>
                              
                              <div className="w-22 h-22 bg-black border border-slate-700 flex items-center justify-center text-slate-500 group-hover:text-intuition-primary group-hover:border-intuition-primary transition-all shadow-[0_0_30px_rgba(0,243,255,0.8)] overflow-hidden relative" 
                                   style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>
                                  
                                  <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,243,255,0.05)_50%)] bg-[length:100%_4px] group-hover:bg-[length:100%_2px] transition-all pointer-events-none"></div>

                                  {list.image ? (
                                      <img src={list.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt="" />
                                  ) : (
                                      <Component size={28} className="group-hover:animate-spin-slow opacity-60 group-hover:opacity-100" />
                                  )}
                                  
                                  <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors"></div>
                                  <div className="absolute inset-0 bg-gradient-to-t from-intuition-primary/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                              </div>
                          </div>

                          <div className="px-3 text-center">
                              <div className="text-[7px] font-black font-mono text-slate-600 uppercase tracking-[0.4em] mb-2 group-hover:text-white transition-colors flex items-center justify-center gap-1.5">
                                  <div className="w-1 h-1 bg-intuition-primary rounded-full animate-ping"></div>
                                  SEC_AGGREGATE
                              </div>
                              <h3 className="text-lg md:text-xl font-black font-display text-white group-hover:text-glow-blue transition-all uppercase tracking-tighter leading-tight mb-4 drop-shadow-md">{list.label || 'UNTITLED_LIST'}
                              </h3>
                              
                              <div className="inline-flex items-center justify-center gap-2 py-1 px-3 bg-white/5 border border-white/5 clip-path-slant group-hover:border-intuition-primary/20 transition-all">
                                  <Database size={10} className="text-intuition-primary" /> 
                                  <span className="text-[7px] font-black font-mono text-slate-500 uppercase tracking-[0.1em] group-hover:text-white transition-colors">
                                    {list.totalItems || 0}_CONSTITUENTS
                                  </span>
                              </div>
                          </div>
                      </div>

                      <div className="flex items-center justify-center -space-x-3 mt-auto relative z-10 group-hover:translate-y-[-4px] transition-transform duration-700 mb-2 pb-4">
                          {(list.items || []).slice(0, 5).map((item: any, i: number) => (
                              <div key={i} className="w-8 h-8 border border-black bg-slate-900 flex items-center justify-center overflow-hidden shadow-xl hover:z-30 transition-all hover:-translate-y-2 hover:border-intuition-primary"
                                   style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>
                                  {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <div className="text-[6px] font-black text-slate-700">{item.label?.[0]}</div>}
                              </div>
                          ))}
                          {(list.totalItems > 5) && (
                              <div className="w-8 h-8 border border-black bg-intuition-primary text-black flex items-center justify-center text-[6px] font-black shadow-xl hover:z-30 transition-all hover:-translate-y-2"
                                   style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>
                                  +{list.totalItems - 5}
                              </div>
                          )}
                      </div>

                      <div className="absolute bottom-[12%] right-[10%] opacity-20 group-hover:text-intuition-primary group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                        <ArrowRight size={16} className="drop-shadow-[0_0_8px_currentColor]" />
                      </div>
                  </Link>
              ))}
          </div>
      ) : activeSegment === 'SYNAPSES' ? (
          <div className="bg-black border-2 border-slate-900 clip-path-slant overflow-hidden relative z-10 animate-in fade-in duration-500 shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono border-collapse min-w-[1000px]">
                    <thead className="bg-[#080808] text-slate-700 text-[10px] font-black uppercase tracking-[0.3em] border-b-2 border-slate-900">
                        <tr>
                            <th className="px-8 py-6">CLAIM_IDENTITY</th>
                            <th className="px-8 py-6">SUPPORT</th>
                            <th className="px-8 py-6">OPPOSE</th>
                            <th className="px-8 py-6 text-right">HANDSHAKE</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredItems.map((claim) => (
                            <tr 
                              key={claim.id} 
                              onClick={() => { playClick(); navigate(`/markets/${claim.id}`); }}
                              className="hover:bg-white/5 transition-all group relative cursor-pointer active:scale-[0.995] duration-200"
                            >
                                <td className="px-8 py-8">
                                    <div className="flex flex-col md:flex-row items-center gap-3">
                                        <div className="flex items-center gap-3 bg-white/5 pr-4 border border-white/5 clip-path-slant">
                                            <div className="w-10 h-10 bg-slate-950 flex items-center justify-center overflow-hidden border-r border-white/5">
                                                {claim.subject.image ? <img src={claim.subject.image} className="w-full h-full object-cover" /> : <User size={16} className="text-slate-700" />}
                                            </div>
                                            <span className="font-black text-white text-[11px] uppercase truncate max-w-[120px]">{claim.subject.label}</span>
                                        </div>
                                        
                                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest px-2">{claim.predicate}</span>
                                        
                                        <div className="flex items-center gap-3 bg-white/5 pr-4 border border-white/5 clip-path-slant">
                                            <div className="w-10 h-10 bg-slate-950 flex items-center justify-center overflow-hidden border-r border-white/5">
                                                {claim.object.image ? <img src={claim.object.image} className="w-full h-full object-cover" /> : <div className="text-[10px] font-black text-slate-700">{claim.object.label?.[0]}</div>}
                                            </div>
                                            <span className="font-black text-white text-[11px] uppercase truncate max-w-[120px]">{claim.object.label}</span>
                                        </div>
                                    </div>
                                </td>
                                
                                <td className="px-8 py-8">
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <Users size={14} className="text-intuition-primary opacity-50" />
                                            <span className="text-sm font-black text-intuition-primary">{formatLargeNumber(claim.holders)}</span>
                                        </div>
                                        <div className="text-lg font-black text-white inline-flex items-baseline gap-1">{formatMarketValue(claim.value)} <CurrencySymbol size="md" className="text-slate-600" /></div>
                                    </div>
                                </td>
                                
                                <td className="px-8 py-8">
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <Users size={14} className="text-intuition-danger opacity-50" />
                                            <span className="text-sm font-black text-intuition-danger">{formatLargeNumber(claim.opposeHolders || 0)}</span>
                                        </div>
                                        <div className="text-lg font-black text-white inline-flex items-baseline gap-1">{formatMarketValue(claim.opposeValue || 0)} <CurrencySymbol size="md" className="text-slate-600" /></div>
                                    </div>
                                </td>

                                <td className="px-8 py-8 text-right">
                                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                        <Link to={`/markets/${claim.id}`} onClick={playClick} className="px-6 py-2.5 bg-intuition-primary text-black font-black text-[10px] uppercase clip-path-slant hover:bg-white transition-all shadow-glow-blue">
                                            SUPPORT
                                        </Link>
                                        <Link to={`/markets/${claim.id}`} onClick={playClick} className="px-6 py-2.5 bg-intuition-danger text-white font-black text-[10px] uppercase clip-path-slant hover:bg-white hover:text-black transition-all shadow-glow-red">
                                            OPPOSE
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </div>
      ) : viewMode === 'HEATMAP' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 relative z-10">
            {filteredItems.map(agent => {
                const strength = calculateTrustScore(agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice);
                const mktVal = calculateMarketCap(agent.marketCap || agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice);
                let bgClass = 'bg-slate-900';
                if (strength > 75) bgClass = 'bg-emerald-600';
                else if (strength > 60) bgClass = 'bg-emerald-800';
                else if (strength > 45) bgClass = 'bg-slate-800';
                else if (strength > 40) bgClass = 'bg-rose-900';
                else bgClass = 'bg-rose-700';

                return (
                    <Link 
                        key={agent.id} 
                        to={`/markets/${agent.id}`}
                        onClick={playClick}
                        className={`aspect-square p-4 flex flex-col justify-between hover:scale-105 transition-all duration-300 relative group overflow-hidden border-2 border-black/40 ${bgClass} shadow-2xl clip-path-slant hover:z-20`}
                    >
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="text-[10px] font-black font-display text-white truncate z-10 uppercase tracking-tighter drop-shadow-md">{agent.label}</div>
                        <div className="text-[8px] font-black font-mono text-white/80 z-10 flex justify-between uppercase">
                            <span>{strength.toFixed(0)}%</span>
                            <span>{mktVal > 0 ? `${formatMarketValue(mktVal)}T` : '-'}</span>
                        </div>
                    </Link>
                );
            })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 relative z-10">
          {filteredItems.map((agent) => {
             const price = calculateAgentPrice(agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice);
             const mktCap = calculateMarketCap(agent.marketCap || agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice);
             const strength = calculateTrustScore(agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice);
             const verified = isSystemVerified(agent);
             
             let dynamicLabel = 'CREDIBLE';
             let dynamicLetter = 'C';

             if (strength >= 90) {
                 dynamicLetter = 'S';
                 dynamicLabel = 'SOVEREIGN';
             } else if (strength >= 75) {
                 dynamicLetter = 'A';
                 dynamicLabel = 'AUTHENTIC';
             } else if (strength >= 60) {
                 dynamicLetter = 'B';
                 dynamicLabel = 'RELIABLE';
             } else if (strength >= 45) {
                 dynamicLetter = 'C';
                 dynamicLabel = 'CREDIBLE';
             } else {
                 dynamicLetter = 'D';
                 dynamicLabel = 'EMERGING';
             }
             
             let tierStyle = { label: dynamicLetter, name: dynamicLabel, color: 'text-slate-600', border: 'border-slate-900', glow: 'from-slate-900/40 via-black to-black', bar: 'bg-slate-700' };

             if (dynamicLetter === 'S') tierStyle = { ...tierStyle, color: 'text-intuition-warning', border: 'border-intuition-warning/40', glow: 'from-intuition-warning/20 via-black to-black', bar: 'bg-intuition-warning' };
             else if (dynamicLetter === 'A') tierStyle = { ...tierStyle, color: 'text-intuition-primary', border: 'border-intuition-primary/40', glow: 'from-intuition-primary/20 via-black to-black', bar: 'bg-intuition-primary' };
             else if (dynamicLetter === 'B') tierStyle = { ...tierStyle, color: 'text-[#a855f7]', border: 'border-[#a855f7]/40', glow: 'from-[#a855f7]/10 via-black to-black', bar: 'bg-[#a855f7]' };
             else if (dynamicLetter === 'C') tierStyle = { ...tierStyle, color: 'text-intuition-success', border: 'border-intuition-success/40', glow: 'from-intuition-success/10 via-black to-black', bar: 'bg-intuition-success' };
             else if (dynamicLetter === 'D') tierStyle = { ...tierStyle, color: 'text-slate-500', border: 'border-slate-800/40', glow: 'from-slate-800/10 via-black to-black', bar: 'bg-slate-800' };

             return (
              <Link 
                key={agent.id} 
                to={`/markets/${agent.id}`}
                onClick={playClick}
                onMouseEnter={playHover}
                className={`group relative flex flex-col bg-black border-2 ${tierStyle.border} transition-all duration-300 overflow-hidden clip-path-slant hover:-translate-y-2 hover:border-white/50 shadow-2xl hover:shadow-[0_0_40px_rgba(0,243,255,0.1)]`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${tierStyle.glow} pointer-events-none`}></div>
                
                {/* BRANDING CONTAINER - Top Left purely for Curve info */}
                <div className="absolute top-0 left-0 p-3 z-20 flex flex-col items-start gap-2">
                    <div className="px-2 py-0.5 bg-black border border-white/5 text-[6px] font-black font-mono text-slate-500 uppercase tracking-widest clip-path-slant group-hover:border-intuition-primary/40 transition-colors">Progressive_Curve</div>
                    {!verified && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-700 text-slate-500 text-[7px] font-black uppercase tracking-widest">
                            <UserCog size={10} /> USER_NODE
                        </div>
                    )}
                </div>
                
                <div className="absolute bottom-0 right-0 p-2 opacity-5 text-white pointer-events-none font-display font-black text-6xl group-hover:scale-150 transition-transform duration-1000">{tierStyle.label}</div>
                
                <div className="relative p-6 z-10 flex flex-col h-full">
                   <div className="flex justify-between items-start mb-6">
                      <div className={`relative w-20 h-20 shrink-0 border-2 ${tierStyle.border} bg-black flex items-center justify-center overflow-hidden clip-path-slant shadow-2xl group-hover:border-white transition-all`}>
                          {agent.image ? (
                             <img src={agent.image} alt={agent.label} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" />
                          ) : (
                             <div className={`text-4xl font-black ${tierStyle.color}`}>{agent.label?.[0]?.toUpperCase()}</div>
                          )}
                      </div>
                      <div className="text-right flex flex-col items-end">
                          <div className={`text-4xl font-black font-display italic ${tierStyle.color} text-glow drop-shadow-2xl relative`}>
                              {tierStyle.label}
                          </div>
                          {/* VERIFICATION BADGE - Positioned big and bold under the class letter */}
                          <div className="flex flex-col items-end gap-1 mt-2">
                              {verified && (
                                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                                    <BadgeCheck size={22} className="text-intuition-primary shadow-glow-blue" strokeWidth={3} />
                                    <span className="text-[6px] font-black text-intuition-primary uppercase tracking-widest mt-0.5">VERIFIED</span>
                                </div>
                              )}
                              <div className="text-[8px] font-black font-mono text-slate-600 uppercase tracking-widest mt-1">Protocol_Tier</div>
                          </div>
                      </div>
                   </div>

                   <div className="mb-6 min-h-[60px]">
                       <div className="flex items-center gap-3 mb-1.5">
                           <h3 className="text-white font-black font-display text-xl leading-none truncate uppercase tracking-tight group-hover:text-intuition-primary transition-colors">
                               {agent.label || 'UNKNOWN_NODE'}
                           </h3>
                           {tierStyle.label === 'S' && <div className="w-2 h-2 rounded-full bg-intuition-warning animate-pulse shadow-[0_0_10px_#facc15]"></div>}
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-black font-mono text-slate-600 uppercase tracking-widest">
                           <span className="flex items-center gap-1"><Shield size={10} className="text-intuition-primary" /> {tierStyle.name}</span>
                           <span>ID: {agent.id.slice(0,8)}</span>
                       </div>
                   </div>

                   <div className="mt-auto grid grid-cols-2 gap-px bg-slate-900 border border-slate-900 overflow-hidden mb-6">
                       <div className="bg-black p-3 flex flex-col justify-center border-r border-slate-900 group-hover:bg-slate-950 transition-colors">
                           <span className="text-[8px] text-slate-600 font-black uppercase tracking-wider mb-1">TOTAL MKT CAP</span>
                           <span className={`text-xs font-black font-mono text-white`}>{mktCap > 0 ? formatMarketValue(mktCap) : '0.00K'}</span>
                       </div>
                       <div className="bg-black p-3 flex flex-col justify-center text-right group-hover:bg-slate-950 transition-colors">
                           <span className="text-[8px] text-slate-600 font-black uppercase tracking-wider mb-1">PRICE / UNIT</span>
                           <span className="text-xs font-black font-mono text-white">{formatMarketValue(price)}</span>
                       </div>
                   </div>

                   <div className="pt-4 border-t border-white/5 relative overflow-hidden">
                       <div className="flex justify-between items-end text-[9px] font-black font-mono uppercase mb-2">
                           <span className={tierStyle.color}>TRUST {strength.toFixed(0)}%</span>
                           <span className="text-slate-700">DISTRUST {(100-strength).toFixed(0)}%</span>
                       </div>
                       <div className="h-2 w-full bg-slate-950 border border-white/5 p-[1px] relative">
                           <div style={{ width: `${strength}%` }} className={`h-full ${tierStyle.bar} transition-all duration-1000 shadow-[0_0_10px_currentColor] relative`}>
                                <div className="absolute top-0 right-0 bottom-0 w-1 bg-white/40 blur-[1px]"></div>
                           </div>
                       </div>
                   </div>
                </div>
              </Link>
             );
          })}
        </div>
      )}

      {/* INFINITE SCROLL SENTINEL */}
      <div ref={observerTarget} className="h-48 flex items-center justify-center mt-12 w-full">
          {loadingMore && (
              <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                  <div className="relative">
                      <div className="w-12 h-12 border-2 border-intuition-primary/20 border-t-intuition-primary rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                          <Activity size={16} className="text-intuition-primary animate-pulse" />
                      </div>
                  </div>
                  <span className="text-[8px] font-black font-mono text-intuition-primary/60 uppercase tracking-[0.6em]">NEURAL_BUFFERING_SECTOR_04...</span>
              </div>
          )}
          {!hasMore && !loading && (
              <div className="text-[8px] font-black font-mono text-slate-800 uppercase tracking-[1em] border-t border-slate-900 pt-8 w-full text-center">
                  END_OF_GLOBAL_DATABASE_REACHED
              </div>
          )}
      </div>
    </div>
  );
};

export default Markets;
