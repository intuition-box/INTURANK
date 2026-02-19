
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Activity, RefreshCw, Search, Terminal, Database, ShieldAlert, SignalHigh, Loader2 } from 'lucide-react';
import { getGlobalClaims } from '../services/graphql';
import { Claim } from '../types';
import ClaimCard from './ClaimCard';
import { playClick, playHover } from '../services/audio';

const ClaimFeed: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'TRUST' | 'DISTRUST'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 40;

  const intervalRef = useRef<any>(null);
  const searchTimeoutRef = useRef<any>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Search Debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchTerm]);

  const fetchClaims = useCallback(async (isBackground = false, reset = false) => {
    if (isSyncing || (loadingMore && !reset)) return;
    
    if (reset) {
        setLoading(true);
        setOffset(0);
        setHasMore(true);
    } else if (!isBackground) {
        setIsSyncing(true);
    }

    try {
      const currentOffset = reset ? 0 : offset;
      const data = await getGlobalClaims(PAGE_SIZE, currentOffset);
      
      setClaims(prev => {
          // Fix: Access the 'items' property from the result of getGlobalClaims()
          const combined = reset ? data.items : [...prev, ...data.items];
          const uniqueMap = new Map();
          // Fix: Accessing 'forEach' on 'combined' array
          combined.forEach(item => uniqueMap.set(item.id, item));
          const uniqueArray = Array.from(uniqueMap.values()) as Claim[];
          return uniqueArray.sort((a, b) => {
              const blockDiff = (b.block || 0) - (a.block || 0);
              if (blockDiff !== 0) return blockDiff;
              return (b.timestamp || 0) - (a.timestamp || 0);
          });
      });

      // Fix: Access 'length' property from 'data.items'
      if (data.items.length < PAGE_SIZE) setHasMore(false);
      setLastUpdated(new Date());
    } catch (e) {
      console.warn("[INTERNAL_LOG] FEED_SYNC_FAILURE:", e);
    } finally {
      setLoading(false);
      setIsSyncing(false);
      setLoadingMore(false);
    }
  }, [isSyncing, offset, loadingMore]);

  const fetchMore = async () => {
      if (loadingMore || !hasMore || loading) return;
      setLoadingMore(true);
      const nextOffset = offset + PAGE_SIZE;
      try {
          const data = await getGlobalClaims(PAGE_SIZE, nextOffset);
          setClaims(prev => {
              // Fix: Access 'items' property and spread into combined array
              const combined = [...prev, ...data.items];
              const uniqueMap = new Map();
              combined.forEach(item => uniqueMap.set(item.id, item));
              return Array.from(uniqueMap.values()) as Claim[];
          });
          // Fix: Access 'length' property from 'data.items'
          if (data.items.length < PAGE_SIZE) setHasMore(false);
          setOffset(nextOffset);
      } catch (e) {
          console.warn("[INTERNAL_LOG] FEED_LOAD_MORE_FAILURE:", e);
      } finally {
          setLoadingMore(false);
      }
  };

  useEffect(() => {
    fetchClaims(false, true);
    intervalRef.current = setInterval(() => fetchClaims(true, false), 25000); 
    return () => clearInterval(intervalRef.current);
  }, []);

  // Infinite Scroll Observer
  useEffect(() => {
      const observer = new IntersectionObserver(
          entries => {
              if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && debouncedTerm.trim().length === 0) {
                  fetchMore();
              }
          },
          { threshold: 0.1 }
      );

      if (observerTarget.current) {
          observer.observe(observerTarget.current);
      }

      return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, offset]);

  const filteredClaims = claims.filter(c => {
      const predicateLower = (c.predicate || '').toLowerCase();
      if (filter === 'TRUST' && !predicateLower.includes('trust')) return false;
      if (filter === 'DISTRUST' && !predicateLower.includes('distrust')) return false;
      
      if (debouncedTerm) {
          const term = debouncedTerm.toLowerCase().trim();
          return (c.subject?.label || '').toLowerCase().includes(term) || 
                 (c.object?.label || '').toLowerCase().includes(term) ||
                 (c.reason || '').toLowerCase().includes(term);
      }
      return true;
  });

  return (
    <div className="w-full">
      {/* --- Filter Control --- */}
      <div className="bg-[#0a0f1a] border border-white/10 p-2 mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 clip-path-slant shadow-xl relative overflow-hidden group">
         <div className="absolute inset-0 bg-gradient-to-r from-intuition-primary/5 via-transparent to-transparent opacity-30"></div>

         <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full lg:w-auto relative z-10">
             <div className="relative group w-full md:w-56">
                 <input 
                    type="text" 
                    placeholder="QUERY_SIGNAL..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onMouseEnter={playHover}
                    className="bg-black border border-slate-800 hover:border-intuition-primary/30 focus:border-intuition-primary pl-8 pr-3 py-1.5 text-[9px] font-black font-mono text-white outline-none w-full transition-all uppercase tracking-widest clip-path-slant"
                 />
                 <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-intuition-primary transition-colors" />
             </div>
             
             <div className="flex items-center gap-4 px-4 border-l border-white/10 h-6">
                 <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 leading-none">
                        <Terminal size={8} className="text-slate-700" />
                        <span className="text-[6px] font-black font-mono text-slate-600 uppercase tracking-widest">Feed_Sync</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-intuition-primary animate-ping' : 'bg-intuition-success'} shadow-[0_0_5px_currentColor]`}></div>
                        <span className="text-[9px] font-black font-mono text-white">
                            {lastUpdated?.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}) || '--:--:--'}
                        </span>
                    </div>
                 </div>
                 <button 
                    onClick={() => { playClick(); fetchClaims(false, true); }}
                    onMouseEnter={playHover}
                    className="p-1.5 bg-white/5 border border-white/10 text-slate-500 hover:text-intuition-primary hover:border-intuition-primary transition-all rounded-sm"
                 >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                 </button>
             </div>
         </div>

         {/* Compact Filtering Control */}
         <div className="flex items-center gap-1 p-1 bg-black border border-white/5 clip-path-slant w-full sm:w-auto relative z-10">
             {[
                 { id: 'ALL', label: 'GLOBAL', icon: Database },
                 { id: 'TRUST', label: 'BULLISH', icon: SignalHigh },
                 { id: 'DISTRUST', label: 'BEARISH', icon: ShieldAlert }
             ].map((t) => (
                 <button 
                    key={t.id}
                    onClick={() => { playClick(); setFilter(t.id as any); }} 
                    onMouseEnter={playHover}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-black font-display transition-all clip-path-slant uppercase tracking-widest relative overflow-hidden ${filter === t.id ? 'bg-intuition-primary text-black' : 'text-slate-600 hover:text-white hover:bg-white/5'}`}
                 >
                    <t.icon size={10} className={filter === t.id ? 'animate-pulse' : ''} />
                    {t.label}
                 </button>
             ))}
         </div>
      </div>

      {/* --- Semantic Stream Layout --- */}
      <div className="relative min-h-[400px]">
         {loading && claims.length === 0 ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-intuition-primary z-50">
                 <div className="relative mb-6">
                     <div className="w-16 h-16 border-2 border-intuition-primary/10 border-t-intuition-primary rounded-full animate-spin"></div>
                     <div className="absolute inset-0 flex items-center justify-center">
                        <Activity size={20} className="animate-pulse" />
                     </div>
                 </div>
                 <span className="font-mono text-[7px] animate-pulse tracking-[0.8em] uppercase font-black text-intuition-primary/40">Decrypting_Reputation_Nodes...</span>
             </div>
         ) : filteredClaims.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-900 text-slate-700 font-mono text-[8px] bg-black/20 clip-path-slant">
                 <Terminal size={30} className="mb-4 opacity-10 animate-bounce" />
                 <div className="tracking-[0.4em] uppercase font-black text-slate-600">NULL_SIGNAL_RECOVERED</div>
             </div>
         ) : (
             <div className="space-y-1.5 pb-24" style={{ overflowAnchor: 'none' }}>
                 <div className="flex items-center justify-between px-4 py-1.5 bg-intuition-primary/5 border-l-2 border-intuition-primary mb-4 clip-path-slant">
                    <div className="flex items-center gap-2">
                        <Activity size={10} className="text-intuition-primary animate-pulse" />
                        <span className="text-[8px] font-black font-mono text-white uppercase tracking-widest">Signal_Relay_Active</span>
                    </div>
                    <span className="text-[7px] font-mono text-slate-600 uppercase">Buffer: {filteredClaims.length} Triples</span>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-0.5">
                     {filteredClaims.map((claim) => (
                        <div 
                            key={claim.id} 
                            className="animate-in fade-in slide-in-from-right-1 duration-200"
                        >
                            <ClaimCard claim={claim} />
                        </div>
                     ))}
                 </div>

                 {/* INFINITE SCROLL SENTINEL */}
                 <div ref={observerTarget} className="h-24 flex items-center justify-center mt-6 w-full">
                    {loadingMore && (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 size={24} className="text-intuition-primary animate-spin" />
                            <span className="text-[7px] font-black font-mono text-intuition-primary tracking-[0.4em] uppercase">SYNCING_DEEP_BUFFER...</span>
                        </div>
                    )}
                    {!hasMore && !loading && (
                        <span className="text-[6px] font-black font-mono text-slate-800 uppercase tracking-[1em]">END_OF_SIGNAL_STREAM</span>
                    )}
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};

export default ClaimFeed;
