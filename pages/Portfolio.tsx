import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatEther } from 'viem';
import { connectWallet, getConnectedAccount, getWalletBalance, getLocalTransactions, getShareBalance, getQuoteRedeem } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds } from '../services/graphql';
import { Wallet, Activity, RefreshCw, Zap, Shield, User, Loader2, TrendingUp, Coins, Lock, Radio, ChevronRight, AlertCircle, Clock, CheckCircle2, Binary, Terminal } from 'lucide-react';
import { Transaction } from '../types';
import { toast } from '../components/Toast';
import { playHover, playClick } from '../services/audio';
import { calculateCategoryExposure, calculateSentimentBias, formatDisplayedShares, calculatePositionPnL, formatMarketValue } from '../services/analytics';
import { CURRENCY_SYMBOL, OFFSET_PROGRESSIVE_CURVE_ID } from '../constants';
import { Link } from 'react-router-dom';

const COLORS = ['#00f3ff', '#00ff9d', '#a855f7', '#facc15', '#ff1e6d', '#ff8c00', '#00ced1'];

const StatCard: React.FC<{ label: string; value: string; unit: string; icon: any; trendColor?: string }> = ({ label, value, unit, icon: Icon, trendColor }) => (
  <div className="bg-black/40 border border-slate-900 p-6 clip-path-slant relative group hover:border-white/20 transition-all flex flex-col justify-between h-36">
    <div className="absolute top-6 right-6 text-slate-700 group-hover:text-slate-500 transition-colors">
      <Icon size={24} strokeWidth={1.5} />
    </div>
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 bg-current rounded-full opacity-60"></div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className={`text-4xl font-black font-display tracking-tight group-hover:text-intuition-primary transition-colors leading-none ${trendColor || 'text-white'}`}>
        {value}
      </div>
      <div className="text-[10px] font-black text-intuition-primary uppercase tracking-[0.3em] pt-1">{unit}</div>
    </div>
  </div>
);

