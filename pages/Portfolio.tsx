import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { connectWallet, getConnectedAccount, getWalletBalance, getLocalTransactions, getShareBalance, getQuoteRedeem } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds } from '../services/graphql';
import { Wallet, PieChart as PieIcon, Activity, Clock, RefreshCw, Zap, ExternalLink, Download, Info, TrendingUp, Coins, AlertTriangle } from 'lucide-react';
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
      // 1. Fetch Liquid Balance immediately
      const bal = await getWalletBalance(address);
      setBalance(Number(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

      // 2. Fetch History (Chain + Local Merge)
      const chainHistory = await getUserHistory(address).catch(() => []);
      const localHistory = getLocalTransactions(address);
      
      const mergedHistory = [...localHistory, ...chainHistory]
        .filter((tx, index, self) => index === self.findIndex((t) => (t.id === tx.id)))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); 
      
      setHistory(mergedHistory.slice().reverse());

      // 3. Analytics: Sentiment & PnL Baseline
      setSentimentBias(calculateSentimentBias(mergedHistory));
      setSemanticFootprint(mergedHistory.length);

      let runningDeposit = 0;
      let runningRedeem = 0;
      const historyPoints = mergedHistory.map(tx => {
          try {
              const val = parseFloat(formatEther(BigInt(tx.assets || '0')));
              if (tx.type === 'DEPOSIT') runningDeposit += val;
              else if (tx.type === 'REDEEM') runningRedeem += val;
          } catch {}
          return {
              timestamp: tx.timestamp,
              date: new Date(tx.timestamp).toLocaleDateString(),
              val: runningDeposit - runningRedeem 
          };
      });
      if (historyPoints.length > 0) historyPoints.unshift({ timestamp: historyPoints[0].timestamp - 1000, date: '', val: 0 });
      setChartData(historyPoints);

      // 4. ROBUST POSITION SCANNING
      // We gather EVERY ID the user has ever touched from history + current graph state
      // This fixes the "Active positions failing" issue if the graph is lagging on the `positions` entity
      const graphPositions = await getUserPositions(address).catch(() => []);
      
      const uniqueVaultIds = Array.from(new Set([
          ...graphPositions.map((p: any) => p.vault?.term_id?.toLowerCase()),
          ...localHistory.map(tx => tx.vaultId?.toLowerCase()),
          ...chainHistory.map(tx => tx.vaultId?.toLowerCase())
      ])).filter(Boolean) as string[];

      // Fetch metadata for these IDs (labels, images)
      const metadata = await getVaultsByIds(uniqueVaultIds).catch(() => []);
      
      // 5. LIVE CHAIN CHECK (The Source of Truth)
      // We iterate ALL potential vaults and check the contract for actual balance
      const livePositions = await Promise.all(uniqueVaultIds.map(async (id) => {
          const meta = metadata.find(m => m.id.toLowerCase() === id);
          const curveId = meta?.curveId ? Number(meta.curveId) : 0; 
          
          // Direct Contract Call
          const shares = await getShareBalance(address, id, curveId);
          const sharesNum = parseFloat(shares);
          
          // Filter dust
          if (sharesNum <= 0.000001) return null;

          // Get Redeem Value
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

      // 6. Final Net Worth & PnL
      const currentVal = finalPositions.reduce((acc, cur) => acc + cur.value, 0);
      setPortfolioValue(currentVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }));
      
      const pnl = (currentVal + runningRedeem) - runningDeposit;
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
      <div className="min-h-screen flex flex-col items-center justify-center font-mono bg-intuition-dark">
          <div className="text-center mb-8">
              <h1 className="text-3xl font-black text-white font-display mb-2">PORTFOLIO LOCKED</h1>
              <p className="text-slate-500">AUTHENTICATION REQUIRED TO ACCESS ASSETS</p>
          </div>
          <button onClick={() => connectWallet().then(acc => acc && setAccount(acc))} className="px-8 py-3 bg-intuition-primary text-black font-bold clip-path-slant hover-glow flex items-center gap-2">
              <Wallet size={18} /> CONNECT WALLET
          </button>
      </div>
  );

  return (
    <div className="min-h-screen bg-intuition-dark pt-8 pb-20 px-4 max-w-7xl mx-auto">
      
      {/* 1. Header Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* LIQUID BALANCE (Explicitly Placed First) */}
          <div className="bg-black border border-intuition-border p-6 clip-path-slant relative group hover:border-intuition-primary/50 transition-colors">
              <div className="absolute top-0 right-0 p-3 opacity-20"><Wallet size={40} /></div>
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <span className="w-1 h-1 bg-white rounded-full"></span> Liquid Balance
              </div>
              <div className="text-3xl font-black text-white font-display">{balance}</div>
              <div className="text-xs text-intuition-primary font-mono mt-1">{CURRENCY_SYMBOL}</div>
          </div>

          {/* NET WORTH */}
          <div className="bg-black border border-intuition-primary/50 p-6 clip-path-slant relative group">
              <div className="absolute top-0 right-0 p-3 opacity-20"><Coins size={40} /></div>
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <span className="w-1 h-1 bg-intuition-primary rounded-full animate-pulse"></span> Net Worth (Locked)
              </div>
              <div className="text-3xl font-black text-white font-display text-glow">{portfolioValue}</div>
              <div className="text-xs text-intuition-primary font-mono mt-1">{CURRENCY_SYMBOL}</div>
          </div>

          {/* EST PNL */}
          <div className={`bg-black border p-6 clip-path-slant relative ${netPnL >= 0 ? 'border-intuition-success/30' : 'border-intuition-danger/30'}`}>
              <div className="absolute top-0 right-0 p-3 opacity-20"><TrendingUp size={40} /></div>
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">Est. PnL</div>
              <div className={`text-3xl font-black font-display ${netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netPnL > 0 ? '+' : ''}{netPnL.toFixed(4)}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-1">{CURRENCY_SYMBOL}</div>
          </div>

          {/* SENTIMENT BIAS */}
          <div className="bg-black border border-intuition-border p-6 clip-path-slant relative overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Sentiment Bias</div>
                  <div className="text-[9px] font-mono text-slate-600 bg-slate-900 px-1 rounded border border-slate-800">{semanticFootprint} TXS</div>
              </div>
              
              <div className="relative h-6 bg-slate-800 rounded-sm mt-2 overflow-hidden flex border border-slate-700">
                  <div style={{ width: `${sentimentBias.trust}%` }} className="bg-intuition-success h-full transition-all duration-1000 flex items-center justify-center text-[9px] font-black text-black">
                      {sentimentBias.trust > 20 && `${sentimentBias.trust.toFixed(0)}%`}
                  </div>
                  <div style={{ width: `${sentimentBias.distrust}%` }} className="bg-intuition-danger h-full transition-all duration-1000 flex items-center justify-center text-[9px] font-black text-black">
                      {sentimentBias.distrust > 20 && `${sentimentBias.distrust.toFixed(0)}%`}
                  </div>
              </div>
              
              <div className="flex justify-between text-[9px] mt-2 font-mono font-bold text-slate-500">
                  <span>BULLISH</span>
                  <span>BEARISH</span>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Exposure Chart with Legend */}
          <div className="bg-black border border-intuition-border p-6 clip-path-slant h-[300px] flex flex-col">
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

          {/* Capital History */}
          <div className="lg:col-span-2 bg-black border border-intuition-border p-6 clip-path-slant h-[300px]">
              <h3 className="text-xs font-bold text-white font-mono uppercase mb-4 flex items-center gap-2"><Activity size={14}/> Capital Deployment History (Net Invested)</h3>
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

      {/* Positions Table */}
      <div className="bg-black border border-intuition-border clip-path-slant mb-8">
          <div className="p-4 border-b border-intuition-border bg-intuition-card flex justify-between items-center">
              <h3 className="font-bold text-white font-display tracking-widest flex items-center gap-2"><Zap size={16} className="text-intuition-warning"/> ACTIVE_POSITIONS</h3>
              <button 
                onClick={handleRefresh} 
                className="text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-mono border border-slate-800 px-2 py-1 rounded"
                title="Refresh Assets"
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
                          <th className="px-6 py-4 text-right">Value (Real-Time)</th>
                          <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {positions.length > 0 ? positions.map((p, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors group">
                              <td className="px-6 py-4">
                                  <Link to={`/markets/${p.id}`} className="flex items-center gap-3 group-hover:text-intuition-primary transition-colors">
                                      {p.atom?.image ? <img src={p.atom.image} className="w-6 h-6 rounded-full object-cover border border-white/10" /> : <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-[10px]">{p.atom?.label?.[0]}</div>}
                                      <div className="font-bold">{p.atom?.label || p.id.slice(0,8)}</div>
                                  </Link>
                                  <div className="text-[10px] text-slate-600 font-mono mt-0.5">{p.id.slice(0, 12)}...</div>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500">
                                  <span className="bg-slate-900 px-2 py-1 rounded border border-slate-800">{p.atom ? calculateCategoryExposure([{value: 1, atom: p.atom}])[0]?.name : 'UNKNOWN'}</span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono">{p.shares.toFixed(4)}</td>
                              <td className="px-6 py-4 text-right text-intuition-success font-mono font-bold">{p.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {CURRENCY_SYMBOL}</td>
                              <td className="px-6 py-4 text-right">
                                  <Link to={`/markets/${p.id}`} className="px-3 py-1 bg-white/5 border border-white/10 hover:bg-intuition-primary/20 hover:border-intuition-primary hover:text-intuition-primary text-[10px] font-bold rounded transition-colors">MANAGE</Link>
                              </td>
                          </tr>
                      )) : (
                          <tr><td colSpan={5} className="p-12 text-center text-slate-600 font-mono italic">
                              {loading ? (
                                  <div className="flex items-center justify-center gap-2"><RefreshCw className="animate-spin" size={14} /> SCANNING ON-CHAIN LEDGER...</div>
                              ) : (
                                  <div className="flex items-center justify-center gap-2 text-yellow-500/50">
                                      <AlertTriangle size={14} /> NO ACTIVE POSITIONS VERIFIED
                                  </div>
                              )}
                          </td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Trade History */}
      <div className="bg-black border border-intuition-border clip-path-slant">
          <div className="p-4 border-b border-intuition-border bg-intuition-card flex justify-between items-center">
              <h3 className="font-bold text-white font-display tracking-widest flex items-center gap-2"><Clock size={16} className="text-intuition-secondary"/> TRADE_LOG</h3>
              <button className="text-xs font-mono text-slate-500 hover:text-white flex items-center gap-1"><Download size={12} /> CSV</button>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-intuition-dark text-slate-500 uppercase border-b border-intuition-border sticky top-0">
                      <tr>
                          <th className="px-6 py-3">Time</th>
                          <th className="px-6 py-3">Action</th>
                          <th className="px-6 py-3">Asset</th>
                          <th className="px-6 py-3 text-right">Amount</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {history.length > 0 ? history.map((tx, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-3 text-slate-500">{new Date(tx.timestamp).toLocaleString()}</td>
                              <td className={`px-6 py-3 font-bold ${tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-rose-400'}`}>{tx.type}</td>
                              <td className="px-6 py-3 text-white">
                                  <Link to={`/markets/${tx.vaultId}`} className="hover:underline hover:text-intuition-primary transition-colors">{tx.assetLabel || tx.vaultId?.slice(0,8) || 'Unknown'}</Link>
                              </td>
                              <td className="px-6 py-3 text-right">{parseFloat(formatEther(BigInt(tx.assets || '0'))).toFixed(4)}</td>
                          </tr>
                      )) : (
                          <tr><td colSpan={4} className="p-8 text-center text-slate-600 italic">NO TRANSACTION HISTORY</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

    </div>
  );
};

export default Portfolio;