import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Shield, DollarSign, Zap, RefreshCw, Info, ArrowLeft, TrendingUp, List, Layers, CheckCircle, Share2, Camera, User, Star, Network } from 'lucide-react';
import { getAgentById, getAgentTriples, getMarketActivity, getAgentOpinions, getAllMarketActivity, getIncomingTriples } from '../services/graphql';
import { depositToVault, redeemFromVault, getConnectedAccount, getWalletBalance, getShareBalance, saveLocalTransaction, getLocalTransactions, getProtocolConfig, publishOpinion, toggleWatchlist, isInWatchlist, getQuoteRedeem } from '../services/web3';
import { Account, Triple, Transaction } from '../types';
import { parseEther, formatEther } from 'viem';
import { toast } from '../components/Toast';
import ShareCard from '../components/ShareCard';
import TransactionModal from '../components/TransactionModal';
import { playClick, playSuccess } from '../services/audio';
import { CURRENCY_SYMBOL } from '../constants';

// --- Analytics Helpers ---

const calculatePrice = (assets: number, shares: number, spotPrice?: string) => {
    // If spot price exists (fetched from graph), prefer it.
    if (spotPrice && spotPrice !== "0") {
        return parseFloat(formatEther(BigInt(spotPrice)));
    }
    // Fallback to average price
    return shares > 0 ? assets / shares : 0.001; 
};

