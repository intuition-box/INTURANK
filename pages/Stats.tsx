
import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Award, Zap, TrendingUp, Crown, AlertTriangle, RefreshCw, Users, Shield, Flame, Activity, Search, ArrowRight, Terminal, Loader2, ArrowRightCircle } from 'lucide-react';
import { getTopPositions, getAllAgents, getTopClaims } from '../services/graphql';
import { fetchAtomNameFromChain, resolveENS } from '../services/web3';
import { formatEther, isAddress } from 'viem';
import { playHover, playClick } from '../services/audio';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '../components/Toast';

type LeaderboardType = 'STAKERS' | 'AGENTS_SUPPORT' | 'AGENTS_CONTROVERSY' | 'CLAIMS';

interface LeaderboardEntry {
  rank: number;
  id: string;
  label: string;
  subLabel: string;
  value: string;
  rawValue: number;
  image?: string;
  trend?: 'up' | 'down' | 'flat';
  subject?: any;
  predicate?: string;
  object?: any;
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
      if (loading || data.length === 0 || activeTab === 'CLAIMS') return;

      const resolveUnknowns = async () => {
          let hasUpdates = false;
          const updatedData = [...data];
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
  }, [data, loading, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    setData([]);

    try {
      if (activeTab === 'STAKERS') {
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
                userMeta.set(accId, { label: pos.account.label || `Trader ${accId.slice(2,6)}`, image: pos.account.image });
            }
        });

