
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatEther } from 'viem';
import { connectWallet, getConnectedAccount, getWalletBalance, getLocalTransactions, getShareBalance, getQuoteRedeem } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds } from '../services/graphql';
import { Wallet, Activity, RefreshCw, Zap, Shield, User, Loader2, TrendingUp, Coins, Lock, Radio, ChevronRight, AlertCircle, Clock, CheckCircle2, Terminal } from 'lucide-react';
import { Transaction } from '../types';
import { toast } from '../components/Toast';
import { playHover, playClick } from '../services/audio';
import { calculateCategoryExposure, calculateSentimentBias, formatDisplayedShares, calculatePositionPnL, formatMarketValue, smartParseValue, calculateGlobalPnL } from '../services/analytics';
import { CURRENCY_SYMBOL, OFFSET_PROGRESSIVE_CURVE_ID } from '../constants';
import { Link } from 'react-router-dom';

const COLORS = ['#00f3ff', '#00ff9d', '#a855f7', '#facc15', '#ff1e6d', '#ff8c00', '#00ced1'];

const PortfolioTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const time = new Date(payload[0].payload.timestamp);
    return (
      <div className="bg-black/95 border-2 border-intuition-primary/60 p-4 clip-path-slant shadow-[0_0_50px_rgba(0,0,0,1)] backdrop-blur-xl z-50">
        <div className="flex items-center gap-3 mb-3 border-b border-white/10 pb-2">
            <div className="w-2 h-2 bg-intuition-primary rounded-full animate-pulse shadow-[0_0_10px_#00f3ff]"></div>
            <span className="text-[10px] font-black font-mono text-intuition-primary uppercase tracking-[0.3em] text-glow-blue">TELEMETRY_READOUT</span>
        </div>
        <div className="space-y-2">
            <div className="text-2xl font-black text-white font-display tracking-tight leading-none">
                {val.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} <span className="text-[10px] text-slate-500 font-mono ml-1">{CURRENCY_SYMBOL}</span>
            </div>
            <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest flex justify-between">
                <span>Timestamp:</span>
                <span className="text-slate-300">{time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>
      </div>
    );
  }
  return null;
};

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
  const [sentimentBias, setSentimentBias] = useState({ trust: 50, distrust: 50 }); 
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

      const chainHistory = await getUserHistory(address).catch(() => []);
      const localHistory = getLocalTransactions(address);
      const graphPositions = await getUserPositions(address).catch(() => []);

      const chainHashes = new Set(chainHistory.map(tx => tx.id.split('-')[0].toLowerCase()));
      const uniqueLocal = localHistory.filter(tx => !chainHashes.has(tx.id.split('-')[0].toLowerCase()));
      const mergedHistory = [...uniqueLocal, ...chainHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      setHistory(mergedHistory);
      setSentimentBias(calculateSentimentBias(mergedHistory));

      const discoveryVaultIds = Array.from(new Set([
          ...graphPositions.map((p: any) => p.vault?.term_id?.toLowerCase()),
          ...mergedHistory.map(tx => tx.vaultId?.toLowerCase())
      ])).filter(Boolean) as string[];

      const metadata = await getVaultsByIds(discoveryVaultIds).catch(() => []);
      
      const livePositionsRaw = await Promise.all(discoveryVaultIds.map(async (id) => {
          try {
              const meta = metadata.find(m => m.id.toLowerCase() === id);
              const curveId = meta?.type === 'CLAIM' ? 2 : 1; 
              
              const sharesRaw = await getShareBalance(address, id, curveId);
              const sharesNum = parseFloat(sharesRaw);
              
              if (sharesNum <= 0.0000001) return null;

              const valueStr = await getQuoteRedeem(sharesRaw, id, address, curveId);
              const value = parseFloat(valueStr);

              const { profit, pnlPercent } = calculatePositionPnL(sharesNum, value, mergedHistory, id);

              return {
                  id,
                  shares: sharesNum,
                  value: value, 
                  pnl: pnlPercent,
                  profit: profit,
                  atom: meta || { label: `Node ${id.slice(0,6)}`, id, image: null, type: 'ATOM' }
              };
          } catch (e) { return null; }
      }));

      const finalPositions = livePositionsRaw.filter(Boolean) as any[];
      setPositions(finalPositions);
      setExposureData(calculateCategoryExposure(finalPositions));
      
      const totalEquity = finalPositions.reduce((acc, p) => acc + p.value, 0);
      const totalGlobalProfit = calculateGlobalPnL(totalEquity, mergedHistory);
      
      setPortfolioValue(totalEquity.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }));
      setNetPnL(totalGlobalProfit);

      // --- ADVANCED CHART DATA PROCESSING ---
      let currentStaked = 0;
      const chronological = [...mergedHistory].sort((a, b) => a.timestamp - b.timestamp);
      
      const historyPoints = chronological.map(tx => {
          const val = smartParseValue(tx.assets);
          if (tx.type === 'DEPOSIT') currentStaked += val;
          else currentStaked -= val;
          return { 
              timestamp: tx.timestamp, 
              val: parseFloat(currentStaked.toFixed(4)),
              type: tx.type 
          };
      });

      // Pad with start and end to show continuous volume
      if (historyPoints.length > 0) {
          // Prepend a 'zero' start point slightly before the first tx for better visualization
          const firstTs = historyPoints[0].timestamp;
          historyPoints.unshift({ timestamp: firstTs - 3600000, val: 0, type: 'INIT' });
          
          // Append 'Now' to show current total equity value at current time
          historyPoints.push({ timestamp: Date.now(), val: totalEquity, type: 'NOW' });
      } else {
          historyPoints.push({ timestamp: Date.now(), val: 0, type: 'NULL' });
      }
      setChartData(historyPoints);

    } catch (e) {
      console.error("NEURAL_SYNC_ERROR", e);
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

    const handleUpdate = () => { if (mounted) getConnectedAccount().then(acc => acc && fetchUserData(acc)); };
    window.addEventListener('local-tx-updated', handleUpdate);
    return () => { mounted = false; window.removeEventListener('local-tx-updated', handleUpdate); };
  }, [fetchUserData]);

  if (!account) return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center font-mono px-4">
      <div className="bg-[#020308] border-2 border-intuition-primary/20 p-12 flex flex-col items-center text-center clip-path-slant shadow-[0_0_120px_rgba(0,0,0,1)] relative overflow-hidden group">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-intuition-secondary px-8 py-1.5 text-[10px] font-black text-white tracking-[0.4em] uppercase clip-path-slant shadow-glow-red">DISCONNECTED</div>
            <div className="mt-12 mb-10 relative">
                <div className="absolute -inset-10 bg-intuition-primary/10 blur-[40px] rounded-full animate-pulse"></div>
                <div className="relative w-20 h-20 bg-black border-2 border-intuition-primary flex items-center justify-center text-intuition-primary clip-path-slant shadow-glow-blue">
                    <Lock size={32} className="animate-pulse" />
                </div>
            </div>
            <div className="mb-10 space-y-2">
                <h1 className="text-5xl font-black text-white font-display uppercase tracking-tighter">VAULT_LOCK</h1>
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.2em] font-black px-6">Neural sync required for position verification.</p>
            </div>
            <button onClick={connectWallet} className="w-full py-5 bg-intuition-primary text-black font-black font-display uppercase tracking-[0.2em] clip-path-slant shadow-glow-blue hover:bg-white transition-all active:scale-95">ESTABLISH_NEURAL_LINK</button>
        </div>
    </div>
  );

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-10 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard label="Liquid TRUST" value={balance} unit="TRUST" icon={Wallet} />
        <StatCard label="Claimable Equity" value={portfolioValue} unit="TRUST" icon={Coins} />
        <StatCard label="Protocol PnL" value={`${netPnL >= 0 ? '+' : ''}${netPnL.toFixed(4)}`} unit="TRUST" icon={TrendingUp} trendColor={netPnL >= 0 ? 'text-intuition-success' : 'text-intuition-danger'} />
        <div className="bg-black/40 border border-slate-900 p-6 clip-path-slant flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Signal_Bias</span>
            <Activity size={20} className="text-slate-700" />
          </div>
          <div className="flex gap-1 h-1.5 mt-4">
            <div style={{ width: `${sentimentBias.trust}%` }} className="bg-intuition-success shadow-glow-success"></div>
            <div style={{ width: `${sentimentBias.distrust}%` }} className="bg-intuition-danger shadow-glow-red"></div>
          </div>
          <div className="flex justify-between text-[8px] font-black font-mono mt-2 uppercase">
            <span className="text-intuition-success">TRUST {sentimentBias.trust.toFixed(0)}%</span>
            <span className="text-intuition-danger">SKEPTIC {sentimentBias.distrust.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
            <div className="bg-black border border-slate-900 clip-path-slant shadow-2xl overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-900 bg-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Zap size={20} className="text-intuition-primary animate-pulse" />
                        <h3 className="text-sm font-black text-white font-display uppercase tracking-widest">Active_Positions ({positions.length} Nodes Verified)</h3>
                    </div>
                    <button onClick={() => account && fetchUserData(account)} className="text-slate-500 hover:text-white transition-colors group">
                        <RefreshCw size={16} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                        <thead className="text-slate-700 uppercase font-black tracking-widest border-b border-slate-900 bg-[#080808]">
                            <tr>
                                <th className="px-8 py-4">Node_Identity</th>
                                <th className="px-8 py-4">Position_Shares</th>
                                <th className="px-8 py-4">Redeem_Valuation</th>
                                <th className="px-8 py-4 text-right">PnL_Delta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {positions.length > 0 ? positions.map((pos) => (
                                <tr key={pos.id} className="hover:bg-white/5 transition-all group">
                                    <td className="px-8 py-6">
                                        <Link to={`/markets/${pos.id}`} className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-900 border border-slate-800 clip-path-slant flex items-center justify-center overflow-hidden group-hover:border-intuition-primary transition-all shadow-glow-blue">
                                                {pos.atom.image ? <img src={pos.atom.image} className="w-full h-full object-cover" /> : <User size={16} className="text-slate-700" />}
                                            </div>
                                            <div>
                                                <div className="font-black text-white uppercase text-sm group-hover:text-intuition-primary transition-colors">{pos.atom.label}</div>
                                                <div className="text-[9px] text-slate-600">ID: {pos.id.slice(0, 16)}...</div>
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
                                        {loading ? 'SYNCHRONIZING_ON_CHAIN_STATE...' : 'NULL_POSITIONS_DETECTED'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-black border border-slate-900 clip-path-slant p-8">
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                    <Clock size={16} className="text-intuition-secondary" /> Protocol_History_Sync
                </h3>
                <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                    {history.map((tx, idx) => (
                        <div key={tx.id + idx} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 clip-path-slant group hover:border-white/10 transition-all">
                            <div className="flex items-center gap-5">
                                <div className={`w-0.5 h-8 ${tx.type === 'DEPOSIT' ? 'bg-intuition-success' : 'bg-intuition-danger'}`}></div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase ${tx.type === 'DEPOSIT' ? 'text-intuition-success' : 'text-intuition-danger'}`}>{tx.type === 'DEPOSIT' ? 'ACQUIRE' : 'LIQUIDATE'}</span>
                                        <span className="text-white font-black text-xs uppercase">{tx.assetLabel || 'UNIDENTIFIED_NODE'}</span>
                                    </div>
                                    <div className="text-[8px] text-slate-600 font-mono">TX_HASH: {tx.id.slice(0, 24)}...</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-white font-black text-sm">{smartParseValue(tx.assets).toFixed(4)} {CURRENCY_SYMBOL}</div>
                                <div className="text-[8px] text-slate-600 font-mono uppercase">{new Date(tx.timestamp).toLocaleString()}</div>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && (
                        <div className="text-center py-10 text-slate-700 font-mono text-[9px] uppercase tracking-widest border border-dashed border-slate-900">NULL_TRANSCRIPTS</div>
                    )}
                </div>
            </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
            <div className="bg-[#02040a] border-2 border-slate-900 p-10 clip-path-slant shadow-2xl relative overflow-hidden group hover:border-intuition-primary/20 transition-all">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                    <Activity size={120} />
                </div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-10 text-glow-white">Asset_Sector_Distribution</h4>
                <div className="h-[250px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={exposureData.length > 0 ? exposureData : [{ name: 'Null', value: 1 }]} 
                                innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value"
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
                <div className="mt-8 space-y-3">
                    {exposureData.map((e, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] font-black font-mono">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                <span className="text-slate-400 uppercase tracking-widest">{e.name}</span>
                            </div>
                            <span className="text-white">{e.value.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-black border border-slate-900 p-8 clip-path-slant h-[500px] relative group hover:border-white/10 transition-all shadow-2xl flex flex-col">
                <div className="flex justify-between items-center mb-8">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                        <Terminal size={14} className="text-intuition-primary animate-pulse" /> Equity_Volume_Temporal
                    </h4>
                    <div className="flex flex-col items-end">
                        <div className="text-[12px] font-mono text-intuition-primary text-glow-blue font-black uppercase tracking-widest">
                            {parseFloat(portfolioValue.replace(/,/g, '')).toFixed(4)} {CURRENCY_SYMBOL}
                        </div>
                        <div className="text-[7px] text-slate-600 font-mono uppercase tracking-[0.2em]">CURRENT_EST_VALUE</div>
                    </div>
                </div>

                <div className="flex-1 w-full relative group/chart">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                            <defs>
                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 6" stroke="#ffffff08" vertical={true} />
                            <XAxis 
                                dataKey="timestamp" 
                                type="number"
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={(ts) => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                tick={{ fill: '#334155', fontSize: 8, fontFamily: 'Fira Code' }}
                                axisLine={{ stroke: '#ffffff10' }}
                                tickLine={false}
                            />
                            <YAxis 
                                orientation="right"
                                domain={[0, 'auto']} 
                                tick={{ fill: '#475569', fontSize: 9, fontFamily: 'Fira Code', fontWeight: 'bold' }}
                                axisLine={false}
                                tickLine={false}
                                width={60}
                                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v.toFixed(2)}
                            />
                            <RechartTooltip content={<PortfolioTooltip />} cursor={{ stroke: '#00f3ff', strokeWidth: 1, strokeDasharray: '3 3' }} />
                            <Area 
                                type="stepAfter" 
                                dataKey="val" 
                                stroke="#00f3ff" 
                                strokeWidth={3} 
                                fill="url(#colorVal)" 
                                isAnimationActive={true} 
                                animationDuration={1200}
                                dot={{ r: 2.5, fill: '#00f3ff', strokeWidth: 1, stroke: '#000' }}
                                activeDot={{ r: 6, fill: '#fff', stroke: '#00f3ff', strokeWidth: 3 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="pt-6 border-t border-white/5 flex items-center justify-between opacity-60">
                    <div className="text-[7px] text-slate-700 uppercase tracking-[0.4em] font-black italic">
                        Mainnet_Neural_Telemetry_Synchronized
                    </div>
                    <div className="flex gap-1.5">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="w-1.5 h-1.5 bg-intuition-primary/20 rounded-full clip-path-slant"></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
