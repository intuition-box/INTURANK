import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { connectWallet, getConnectedAccount, getWalletBalance, getLocalTransactions, getShareBalance, getQuoteRedeem } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds } from '../services/graphql';
import { Wallet, PieChart as PieIcon, Activity, Clock, RefreshCw, Zap, ExternalLink, Download, Info } from 'lucide-react';
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
      setBalance(Number(bal).toFixed(4));

      // 1. History & Transactions
      const chainHistory = await getUserHistory(address).catch(() => []);
      const localHistory = getLocalTransactions(address);
      
      // Merge and dedupe history
      const mergedHistory = [...localHistory, ...chainHistory]
        .filter((tx, index, self) => index === self.findIndex((t) => (t.id === tx.id)))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); // Sort Ascending for Chart
      
      setHistory(mergedHistory.slice().reverse()); // Store descending for list

      // 2. Sentiment Bias
      setSentimentBias(calculateSentimentBias(mergedHistory));

      // 3. Performance Chart (Net Capital Deployed over time)
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
              val: runningDeposit - runningRedeem // Net Invested Capital
          };
      });
      // Add start point
      if (historyPoints.length > 0) historyPoints.unshift({ timestamp: historyPoints[0].timestamp - 1000, date: '', val: 0 });
      setChartData(historyPoints);

      // 4. Positions & Exposure
      const graphPositions = await getUserPositions(address).catch(() => []);
      
      // normalize IDs to lowercase to avoid mismatches
      const uniqueVaultIds = Array.from(new Set([
          ...graphPositions.map((p: any) => p.vault?.term_id?.toLowerCase()),
          ...localHistory.map(tx => tx.vaultId?.toLowerCase())
      ])).filter(Boolean) as string[];

      const metadata = await getVaultsByIds(uniqueVaultIds).catch(() => []);
      
      // Fetch LIVE on-chain data
      const livePositions = await Promise.all(uniqueVaultIds.map(async (id) => {
          const meta = metadata.find(m => m.id.toLowerCase() === id);
          const curveId = meta?.curveId ? Number(meta.curveId) : 0; 
          
          // Get Raw Shares
          const shares = await getShareBalance(address, id, curveId);
          const sharesNum = parseFloat(shares);
          
          // Filter dust
          if (sharesNum <= 0.000001) return null;

          // Get Real On-Chain Value (Redemption Quote)
          const valueStr = await getQuoteRedeem(shares, id, address, curveId);
          const value = parseFloat(valueStr);

          return {
              id,
              shares: sharesNum,
              value: value, // Real exit value
              atom: meta || { label: `Agent ${id.slice(0,6)}...`, id, image: null }
          };
      }));

      const finalPositions = livePositions.filter(Boolean) as any[];
      setPositions(finalPositions);
      setExposureData(calculateCategoryExposure(finalPositions));

      // 5. Net Worth & PnL Calculation
      const currentVal = finalPositions.reduce((acc, cur) => acc + cur.value, 0);
      setPortfolioValue(currentVal.toFixed(4));
      
      // Net PnL = (Current Portfolio Value + Total Redeemed) - Total Deposited
      const pnl = (currentVal + runningRedeem) - runningDeposit;
      setNetPnL(pnl);

      // 6. Semantic Footprint
      setSemanticFootprint(mergedHistory.length); 

    } catch (e) {
      console.error("Portfolio Fetch Error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
      if (account) {
          playClick();
          toast.info("SYNCING LEDGER...");
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
      
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-black border border-intuition-primary/50 p-6 clip-path-slant">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">Net Worth</div>
              <div className="text-3xl font-black text-white font-display text-glow">{portfolioValue} <span className="text-sm text-intuition-primary">{CURRENCY_SYMBOL}</span></div>
          </div>
          <div className="bg-black border border-intuition-border p-6 clip-path-slant">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">Est. PnL</div>
              <div className={`text-3xl font-black font-display ${netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netPnL > 0 ? '+' : ''}{netPnL.toFixed(4)} <span className="text-sm text-slate-500">{CURRENCY_SYMBOL}</span>
              </div>
          </div>
          <div className="bg-black border border-intuition-border p-6 clip-path-slant">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">Semantic Footprint</div>
              <div className="text-3xl font-black text-white font-display flex items-center gap-2">
                  {semanticFootprint} <span className="text-xs text-slate-500 font-mono">TXS</span>
              </div>
          </div>
          <div className="bg-black border border-intuition-border p-6 clip-path-slant relative overflow-hidden">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">Sentiment Bias</div>
              <div className="relative h-4 bg-slate-800 rounded-full mt-4 overflow-hidden flex">
                  <div style={{ width: `${sentimentBias.trust}%` }} className="bg-intuition-success h-full transition-all duration-1000"></div>
                  <div style={{ width: `${sentimentBias.distrust}%` }} className="bg-intuition-danger h-full transition-all duration-1000"></div>
              </div>
              <div className="flex justify-between text-[10px] mt-1 font-mono font-bold">
                  <span className="text-intuition-success">{sentimentBias.trust.toFixed(0)}% BULL</span>
                  <span className="text-intuition-danger">{sentimentBias.distrust.toFixed(0)}% BEAR</span>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Exposure Chart */}
          <div className="bg-black border border-intuition-border p-6 clip-path-slant h-[300px]">
              <h3 className="text-xs font-bold text-white font-mono uppercase mb-4 flex items-center gap-2"><PieIcon size={14}/> Category Exposure</h3>
              {exposureData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie data={exposureData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
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
              ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs">NO ASSETS TO CATEGORIZE</div>
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
                  <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs">NO TRANSACTION HISTORY</div>
              )}
          </div>
      </div>

      {/* Positions Table */}
      <div className="bg-black border border-intuition-border clip-path-slant mb-8">
          <div className="p-4 border-b border-intuition-border bg-intuition-card flex justify-between items-center">
              <h3 className="font-bold text-white font-display tracking-widest flex items-center gap-2"><Zap size={16} className="text-intuition-warning"/> ACTIVE_POSITIONS</h3>
              <button 
                onClick={handleRefresh} 
                className="text-slate-500 hover:text-white transition-colors"
                title="Refresh Assets"
              >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
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
                                      {p.atom?.image && <img src={p.atom.image} className="w-6 h-6 rounded-full object-cover border border-white/10" />}
                                      <div className="font-bold">{p.atom?.label || p.id.slice(0,8)}</div>
                                  </Link>
                                  <div className="text-[10px] text-slate-600 font-mono">{p.id}</div>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500">
                                  <span className="bg-slate-800 px-2 py-1 rounded border border-slate-700">{p.atom ? calculateCategoryExposure([{value: 1, atom: p.atom}])[0]?.name : 'UNKNOWN'}</span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono">{p.shares.toFixed(4)}</td>
                              <td className="px-6 py-4 text-right text-intuition-success font-mono font-bold">{p.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {CURRENCY_SYMBOL}</td>
                              <td className="px-6 py-4 text-right">
                                  <Link to={`/markets/${p.id}`} className="px-3 py-1 bg-white/5 border border-white/10 hover:bg-intuition-primary/20 hover:border-intuition-primary hover:text-intuition-primary text-[10px] font-bold rounded transition-colors">MANAGE</Link>
                              </td>
                          </tr>
                      )) : (
                          <tr><td colSpan={5} className="p-12 text-center text-slate-600 font-mono italic">
                              {loading ? 'SCANNING LEDGER...' : 'NO ACTIVE POSITIONS FOUND ON-CHAIN'}
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
                      {history.map((tx, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-3 text-slate-500">{new Date(tx.timestamp).toLocaleString()}</td>
                              <td className={`px-6 py-3 font-bold ${tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-rose-400'}`}>{tx.type}</td>
                              <td className="px-6 py-3 text-white">
                                  <Link to={`/markets/${tx.vaultId}`} className="hover:underline">{tx.assetLabel || tx.vaultId?.slice(0,8) || 'Unknown'}</Link>
                              </td>
                              <td className="px-6 py-3 text-right">{parseFloat(formatEther(BigInt(tx.assets || '0'))).toFixed(4)}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

    </div>
  );
};

export default Portfolio;