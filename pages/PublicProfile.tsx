
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getWalletBalance, getShareBalance, getQuoteRedeem, resolveENS, reverseResolveENS } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds, getUserActivityStats } from '../services/graphql';
import { User, PieChart as PieIcon, Activity, Zap, Shield, TrendingUp, Layers, RefreshCw, Search, ArrowRight, AlertTriangle, Database, Wallet, Loader2, Fingerprint, Activity as PulseIcon } from 'lucide-react';
import { formatEther, isAddress } from 'viem';
import { Transaction } from '../types';
import { calculateCategoryExposure, calculateSentimentBias, formatMarketValue, formatDisplayedShares } from '../services/analytics';
import { CURRENCY_SYMBOL, DISTRUST_ATOM_ID } from '../constants';
import { CurrencySymbol } from '../components/CurrencySymbol';
import { playClick } from '../services/audio';
import { toast } from '../components/Toast';

const COLORS = ['#00f3ff', '#00ff9d', '#ff0055', '#facc15', '#94a3b8'];

const PublicProfile: React.FC = () => {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const [ensName, setEnsName] = useState<string | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioValue, setPortfolioValue] = useState('0.00');
  const [ethBalance, setEthBalance] = useState('0.00');
  const [sentimentBias, setSentimentBias] = useState({ trust: 50, distrust: 50 });
  const [exposureData, setExposureData] = useState<any[]>([]);
  const [semanticFootprint, setSemanticFootprint] = useState(0);
  const [activeHoldingsCount, setActiveHoldingsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (address) fetchUserData(address);
  }, [address]);

  const fetchUserData = async (addr: string) => {
    setLoading(true);
    try {
      reverseResolveENS(addr).then(setEnsName);
      const bal = await getWalletBalance(addr);
      setEthBalance(Number(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

      // High-precision parallel fetch
      const [graphPositions, chainHistory, activityStats] = await Promise.all([
          getUserPositions(addr).catch(() => []),
          getUserHistory(addr).catch(() => []),
          getUserActivityStats(addr).catch(() => ({ txCount: 0, holdingsCount: 0 }))
      ]);
      
      const uniqueVaultIds = Array.from(new Set([
          ...graphPositions.map((p: any) => p.vault?.term_id?.toLowerCase()),
          ...chainHistory.map(tx => tx.vaultId?.toLowerCase())
      ])).filter(Boolean) as string[];

      const metadata = await getVaultsByIds(uniqueVaultIds).catch(() => []);
      
      let totalAssetsSum = 0;

      const DUST = 1e-10; // treat below this as zero (sold / dust)
      const graphWithShares = graphPositions.filter((p: any) => {
        const s = p.shares;
        if (s === undefined || s === null) return false;
        const n = typeof s === 'string' ? parseFloat(s) : Number(s);
        return n > DUST;
      });

      // Only show positions the user currently holds (on-chain verified)
      const livePositions = await Promise.all(graphWithShares.map(async (p: any) => {
          const id = p.vault.term_id.toLowerCase();
          const curveId = Number(p.vault.curve_id || 1);
          const meta = metadata.find(m => m.id.toLowerCase() === id);
          
          const sharesRaw = await getShareBalance(addr, id, curveId);
          const sharesNum = parseFloat(sharesRaw);
          
          if (!(sharesNum > DUST)) return null;

          const valueStr = await getQuoteRedeem(sharesRaw, id, addr, curveId);
          const value = parseFloat(valueStr);
          totalAssetsSum += value;

          let label = meta?.label || `Agent ${id.slice(0,6)}...`;
          let image = meta?.image;
          let type = meta?.type || 'ATOM';

          // Handle Triple/Opposition labels for public recon
          const triple = p.vault?.term?.triple;
          const isCounter = triple?.counter_term_id?.toLowerCase() === id.toLowerCase();
          const pointsToDistrust = triple?.object?.term_id?.toLowerCase().includes(DISTRUST_ATOM_ID.toLowerCase().slice(26));

          if (isCounter || pointsToDistrust) {
              const subjectLabel = triple?.subject?.label || triple?.subject?.term_id?.slice(0, 8) || 'NODE';
              label = `OPPOSING_${subjectLabel}`.toUpperCase();
              image = triple?.subject?.image;
              type = 'CLAIM';
          }

          return {
              id,
              shares: sharesNum,
              value: value,
              atom: { label, id, image, type }
          };
      }));

      const finalPositions = livePositions.filter(Boolean) as any[];
      setPositions(finalPositions);
      setActiveHoldingsCount(activityStats.holdingsCount || finalPositions.length);
      setExposureData(calculateCategoryExposure(finalPositions));
      
      // Update Global Magnitude Display based purely on live position value
      setPortfolioValue(
        totalAssetsSum.toLocaleString(undefined, {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        }),
      );

      const mergedHistory = chainHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setHistory(mergedHistory);

      // SEMANTIC FOOTPRINT: fall back to active holdings if no explicit history
      const footprintCount =
        activityStats.txCount && activityStats.txCount > 0
          ? activityStats.txCount
          : (mergedHistory.length > 0 ? mergedHistory.length : finalPositions.length);
      setSemanticFootprint(footprintCount); 

      // SENTIMENT BIAS: use history when available, otherwise infer from holdings
      if (mergedHistory.length > 0) {
          setSentimentBias(calculateSentimentBias(mergedHistory));
      } else if (finalPositions.length > 0) {
          // Power users with holdings but no on-chain events yet: show bullish bias
          setSentimentBias({ trust: 95, distrust: 5 });
      } else {
          setSentimentBias({ trust: 50, distrust: 50 });
      }
      
      // Reconstruct temporal growth chart
      let currentRunningVol = 0;
      let chartPoints = mergedHistory
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          .map((tx, idx) => {
              try {
                  const assetVal = parseFloat(formatEther(BigInt(tx.assets || '0')));
                  currentRunningVol += assetVal > 0 ? assetVal : 0;
              } catch (e) {}
              return { idx, val: currentRunningVol };
          });
      
      if (chartPoints.length === 0 && finalPositions.length > 0) {
          chartPoints = [
              { idx: 0, val: 0 },
              { idx: 1, val: totalAssetsSum }
          ];
      }
      setVolumeData(chartPoints);

    } catch (e) {
      console.error("PROFILE_RECON_FAILURE:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
      const cleanQuery = searchQuery.trim();
      if (isAddress(cleanQuery)) {
          playClick();
          navigate(`/profile/${cleanQuery}`);
          setSearchQuery('');
          return;
      }
      if (cleanQuery.endsWith('.eth')) {
          playClick();
          setIsResolving(true);
          try {
              const resolvedAddress = await resolveENS(cleanQuery);
              if (resolvedAddress) {
                  navigate(`/profile/${resolvedAddress}`);
                  setSearchQuery('');
              } else { toast.error(`ENS NOT FOUND: ${cleanQuery}`); }
          } catch (e) { toast.error("ENS RESOLUTION FAILED"); } finally { setIsResolving(false); }
      }
  };

  return (
    <div className="min-h-screen bg-[#020308] pt-8 pb-20 px-4 max-w-7xl mx-auto font-mono selection:bg-intuition-primary selection:text-black">
      <div className="flex justify-end mb-8 relative z-20">
          <div className="flex items-center bg-black border border-slate-800 p-1 clip-path-slant focus-within:border-intuition-primary transition-all shadow-2xl">
              <input 
                  type="text" 
                  placeholder="QUERY_PLAYER: [0x... | .eth]" 
                  className="bg-transparent text-white font-mono text-[10px] px-4 outline-none w-72 uppercase tracking-widest"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={isResolving}
              />
              <button 
                  onClick={handleSearch}
                  disabled={!isAddress(searchQuery.trim()) && !searchQuery.trim().endsWith('.eth') || isResolving}
                  className="bg-slate-900 text-slate-500 p-1 hover:text-white hover:bg-intuition-primary transition-all w-8 h-8 flex items-center justify-center clip-path-slant"
              >
                  {isResolving ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              </button>
          </div>
      </div>

      <div className="mb-12 p-1 bg-gradient-to-r from-intuition-primary/40 via-white/10 to-intuition-primary/40 rounded-none clip-path-slant shadow-[0_0_50px_rgba(0,243,255,0.05)]">
        <div className="bg-[#050505] p-10 flex flex-col md:flex-row items-center gap-10 clip-path-slant relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
          <div className="w-28 h-28 bg-black border-2 border-slate-800 flex items-center justify-center shadow-2xl group relative clip-path-slant">
            <div className="absolute inset-0 bg-intuition-primary/5 group-hover:bg-intuition-primary/10 transition-colors"></div>
            <User size={56} className="text-slate-600 group-hover:text-intuition-primary transition-colors" />
          </div>
          <div className="flex-1 text-center md:text-left relative z-10">
            <div className="text-slate-500 font-mono text-[10px] tracking-[0.4em] uppercase mb-3 font-black">Reputation_Profile_S04</div>
            <h1 className="text-4xl md:text-5xl font-black text-white font-display tracking-tighter mb-1 text-glow-white uppercase">
                {ensName || (address ? address.slice(0, 6) + "..." + address.slice(-4) : "INVALID_IDENT")}
            </h1>
            {ensName && (
                <div className="text-[11px] font-black font-mono text-intuition-primary/60 tracking-widest mb-6 bg-black w-fit px-3 py-1 border border-intuition-primary/20 clip-path-slant">
                    {address}
                </div>
            )}
            {!ensName && <div className="mb-4"></div>}
            <div className="flex flex-wrap gap-4 justify-center md:justify-start font-mono text-[9px] font-black uppercase">
              <span className="bg-intuition-primary/10 text-intuition-primary px-3 py-1.5 border border-intuition-primary/30 clip-path-slant">LEVEL: {activeHoldingsCount > 50 ? 'ELITE_TRADER' : activeHoldingsCount > 10 ? 'MASTER_TRADER' : 'RECON_LEVEL_1'}</span>
              <span className="bg-white/5 text-slate-400 px-3 py-1.5 border border-white/10 clip-path-slant">
                  {activeHoldingsCount >= 100 ? `${activeHoldingsCount}+` : activeHoldingsCount} ACTIVE_HOLDINGS
              </span>
              <span className="bg-black text-slate-300 px-3 py-1.5 border border-slate-800 flex items-center gap-2 clip-path-slant">
                  <Wallet size={10} className="text-intuition-primary" /> {ethBalance} {CURRENCY_SYMBOL}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div className="bg-black border border-slate-900 p-8 clip-path-slant group hover:border-intuition-primary/40 transition-all shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform"><Shield size={80}/></div>
              <div className="text-[9px] font-black font-mono text-slate-600 uppercase mb-4 tracking-[0.3em] flex items-center gap-3">
                  <Activity size={14} className="text-intuition-primary" /> Protocol_Assets
              </div>
              <div className="text-4xl font-black text-white font-display tracking-tighter text-glow-white inline-flex items-baseline gap-2"><CurrencySymbol size="2xl" leading />{portfolioValue}</div>
          </div>
          <div className="bg-black border border-slate-900 p-8 clip-path-slant group hover:border-intuition-secondary/40 transition-all shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform"><Layers size={80}/></div>
              <div className="text-[9px] font-black font-mono text-slate-600 uppercase mb-4 tracking-[0.3em] flex items-center gap-3">
                  <Database size={14} className="text-intuition-secondary" /> Semantic_Footprint
              </div>
              <div className="text-4xl font-black text-white font-display flex items-center gap-3">
                  {semanticFootprint >= 100 ? `${semanticFootprint}+` : semanticFootprint}
                  <span className="text-[10px] text-slate-500 font-mono tracking-widest font-black uppercase">TXs_Logged</span>
              </div>
          </div>
          <div className="bg-black border border-slate-900 p-8 clip-path-slant group hover:border-intuition-primary/30 transition-all shadow-2xl relative overflow-hidden">
              <div className="text-[9px] font-black font-mono text-slate-600 uppercase mb-4 tracking-[0.3em] flex items-center gap-3">
                  <PulseIcon size={14} className="text-intuition-primary animate-pulse" /> Sentiment_Bias
              </div>
              <div className="flex items-center gap-1.5 h-1.5 w-full px-1 mt-6 relative">
                <div className="flex-1 flex justify-end h-full relative overflow-visible">
                    <div style={{ width: `${sentimentBias.trust}%` }} className="h-full bg-intuition-success shadow-[0_0_15px_#00ff9d] transition-all duration-1000 origin-right"></div>
                    <div style={{ width: `${sentimentBias.trust}%` }} className="absolute inset-0 bg-intuition-success/30 blur-[3px] animate-pulse pointer-events-none"></div>
                </div>
                <div className="w-px h-2.5 bg-white/20 shrink-0 z-10"></div>
                <div className="flex-1 flex justify-start h-full relative overflow-visible">
                    <div style={{ width: `${sentimentBias.distrust}%` }} className="h-full bg-intuition-danger shadow-[0_0_15px_#ff1e6d] transition-all duration-1000 origin-left"></div>
                    <div style={{ width: `${sentimentBias.distrust}%` }} className="absolute inset-0 bg-intuition-danger/30 blur-[3px] animate-pulse pointer-events-none"></div>
                </div>
              </div>
              <div className="flex justify-between items-end text-[9px] font-black font-mono mt-4 uppercase tracking-widest">
                  <div className="flex flex-col">
                      <span className="text-intuition-success text-glow-success">BULLISH</span>
                      <span className="text-white text-[11px] mt-0.5">{sentimentBias.trust.toFixed(0)}%</span>
                  </div>
                  <div className="flex flex-col items-end">
                      <span className="text-intuition-danger text-glow-red">BEARISH</span>
                      <span className="text-white text-[11px] mt-0.5">{sentimentBias.distrust.toFixed(0)}%</span>
                  </div>
              </div>
          </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-black border border-slate-900 p-10 clip-path-slant h-[360px] flex flex-col shadow-2xl relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><PieIcon size={120} /></div>
              <h3 className="text-[10px] font-black text-white uppercase mb-8 tracking-[0.4em] flex items-center gap-4 relative z-10"><Zap size={16} className="text-intuition-primary"/> Asset_Cluster_Index</h3>
              {exposureData.length > 0 ? (
                  <div className="flex items-center h-full relative z-10">
                      <div className="w-1/2 h-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie data={exposureData} innerRadius={50} outerRadius={85} paddingAngle={6} dataKey="value" nameKey="name" stroke="none">
                                      {exposureData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }} />
                              </PieChart>
                          </ResponsiveContainer>
                      </div>
                      <div className="w-1/2 pl-6 flex flex-col justify-center gap-4 overflow-y-auto max-h-[260px] custom-scrollbar">
                          {exposureData.map((entry, index) => (
                              <div key={index} className="flex items-center justify-between group/item">
                                  <div className="flex items-center gap-3">
                                      <div className="w-2 h-2 rounded-none clip-path-slant shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest group-hover/item:text-white transition-colors">{entry.name}</span>
                                  </div>
                                  <span className="text-[10px] font-black text-white">{entry.value.toFixed(0)}%</span>
                              </div>
                          ))}
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex items-center justify-center text-slate-700 text-[8px] font-black tracking-[0.5em] border border-dashed border-slate-900 uppercase">NULL_CLUSTER_DATA</div>
              )}
          </div>
          <div className="lg:col-span-2 bg-[#020408] border border-slate-900 p-10 clip-path-slant h-[360px] flex flex-col shadow-2xl group overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-intuition-primary/5 via-transparent to-transparent opacity-40"></div>
              <h3 className="text-[10px] font-black text-white uppercase mb-8 tracking-[0.4em] flex items-center gap-4 relative z-10"><Activity size={16} className="text-intuition-primary animate-pulse"/> Temporal_Signal_Volume</h3>
              <div className="flex-1 relative z-10">
                {volumeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={volumeData}>
                            <defs>
                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 6" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="idx" hide />
                            <YAxis hide />
                            <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }} />
                            <Area type="stepAfter" dataKey="val" stroke="#00f3ff" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" isAnimationActive={true} animationDuration={1000} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-700 text-[8px] font-black tracking-[0.5em] border border-dashed border-slate-900 uppercase">NULL_TEMPORAL_DATA</div>
                )}
              </div>
          </div>
      </div>

      <div className="bg-black border border-slate-900 clip-path-slant overflow-hidden shadow-2xl">
          <div className="p-4 sm:p-6 md:p-8 border-b border-slate-900 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-[10px] sm:text-xs font-black text-white font-display tracking-[0.2em] sm:tracking-[0.3em] uppercase flex items-center gap-4"><Fingerprint size={20} className="text-slate-500 shrink-0"/> Public_Holding_Ledger</h3>
              <div className="text-[8px] font-black text-slate-700 uppercase tracking-[0.4em]">Verified_On_Intuition_Mainnet</div>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[9px] sm:text-[10px] min-w-[480px]">
                  <thead className="bg-[#080808] text-slate-600 font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] border-b border-slate-900">
                      <tr>
                          <th className="px-3 sm:px-6 md:px-10 py-4 md:py-6">Identity_Node</th>
                          <th className="px-3 sm:px-6 md:px-10 py-4 md:py-6">Sector</th>
                          <th className="px-3 sm:px-6 md:px-10 py-4 md:py-6 text-right">Magnitude</th>
                          <th className="px-3 sm:px-6 md:px-10 py-4 md:py-6 text-right">Net_Valuation</th>
                          <th className="px-3 sm:px-6 md:px-10 py-4 md:py-6 text-right">Recon</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {positions.length > 0 ? positions.map((p, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-all group relative">
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6">
                                  <Link to={`/markets/${p.id}`} className="flex items-center gap-3 sm:gap-6 group-hover:text-intuition-primary transition-colors">
                                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 border-2 border-slate-800 clip-path-slant flex items-center justify-center overflow-hidden group-hover:border-intuition-primary transition-all shadow-xl shrink-0">
                                          {p.atom?.image ? <img src={p.atom.image} className="w-full h-full object-cover" /> : <User size={20} className="text-slate-700" />}
                                      </div>
                                      <div>
                                          <div className={`font-black text-sm group-hover:text-intuition-primary transition-colors uppercase leading-none mb-1.5 tracking-tight ${p.atom?.type === 'CLAIM' ? 'text-intuition-danger' : 'text-white'}`}>{p.atom?.label || p.id.slice(0,8)}</div>
                                          <div className="text-[8px] text-slate-600 font-mono tracking-widest uppercase">ID: {p.id.slice(0, 18)}...</div>
                                      </div>
                                  </Link>
                              </td>
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6">
                                  <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-white/5 border border-white/10 text-slate-500 font-black uppercase text-[8px] tracking-[0.1em] clip-path-slant group-hover:text-white transition-colors">{p.atom?.type || 'STANDARD_ATOM'}</span>
                              </td>
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6 text-right font-black text-xs sm:text-sm text-white">{formatDisplayedShares(p.shares)}</td>
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6 text-right">
                                  <div className="inline-flex items-baseline gap-1.5 justify-end font-black text-xs sm:text-sm text-intuition-success tracking-tight">
                                      <CurrencySymbol size="sm" leading className="text-intuition-primary/90" />
                                      {formatMarketValue(p.value)}
                                  </div>
                              </td>
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6 text-right">
                                  <Link to={`/markets/${p.id}`} className="inline-flex min-h-[44px] px-4 sm:px-6 py-2 bg-white/5 border border-white/10 hover:border-intuition-primary text-[9px] font-black uppercase clip-path-slant transition-all tracking-widest items-center justify-center">Inspect</Link>
                              </td>
                          </tr>
                      )) : (
                          <tr><td colSpan={5} className="p-20 text-center text-slate-700 uppercase font-black tracking-[0.5em] text-[10px]">
                              {loading ? (
                                  <div className="flex flex-col items-center gap-5">
                                      <div className="w-10 h-10 border-2 border-intuition-primary/20 border-t-intuition-primary rounded-full animate-spin"></div>
                                      <span>Synchronizing_Public_Sync...</span>
                                  </div>
                              ) : (
                                  'NULL_HOLDINGS_RECOVERED_FROM_MAINNET'
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

export default PublicProfile;
