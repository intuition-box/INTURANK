import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Award, Zap, TrendingUp, Crown, AlertTriangle, RefreshCw, Users, Shield, Flame, Activity, Search, ArrowRight, Terminal, Loader2 } from 'lucide-react';
import { getTopPositions, getAllAgents } from '../services/graphql';
import { fetchAtomNameFromChain, resolveENS } from '../services/web3';
import { formatEther, isAddress } from 'viem';
import { playHover, playClick } from '../services/audio';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '../components/Toast';

type LeaderboardType = 'STAKERS' | 'AGENTS_SUPPORT' | 'AGENTS_CONTROVERSY';

interface LeaderboardEntry {
  rank: number;
  id: string;
  label: string;
  subLabel: string;
  value: string;
  rawValue: number;
  image?: string;
  trend?: 'up' | 'down' | 'flat';
}

const Stats: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LeaderboardType>('STAKERS');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // --- NAME RESOLUTION EFFECT ---
  useEffect(() => {
      if (loading || data.length === 0) return;

      const resolveUnknowns = async () => {
          let hasUpdates = false;
          const updatedData = [...data];

          // Only check top 20 to avoid spamming RPC
          const topItems = updatedData.slice(0, 20);
          
          for (let i = 0; i < topItems.length; i++) {
              const item = topItems[i];
              if (item.label.startsWith('Agent 0x')) {
                  const realName = await fetchAtomNameFromChain(item.id);
                  if (realName && realName !== item.label) {
                      updatedData[i] = { ...item, label: realName };
                      hasUpdates = true;
                  }
              }
          }

          if (hasUpdates) {
              setData(updatedData);
          }
      };

      resolveUnknowns();
  }, [data, loading]);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    setData([]);

    try {
      if (activeTab === 'STAKERS') {
        // Fetch User Positions
        const positions = await getTopPositions();
        const userMap = new Map<string, number>();
        const userMeta = new Map<string, any>();

        positions.forEach((pos: any) => {
            const accId = pos.account?.id;
            if (!accId) return;
            
            const shares = parseFloat(formatEther(BigInt(pos.shares || '0')));
            const currentVal = userMap.get(accId) || 0;
            userMap.set(accId, currentVal + shares);
            
            if (!userMeta.has(accId)) {
                userMeta.set(accId, { 
                    label: pos.account.label || `Trader ${accId.slice(2,6)}`, 
                    image: pos.account.image 
                });
            }
        });

        const sorted = Array.from(userMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([id, val], idx) => ({
                rank: idx + 1,
                id: id,
                label: userMeta.get(id).label,
                subLabel: id,
                value: val.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                rawValue: val,
                image: userMeta.get(id).image
            }));
        setData(sorted);

      } else if (activeTab === 'AGENTS_SUPPORT') {
        // Fetch Agents by TVL
        const agents = await getAllAgents();
        const sorted = agents
            .sort((a, b) => {
                const valA = parseFloat(formatEther(BigInt(a.totalAssets || '0')));
                const valB = parseFloat(formatEther(BigInt(b.totalAssets || '0')));
                return valB - valA;
            })
            .slice(0, 50)
            .map((a, idx) => ({
                rank: idx + 1,
                id: a.id,
                label: a.label || 'Unknown Agent',
                subLabel: a.type || 'Atom',
                value: parseFloat(formatEther(BigInt(a.totalAssets || '0'))).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' TRUST',
                rawValue: parseFloat(formatEther(BigInt(a.totalAssets || '0'))),
                image: a.image
            }));
        setData(sorted);

      } else if (activeTab === 'AGENTS_CONTROVERSY') {
        // Mock Controversy
        const agents = await getAllAgents();
        const sorted = agents
            .map(a => {
                const assets = parseFloat(formatEther(BigInt(a.totalAssets || '0')));
                // Random volatility heuristic
                const heuristic = assets * (Math.random() * 0.5 + 0.5); 
                return { ...a, heuristic };
            })
            .sort((a, b) => b.heuristic - a.heuristic)
            .slice(0, 50)
            .map((a, idx) => ({
                rank: idx + 1,
                id: a.id,
                label: a.label || 'Unknown Agent',
                subLabel: 'High Volatility',
                value: 'Score: ' + a.heuristic.toFixed(0),
                rawValue: a.heuristic,
                image: a.image
            }));
        setData(sorted);
      }
    } catch (e) {
        console.error(e);
        setError(true);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleSearch = async () => {
      const query = searchQuery.trim();
      if (!query) return;

      if (isAddress(query)) {
          playClick();
          navigate(`/profile/${query}`);
          return;
      }

      if (query.endsWith('.eth')) {
          playClick();
          setIsResolving(true);
          try {
              const address = await resolveENS(query);
              if (address) {
                  navigate(`/profile/${address}`);
              } else {
                  toast.error(`ENS IDENTITY NOT FOUND: ${query}`);
              }
          } catch (e) {
              toast.error("ENS RESOLUTION FAILED");
          } finally {
              setIsResolving(false);
          }
      } else {
          toast.error("INVALID WALLET OR ENS");
      }
  };

  return (
    <div className="min-h-screen bg-[#050b14] pt-24 pb-20 relative overflow-visible font-mono">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
      
      <div className="w-full max-w-5xl mx-auto px-4 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 font-display uppercase tracking-tight mb-4">
            Leaderboards
          </h1>
          <p className="text-intuition-primary font-mono text-sm tracking-widest uppercase flex items-center justify-center gap-2">
            <Trophy size={14} /> Competition drives Intelligence
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
            <button 
                onClick={() => { playClick(); setActiveTab('STAKERS'); setSearchQuery(''); }}
                className={`px-6 py-3 border clip-path-slant font-bold font-display text-sm tracking-wider transition-all hover:-translate-y-1 ${activeTab === 'STAKERS' ? 'bg-intuition-primary text-black border-intuition-primary shadow-[0_0_20px_rgba(0,243,255,0.4)]' : 'bg-black text-slate-500 border-slate-800 hover:text-white hover:border-intuition-primary/50'}`}
            >
                <div className="flex items-center gap-2"><Users size={16} /> TOP STAKERS</div>
            </button>
            <button 
                onClick={() => { playClick(); setActiveTab('AGENTS_SUPPORT'); setSearchQuery(''); }}
                className={`px-6 py-3 border clip-path-slant font-bold font-display text-sm tracking-wider transition-all hover:-translate-y-1 ${activeTab === 'AGENTS_SUPPORT' ? 'bg-intuition-success text-black border-intuition-success shadow-[0_0_20px_rgba(0,255,157,0.4)]' : 'bg-black text-slate-500 border-slate-800 hover:text-white hover:border-intuition-success/50'}`}
            >
                <div className="flex items-center gap-2"><Shield size={16} /> MOST SUPPORTED</div>
            </button>
            <button 
                onClick={() => { playClick(); setActiveTab('AGENTS_CONTROVERSY'); setSearchQuery(''); }}
                className={`px-6 py-3 border clip-path-slant font-bold font-display text-sm tracking-wider transition-all hover:-translate-y-1 ${activeTab === 'AGENTS_CONTROVERSY' ? 'bg-intuition-danger text-black border-intuition-danger shadow-[0_0_20px_rgba(255,0,85,0.4)]' : 'bg-black text-slate-500 border-slate-800 hover:text-white hover:border-intuition-danger/50'}`}
            >
                <div className="flex items-center gap-2"><Flame size={16} /> CONTROVERSIAL</div>
            </button>
        </div>

        {/* SEARCH BAR FOR STAKERS - HIGH VISIBILITY UPGRADE */}
        {activeTab === 'STAKERS' && (
            <div className="max-w-2xl mx-auto mb-8 mt-4 relative z-20 group">
                
                {/* Decorative Brackets - Making it look locked in */}
                <div className="absolute -left-3 top-0 bottom-0 w-3 border-l-2 border-t-2 border-b-2 border-intuition-primary/50 rounded-l-md pointer-events-none group-focus-within:border-intuition-primary transition-colors"></div>
                <div className="absolute -right-3 top-0 bottom-0 w-3 border-r-2 border-t-2 border-b-2 border-intuition-primary/50 rounded-r-md pointer-events-none group-focus-within:border-intuition-primary transition-colors"></div>

                <div className="bg-black/90 border border-intuition-primary/30 p-1 clip-path-slant shadow-[0_0_30px_rgba(0,243,255,0.15)] focus-within:shadow-[0_0_50px_rgba(0,243,255,0.3)] focus-within:border-intuition-primary transition-all duration-300">
                    <div className="flex items-center gap-0">
                        {/* Terminal Box */}
                        <div className="bg-intuition-primary/10 h-12 flex items-center px-4 border-r border-intuition-primary/30">
                            <Terminal size={20} className="text-intuition-primary animate-pulse" />
                        </div>
                        
                        {/* Input Field */}
                        <div className="flex-1 relative">
                            <input 
                                type="text" 
                                placeholder="ENTER WALLET (0x...) OR ENS (.eth)" 
                                className="w-full h-12 bg-transparent text-white font-mono text-sm px-4 outline-none placeholder-intuition-primary/40 uppercase tracking-widest focus:placeholder-intuition-primary/60 transition-colors"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                disabled={isResolving}
                            />
                        </div>

                        {/* Action Button */}
                        <button 
                            onClick={handleSearch}
                            disabled={isResolving || (!isAddress(searchQuery.trim()) && !searchQuery.trim().endsWith('.eth'))}
                            className={`h-12 px-6 font-black font-display text-xs tracking-widest flex items-center justify-center gap-2 transition-colors ${
                                (isAddress(searchQuery.trim()) || searchQuery.trim().endsWith('.eth'))
                                ? 'bg-intuition-primary text-black hover:bg-white cursor-pointer' 
                                : 'bg-transparent text-intuition-primary/40 cursor-not-allowed border-l border-intuition-primary/10'
                            }`}
                        >
                            {isResolving ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                (isAddress(searchQuery.trim()) || searchQuery.trim().endsWith('.eth')) ? 
                                <>INITIATE <ArrowRight size={14} /></> : 
                                <Search size={20} />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Content Area */}
        {loading ? (
           <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-16 h-16 border-4 border-intuition-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="text-intuition-primary font-bold text-xl animate-pulse font-display tracking-widest">CALCULATING RANKINGS...</div>
           </div>
        ) : error ? (
           <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <AlertTriangle className="text-intuition-danger" size={48} />
              <div className="text-intuition-danger font-bold text-xl">DATA UPLINK FAILED</div>
              <button onClick={fetchData} className="px-4 py-2 border border-intuition-danger text-intuition-danger hover:bg-intuition-danger hover:text-black transition-colors font-mono uppercase text-xs flex items-center gap-2">
                 <RefreshCw size={14} /> Retry
              </button>
           </div>
        ) : data.length === 0 ? (
           <div className="text-center py-20 text-slate-500 font-mono border border-dashed border-slate-800 bg-black/50">
              NO DATA FOUND FOR THIS CATEGORY.
           </div>
        ) : (
          <div className="space-y-4">
             {/* Top 3 Special Display */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-12">
                {[1, 0, 2].map(orderIdx => {
                    const item = data[orderIdx];
                    if (!item) return null;
                    const isFirst = orderIdx === 0;
                    
                    return (
                        <div key={item.id} className={`${isFirst ? '-mt-8 md:-mt-12 z-10' : ''} transform transition-all hover:scale-105`}>
                            <div className={`relative bg-black border p-6 flex flex-col items-center clip-path-slant h-full group ${
                                isFirst 
                                ? 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.2)]' 
                                : orderIdx === 1 
                                    ? 'border-slate-400' 
                                    : 'border-orange-700'
                            }`}>
                                <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center font-black font-display rounded-full border bg-black ${
                                    isFirst ? 'text-yellow-500 border-yellow-500' : orderIdx === 1 ? 'text-slate-400 border-slate-400' : 'text-orange-700 border-orange-700'
                                }`}>
                                    {orderIdx + 1}
                                </div>
                                
                                <div className="w-20 h-20 mb-4 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-intuition-primary transition-colors bg-slate-900 flex items-center justify-center text-2xl">
                                    {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : (activeTab === 'STAKERS' ? '👤' : '🛡️')}
                                </div>
                                
                                <h3 className="font-bold text-white text-lg truncate max-w-full mb-1">{item.label}</h3>
                                <p className="text-xs text-slate-500 font-mono mb-4">{item.subLabel.slice(0,10)}...</p>
                                
                                <div className={`mt-auto font-black font-display text-xl ${isFirst ? 'text-yellow-500' : 'text-slate-300'}`}>
                                    {item.value}
                                </div>
                                
                                {/* Link to Profile for Stakers, Market for Agents */}
                                <Link 
                                    to={activeTab === 'STAKERS' ? `/profile/${item.id}` : `/markets/${item.id}`} 
                                    className="absolute inset-0" 
                                    onClick={playClick} 
                                />
                            </div>
                        </div>
                    );
                })}
             </div>

             {/* The List (Rank 4+) */}
             <div className="bg-black border border-intuition-border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-intuition-card text-xs font-mono text-slate-500 uppercase tracking-wider border-b border-intuition-border">
                        <tr>
                            <th className="px-6 py-4 w-16 text-center">#</th>
                            <th className="px-6 py-4">Entity</th>
                            <th className="px-6 py-4 text-right">Metric</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.slice(3).map((item) => (
                            <tr key={item.id} className="hover:bg-intuition-primary/5 transition-colors group relative">
                                <td className="px-6 py-4 text-center font-mono text-slate-500 font-bold">{item.rank}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xs overflow-hidden">
                                            {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : (activeTab === 'STAKERS' ? '👤' : '🛡️')}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-200 group-hover:text-intuition-primary transition-colors">{item.label}</div>
                                            <div className="text-[10px] text-slate-600 font-mono uppercase">{item.subLabel}</div>
                                        </div>
                                    </div>
                                    <Link 
                                        to={activeTab === 'STAKERS' ? `/profile/${item.id}` : `/markets/${item.id}`} 
                                        className="absolute inset-0" 
                                        onClick={playClick} 
                                    />
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-intuition-secondary">
                                    {item.value}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;