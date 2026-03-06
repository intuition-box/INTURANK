
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Search, TrendingUp, Filter, Tag, Zap, Activity, ShieldCheck, Loader2, Database, ChevronDown, Star, LayoutGrid, Grid, Hexagon, Network, Layers, ArrowRight, Shield, User, Globe, Cpu, Component, Boxes, ScanSearch, Hash, Users, BadgeCheck, UserCog, List } from 'lucide-react';
import { formatEther } from 'viem';
import { getAllAgents, searchGlobalAgents, searchClaims, getLists, getTopClaims } from '../services/graphql';
import { playHover, playClick } from '../services/audio';
import { Account } from '../types';
import { getWatchlist, getConnectedAccount } from '../services/web3';
import { toast } from '../components/Toast';
import { calculateTrustScore, calculateAgentPrice, formatMarketValue, calculateMarketCap, formatLargeNumber, isSystemVerified } from '../services/analytics';
import { CURRENCY_SYMBOL } from '../constants';
import { CurrencySymbol } from '../components/CurrencySymbol';

type SortOption = 'MCAP_DESC' | 'MCAP_ASC' | 'VOL_DESC' | 'VOL_ASC' | 'PRICE_DESC' | 'PRICE_ASC' | 'TRUST_DESC' | 'TRUST_ASC';
type ClaimSortOption = 'TOTAL_MCAP_DESC' | 'TOTAL_MCAP_ASC' | 'SUPPORT_MCAP_DESC' | 'SUPPORT_MCAP_ASC' | 'OPPOSE_MCAP_DESC' | 'OPPOSE_MCAP_ASC' | 'SUPPORTERS_DESC' | 'SUPPORTERS_ASC' | 'OPPOSERS_DESC' | 'OPPOSERS_ASC' | 'POSITIONS_DESC' | 'POSITIONS_ASC';
type ListSortOption = 'MCAP_DESC' | 'MCAP_ASC' | 'POSITIONS_DESC' | 'POSITIONS_ASC' | 'ENTRIES_DESC' | 'ENTRIES_ASC' | 'AZ' | 'ZA';
type ViewMode = 'GRID' | 'HEATMAP';
type ListViewMode = 'GRID' | 'LIST';
type MarketSegment = 'NODES' | 'SYNAPSES' | 'VECTORS';

const SEGMENT_FROM_PATH: Record<string, MarketSegment> = { atoms: 'NODES', triples: 'SYNAPSES', lists: 'VECTORS' };
const PATH_FROM_SEGMENT: Record<MarketSegment, string> = { NODES: 'atoms', SYNAPSES: 'triples', VECTORS: 'lists' };

