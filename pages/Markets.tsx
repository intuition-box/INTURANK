
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, TrendingUp, Filter, Tag, Zap, Activity, ShieldCheck, Loader2, Database, ChevronDown, ArrowDown, Star, LayoutGrid, Grid, Info, Hexagon, Network, Layers, ArrowRight, Shield, Share2, User, ChevronsRight } from 'lucide-react';
import { formatEther } from 'viem';
import { getAllAgents, searchGlobalAgents, getLists, getTopClaims } from '../services/graphql';
import { playHover, playClick } from '../services/audio';
import { Account, Claim } from '../types';
import { getWatchlist, getConnectedAccount } from '../services/web3';
import { toast } from '../components/Toast';

type SortOption = 'MCAP_DESC' | 'MCAP_ASC' | 'VOL_DESC' | 'VOL_ASC' | 'PRICE_DESC' | 'PRICE_ASC' | 'TRUST_DESC' | 'TRUST_ASC';
type ViewMode = 'GRID' | 'HEATMAP';
type MarketSegment = 'NODES' | 'SYNAPSES' | 'VECTORS';

const Markets: React.FC = () => {
  const [agents, setAgents] = useState<Account[]>([]);
  const [lists, setLists] = useState<any[]>([]); 
  const [claims, setClaims] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
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
  const sortRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);

  // --- Search Debouncing Logic ---
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
        setDebouncedTerm(searchTerm);
    }, 400); 
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getAllAgents();
        setAgents(data);
      } catch (error) {
        console.warn("[INTERNAL_LOG] AGENT_FETCH_ERROR", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    
    getConnectedAccount().then(setAccount);

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
      const fetchSegmentData = async () => {
          if (activeSegment === 'VECTORS' && lists.length === 0) {
              setLoading(true);
              try {
                  const listData = await getLists();
                  setLists(listData);
              } catch (e) { console.warn(e); } finally { setLoading(false); }
          }
          if (activeSegment === 'SYNAPSES' && claims.length === 0) {
              setLoading(true);
              try {
                  const claimData = await getTopClaims();
                  const formatted = claimData.map((c: any) => ({
                      id: c.id,
                      subject: c.subject,
                      predicate: c.predicate,
                      object: c.object,
                      value: c.value
                  }));
                  setClaims(formatted);
              } catch (e) { console.warn(e); } finally { setLoading(false); }
          }
      };
      fetchSegmentData();
  }, [activeSegment]);

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
        return candidates.sort((a, b) => {
            const getAssets = (x: Account) => parseFloat(formatEther(BigInt(x.totalAssets || '0')));
            const getShares = (x: Account) => parseFloat(formatEther(BigInt(x.totalShares || '0')));
            const getSpotPrice = (x: Account) => {
                if (x.currentSharePrice && x.currentSharePrice !== "0") return parseFloat(formatEther(BigInt(x.currentSharePrice)));
                return getShares(x) > 0 ? getAssets(x) / getShares(x) : 0;
            };
            const getMarketCap = (x: Account) => getShares(x) * getSpotPrice(x);
            const getTrust = (x: Account) => {
                 const p = getSpotPrice(x);
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
      if (!account && !showWatchlistOnly) { toast.error("WALLET_CONNECTION_REQUIRED"); return; }
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
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-12 gap-6 border-b border-intuition-primary/20 pb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3 font-display tracking-wide text-glow">
            <Activity className="text-intuition-primary animate-pulse" size={32} />
            MARKET_EXPLORER
          </h1>
          <p className="text-intuition-primary/60 mt-2 font-mono text-xs md:text-sm">
            &gt;&gt; SELECT_DATA_SEGMENT
          </p>
        </div>
        
        <div className="flex bg-black border border-intuition-primary/30 p-1 clip-path-slant relative overflow-hidden">
            <div className={`absolute top-0 bottom-0 bg-intuition-primary/10 transition-all duration-300 pointer-events-none ${activeSegment === 'NODES' ? 'left-0 w-1/3' : activeSegment === 'SYNAPSES' ? 'left-1/3 w-1/3' : 'left-2/3 w-1/3'}`}></div>
            {['NODES', 'SYNAPSES', 'VECTORS'].map((seg) => (
                <button 
                    key={seg}
                    onClick={() => { setActiveSegment(seg as any); playClick(); }}
                    className={`flex-1 px-4 md:px-6 py-2 flex flex-col items-center justify-center gap-1 font-mono text-[10px] md:text-xs font-bold uppercase transition-all z-10 ${activeSegment === seg ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-500 hover:text-white'}`}
                >
                    <span className="flex items-center gap-2">
                        {seg === 'NODES' ? <Hexagon size={14} /> : seg === 'SYNAPSES' ? <Network size={14} /> : <Layers size={14} />} 
                        {seg}
                    </span>
                    <span className="hidden md:inline text-[8px] opacity-60 font-normal tracking-wide">
                        {seg === 'NODES' ? 'IDENTITIES' : seg === 'SYNAPSES' ? 'CLAIMS' : 'LISTS'}
                    </span>
                </button>
            ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center w-full mb-8">
            {activeSegment === 'NODES' && (
                <div className="flex gap-1 border border-intuition-border p-1 bg-black clip-path-slant">
                    <button 
                        onClick={() => { playClick(); setViewMode('GRID'); }}
                        className={`flex items-center gap-2 px-4 py-3 text-[10px] font-bold font-mono transition-colors ${viewMode === 'GRID' ? 'bg-intuition-primary text-black' : 'text-slate-500 hover:text-white'}`}
                    >
                        <LayoutGrid size={14} /> GRID
                    </button>
                    <button 
                        onClick={() => { playClick(); setViewMode('HEATMAP'); }}
                        className={`flex items-center gap-2 px-4 py-3 text-[10px] font-bold font-mono transition-colors ${viewMode === 'HEATMAP' ? 'bg-intuition-primary text-black' : 'text-slate-500 hover:text-white'}`}
                    >
                        <Grid size={14} /> HEATMAP
                    </button>
                </div>
            )}

            {activeSegment === 'NODES' && (
                <button 
                    onClick={toggleWatchlistFilter}
                    className={`flex items-center justify-center gap-2 px-4 py-3 bg-intuition-dark border rounded-none text-xs font-mono font-bold clip-path-slant transition-all hover:bg-intuition-primary/10 ${showWatchlistOnly ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-intuition-border text-slate-500 hover:border-yellow-500/50 hover:text-yellow-500'}`}
                    title="Toggle Watchlist"
                >
                    <Star size={16} fill={showWatchlistOnly ? "currentColor" : "none"} />
                </button>
            )}

            <div className="relative group flex-1 w-full md:w-auto">
              <input 
                  type="text" 
                  placeholder={`SEARCH ${activeSegment}...`} 
                  className="w-full bg-intuition-dark border border-intuition-border rounded-none py-3 pl-10 pr-10 text-intuition-primary font-mono text-sm focus:outline-none focus:border-intuition-primary focus:shadow-[0_0_15px_rgba(0,243,255,0.2)] transition-all placeholder-intuition-primary/30 uppercase clip-path-slant"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={playHover}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-intuition-primary/50 group-hover:text-intuition-primary transition-colors" size={16} />
              {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 size={16} className="text-intuition-primary animate-spin" /></div>}
            </div>

            {activeSegment === 'NODES' && (
                <div className="relative" ref={sortRef}>
                    <button 
                        onClick={() => { setIsSortOpen(!isSortOpen); playClick(); }}
                        className={`flex items-center justify-between gap-2 px-4 py-3 w-full md:min-w-[180px] bg-intuition-dark border border-intuition-border text-xs font-mono font-bold text-intuition-primary clip-path-slant hover:bg-intuition-primary/10 hover:border-intuition-primary transition-all ${isSortOpen ? 'border-intuition-primary shadow-[0_0_15px_rgba(0,243,255,0.2)]' : ''}`}
                    >
                        <div className="flex items-center gap-2"><Filter size={14} />{getSortLabel(sortOption)}</div>
                        <ChevronDown size={14} className={`transition-transform duration-300 ${isSortOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isSortOpen && (
                        <div className="absolute right-0 top-full mt-2 w-full md:w-64 bg-black border border-intuition-primary/50 shadow-[0_0_30px_rgba(0,243,255,0.15)] z-50 clip-path-slant p-1 animate-in slide-in-from-top-2 fade-in duration-200">
                            <div className="bg-intuition-dark/90 p-2 space-y-1">
                                <button onClick={() => toggleSort('MCAP_DESC')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono hover:bg-intuition-primary/20 hover:text-white transition-colors group ${sortOption === 'MCAP_DESC' ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-400'}`}><span>M.CAP (HIGH)</span> <TrendingUp size={12} /></button>
                                <button onClick={() => toggleSort('VOL_DESC')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono hover:bg-intuition-primary/20 hover:text-white transition-colors group ${sortOption === 'VOL_DESC' ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-400'}`}><span>VOLUME (HIGH)</span> <TrendingUp size={12} /></button>
                                <button onClick={() => toggleSort('PRICE_DESC')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono hover:bg-intuition-primary/20 hover:text-white transition-colors group ${sortOption === 'PRICE_DESC' ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-400'}`}><span>PRICE (HIGH)</span> <Tag size={12} /></button>
                                <div className="h-px bg-white/10 my-1"></div>
                                <button onClick={() => toggleSort('MCAP_ASC')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono hover:bg-intuition-primary/20 hover:text-white transition-colors group ${sortOption === 'MCAP_ASC' ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-500'}`}><span>M.CAP (LOW)</span> <ArrowDown size={12} /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {[...Array(8)].map((_, i) => (
             <div key={i} className="h-[280px] bg-intuition-card/50 animate-pulse border border-intuition-border/50 relative overflow-hidden clip-path-slant"></div>
           ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-intuition-border bg-intuition-card/30 clip-path-slant flex flex-col items-center justify-center gap-4">
            <Database size={48} className="text-intuition-border" />
            <p className="text-intuition-primary/50 text-lg font-mono">{showWatchlistOnly ? 'WATCHLIST_EMPTY' : isSearching ? 'SEARCHING GLOBAL MATRIX...' : 'NO_DATA_FOUND'}</p>
        </div>
      ) : activeSegment === 'VECTORS' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((list) => (
                  <Link 
                    key={list.id} 
                    to={`/markets/${list.id}`} 
                    className="group relative flex flex-col p-6 bg-black border border-intuition-border hover:border-intuition-primary transition-all clip-path-slant hover:shadow-[0_0_20px_rgba(0,243,255,0.1)]"
                    onClick={playClick}
                  >
                      <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-500 group-hover:text-intuition-primary group-hover:border-intuition-primary transition-colors">
                              <Layers size={20} />
                          </div>
                          <div>
                              <div className="text-[10px] font-mono text-slate-500 uppercase">Vector List</div>
                              <h3 className="text-lg font-bold font-display text-white group-hover:text-intuition-primary transition-colors">{list.label || 'UNTITLED'}</h3>
                          </div>
                      </div>
                      <div className="flex items-center -space-x-2 mt-auto">
                          {(list.items || []).slice(0, 5).map((item: any, i: number) => (
                              <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-slate-800 flex items-center justify-center overflow-hidden">
                                  {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <span className="text-[8px]">{item.label?.[0]}</span>}
                              </div>
                          ))}
                          {(list.totalItems > 5) && <div className="w-8 h-8 rounded-full border-2 border-black bg-intuition-primary/20 flex items-center justify-center text-[8px] font-bold text-intuition-primary">+{list.totalItems - 5}</div>}
                      </div>
                  </Link>
              ))}
          </div>
      ) : activeSegment === 'SYNAPSES' ? (
          <div className="grid grid-cols-1 gap-2">
              {filteredItems.map((claim) => {
                  const pred = (claim.predicate || 'LINK').toUpperCase();
                  let colorClass = 'text-intuition-primary border-intuition-primary bg-intuition-primary/10';
                  if (pred.includes('TRUST')) colorClass = 'text-intuition-success border-intuition-success bg-intuition-success/10';
                  else if (pred.includes('DISTRUST')) colorClass = 'text-intuition-danger border-intuition-danger bg-intuition-danger/10';

                  return (
                    <div key={claim.id} className="relative bg-[#05080f] border border-intuition-border/50 hover:border-intuition-primary/50 transition-all group overflow-hidden">
                        <div className="flex flex-col md:flex-row items-center p-3 gap-2 md:gap-4">
                            {/* Connection Line Visual */}
                            <div className="absolute top-1/2 left-4 right-4 h-px bg-slate-800 -z-0 hidden md:block"></div>

                            {/* Subject */}
                            <div className="flex items-center gap-3 w-full md:w-[35%] bg-[#05080f] z-10 pr-2">
                                <div className="w-10 h-10 bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 shrink-0">
                                    {claim.subject.image ? <img src={claim.subject.image} className="w-full h-full object-cover"/> : <User size={18} className="text-slate-500" />}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[8px] text-slate-500 font-mono uppercase">Subject</div>
                                    <div className="text-sm font-bold font-display text-white truncate group-hover:text-intuition-primary transition-colors">{claim.subject.label || 'Unknown Agent'}</div>
                                </div>
                            </div>

                            {/* Predicate */}
                            <div className="flex-shrink-0 z-10 px-2">
                                <div className={`px-3 py-1 text-[10px] font-bold font-mono border rounded ${colorClass} uppercase tracking-wider shadow-lg bg-[#05080f]`}>
                                    {claim.predicate}
                                </div>
                            </div>

                            {/* Object */}
                            <div className="flex items-center justify-end gap-3 w-full md:w-[35%] bg-[#05080f] z-10 pl-2">
                                <div className="text-right min-w-0">
                                    <div className="text-[8px] text-slate-500 font-mono uppercase">Object</div>
                                    <div className="text-sm font-bold font-display text-white truncate group-hover:text-intuition-primary transition-colors">{claim.object.label || 'Unknown Target'}</div>
                                </div>
                                <div className="w-10 h-10 bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 shrink-0">
                                    {claim.object.image ? <img src={claim.object.image} className="w-full h-full object-cover"/> : <Shield size={18} className="text-slate-500" />}
                                </div>
                            </div>

                            {/* Action */}
                            <div className="w-full md:w-auto md:ml-auto flex items-center justify-between md:flex-col md:items-end gap-1 border-t md:border-t-0 border-white/5 pt-2 md:pt-0 mt-2 md:mt-0 bg-[#05080f] z-10 pl-4">
                                <div className="text-xs font-mono font-bold text-intuition-success">
                                    {parseFloat(formatEther(BigInt(claim.value))).toLocaleString(undefined, {maximumFractionDigits: 0})} STAKED
                                </div>
                                <Link to={`/markets/${claim.id}`} className="px-4 py-1 bg-white/5 hover:bg-intuition-primary hover:text-black border border-white/10 hover:border-intuition-primary transition-all text-[10px] font-bold font-mono uppercase clip-path-slant">
                                    TRADE
                                </Link>
                            </div>
                        </div>
                    </div>
                  );
              })}
          </div>
      ) : viewMode === 'HEATMAP' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {filteredItems.map(agent => {
                const assets = agent.totalAssets ? parseFloat(formatEther(BigInt(agent.totalAssets))) : 0;
                const shares = agent.totalShares ? parseFloat(formatEther(BigInt(agent.totalShares))) : 0;
                const price = shares > 0 ? assets / shares : 0;
                let strength = 50;
                if (price > 0) strength = Math.min(99, Math.max(1, 50 + (Math.log10(price) * 25)));
                const marketCap = shares * price;
                let bgClass = 'bg-slate-800';
                if (strength > 75) bgClass = 'bg-emerald-500';
                else if (strength > 60) bgClass = 'bg-emerald-700';
                else if (strength > 50) bgClass = 'bg-slate-600';
                else if (strength > 40) bgClass = 'bg-rose-700';
                else bgClass = 'bg-rose-600';

                return (
                    <Link 
                        key={agent.id} 
                        to={`/markets/${agent.id}`}
                        onClick={playClick}
                        className={`aspect-square p-2 flex flex-col justify-between hover:scale-105 transition-transform duration-300 relative group overflow-hidden ${bgClass} border border-black/20`}
                    >
                        <div className="text-[10px] font-black font-display text-white/90 truncate z-10 drop-shadow-md">{agent.label}</div>
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
          {filteredItems.map((agent) => {
             const assets = agent.totalAssets ? parseFloat(formatEther(BigInt(agent.totalAssets))) : 0;
             const shares = agent.totalShares ? parseFloat(formatEther(BigInt(agent.totalShares))) : 0;
             const price = agent.currentSharePrice && agent.currentSharePrice !== "0" ? parseFloat(formatEther(BigInt(agent.currentSharePrice))) : (shares > 0 ? assets / shares : 0);
             const marketCap = shares * price;
             const strength = Math.min(99, Math.max(1, 50 + (Math.log10(price > 0 ? price : 1) * 25)));
             
             let styles = { rank: 'D', textColor: 'text-slate-400', barGradient: 'bg-gradient-to-r from-slate-800 to-slate-500', barShadow: 'shadow-[0_0_10px_rgba(148,163,184,0.3)]', borderColor: 'border-slate-800', shadowHover: 'group-hover:shadow-[0_0_15px_rgba(148,163,184,0.3),inset_0_0_10px_rgba(148,163,184,0.1)]', borderHover: 'group-hover:border-slate-500', gradient: 'from-slate-900/20 via-black to-black' };

             if (strength >= 90) styles = { rank: 'S', textColor: 'text-yellow-400', barGradient: 'bg-gradient-to-r from-yellow-600/50 via-yellow-400 to-yellow-200', barShadow: 'shadow-[0_0_15px_rgba(250,204,21,0.8)]', borderColor: 'border-yellow-500/30', shadowHover: 'group-hover:shadow-[0_0_30px_rgba(234,179,8,0.6),inset_0_0_20px_rgba(234,179,8,0.2)]', borderHover: 'group-hover:border-yellow-300', gradient: 'from-yellow-500/10 via-black to-black' };
             else if (strength >= 75) styles = { rank: 'A', textColor: 'text-purple-400', barGradient: 'bg-gradient-to-r from-purple-600/50 via-purple-400 to-purple-200', barShadow: 'shadow-[0_0_15px_rgba(192,132,252,0.8)]', borderColor: 'border-purple-500/30', shadowHover: 'group-hover:shadow-[0_0_30px_rgba(168,85,247,0.6),inset_0_0_20px_rgba(168,85,247,0.2)]', borderHover: 'group-hover:border-purple-300', gradient: 'from-purple-500/10 via-black to-black' };
             else if (strength >= 60) styles = { rank: 'B', textColor: 'text-cyan-400', barGradient: 'bg-gradient-to-r from-cyan-600/50 via-cyan-400 to-cyan-200', barShadow: 'shadow-[0_0_15px_rgba(34,211,238,0.8)]', borderColor: 'border-cyan-500/30', shadowHover: 'group-hover:shadow-[0_0_30px_rgba(6,182,212,0.6),inset_0_0_20px_rgba(6,182,212,0.2)]', borderHover: 'group-hover:border-cyan-300', gradient: 'from-cyan-500/10 via-black to-black' };
             else if (strength >= 40) styles = { rank: 'C', textColor: 'text-emerald-400', barGradient: 'bg-gradient-to-r from-emerald-600/50 via-emerald-400 to-emerald-200', barShadow: 'shadow-[0_0_15px_rgba(52,211,153,0.8)]', borderColor: 'border-emerald-500/30', shadowHover: 'group-hover:shadow-[0_0_30px_rgba(16,185,129,0.6),inset_0_0_20px_rgba(16,185,129,0.2)]', borderHover: 'group-hover:border-emerald-300', gradient: 'from-emerald-500/10 via-black to-black' };

             return (
              <Link 
                key={agent.id} 
                to={`/markets/${agent.id}`}
                onClick={playClick}
                onMouseEnter={playHover}
                className={`group relative flex flex-col bg-[#05080f] border ${styles.borderColor} transition-all duration-200 overflow-hidden clip-path-slant hover:-translate-y-2 hover:scale-[1.02] ${styles.shadowHover} ${styles.borderHover}`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent -translate-y-full group-hover:translate-y-full transition-transform duration-700 pointer-events-none z-20"></div>
                <div className={`absolute inset-0 bg-gradient-to-br ${styles.gradient} opacity-40 pointer-events-none`}></div>
                <div className="relative p-5 z-10 flex flex-col h-full">
                   <div className="flex justify-between items-start mb-4">
                      <div className={`relative w-16 h-16 shrink-0 border-2 ${styles.borderColor} bg-black flex items-center justify-center overflow-hidden clip-path-slant shadow-lg group-hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-shadow`}>
                          {agent.image ? (
                             <img src={agent.image} alt={agent.label} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                          ) : (
                             <div className={`text-2xl font-bold ${styles.textColor}`}>{agent.label?.[0]?.toUpperCase()}</div>
                          )}
                      </div>
                      <div className={`flex flex-col items-end`}>
                          <div className={`text-4xl font-black font-display italic ${styles.textColor} drop-shadow-md text-glow`}>{styles.rank}</div>
                          <div className={`text-[8px] font-mono ${styles.textColor} uppercase tracking-widest opacity-80`}>TIER</div>
                      </div>
                   </div>
                   <div className="mb-4">
                       <div className="flex items-center gap-2 mb-1">
                           <h3 className="text-white font-bold font-display text-lg leading-tight truncate group-hover:text-intuition-primary transition-colors group-hover:text-shadow">
                               {agent.label || 'UNKNOWN_NODE'}
                           </h3>
                           {styles.rank === 'S' && <Star size={12} className="text-yellow-400 fill-yellow-400 animate-pulse" />}
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase">
                           <span>{agent.type || 'NODE'}</span>
                           <span>ID: {agent.id.slice(0,6)}</span>
                       </div>
                   </div>
                   <div className="mt-auto grid grid-cols-2 gap-px bg-slate-800/50 border border-slate-700/50 rounded-sm overflow-hidden">
                       <div className="bg-[#0a0f1a] p-2 flex flex-col justify-center border-r border-slate-800/50 group-hover:bg-slate-900 transition-colors">
                           <span className="text-[8px] text-slate-500 uppercase tracking-wider mb-0.5">Market Cap</span>
                           <span className={`text-xs font-mono font-bold ${styles.textColor}`}>{marketCap > 0 ? marketCap.toFixed(2) : '-'}</span>
                       </div>
                       <div className="bg-[#0a0f1a] p-2 flex flex-col justify-center group-hover:bg-slate-900 transition-colors text-right">
                           <span className="text-[8px] text-slate-500 uppercase tracking-wider mb-0.5">Spot Price</span>
                           <span className="text-xs font-mono font-bold text-white">{price.toFixed(3)}</span>
                       </div>
                   </div>
                   <div className="mt-3 pt-2 border-t border-white/5">
                       <div className="flex justify-between items-end text-[9px] font-mono font-bold uppercase mb-1">
                           <span className={styles.textColor}>TRUST {strength.toFixed(0)}%</span>
                           <span className="text-slate-600">DISTRUST {(100-strength).toFixed(0)}%</span>
                       </div>
                       <div className="h-2 w-full bg-black/60 rounded-sm overflow-hidden border border-white/10 relative shadow-inner">
                           <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMzMzMiLz4KPC9zdmc+')] opacity-30"></div>
                           <div style={{ width: `${strength}%` }} className={`h-full ${styles.barGradient} ${styles.barShadow} relative transition-all duration-1000 flex items-center justify-end`}>
                                <div className="h-full w-1 bg-white/80 blur-[1px] shadow-[0_0_5px_white]"></div>
                           </div>
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
