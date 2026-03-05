
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatEther, getAddress } from 'viem';
import { connectWallet, getConnectedAccount, getWalletBalance, getShareBalance, getQuoteRedeem, getLocalTransactions } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds, getAccountPnlCurrent, getCurveLabel } from '../services/graphql';
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
  <div className="relative group overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900/90 via-black to-black border border-slate-800/80 p-4 sm:p-5 md:p-6 xl:p-6 shadow-[0_18px_45px_rgba(0,0,0,0.7)] hover:border-intuition-primary/40 transition-all flex flex-col justify-between min-h-[116px] sm:min-h-[128px] xl:min-h-[140px] 2xl:min-h-[152px] min-w-0">
    <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_top_left,rgba(0,243,255,0.18),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.18),transparent_55%)]" />
    <div className="absolute top-4 right-4 xl:top-5 xl:right-5 text-slate-700 group-hover:text-slate-300 transition-colors z-10 shrink-0">
      <Icon className="w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 2xl:w-8 2xl:h-8" strokeWidth={1.5} />
    </div>
    <div className="space-y-1 relative z-10 pr-8 sm:pr-10 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-1 sm:mb-2 min-w-0">
        <div className="w-1.5 h-1.5 bg-current rounded-full opacity-60 shrink-0"></div>
        <span className="text-[10px] xl:text-xs 2xl:text-sm font-black text-slate-500 uppercase tracking-[0.2em] truncate block min-w-0">{label}</span>
      </div>
      <div className={`text-2xl sm:text-3xl md:text-4xl xl:text-4xl 2xl:text-5xl font-black font-display tracking-tight group-hover:text-intuition-primary transition-colors leading-none flex items-baseline gap-1 min-w-0 overflow-hidden ${trendColor || 'text-white'}`}>
        {typeof unit === 'string' ? <span className="text-2xl sm:text-3xl md:text-4xl xl:text-4xl 2xl:text-5xl font-bold text-intuition-primary/90 mr-1 sm:mr-2 align-baseline shrink-0">{unit}</span> : unit}
        <span className="tabular-nums truncate block min-w-0" title={value}>{value}</span>
      </div>
    </div>
  </div>
);

