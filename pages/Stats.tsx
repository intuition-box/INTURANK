import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Award, Zap, TrendingUp, Crown, Crosshair, AlertTriangle, RefreshCw } from 'lucide-react';
import { getTopPositions } from '../services/graphql';
import { formatEther } from 'viem';
import { playHover } from '../services/audio';

interface LeaderboardEntry {
  rank: number;
  address: string;
  label: string;
  score: string; // Formatted String
  rawScore: bigint; // BigInt for sorting
  shares: string;
  topHold: string;
  avatar?: string;
}

// Robust formatter for large scores (K, M, B)
const formatScore = (weiScore: bigint) => {
    const score = parseFloat(formatEther(weiScore));
    if (score > 1000000000) return (score / 1000000000).toFixed(2) + 'B';
    if (score > 1000000) return (score / 1000000).toFixed(2) + 'M';
    if (score > 1000) return (score / 1000).toFixed(2) + 'k';
    return score.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const Stats: React.FC = () => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(false);
      try {
        const positions = await getTopPositions();
        
        if (!positions || positions.length === 0) {
            setLeaders([]);
            setLoading(false);
            return;
        }

        const traderMap = new Map<string, LeaderboardEntry>();

        positions.forEach((pos: any) => {
          const accountId = pos.account?.id || 'Unknown';
          const shareCountWei = BigInt(pos.shares || '0'); // Keep as BigInt
          
          if (traderMap.has(accountId)) {
             const existing = traderMap.get(accountId)!;
             existing.rawScore += shareCountWei;
          } else {
             traderMap.set(accountId, {
               rank: 0,
               address: accountId,
               label: pos.account?.label || `Trader ${accountId.slice(2,6)}`,
               score: '0',
               rawScore: shareCountWei,
               shares: '0',
               topHold: pos.vault?.atom?.label || 'Unknown Asset',
               avatar: pos.account?.image
             });
          }
        });

        const sorted = Array.from(traderMap.values()).sort((a, b) => {
            if (a.rawScore < b.rawScore) return 1;
            if (a.rawScore > b.rawScore) return -1;
            return 0;
        });

        const ranked = sorted.map((entry, i) => ({ 
            ...entry, 
            rank: i + 1,
            score: formatScore(entry.rawScore) // Apply format HERE
        }));
        
        setLeaders(ranked);
      } catch (error) {
        console.error("Leaderboard error:", error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="min-h-screen bg-[#050b14] pt-32 pb-20 relative overflow-visible font-mono">
      
      {/* Arcade Background Grid */}
      <div className="absolute inset-0 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)', 
             backgroundSize: '40px 40px',
             maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)'
           }}>
      </div>

      <div className="w-full max-w-[95%] mx-auto px-4 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-24">
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)] uppercase tracking-tighter transform -skew-x-6 hover-glitch">
            High Scores
          </h1>
          <p className="text-cyan-400 font-bold tracking-widest mt-4 uppercase text-sm animate-pulse">
            /// Top Traders of the Metaverse ///
          </p>
        </div>

        {loading ? (
           <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-yellow-400 font-bold text-xl animate-bounce">CALCULATING RANK...</div>
           </div>
        ) : error ? (
           <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <AlertTriangle className="text-intuition-danger" size={48} />
              <div className="text-intuition-danger font-bold text-xl">UPLINK FAILED</div>
              <button onClick={() => window.location.reload()} className="px-4 py-2 border border-intuition-danger text-intuition-danger hover:bg-intuition-danger hover:text-black transition-colors font-mono uppercase text-xs flex items-center gap-2">
                 <RefreshCw size={14} /> Retry
              </button>
           </div>
        ) : leaders.length === 0 ? (
           <div className="text-center py-20 text-slate-500 font-mono">
              NO PLAYERS FOUND. BE THE FIRST TO ENTER THE ARENA.
           </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            <div className="flex flex-col md:flex-row items-end justify-center gap-6 mb-20 px-4 pt-10">
              
              {/* 2nd Place */}
              {leaders[1] && (
                <div className="order-2 md:order-1 w-full md:w-1/3 max-w-[280px]">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-slate-400/20 blur-xl rounded-full group-hover:bg-slate-400/40 transition-all"></div>
                    <div 
                      onMouseEnter={playHover}
                      className="relative bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-500 rounded-2xl p-6 flex flex-col items-center transform hover:-translate-y-4 transition-transform shadow-[0_0_30px_rgba(148,163,184,0.2)] clip-path-slant hover-glow"
                    >
                       <div className="absolute -top-5 w-10 h-10 bg-slate-500 rounded-full flex items-center justify-center font-bold text-slate-900 border-2 border-white">2</div>
                       <div className="w-20 h-20 rounded-full bg-slate-700 mb-4 overflow-hidden border-2 border-slate-500">
                          {leaders[1].avatar ? <img src={leaders[1].avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>}
                       </div>
                       <h3 className="text-xl font-bold text-slate-200 truncate max-w-full mb-1">{leaders[1].label}</h3>
                       <div className="text-xs text-slate-500 mb-4 font-mono">{leaders[1].address.slice(0,6)}...</div>
                       <div className="w-full bg-slate-800/50 rounded p-2 text-center border border-slate-700">
                          <div className="text-xs text-slate-400 uppercase">Conviction (Shares)</div>
                          <div className="text-lg font-bold text-slate-200">{leaders[1].score}</div>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {leaders[0] && (
                <div className="order-1 md:order-2 w-full md:w-1/3 max-w-[320px] -translate-y-8">
                   <div className="relative group">
                    <div className="absolute inset-0 bg-yellow-500/20 blur-2xl rounded-full group-hover:bg-yellow-500/40 transition-all"></div>
                    <div 
                      onMouseEnter={playHover}
                      className="relative bg-gradient-to-b from-yellow-900/40 to-slate-900 border-2 border-yellow-400 rounded-2xl p-8 flex flex-col items-center transform hover:-translate-y-4 transition-transform shadow-[0_0_50px_rgba(250,204,21,0.3)] clip-path-slant hover-glow"
                    >
                       <div className="absolute -top-8">
                          <Crown size={48} className="text-yellow-400 fill-yellow-400 animate-bounce drop-shadow-lg" />
                       </div>
                       <div className="w-24 h-24 rounded-full bg-yellow-600/20 mb-4 overflow-hidden border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]">
                          {leaders[0].avatar ? <img src={leaders[0].avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-4xl">👑</div>}
                       </div>
                       <h3 className="text-2xl font-black text-yellow-400 truncate max-w-full mb-1">{leaders[0].label}</h3>
                       <div className="text-sm text-yellow-500/70 mb-6 font-mono">{leaders[0].address.slice(0,8)}...</div>
                       
                       <div className="w-full bg-yellow-900/20 rounded-xl p-3 text-center border border-yellow-500/30 mb-2">
                          <div className="text-xs text-yellow-500 uppercase tracking-widest mb-1">Total Conviction</div>
                          <div className="text-3xl font-black text-white drop-shadow-md">{leaders[0].score}</div>
                       </div>
                       <div className="text-xs text-yellow-600 flex items-center gap-1">
                          <Zap size={12} /> Top Hold: {leaders[0].topHold}
                       </div>
                    </div>
                   </div>
                </div>
              )}

              {/* 3rd Place */}
              {leaders[2] && (
                <div className="order-3 md:order-3 w-full md:w-1/3 max-w-[280px]">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-orange-700/20 blur-xl rounded-full group-hover:bg-orange-700/40 transition-all"></div>
                    <div 
                      onMouseEnter={playHover}
                      className="relative bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-orange-700 rounded-2xl p-6 flex flex-col items-center transform hover:-translate-y-4 transition-transform shadow-[0_0_30px_rgba(194,65,12,0.2)] clip-path-slant hover-glow"
                    >
                       <div className="absolute -top-5 w-10 h-10 bg-orange-700 rounded-full flex items-center justify-center font-bold text-white border-2 border-orange-400">3</div>
                       <div className="w-20 h-20 rounded-full bg-slate-700 mb-4 overflow-hidden border-2 border-orange-700">
                          {leaders[2].avatar ? <img src={leaders[2].avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>}
                       </div>
                       <h3 className="text-xl font-bold text-orange-100 truncate max-w-full mb-1">{leaders[2].label}</h3>
                       <div className="text-xs text-slate-500 mb-4 font-mono">{leaders[2].address.slice(0,6)}...</div>
                       <div className="w-full bg-slate-800/50 rounded p-2 text-center border border-slate-700">
                          <div className="text-xs text-slate-400 uppercase">Conviction (Shares)</div>
                          <div className="text-lg font-bold text-slate-200">{leaders[2].score}</div>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* The List */}
            <div className="glass-panel border-2 border-intuition-primary/30 rounded-lg overflow-hidden relative clip-path-slant hover-glow">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-intuition-primary to-transparent opacity-50"></div>
              
              <table className="w-full text-left">
                 <thead className="bg-intuition-primary/10 text-intuition-primary uppercase text-xs tracking-wider">
                    <tr>
                       <th className="px-6 py-4 font-black">Rank</th>
                       <th className="px-6 py-4 font-black">Player</th>
                       <th className="px-6 py-4 font-black hidden md:table-cell">Fav Asset</th>
                       <th className="px-6 py-4 font-black text-right">Conviction (Shares)</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-intuition-primary/10 text-slate-300">
                    {leaders.slice(3).map((leader) => (
                       <tr 
                         key={leader.address} 
                         onMouseEnter={playHover}
                         className="hover:bg-intuition-primary/10 transition-colors group hover:shadow-[inset_0_0_20px_rgba(0,243,255,0.1)] cursor-pointer"
                       >
                          <td className="px-6 py-4 font-mono text-slate-500 group-hover:text-white group-hover:translate-x-2 transition-transform">
                             #{leader.rank.toString().padStart(2, '0')}
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-xs group-hover:ring-2 ring-intuition-primary transition-all">
                                   {leader.avatar ? <img src={leader.avatar} className="w-full h-full rounded object-cover"/> : '👾'}
                                </div>
                                <div>
                                   <div className="font-bold text-white group-hover:text-intuition-primary transition-colors text-glow">{leader.label}</div>
                                   <div className="text-[10px] text-slate-500 font-mono">{leader.address}</div>
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell">
                             <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-400 group-hover:border-intuition-primary/50 group-hover:text-white">
                                {leader.topHold}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400 text-lg group-hover:scale-110 transition-transform origin-right group-hover:text-intuition-primary">
                             {leader.score}
                          </td>
                       </tr>
                    ))}
                    {leaders.length < 4 && (
                       <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-slate-500 italic">
                             Join the network to appear on the leaderboard!
                          </td>
                       </tr>
                    )}
                 </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Stats;