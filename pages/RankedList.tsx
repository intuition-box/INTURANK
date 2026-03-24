/**
 * IntuRank Gamification — Climb the ranks / Featured Hub
 * Reimagined as a hub for playing and climbing leaderboards across categories.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import {
  Trophy,
  Flame,
  LineChart,
  Gamepad2,
  TrendingUp,
  RefreshCw,
  Search,
  Star,
  Users,
  X,
  Plus,
} from 'lucide-react';
import { getTriplesWithPositions, resolveMetadata, getHoldersForVault } from '../services/graphql';
import { playClick, playHover } from '../services/audio';
import { formatMarketValue, safeWeiToEther } from '../services/analytics';
import { CURRENCY_SYMBOL } from '../constants';
import { toast } from '../components/Toast';
import CreateModal from '../components/CreateModal';

type CategoryTab = 'head-to-head' | 'hot-takes' | 'prediction-markets';

interface MarketEntry {
  id: string;
  counterTermId?: string;
  label: string;
  image?: string;
  subjectLabel: string;
  predicateLabel: string;
  objectLabel: string;
  totalAssets: string;
  positionCount: number;
}

const RankedList: React.FC = () => {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<CategoryTab>('head-to-head');
  const [markets, setMarkets] = useState<MarketEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<MarketEntry | null>(null);
  const [marketHolders, setMarketHolders] = useState<any[]>([]);
  const [loadingHolders, setLoadingHolders] = useState(false);

  const handleMarketClick = async (m: MarketEntry) => {
    playClick();
    setSelectedMarket(m);
    setLoadingHolders(true);
    try {
       const { holders } = await getHoldersForVault(m.id);
       setMarketHolders(holders);
    } catch (err) {
       console.error(err);
    } finally {
       setLoadingHolders(false);
    }
  };

  const fetchMarkets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch using the provided query
      // In a real app, you might apply different `where` clauses based on `activeTab`
      // For this demo, we'll fetch top triples and simulate categories if needed, 
      // or just show the same data structure as requested.
      
      let orderBy: any = [{ created_at: 'desc' }];
      let where: any = {};
      
      if (activeTab === 'hot-takes') {
        orderBy = [{ positions_aggregate: { count: 'desc' } }, { created_at: 'desc' }];
      } else if (activeTab === 'prediction-markets') {
        where = { predicate: { label: { _ilike: "%predict%" } } };
      } else if (activeTab === 'head-to-head') {
        where = { predicate: { label: { _ilike: "%vs%" } } };
      }

      const triples = await getTriplesWithPositions(20, 0, orderBy, where, address);
      
      const formattedMarkets: MarketEntry[] = triples.map((t: any) => {
        const sMeta = resolveMetadata(t.subject);
        const oMeta = resolveMetadata(t.object);
        const label = `${sMeta.label} ${t.predicate?.label || 'LINK'} ${oMeta.label}`;
        
        // Find the specific vault (e.g., curve 1)
        const vault = t.term?.vaults?.[0]; 
        const assets = vault?.total_assets || '0';
        const pCount = vault?.position_count || t.positions_aggregate?.aggregate?.count || 0;

        return {
          id: t.term_id,
          counterTermId: t.counter_term_id,
          label,
          image: t.subject?.image || t.object?.image,
          subjectLabel: sMeta.label,
          predicateLabel: t.predicate?.label || 'LINK',
          objectLabel: oMeta.label,
          totalAssets: assets,
          positionCount: pCount
        };
      });

      if (activeTab === 'head-to-head') {
        formattedMarkets.sort((a, b) => Number(BigInt(b.totalAssets) - BigInt(a.totalAssets)));
      }

      setMarkets(formattedMarkets);

    } catch (err) {
      console.error("Failed to fetch markets:", err);
      toast.error("Failed to load arenas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, address]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const tabs: { id: CategoryTab; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'head-to-head', label: 'Head to Head Battles', icon: <Gamepad2 size={18} />, desc: 'Compare options and vote' },
    { id: 'hot-takes', label: 'Hot Takes', icon: <Flame size={18} />, desc: 'Trending claims with high activity' },
    { id: 'prediction-markets', label: 'Prediction Markets', icon: <LineChart size={18} />, desc: 'Speculate on future outcomes' },
  ];

  return (
    <div className="min-h-screen bg-[#020308] w-full min-w-0 overflow-x-hidden pb-32 font-sans text-slate-300">
      
      {/* Top Banner / Title Area */}
      <div className="w-full bg-[#050811] border-b border-slate-800 pt-10 pb-6 px-6 relative overflow-hidden">
         <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none"></div>
         <div className="absolute right-0 top-0 w-96 h-96 bg-intuition-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
         
         <div className="max-w-[1600px] mx-auto relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Gamepad2 size={16} className="text-intuition-primary animate-pulse" />
                <div className="text-[10px] font-black font-mono tracking-[0.2em] uppercase text-intuition-primary/80">Play & Climb</div>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white font-display uppercase tracking-tighter">
                The Arena Hub
              </h1>
              <p className="mt-2 text-sm text-slate-400 max-w-xl leading-relaxed">
                Discover trending claims, back your convictions, and climb the leaderboards. Stake atoms to build your power level and dominate the rankings.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search arenas..." 
                  className="bg-[#090C15] border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-intuition-primary/50 w-64 transition-colors"
                />
              </div>
              <button
                onClick={() => { playClick(); fetchMarkets(true); }}
                disabled={refreshing}
                className="h-[42px] px-4 rounded-xl bg-[#090C15] border border-slate-700 text-white hover:border-intuition-primary/50 transition-all flex items-center justify-center disabled:opacity-50"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin text-intuition-primary' : ''} />
              </button>
            </div>
         </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Navigation Sidebar */}
        <div className="lg:w-64 shrink-0">
          <div className="sticky top-24 space-y-2">
            <h3 className="text-[10px] font-black font-mono uppercase tracking-widest text-slate-500 mb-4 px-3">Categories</h3>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { playClick(); setActiveTab(tab.id); }}
                onMouseEnter={playHover}
                className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl transition-all text-left ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-intuition-primary/10 to-[#050811] border border-intuition-primary/30 shadow-[0_0_15px_rgba(0,243,255,0.05)]' 
                    : 'hover:bg-[#050811] border border-transparent'
                }`}
              >
                <div className={`mt-0.5 ${activeTab === tab.id ? 'text-intuition-primary' : 'text-slate-500'}`}>
                  {tab.icon}
                </div>
                <div>
                  <div className={`text-sm font-bold ${activeTab === tab.id ? 'text-white' : 'text-slate-300'}`}>
                    {tab.label}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                    {tab.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {tabs.find(t => t.id === activeTab)?.icon}
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-xs text-slate-500 font-mono hidden sm:block">
                {markets.length} Arenas Active
              </div>
              <button 
                onClick={() => { playClick(); setIsCreateModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-intuition-primary/10 text-intuition-primary border border-intuition-primary/30 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-intuition-primary hover:text-black transition-all"
              >
                <Plus size={14} /> Add Claim
              </button>
            </div>
          </div>

          {loading && !refreshing ? (
            <div className="py-20 flex flex-col items-center justify-center border border-slate-800/50 rounded-2xl bg-[#050811]/50">
              <Loader2 className="w-8 h-8 text-intuition-primary animate-spin mb-4" />
              <div className="text-sm font-mono text-slate-400 uppercase tracking-widest">Loading Arenas...</div>
            </div>
          ) : markets.length === 0 ? (
             <div className="py-20 flex flex-col items-center justify-center border border-slate-800/50 rounded-2xl bg-[#050811]/50">
              <Trophy className="w-12 h-12 text-slate-600 mb-4" />
              <div className="text-white font-bold mb-2">No arenas found in this category</div>
              <div className="text-sm text-slate-500">Check back later or explore other categories.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {markets.map((m) => (
                <div 
                  key={m.id} 
                  onClick={() => handleMarketClick(m)}
                  className="group relative bg-[#090C15] border border-slate-800 rounded-2xl p-5 hover:border-intuition-primary/40 transition-all hover:shadow-[0_0_20px_rgba(0,243,255,0.05)] overflow-hidden flex flex-col h-full cursor-pointer"
                >
                  
                  {/* Card Header / Image */}
                  <div className="flex items-start gap-4 mb-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-[#050811] border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden group-hover:border-intuition-primary/30 transition-colors">
                      {m.image ? (
                        <img src={m.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-black text-slate-400">{m.subjectLabel.slice(0,2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h3 className="text-base font-bold text-white leading-tight mb-1 group-hover:text-intuition-primary transition-colors line-clamp-2">
                        {m.label}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                        <span className="bg-slate-800/50 px-2 py-0.5 rounded text-slate-300 truncate max-w-[100px]">{m.subjectLabel}</span>
                        <span>•</span>
                        <span className="text-indigo-400 truncate max-w-[80px]">{m.predicateLabel}</span>
                        <span>•</span>
                        <span className="bg-slate-800/50 px-2 py-0.5 rounded text-slate-300 truncate max-w-[100px]">{m.objectLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body / Stats */}
                  <div className="mt-auto pt-4 border-t border-slate-800/50 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-6">
                      <div>
                        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Power Level</div>
                        <div className="text-sm font-black text-white flex items-baseline gap-1">
                          {formatMarketValue(safeWeiToEther(m.totalAssets))}
                          <span className="text-[10px] text-intuition-primary">{CURRENCY_SYMBOL}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Contenders</div>
                        <div className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
                          <Users size={12} className="text-slate-500" />
                          {m.positionCount}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      className="px-4 py-2 bg-[#050811] group-hover:bg-intuition-primary group-hover:text-black border border-slate-700 group-hover:border-transparent rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                      <TrendingUp size={14} /> Details
                    </button>
                  </div>
                  
                  {/* Subtle Background Glow */}
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-intuition-primary/5 blur-3xl rounded-full group-hover:bg-intuition-primary/10 transition-colors pointer-events-none"></div>
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>

      {/* Drawer Overlay */}
      {selectedMarket && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedMarket(null)}>
          <div 
            className="w-full max-w-md bg-[#090C15] border-l border-slate-800 h-full overflow-y-auto animate-in slide-in-from-right duration-300 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <button onClick={() => setSelectedMarket(null)} className="mb-6 text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
              <h2 className="text-2xl font-bold text-white mb-2">{selectedMarket.label}</h2>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-8">
                 <span className="truncate max-w-[120px]">{selectedMarket.subjectLabel}</span>
                 <span>•</span>
                 <span className="text-intuition-primary truncate max-w-[100px]">{selectedMarket.predicateLabel}</span>
                 <span>•</span>
                 <span className="truncate max-w-[120px]">{selectedMarket.objectLabel}</span>
              </div>
              
              <div className="bg-[#050811] rounded-xl p-4 border border-slate-800 mb-8">
                 <div className="flex justify-between items-center mb-2">
                   <span className="text-slate-500 text-sm">Power Level</span>
                   <span className="text-white font-bold">{formatMarketValue(safeWeiToEther(selectedMarket.totalAssets))} {CURRENCY_SYMBOL}</span>
                 </div>
                 <div className="flex justify-between items-center mb-4">
                   <span className="text-slate-500 text-sm">Contenders</span>
                   <span className="text-white font-bold">{selectedMarket.positionCount}</span>
                 </div>
                 
                 <Link to={`/markets/${selectedMarket.id}`} className="block w-full text-center py-3 bg-intuition-primary text-black font-bold uppercase text-sm rounded-xl hover:bg-intuition-primary/90 transition-colors">
                   Trade Position
                 </Link>
              </div>

              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                 <Trophy size={18} className="text-yellow-500" />
                 Leaderboard
              </h3>
              
              {loadingHolders ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-intuition-primary animate-spin" />
                </div>
              ) : marketHolders.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No stakers yet. Be the first!
                </div>
              ) : (
                <div className="space-y-3">
                  {marketHolders.map((holder, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#050811] border border-slate-800/50">
                       <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' : idx === 1 ? 'bg-slate-300/20 text-slate-300' : idx === 2 ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-800 text-slate-400'}`}>
                             {idx + 1}
                          </div>
                          <div>
                             <div className="text-sm font-bold text-white">
                               {holder.account?.label || `${holder.account?.id.slice(0,6)}...`}
                             </div>
                          </div>
                       </div>
                       <div className="text-sm text-intuition-primary font-mono">
                          {formatMarketValue(safeWeiToEther(holder.shares))} shares
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <CreateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
};

// Simple internal Loader to avoid import issues if not available
const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
  </svg>
);

export default RankedList;