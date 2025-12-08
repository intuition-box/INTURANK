import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getWalletBalance, getShareBalance, getQuoteRedeem, resolveENS } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds } from '../services/graphql';
import { User, PieChart as PieIcon, Activity, Zap, Shield, TrendingUp, Layers, RefreshCw, Search, ArrowRight, AlertTriangle, Database, Wallet, Loader2 } from 'lucide-react';
import { formatEther, isAddress } from 'viem';
import { Transaction } from '../types';
import { calculateCategoryExposure, calculateSentimentBias } from '../services/analytics';
import { CURRENCY_SYMBOL } from '../constants';
import { playClick } from '../services/audio';
import { toast } from '../components/Toast';

const COLORS = ['#00f3ff', '#00ff9d', '#ff0055', '#facc15', '#94a3b8'];

const PublicProfile: React.FC = () => {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioValue, setPortfolioValue] = useState('0.00');
  const [ethBalance, setEthBalance] = useState('0.00');
  const [sentimentBias, setSentimentBias] = useState({ trust: 50, distrust: 50 });
  const [exposureData, setExposureData] = useState<any[]>([]);
  const [semanticFootprint, setSemanticFootprint] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (address) fetchUserData(address);
  }, [address]);

  const fetchUserData = async (addr: string) => {
    setLoading(true);
    try {
      // 0. Fetch Native Balance (Always exists)
      const bal = await getWalletBalance(addr);
      setEthBalance(Number(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

      // 1. History & Transactions (Only On-Chain for public view)
      let chainHistory = await getUserHistory(addr).catch(() => []);
      
      // 2. Positions & Exposure
      const graphPositions = await getUserPositions(addr).catch(() => []);
      
      // Fallback Curve Map: ID -> CurveID
      const curveMap = new Map<string, number>();
      graphPositions.forEach((p: any) => {
          if (p.vault?.term_id) {
              curveMap.set(p.vault.term_id.toLowerCase(), Number(p.vault.curve_id || 0));
          }
      });

      // Extract IDs from history too, ensuring we scan everything interacted with
      const uniqueVaultIds = Array.from(new Set([
          ...graphPositions.map((p: any) => p.vault?.term_id?.toLowerCase()),
          ...chainHistory.map(tx => tx.vaultId?.toLowerCase())
      ])).filter(Boolean) as string[];

      const metadata = await getVaultsByIds(uniqueVaultIds).catch(() => []);
      
      // Fetch LIVE on-chain data
      const livePositions = await Promise.all(uniqueVaultIds.map(async (id) => {
          const meta = metadata.find(m => m.id.toLowerCase() === id);
          const curveId = meta?.curveId ? Number(meta.curveId) : (curveMap.get(id) || 0);
          
          let shares = await getShareBalance(addr, id, curveId);
          let sharesNum = parseFloat(shares);
          
          if (sharesNum <= 0.000001) return null;

          const valueStr = await getQuoteRedeem(shares, id, addr, curveId);
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

      const totalVal = finalPositions.reduce((acc, cur) => acc + cur.value, 0);
      setPortfolioValue(totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

      // --- SYNTHETIC HISTORY GENERATION ---
      // If history is empty due to indexer lag, but user has active positions,
      // generate a "Deposit" record for each position so the UI isn't empty.
      if (chainHistory.length === 0 && finalPositions.length > 0) {
          chainHistory = finalPositions.map((p: any) => ({
              id: `synth_${p.id}`,
              type: 'DEPOSIT',
              shares: p.shares.toString(),
              assets: p.value.toString(), // Estimate assets from current value
              timestamp: Date.now() - 1000 * 60 * 60 * 24, // 24h ago
              vaultId: p.id,
              assetLabel: p.atom?.label,
              user: addr
          })) as any;
      }

      // Sort Descending for List
      const mergedHistory = chainHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setHistory(mergedHistory);
      
      setSemanticFootprint(mergedHistory.length); 
      setSentimentBias(calculateSentimentBias(mergedHistory));

      // Process for Chart (Ascending Order)
      const chartAscending = [...mergedHistory]
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          .map(tx => {
              // Try to use Assets (Value), fallback to Shares (Volume Proxy)
              // NOTE: assets might be '0' if fetched from history without asset field
              let val = 0;
              try {
                  const assetVal = parseFloat(formatEther(BigInt(tx.assets || '0')));
                  if (assetVal > 0) {
                      val = assetVal;
                  } else {
                      // Fallback: Use shares as a volume proxy if assets are missing
                      val = parseFloat(formatEther(BigInt(tx.shares || '0')));
                  }
                  
                  // If it's a synthetic transaction, we used raw float strings, so parse directly
                  if (tx.id.startsWith('synth_')) {
                      val = parseFloat(tx.assets || tx.shares);
                  }
              } catch (e) {
                  val = 0;
              }
              return { val };
          });
      
      // FIX: Pad data if single point to ensure chart renders
      if (chartAscending.length === 1) {
          chartAscending.unshift({ val: 0 });
      }
      
      setVolumeData(chartAscending);

    } catch (e) {
      console.error("Profile Fetch Error", e);
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

      // ENS Resolution Logic
      if (cleanQuery.endsWith('.eth')) {
          playClick();
          setIsResolving(true);
          try {
              const resolvedAddress = await resolveENS(cleanQuery);
              if (resolvedAddress) {
                  navigate(`/profile/${resolvedAddress}`);
                  setSearchQuery('');
                  toast.success(`RESOLVED ${cleanQuery} -> ${resolvedAddress.slice(0,6)}...`);
              } else {
                  toast.error(`ENS NAME NOT FOUND: ${cleanQuery}`);
              }
          } catch (e) {
              toast.error("ENS RESOLUTION FAILED");
          } finally {
              setIsResolving(false);
          }
      }
  };

  if (!address) return <div className="min-h-screen flex items-center justify-center text-intuition-danger font-mono">INVALID ADDRESS</div>;

  return (
    <div className="min-h-screen bg-intuition-dark pt-8 pb-20 px-4 max-w-7xl mx-auto">
      
      {/* Search Header for Cross-Navigation */}
      <div className="flex justify-end mb-6">
          <div className="flex items-center bg-black border border-slate-700 p-1 clip-path-slant focus-within:border-intuition-primary transition-colors">
              <input 
                  type="text" 
                  placeholder="PLAYER ADDRESS (0x...) OR ENS (.eth)" 
                  className="bg-transparent text-white font-mono text-xs px-3 outline-none w-72"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={isResolving}
              />
              <button 
                  onClick={handleSearch}
                  disabled={!isAddress(searchQuery.trim()) && !searchQuery.trim().endsWith('.eth') || isResolving}
                  className="bg-slate-800 text-slate-400 p-1 hover:text-white hover:bg-intuition-primary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all w-8 h-8 flex items-center justify-center"
              >
                  {isResolving ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
          </div>
      </div>

      {/* Profile Header */}
      <div className="mb-12 p-1 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-none clip-path-slant">
        <div className="bg-black p-8 flex flex-col md:flex-row items-center gap-8 clip-path-slant relative">
          <div className="w-24 h-24 bg-intuition-dark border-2 border-slate-600 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            <User size={48} className="text-slate-400" />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="text-slate-500 font-mono text-xs mb-1">PUBLIC PROFILE</div>
            <h1 className="text-3xl md:text-4xl font-black text-white font-display tracking-wider mb-2">{address.slice(0, 6)}...{address.slice(-4)}</h1>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start font-mono text-xs">
              <span className="bg-intuition-primary/10 text-intuition-primary px-2 py-1 border border-intuition-primary/30">LEVEL: {positions.length > 5 ? 'VETERAN' : 'EXPLORER'}</span>
              <span className="bg-slate-800 text-slate-400 px-2 py-1 border border-slate-700">{positions.length} HOLDINGS</span>
              {/* Native Balance Badge - Uses System Currency Symbol */}
              <span className="bg-slate-900 text-slate-300 px-2 py-1 border border-slate-700 flex items-center gap-2">
                  <Wallet size={12} /> {ethBalance} {CURRENCY_SYMBOL}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Always Visible */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-black border border-intuition-border p-6 clip-path-slant">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <Shield size={12} /> Protocol Assets
              </div>
              <div className="text-3xl font-black text-white font-display text-glow">{portfolioValue} <span className="text-sm text-intuition-primary">{CURRENCY_SYMBOL}</span></div>
          </div>
          <div className="bg-black border border-intuition-border p-6 clip-path-slant">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <Layers size={12} /> Semantic Footprint
              </div>
              <div className="text-3xl font-black text-white font-display flex items-center gap-2">
                  {semanticFootprint} <span className="text-xs text-slate-500 font-mono">TXS</span>
              </div>
          </div>
          <div className="bg-black border border-intuition-border p-6 clip-path-slant relative overflow-hidden">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2 flex items-center gap-2">
                  <TrendingUp size={12} /> Sentiment Bias
              </div>
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

      {/* Charts & Tables */}
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
                  <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs border border-dashed border-slate-800 rounded bg-slate-900/20">
                      NO ASSETS TO CATEGORIZE
                  </div>
              )}
          </div>

          <div className="lg:col-span-2 bg-black border border-intuition-border p-6 clip-path-slant h-[300px]">
              <h3 className="text-xs font-bold text-white font-mono uppercase mb-4 flex items-center gap-2"><Activity size={14}/> Recent Activity Volume</h3>
              {volumeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={volumeData}>
                          <defs>
                              <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis hide />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                            itemStyle={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                            formatter={(value: any) => [`${value} ${CURRENCY_SYMBOL}`, 'Volume']}
                          />
                          <Area type="monotone" dataKey="val" stroke="#00f3ff" fillOpacity={1} fill="url(#colorVal)" />
                      </AreaChart>
                  </ResponsiveContainer>
              ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs border border-dashed border-slate-800 rounded bg-slate-900/20">
                      NO ACTIVITY LOGGED ON-CHAIN
                  </div>
              )}
          </div>
      </div>

      <div className="bg-black border border-intuition-border clip-path-slant mb-8">
          <div className="p-4 border-b border-intuition-border bg-intuition-card flex justify-between items-center">
              <h3 className="font-bold text-white font-display tracking-widest flex items-center gap-2"><Zap size={16} className="text-slate-400"/> PUBLIC_HOLDINGS</h3>
          </div>
          <div className="overflow-x-auto min-h-[150px]">
              <table className="w-full text-left font-mono text-sm">
                  <thead className="bg-intuition-dark text-slate-500 text-xs uppercase border-b border-intuition-border">
                      <tr>
                          <th className="px-6 py-4">Asset</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4 text-right">Shares</th>
                          <th className="px-6 py-4 text-right">Est. Value</th>
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
                                  <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">{p.atom ? calculateCategoryExposure([{value: 1, atom: p.atom}])[0]?.name : 'UNKNOWN'}</span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono">{p.shares.toFixed(4)}</td>
                              <td className="px-6 py-4 text-right text-emerald-400">{p.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {CURRENCY_SYMBOL}</td>
                              <td className="px-6 py-4 text-right">
                                  <Link to={`/markets/${p.id}`} className="px-3 py-1 bg-white/5 border border-white/10 hover:bg-intuition-primary/20 hover:border-intuition-primary hover:text-intuition-primary text-[10px] font-bold rounded transition-colors">VIEW</Link>
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

export default PublicProfile;