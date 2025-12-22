import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Activity, RefreshCw, Search, Terminal, Database, ShieldAlert, SignalHigh, Loader2 } from 'lucide-react';
import { getGlobalClaims } from '../services/graphql';
import { Claim } from '../types';
import ClaimCard from './ClaimCard';
import { playClick, playHover } from '../services/audio';

const ClaimFeed: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'TRUST' | 'DISTRUST'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sessionClaimCount, setSessionClaimCount] = useState(0);
  const intervalRef = useRef<any>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Search Debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchTerm]);

  const fetchClaims = useCallback(async (isBackground = false) => {
    if (isSyncing) return;
    if (!isBackground) setLoading(true);
    else setIsSyncing(true);

    try {
      const data = await getGlobalClaims();
      setClaims(prev => {
          const combined = [...data, ...prev];
          const uniqueMap = new Map();
          combined.forEach(item => uniqueMap.set(item.id, item));
          const uniqueArray = Array.from(uniqueMap.values()) as Claim[];
          const sorted = uniqueArray.sort((a, b) => {
              const blockDiff = (b.block || 0) - (a.block || 0);
              if (blockDiff !== 0) return blockDiff;
              return (b.timestamp || 0) - (a.timestamp || 0);
          }).slice(0, 100);
          
          if (prev.length > 0 && sorted.length > prev.length) {
              setSessionClaimCount(c => c + (sorted.length - prev.length));
          }
          
          return sorted;
      });
      setLastUpdated(new Date());
    } catch (e) {
      console.warn("[INTERNAL_LOG] FEED_SYNC_FAILURE:", e);
    } finally {
      if (!isBackground) setLoading(false);
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    fetchClaims();
    if (autoRefresh) {
        intervalRef.current = setInterval(() => fetchClaims(true), 25000); 
    }
    return () => clearInterval(intervalRef.current);
  }, [fetchClaims]);

  const [autoRefresh] = useState(true);

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
      {/* --- High Density Dashboard Filter Control --- */}
      <div className="bg-[#0a0f1a]/90 border border-white/10 p-2 mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 clip-path-slant shadow-xl relative overflow-hidden group">
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
                    onClick={() => { playClick(); fetchClaims(); }}
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
             <div className="space-y-1.5 pb-24">
                 <div className="flex items-center justify-between px-4 py-1.5 bg-intuition-primary/5 border-l-2 border-intuition-primary mb-4 clip-path-slant">
                    <div className="flex items-center gap-2">
                        <Activity size={10} className="text-intuition-primary animate-pulse" />
                        <span className="text-[8px] font-black font-mono text-white uppercase tracking-widest">Signal_Relay_Active</span>
                    </div>
                    <span className="text-[7px] font-mono text-slate-600 uppercase">Buffer: {filteredClaims.length} Triples</span>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-0.5">
                     {filteredClaims.map((claim, i) => (
                        <div 
                            key={claim.id} 
                            className="animate-in fade-in slide-in-from-right-2 duration-300 fill-mode-backwards"
                            style={{ animationDelay: `${Math.min(i * 15, 600)}ms` }}
                        >
                            <ClaimCard claim={claim} />
                        </div>
                     ))}
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};

export default ClaimFeed;