const Markets: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address: wagmiAddress } = useAccount();
  const [agents, setAgents] = useState<Account[]>([]);
  const [lists, setLists] = useState<any[]>([]); 
  const [claims, setClaims] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [serverResults, setServerResults] = useState<Account[]>([]);
  const [claimSearchResults, setClaimSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('GRID');
  const pathSegment = location.pathname.split('/').pop() || 'atoms';
  const activeSegment = SEGMENT_FROM_PATH[pathSegment] ?? 'NODES';
  const [account, setAccount] = useState<string | null>(null);
  
  const [sortOption, setSortOption] = useState<SortOption>('MCAP_DESC');
  const [claimSortOption, setClaimSortOption] = useState<ClaimSortOption>('SUPPORT_MCAP_DESC');
  const [listSortOption, setListSortOption] = useState<ListSortOption>('MCAP_DESC');
  const [listViewMode, setListViewMode] = useState<ListViewMode>('GRID');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isClaimSortOpen, setIsClaimSortOpen] = useState(false);
  const [isListSortOpen, setIsListSortOpen] = useState(false);
  
  // Pagination State
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 40;

  const sortRef = useRef<HTMLDivElement>(null);
  const claimSortRef = useRef<HTMLDivElement>(null);
  const listSortRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
        setDebouncedTerm(searchTerm);
    }, 400); 
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  const getListOrderBy = useCallback((opt: ListSortOption) => {
    if (opt === 'MCAP_DESC') return [{ total_market_cap: 'desc' as const }];
    if (opt === 'MCAP_ASC') return [{ total_market_cap: 'asc' as const }];
    if (opt === 'POSITIONS_DESC') return [{ total_position_count: 'desc' as const }];
    if (opt === 'POSITIONS_ASC') return [{ total_position_count: 'asc' as const }];
    if (opt === 'ENTRIES_DESC') return [{ triple_count: 'desc' as const }];
    if (opt === 'ENTRIES_ASC') return [{ triple_count: 'asc' as const }];
    return [{ total_market_cap: 'desc' as const }];
  }, []);

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
            const orderBy = ['AZ', 'ZA'].includes(listSortOption) ? undefined : getListOrderBy(listSortOption);
            const res = await getLists(PAGE_SIZE, 0, orderBy);
            setLists(res.items);
            setHasMore(res.hasMore);
        }
    } catch (error) {
        console.warn("[INTERNAL_LOG] INITIAL_FETCH_ERROR", error);
    } finally {
        setLoading(false);
    }
  }, [activeSegment, listSortOption, getListOrderBy]);

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
          } else           if (activeSegment === 'VECTORS') {
              const orderBy = ['AZ', 'ZA'].includes(listSortOption) ? undefined : getListOrderBy(listSortOption);
              res = await getLists(PAGE_SIZE, nextOffset, orderBy);
              setLists(prev => [...prev, ...res.items]);
          }
          
          setHasMore(res.hasMore);
          setOffset(nextOffset);
      } catch (error) {
          console.warn("[INTERNAL_LOG] FETCH_MORE_ERROR", error);
      } finally {
          setLoadingMore(false);
      }
  }, [activeSegment, offset, hasMore, loading, loadingMore, debouncedTerm, listSortOption, getListOrderBy]);

  useEffect(() => {
      fetchInitialData();
  }, [fetchInitialData, sortOption, listSortOption]);

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
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) setIsSortOpen(false);
      if (claimSortRef.current && !claimSortRef.current.contains(event.target as Node)) setIsClaimSortOpen(false);
      if (listSortRef.current && !listSortRef.current.contains(event.target as Node)) setIsListSortOpen(false);
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
         setClaimSearchResults([]);
         setIsSearching(false);
         return;
     }
     setIsSearching(true);
     if (activeSegment === 'SYNAPSES') {
         searchClaims(term)
             .then(setClaimSearchResults)
             .catch(() => setClaimSearchResults([]))
             .finally(() => setIsSearching(false));
         setServerResults([]);
     } else {
         searchGlobalAgents(term)
             .then(setServerResults)
             .catch(() => setServerResults([]))
             .finally(() => setIsSearching(false));
         setClaimSearchResults([]);
     }
  }, [debouncedTerm, activeSegment]);

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
    else if (activeSegment === 'SYNAPSES') candidates = debouncedTerm.trim().length >= 2 && claimSearchResults.length > 0 ? claimSearchResults : claims;
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

    if (term && !(activeSegment === 'SYNAPSES' && claimSearchResults.length > 0)) {
        candidates = candidates.filter(item => {
            if (activeSegment === 'VECTORS') return (item.label || '').toLowerCase().includes(term);
            if (activeSegment === 'SYNAPSES') return (item.subject?.label || '').toLowerCase().includes(term) || (item.object?.label || '').toLowerCase().includes(term);
            return false;
        });
    }

    if (activeSegment === 'VECTORS') {
        const mcap = (l: any) => Number(l.totalMarketCap) || 0;
        const pos = (l: any) => Number(l.totalPositionCount) || 0;
        const entries = (l: any) => Number(l.totalItems) || 0;
        const label = (l: any) => (l.label || '').toLowerCase();
        return candidates.sort((a, b) => {
            switch (listSortOption) {
                case 'MCAP_DESC': return mcap(b) - mcap(a);
                case 'MCAP_ASC': return mcap(a) - mcap(b);
                case 'POSITIONS_DESC': return pos(b) - pos(a);
                case 'POSITIONS_ASC': return pos(a) - pos(b);
                case 'ENTRIES_DESC': return entries(b) - entries(a);
                case 'ENTRIES_ASC': return entries(a) - entries(b);
                case 'AZ': return label(a).localeCompare(label(b));
                case 'ZA': return label(b).localeCompare(label(a));
                default: return mcap(b) - mcap(a);
            }
        });
    }

    if (activeSegment === 'SYNAPSES') {
        const totalMcap = (c: any) => (c.value ?? 0) + (c.opposeValue ?? 0);
        const pos = (c: any) => (c.holders ?? 0) + (c.opposeHolders ?? 0);
        return candidates.sort((a, b) => {
            switch (claimSortOption) {
                case 'TOTAL_MCAP_DESC': return totalMcap(b) - totalMcap(a);
                case 'TOTAL_MCAP_ASC': return totalMcap(a) - totalMcap(b);
                case 'SUPPORT_MCAP_DESC': return (b.value ?? 0) - (a.value ?? 0);
                case 'SUPPORT_MCAP_ASC': return (a.value ?? 0) - (b.value ?? 0);
                case 'OPPOSE_MCAP_DESC': return (b.opposeValue ?? 0) - (a.opposeValue ?? 0);
                case 'OPPOSE_MCAP_ASC': return (a.opposeValue ?? 0) - (b.opposeValue ?? 0);
                case 'SUPPORTERS_DESC': return (b.holders ?? 0) - (a.holders ?? 0);
                case 'SUPPORTERS_ASC': return (a.holders ?? 0) - (b.holders ?? 0);
                case 'OPPOSERS_DESC': return (b.opposeHolders ?? 0) - (a.opposeHolders ?? 0);
                case 'OPPOSERS_ASC': return (a.opposeHolders ?? 0) - (b.opposeHolders ?? 0);
                case 'POSITIONS_DESC': return pos(b) - pos(a);
                case 'POSITIONS_ASC': return pos(a) - pos(b);
                default: return totalMcap(b) - totalMcap(a);
            }
        });
    }

    return candidates;
  }, [agents, lists, claims, debouncedTerm, serverResults, claimSearchResults, sortOption, claimSortOption, listSortOption, showWatchlistOnly, watchlistIds, activeSegment]);

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

  const getClaimSortLabel = (opt: ClaimSortOption) => {
      const labels: Record<ClaimSortOption, string> = {
          TOTAL_MCAP_DESC: 'Highest Total Market Cap',
          TOTAL_MCAP_ASC: 'Lowest Total Market Cap',
          SUPPORT_MCAP_DESC: 'Highest Support Market Cap',
          SUPPORT_MCAP_ASC: 'Lowest Support Market Cap',
          OPPOSE_MCAP_DESC: 'Highest Oppose Market Cap',
          OPPOSE_MCAP_ASC: 'Lowest Oppose Market Cap',
          SUPPORTERS_DESC: 'Most Supporters',
          SUPPORTERS_ASC: 'Fewest Supporters',
          OPPOSERS_DESC: 'Most Opposers',
          OPPOSERS_ASC: 'Fewest Opposers',
          POSITIONS_DESC: 'Most Positions',
          POSITIONS_ASC: 'Fewest Positions',
      };
      return labels[opt];
  };

  const toggleClaimSort = (option: ClaimSortOption) => { setClaimSortOption(option); setIsClaimSortOpen(false); playClick(); };

  const getListSortLabel = (opt: ListSortOption) => {
    const labels: Record<ListSortOption, string> = {
      MCAP_DESC: 'Highest Market Cap',
      MCAP_ASC: 'Lowest Market Cap',
      POSITIONS_DESC: 'Most Positions',
      POSITIONS_ASC: 'Fewest Positions',
      ENTRIES_DESC: 'Most Entries',
      ENTRIES_ASC: 'Fewest Entries',
      AZ: 'A-Z (Alphabetical ascending)',
      ZA: 'Z-A (Alphabetical descending)',
    };
    return labels[opt];
  };

  const toggleListSort = (opt: ListSortOption) => { setListSortOption(opt); setIsListSortOpen(false); playClick(); };

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
                const label = seg === 'NODES' ? 'Atoms' : seg === 'SYNAPSES' ? 'Claims' : 'Lists';
                return (
                    <button 
                        key={seg}
                        onClick={() => { navigate(`/markets/${PATH_FROM_SEGMENT[seg]}`); playClick(); }}
                        onMouseEnter={playHover}
                        className={`px-8 py-3 flex items-center gap-3 font-mono text-[11px] font-black uppercase transition-all clip-path-slant ${isActive ? 'text-black bg-intuition-primary shadow-[0_0_25px_rgba(0,243,255,0.4)]' : 'text-slate-500 hover:text-white'}`}
                    >
                        {seg === 'NODES' ? <Hexagon size={16} /> : seg === 'SYNAPSES' ? <Network size={16} /> : <Layers size={16} />} 
                        {label}
                    </button>
                );
            })}
        </div>
      </div>

      <div className={`flex flex-col lg:flex-row gap-4 sm:gap-6 items-stretch lg:items-center w-full min-w-0 mb-10 relative ${isSortOpen ? 'z-[60]' : 'z-40'}`}>
            {(activeSegment === 'NODES' || activeSegment === 'VECTORS') && (
                <div className="flex gap-2 p-1.5 bg-black/60 border border-slate-800 rounded-2xl">
                    {activeSegment === 'NODES' ? (
                        <>
                            <button 
                                onClick={() => { playClick(); setViewMode('GRID'); }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black font-mono transition-all duration-300 ${viewMode === 'GRID' ? 'bg-intuition-primary text-black shadow-[0_0_20px_rgba(0,243,255,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            >
                                <LayoutGrid size={14} /> GRID
                            </button>
                            <button 
                                onClick={() => { playClick(); setViewMode('HEATMAP'); }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black font-mono transition-all duration-300 ${viewMode === 'HEATMAP' ? 'bg-intuition-primary text-black shadow-[0_0_20px_rgba(0,243,255,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            >
                                <Grid size={14} /> HEATMAP
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={() => { playClick(); setListViewMode('GRID'); }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black font-mono transition-all duration-300 ${listViewMode === 'GRID' ? 'bg-intuition-primary text-black shadow-[0_0_20px_rgba(0,243,255,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            >
                                <LayoutGrid size={14} /> GRID
                            </button>
                            <button 
                                onClick={() => { playClick(); setListViewMode('LIST'); }}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black font-mono transition-all duration-300 ${listViewMode === 'LIST' ? 'bg-intuition-primary text-black shadow-[0_0_20px_rgba(0,243,255,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                            >
                                <List size={14} /> LIST
                            </button>
                        </>
                    )}
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

            <div className="relative group flex-1 min-w-0 p-[2px] bg-slate-900 clip-path-slant focus-within:bg-intuition-primary/50 transition-colors">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-intuition-primary z-10">
                  <Search size={18} className="group-focus-within:animate-pulse" />
              </div>
              <input 
                  type="text" 
                  placeholder={activeSegment === 'SYNAPSES' ? 'Search claims by subject, predicate, or object' : `Search ${activeSegment === 'NODES' ? 'atoms' : 'lists'}...`} 
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

            {activeSegment === 'VECTORS' && (
                <div className="relative" ref={listSortRef}>
                    <div className={`p-[2px] clip-path-slant transition-colors ${isListSortOpen ? 'bg-intuition-primary' : 'bg-slate-900 hover:bg-intuition-primary/50'}`}>
                        <button 
                            onClick={() => { setIsListSortOpen(!isListSortOpen); playClick(); }}
                            className={`flex items-center justify-between gap-4 sm:gap-6 min-h-[44px] px-4 sm:px-6 py-3 sm:py-4 min-w-[180px] sm:min-w-[220px] bg-black text-[9px] sm:text-[10px] font-black font-mono text-intuition-primary clip-path-slant transition-all`}
                        >
                            <div className="flex items-center gap-3"><Filter size={14} />{getListSortLabel(listSortOption)}</div>
                            <ChevronDown size={14} className={`transition-transform duration-300 ${isListSortOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                    {isListSortOpen && (
                        <div className="absolute right-0 top-full mt-2 w-full max-h-[360px] overflow-y-auto bg-intuition-primary p-[1px] shadow-[0_0_50px_rgba(0,0,0,1)] z-[100] clip-path-slant">
                            <div className="bg-[#0a0a0a] p-1 clip-path-slant">
                                {(['MCAP_DESC', 'MCAP_ASC', 'POSITIONS_DESC', 'POSITIONS_ASC', 'ENTRIES_DESC', 'ENTRIES_ASC', 'AZ', 'ZA'] as ListSortOption[]).map((opt) => (
                                    <button 
                                        key={opt}
                                        onClick={() => toggleListSort(opt)} 
                                        className={`w-full min-h-[40px] flex items-center justify-between px-4 py-2.5 text-[9px] font-black font-mono hover:bg-intuition-primary hover:text-black transition-all uppercase tracking-widest ${listSortOption === opt ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-500'}`}
                                    >
                                        <span>{getListSortLabel(opt)}</span>
                                        {listSortOption === opt && <ShieldCheck size={12} className="text-intuition-primary" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeSegment === 'SYNAPSES' && (
                <div className="relative" ref={claimSortRef}>
                    <div className={`p-[2px] clip-path-slant transition-colors ${isClaimSortOpen ? 'bg-intuition-primary' : 'bg-slate-900 hover:bg-intuition-primary/50'}`}>
                        <button 
                            onClick={() => { setIsClaimSortOpen(!isClaimSortOpen); playClick(); }}
                            className={`flex items-center justify-between gap-4 sm:gap-6 min-h-[44px] px-4 sm:px-6 py-3 sm:py-4 min-w-[180px] sm:min-w-[260px] bg-black text-[9px] sm:text-[10px] font-black font-mono text-intuition-primary clip-path-slant transition-all`}
                        >
                            <div className="flex items-center gap-3"><Filter size={14} />{getClaimSortLabel(claimSortOption)}</div>
                            <ChevronDown size={14} className={`transition-transform duration-300 ${isClaimSortOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                    {isClaimSortOpen && (
                        <div className="absolute right-0 top-full mt-2 w-full max-h-[400px] overflow-y-auto bg-intuition-primary p-[1px] shadow-[0_0_50px_rgba(0,0,0,1)] z-[100] clip-path-slant">
                            <div className="bg-[#0a0a0a] p-1 clip-path-slant">
                                {([
                                    'TOTAL_MCAP_DESC', 'TOTAL_MCAP_ASC',
                                    'SUPPORT_MCAP_DESC', 'SUPPORT_MCAP_ASC',
                                    'OPPOSE_MCAP_DESC', 'OPPOSE_MCAP_ASC',
                                    'SUPPORTERS_DESC', 'SUPPORTERS_ASC',
                                    'OPPOSERS_DESC', 'OPPOSERS_ASC',
                                    'POSITIONS_DESC', 'POSITIONS_ASC',
                                ] as ClaimSortOption[]).map((opt) => (
                                    <button 
                                        key={opt}
                                        onClick={() => toggleClaimSort(opt)} 
                                        className={`w-full min-h-[40px] flex items-center justify-between px-4 py-2.5 text-[9px] font-black font-mono hover:bg-intuition-primary hover:text-black transition-all uppercase tracking-widest ${claimSortOption === opt ? 'text-intuition-primary bg-intuition-primary/10' : 'text-slate-500'}`}
                                    >
                                        <span>{getClaimSortLabel(opt)}</span>
                                        {claimSortOption === opt && <ShieldCheck size={12} className="text-intuition-primary" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
      </div>

      {loading && offset === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 min-w-0">
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
          listViewMode === 'LIST' ? (
            <div className="bg-black border-2 border-slate-900 clip-path-slant overflow-hidden relative z-10 animate-in fade-in duration-500 shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono border-collapse min-w-[600px]">
                  <thead className="bg-[#080808] text-slate-700 text-[10px] font-black uppercase tracking-[0.3em] border-b-2 border-slate-900">
                    <tr>
                      <th className="px-6 py-5">LIST</th>
                      <th className="px-6 py-5">ENTRIES</th>
                      <th className="px-6 py-5">POSITIONS</th>
                      <th className="px-6 py-5 text-right">MARKET_CAP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredItems.map((list) => (
                      <tr 
                        key={list.id} 
                        onClick={() => { playClick(); navigate(`/markets/${list.id}`); }}
                        className="hover:bg-white/5 transition-all group relative cursor-pointer active:scale-[0.995] duration-200"
                      >
                        <td className="px-6 py-2">
                          <div className="flex items-center gap-3 py-4">
                            <div className="w-10 h-10 bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-800 rounded-xl">
                              {list.image ? <img src={list.image} className="w-full h-full object-cover" alt="" /> : <Component size={18} className="text-slate-600" />}
                            </div>
                            <span className="font-black text-white text-[11px] uppercase truncate max-w-[200px]">{list.label || 'Untitled list'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-2">
                          <div className="flex items-center gap-2">
                            <Database size={14} className="text-intuition-primary opacity-50" />
                            <span className="text-sm font-black text-intuition-primary">{formatLargeNumber(list.totalItems || 0)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-2">
                          <span className="text-sm font-black text-slate-400">{formatLargeNumber(list.totalPositionCount || 0)}</span>
                        </td>
                        <td className="px-6 py-2 text-right">
                          <span className="text-sm font-black text-white">{formatMarketValue(list.totalMarketCap || 0)} <CurrencySymbol size="sm" className="text-slate-600" /></span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 relative z-10 min-w-0">
              {filteredItems.map((list) => (
                  <Link 
                    key={list.id} 
                    to={`/markets/${list.id}`} 
                    className="group relative flex flex-col p-6 bg-slate-950/80 backdrop-blur-xl border-2 border-slate-800 hover:border-intuition-primary/60 transition-all duration-500 rounded-2xl overflow-hidden min-h-[320px] min-w-0 shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:shadow-[0_0_40px_rgba(0,243,255,0.15),0_0_0_1px_rgba(0,243,255,0.3)]"
                    onClick={playClick}
                    onMouseEnter={playHover}
                  >
                      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,243,255,0.04)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 pointer-events-none" />
                      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-intuition-primary/40 to-transparent rounded-full" />
                      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-intuition-primary/40 to-transparent rounded-full" />

                      <div className="absolute top-4 right-4 text-right z-20">
                          <span className="text-[9px] font-black font-mono text-intuition-primary/80 uppercase tracking-wider">LIST</span>
                      </div>

                      <div className="flex flex-col items-center justify-center flex-1 relative z-10 mb-5 mt-2">
                          <div className="relative mb-5 group-hover:scale-105 transition-transform duration-500">
                              <div className="absolute inset-0 bg-intuition-primary blur-[20px] opacity-20 group-hover:opacity-35 transition-all duration-500 rounded-full scale-110" />
                              <div className="relative w-20 h-20 rounded-2xl bg-black/80 border-2 border-slate-700 group-hover:border-intuition-primary/60 flex items-center justify-center text-slate-500 group-hover:text-intuition-primary transition-all duration-500 overflow-hidden shadow-[0_0_25px_rgba(0,243,255,0.4)]">
                                  {list.image ? (
                                      <img src={list.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500" alt="" />
                                  ) : (
                                      <Component size={32} className="group-hover:scale-110 transition-transform duration-500 opacity-70 group-hover:opacity-100" />
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                              </div>
                          </div>

                          <div className="px-3 text-center">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-intuition-primary/10 border border-intuition-primary/30 mb-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-intuition-primary animate-pulse" />
                                  <span className="text-[9px] font-black font-mono text-intuition-primary/90 uppercase tracking-wider">Aggregate</span>
                              </div>
                              <h3 className="text-base md:text-lg font-black font-display text-white group-hover:text-glow-blue transition-all uppercase tracking-tight leading-tight mb-3 line-clamp-2">
                                  {list.label || 'Untitled list'}
                              </h3>
                              
                              <div className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white/5 border border-white/10 group-hover:border-intuition-primary/30 transition-all duration-300">
                                  <Database size={12} className="text-intuition-primary" />
                                  <span className="text-[10px] font-black font-mono text-slate-400 group-hover:text-white transition-colors">
                                    {list.totalItems || 0} constituents
                                  </span>
                              </div>
                          </div>
                      </div>

                      <div className="flex items-center justify-center -space-x-2 mt-auto relative z-10 group-hover:translate-y-[-2px] transition-transform duration-300 mb-4">
                          {(list.items || []).slice(0, 5).map((item: any, i: number) => (
                              <div key={i} className="w-9 h-9 rounded-xl border-2 border-slate-800 hover:border-intuition-primary/60 bg-slate-900 flex items-center justify-center overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1 hover:z-10">
                                  {item.image ? <img src={item.image} className="w-full h-full object-cover" alt="" /> : <span className="text-[10px] font-black text-slate-600">{item.label?.[0]}</span>}
                              </div>
                          ))}
                          {(list.totalItems > 5) && (
                              <div className="w-9 h-9 rounded-xl border-2 border-intuition-primary/50 bg-intuition-primary/20 text-intuition-primary flex items-center justify-center text-[10px] font-black shadow-lg transition-all duration-300 hover:-translate-y-1 hover:z-10">
                                  +{list.totalItems - 5}
                              </div>
                          )}
                      </div>

                      <div className="absolute bottom-4 right-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300">
                          <ArrowRight size={18} className="text-intuition-primary drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]" />
                      </div>
                  </Link>
              ))}
          </div>
          )
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 min-w-0 relative z-10">
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
                        className={`aspect-square p-4 flex flex-col justify-between hover:scale-105 transition-all duration-300 relative group overflow-hidden border border-black/40 ${bgClass} shadow-2xl rounded-2xl hover:z-20`}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-w-0 relative z-10 gap-4 sm:gap-6 md:gap-8">
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
                className={`group relative flex flex-col rounded-3xl bg-gradient-to-br ${tierStyle.glow} border border-slate-900/80 transition-all duration-300 overflow-hidden hover:-translate-y-2 hover:border-white/60 shadow-[0_18px_45px_rgba(0,0,0,0.85)]`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_55%)] pointer-events-none" />
                
                <div className="relative p-5 sm:p-6 z-10 flex flex-col h-full">
                   <div className="flex items-start gap-4 mb-4">
                      <div className="relative shrink-0">
                        <div className="absolute -inset-1 rounded-2xl bg-black/60" />
                        <div className={`relative w-16 h-16 sm:w-18 sm:h-18 border border-white/10 bg-black/80 rounded-2xl flex items-center justify-center overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.9)]`}>
                          {agent.image ? (
                             <img src={agent.image} alt={agent.label} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                          ) : (
                             <div className={`text-3xl font-black ${tierStyle.color}`}>{agent.label?.[0]?.toUpperCase()}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-1">
                            <Shield size={10} className="text-intuition-primary" />
                            {tierStyle.name}
                          </span>
                          {verified && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-intuition-primary/10 border border-intuition-primary/40 text-[8px] font-black text-intuition-primary uppercase tracking-widest">
                              <BadgeCheck size={11} /> Verified
                            </span>
                          )}
                        </div>
                        <h3 className="text-white font-black font-display text-[15px] sm:text-[17px] leading-tight truncate uppercase tracking-tight group-hover:text-intuition-primary transition-colors">
                          {agent.label || 'UNKNOWN_NODE'}
                        </h3>
                        <p className="text-[9px] font-mono text-slate-600 uppercase tracking-[0.25em] mt-1">
                          ID: {agent.id.slice(0, 10)}...
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2">
                        <span className={`text-2xl font-black font-display ${tierStyle.color} leading-none`}>
                          {tierStyle.label}
                        </span>
                        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.3em]">
                          Trust Class
                        </span>
                      </div>
                   </div>

                   <div className="mt-2 mb-4 grid grid-cols-2 gap-3">
                     <div className="rounded-2xl bg-black/70 border border-white/5 px-3 py-3 flex flex-col justify-center">
                       <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Total Mkt Cap</span>
                       <span className="text-sm font-mono font-black text-white inline-flex items-baseline gap-1">
                         <CurrencySymbol size="sm" leading className="text-intuition-primary/90" />
                         {mktCap > 0 ? formatMarketValue(mktCap) : '0.00K'}
                       </span>
                     </div>
                     <div className="rounded-2xl bg-black/70 border border-white/5/10 px-3 py-3 flex flex-col justify-center">
                       <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Price / Unit</span>
                       <span className="text-sm font-mono font-black text-white inline-flex items-baseline gap-1">
                         <CurrencySymbol size="sm" leading className="text-slate-500" />
                         {formatMarketValue(price)}
                       </span>
                     </div>
                   </div>

                   <div className="mt-auto pt-3">
                     <div className="flex items-center justify-between text-[9px] font-mono font-black uppercase mb-1">
                       <span className={tierStyle.color}>Trust {strength.toFixed(0)}%</span>
                       <span className="text-slate-600">Distrust {(100-strength).toFixed(0)}%</span>
                     </div>
                     <div className="h-2.5 w-full rounded-full bg-slate-900/90 border border-white/5 overflow-hidden">
                       <div
                         style={{ width: `${strength}%` }}
                         className={`h-full ${tierStyle.bar} transition-all duration-700 shadow-[0_0_12px_currentColor]`}
                       />
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
