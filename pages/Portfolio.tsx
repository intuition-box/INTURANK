
import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { connectWallet, getConnectedAccount, getWalletBalance, getLocalTransactions, getShareBalance, getQuoteRedeem } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds } from '../services/graphql';
import { Wallet, PieChart as PieIcon, Activity, Clock, RefreshCw, Zap, ExternalLink, Download, Info, TrendingUp, Coins, AlertTriangle, Lock, ShieldAlert, Cpu, EyeOff, Radio } from 'lucide-react';
import { formatEther } from 'viem';
import { Transaction } from '../types';
import { toast } from '../components/Toast';
import { playHover, playClick } from '../services/audio';
import { calculateCategoryExposure, calculateSentimentBias } from '../services/analytics';
import { CURRENCY_SYMBOL } from '../constants';
import { Link } from 'react-router-dom';

const COLORS = ['#00f3ff', '#00ff9d', '#ff0055', '#facc15', '#94a3b8', '#a855f7', '#ec4899'];

const Portfolio: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState('0.00');
  const [portfolioValue, setPortfolioValue] = useState('0.00');
  const [netPnL, setNetPnL] = useState(0);
  const [sentimentBias, setSentimentBias] = useState({ trust: 50, distrust: 50 });
  const [exposureData, setExposureData] = useState<any[]>([]);
  const [semanticFootprint, setSemanticFootprint] = useState(0);

  useEffect(() => {
    const init = async () => {
      const acc = await getConnectedAccount();
      setAccount(acc);
      if (acc) fetchUserData(acc);
      else setLoading(false);
    };
    init();
  }, []);

  const fetchUserData = async (address: string) => {
    setLoading(true);
    try {
      const bal = await getWalletBalance(address);
      setBalance(Number(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

      const chainHistory = await getUserHistory(address).catch(() => []);
      const localHistory = getLocalTransactions(address);
      
      const chainHashes = new Set(chainHistory.map(tx => tx.id.split('-')[0].toLowerCase()));
      const uniqueLocal = localHistory.filter(tx => !chainHashes.has(tx.id.toLowerCase()));
      
      const mergedHistory = [...uniqueLocal, ...chainHistory]
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); 
      
      setHistory(mergedHistory.slice().reverse());

      setSentimentBias(calculateSentimentBias(mergedHistory));
      setSemanticFootprint(mergedHistory.length);

      let runningCostBasis = 0; 
      let totalRealizedOutflow = 0; 

      const historyPoints = mergedHistory.map(tx => {
          try {
              const val = parseFloat(formatEther(BigInt(tx.assets || '0')));
              if (tx.type === 'DEPOSIT') runningCostBasis += val;
              else if (tx.type === 'REDEEM') totalRealizedOutflow += val;
          } catch {}
          return {
              timestamp: tx.timestamp,
              date: new Date(tx.timestamp).toLocaleDateString(),
              val: runningCostBasis - totalRealizedOutflow 
          };
      });
      if (historyPoints.length > 0) historyPoints.unshift({ timestamp: historyPoints[0].timestamp - 1000, date: '', val: 0 });
      setChartData(historyPoints);

      const graphPositions = await getUserPositions(address).catch(() => []);
      
      const uniqueVaultIds = Array.from(new Set([
          ...graphPositions.map((p: any) => p.vault?.term_id?.toLowerCase()),
          ...mergedHistory.map(tx => tx.vaultId?.toLowerCase())
      ])).filter(Boolean) as string[];

      const metadata = await getVaultsByIds(uniqueVaultIds).catch(() => []);
      
      const livePositions = await Promise.all(uniqueVaultIds.map(async (id) => {
          const meta = metadata.find(m => m.id.toLowerCase() === id);
          const curveId = meta?.curveId ? Number(meta.curveId) : 0; 
          
          const shares = await getShareBalance(address, id, curveId);
          const sharesNum = parseFloat(shares);
          
          if (sharesNum <= 0.000001) return null;

          const valueStr = await getQuoteRedeem(shares, id, address, curveId);
          const value = parseFloat(valueStr);

          return {
              id,
              shares: sharesNum,
              value: value, 
              atom: meta || { label: `Agent ${id.slice(0,6)}...`, id, image: null }
          };
      }));

      const finalPositions = livePositions.filter(Boolean) as any[];
      setPositions(finalPositions);
      setExposureData(calculateCategoryExposure(finalPositions));

      const currentActiveValue = finalPositions.reduce((acc, cur) => acc + cur.value, 0);
      setPortfolioValue(currentActiveValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }));
      
      const pnl = (currentActiveValue + totalRealizedOutflow) - runningCostBasis;
      setNetPnL(pnl);

    } catch (e) {
      console.error("Portfolio Fetch Error", e);
      toast.error("DATA SYNC FAILED. RETRYING...");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
      if (account) {
          playClick();
          toast.info("RESYNCING LEDGER...");
          fetchUserData(account);
      }
  };

  if (!account) return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-intuition-dark py-20">
      {/* Dynamic Grid Background with Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-intuition-primary/10 via-black to-black opacity-60"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
      
      {/* Floating UI Elements (Ambient HUD) */}
      <div className="absolute top-20 left-20 text-intuition-primary/20 animate-pulse hidden xl:block">
          <div className="flex flex-col gap-2 font-mono text-[8px] uppercase tracking-[0.5em]">
              <span>[SECURE_CHANNEL_OFFLINE]</span>
              <span>[UPLINK_AWAITING_KEY]</span>
              <span>[ENCRYPTION_LEVEL_4]</span>
          </div>
      </div>
      
      <div className="absolute bottom-20 right-20 text-intuition-primary/20 animate-pulse hidden xl:block">
          <Cpu size={120} strokeWidth={0.5} />
      </div>

      <div className="relative z-10 w-full max-w-xl mx-4">
        {/* The Outer Frame with Intense Neon Glow */}
        <div className="relative p-[2px] bg-gradient-to-tr from-intuition-primary via-intuition-secondary to-intuition-primary clip-path-slant shadow-[0_0_60px_rgba(0,243,255,0.3)] animate-pulse-fast">
          <div className="bg-[#05080f] p-10 md:p-16 flex flex-col items-center text-center clip-path-slant border border-white/5 backdrop-blur-3xl relative overflow-hidden">
            
            {/* Scanline Animation */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-intuition-primary/5 to-transparent h-1/2 w-full -translate-y-full animate-[marquee_5s_linear_infinite] pointer-events-none"></div>

            <div className="mb-10 relative group">
              {/* Radial Aura */}
              <div className="absolute inset-0 bg-intuition-primary/30 blur-[40px] rounded-full scale-150 animate-pulse"></div>
              
              {/* Central Lock Hexagon */}
              <div className="relative w-32 h-32 bg-black border-2 border-intuition-primary flex items-center justify-center clip-path-slant shadow-[0_0_40px_#00f3ff] group-hover:shadow-[0_0_60px_#00f3ff] transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-t from-intuition-primary/20 to-transparent"></div>
                <ShieldAlert size={60} className="text-intuition-primary drop-shadow-[0_0_10px_#00f3ff] group-hover:scale-110 transition-transform duration-500" />
              </div>

              {/* Orbital Sync Status */}
              <div className="absolute -top-4 -right-4 bg-intuition-danger text-black font-black font-mono text-[10px] px-3 py-1 rounded shadow-[0_0_15px_#ff0055] animate-bounce">
                DISCONNECTED
              </div>
            </div>

            <div className="space-y-4 mb-12 relative z-10">
              <h1 className="text-4xl md:text-6xl font-black text-white font-display tracking-tight leading-none text-glow-white uppercase">
                NEURAL <span className="text-intuition-primary text-glow">LOCKED</span>
              </h1>
              <p className="text-slate-400 font-mono text-xs md:text-sm tracking-[0.2em] leading-relaxed max-w-sm mx-auto uppercase">
                Biometric Wallet Authentication required to decrypt your <span className="text-white font-bold">Semantic Portfolio</span> and track real-time PnL.
              </p>
            </div>

            <div className="w-full flex flex-col gap-4 relative z-10">
              <button 
                onClick={() => { playClick(); connectWallet().then(acc => acc && setAccount(acc)); }} 
                onMouseEnter={playHover}
                className="btn-cyber btn-cyber-cyan w-full py-6 text-xl shadow-[0_0_30px_rgba(0,243,255,0.4)]"
              >
                <Radio size={20} className="mr-3 animate-pulse" />
                INITIATE_HANDSHAKE
              </button>
              
              <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex flex-col items-center">
                      <div className="text-[10px] font-mono text-slate-600 uppercase mb-1">Status</div>
                      <div className="flex items-center gap-1.5 text-intuition-success font-bold text-[9px] font-mono">
                          <div className="w-1.5 h-1.5 rounded-full bg-intuition-success animate-pulse shadow-[0_0_5px_#00ff9d]"></div>
                          NODES_READY
                      </div>
                  </div>
                  <div className="w-px h-8 bg-white/10"></div>
                  <div className="flex flex-col items-center">
                      <div className="text-[10px] font-mono text-slate-600 uppercase mb-1">Latency</div>
                      <div className="text-intuition-primary font-bold text-[9px] font-mono">24ms_STABLE</div>
                  </div>
              </div>
            </div>
            
            {/* Warning Text */}
            <div className="mt-12 text-[8px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 opacity-50">
               <EyeOff size={10} /> ACCESS_LOGGED_BY_INTUITION_SENTINEL_V4.2
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-intuition-dark pt-8 pb-20 px-4 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-black border border-intuition-border p-6 clip-path-slant relative group hover:border-intuition-primary/50 transition-colors neon-panel">
              <div className="absolute top-0 right-0 p-3 opacity-20"><Wallet size={40} /></div>
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <span className="w-1 h-1 bg-white rounded-full shadow-[0_0_5px_white]"></span> Liquid Balance
              </div>
              <div className="text-3xl font-black text-white font-display text-glow-white">{balance}</div>
              <div className="text-xs text-intuition-primary font-mono mt-1">{CURRENCY_SYMBOL}</div>
          </div>
          <div className="bg-black border border-intuition-primary/50 p-6 clip-path-slant relative group neon-panel shadow-[0_0_20px_rgba(0,243,255,0.1)]">
              <div className="absolute top-0 right-0 p-3 opacity-20"><Coins size={40} /></div>
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <span className="w-1 h-1 bg-intuition-primary rounded-full animate-pulse shadow-[0_0_5px_#00f3ff]"></span> Active Stake Equity
              </div>
              <div className="text-3xl font-black text-white font-display text-glow">{portfolioValue}</div>
              <div className="text-xs text-intuition-primary font-mono mt-1">{CURRENCY_SYMBOL}</div>
          </div>
          <div className={`bg-black border p-6 clip-path-slant relative neon-panel ${netPnL >= 0 ? 'border-intuition-success/30 shadow-[0_0_20px_rgba(0,255,157,0.1)]' : 'border-intuition-danger/30 shadow-[0_0_20px_rgba(255,0,85,0.1)]'}`}>
              <div className="absolute top-0 right-0 p-3 opacity-20"><TrendingUp size={40} /></div>
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${netPnL >= 0 ? 'bg-intuition-success' : 'bg-intuition-danger'} animate-pulse`}></span>
                Est. Unrealized + Realized PnL
              </div>
              <div className={`text-3xl font-black font-display ${netPnL >= 0 ? 'text-emerald-400 text-glow-success' : 'text-rose-400 text-glow-danger'}`}>
                  {netPnL > 0 ? '+' : ''}{netPnL.toFixed(4)}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">{CURRENCY_SYMBOL}</div>
          </div>
          <div className="bg-black border border-intuition-border p-6 clip-path-slant relative overflow-hidden neon-panel">
              <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Sentiment Bias</div>
                  <div className="text-[9px] font-mono text-slate-600 bg-slate-900 px-1 rounded border border-slate-800">{semanticFootprint} TXS</div>
              </div>
              <div className="relative h-6 bg-slate-800 rounded-sm mt-2 overflow-hidden flex border border-slate-700 shadow-inner">
                  <div style={{ width: `${sentimentBias.trust}%` }} className="bg-intuition-success h-full transition-all duration-1000 flex items-center justify-center text-[9px] font-black text-black shadow-[0_0_10px_rgba(0,255,157,0.5)] relative z-10">
                      {sentimentBias.trust > 20 && `${sentimentBias.trust.toFixed(0)}%`}
                  </div>
                  <div style={{ width: `${sentimentBias.distrust}%` }} className="bg-intuition-danger h-full transition-all duration-1000 flex items-center justify-center text-[9px] font-black text-black shadow-[0_0_10px_rgba(255,0,85,0.5)] relative z-10">
                      {sentimentBias.distrust > 20 && `${sentimentBias.distrust.toFixed(0)}%`}
                  </div>
              </div>
              <div className="flex justify-between text-[9px] mt-2 font-mono font-bold text-slate-500">
                  <span className="text-intuition-success text-shadow">BULLISH</span>
                  <span className="text-intuition-danger text-shadow">BEARISH</span>
              </div>
          </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="bg-black border border-intuition-border p-6 clip-path-slant h-[300px] flex flex-col neon-panel">
              <h3 className="text-xs font-bold text-white font-mono uppercase mb-4 flex items-center gap-2"><PieIcon size={14}/> Category Exposure</h3>
              {exposureData.length > 0 ? (
                  <div className="flex items-center h-full">
                      <div className="w-1/2 h-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie data={exposureData} innerRadius={40} outerRadius={65} paddingAngle={5} dataKey="value" nameKey="name">
                                      {exposureData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.5)" />
                                      ))}
                                  </Pie>
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                                    itemStyle={{ fontSize: '12px', fontFamily: 'monospace' }}
                                    formatter={(value: number) => `${value.toFixed(1)}%`}
                                  />
                              </PieChart>
                          </ResponsiveContainer>
                      </div>
                      <div className="w-1/2 pl-2 flex flex-col justify-center gap-2 overflow-y-auto max-h-[220px] custom-scrollbar">
                          {exposureData.map((entry, index) => (
                              <div key={index} className="flex items-center gap-2 text-[10px] font-mono">
                                  <div className="w-2 h-2 rounded-sm shrink-0 shadow-[0_0_5px_currentColor]" style={{ backgroundColor: COLORS[index % COLORS.length], color: COLORS[index % COLORS.length] }}></div>
                                  <span className="text-slate-400 truncate flex-1">{entry.name}</span>
                                  <span className="text-white font-bold">{entry.value.toFixed(0)}%</span>
                              </div>
                          ))}
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs border border-dashed border-slate-800 rounded">
                      NO ASSETS TO CATEGORIZE
                  </div>
              )}
          </div>
          <div className="lg:col-span-2 bg-black border border-intuition-border p-6 clip-path-slant h-[300px] neon-panel">
              <h3 className="text-xs font-bold text-white font-mono uppercase mb-4 flex items-center gap-2"><Activity size={14}/> Capital Utilization (Equity over Time)</h3>
              {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                          <defs>
                              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis dataKey="date" hide />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} 
                            labelStyle={{ color: '#aaa', fontSize: '10px' }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                          />
                          <Area type="stepAfter" dataKey="val" stroke="#00f3ff" fillOpacity={1} fill="url(#colorVal)" />
                      </AreaChart>
                  </ResponsiveContainer>
              ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs border border-dashed border-slate-800 rounded">
                      NO TRANSACTION HISTORY FOUND
                  </div>
              )}
          </div>
      </div>
      <div className="bg-black border border-intuition-border clip-path-slant mb-8 neon-panel">
          <div className="p-4 border-b border-intuition-border bg-intuition-card flex justify-between items-center">
              <h3 className="font-bold text-white font-display tracking-widest flex items-center gap-2"><Zap size={16} className="text-intuition-warning"/> ACTIVE_POSITIONS</h3>
              <button 
                onClick={handleRefresh} 
                className="text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-mono border border-slate-800 px-2 py-1 rounded"
              >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> FORCE_SYNC
              </button>
          </div>
          <div className="overflow-x-auto min-h-[150px]">
              <table className="w-full text-left font-mono text-sm">
                  <thead className="bg-intuition-dark text-slate-500 text-xs uppercase border-b border-intuition-border">
                      <tr>
                          <th className="px-6 py-4">Asset</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4 text-right">Shares</th>
                          <th className="px-6 py-4 text-right">Current Value</th>
                          <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {positions.length > 0 ? positions.map((p, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors group">
                              <td className="px-6 py-4">
                                  <Link to={`/markets/${p.id}`} className="flex items-center gap-3 group-hover:text-intuition-primary transition-colors">
                                      {p.atom?.image ? <img src={p.atom.image} className="w-6 h-6 rounded-full object-cover border border-white/10" /> : <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-[10px]">{p.atom?.label?.[0]}</div>}
                                      <div className="font-bold group-hover:text-glow">{p.atom?.label || p.id.slice(0,8)}</div>
                                  </Link>
                                  <div className="text-[10px] text-slate-600 font-mono mt-0.5">{p.id.slice(0, 12)}...</div>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500">
                                  <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">{p.atom ? calculateCategoryExposure([{value: 1, atom: p.atom}])[0]?.name : 'UNKNOWN'}</span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono">{p.shares.toFixed(4)}</td>
                              <td className="px-6 py-4 text-right text-emerald-400 font-bold">{p.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {CURRENCY_SYMBOL}</td>
                              <td className="px-6 py-4 text-right">
                                  <Link to={`/markets/${p.id}`} className="px-3 py-1 bg-white/5 border border-white/10 hover:bg-intuition-primary/20 hover:border-intuition-primary hover:text-intuition-primary text-[10px] font-bold rounded transition-colors shadow-none hover:shadow-[0_0_10px_rgba(0,243,255,0.4)]">VIEW</Link>
                              </td>
                          </tr>
                      )) : (
                          <tr><td colSpan={5} className="p-12 text-center text-slate-600 font-mono italic">
                              {loading ? (
                                  <div className="flex items-center justify-center gap-2"><RefreshCw className="animate-spin" size={14} /> SCANNING PUBLIC LEDGER...</div>
                              ) : (
                                  'NO ACTIVE POSITIONS FOUND ON-CHAIN'
                              )}
                          </td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default Portfolio;
