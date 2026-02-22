
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatEther, getAddress } from 'viem';
import { connectWallet, getConnectedAccount, getWalletBalance, getShareBalance, getQuoteRedeem, getLocalTransactions } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds, getAccountPnlCurrent } from '../services/graphql';
import { Wallet, RefreshCw, Zap, User, Loader2, TrendingUp, Coins, Lock, Activity as PulseIcon, Clock, Terminal, Globe, Layers, LogOut } from 'lucide-react';
import { Transaction } from '../types';
import { toast } from '../components/Toast';
import { playHover, playClick } from '../services/audio';
import { calculateCategoryExposure, calculateSentimentBias, formatDisplayedShares, calculatePositionPnL, formatMarketValue, safeParseUnits } from '../services/analytics';
import { CURRENCY_SYMBOL, OFFSET_PROGRESSIVE_CURVE_ID, DISTRUST_ATOM_ID } from '../constants';
import { CurrencySymbol } from '../components/CurrencySymbol';
import { Link } from 'react-router-dom';

const COLORS = ['#00f3ff', '#00ff9d', '#a855f7', '#facc15', '#ff1e6d', '#ff8c00', '#00ced1'];

const StatCard: React.FC<{ label: string; value: string; unit: string | React.ReactNode; icon: any; trendColor?: string }> = ({ label, value, unit, icon: Icon, trendColor }) => (
  <div className="bg-black/40 border border-slate-900 p-4 sm:p-5 md:p-6 clip-path-slant relative group hover:border-white/20 transition-all flex flex-col justify-between min-h-[120px] sm:h-36">
    <div className="absolute top-6 right-6 text-slate-700 group-hover:text-slate-500 transition-colors">
      <Icon size={24} strokeWidth={1.5} />
    </div>
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 bg-current rounded-full opacity-60"></div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className={`text-4xl font-black font-display tracking-tight group-hover:text-intuition-primary transition-colors leading-none flex items-baseline gap-1 ${trendColor || 'text-white'}`}>
        {typeof unit === 'string' ? <span className="text-4xl font-bold text-intuition-primary/90 mr-2 align-baseline">{unit}</span> : unit}
        {value}
      </div>
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
  const [sortBy, setSortBy] = useState<'value_desc' | 'value_asc' | 'oldest' | 'newest'>('value_desc');
  const isRefreshingRef = useRef(false);

  const sortedPositions = useMemo(() => {
    const list = [...positions];
    if (sortBy === 'value_desc') return list.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    if (sortBy === 'value_asc') return list.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    if (sortBy === 'oldest') return list.sort((a, b) => (a.firstDepositTimestamp ?? 0) - (b.firstDepositTimestamp ?? 0));
    if (sortBy === 'newest') return list.sort((a, b) => (b.firstDepositTimestamp ?? 0) - (a.firstDepositTimestamp ?? 0));
    return list;
  }, [positions, sortBy]);

  const fetchUserData = useCallback(async (address: string) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setLoading(true);
    
    try {
      // 1. Fetch multi-source telemetry
      const [bal, chainHistory, graphPositionsRaw, pnlSnapshot] = await Promise.all([
          getWalletBalance(address),
          getUserHistory(address),
          getUserPositions(address).catch(() => []),
          getAccountPnlCurrent(address)
      ]);

      setBalance(Number(bal).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }));

      // 2. Transmission history
      // - Prefer on-network history from Graph
      // - Fall back to local (pending) history when Graph has no records yet
      const networkHistory = [...chainHistory].sort((a, b) => b.timestamp - a.timestamp);
      const localHistory = getLocalTransactions(address);

      let displayHistory: Transaction[] = [];
      if (networkHistory.length > 0) {
        const chainHashes = new Set(networkHistory.map(tx => tx.id.toLowerCase()));
        const pending = localHistory.filter(tx => !chainHashes.has(tx.id.toLowerCase()));
        displayHistory = [...pending, ...networkHistory].sort((a, b) => b.timestamp - a.timestamp);
      } else {
        displayHistory = [...localHistory].sort((a, b) => b.timestamp - a.timestamp);
      }
      setHistory(displayHistory);

      const historyVaultIds = networkHistory.map(tx => tx.vaultId?.toLowerCase()).filter(Boolean);
      const graphVaultIds = graphPositionsRaw.map((p: any) => p.vault?.term_id?.toLowerCase()).filter(Boolean);
      const candidateVaultIds = Array.from(new Set([...graphVaultIds, ...historyVaultIds])) as string[];
      
      const metadata = await getVaultsByIds(candidateVaultIds).catch(() => []);

      // 3. PRECISION INVENTORY RECONCILIATION
      const activePositions: any[] = [];
      let aggregatedValue = 0;
      let aggregatedPnL = 0;

      const DUST = 1e-10; // treat below this as zero (sold / dust)
      const graphWithShares = graphPositionsRaw.filter((p: any) => {
        const s = p.shares;
        if (s === undefined || s === null) return false;
        const n = typeof s === 'string' ? parseFloat(s) : Number(s);
        return n > DUST;
      });

      // Active holdings = only what the user is currently holding (on-chain verified)
      for (const p of graphWithShares) {
          try {
              const id = p.vault.term_id.toLowerCase();
              const curveId = Number(p.vault.curve_id || 1);

              const sharesRaw = await getShareBalance(address, id, curveId);
              const sharesNum = parseFloat(sharesRaw);
              
              // Only show positions with current on-chain balance (exclude sold / dust)
              if (!(sharesNum > DUST)) continue;

              const valueStr = await getQuoteRedeem(sharesRaw, id, address, curveId);
              const value = parseFloat(valueStr);

              let meta = metadata.find(m => m.id.toLowerCase() === id);
              let label = meta?.label || `Node_${id.slice(0, 8)}`;
              let image = meta?.image;
              let type = meta?.type || 'ATOM';

              // Triple/Opposition Mapping
              const triple = p.vault?.term?.triple;
              const isCounter = triple?.counter_term_id?.toLowerCase() === id.toLowerCase();
              const pointsToDistrust = triple?.object?.term_id?.toLowerCase().includes(DISTRUST_ATOM_ID.toLowerCase().slice(26));

              if (isCounter || pointsToDistrust) {
                  const subjectLabel = triple?.subject?.label || triple?.subject?.id?.slice(0, 8) || 'NODE';
                  label = `OPPOSING_${subjectLabel}`.toUpperCase();
                  image = triple?.subject?.image;
                  type = 'CLAIM';
              }

              const { pnlPercent, profit } = calculatePositionPnL(sharesNum, value, networkHistory, id);
              const depositsForVault = networkHistory.filter((t: Transaction) => t.vaultId?.toLowerCase() === id && t.type === 'DEPOSIT');
              const firstDepositTimestamp = depositsForVault.length ? Math.min(...depositsForVault.map((t: Transaction) => t.timestamp)) : Date.now();

              aggregatedValue += value;
              aggregatedPnL += profit;

              activePositions.push({ id, shares: sharesNum, value: value, pnl: pnlPercent, atom: { label, id, image, type }, firstDepositTimestamp });
          } catch (e) { continue; }
      }

      setPositions(activePositions);
      setExposureData(calculateCategoryExposure(activePositions));

      if (pnlSnapshot && pnlSnapshot.equity_value) {
        try {
          const eq = Number(formatEther(BigInt(pnlSnapshot.equity_value)));
          setPortfolioValue(eq.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }));
        } catch {
          setPortfolioValue(aggregatedValue.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }));
        }
      } else {
        setPortfolioValue(aggregatedValue.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }));
      }

      if (pnlSnapshot && pnlSnapshot.total_pnl) {
        try {
          const totalPnl = Number(formatEther(BigInt(pnlSnapshot.total_pnl)));
          setNetPnL(totalPnl);
        } catch {
          setNetPnL(aggregatedPnL);
        }
      } else {
        setNetPnL(aggregatedPnL);
      }
      setSentimentBias(calculateSentimentBias(displayHistory));

      // 4. Build Equity Volume Temporal chart (use same history as Transmission for consistency)
      const points: { timestamp: number; val: number }[] = [{ timestamp: Date.now(), val: aggregatedValue }];
      let runner = aggregatedValue;
      const historyForChart = displayHistory.slice(0, 100);
      for (let i = 0; i < historyForChart.length; i++) {
          const tx = historyForChart[i];
          const val = safeParseUnits(tx.assets);
          if (tx.type === 'DEPOSIT') runner -= val;
          else runner += val;
          points.push({ timestamp: tx.timestamp, val: runner });
      }
      const sorted = points.reverse();
      // Ensure at least 2 points so the area/line renders (not just a dot)
      if (sorted.length === 1) {
          sorted.unshift({
              timestamp: sorted[0].timestamp - 24 * 60 * 60 * 1000,
              val: Math.max(0, sorted[0].val - 0.01),
          });
      }
      setChartData(sorted);

    } catch (e) {
      console.error("PORTFOLIO_SYNC_FAILURE", e);
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
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-display uppercase tracking-tighter">PORTFOLIO_LOCK</h1>
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
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-10 pb-20 font-mono">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard label="Wallet Balance" value={balance} unit={<CurrencySymbol size="2xl" leading />} icon={Wallet} />
        <StatCard label="Total Equity" value={portfolioValue} unit={<CurrencySymbol size="2xl" leading />} icon={Coins} />
        <StatCard label="Net PnL" value={`${netPnL > 0 ? '+' : ''}${netPnL.toFixed(4)}`} unit={<CurrencySymbol size="2xl" leading />} icon={TrendingUp} trendColor={netPnL >= 0 ? 'text-intuition-success' : 'text-intuition-danger'} />
        <div className="bg-black/40 border border-slate-900 p-4 sm:p-5 md:p-6 clip-path-slant flex flex-col justify-between min-h-[120px] sm:h-36 group hover:border-intuition-primary/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">SENTIMENT_BIAS</span>
            <PulseIcon size={20} className="text-slate-700 group-hover:text-intuition-primary transition-colors animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5 h-2 w-full px-1 relative">
            <div className="flex-1 flex justify-end h-full relative overflow-visible">
                <div style={{ width: `${sentimentBias.trust}%` }} className="h-full bg-intuition-success shadow-[0_0_30px_#00ff9d] transition-all duration-1000 origin-right"></div>
                <div style={{ width: `${sentimentBias.trust}%` }} className="absolute inset-0 bg-intuition-success/40 blur-[8px] animate-pulse pointer-events-none"></div>
            </div>
            <div className="w-px h-3 bg-white/40 shrink-0 z-10"></div>
            <div className="flex-1 flex justify-start h-full relative overflow-visible">
                <div style={{ width: `${sentimentBias.distrust}%` }} className="h-full bg-intuition-danger shadow-[0_0_30px_#ff1e6d] transition-all duration-1000 origin-left"></div>
                <div style={{ width: `${sentimentBias.distrust}%` }} className="absolute inset-0 bg-intuition-danger/40 blur-[8px] animate-pulse pointer-events-none"></div>
            </div>
          </div>
          <div className="flex justify-between items-end text-[9px] font-black font-mono relative z-10">
            <div className="flex flex-col">
                <span className="text-intuition-success uppercase tracking-widest leading-none text-glow-success">BULLISH</span>
                <span className="text-white text-xs mt-0.5">{sentimentBias.trust.toFixed(0)}%</span>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-intuition-danger uppercase tracking-widest leading-none text-glow-red">BEARISH</span>
                <span className="text-white text-xs mt-0.5">{sentimentBias.distrust.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
            <div className="bg-black border border-slate-900 clip-path-slant shadow-2xl overflow-hidden">
                <div className="px-4 sm:px-6 md:px-8 py-4 md:py-6 border-b border-slate-900 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Zap size={20} className="text-intuition-primary animate-pulse shrink-0" />
                        <h3 className="text-xs sm:text-sm font-black text-white font-display uppercase tracking-widest">Active_Holdings_Ledger</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mr-2">Sort:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => { playClick(); setSortBy(e.target.value as any); }}
                            onMouseEnter={playHover}
                            className="bg-black border border-slate-700 text-slate-300 font-mono text-[10px] font-black uppercase tracking-wider px-3 py-2 clip-path-slant focus:border-intuition-primary outline-none"
                        >
                            <option value="value_desc">Largest → Lowest</option>
                            <option value="value_asc">Lowest → Largest</option>
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                        </select>
                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest hidden sm:inline">Verified_On_Intuition_Mainnet</span>
                        <button onClick={() => account && fetchUserData(account)} className="text-slate-500 hover:text-white transition-colors p-1">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-[10px] sm:text-xs min-w-[480px]">
                        <thead className="text-slate-700 uppercase font-black tracking-widest border-b border-slate-900 bg-[#080808]">
                            <tr>
                                <th className="px-3 sm:px-6 md:px-8 py-3 md:py-4">Identity_Node</th>
                                <th className="px-3 sm:px-6 md:px-8 py-3 md:py-4">Sector</th>
                                <th className="px-3 sm:px-6 md:px-8 py-3 md:py-4">Magnitude</th>
                                <th className="px-3 sm:px-6 md:px-8 py-3 md:py-4">Net_Valuation</th>
                                <th className="px-3 sm:px-6 md:px-8 py-3 md:py-4 text-right">PnL</th>
                                <th className="px-3 sm:px-6 md:px-8 py-3 md:py-4 text-right">Exit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sortedPositions.length > 0 ? sortedPositions.map((pos) => {
                                const isOpposition = pos.atom.label.includes('OPPOSING');
                                return (
                                <tr key={pos.id} className="hover:bg-white/5 transition-all group">
                                    <td className="px-3 sm:px-6 md:px-8 py-4 md:py-6">
                                        <Link to={`/markets/${pos.id}`} className="flex items-center gap-2 sm:gap-4">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-900 border border-slate-800 clip-path-slant flex items-center justify-center overflow-hidden group-hover:border-intuition-primary transition-all shrink-0">
                                                {pos.atom.image ? <img src={pos.atom.image} className="w-full h-full object-cover" /> : <User size={16} className="text-slate-700" />}
                                            </div>
                                            <div>
                                                <div className={`font-black uppercase text-sm group-hover:text-intuition-primary transition-colors ${isOpposition ? 'text-intuition-danger' : 'text-white'}`}>{pos.atom.label}</div>
                                                <div className="text-[9px] text-slate-600 font-bold">UID: {pos.id.slice(0, 14)}...</div>
                                            </div>
                                        </Link>
                                    </td>
                                    <td className="px-3 sm:px-6 md:px-8 py-4 md:py-6">
                                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-slate-500 font-black uppercase text-[8px] tracking-widest clip-path-slant group-hover:text-white transition-colors">{pos.atom?.type || 'ATOM'}</span>
                                    </td>
                                    <td className="px-3 sm:px-6 md:px-8 py-4 md:py-6">
                                        <div className="text-white font-black text-xs sm:text-sm">{formatDisplayedShares(pos.shares)}</div>
                                        <div className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">PORTAL_UNITS</div>
                                    </td>
                                    <td className="px-3 sm:px-6 md:px-8 py-4 md:py-6">
                                        <div className="inline-flex items-baseline gap-1.5 text-white font-black text-xs sm:text-sm">
                                            <CurrencySymbol size="sm" leading className="text-intuition-primary/90" />
                                            {formatMarketValue(pos.value)}
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-6 md:px-8 py-4 md:py-6 text-right">
                                        <div className={`font-black text-sm ${pos.pnl >= 0 ? 'text-intuition-success' : 'text-intuition-danger'}`}>
                                            {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}%
                                        </div>
                                    </td>
                                    <td className="px-3 sm:px-6 md:px-8 py-4 md:py-6 text-right">
                                        <Link
                                            to={`/markets/${pos.id}`}
                                            onClick={() => { playClick(); }}
                                            onMouseEnter={playHover}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-intuition-danger/50 text-intuition-danger hover:bg-intuition-danger/10 font-black text-[9px] uppercase tracking-widest clip-path-slant transition-all"
                                        >
                                            <LogOut size={12} /> Exit
                                        </Link>
                                    </td>
                                </tr>
                            )}) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px]">
                                        {loading ? (
                                            <div className="flex flex-col items-center gap-4">
                                                <Loader2 size={24} className="animate-spin text-intuition-primary" />
                                                SYNCHRONIZING_NETWORK_DATA...
                                            </div>
                                        ) : 'NULL_POSITIONS_DETECTED'}
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
                                <div className={`w-1 h-8 ${tx.type === 'DEPOSIT' ? 'bg-intuition-success shadow-glow-success' : 'bg-intuition-danger shadow-glow-red'}`}></div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase ${tx.type === 'DEPOSIT' ? 'text-intuition-success' : 'text-intuition-danger'}`}>{tx.type === 'DEPOSIT' ? 'ACQUIRE' : 'LIQUIDATE'}</span>
                                        <span className="text-white font-black text-xs uppercase">{tx.assetLabel || 'UNIDENTIFIED_NODE'}</span>
                                    </div>
                                    <div className="text-[8px] text-slate-600 font-mono">TX: {tx.id.slice(0, 24)}...</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-white font-black text-sm">{(() => {
                                    try {
                                        return safeParseUnits(tx.assets).toFixed(4);
                                    } catch { return '0.0000'; }
                                })()} <CurrencySymbol size="md" /></div>
                                <div className="text-[8px] text-slate-600 font-mono uppercase">{new Date(tx.timestamp).toLocaleString()}</div>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && (
                        <div className="text-center py-20 text-slate-700 uppercase font-black tracking-widest text-[10px]">
                            AWAITING_INGRESS_SIGNALS...
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
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
                        <div className="text-2xl font-black text-intuition-primary font-mono text-glow-blue leading-none inline-flex items-baseline gap-2">
                            <CurrencySymbol size="xl" leading className="text-intuition-primary/90" />
                            {portfolioValue}
                        </div>
                        <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">CURRENT_EST_VALUE</div>
                    </div>
                </div>

                <div className="flex-1 w-full relative z-10 py-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="temporalGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.05}/>
                                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 6" stroke="#ffffff08" vertical={true} horizontal={true} />
                            <XAxis dataKey="timestamp" hide />
                            <YAxis 
                                orientation="right" 
                                stroke="#475569" 
                                fontSize={10} 
                                tickLine={false} 
                                axisLine={false} 
                                domain={['auto', 'auto']}
                                tickFormatter={(v) => v.toFixed(2)}
                            />
                            <RechartTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }} />
                            <Area 
                                type="stepAfter" 
                                dataKey="val" 
                                stroke="#00f3ff" 
                                strokeWidth={2} 
                                fill="url(#temporalGrad)" 
                                isAnimationActive={true} 
                                animationDuration={1000}
                                activeDot={{ r: 4, fill: '#00f3ff', strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="text-[9px] font-black font-mono text-slate-700 uppercase tracking-[0.3em]">MAINNET_NEURAL_TELEMETRY_SYNCHRONIZED</div>
                    </div>
                </div>
            </div>

            <div className="bg-black border border-slate-900 p-10 clip-path-slant min-h-[480px] flex flex-col relative overflow-hidden group hover:border-white/10 transition-all shadow-2xl">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000 text-intuition-primary">
                    <PulseIcon size={180} />
                </div>
                
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-12 relative z-10">Asset_Exposure_Index</h4>
                
                <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                    <div className="w-full h-[220px] mb-12">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={exposureData.length > 0 ? exposureData : [{ name: 'AWAITING_SIGNAL', value: 1 }]} 
                                    innerRadius={70} 
                                    outerRadius={95} 
                                    paddingAngle={8} 
                                    dataKey="value"
                                    nameKey="name"
                                    stroke="none"
                                >
                                    {exposureData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="outline-none" />
                                    ))}
                                    {exposureData.length === 0 && <Cell fill="#111111" />}
                                </Pie>
                                <RechartTooltip 
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '0', fontSize: '10px' }}
                                    itemStyle={{ color: '#fff', fontFamily: 'monospace' }}
                                    formatter={(v: number) => `${v.toFixed(1)}%`}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="w-full space-y-4 overflow-y-auto max-h-[180px] custom-scrollbar pr-2">
                        {exposureData.length > 0 ? exposureData.map((entry, index) => (
                            <div key={index} className="flex items-center justify-between group/item">
                                <div className="flex items-center gap-4">
                                    <div className="w-3 h-3 rounded-none clip-path-slant shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-[10px] font-black text-slate-400 group-hover/item:text-white transition-colors uppercase tracking-widest">{entry.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black font-mono text-white text-glow-white">{entry.value.toFixed(1)}%</span>
                                    <div className="w-1 h-3 bg-intuition-danger/40 opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-10 opacity-20 text-[8px] font-black font-mono uppercase tracking-[0.5em]">Awaiting_Neural_Sync...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