        const sorted = Array.from(userMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 100).map(([id, val], idx) => ({
            rank: idx + 1,
            id: id,
            label: userMeta.get(id).label,
            subLabel: 'STAKED_CONVICTION',
            value: val.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' TRUST',
            rawValue: val,
            image: userMeta.get(id).image
        }));
        setData(sorted);

      } else if (activeTab === 'AGENTS_SUPPORT') {
        const agents = await getAllAgents();
        const sorted = agents.sort((a, b) => {
            const valA = parseFloat(formatEther(BigInt(a.totalAssets || '0')));
            const valB = parseFloat(formatEther(BigInt(b.totalAssets || '0')));
            return valB - valA;
        }).slice(0, 100).map((a, idx) => ({
            rank: idx + 1,
            id: a.id,
            label: a.label || 'Unknown Agent',
            subLabel: 'TOTAL_PROTOCOL_VOLUME',
            value: parseFloat(formatEther(BigInt(a.totalAssets || '0'))).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' TRUST',
            rawValue: parseFloat(formatEther(BigInt(a.totalAssets || '0'))),
            image: a.image
        }));
        setData(sorted);

      } else if (activeTab === 'AGENTS_CONTROVERSY') {
        const agents = await getAllAgents();
        const sorted = agents.map(a => {
            const assets = parseFloat(formatEther(BigInt(a.totalAssets || '0')));
            const shares = parseFloat(formatEther(BigInt(a.totalShares || '0')));
            // Controversy Score = Volatility Entropy Index
            // We measure the ratio of Volume to Liquidity Depth. 
            // High Volume with shallow liquidity = high price sensitivity = High Controversy.
            const volumeToDepth = shares > 0 ? (assets / shares) : 0;
            const entropyIndex = (Math.log10(volumeToDepth + 1) * 100) + (assets * 0.05);
            return { ...a, heuristic: entropyIndex };
        }).sort((a, b) => b.heuristic - a.heuristic).slice(0, 100).map((a, idx) => ({
            rank: idx + 1,
            id: a.id,
            label: a.label || 'Unknown Agent',
            subLabel: 'VOLATILITY_ENTROPY_INDEX',
            value: 'Score: ' + a.heuristic.toFixed(0),
            rawValue: a.heuristic,
            image: a.image
        }));
        setData(sorted);
        
      } else if (activeTab === 'CLAIMS') {
          const claims = await getTopClaims();
          const sorted = claims.slice(0, 100).map((c: any, idx: number) => ({
              rank: idx + 1,
              id: c.id,
              label: '', 
              subLabel: 'SEMANTIC_LINK_WEIGHT',
              value: parseFloat(formatEther(BigInt(c.value))).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' TRUST',
              rawValue: parseFloat(formatEther(BigInt(c.value))),
              subject: c.subject,
              predicate: c.predicate,
              object: c.object
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
      if (isAddress(query)) { playClick(); navigate(`/profile/${query}`); return; }
      if (query.endsWith('.eth')) {
          playClick();
          setIsResolving(true);
          try {
              const address = await resolveENS(query);
              if (address) navigate(`/profile/${address}`);
              else toast.error(`ENS IDENTITY NOT FOUND: ${query}`);
          } catch (e) { toast.error("ENS RESOLUTION FAILED"); } finally { setIsResolving(false); }
      } else { toast.error("INVALID WALLET OR ENS"); }
  };

  return (
    <div className="min-h-screen bg-[#02040a] pt-24 pb-20 relative overflow-hidden font-mono">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-intuition-primary/5 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
      
      <div className="w-full max-w-7xl mx-auto px-4 relative z-10">
        
        {/* Header with Glow */}
        <div className="text-center mb-12 relative">
          <div className="inline-block relative">
             <h1 className="text-5xl md:text-7xl font-black text-white font-display uppercase tracking-tight mb-2 text-glow relative z-10">
                Leaderboards
             </h1>
             <div className="absolute -inset-4 bg-intuition-primary/20 blur-xl opacity-50 z-0 rounded-full"></div>
          </div>
          <p className="text-intuition-primary font-mono text-sm tracking-[0.3em] uppercase flex items-center justify-center gap-2 text-glow opacity-80">
            <Trophy size={14} /> Competition drives Intelligence
          </p>
        </div>

        {/* Navigation Tabs - Cyber Deck Style */}
        <div className="flex flex-wrap justify-center gap-2 mb-12 bg-black/50 p-2 border border-white/5 rounded-lg backdrop-blur-sm relative z-50">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-intuition-primary/5 to-transparent pointer-events-none"></div>
            {[
                { id: 'STAKERS', icon: Users, label: 'TOP STAKERS', color: 'intuition-primary' },
                { id: 'AGENTS_SUPPORT', icon: Shield, label: 'MOST SUPPORTED', color: 'intuition-success' },
                { id: 'AGENTS_CONTROVERSY', icon: Flame, label: 'CONTROVERSIAL', color: 'intuition-danger' },
                { id: 'CLAIMS', icon: Activity, label: 'TOP CLAIMS', color: 'purple-500' }
            ].map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                // Dynamic class construction
                let styleClass = 'bg-transparent text-slate-500 border-transparent hover:text-white hover:bg-white/5';
                if (isActive) {
                    if (tab.id === 'STAKERS') styleClass = 'bg-intuition-primary text-black border-intuition-primary shadow-[0_0_20px_rgba(0,243,255,0.4)]';
                    if (tab.id === 'AGENTS_SUPPORT') styleClass = 'bg-intuition-success text-black border-intuition-success shadow-[0_0_20px_rgba(0,255,157,0.4)]';
                    if (tab.id === 'AGENTS_CONTROVERSY') styleClass = 'bg-intuition-danger text-black border-intuition-danger shadow-[0_0_20px_rgba(255,0,85,0.4)]';
                    if (tab.id === 'CLAIMS') styleClass = 'bg-purple-500 text-black border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]';
                }

                return (
                    <button 
                        key={tab.id}
                        onClick={() => { playClick(); setActiveTab(tab.id as any); setSearchQuery(''); }}
                        className={`px-6 py-3 border clip-path-slant font-bold font-display text-xs tracking-wider transition-all duration-300 hover:-translate-y-1 flex items-center gap-2 ${styleClass}`}
                    >
                        <Icon size={16} /> {tab.label}
                    </button>
                );
            })}
        </div>

        {/* SEARCH BAR - COMMAND LINE STYLE */}
        {activeTab === 'STAKERS' && (
            <div className="max-w-2xl mx-auto mb-16 relative z-20 group perspective-1000">
                <div className="bg-black border border-intuition-primary/50 p-1 clip-path-slant shadow-[0_0_40px_rgba(0,243,255,0.1)] group-hover:shadow-[0_0_60px_rgba(0,243,255,0.2)] transition-all duration-500 transform group-hover:scale-[1.01]">
                    <div className="flex items-center gap-0 bg-[#05080f]">
                        <div className="bg-intuition-primary/10 h-14 flex items-center px-5 border-r border-intuition-primary/30">
                            <Terminal size={20} className="text-intuition-primary animate-pulse" />
                        </div>
                        <div className="flex-1 relative">
                            <input 
                                type="text" 
                                placeholder="QUERY_DATABASE: [WALLET_ADDRESS | ENS_NAME]" 
                                className="w-full h-14 bg-transparent text-white font-mono text-sm px-6 outline-none placeholder-intuition-primary/30 uppercase tracking-widest"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                disabled={isResolving}
                            />
                        </div>
                        <button 
                            onClick={handleSearch}
                            disabled={isResolving || (!isAddress(searchQuery.trim()) && !searchQuery.trim().endsWith('.eth'))}
                            className={`h-14 px-8 font-black font-display text-sm tracking-widest flex items-center justify-center gap-2 transition-all duration-300 hover:tracking-[0.2em] ${
                                (isAddress(searchQuery.trim()) || searchQuery.trim().endsWith('.eth'))
                                ? 'bg-intuition-primary text-black hover:bg-white hover:shadow-[0_0_20px_white] cursor-pointer' 
                                : 'bg-transparent text-intuition-primary/40 cursor-not-allowed border-l border-intuition-primary/10'
                            }`}
                        >
                            {isResolving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Content Area */}
        {loading ? (
           <div className="flex flex-col items-center justify-center h-96 gap-6">
              <div className="relative">
                  <div className="w-20 h-20 border-4 border-intuition-primary/30 border-t-intuition-primary rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="text-intuition-primary animate-pulse" size={24}/></div>
              </div>
              <div className="text-intuition-primary font-bold text-xl animate-pulse font-display tracking-widest text-glow">COMPUTING GLOBAL RANKINGS...</div>
           </div>
        ) : error ? (
           <div className="flex flex-col items-center justify-center h-64 gap-4 text-center border border-intuition-danger/30 bg-intuition-danger/5 p-8 clip-path-slant">
              <AlertTriangle className="text-intuition-danger animate-bounce" size={48} />
              <div className="text-intuition-danger font-bold text-xl font-display">DATA UPLINK SEVERED</div>
              <button onClick={fetchData} className="px-6 py-2 bg-intuition-danger text-black font-bold hover:bg-white transition-colors font-mono uppercase text-xs flex items-center gap-2 clip-path-slant">
                 <RefreshCw size={14} /> RE-INITIALIZE
              </button>
           </div>
        ) : data.length === 0 ? (
           <div className="text-center py-24 text-slate-500 font-mono border border-dashed border-slate-800 bg-black/50 clip-path-slant">
              [NULL SET] NO DATA FOUND FOR THIS PARAMETER.
           </div>
        ) : activeTab === 'CLAIMS' ? (
            <div className="bg-black border border-intuition-border rounded-none overflow-hidden neon-panel shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <table className="w-full text-left">
                    <thead className="bg-intuition-card text-xs font-mono text-slate-500 uppercase tracking-wider border-b border-intuition-border">
                        <tr>
                            <th className="px-6 py-4 w-16 text-center">Rank</th>
                            <th className="px-6 py-4">Semantic Triple (Subject &rarr; Predicate &rarr; Object)</th>
                            <th className="px-6 py-4 text-right">Market Cap</th>
                            <th className="px-6 py-4 text-right">Protocol</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.map((item, i) => (
                            <tr key={item.id} className="hover:bg-white/5 transition-all group relative animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 50}ms` }}>
                                <td className="px-6 py-4 text-center font-mono text-slate-500 font-bold group-hover:text-intuition-primary transition-colors">#{item.rank}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col md:flex-row items-center gap-2">
                                        <div className="flex items-center gap-2 bg-slate-900/50 pr-3 rounded-full border border-slate-800 group-hover:border-slate-600 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-600">
                                                {item.subject?.image ? <img src={item.subject.image} className="w-full h-full object-cover" /> : <div className="text-[10px]">{item.subject?.label?.[0]}</div>}
                                            </div>
                                            <span className="font-bold text-white text-xs whitespace-nowrap max-w-[120px] truncate">{item.subject?.label}</span>
                                        </div>
                                        <div className="px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded text-[10px] font-bold uppercase whitespace-nowrap shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                                            {item.predicate || 'LINK'}
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-900/50 pr-3 rounded-full border border-slate-800 group-hover:border-slate-600 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-600">
                                                {item.object?.image ? <img src={item.object.image} className="w-full h-full object-cover" /> : <div className="text-[10px]">{item.object?.label?.[0]}</div>}
                                            </div>
                                            <span className="font-bold text-white text-xs whitespace-nowrap max-w-[120px] truncate">{item.object?.label}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="font-mono font-bold text-white text-glow group-hover:text-intuition-secondary transition-colors">{item.value}</div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Link to={`/markets/${item.id}`} className="inline-flex px-4 py-1.5 bg-intuition-primary/10 border border-intuition-primary/50 text-intuition-primary font-bold text-[10px] uppercase clip-path-slant hover:bg-intuition-primary hover:text-black hover:shadow-[0_0_15px_rgba(0,243,255,0.6)] transition-all">
                                        Trade
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
          <div className="space-y-4">
             {/* TOP 3 PODIUM - GLOW UP */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 mt-20 items-end">
                {[1, 0, 2].map(orderIdx => {
                    const item = data[orderIdx];
                    if (!item) return null;
                    const isFirst = orderIdx === 0;
                    
                    // Special Neon Styles for Top 3
                    let rankStyles = { border: '', shadow: '', text: '', glow: '', bg: '' };
                    
                    if (isFirst) { // GOLD
                        rankStyles = { 
                            border: 'border-yellow-500', 
                            shadow: 'shadow-[0_0_50px_rgba(234,179,8,0.4),inset_0_0_20px_rgba(234,179,8,0.2)]', 
                            text: 'text-yellow-400', 
                            glow: 'text-glow-gold', 
                            bg: 'bg-yellow-500/10'
                        };
                    } else if (orderIdx === 1) { // SILVER
                        rankStyles = { 
                            border: 'border-slate-300', 
                            shadow: 'shadow-[0_0_30px_rgba(203,213,225,0.3),inset_0_0_10px_rgba(203,213,225,0.1)]', 
                            text: 'text-slate-200', 
                            glow: 'text-shadow', 
                            bg: 'bg-slate-500/10'
                        };
                    } else { // BRONZE
                        rankStyles = { 
                            border: 'border-orange-600', 
                            shadow: 'shadow-[0_0_30px_rgba(234,88,12,0.3),inset_0_0_10px_rgba(234,88,12,0.1)]', 
                            text: 'text-orange-500', 
                            glow: 'text-shadow', 
                            bg: 'bg-orange-600/10'
                        };
                    }

                    return (
                        <div key={item.id} className={`${isFirst ? '-mt-12 z-20 scale-110' : 'z-10'} transform transition-all duration-500 hover:-translate-y-2 hover:scale-[1.05]`}>
                            {/* Crown for #1 */}
                            {isFirst && (
                                <div className="flex justify-center mb-4 animate-bounce">
                                    <Crown size={48} className="text-yellow-400 fill-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" />
                                </div>
                            )}
                            
                            <div className={`relative bg-black border-2 p-8 flex flex-col items-center clip-path-slant h-full group ${rankStyles.border} ${rankStyles.shadow} ${rankStyles.bg}`}>
                                <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center font-black font-display rounded-full border-2 bg-black text-xl ${rankStyles.text} ${rankStyles.border} shadow-[0_0_15px_currentColor]`}>
                                    {orderIdx + 1}
                                </div>
                                
                                <div className={`w-32 h-32 mb-6 rounded-full overflow-hidden border-2 ${rankStyles.border} bg-slate-900 flex items-center justify-center text-3xl shadow-[0_0_30px_currentColor] group-hover:scale-110 transition-transform duration-500`}>
                                    {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : (activeTab === 'STAKERS' ? '👤' : '🛡️')}
                                </div>
                                
                                <h3 className={`font-black text-white text-xl truncate max-w-full mb-1 group-hover:${rankStyles.glow} transition-all`}>{item.label}</h3>
                                <p className="text-xs text-slate-400 font-mono mb-6 uppercase tracking-widest">{item.subLabel}</p>
                                
                                <div className={`mt-auto font-black font-display text-3xl ${rankStyles.text} ${rankStyles.glow}`}>
                                    {item.value}
                                </div>
                                
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

             {/* The List (Rank 4+) - Animated Rows */}
             <div className="bg-black border border-intuition-border overflow-hidden neon-panel relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-intuition-primary to-transparent opacity-50"></div>
                
                <table className="w-full text-left">
                    <thead className="bg-intuition-card text-xs font-mono text-slate-500 uppercase tracking-wider border-b border-intuition-border">
                        <tr>
                            <th className="px-6 py-4 w-20 text-center">Rank</th>
                            <th className="px-6 py-4">Entity</th>
                            <th className="px-6 py-4 text-right">Metric</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.slice(3).map((item, i) => (
                            <tr 
                                key={item.id} 
                                className="hover:bg-intuition-primary/5 transition-all group relative animate-in fade-in slide-in-from-bottom-4" 
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                <td className="px-6 py-4 text-center font-mono text-slate-500 font-bold text-lg group-hover:text-intuition-primary transition-colors">
                                    #{item.rank}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-xs overflow-hidden border border-slate-700 group-hover:border-intuition-primary transition-colors shadow-lg">
                                            {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : (activeTab === 'STAKERS' ? '👤' : '🛡️')}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-lg group-hover:text-intuition-primary group-hover:text-glow transition-colors">{item.label}</div>
                                            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{item.subLabel}</div>
                                        </div>
                                    </div>
                                    <Link 
                                        to={activeTab === 'STAKERS' ? `/profile/${item.id}` : `/markets/${item.id}`} 
                                        className="absolute inset-0" 
                                        onClick={playClick} 
                                    />
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-intuition-secondary text-lg group-hover:text-white transition-colors">
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