// Updated Trust Score Logic: Pivot around 1.0 price = 50 score
const calculateTrustScore = (price: number) => {
    if (price <= 0) return 50;
    // Math.log10(1) = 0 -> 50 + 0 = 50.
    // Math.log10(10) = 1 -> 50 + 25 = 75.
    // Math.log10(0.1) = -1 -> 50 - 25 = 25.
    return Math.min(99, Math.max(1, 50 + Math.log10(price) * 25));
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
            walker = walker - delta;
            walker = Math.max(5, Math.min(95, walker));
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

// --- Components ---

const AgentHeader: React.FC<{ agent: Account; isWatched: boolean; onToggleWatch: () => void }> = ({ agent, isWatched, onToggleWatch }) => (
    <div className="flex flex-col md:flex-row items-center gap-6 p-6 mb-6 bg-black border border-intuition-primary/30 clip-path-slant relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-intuition-primary/10 to-transparent pointer-events-none"></div>
        
        {/* Watchlist Toggle */}
        <button 
            onClick={onToggleWatch}
            className={`absolute top-4 right-4 z-20 p-2 rounded-full border transition-all ${isWatched ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-black/50 text-slate-500 border-slate-700 hover:text-white hover:border-white'}`}
            title={isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
        >
            <Star size={20} fill={isWatched ? "currentColor" : "none"} />
        </button>

        <div className="w-24 h-24 bg-black border-2 border-intuition-primary flex items-center justify-center font-bold text-4xl text-intuition-primary shrink-0 shadow-[0_0_20px_rgba(0,243,255,0.3)]">
            {agent.image ? <img src={agent.image} className="w-full h-full object-cover" alt="" /> : <User size={40} />}
        </div>
        <div className="text-center md:text-left flex-1 z-10">
            <h1 className="text-3xl md:text-4xl font-black text-white font-display tracking-tight mb-2 uppercase text-glow">{agent.label}</h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <span className="px-3 py-1 bg-intuition-dark border border-intuition-border text-xs font-mono text-slate-400 rounded">ID: {agent.id.slice(0,12)}...</span>
                <span className="px-3 py-1 bg-intuition-primary/10 border border-intuition-primary/30 text-xs font-mono text-intuition-primary rounded uppercase flex items-center gap-2">
                    <Shield size={12} /> {agent.type || 'ATOM'}
                </span>
            </div>
        </div>
        <button 
            onClick={() => { navigator.clipboard.writeText(agent.id); toast.success("ID COPIED"); }}
            className="hidden md:block px-4 py-2 border border-slate-700 hover:border-intuition-primary hover:text-intuition-primary text-slate-500 font-mono text-xs transition-colors z-10"
        >
            COPY_ID
        </button>
    </div>
);

const SentimentMeter: React.FC<{ score: number }> = ({ score }) => {
    const trust = score;
    const distrust = 100 - score;
    
    return (
        <div className="bg-intuition-card border border-intuition-border p-5 clip-path-slant h-full">
            <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity size={14} className="text-intuition-primary" /> Sentiment Ratio
            </h3>
            <div className="flex justify-between items-end mb-2">
                <span className="text-2xl font-black text-intuition-success">{trust.toFixed(1)}%</span>
                <span className="text-2xl font-black text-intuition-danger">{distrust.toFixed(1)}%</span>
            </div>
            <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden flex relative border border-slate-700">
                <div style={{ width: `${trust}%` }} className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 relative">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                </div>
                <div style={{ width: `${distrust}%` }} className="h-full bg-gradient-to-l from-rose-600 to-rose-400 relative">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                </div>
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white mix-blend-overlay"></div>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2">
                <span>CONVICTION (LONG)</span>
                <span>OPPOSITION (SHORT)</span>
            </div>
        </div>
    );
};

const MarketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [agent, setAgent] = useState<Account | null>(null);
  const [triples, setTriples] = useState<Triple[]>([]);
  const [incomingTriples, setIncomingTriples] = useState<Triple[]>([]);
  const [activityLog, setActivityLog] = useState<Transaction[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [momentum, setMomentum] = useState({ score: 0, trend: 'stable' });
  const [isWatched, setIsWatched] = useState(false);

  const [action, setAction] = useState<'ACQUIRE' | 'LIQUIDATE'>('ACQUIRE');
  const [sentiment, setSentiment] = useState<'TRUST' | 'DISTRUST'>('TRUST');
  const [inputAmount, setInputAmount] = useState('');
  
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState('0.00');
  const [shareBalance, setShareBalance] = useState('0.00');
  const [minDeposit, setMinDeposit] = useState<string>('0.001');
  const [txModal, setTxModal] = useState<{ isOpen: boolean; status: 'idle' | 'processing' | 'success' | 'error'; title: string; message: string; hash?: string }>({ isOpen: false, status: 'idle', title: '', message: '' });
  const [userPosition, setUserPosition] = useState<{ shares: string; value: string; pnl: string; entry: string; exit: string } | null>(null);
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

          // Check watchlist state if wallet connected
          if (acc) setIsWatched(isInWatchlist(id, acc));

          const [agentData, config] = await Promise.all([
              getAgentById(id),
              getProtocolConfig()
          ]);
          
          if (!agentData || !agentData.id) throw new Error("Agent not found");
          setAgent(agentData);
          setMinDeposit(config.minDeposit);

          const [triplesData, incomingData, activityData] = await Promise.all([
              getAgentTriples(id),
              getIncomingTriples(id),
              getMarketActivity(id),
          ]);

          setTriples(triplesData || []);
          setIncomingTriples(incomingData || []);
          setActivityLog(activityData || []);

          let currentAssets = parseFloat(formatEther(BigInt(agentData.totalAssets || '0')));
          let currentShares = parseFloat(formatEther(BigInt(agentData.totalShares || '0')));
          const nowPrice = calculatePrice(currentAssets, currentShares, agentData.currentSharePrice);
          const nowTrust = calculateTrustScore(nowPrice);
          
          const generatedHistory = generateAnchoredHistory(nowTrust, nowPrice);
          setChartData(generatedHistory);

          if (activityData.length > 2) {
              const deposits = activityData.slice(0, 5).filter(x => x.type === 'DEPOSIT').length;
              if (deposits >= 4) setMomentum({ score: 92, trend: 'surge' });
              else if (deposits <= 1) setMomentum({ score: 15, trend: 'dump' });
              else setMomentum({ score: 50, trend: 'stable' });
          }

          if (acc) refreshBalances(acc, agentData.curveId);

      } catch (e: any) {
          console.error("Deep Profile Error", e);
      } finally {
          setLoading(false);
          setIsRefreshing(false);
      }
  };

  useEffect(() => {
    fetchDeepProfile();
  }, [id]);

  const toggleWatch = () => {
      if (!id) return;
      if (!wallet) {
          toast.error("CONNECT WALLET TO TRACK AGENTS");
          return;
      }
      playClick();
      const newState = toggleWatchlist(id, wallet);
      setIsWatched(newState);
      toast.info(newState ? "TARGET ACQUIRED (WATCHLIST)" : "TARGET DROPPED");
  };

  const refreshBalances = async (account: string, curveId?: any) => {
      if (!id) return;
      const bal = await getWalletBalance(account);
      setWalletBalance(bal);
      
      const targetCurve = curveId ?? agent?.curveId ?? 0;
      const shares = await getShareBalance(account, id, Number(targetCurve));
      setShareBalance(shares);

      const sharesNum = parseFloat(shares);
      
      if (sharesNum > 0 && chartData.length > 0) {
          const currentPrice = parseFloat(chartData[chartData.length -1].price);
          const val = sharesNum * currentPrice;
          
          const localTxs = getLocalTransactions(account).filter(tx => tx.vaultId === id && tx.type === 'DEPOSIT');
          let cost = 0; 
          let bought = 0;
          localTxs.forEach(tx => {
             cost += parseFloat(formatEther(BigInt(tx.assets || '0')));
             bought += parseFloat(formatEther(BigInt(tx.shares || '0')));
          });
          
          const entry = bought > 0 ? cost / bought : currentPrice;
          const pnl = ((currentPrice - entry) / entry) * 100;

          setUserPosition({
              shares: sharesNum.toFixed(4),
              value: val.toFixed(4),
              pnl: pnl.toFixed(2),
              entry: entry.toFixed(4),
              exit: currentPrice.toFixed(4)
          });
      } else {
          setUserPosition(null);
      }
  };

  const handleMax = () => {
      playClick();
      if (action === 'LIQUIDATE') {
          setInputAmount(shareBalance);
      } else {
          setInputAmount(walletBalance);
      }
  };

  const handleExecute = async () => {
      if (!wallet || !id || !inputAmount) { toast.error("INVALID INPUT"); return; }
      
      if ((window as any).umami) (window as any).umami.track('Trade Attempt', { agent: agent?.label, action: action, amount: inputAmount });

      playClick();
      setTxModal({ isOpen: true, status: 'processing', title: 'EXECUTING STRATEGY', message: 'Confirming transaction on-chain...' });

      try {
          const curveId = Number(agent?.curveId || 0);
          let hash = '';
          
          if (action === 'ACQUIRE') {
              const res = await depositToVault(inputAmount, id, wallet, curveId);
              hash = res.hash;
              saveLocalTransaction({ id: hash, type: 'DEPOSIT', assets: parseEther(inputAmount).toString(), shares: res.shares.toString(), timestamp: Date.now(), vaultId: id, assetLabel: agent?.label, user: wallet }, wallet);
          } else {
              const res = await redeemFromVault(inputAmount, id, wallet, curveId);
              hash = res.hash;
              saveLocalTransaction({ id: hash, type: 'REDEEM', assets: res.assets.toString(), shares: parseEther(inputAmount).toString(), timestamp: Date.now(), vaultId: id, assetLabel: agent?.label, user: wallet }, wallet);
          }

          if ((window as any).umami) (window as any).umami.track('Trade Success', { agent: agent?.label, action: action, amount: inputAmount, hash });
          
          playSuccess();
          setTxModal({ isOpen: true, status: 'success', title: 'POSITION UPDATED', message: 'The ledger has been updated.', hash });
          setInputAmount('');
          setTimeout(() => refreshBalances(wallet, curveId), 2000);
      } catch (e: any) {
          console.error(e);
          setTxModal({ isOpen: true, status: 'error', title: 'EXECUTION FAILED', message: 'Transaction rejected or failed.' });
      }
  };

  if (loading) return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <RefreshCw className="animate-spin text-intuition-primary" size={40} />
          <div className="font-mono text-intuition-primary animate-pulse tracking-widest">BUILDING INTELLIGENCE PROFILE...</div>
      </div>
  );

  if (!agent) return <div className="min-h-screen flex items-center justify-center text-intuition-danger font-mono">AGENT_NOT_FOUND</div>;

  const currentAssets = parseFloat(formatEther(BigInt(agent.totalAssets || '0')));
  const currentShares = parseFloat(formatEther(BigInt(agent.totalShares || '0')));
  const currentPrice = calculatePrice(currentAssets, currentShares, agent.currentSharePrice);
  const currentScore = calculateTrustScore(currentPrice);
  const repTier = getReputationTier(currentScore, currentAssets);

  const displayTrust = hoverData ? hoverData.trust : currentScore.toFixed(1);
  const displayDistrust = hoverData ? hoverData.distrust : (100 - currentScore).toFixed(1);
  const displayPrice = hoverData ? hoverData.price : currentPrice.toFixed(4);
  const displayTime = hoverData ? hoverData.timeLabel : 'LIVE';

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8 pb-32">
        <TransactionModal 
            isOpen={txModal.isOpen} 
            status={txModal.status} 
            title={txModal.title} 
            message={txModal.message} 
            hash={txModal.hash} 
            onClose={() => { setTxModal(prev => ({ ...prev, isOpen: false })); if (txModal.status === 'success' && action === 'LIQUIDATE') setShowShareCard(true); }} 
        />

        <button onClick={() => navigate('/markets')} className="flex items-center gap-2 text-slate-500 hover:text-white mb-4 text-xs font-mono transition-colors">
            <ArrowLeft size={14} /> BACK_TO_GRID
        </button>
        <AgentHeader agent={agent} isWatched={isWatched} onToggleWatch={toggleWatch} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className={`bg-intuition-card border ${repTier.border} p-5 clip-path-slant relative overflow-hidden group`}>
                <div className={`absolute top-0 right-0 p-4 opacity-20 ${repTier.color}`}><Shield size={64} /></div>
                <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Reputation Tier</h3>
                <div className={`text-3xl font-black font-display ${repTier.color} text-glow`}>{repTier.label}</div>
                <div className="mt-2 text-xs font-mono text-slate-400">Trust Score: <span className="text-white">{currentScore.toFixed(1)}/100</span></div>
            </div>

            <div className="bg-intuition-card border border-intuition-border p-5 clip-path-slant relative overflow-hidden">
                <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <TrendingUp size={14} className="text-intuition-secondary" /> Momentum
                </h3>
                <div className="flex items-center gap-4">
                    <div className={`text-3xl font-black font-display ${momentum.trend === 'surge' ? 'text-intuition-success' : momentum.trend === 'dump' ? 'text-intuition-danger' : 'text-slate-300'}`}>
                        {momentum.score}
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${momentum.trend === 'surge' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                        {momentum.trend}
                    </div>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 font-mono">Based on 24h volume velocity</div>
            </div>

            <SentimentMeter score={currentScore} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-black border border-intuition-border h-[400px] flex flex-col clip-path-slant relative group overflow-hidden">
                <div className="p-4 border-b border-white/5 flex justify-between items-end bg-intuition-card relative z-10">
                    <div>
                        <div className="text-3xl font-black text-white font-display tracking-tight">{displayPrice} <span className="text-sm text-slate-500">{CURRENCY_SYMBOL}/SHARE</span></div>
                        <div className="text-xs font-mono text-slate-500 mt-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-intuition-primary animate-pulse"></span> {displayTime}
                        </div>
                    </div>
                    <div className="text-right flex gap-4">
                        <div>
                            <div className="text-xl font-bold font-display text-emerald-400">{displayTrust}%</div>
                            <div className="text-[10px] font-mono text-slate-500 uppercase">TRUST</div>
                        </div>
                        <div>
                            <div className="text-xl font-bold font-display text-rose-500">{displayDistrust}%</div>
                            <div className="text-[10px] font-mono text-slate-500 uppercase">DISTRUST</div>
                        </div>
                    </div>
                </div>
                
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                    <h1 className="text-8xl font-black text-white/5 font-display tracking-tighter">INTURANK</h1>
                </div>

                <div className="flex-1 w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} onMouseMove={(e: any) => { if (e?.activePayload) setHoverData(e.activePayload[0].payload); }} onMouseLeave={() => setHoverData(null)}>
                            <defs>
                                <linearGradient id="trustGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00ff9d" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#00ff9d" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="distrustGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ff0055" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#ff0055" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis dataKey="timeLabel" hide />
                            <YAxis orientation="right" domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10, fontFamily: 'Fira Code' }} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '3 3' }} content={() => null} />
                            
                            <Area type="monotone" dataKey="trust" stroke="#00ff9d" strokeWidth={3} fill="url(#trustGradient)" activeDot={{ r: 4, fill: '#fff', stroke: '#00ff9d' }} />
                            <Area type="monotone" dataKey="distrust" stroke="#ff0055" strokeWidth={3} fill="url(#distrustGradient)" activeDot={{ r: 4, fill: '#fff', stroke: '#ff0055' }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-intuition-card border border-intuition-border p-4 clip-path-slant">
                    <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Vault Telemetry</h3>
                    <div className="space-y-3 font-mono text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Total Supply</span>
                            <span className="text-white">{currentShares.toFixed(4)} Shares</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">TVL (Liquidity)</span>
                            <span className="text-white">{currentAssets.toFixed(4)} {CURRENCY_SYMBOL}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Market Cap</span>
                            <span className="text-intuition-primary">{(currentShares * currentPrice).toFixed(4)} {CURRENCY_SYMBOL}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-black border border-intuition-primary p-1 clip-path-slant hover-glow">
                    <div className="border border-intuition-primary/30 p-4">
                        <div className="flex justify-between items-center mb-4 border-b border-intuition-border pb-2">
                            <h2 className="font-bold text-intuition-primary font-display tracking-widest text-sm">EXECUTION_DECK</h2>
                            <div className="text-[10px] text-slate-500 font-mono">v1.2</div>
                        </div>
                        
                        <div className="mb-4">
                            <div className="text-[10px] text-slate-500 font-mono uppercase mb-1">Select Sentiment</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setSentiment('TRUST')}
                                    className={`py-3 font-black font-display text-sm border clip-path-slant transition-all ${sentiment === 'TRUST' ? 'bg-intuition-success/20 text-intuition-success border-intuition-success shadow-[0_0_10px_rgba(0,255,157,0.2)]' : 'border-slate-800 text-slate-600 bg-black'}`}
                                >
                                    TRUST
                                </button>
                                <button 
                                    onClick={() => setSentiment('DISTRUST')}
                                    className={`py-3 font-black font-display text-sm border clip-path-slant transition-all ${sentiment === 'DISTRUST' ? 'bg-intuition-danger/20 text-intuition-danger border-intuition-danger shadow-[0_0_10px_rgba(255,0,85,0.2)]' : 'border-slate-800 text-slate-600 bg-black'}`}
                                >
                                    DISTRUST
                                </button>
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="text-[10px] text-slate-500 font-mono uppercase mb-1">Select Action</div>
                            <div className="flex gap-1 bg-slate-900/50 p-1 border border-slate-800 clip-path-slant">
                                <button onClick={() => setAction('ACQUIRE')} className={`flex-1 py-1 text-[10px] font-bold font-mono transition-colors ${action === 'ACQUIRE' ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}>ACQUIRE</button>
                                <button onClick={() => setAction('LIQUIDATE')} className={`flex-1 py-1 text-[10px] font-bold font-mono transition-colors ${action === 'LIQUIDATE' ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}>LIQUIDATE</button>
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-1 text-[10px] font-mono text-slate-500">
                                <span>AMOUNT</span>
                                <div className="flex items-center gap-2">
                                    <span>BAL: {action === 'ACQUIRE' ? walletBalance : shareBalance}</span>
                                    <button 
                                        onClick={handleMax}
                                        className="text-intuition-primary hover:text-white bg-intuition-primary/10 border border-intuition-primary/30 px-1 rounded text-[9px] uppercase tracking-wider hover:bg-intuition-primary hover:border-intuition-primary transition-all"
                                    >
                                        [MAX]
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={inputAmount} 
                                    onChange={e => setInputAmount(e.target.value)} 
                                    className={`w-full bg-slate-900 border p-3 pl-16 text-right text-white font-mono text-sm focus:outline-none ${sentiment === 'TRUST' ? 'border-intuition-success' : 'border-intuition-danger'}`} 
                                    placeholder="0.00" 
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold pointer-events-none">
                                    {action === 'ACQUIRE' ? CURRENCY_SYMBOL : 'SHARES'}
                                </div>
                            </div>
                            {action === 'ACQUIRE' && (
                                <div className="text-[10px] font-mono text-right text-intuition-warning mt-1">
                                    Min: {minDeposit}
                                </div>
                            )}
                        </div>

                        <button onClick={handleExecute} className={`w-full py-3 font-bold font-display text-xs tracking-widest transition-all clip-path-slant hover-glow ${sentiment === 'TRUST' ? 'bg-intuition-success text-black' : 'bg-intuition-danger text-black'}`}>
                            CONFIRM {action}
                        </button>
                    </div>
                </div>

                {/* Active Position Card */}
                {userPosition && (
                    <div className="bg-[#0a0f1a] border border-intuition-border p-4 clip-path-slant relative overflow-hidden group">
                        <div className="absolute inset-0 bg-intuition-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Active Position</span>
                            <span className={`text-xs font-bold font-mono px-1.5 py-0.5 border ${parseFloat(userPosition.pnl) >= 0 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-400 border-rose-500/30 bg-rose-500/10'}`}>
                                {parseFloat(userPosition.pnl) >= 0 ? '+' : ''}{userPosition.pnl}%
                            </span>
                        </div>
                        <div className="flex justify-between items-end mb-2 relative z-10">
                            <div>
                                <div className="text-2xl font-black text-white font-display tracking-tight">{userPosition.value} <span className="text-xs text-slate-500">{CURRENCY_SYMBOL}</span></div>
                                <div className="text-[10px] font-mono text-slate-500 uppercase">{userPosition.shares} SHARES</div>
                            </div>
                            <button 
                                onClick={() => { playClick(); setShowShareCard(true); }}
                                className="p-2 border border-slate-700 hover:border-intuition-primary text-slate-400 hover:text-white transition-colors bg-black rounded-sm"
                                title="Generate PnL Card"
                            >
                                <Share2 size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* 5. Bottom Tabs: Positions & Claims */}
        <div className="bg-black border border-intuition-border clip-path-slant min-h-[400px]">
            <div className="flex justify-between items-center border-b border-intuition-border bg-intuition-card pr-4">
                <div className="flex overflow-x-auto">
                    <button onClick={() => setActiveTab('positions')} className={`px-6 py-4 font-mono text-xs font-bold uppercase border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'positions' ? 'border-intuition-primary text-intuition-primary bg-intuition-primary/5' : 'border-transparent text-slate-500 hover:text-white'}`}>
                        <List size={14} /> Position History
                    </button>
                    <button onClick={() => setActiveTab('claims')} className={`px-6 py-4 font-mono text-xs font-bold uppercase border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'claims' ? 'border-intuition-primary text-intuition-primary bg-intuition-primary/5' : 'border-transparent text-slate-500 hover:text-white'}`}>
                        <Layers size={14} /> Semantic Claims ({triples.length})
                    </button>
                    <button onClick={() => setActiveTab('network')} className={`px-6 py-4 font-mono text-xs font-bold uppercase border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'network' ? 'border-intuition-primary text-intuition-primary bg-intuition-primary/5' : 'border-transparent text-slate-500 hover:text-white'}`}>
                        <Network size={14} /> Trust Network ({incomingTriples.length})
                    </button>
                </div>
                <button 
                    onClick={() => { playClick(); fetchDeepProfile(true); }}
                    className={`flex items-center gap-2 px-3 py-1.5 border border-slate-700 rounded-sm text-[10px] font-mono font-bold text-slate-400 hover:text-white hover:border-intuition-primary hover:bg-intuition-primary/10 transition-all ${isRefreshing ? 'animate-pulse' : ''}`}
                    title="Refresh Data"
                >
                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} /> SYNC
                </button>
            </div>

            <div className="p-0 overflow-x-auto">
                {activeTab === 'positions' && (
                    <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-intuition-dark text-slate-500 border-b border-intuition-border">
                            <tr>
                                <th className="px-6 py-3">Time</th>
                                <th className="px-6 py-3">Actor</th>
                                <th className="px-6 py-3">Action</th>
                                <th className="px-6 py-3 text-right">Volume</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {activityLog.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-600">NO_DATA</td></tr>
                            ) : activityLog.map((tx, i) => {
                                // Whale detection (Arbitrary threshold for demo)
                                const val = parseFloat(formatEther(BigInt(tx.shares || '0'))) * currentPrice;
                                const isWhale = val > 10; 

                                return (
                                    <tr key={i} className={`hover:bg-white/5 transition-colors ${isWhale ? 'bg-intuition-primary/5' : ''}`}>
                                        <td className="px-6 py-3 text-slate-400">{new Date(tx.timestamp).toLocaleString()}</td>
                                        <td className="px-6 py-3 text-intuition-primary flex items-center gap-2">
                                            {tx.user ? `${tx.user.slice(0,6)}...${tx.user.slice(-4)}` : 'Unknown'}
                                            {isWhale && <span className="text-[10px] bg-intuition-primary text-black px-1 rounded font-bold">WHALE</span>}
                                        </td>
                                        <td className={`px-6 py-3 font-bold ${tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-rose-400'}`}>{tx.type}</td>
                                        <td className="px-6 py-3 text-right text-white">
                                            {val.toFixed(4)} <span className="text-slate-600">{CURRENCY_SYMBOL}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {activeTab === 'claims' && (
                    <div className="p-6 grid grid-cols-1 gap-4">
                        {triples.length === 0 ? <div className="text-center text-slate-600">NO_CLAIMS_FOUND</div> : triples.map((t, i) => (
                            <div key={i} className="flex flex-col md:flex-row items-center gap-3 p-3 border border-white/10 rounded bg-white/5 font-mono text-sm group hover:border-intuition-primary/30 transition-colors">
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30 whitespace-nowrap">THIS AGENT</span>
                                <span className="text-slate-500 text-xs hidden md:inline">──[{t.predicate?.label || 'LINK'}]──&gt;</span>
                                <span className="text-slate-500 text-xs md:hidden">↓ {t.predicate?.label || 'LINK'} ↓</span>
                                
                                <Link to={`/markets/${t.object?.term_id}`} className="flex items-center gap-2 px-2 py-1 bg-purple-500/20 text-purple-300 rounded border border-purple-500/30 hover:bg-purple-500/40 transition-colors">
                                    {t.object?.image && <img src={t.object.image} className="w-4 h-4 rounded-full object-cover"/>}
                                    {t.object?.label || '...'}
                                </Link>
                                <span className="ml-auto text-xs text-slate-600">Block: {t.block_number}</span>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'network' && (
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {incomingTriples.length === 0 ? (
                                <div className="col-span-2 text-center text-slate-600 py-12 border border-dashed border-slate-800">NO INCOMING SIGNALS DETECTED.</div>
                            ) : (
                                incomingTriples.map((t, i) => (
                                    <Link key={i} to={`/markets/${t.subject?.term_id}`} className="flex items-center gap-4 p-4 border border-white/10 bg-white/5 hover:bg-intuition-primary/10 hover:border-intuition-primary/50 transition-all clip-path-slant group">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-slate-600 group-hover:border-intuition-primary transition-colors flex items-center justify-center">
                                            {t.subject?.image ? <img src={t.subject.image} className="w-full h-full object-cover" /> : <span className="text-xs">{t.subject?.label?.[0]}</span>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs text-slate-500 font-mono mb-1">TRUSTED BY</div>
                                            <div className="font-bold text-white group-hover:text-intuition-primary truncate">{t.subject?.label || 'Unknown Agent'}</div>
                                        </div>
                                        <div className="text-xs font-mono px-2 py-1 rounded bg-black border border-slate-700 text-slate-400">
                                            {t.predicate?.label || 'LINK'}
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Share Card Modal */}
        {showShareCard && userPosition && (
            <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setShowShareCard(false)}>
                <div className="relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowShareCard(false)} className="absolute -top-12 right-0 text-white hover:text-intuition-danger"><Info /></button>
                    <ShareCard username={wallet || '0xUser'} pnl={userPosition.pnl} entryPrice={userPosition.entry} currentPrice={userPosition.exit} assetName={agent.label || 'Unknown'} side={sentiment} />
                </div>
            </div>
        )}
    </div>
  );
};

export default MarketDetail;