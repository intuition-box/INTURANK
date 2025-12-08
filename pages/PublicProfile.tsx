import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getWalletBalance, getLocalTransactions, getShareBalance, getQuoteRedeem } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds } from '../services/graphql';
import { User, PieChart as PieIcon, Activity, Clock, Zap, Download, Shield } from 'lucide-react';
import { formatEther } from 'viem';
import { Transaction } from '../types';
import { calculateCategoryExposure, calculateSentimentBias } from '../services/analytics';
import { CURRENCY_SYMBOL } from '../constants';

const COLORS = ['#00f3ff', '#00ff9d', '#ff0055', '#facc15', '#94a3b8'];

const PublicProfile: React.FC = () => {
  const { address } = useParams<{ address: string }>();
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioValue, setPortfolioValue] = useState('0.00');
  const [sentimentBias, setSentimentBias] = useState({ trust: 50, distrust: 50 });
  const [exposureData, setExposureData] = useState<any[]>([]);
  const [semanticFootprint, setSemanticFootprint] = useState(0);

  useEffect(() => {
    if (address) fetchUserData(address);
  }, [address]);

  const fetchUserData = async (addr: string) => {
    setLoading(true);
    try {
      // 1. History & Transactions (Only On-Chain for public view, plus local if available in storage but usually not)
      const chainHistory = await getUserHistory(addr).catch(() => []);
      
      const mergedHistory = chainHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setHistory(mergedHistory);

      // 2. Sentiment Bias
      setSentimentBias(calculateSentimentBias(mergedHistory));

      // 3. Positions & Exposure
      const graphPositions = await getUserPositions(addr).catch(() => []);
      
      const uniqueVaultIds = Array.from(new Set([
          ...graphPositions.map((p: any) => p.vault?.term_id?.toLowerCase()),
      ])).filter(Boolean) as string[];

      const metadata = await getVaultsByIds(uniqueVaultIds).catch(() => []);
      
      // Fetch LIVE on-chain data
      const livePositions = await Promise.all(uniqueVaultIds.map(async (id) => {
          const meta = metadata.find(m => m.id.toLowerCase() === id);
          const curveId = meta?.curveId ? Number(meta.curveId) : 0; 
          
          // Get Raw Shares
          const shares = await getShareBalance(addr, id, curveId);
          const sharesNum = parseFloat(shares);
          
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
      setPortfolioValue(totalVal.toFixed(4));
      
      setSemanticFootprint(mergedHistory.length); 

    } catch (e) {
      console.error("Profile Fetch Error", e);
    } finally {
      setLoading(false);
    }
  };

  if (!address) return <div className="min-h-screen flex items-center justify-center text-red-500">INVALID ADDRESS</div>;

  return (
    <div className="min-h-screen bg-intuition-dark pt-8 pb-20 px-4 max-w-7xl mx-auto">
      
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
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-black border border-intuition-border p-6 clip-path-slant">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">Total Value Locked</div>
              <div className="text-3xl font-black text-white font-display text-glow">{portfolioValue} <span className="text-sm text-intuition-primary">{CURRENCY_SYMBOL}</span></div>
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
          <div className="bg-black border border-intuition-border p-6 clip-path-slant h-[300px]">
              <h3 className="text-xs font-bold text-white font-mono uppercase mb-4 flex items-center gap-2"><PieIcon size={14}/> Category Exposure</h3>
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
                      />
                  </PieChart>
              </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2 bg-black border border-intuition-border p-6 clip-path-slant h-[300px]">
              <h3 className="text-xs font-bold text-white font-mono uppercase mb-4 flex items-center gap-2"><Activity size={14}/> Recent Activity Volume</h3>
              <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history.length > 0 ? history.map((_, i) => ({ val: Math.random() * 50 })) : []}>
                      <defs>
                          <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                          </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis hide />
                      <YAxis hide />
                      <Area type="monotone" dataKey="val" stroke="#94a3b8" fillOpacity={1} fill="url(#colorVal)" />
                  </AreaChart>
              </ResponsiveContainer>
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
                          <th className="px-6 py-4 text-right">Value</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {positions.length > 0 ? positions.map((p, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors group">
                              <td className="px-6 py-4">
                                  <div className="font-bold text-white group-hover:text-intuition-primary transition-colors">{p.atom?.label || p.id.slice(0,8)}</div>
                                  <div className="text-[10px] text-slate-600">{p.id}</div>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500">
                                  <span className="bg-slate-800 px-2 py-1 rounded border border-slate-700">{p.atom ? calculateCategoryExposure([{value: 1, atom: p.atom}])[0]?.name : 'UNKNOWN'}</span>
                              </td>
                              <td className="px-6 py-4 text-right">{p.shares.toFixed(4)}</td>
                              <td className="px-6 py-4 text-right text-emerald-400">{p.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {CURRENCY_SYMBOL}</td>
                          </tr>
                      )) : (
                          <tr><td colSpan={4} className="p-12 text-center text-slate-600 font-mono italic">
                              {loading ? 'SCANNING LEDGER...' : 'NO ACTIVE POSITIONS FOUND ON-CHAIN'}
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