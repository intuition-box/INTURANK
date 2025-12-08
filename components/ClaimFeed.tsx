import React, { useEffect, useState, useRef } from 'react';
import { Activity, RefreshCw, Filter, Search, Loader2 } from 'lucide-react';
import { getGlobalClaims } from '../services/graphql';
import { Claim } from '../types';
import ClaimCard from './ClaimCard';
import { playClick } from '../services/audio';

const ClaimFeed: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'TRUST' | 'DISTRUST'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<any>(null);

  const fetchClaims = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const data = await getGlobalClaims();
      // Simple dedupe based on ID
      setClaims(prev => {
          const combined = [...data, ...prev];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          // Sort desc by block, then timestamp if block missing
          return unique.sort((a, b) => {
              const blockDiff = (b.block || 0) - (a.block || 0);
              if (blockDiff !== 0) return blockDiff;
              return (b.timestamp || 0) - (a.timestamp || 0);
          }).slice(0, 100);
      });
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
    if (autoRefresh) {
        intervalRef.current = setInterval(() => fetchClaims(true), 10000); // Poll every 10s
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh]);

  const filteredClaims = claims.filter(c => {
      if (filter !== 'ALL' && c.predicate !== filter) return false;
      if (searchTerm) {
          const term = searchTerm.toLowerCase();
          return c.subject.label.toLowerCase().includes(term) || 
                 c.object.label.toLowerCase().includes(term) ||
                 (c.reason && c.reason.toLowerCase().includes(term));
      }
      return true;
  });

  return (
    <div className="w-full">
      {/* Feed Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6 bg-black border border-intuition-border p-4 clip-path-slant">
         <div className="flex items-center gap-4">
             <div className="relative">
                 <input 
                    type="text" 
                    placeholder="SEARCH_FEED..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-900 border border-slate-700 pl-8 pr-4 py-2 text-xs font-mono text-white focus:border-intuition-primary outline-none w-full sm:w-48"
                 />
                 <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
             </div>
             
             <div className="flex items-center gap-2">
                 <button 
                    onClick={() => { playClick(); setAutoRefresh(!autoRefresh); }}
                    className={`p-2 border ${autoRefresh ? 'border-intuition-success text-intuition-success bg-intuition-success/10' : 'border-slate-700 text-slate-500'} hover:text-white transition-colors`}
                    title={autoRefresh ? "Pause Auto-Refresh" : "Enable Auto-Refresh"}
                 >
                    <RefreshCw size={14} className={autoRefresh ? 'animate-spin-slow' : ''} />
                 </button>
                 {lastUpdated && (
                     <span className="text-[10px] font-mono text-slate-500 hidden sm:inline-block">
                         LAST SYNC: {lastUpdated.toLocaleTimeString()}
                     </span>
                 )}
             </div>
         </div>

         <div className="flex gap-2">
             <button onClick={() => { playClick(); setFilter('ALL'); }} className={`px-3 py-1 text-[10px] font-bold font-mono border ${filter === 'ALL' ? 'bg-intuition-primary text-black border-intuition-primary' : 'border-slate-800 text-slate-500 hover:text-white'}`}>ALL</button>
             <button onClick={() => { playClick(); setFilter('TRUST'); }} className={`px-3 py-1 text-[10px] font-bold font-mono border ${filter === 'TRUST' ? 'bg-intuition-success/20 text-intuition-success border-intuition-success' : 'border-slate-800 text-slate-500 hover:text-white'}`}>TRUST</button>
             <button onClick={() => { playClick(); setFilter('DISTRUST'); }} className={`px-3 py-1 text-[10px] font-bold font-mono border ${filter === 'DISTRUST' ? 'bg-intuition-danger/20 text-intuition-danger border-intuition-danger' : 'border-slate-800 text-slate-500 hover:text-white'}`}>DISTRUST</button>
         </div>
      </div>

      {/* Feed List */}
      <div className="space-y-3 relative min-h-[400px]">
         {loading && claims.length === 0 ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-intuition-primary">
                 <Loader2 size={32} className="animate-spin mb-4" />
                 <span className="font-mono text-xs animate-pulse">SYNCING_SEMANTIC_LAYER...</span>
             </div>
         ) : filteredClaims.length === 0 ? (
             <div className="text-center py-20 border border-dashed border-intuition-border text-slate-500 font-mono text-xs">
                 NO_CLAIMS_FOUND_IN_SECTOR
             </div>
         ) : (
             filteredClaims.map((claim) => (
                 <div key={claim.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                     <ClaimCard claim={claim} />
                 </div>
             ))
         )}
      </div>
    </div>
  );
};

export default ClaimFeed;