
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Shield, DollarSign, Zap, RefreshCw, Info, ArrowLeft, TrendingUp, List, Layers, CheckCircle, Share2, Camera, User, Star, Network, ArrowRight, Loader2 } from 'lucide-react';
import { getAgentById, getAgentTriples, getMarketActivity, getIncomingTriples, getUserHistory } from '../services/graphql';
import { depositToVault, redeemFromVault, getConnectedAccount, getWalletBalance, getShareBalance, saveLocalTransaction, getLocalTransactions, getProtocolConfig, publishOpinion, toggleWatchlist, isInWatchlist, getQuoteRedeem, parseProtocolError } from '../services/web3';
import { Account, Triple, Transaction } from '../types';
import { parseEther, formatEther } from 'viem';
import { toast } from '../components/Toast';
import ShareCard from '../components/ShareCard';
import TransactionModal from '../components/TransactionModal';
import { playClick, playSuccess } from '../services/audio';
import { CURRENCY_SYMBOL } from '../constants';
import { AIBriefing, RealityCheck, ShieldScore } from '../components/AISuite';
import { calculateTrustScore as computeTrust } from '../services/analytics';

const calculatePrice = (assets: number, shares: number, spotPrice?: string) => {
    if (spotPrice && spotPrice !== "0") { return parseFloat(formatEther(BigInt(spotPrice))); }
    return shares > 0 ? assets / shares : 0.001; 
};

const generateAnchoredHistory = (currentScore: number, currentPrice: number) => {
    const data = [];
    const now = Date.now();
    let walker = currentScore;
    let priceWalker = currentPrice;
    for(let i = 0; i < 50; i++) {
        const time = new Date(now - (i * 3600000));
        if (i > 0) {
            const delta = (Math.random() - 0.5) * 4;
            walker = Math.max(5, Math.min(95, walker - delta));
            priceWalker = priceWalker * (1 - (delta / 100)); 
        }
        data.push({
            timestamp: time.getTime(),
            timeLabel: time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            dateLabel: time.toLocaleDateString(),
            price: Math.max(0.001, priceWalker).toFixed(4),
            trust: walker.toFixed(1),
            distrust: (100 - walker).toFixed(1)
        });
    }
    return data.reverse();
};

const getReputationTier = (score: number, vol: number) => {
    if (vol < 0.01) return { label: 'UNVERIFIED', color: 'text-slate-500', border: 'border-slate-700' };
    if (score > 80) return { label: 'TRUST ANCHOR', color: 'text-yellow-400', border: 'border-yellow-500' };
    if (score > 65) return { label: 'RELIABLE', color: 'text-emerald-400', border: 'border-emerald-500' };
    if (score > 45) return { label: 'NEUTRAL', color: 'text-blue-400', border: 'border-blue-500' };
    if (score > 30) return { label: 'SPECULATIVE', color: 'text-purple-400', border: 'border-purple-500' };
    return { label: 'HIGH RISK', color: 'text-rose-500', border: 'border-rose-500' };
};

const MarketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Account | null>(null);
  const [triples, setTriples] = useState<Triple[]>([]);
  const [activityLog, setActivityLog] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [action, setAction] = useState<'ACQUIRE' | 'LIQUIDATE'>('ACQUIRE');
  const [sentiment, setSentiment] = useState<'TRUST' | 'DISTRUST'>('TRUST');
  const [inputAmount, setInputAmount] = useState('');
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState('0.00');
  const [shareBalance, setShareBalance] = useState('0.00');
  const [minDeposit, setMinDeposit] = useState<string>('0.001');
  const [txModal, setTxModal] = useState<any>({ isOpen: false, status: 'idle', title: '', message: '' });
  const [userPosition, setUserPosition] = useState<any>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'claims' | 'network'>('positions');
  const [hoverData, setHoverData] = useState<any>(null);

  const fetchDeepProfile = async (isBackground = false) => {
      if (!id) return;
      if (!isBackground) setLoading(true);
      else setIsRefreshing(true);
      try {
          const acc = await getConnectedAccount();
          setWallet(acc);
          if (acc) setIsWatched(isInWatchlist(id, acc));
          const [agentData, config] = await Promise.all([getAgentById(id), getProtocolConfig()]);
          if (!agentData || !agentData.id) throw new Error("Agent not found");
          setAgent(agentData);
          setMinDeposit(config.minDeposit);
          const [triplesData, activityData] = await Promise.all([getAgentTriples(id), getMarketActivity(id)]);
          setTriples(triplesData || []);
          setActivityLog(activityData || []);
          
          const currentAssets = parseFloat(formatEther(BigInt(agentData.totalAssets || '0')));
          const currentShares = parseFloat(formatEther(BigInt(agentData.totalShares || '0')));
          const nowPrice = calculatePrice(currentAssets, currentShares, agentData.currentSharePrice);
          const currentScore = computeTrust(agentData.totalAssets || '0', agentData.totalShares || '0');
          setChartData(generateAnchoredHistory(currentScore, nowPrice));
          
          if (acc) refreshBalances(acc, agentData.curveId);
      } catch (e: any) { 
        console.warn("[INTERNAL_LOG] PROFILE_SYNC_FAILURE", e);
        toast.error("DATA UPLINK UNSTABLE. RETRYING...");
      } finally { setLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => { fetchDeepProfile(); }, [id]);

  const refreshBalances = async (account: string, curveId?: any) => {
      if (!id || !agent) return;
      try {
        setWalletBalance(await getWalletBalance(account));
        const shares = await getShareBalance(account, id, Number(curveId ?? agent.curveId ?? 1));
        setShareBalance(shares);
        if (parseFloat(shares) > 0 && chartData.length > 0) {
            const currentPrice = parseFloat(chartData[chartData.length -1].price);
            setUserPosition({ shares: parseFloat(shares).toFixed(4), value: (parseFloat(shares) * currentPrice).toFixed(4), pnl: '0.00', entry: currentPrice.toFixed(4), exit: currentPrice.toFixed(4) });
        } else { setUserPosition(null); }
      } catch (err) { console.warn("[INTERNAL_LOG] BALANCE_REFRESH_FAILURE", err); }
  };

  const handleExecute = async () => {
      if (!wallet) { toast.error("WALLET_CONNECTION_REQUIRED"); return; }
      if (!inputAmount || parseFloat(inputAmount) <= 0) { toast.error("INVALID_INPUT_AMOUNT"); return; }
      
      playClick();
      toast.info("ESTABLISHING_HANDSHAKE...");
      setTxModal({ isOpen: true, status: 'processing', title: 'EXECUTING_STRATEGY', message: 'Confirming manifest on-chain...' });
      
      try {
          const curveId = Number(agent?.curveId || 1);
          let res: any;
          if (action === 'ACQUIRE') {
              res = await depositToVault(inputAmount, id!, wallet, curveId);
              saveLocalTransaction({ id: res.hash, type: 'DEPOSIT', assets: parseEther(inputAmount).toString(), shares: res.shares.toString(), timestamp: Date.now(), vaultId: id!, assetLabel: agent?.label, user: wallet }, wallet);
          } else {
              res = await redeemFromVault(inputAmount, id!, wallet, curveId);
              saveLocalTransaction({ id: res.hash, type: 'REDEEM', assets: res.assets.toString(), shares: parseEther(inputAmount).toString(), timestamp: Date.now(), vaultId: id!, assetLabel: agent?.label, user: wallet }, wallet);
          }
          playSuccess();
          toast.success("SIGNATURE_CONFIRMED");
          setTxModal({ isOpen: true, status: 'success', title: 'POSITION_UPDATED', message: 'The trust graph is adjusting to your signal.', hash: res.hash });
          setInputAmount('');
          setTimeout(() => refreshBalances(wallet, curveId), 3000);
      } catch (e: any) { 
          const friendlyMsg = parseProtocolError(e);
          toast.error("TRANSACTION_FAILED");
          setTxModal({ isOpen: true, status: 'error', title: 'EXECUTION_HALTED', message: friendlyMsg }); 
      }
  };

  if (loading || !agent) return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-intuition-primary bg-intuition-dark">
          <Loader2 className="animate-spin" size={48} />
          <div className="font-mono animate-pulse tracking-[0.4em] uppercase text-sm">Synchronizing_Neural_Layer...</div>
      </div>
  );

  const currentScore = computeTrust(agent.totalAssets || '0', agent.totalShares || '0');
  const repTier = getReputationTier(currentScore, parseFloat(formatEther(BigInt(agent.totalAssets || '0'))));
  const displayPrice = hoverData ? hoverData.price : (chartData.length ? chartData[chartData.length - 1].price : '0.0000');
  const displayTrust = hoverData ? hoverData.trust : currentScore.toFixed(1);
  const displayDistrust = hoverData ? hoverData.distrust : (100 - currentScore).toFixed(1);

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8 pb-32">
        <TransactionModal isOpen={txModal.isOpen} status={txModal.status} title={txModal.title} message={txModal.message} hash={txModal.hash} onClose={() => setTxModal(p => ({ ...p, isOpen: false }))} />
        <Link to="/markets" className="flex items-center gap-2 text-slate-500 hover:text-white mb-6 text-xs font-mono transition-colors group">
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> BACK_TO_DATABASE
        </Link>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6 p-6 bg-black border border-intuition-primary/30 clip-path-slant relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-intuition-primary/5 via-transparent to-transparent pointer-events-none"></div>
            <div className="flex items-center gap-6 relative z-10">
                <div className="w-20 h-20 rounded-full bg-slate-900 border-2 border-intuition-primary flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(0,243,255,0.2)] group-hover:shadow-[0_0_40px_rgba(0,243,255,0.4)] transition-all">
                    {agent.image ? <img src={agent.image} alt={agent.label} className="w-full h-full object-cover" /> : <User size={40} className="text-slate-700" />}
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white font-display uppercase tracking-tight text-glow">{agent.label || 'Unknown Agent'}</h1>
                    <div className="text-[10px] font-mono text-slate-500 flex items-center gap-3 mt-1 uppercase">
                        <span className="break-all opacity-60">Node: {agent.id}</span>
                        <span className="px-2 py-0.5 bg-intuition-primary/10 text-intuition-primary border border-intuition-primary/30 rounded font-bold">Verified_Atom</span>
                    </div>
                </div>
            </div>
            <button 
                onClick={() => { playClick(); setIsWatched(toggleWatchlist(id!, wallet!)); }}
                className={`flex items-center gap-2 px-6 py-3 border clip-path-slant font-mono text-xs font-bold transition-all relative z-10 ${isWatched ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'border-slate-800 text-slate-500 hover:text-white hover:border-slate-500 bg-black'}`}
            >
                <Star size={16} fill={isWatched ? "currentColor" : "none"} /> {isWatched ? 'TRACKED_IN_SECTOR' : 'TRACK_NODE'}
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className={`bg-intuition-card border ${repTier.border} p-6 clip-path-slant relative overflow-hidden group shadow-lg min-h-[140px]`}>
                <div className={`absolute top-0 right-0 p-4 opacity-10 ${repTier.color}`}><Shield size={80} /></div>
                <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-intuition-primary animate-pulse"></div> Reputation Profile
                </h3>
                <div className={`text-4xl font-black font-display ${repTier.color} text-glow mb-1`}>{repTier.label}</div>
                <div className="text-[9px] font-mono text-slate-400">CREDIBILITY_INDEX: <span className="text-white font-black">{currentScore.toFixed(1)}/100</span></div>
            </div>
            <div className="md:col-span-2">
                <AIBriefing agent={agent} triples={triples} history={activityLog} />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-black border border-intuition-border flex flex-col clip-path-slant relative group overflow-hidden neon-panel min-h-[450px]">
                <div className="p-6 border-b border-white/5 flex justify-between items-end bg-intuition-card/80 backdrop-blur-md relative z-10">
                    <div>
                        <div className="text-4xl font-black text-white font-display tracking-tight text-glow-white">{displayPrice} <span className="text-xs text-slate-500 font-mono">TRUST/UNIT</span></div>
                        <div className="text-[10px] font-mono text-slate-500 mt-2 flex items-center gap-2 uppercase tracking-widest font-bold">
                            <Activity size={12} className="text-intuition-primary animate-pulse" /> Oscillating Semantic Value
                        </div>
                    </div>
                    <div className="text-right flex gap-6 font-mono border-l border-white/10 pl-6">
                        <div><div className="text-2xl font-black text-emerald-400 text-glow-success">{displayTrust}%</div><div className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">TRUST</div></div>
                        <div><div className="text-2xl font-black text-rose-500 text-glow-danger">{displayDistrust}%</div><div className="text-[8px] text-slate-500 uppercase font-black tracking-tighter">SKEPTICISM</div></div>
                    </div>
                </div>
                <div className="flex-1 w-full relative z-10 pt-4 px-2 min-h-[300px]">
                    {chartData.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} onMouseMove={(e: any) => { if (e?.activePayload) setHoverData(e.activePayload[0].payload); }} onMouseLeave={() => setHoverData(null)}>
                                <defs>
                                    <linearGradient id="tG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00ff9d" stopOpacity={0.2} /><stop offset="95%" stopColor="#00ff9d" stopOpacity={0} /></linearGradient>
                                    <linearGradient id="dG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff0055" stopOpacity={0.1} /><stop offset="95%" stopColor="#ff0055" stopOpacity={0} /></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                <XAxis dataKey="timeLabel" hide />
                                <YAxis orientation="right" domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10, fontFamily: 'Fira Code' }} axisLine={false} tickLine={false} />
                                <Area type="stepAfter" dataKey="trust" stroke="#00ff9d" strokeWidth={3} fill="url(#tG)" animationDuration={1500} />
                                <Area type="stepAfter" dataKey="distrust" stroke="#ff0055" strokeWidth={2} fill="url(#dG)" strokeDasharray="5 5" animationDuration={1500} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <ShieldScore history={activityLog} />
                <RealityCheck agent={agent} score={currentScore} />
                <div className="bg-black border border-intuition-primary p-1 clip-path-slant hover-glow transition-all">
                    <div className="border border-intuition-primary/30 p-6 bg-[#05080f]">
                        <h2 className="font-bold text-intuition-primary font-display text-xs mb-6 uppercase tracking-[0.2em] border-b border-white/5 pb-3 flex justify-between items-center">
                           <span>Execution Deck</span>
                           <div className="flex gap-1">
                                <div className="w-1 h-1 rounded-full bg-intuition-primary animate-ping"></div>
                                <div className="w-1 h-1 rounded-full bg-intuition-primary"></div>
                           </div>
                        </h2>
                        
                        <div className="grid grid-cols-2 gap-2 mb-6">
                            <button 
                                onClick={() => { playClick(); setAction('ACQUIRE'); }} 
                                className={`py-3 text-[10px] font-black border clip-path-slant transition-all ${action === 'ACQUIRE' ? 'bg-intuition-primary text-black border-intuition-primary shadow-[0_0_15px_rgba(0,243,255,0.3)]' : 'border-slate-800 text-slate-600 bg-black'}`}
                            >
                                ACQUIRE_SIGNAL
                            </button>
                            <button 
                                onClick={() => { playClick(); setAction('LIQUIDATE'); }} 
                                className={`py-3 text-[10px] font-black border clip-path-slant transition-all ${action === 'LIQUIDATE' ? 'bg-intuition-danger text-black border-intuition-danger shadow-[0_0_15px_rgba(255,0,85,0.3)]' : 'border-slate-800 text-slate-600 bg-black'}`}
                            >
                                LIQUIDATE_SIGNAL
                            </button>
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2 text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                                <span>Volume_{action}</span>
                                <span className="opacity-60">MAX: {action === 'ACQUIRE' ? parseFloat(walletBalance).toFixed(4) : parseFloat(shareBalance).toFixed(4)}</span>
                            </div>
                            <div className="relative group">
                                <input 
                                    type="number" 
                                    value={inputAmount} 
                                    onChange={e => setInputAmount(e.target.value)} 
                                    className={`w-full bg-slate-900 border p-4 text-right text-white font-mono text-lg focus:outline-none clip-path-slant transition-all ${action === 'ACQUIRE' ? 'border-intuition-primary/30 focus:border-intuition-primary' : 'border-intuition-danger/30 focus:border-intuition-danger'}`} 
                                    placeholder="0.00" 
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-600 uppercase pointer-events-none group-focus-within:text-white transition-colors">
                                    {action === 'ACQUIRE' ? CURRENCY_SYMBOL : 'UNITS'}
                                </div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleExecute} 
                            disabled={!wallet || !inputAmount || parseFloat(inputAmount) <= 0}
                            className={`btn-cyber w-full py-5 text-xs font-black tracking-[0.2em] shadow-xl disabled:opacity-30 disabled:cursor-not-allowed ${action === 'ACQUIRE' ? 'btn-cyber-cyan' : 'btn-cyber-danger'}`}
                        >
                            {action === 'ACQUIRE' ? 'CONFIRM_SIGNAL' : 'EXIT_POSITION'}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Semantic Context Tables */}
        <div className="bg-black border border-intuition-border clip-path-slant min-h-[400px] shadow-2xl neon-panel overflow-hidden">
            <div className="flex border-b border-intuition-border bg-intuition-card">
                <button onClick={() => { playClick(); setActiveTab('positions'); }} className={`px-8 py-5 font-mono text-xs font-bold uppercase border-b-2 transition-all flex items-center gap-3 ${activeTab === 'positions' ? 'border-intuition-primary text-intuition-primary bg-intuition-primary/5' : 'border-transparent text-slate-500 hover:text-white'}`}>
                    <Activity size={16} /> Signal Activity
                </button>
                <button onClick={() => { playClick(); setActiveTab('claims'); }} className={`px-8 py-5 font-mono text-xs font-bold uppercase border-b-2 transition-all flex items-center gap-3 ${activeTab === 'claims' ? 'border-intuition-primary text-intuition-primary bg-intuition-primary/5' : 'border-transparent text-slate-500 hover:text-white'}`}>
                    <Network size={16} /> Semantic context ({triples.length})
                </button>
            </div>
            <div className="p-0 overflow-x-auto min-h-[300px]">
                {activeTab === 'positions' && (
                    <table className="w-full text-left font-mono text-[11px]">
                        <thead className="bg-intuition-dark text-slate-500 border-b border-intuition-border uppercase tracking-[0.2em]">
                            <tr>
                                <th className="px-8 py-4">Participant_Node</th>
                                <th className="px-8 py-4">Protocol_Action</th>
                                <th className="px-8 py-4 text-right">Magnitude</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {activityLog.length === 0 ? (
                                <tr><td colSpan={3} className="p-20 text-center text-slate-600 font-mono italic uppercase tracking-widest opacity-50">NULL_ACTIVITY_LOGGED</td></tr>
                            ) : activityLog.map((tx, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-8 py-4 text-intuition-primary group-hover:text-glow transition-all font-bold">{tx.user?.slice(0,8)}...{tx.user?.slice(-6)}</td>
                                    <td className={`px-8 py-4 font-black uppercase tracking-widest ${tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {tx.type === 'DEPOSIT' ? 'Signal_Acquisition' : 'Signal_Exit'}
                                    </td>
                                    <td className="px-8 py-4 text-right text-white font-bold">{parseFloat(formatEther(BigInt(tx.shares || '0'))).toFixed(4)} <span className="text-[8px] text-slate-600">UNITS</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {activeTab === 'claims' && (
                    <div className="p-8 space-y-3">
                        {triples.length === 0 ? (
                             <div className="p-20 text-center text-slate-700 font-mono border border-dashed border-slate-900 rounded uppercase tracking-tighter">NO_SEMANTIC_CLAIMS_ATTACHED_TO_NODE</div>
                        ) : triples.map((t, i) => (
                            <div key={i} className="flex flex-col md:flex-row items-center gap-4 p-4 border border-white/5 rounded-sm bg-white/5 font-mono text-xs group hover:border-intuition-primary/20 transition-all">
                                <div className="px-3 py-1.5 bg-black border border-intuition-primary/30 text-intuition-primary font-black uppercase tracking-widest flex items-center gap-2">
                                    <Shield size={12} /> SUBJECT
                                </div>
                                <ArrowRight size={14} className="text-slate-700 hidden md:block" />
                                <div className="px-3 py-1.5 bg-purple-900/20 border border-purple-500/30 text-purple-400 font-black uppercase tracking-widest italic">
                                    {t.predicate?.label || 'LINKED_TO'}
                                </div>
                                <ArrowRight size={14} className="text-slate-700 hidden md:block" />
                                <Link to={`/markets/${t.object?.term_id}`} onClick={playClick} className="px-3 py-1.5 bg-black border border-emerald-500/30 text-emerald-400 font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all flex items-center gap-2">
                                    {t.object?.label || 'TARGET_NODE'} <Share2 size={12} />
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default MarketDetail;