const Portfolio: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState('0.00');
  const [portfolioValue, setPortfolioValue] = useState('0.00');
  const [netPnL, setNetPnL] = useState(0);
  const [sentimentBias, setSentimentBias] = useState({ trust: 64, distrust: 36 }); 
  const [exposureData, setExposureData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const isRefreshingRef = useRef(false);

  const fetchUserData = useCallback(async (address: string) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setLoading(true);
    
    try {
      const bal = await getWalletBalance(address);
      setBalance(Number(bal).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }));

      // 1. DISCOVERY & DEEP DEDUPLICATION
      const chainHistory = await getUserHistory(address).catch(() => []);
      const localHistory = getLocalTransactions(address);
      const graphPositionsRaw = await getUserPositions(address).catch(() => []);

      const uniqueGraphPositionsMap = new Map();
      graphPositionsRaw.forEach((p: any) => {
        const id = p.vault?.term?.atom?.term_id || p.vault?.term?.triple?.term_id;
        if (id && !uniqueGraphPositionsMap.has(id.toLowerCase())) {
          uniqueGraphPositionsMap.set(id.toLowerCase(), p);
        }
      });
      const graphPositions = Array.from(uniqueGraphPositionsMap.values());

      const chainHashes = new Set(chainHistory.map(tx => tx.id.split('-')[0].toLowerCase()));
      const filteredLocal = localHistory.filter(tx => !chainHashes.has(tx.id.split('-')[0].toLowerCase()));
      const mergedHistory = [...filteredLocal, ...chainHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      setHistory(mergedHistory);
      setSentimentBias(calculateSentimentBias(mergedHistory));

      // 2. RECONCILE POSITIONS
      let aggregatedValue = 0;
      let aggregatedPnL = 0;

      const livePositions = await Promise.all(graphPositions.map(async (p: any) => {
          try {
              const atom = p.vault.term.atom;
              const triple = p.vault.term.triple;
              const id = atom?.term_id || triple?.term_id;
              if (!id) return null;

              const curveId = atom ? 1 : 2;
              const sharesRaw = await getShareBalance(address, id, curveId);
              const sharesNum = parseFloat(sharesRaw);
              
              if (sharesNum <= 0.000001) return null;

              const valueStr = await getQuoteRedeem(sharesRaw, id, address, curveId);
              const value = parseFloat(valueStr);

              if (value <= 0.000001) return null;

              let label = `Node ${id.slice(0, 6)}`;
              let image = null;

              if (atom) {
                  label = atom.label || label;
                  image = atom.image;
              } else if (triple) {
                  const s = triple.subject?.label || '...';
                  const pred = triple.predicate?.label || 'LINK';
                  const o = triple.object?.label || '...';
                  label = `${s} ${pred} ${o}`;
                  image = triple.subject?.image;
              }

              const { pnlPercent, profit } = calculatePositionPnL(sharesNum, value, mergedHistory, id);

              aggregatedValue += value;
              aggregatedPnL += profit;

              return {
                  id,
                  shares: sharesNum,
                  value: value, 
                  pnl: pnlPercent,
                  atom: { label, id, image }
              };
          } catch (e) {
              return null;
          }
      }));

      const finalPositions = livePositions.filter(Boolean) as any[];
      setPositions(finalPositions);
      setExposureData(calculateCategoryExposure(finalPositions));
      
      setPortfolioValue(aggregatedValue.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }));
      setNetPnL(aggregatedPnL);

      // 3. --- TEMPORAL CHART CONSTRUCTION ---
      let currentEquity = 0;
      // We sort ascending for the line flow
      const historyPoints = [...mergedHistory].sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0)).map(tx => {
          let val = 0;
          try { 
              const raw = tx.assets ? tx.assets.toString() : '0';
              val = raw.includes('.') ? parseFloat(raw) : parseFloat(formatEther(BigInt(raw))); 
          } catch(e) {}
          if (tx.type === 'DEPOSIT') currentEquity += val;
          else currentEquity -= val;
          return { 
            timestamp: tx.timestamp, 
            val: currentEquity,
            dateLabel: new Date(tx.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          };
      });
      
      // Ensure we have at least one point at current time to show a flat line to present
      if (historyPoints.length > 0) {
        historyPoints.push({ 
          timestamp: Date.now(), 
          val: currentEquity, 
          dateLabel: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) 
        });
      } else {
        historyPoints.push({ timestamp: Date.now(), val: 0, dateLabel: 'NOW' });
      }
      setChartData(historyPoints);

    } catch (e) {
      console.error("NEURAL_SYNC_FAILURE", e);
    } finally {
      setLoading(false);
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const acc = await getConnectedAccount();
      if (!mounted) return;
      setAccount(acc);
      if (acc) fetchUserData(acc);
      else setLoading(false);
    };
    init();

    const handleUpdate = () => { 
        if (mounted) getConnectedAccount().then(acc => acc && fetchUserData(acc));
    };

    window.addEventListener('local-tx-updated', handleUpdate);
    return () => {
        mounted = false;
        window.removeEventListener('local-tx-updated', handleUpdate);
    };
  }, [fetchUserData]);

  if (!account) return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center bg-transparent relative overflow-hidden font-mono px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,243,255,0.03)_0%,transparent_70%)] pointer-events-none"></div>
      <div className="relative z-10 w-full max-w-[500px] animate-in fade-in zoom-in-95 duration-700">
        <div className="bg-[#020308] border-2 border-intuition-primary/20 p-12 flex flex-col items-center text-center clip-path-slant shadow-[0_0_120px_rgba(0,0,0,1)] relative overflow-hidden group">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-intuition-secondary px-8 py-1.5 text-[10px] font-black text-white tracking-[0.4em] uppercase clip-path-slant shadow-glow-red">DISCONNECTED</div>
            <div className="mt-12 mb-10 relative">
                <div className="absolute -inset-10 bg-intuition-primary/10 blur-[40px] rounded-full animate-pulse"></div>
                <div className="relative w-20 h-20 bg-black border-2 border-intuition-primary flex items-center justify-center text-intuition-primary clip-path-slant shadow-glow-blue transition-all duration-700 group-hover:scale-110">
                    <Lock size={32} className="animate-pulse" />
                </div>
            </div>
            <div className="mb-10 space-y-2">
                <h1 className="text-5xl font-black text-white font-display uppercase tracking-tighter">PORTFOLIO_LOCK</h1>
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.2em] font-black px-6">Establish neural sync to view semantic assets and protocol earnings.</p>
            </div>
            <button 
                onClick={connectWallet}
                className="w-full py-5 bg-intuition-primary text-black font-black font-display uppercase tracking-[0.2em] clip-path-slant shadow-glow-blue hover:bg-white transition-all active:scale-95"
            >
                ESTABLISH_UPLINK
            </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-10 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard label="Wallet Balance" value={balance} unit="TRUST" icon={Wallet} />
        <StatCard label="Total Equity" value={portfolioValue} unit="TRUST" icon={Coins} />
        <StatCard label="Net PnL" value={`${netPnL > 0 ? '+' : ''}${netPnL.toFixed(4)}`} unit="TRUST" icon={TrendingUp} trendColor={netPnL >= 0 ? 'text-intuition-success' : 'text-intuition-danger'} />
        <div className="bg-black/40 border border-slate-900 p-6 clip-path-slant flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sentiment_Bias</span>
            <Activity size={20} className="text-slate-700" />
          </div>
          <div className="flex gap-1 h-1.5 mt-4">
            <div style={{ width: `${sentimentBias.trust}%` }} className="bg-intuition-success shadow-glow-success"></div>
            <div style={{ width: `${sentimentBias.distrust}%` }} className="bg-intuition-danger shadow-glow-red"></div>
          </div>
          <div className="flex justify-between text-[8px] font-black font-mono mt-2">
            <span className="text-intuition-success">BULLISH {sentimentBias.trust.toFixed(0)}%</span>
            <span className="text-intuition-danger">BEARISH {sentimentBias.distrust.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
            <div className="bg-black border border-slate-900 clip-path-slant shadow-2xl overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-900 bg-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Zap size={20} className="text-intuition-primary animate-pulse" />
                        <h3 className="text-sm font-black text-white font-display uppercase tracking-widest">Active_Holdings</h3>
                    </div>
                    <button onClick={() => account && fetchUserData(account)} className="text-slate-500 hover:text-white transition-colors">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                        <thead className="text-slate-700 uppercase font-black tracking-widest border-b border-slate-900 bg-[#080808]">
                            <tr>
                                <th className="px-8 py-4">Asset_Identity</th>
                                <th className="px-8 py-4">Position_Size</th>
                                <th className="px-8 py-4">Current_Valuation</th>
                                <th className="px-8 py-4 text-right">PnL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {positions.length > 0 ? positions.map((pos) => (
                                <tr key={pos.id} className="hover:bg-white/5 transition-all group">
                                    <td className="px-8 py-6">
                                        <Link to={`/markets/${pos.id}`} className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-900 border border-slate-800 clip-path-slant flex items-center justify-center overflow-hidden group-hover:border-intuition-primary transition-all">
                                                {pos.atom.image ? <img src={pos.atom.image} className="w-full h-full object-cover" /> : <User size={16} className="text-slate-700" />}
                                            </div>
                                            <div>
                                                <div className="font-black text-white uppercase text-sm group-hover:text-intuition-primary transition-colors">{pos.atom.label}</div>
                                                <div className="text-[9px] text-slate-600">ID: {pos.id.slice(0, 14)}...</div>
                                            </div>
                                        </Link>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-white font-black">{formatDisplayedShares(pos.shares)}</div>
                                        <div className="text-[9px] text-slate-600 uppercase">PORTAL_UNITS</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-white font-black">{formatMarketValue(pos.value)}</div>
                                        <div className="text-[9px] text-slate-600 uppercase">{CURRENCY_SYMBOL}</div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className={`font-black text-sm ${pos.pnl >= 0 ? 'text-intuition-success' : 'text-intuition-danger'}`}>
                                            {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}%
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px]">
                                        {loading ? 'SYNCHRONIZING_CHAIN_DATA...' : 'NULL_POSITIONS_DETECTED'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-black border border-slate-900 clip-path-slant p-8">
                <h3 className="text-xs font-black text-white uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                    <Clock size={16} className="text-intuition-secondary" /> Transmission_History
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {history.map((tx, idx) => (
                        <div key={tx.id + idx} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 clip-path-slant group hover:border-white/10 transition-all">
                            <div className="flex items-center gap-5">
                                <div className={`w-1 h-8 ${tx.type === 'DEPOSIT' ? 'bg-intuition-success' : 'bg-intuition-danger'}`}></div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase ${tx.type === 'DEPOSIT' ? 'text-intuition-success' : 'text-intuition-danger'}`}>{tx.type === 'DEPOSIT' ? 'ACQUIRE' : 'LIQUIDATE'}</span>
                                        <span className="text-white font-black text-xs uppercase">{tx.assetLabel || 'NODE'}</span>
                                    </div>
                                    <div className="text-[8px] text-slate-600 font-mono">TX: {tx.id.slice(0, 24)}...</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-white font-black text-sm">{(() => {
                                    try {
                                        const raw = tx.assets ? tx.assets.toString() : '0';
                                        const val = raw.includes('.') ? parseFloat(raw) : parseFloat(formatEther(BigInt(raw)));
                                        return val.toFixed(4);
                                    } catch { return '0.0000'; }
                                })()} {CURRENCY_SYMBOL}</div>
                                <div className="text-[8px] text-slate-600 font-mono uppercase">{new Date(tx.timestamp).toLocaleString()}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
            {/* --- IMPROVED EQUITY CHART MATCHING INSPO --- */}
            <div className="bg-[#02040a] border border-slate-900 p-10 clip-path-slant shadow-2xl relative overflow-hidden group hover:border-intuition-primary/20 transition-all h-[520px] flex flex-col">
                <div className="flex justify-between items-start mb-12 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center mr-1">
                            <span className="text-[9px] font-black text-intuition-primary leading-none">01</span>
                            <span className="text-[9px] font-black text-intuition-primary leading-none">10</span>
                        </div>
                        <h4 className="text-[12px] font-black font-display text-white uppercase tracking-[0.4em] flex items-center gap-2">
                            EQUITY_VOLUME_TEMPORAL
                        </h4>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-intuition-primary font-mono text-glow-blue leading-none">
                            {portfolioValue} <span className="text-xs uppercase ml-1">TRUST</span>
                        </div>
                        <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">CURRENT_EST_VALUE</div>
                    </div>
                </div>

                <div className="flex-1 w-full relative z-10 py-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="temporalGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 6" stroke="#ffffff05" vertical={true} />
                            <XAxis 
                                dataKey="timestamp" 
                                stroke="#475569" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={20}
                                hide
                            />
                            <YAxis 
                                orientation="right" 
                                stroke="#475569" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                domain={['auto', 'auto']}
                                padding={{ top: 20, bottom: 20 }}
                                tickFormatter={(v) => v.toFixed(2)}
                            />
                            <RechartTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }} />
                            <Area 
                                type="stepAfter" 
                                dataKey="val" 
                                stroke="#00f3ff" 
                                strokeWidth={3} 
                                fill="url(#temporalGrad)" 
                                dot={{ r: 4, fill: '#00f3ff', strokeWidth: 0, stroke: '#00f3ff' }}
                                activeDot={{ r: 6, fill: '#fff', stroke: '#00f3ff', strokeWidth: 2 }}
                                isAnimationActive={true} 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between opacity-50 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="text-[9px] font-black font-mono text-slate-500 uppercase tracking-[0.3em]">MAINNET_NEURAL_TELEMETRY_SYNCHRONIZED</div>
                    </div>
                    <div className="flex gap-1.5">
                        {[...Array(5)].map((_, i) => <div key={i} className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div>)}
                    </div>
                </div>
            </div>

            <div className="bg-black border border-slate-900 p-10 clip-path-slant h-[400px] flex flex-col relative overflow-hidden group hover:border-white/10 transition-all">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                    <Activity size={120} />
                </div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-10">Asset_Exposure_Index</h4>
                <div className="h-[220px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={exposureData.length > 0 ? exposureData : [{ name: 'Empty', value: 1 }]} 
                                innerRadius={60} 
                                outerRadius={90} 
                                paddingAngle={5} 
                                dataKey="value"
                            >
                                {exposureData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                                {exposureData.length === 0 && <Cell fill="#1a1a1a" />}
                            </Pie>
                            <RechartTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-auto space-y-2 max-h-[100px] overflow-y-auto custom-scrollbar">
                    {exposureData.map((e, i) => (
                        <div key={i} className="flex justify-between items-center text-[9px] font-black font-mono">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                <span className="text-slate-400 uppercase">{e.name}</span>
                            </div>
                            <span className="text-white">{e.value.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;