const Portfolio: React.FC = () => {
  const { address: wagmiAddress } = useAccount();
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

      const DUST = 1e-8; // treat below this as zero (sold / dust) — strict so closed positions never show
      const graphWithShares = graphPositionsRaw.filter((p: any) => {
        const s = p.shares;
        if (s === undefined || s === null) return false;
        const n = typeof s === 'string' ? parseFloat(s) : Number(s);
        return n > DUST;
      });

      // Active holdings = only what the user is currently holding (on-chain verified)
      for (const p of graphWithShares) {
          try {
              const rawId = p.vault?.term_id;
              if (!rawId || typeof rawId !== 'string') continue;
              const id = rawId.toLowerCase();
              const meta = metadata.find(m => m.id.toLowerCase() === id);
              const rawCurve = p.vault.curve_id ?? meta?.curveId;
              const curveId = rawCurve != null ? Number(rawCurve) || 1 : 1;

              const sharesRaw = await getShareBalance(address, id, curveId);
              const sharesNum = typeof sharesRaw === 'string' ? parseFloat(sharesRaw) : Number(sharesRaw);
              const hasBalance = Number.isFinite(sharesNum) && sharesNum > DUST;
              if (!hasBalance) continue;

              const valueStr = await getQuoteRedeem(String(sharesRaw), id, address, curveId);
              const value = parseFloat(valueStr);

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

              const { pnlPercent, profit } = calculatePositionPnL(sharesNum, value, networkHistory, id, curveId);
              const depositsForVault = networkHistory.filter((t: Transaction) => t.vaultId?.toLowerCase() === id && t.type === 'DEPOSIT' && (curveId == null || t.curveId == null || t.curveId === curveId));
              const firstDepositTimestamp = depositsForVault.length ? Math.min(...depositsForVault.map((t: Transaction) => t.timestamp)) : Date.now();

              aggregatedValue += value;
              aggregatedPnL += profit;

              const duplicate = activePositions.some((x: any) => x.id === id && (x.curveId ?? 1) === (curveId ?? 1));
              if (!duplicate) activePositions.push({ id, curveId, shares: sharesNum, value: value, pnl: pnlPercent, atom: { label, id, image, type }, firstDepositTimestamp });
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

  // Sync connected address from wagmi so we react when user connects (header already shows connected)
  useEffect(() => {
    if (wagmiAddress) {
      setAccount(wagmiAddress);
      fetchUserData(wagmiAddress);
    } else {
      setAccount(null);
      setLoading(false);
    }
  }, [wagmiAddress]); // eslint-disable-line react-hooks/exhaustive-deps -- fetchUserData is stable enough

  useEffect(() => {
    let mounted = true;
    const handleUpdate = () => {
      if (mounted && account) fetchUserData(account);
    };
    window.addEventListener('local-tx-updated', handleUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('local-tx-updated', handleUpdate);
    };
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center bg-transparent relative overflow-hidden font-mono px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,243,255,0.03)_0%,transparent_70%)] pointer-events-none"></div>
      <div className="relative z-10 w-full max-w-[500px] animate-in fade-in zoom-in-95 duration-700">
        <div className="bg-[#020308] border-2 border-intuition-primary/30 p-10 sm:p-12 flex flex-col items-center text-center rounded-3xl shadow-[0_0_120px_rgba(0,0,0,1)] relative overflow-hidden group">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-intuition-secondary px-8 py-1.5 text-[10px] font-black text-white tracking-[0.4em] uppercase rounded-b-2xl shadow-glow-red">DISCONNECTED</div>
            <div className="mt-12 mb-10 relative">
                <div className="absolute -inset-10 bg-intuition-primary/10 blur-[40px] rounded-full animate-pulse"></div>
                <div className="relative w-20 h-20 bg-black border-2 border-intuition-primary flex items-center justify-center text-intuition-primary rounded-3xl shadow-glow-blue transition-all duration-700 group-hover:scale-110">
                    <Lock size={32} className="animate-pulse" />
                </div>
            </div>
            <div className="mb-10 space-y-2">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-display uppercase tracking-tighter">PORTFOLIO_LOCK</h1>
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.2em] font-black px-6">Establish neural sync to view semantic assets and protocol earnings.</p>
            </div>
            <button 
                onClick={connectWallet}
                className="w-full py-5 bg-intuition-primary text-black font-black font-display uppercase tracking-[0.2em] rounded-full shadow-glow-blue hover:bg-white transition-all active:scale-95"
            >
                ESTABLISH_UPLINK
            </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full min-w-0 max-w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-8 sm:pt-10 pb-16 sm:pb-20 font-mono overflow-x-hidden">
      <div className="w-full max-w-full mx-auto mb-8 sm:mb-10 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-[#020818] to-black shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-slate-900/60 px-4 sm:px-6 md:px-8 xl:px-10 py-6 sm:py-8 md:py-10 min-w-0">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 xl:gap-8">
        <StatCard label="Wallet Balance" value={balance} unit={<CurrencySymbol size="2xl" leading />} icon={Wallet} />
        <StatCard label="Total Equity" value={portfolioValue} unit={<CurrencySymbol size="2xl" leading />} icon={Coins} />
        <StatCard label="Net PnL" value={`${netPnL > 0 ? '+' : ''}${netPnL.toFixed(4)}`} unit={<CurrencySymbol size="2xl" leading />} icon={TrendingUp} trendColor={netPnL >= 0 ? 'text-intuition-success' : 'text-intuition-danger'} />
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900/90 via-black to-black border border-slate-800/80 p-4 sm:p-5 md:p-6 flex flex-col justify-between min-h-[116px] sm:min-h-[128px] xl:min-h-[140px] group hover:border-intuition-primary/40 transition-all min-w-0">
          <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(248,113,113,0.18),transparent_55%)]" />
          <div className="flex items-center justify-between relative z-10 min-w-0 gap-2">
            <span className="text-[10px] xl:text-xs 2xl:text-sm font-black text-slate-500 uppercase tracking-[0.2em] truncate min-w-0" title="SENTIMENT_BIAS">SENTIMENT_BIAS</span>
            <PulseIcon className="w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 text-slate-700 group-hover:text-intuition-primary transition-colors animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5 h-2 w-full px-1 relative z-10">
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
      </div>

      <div className="w-full max-w-full mx-auto grid grid-cols-1 gap-6 sm:gap-8 lg:gap-10 min-w-0">
        {/* Row 1: Ledger beside Equity Vol + Asset Exposure */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 min-w-0">
        {/* Active Holdings Ledger */}
        <div className="lg:col-span-7 xl:col-span-8 w-full min-w-0 overflow-hidden">
          <div className="bg-black border border-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-4 sm:px-5 md:px-6 xl:px-8 py-4 sm:py-5 md:py-6 border-b border-slate-900 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 text-intuition-primary animate-pulse shrink-0" />
                <h3 className="text-xs sm:text-sm md:text-base xl:text-lg font-black text-white font-display uppercase tracking-widest break-words min-w-0">Active_Holdings_Ledger</h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest mr-2">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => { playClick(); setSortBy(e.target.value as any); }}
                  onMouseEnter={playHover}
                  className="bg-black border border-slate-700 text-slate-300 font-mono text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-full focus:border-intuition-primary outline-none"
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
            <div className="overflow-x-auto overflow-y-hidden min-h-[280px] sm:min-h-[320px] -mx-px">
              <table className="w-full text-left font-mono text-xs sm:text-sm xl:text-base table-fixed min-w-[600px]" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '24%', minWidth: 0 }} />
                  <col style={{ width: '10%', minWidth: 0 }} />
                  <col style={{ width: '12%', minWidth: 0 }} />
                  <col style={{ width: '14%', minWidth: 0 }} />
                  <col style={{ width: '14%', minWidth: 0 }} />
                  <col style={{ width: '12%', minWidth: 0 }} />
                  <col style={{ width: '14%', minWidth: 0 }} />
                </colgroup>
                <thead className="text-slate-600 uppercase font-black tracking-widest border-b border-slate-900 bg-[#080808] text-[10px] sm:text-xs xl:text-sm">
                  <tr>
                    <th className="px-2 sm:px-3 md:px-4 xl:px-5 py-3 sm:py-4 md:py-5 overflow-hidden">Identity_Node</th>
                    <th className="px-2 sm:px-3 md:px-4 xl:px-5 py-3 sm:py-4 md:py-5 hidden lg:table-cell overflow-hidden">Sector</th>
                    <th className="px-2 sm:px-3 md:px-4 xl:px-5 py-3 sm:py-4 md:py-5 overflow-hidden">Curve</th>
                    <th className="px-2 sm:px-3 md:px-4 xl:px-5 py-3 sm:py-4 md:py-5 overflow-hidden">Magnitude</th>
                    <th className="px-2 sm:px-3 md:px-4 xl:px-5 py-3 sm:py-4 md:py-5 overflow-hidden">Net_Valuation</th>
                    <th className="px-2 sm:px-3 md:px-4 xl:px-5 py-3 sm:py-4 md:py-5 text-right overflow-hidden">PnL</th>
                    <th className="px-2 sm:px-3 md:px-4 xl:px-5 py-3 sm:py-4 md:py-5 text-right overflow-hidden">Exit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedPositions.length > 0 ? sortedPositions.map((pos) => {
                    const isOpposition = pos.atom.label.includes('OPPOSING');
                    return (
                      <tr key={`${pos.id}-${pos.curveId ?? 1}`} className="hover:bg-white/5 transition-all group">
                        <td className="px-2 sm:px-3 md:px-4 xl:px-5 py-4 sm:py-5 md:py-6 min-w-0 overflow-hidden align-top">
                          <Link to={`/markets/${pos.id}`} className="flex items-center gap-2 sm:gap-4 min-w-0">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 xl:w-11 xl:h-11 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl flex items-center justify-center overflow-hidden group-hover:border-intuition-primary transition-all shrink-0">
                              {pos.atom.image ? <img src={pos.atom.image} className="w-full h-full object-cover" alt="" /> : <User className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-slate-700" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`font-black uppercase text-xs sm:text-sm xl:text-base group-hover:text-intuition-primary transition-colors truncate ${isOpposition ? 'text-intuition-danger' : 'text-white'}`} title={pos.atom.label}>{pos.atom.label}</div>
                              <div className="text-[10px] sm:text-xs text-slate-600 font-bold truncate">UID: {pos.id.slice(0, 14)}...</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-2 sm:px-3 md:px-4 xl:px-5 py-4 sm:py-5 md:py-6 hidden lg:table-cell overflow-hidden align-top">
                          <span className="inline-block px-2 py-0.5 sm:px-2.5 sm:py-1 bg-white/5 border border-white/10 text-slate-500 font-black uppercase text-[10px] sm:text-xs tracking-widest rounded-full group-hover:text-white transition-colors whitespace-nowrap max-w-full truncate">{pos.atom?.type || 'ATOM'}</span>
                        </td>
                        <td className="px-2 sm:px-3 md:px-4 xl:px-5 py-4 sm:py-5 md:py-6 overflow-hidden align-top">
                          <span className="text-[10px] sm:text-xs xl:text-sm font-black text-slate-400 uppercase block truncate" title={getCurveLabel(pos.curveId ?? 1)}>{getCurveLabel(pos.curveId ?? 1)}</span>
                        </td>
                        <td className="px-2 sm:px-3 md:px-4 xl:px-5 py-4 sm:py-5 md:py-6 overflow-hidden align-top">
                          <div className="text-white font-black text-xs sm:text-sm tabular-nums truncate">{formatDisplayedShares(pos.shares)}</div>
                          <div className="text-[10px] sm:text-xs text-slate-600 uppercase font-bold tracking-widest truncate">PORTAL_UNITS</div>
                        </td>
                        <td className="px-2 sm:px-3 md:px-4 xl:px-5 py-4 sm:py-5 md:py-6 overflow-hidden align-top">
                          <div className="inline-flex items-baseline gap-1.5 text-white font-black text-xs sm:text-sm min-w-0 truncate">
                            <CurrencySymbol size="sm" leading className="text-intuition-primary/90 shrink-0" />
                            <span className="truncate">{formatMarketValue(pos.value)}</span>
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 md:px-4 xl:px-5 py-4 sm:py-5 md:py-6 text-right overflow-hidden align-top">
                          <div className={`font-black text-xs sm:text-sm xl:text-base whitespace-nowrap ${pos.pnl >= 0 ? 'text-intuition-success' : 'text-intuition-danger'}`}>
                            {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}%
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 md:px-4 xl:px-5 py-4 sm:py-5 md:py-6 text-right overflow-hidden align-top">
                          <Link
                            to={`/markets/${pos.id}`}
                            onClick={() => { playClick(); }}
                            onMouseEnter={playHover}
                            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 border border-intuition-danger/50 text-intuition-danger hover:bg-intuition-danger/10 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-full transition-all whitespace-nowrap shrink-0"
                          >
                            <LogOut size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" /> Exit
                          </Link>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7} className="px-8 py-20 text-center text-slate-600 uppercase font-black tracking-widest text-xs sm:text-sm">
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
        </div>

        {/* Sidebar: Equity Vol + Asset Exposure (beside ledger) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 sm:space-y-8 min-w-0">
            <div className="bg-[#02040a] border border-slate-900 p-4 sm:p-6 xl:p-8 rounded-2xl sm:rounded-3xl shadow-2xl relative overflow-hidden group hover:border-intuition-primary/20 transition-all min-h-[360px] sm:min-h-[400px] xl:min-h-[440px] 2xl:min-h-[480px] flex flex-col">
                <div className="flex justify-between items-start mb-4 sm:mb-6 relative z-10 gap-4 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 shrink">
                        <div className="flex flex-col items-center mr-1 shrink-0">
                            <span className="text-[10px] font-black text-intuition-primary leading-none">01</span>
                            <span className="text-[10px] font-black text-intuition-primary leading-none">10</span>
                        </div>
                        <h4 className="text-[10px] sm:text-xs xl:text-sm font-black font-display text-white uppercase tracking-[0.35em] flex items-center gap-2 truncate">
                            EQUITY_VOLUME_TEMPORAL
                        </h4>
                    </div>
                    <div className="text-right shrink-0 pr-1 min-w-0">
                        <div className="text-xl sm:text-2xl xl:text-3xl 2xl:text-4xl font-black text-intuition-primary font-mono text-glow-blue leading-none inline-flex items-baseline gap-2 min-w-0">
                            <CurrencySymbol size="xl" leading className="text-intuition-primary/90 shrink-0" />
                            <span className="tabular-nums truncate max-w-[100px] sm:max-w-[140px] xl:max-w-[180px]" title={portfolioValue}>{portfolioValue}</span>
                        </div>
                        <div className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest mt-1 sm:mt-1.5">CURRENT_EST_VALUE</div>
                    </div>
                </div>

                <div className="flex-1 w-full min-h-[200px] sm:min-h-[240px] xl:min-h-[260px] relative z-10 py-1 sm:py-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
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
                                width={44}
                                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                                tickLine={false} 
                                axisLine={false} 
                                domain={['auto', 'auto']}
                                tickFormatter={(v) => Number(v).toFixed(0)}
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

                <div className="mt-4 pt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="text-xs font-black font-mono text-slate-600 uppercase tracking-[0.25em]">MAINNET_NEURAL_TELEMETRY_SYNCHRONIZED</div>
                    </div>
                </div>
            </div>

            <div className="bg-black border border-slate-900 p-4 sm:p-6 xl:p-8 rounded-2xl sm:rounded-3xl min-h-[320px] sm:min-h-[360px] xl:min-h-[400px] 2xl:min-h-[420px] flex flex-col relative overflow-hidden group hover:border-white/10 transition-all shadow-2xl">
                <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000 text-intuition-primary">
                    <PulseIcon className="w-40 h-40 sm:w-48 sm:h-48 xl:w-56 xl:h-56" />
                </div>
                
                <h4 className="text-[10px] sm:text-xs xl:text-sm font-black text-slate-500 uppercase tracking-[0.35em] mb-4 sm:mb-6 relative z-10">Asset_Exposure_Index</h4>
                
                <div className="flex-1 flex flex-col items-center justify-center relative z-10 min-h-0">
                    <div className="w-full h-[160px] sm:h-[200px] xl:h-[240px] 2xl:h-[260px] mb-6 sm:mb-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={exposureData.length > 0 ? exposureData : [{ name: 'AWAITING_SIGNAL', value: 1 }]} 
                                    innerRadius={65} 
                                    outerRadius={92} 
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

                    <div className="w-full space-y-3 overflow-y-auto max-h-[200px] custom-scrollbar pr-2">
                        {exposureData.length > 0 ? exposureData.map((entry, index) => (
                            <div key={index} className="flex items-center justify-between group/item py-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-xs font-black text-slate-400 group-hover/item:text-white transition-colors uppercase tracking-wider">{entry.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-black font-mono text-white text-glow-white">{entry.value.toFixed(1)}%</span>
                                    <div className="w-1 h-3 bg-intuition-danger/40 opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8 opacity-20 text-xs font-black font-mono uppercase tracking-[0.4em]">Awaiting_Neural_Sync...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        </div>

        {/* Row 2: Transmission History (full width) */}
        <div className="w-full min-w-0 space-y-3 sm:space-y-4">
          <h3 className="text-xs sm:text-sm md:text-base font-black text-white uppercase tracking-[0.35em] mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-intuition-secondary shrink-0" /> Transmission_History
          </h3>
          <div className="space-y-2 sm:space-y-3 max-h-[360px] sm:max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {history.map((tx, idx) => (
              <div key={tx.id + idx} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-4 sm:p-5 bg-white/5 border border-white/5 rounded-xl sm:rounded-2xl group hover:border-white/10 transition-all min-w-0">
                <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
                  <div className={`w-1 sm:w-1.5 h-8 sm:h-10 shrink-0 ${tx.type === 'DEPOSIT' ? 'bg-intuition-success shadow-glow-success' : 'bg-intuition-danger shadow-glow-red'} rounded-full`}></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] sm:text-xs font-black uppercase ${tx.type === 'DEPOSIT' ? 'text-intuition-success' : 'text-intuition-danger'}`}>{tx.type === 'DEPOSIT' ? 'ACQUIRE' : 'LIQUIDATE'}</span>
                      <span className="text-white font-black text-xs sm:text-sm uppercase truncate max-w-[140px] sm:max-w-none" title={tx.assetLabel}>{tx.assetLabel || 'UNIDENTIFIED_NODE'}</span>
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-600 font-mono mt-0.5 truncate">TX: {tx.id.slice(0, 20)}...</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white font-black text-sm sm:text-base">{(() => {
                    try {
                      return safeParseUnits(tx.assets).toFixed(4);
                    } catch { return '0.0000'; }
                  })()} <CurrencySymbol size="md" /></div>
                  <div className="text-[10px] sm:text-xs text-slate-600 font-mono uppercase mt-0.5">{new Date(tx.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="text-center py-20 text-slate-600 uppercase font-black tracking-widest text-xs sm:text-sm">
                AWAITING_INGRESS_SIGNALS...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
