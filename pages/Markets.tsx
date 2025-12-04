import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, TrendingUp, Filter, DollarSign, Zap, Activity, ShieldCheck } from 'lucide-react';
import { formatEther } from 'viem';
import { getAllAgents } from '../services/graphql';
import { playHover, playClick } from '../services/audio';
import { Account } from '../types';

const Markets: React.FC = () => {
  const [agents, setAgents] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
  }, []);

  const filteredAgents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return agents;

    // 1. Score all potential matches
    const scored = agents
      .map((agent) => {
        const label = (agent.label || '').toLowerCase();
        const id = agent.id.toLowerCase();
        let score = 0;

        // Priority 1: Exact ID Match (1000) - Pinpoint accuracy
        if (id === term) score = 1000;
        // Priority 2: Exact Label Match (900)
        else if (label === term) score = 900;
        // Priority 3: Label Starts With (800) - "Ade" matches "Adewale"
        else if (label.startsWith(term)) score = 800;
        // Priority 4: ID Starts With (700)
        else if (id.startsWith(term)) score = 700;
        // Priority 5: Word Boundary Match (600) - "Musk" matches "Elon Musk"
        else if (label.split(/[\s-_]+/).some((w) => w.startsWith(term))) score = 600;
        // Priority 6: General Label Inclusion (500) - "ewal" matches "Adewale"
        else if (label.includes(term)) score = 500;
        // Priority 7: General ID Inclusion (400)
        else if (id.includes(term)) score = 400;

        return { agent, score };
      })
      .filter((item) => item.score > 0);

    // 2. Adaptive Filtering (Pinpointing)
    if (scored.length === 0) return [];
    
    // Find the highest quality match we have
    const maxScore = Math.max(...scored.map(i => i.score));
    
    // If we have strong matches, cut off the weak noise
    let threshold = 0;
    if (maxScore >= 900) threshold = 800; // If exact match exists, only show exact or strong prefix
    else if (maxScore >= 700) threshold = 600; // If prefix match exists, hide generic 'includes'
    
    return scored
      .filter(item => item.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.agent);
  }, [agents, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20">
      {/* Arcade Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 border-b border-intuition-primary/20 pb-8">
        <div>
          <h1 className="text-4xl font-black text-white flex items-center gap-3 font-display tracking-wide text-glow">
            <Activity className="text-intuition-primary animate-pulse" size={32} />
            MARKET_EXPLORER
          </h1>
          <p className="text-intuition-primary/60 mt-2 font-mono text-sm">
            >> SELECT_AGENT_TO_TRADE
          </p>
        </div>
        
        <div className="flex gap-3">
            <div className="relative group">
              <input 
                  type="text" 
                  placeholder="SEARCH_DB [PINPOINT]..." 
                  className="w-full md:w-72 bg-intuition-dark border border-intuition-border rounded-none py-3 pl-10 pr-4 text-intuition-primary font-mono text-sm focus:outline-none focus:border-intuition-primary focus:shadow-[0_0_15px_rgba(0,243,255,0.2)] transition-all placeholder-intuition-primary/30 uppercase clip-path-slant"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={playHover}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-intuition-primary/50 group-hover:text-intuition-primary transition-colors" size={16} />
            </div>
        </div>
      </div>

      {/* Market Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {[...Array(8)].map((_, i) => (
             <div key={i} className="h-[320px] bg-intuition-card/50 animate-pulse border border-intuition-border/50 relative overflow-hidden clip-path-slant">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-intuition-primary/5 to-transparent -translate-y-full animate-[shimmer_1.5s_infinite]"></div>
             </div>
           ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-intuition-border bg-intuition-card/30 clip-path-slant">
            <p className="text-intuition-primary/50 text-lg font-mono">NO_DATA_FOUND</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAgents.map((agent) => {
             // REAL METRICS CALCULATION
             const assets = agent.totalAssets ? parseFloat(formatEther(BigInt(agent.totalAssets))) : 0;
             const shares = agent.totalShares ? parseFloat(formatEther(BigInt(agent.totalShares))) : 0;
             
             let price = 0;
             if (shares > 0) {
                 price = assets / shares;
             }

             // Trust Strength Score (0-99)
             const strength = Math.min(99, Math.max(1, Math.log10(price * 10 + 1) * 50));
             
             const trustPct = strength.toFixed(0);
             const distrustPct = (100 - strength).toFixed(0);
             const realVolume = assets.toFixed(2);
             const isHot = assets > 100;

             // Calculate Reputation Score (normalized 0-100 based on strength)
             const repScore = Math.floor(strength);

             // Rank Calculation Logic (Futuristic Style)
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
                {/* Tech Corners */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-intuition-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-intuition-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-intuition-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-intuition-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>

                {/* Card Header */}
                <div className="h-36 bg-slate-900/50 relative p-4 border-b border-intuition-border group-hover:border-intuition-primary/30 transition-colors">
                   <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                   
                   <div className="relative z-10 flex justify-between items-start mb-3">
                      <span className="text-[10px] font-mono text-intuition-primary/60 bg-black/50 px-1 border border-intuition-primary/20 group-hover:text-intuition-primary group-hover:border-intuition-primary/50 transition-colors">ID: {agent.id.slice(0,6)}</span>
                      <div className="flex gap-2">
                          {/* FUTURISTIC RANK BADGE */}
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

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col bg-gradient-to-b from-intuition-dark to-[#02040a]">
                   
                   <div className="mb-5 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono font-bold uppercase tracking-wider">
                         <span className="text-intuition-success">TRUST {trustPct}%</span>
                         <span className="text-intuition-danger">{distrustPct}% DISTRUST</span>
                      </div>
                      {/* Real Sentiment Bar calculated from Price */}
                      <div className="w-full h-3 bg-black border border-slate-800 flex relative clip-path-slant">
                         <div className="absolute inset-0 grid grid-cols-10 pointer-events-none">
                            {[...Array(9)].map((_, i) => <div key={i} className="border-r border-black/50 h-full"></div>)}
                         </div>
                         <div style={{ width: `${trustPct}%` }} className="h-full bg-intuition-success/80 shadow-[0_0_10px_rgba(0,255,157,0.4)] transition-all duration-1000"></div>
                         <div style={{ width: `${distrustPct}%` }} className="h-full bg-intuition-danger/80 shadow-[0_0_10px_rgba(255,0,85,0.4)] transition-all duration-1000"></div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-2 mb-4 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                      <button className="py-1.5 bg-intuition-success/10 border border-intuition-success/30 text-intuition-success text-xs font-bold font-mono hover:bg-intuition-success hover:text-black transition-colors clip-path-slant">
                         TRUST
                      </button>
                      <button className="py-1.5 bg-intuition-danger/10 border border-intuition-danger/30 text-intuition-danger text-xs font-bold font-mono hover:bg-intuition-danger hover:text-black transition-colors clip-path-slant">
                         DISTRUST
                      </button>
                   </div>

                   <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500 group-hover:text-intuition-primary/70 transition-colors">
                      <div className="flex items-center gap-1 text-intuition-secondary">
                         <DollarSign size={10} />
                         VOL: {realVolume} TRUST
                      </div>
                      <div className="flex items-center gap-1">
                         <Activity size={10} />
                         PRICE: {price.toFixed(3)}
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