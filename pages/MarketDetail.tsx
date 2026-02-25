import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Shield, ArrowLeft, ArrowRight, User, Star, Network, ArrowUpRight, Loader2, Terminal, Zap, Info, Share2, Fingerprint, ChevronRight, Clock, Users, Layers, ExternalLink, Search, List as ListIcon, Globe, Compass, MessageSquare, Link as LinkIcon, Box, Database, Plus, UserPlus, Share, Hash, Radio, ScanSearch, Target, Upload, Boxes, X, Download, Twitter, Copy, TrendingUp, ShieldAlert, UserCircle, BadgeCheck, UserCog } from 'lucide-react';
import { getAgentById, getAgentTriples, getMarketActivity, getHoldersForVault, getAtomInclusionLists, getIdentitiesEngaged, getUserPositions, getIncomingTriplesForStats, getOppositionTriple, getVaultsForTerm, getCurveLabel, type VaultByCurve } from '../services/graphql';
import { depositToVault, redeemFromVault, connectWallet, getConnectedAccount, getWalletBalance, getShareBalance, toggleWatchlist, isInWatchlist, parseProtocolError, checkProxyApproval, grantProxyApproval, saveLocalTransaction, getLocalTransactions, getQuoteRedeem, publicClient, calculateTripleId, calculateCounterTripleId } from '../services/web3';
import { Account, Triple, Transaction } from '../types';
import { formatEther, parseEther } from 'viem';
import { toast } from '../components/Toast';
import TransactionModal from '../components/TransactionModal';
import CreateModal from '../components/CreateModal';
import { playClick, playSuccess, playHover } from '../services/audio';
import { AIBriefing } from '../components/AISuite';
import { calculateTrustScore as computeTrust, calculateAgentPrice, formatDisplayedShares, formatMarketValue, formatLargeNumber, calculateMarketCap, safeParseUnits, calculatePositionPnL, calculateRealizedPnL, isSystemVerified } from '../services/analytics';
import { LINEAR_CURVE_ID, OFFSET_PROGRESSIVE_CURVE_ID, CURRENCY_SYMBOL, EXPLORER_URL } from '../constants';
import { sendTransactionReceiptEmail } from '../services/emailNotifications';
import { CurrencySymbol } from '../components/CurrencySymbol';
import html2canvas from 'html2canvas';
import Logo from '../components/Logo';
import ShareCard from '../components/ShareCard';
import BondingCurvesInfoPanel from '../components/BondingCurvesInfoPanel';

type Timeframe = '15M' | '30M' | '1H' | '4H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';
type DetailTab = 'OVERVIEW' | 'POSITIONS' | 'IDENTITIES' | 'CLAIMS' | 'LISTS' | 'ACTIVITY' | 'CONNECTIONS';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const date = new Date(data.timestamp);
    const formattedDate = date.toLocaleDateString([], { day: '2-digit', month: 'short' });
    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="bg-black/95 border-2 border-intuition-primary p-4 clip-path-slant shadow-[0_0_40px_rgba(0,243,255,0.7)] backdrop-blur-xl z-50">
        <div className="flex items-center justify-between gap-8 mb-3 border-b border-white/10 pb-2">
            <p className="text-[8px] font-black font-mono text-intuition-primary uppercase tracking-[0.3em] text-glow-blue">TELEMETRY_SCAN</p>
            <p className="text-[7px] font-mono text-slate-500 uppercase tracking-widest">{formattedDate} // {formattedTime}</p>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-baseline gap-6">
            <span className="text-[9px] font-black font-mono text-slate-400 uppercase tracking-widest">SHARE_PRICE:</span>
            <span className="text-lg font-black font-display text-white tracking-tighter text-glow-white">
                {Number(payload[0].value).toLocaleString(undefined, { maximumFractionDigits: 4 })} <CurrencySymbol size="md" />
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black font-mono text-slate-400 uppercase tracking-widest">NET_CHANGE:</span>
            <span className={`text-xs font-black font-mono ${payload[0].value > payload[0].payload.basePrice ? 'text-intuition-success text-glow-success' : 'text-intuition-danger text-glow-red'}`}>
                {payload[0].value > payload[0].payload.basePrice ? '+' : ''}{((payload[0].value / payload[0].payload.basePrice - 1) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const generateAnchoredHistory = (assetsWei: string, sharesWei: string, currentSharePriceWei: string | undefined, timeframe: Timeframe) => {
    const data = [];
    const now = Date.now();
    let steps = 60;
    let timeStep = 3600000;
    switch(timeframe) {
        case '15M': steps = 30; timeStep = 30000; break;
        case '30M': steps = 30; timeStep = 60000; break;
        case '1H': steps = 40; timeStep = 90000; break;
        case '4H': steps = 40; timeStep = 360000; break;
        case '1D': steps = 48; timeStep = 1800000; break;
        case '1W': steps = 56; timeStep = 10800000; break;
        default: steps = 60; timeStep = 3600000;
    }
    const targetPrice = calculateAgentPrice(assetsWei, sharesWei, currentSharePriceWei);
    const basePrice = targetPrice * 0.98;
    let currentWalkPrice = targetPrice * (0.95 + Math.random() * 0.05);
    for(let i = steps; i >= 0; i--) {
        const time = new Date(now - (i * timeStep));
        if (i === 0) currentWalkPrice = targetPrice;
        else {
            const drift = (targetPrice - currentWalkPrice) * 0.05;
            const volatility = targetPrice * 0.008;
            currentWalkPrice += drift + (Math.random() - 0.5) * volatility;
        }
        currentWalkPrice = Math.max(targetPrice * 0.1, currentWalkPrice);
        data.push({ timestamp: time.getTime(), price: currentWalkPrice, basePrice });
    }
    return data;
};

const getTierTheme = (strength: number) => {
    if (strength >= 90) return { label: 'SOVEREIGN', color: '#facc15', glow: 'rgba(250, 204, 21, 0.6)', bgGlow: 'rgba(250, 204, 21, 0.15)' };
    if (strength >= 75) return { label: 'AUTHENTIC', color: '#00f3ff', glow: 'rgba(0, 243, 255, 0.6)', bgGlow: 'rgba(0, 243, 255, 0.15)' };
    if (strength >= 60) return { label: 'RELIABLE', color: '#a855f7', glow: 'rgba(168, 85, 247, 0.6)', bgGlow: 'rgba(168, 85, 247, 0.15)' };
    if (strength >= 45) return { label: 'CREDIBLE', color: '#00ff9d', glow: 'rgba(0, 255, 157, 0.6)', bgGlow: 'rgba(0, 255, 157, 0.15)' };
    return { label: 'EMERGING', color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)', bgGlow: 'rgba(148, 163, 184, 0.08)' };
};

const AgentShareModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    agent: Account; 
    mktCap: number; 
    price: number; 
    holders: number; 
    tags: { label: string; count?: number }[] 
}> = ({ isOpen, onClose, agent, mktCap, price, holders, tags }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    if (!isOpen) return null;

    const strength = computeTrust(agent.totalAssets || '0', agent.totalShares || '0');
    const theme = getTierTheme(strength);
    const canonicalLink = `https://inturank.intuition.box/#/markets/${agent.id}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(canonicalLink);
        toast.success("Link copied");
        playClick();
    };

    const handleShareX = () => {
        const text = `Inspecting ${agent.label} on @IntuRank. Quantifying trust at ${strength.toFixed(1)}% conviction. 🚀\n\nJoin the claim:`;
        const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(canonicalLink)}`;
        window.open(xUrl, '_blank');
        playClick();
    };

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsDownloading(true);
        playClick();
        try {
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: '#050814',
                scale: 3,
                useCORS: true,
                logging: false,
                allowTaint: true
            });
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `inturank-${agent.label.toLowerCase()}-claim.png`;
            link.click();
            toast.success("NEURAL_FRAME_DOWNLOADED");
        } catch (e) {
            toast.error("DOWNLOAD_FAILURE");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/98 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose}>
            <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
                <div 
                    ref={cardRef} 
                    className="relative bg-[#020308] border-2 py-10 px-12 clip-path-slant shadow-[0_0_150px_rgba(0,0,0,1)] overflow-hidden group/modal transition-all duration-1000"
                    style={{ 
                        borderColor: `${theme.color}aa`,
                        boxShadow: `0 0 100px ${theme.bgGlow}`
                    }}
                >
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20 pointer-events-none"></div>
                    <div 
                        className="absolute inset-0 transition-opacity duration-1000"
                        style={{ background: `radial-gradient(circle at 50% 0%, ${theme.bgGlow}, transparent 70%)` }}
                    ></div>
                    
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                    <div className="flex justify-between items-center mb-8 relative z-10 gap-10">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 text-[10px] font-black font-mono uppercase tracking-[0.5em] mb-3 transition-colors duration-1000" style={{ color: theme.color }}>
                                <Activity size={14} className="animate-pulse" /> Activity
                            </div>
                            <h2 
                                className="text-4xl md:text-5xl lg:text-6xl font-black font-display text-white tracking-tighter uppercase leading-tight break-all transition-all duration-1000"
                                style={{ textShadow: `0 0 30px ${theme.color}66` }}
                            >
                                {agent.label}
                            </h2>
                        </div>
                        <div 
                            className="w-24 h-24 bg-black border-2 flex items-center justify-center rounded-none clip-path-slant shrink-0 group-hover/modal:border-white transition-all duration-1000 overflow-hidden shadow-2xl"
                            style={{ borderColor: `${theme.color}66`, boxShadow: `0 0 30px ${theme.bgGlow}` }}
                        >
                            {agent.image ? (
                              <img src={agent.image} className="w-full h-full object-cover" crossOrigin="anonymous" alt="" />
                            ) : (
                              <Logo className="w-14 h-14 transition-colors duration-1000" style={{ filter: `drop-shadow(0 0 8px ${theme.color})` }} />
                            )}
                        </div>
                    </div>

                    <div className="mb-8 relative z-10">
                        <div className="text-[9px] font-black font-mono text-slate-500 uppercase tracking-widest mb-4">SEMANTIC_TAGS:</div>
                        <div className="flex flex-wrap gap-2.5">
                            {tags.slice(0, 7).map((tag, i) => (
                                <span 
                                    key={i} 
                                    className="px-4 py-1.5 bg-white/5 border border-white/10 text-[9px] font-black text-white uppercase tracking-wider rounded-full hover:border-white transition-colors cursor-default"
                                    style={{ borderColor: i === 0 ? `${theme.color}66` : '' }}
                                >
                                    {tag.label}
                                </span>
                            ))}
                            {tags.length > 7 && <span className="px-4 py-1.5 bg-white/5 border border-white/10 text-[9px] font-black text-white uppercase tracking-wider rounded-full">+{tags.length - 7} more</span>}
                        </div>
                    </div>

                    <div className="mb-8 relative z-10">
                        <div className="text-[9px] font-black font-mono text-slate-500 uppercase tracking-widest mb-4">DESCRIPTION_PAYLOAD:</div>
                        <div className="p-6 bg-black border border-white/5 clip-path-slant relative group/desc">
                            <div 
                                className="absolute left-0 top-0 bottom-0 w-1 transition-colors duration-1000"
                                style={{ backgroundColor: `${theme.color}88` }}
                            ></div>
                            <p className="text-sm font-mono text-slate-300 leading-relaxed uppercase tracking-tight line-clamp-3 group-hover:text-white transition-colors">
                                {agent.description || "Establishing logical connectivity within the Intuition Trust Graph. Node identity verified and synchronized for global capital signaling."}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 relative z-10">
                        <div className="bg-black/60 border border-white/10 p-5 clip-path-slant group/stat hover:border-white/30 transition-all">
                            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 group-hover:stat:text-white transition-colors">Mkt_Cap</div>
                            <div className="text-2xl font-black text-white font-display tracking-tight leading-none group-hover:stat:text-glow-white">{formatMarketValue(mktCap)}</div>
                        </div>
                        <div className="bg-black/60 border border-white/10 p-5 clip-path-slant group/stat hover:border-white/30 transition-all">
                            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 group-hover:stat:text-white transition-colors">Spot_Price</div>
                            <div className="text-2xl font-black text-white font-display tracking-tight leading-none group-hover:stat:text-glow-white">{formatMarketValue(price)}</div>
                        </div>
                        <div className="bg-black border border-white/10 p-5 clip-path-slant group/stat transition-all" style={{ borderColor: `${theme.color}55` }}>
                            <div 
                                className="text-[8px] uppercase font-black tracking-widest mb-2 transition-colors duration-1000"
                                style={{ color: theme.color }}
                            >Conviction</div>
                            <div 
                                className="text-2xl font-black font-display tracking-tight leading-none transition-all duration-1000"
                                style={{ color: theme.color, textShadow: `0 0 15px ${theme.color}88` }}
                            >{strength.toFixed(1)}%</div>
                        </div>
                        <div className="bg-black/60 border border-white/10 p-5 clip-path-slant group/stat hover:border-white/30 transition-all">
                            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 group-hover:stat:text-white transition-colors">Holders</div>
                            <div className="text-2xl font-black text-white font-display tracking-tight leading-none group-hover:stat:text-glow-white">{formatLargeNumber(holders)}</div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-8 border-t border-white/10 opacity-60 relative z-10 font-mono">
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.6em]">CERTIFIED_BY_INTURANK_PROTOCOL // V.1.5.0</div>
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{new Date().toLocaleDateString()} // NEURAL_SYNC_S04</div>
                    </div>
                </div>

                <div className="mt-10 flex flex-col md:flex-row gap-4">
                    <button onClick={handleShareX} className="flex-1 py-5 bg-white/5 border border-white/10 text-white hover:bg-white hover:text-black font-black uppercase text-[10px] tracking-[0.4em] clip-path-slant transition-all flex items-center justify-center gap-3 active:scale-95 shadow-2xl">
                        <Twitter size={16} /> Share_on_X
                    </button>
                    <button onClick={handleCopyLink} className="flex-1 py-5 bg-white/5 border border-white/10 text-white hover:bg-white hover:text-black font-black uppercase text-[10px] tracking-[0.4em] clip-path-slant transition-all flex items-center justify-center gap-3 active:scale-95 shadow-2xl">
                        <Copy size={16} /> Copy_Uplink
                    </button>
                    <button 
                        onClick={handleDownload} 
                        disabled={isDownloading} 
                        className="flex-1 py-5 text-black font-black uppercase text-[10px] tracking-[0.4em] clip-path-slant transition-all flex items-center justify-center gap-3 hover:bg-white active:scale-95 duration-700 shadow-2xl"
                        style={{ backgroundColor: theme.color, boxShadow: `0 0 50px ${theme.glow}` }}
                    >
                        {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
                        Download_Frame
                    </button>
                </div>
                
                <div className="mt-8 text-center">
                    <button onClick={onClose} className="text-[9px] font-black font-mono text-slate-700 hover:text-white uppercase tracking-[1em] transition-colors">TERMINATE_SESSION</button>
                </div>
            </div>
        </div>
    );
};

const MarketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { address: wagmiAddress } = useAccount();
  const [agent, setAgent] = useState<Account | null>(null);
  const [oppositionAgent, setOppositionAgent] = useState<any | null>(null);
  const [triples, setTriples] = useState<Triple[]>([]);
  const [activityLog, setActivityLog] = useState<Transaction[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [totalHoldersCount, setTotalHoldersCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [lists, setLists] = useState<any[]>([]);
  const [engagedIdentities, setEngagedIdentities] = useState<any[]>([]);
  const [followingPositions, setFollowingPositions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('OVERVIEW');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [isWatched, setIsWatched] = useState(false);
  const [action, setAction] = useState<'ACQUIRE' | 'LIQUIDATE'>('ACQUIRE');
  const [sentiment, setSentiment] = useState<'TRUST' | 'DISTRUST'>('TRUST');
  const [inputAmount, setInputAmount] = useState('');
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState('0.00');
  
  const [trustBalance, setTrustBalance] = useState('0.00');
  const [distrustBalance, setDistrustBalance] = useState('0.00');

  const [isApproved, setIsApproved] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [txModal, setTxModal] = useState<any>({ isOpen: false, status: 'idle', title: '', message: '', hash: undefined, logs: [] });
  const [hoverData, setHoverData] = useState<any>(null);

  const [userPosition, setUserPosition] = useState<any>(null);
  const [cardStats, setCardStats] = useState<any>(null);
  const [estimatedProceeds, setEstimatedProceeds] = useState<string>('0.00');
  const [isQuoting, setIsQuoting] = useState(false);
  const [vaultsByCurve, setVaultsByCurve] = useState<VaultByCurve[]>([]);
  const [selectedCurveId, setSelectedCurveId] = useState<1 | 2>(LINEAR_CURVE_ID as 1);
  const [isCurveInfoOpen, setIsCurveInfoOpen] = useState(false);

  // Determine if sentiment toggle should be available (Strictly Claims and Lists)
  const isPolarityAvailable = useMemo(() => {
    if (!agent) return false;
    return agent.type === 'CLAIM' || agent.type === 'LIST';
  }, [agent]);

  const fetchData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const acc = await getConnectedAccount();
            setWallet(acc);
            if (acc) {
                setIsWatched(isInWatchlist(id, acc));
                checkProxyApproval(acc).then(setIsApproved);
            }

            const [agentData, oppoData, triplesData, activityData, holderResult, listData, engagedData, incomingResult, vaults] = await Promise.all([
                getAgentById(id),
                getOppositionTriple(id),
                getAgentTriples(id),
                getMarketActivity(id),
                getHoldersForVault(id),
                getAtomInclusionLists(id),
                getIdentitiesEngaged(id),
                getIncomingTriplesForStats(id),
                getVaultsForTerm(id)
            ]);

            setAgent(agentData);
            setOppositionAgent(oppoData);
            setTriples(triplesData || []);
            
            let mergedActivity = activityData || [];
            if (acc) {
                const localHistory = getLocalTransactions(acc);
                const relevantLocal = localHistory.filter(tx => tx.vaultId?.toLowerCase() === id.toLowerCase() || (oppoData && tx.vaultId?.toLowerCase() === oppoData.id.toLowerCase()) || (agentData?.counterTermId && tx.vaultId?.toLowerCase() === agentData.counterTermId.toLowerCase()));
                const onChainHashes = new Set(mergedActivity.map(tx => tx.id.toLowerCase()));
                const uniqueLocal = relevantLocal.filter(tx => !onChainHashes.has(tx.id.toLowerCase()));
                mergedActivity = [...uniqueLocal, ...mergedActivity].sort((a, b) => b.timestamp - a.timestamp);
            }
            setActivityLog(mergedActivity);

            setHolders(holderResult.holders || []);
            setTotalHoldersCount(holderResult.totalCount);
            setLists(listData || []);
            setEngagedIdentities(engagedData || []);
            setFollowersCount(incomingResult.totalCount);
            setVaultsByCurve(vaults || []);
            setChartData(generateAnchoredHistory(agentData.totalAssets || '0', agentData.totalShares || '0', agentData.currentSharePrice, timeframe));

            if (acc) {
                setWalletBalance(await getWalletBalance(acc));
                const curveId = selectedCurveId;
                const tShares = await getShareBalance(acc, id, curveId);
                setTrustBalance(tShares);

                let dShares = '0.00';
                if (agentData.type === 'CLAIM') {
                    const cId = agentData.counterTermId || calculateCounterTripleId(id!);
                    dShares = await getShareBalance(acc, cId, curveId);
                } else if (oppoData) {
                    dShares = await getShareBalance(acc, oppoData.id, curveId);
                }
                setDistrustBalance(dShares);

                updatePositionSummary(acc, sentiment, mergedActivity, agentData, oppoData, curveId);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
  };

  const updatePositionSummary = async (acc: string, side: 'TRUST' | 'DISTRUST', activity: Transaction[], agentData: any, oppoData: any, curveId: number = selectedCurveId) => {
    let currentVaultId = id;
    if (side === 'DISTRUST') {
        currentVaultId = agentData?.type === 'CLAIM' ? (agentData.counterTermId || calculateCounterTripleId(id!)) : oppoData?.id;
    }

    if (!currentVaultId) {
        setUserPosition(null);
        return;
    }

    const sharesRaw = await getShareBalance(acc, currentVaultId, curveId);
    const sharesNum = parseFloat(sharesRaw);

    if (sharesNum > 0.0001) {
        const redeemableQuote = await getQuoteRedeem(sharesRaw, currentVaultId, acc, curveId);
        const redeemableNum = parseFloat(redeemableQuote);
        const { pnlPercent, avgEntryPrice } = calculatePositionPnL(sharesNum, redeemableNum, activity, currentVaultId);
        
        setUserPosition({
            shares: sharesNum.toFixed(4),
            value: redeemableNum.toFixed(4),
            pnl: pnlPercent.toFixed(2),
            entry: avgEntryPrice.toFixed(4),
            exit: (redeemableNum / sharesNum).toFixed(4), 
        });
    } else {
        setUserPosition(null);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  // When selected curve changes, refresh chart from that vault and user balances/position for that curve
  useEffect(() => {
    const vault = vaultsByCurve.find((v) => v.curve_id === selectedCurveId);
    if (vault) {
      setChartData(generateAnchoredHistory(vault.total_assets, vault.total_shares, vault.current_share_price, timeframe));
    }
    if (wallet && id) {
      getShareBalance(wallet, id, selectedCurveId).then(setTrustBalance);
      if (agent?.type === 'CLAIM') {
        const cId = agent.counterTermId || calculateCounterTripleId(id);
        getShareBalance(wallet, cId, selectedCurveId).then(setDistrustBalance);
      } else if (oppositionAgent) {
        getShareBalance(wallet, oppositionAgent.id, selectedCurveId).then(setDistrustBalance);
      }
      if (agent && id) updatePositionSummary(wallet, sentiment, activityLog, agent, oppositionAgent, selectedCurveId);
    }
  }, [selectedCurveId, vaultsByCurve, timeframe, wallet, id, agent, oppositionAgent, sentiment, activityLog]);

  // Sync wallet from wagmi so Execution Deck / SIGNAL_TRUST has connected wallet when user connected in header
  useEffect(() => {
    if (!wagmiAddress) {
      setWallet(null);
      return;
    }
    setWallet(wagmiAddress);
    getWalletBalance(wagmiAddress).then(setWalletBalance);
    if (id) {
      setIsWatched(isInWatchlist(id, wagmiAddress));
      checkProxyApproval(wagmiAddress).then(setIsApproved);
    }
  }, [wagmiAddress, id]);

  useEffect(() => {
        if (agent) {
            setChartData(generateAnchoredHistory(agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice, timeframe));
        }
  }, [timeframe, agent]);

  useEffect(() => {
      if (wallet && agent) {
          updatePositionSummary(wallet, sentiment, activityLog, agent, oppositionAgent, selectedCurveId);
      }
  }, [sentiment, wallet, activityLog, selectedCurveId]);

  // Lock sentiment to TRUST for standard atoms
  useEffect(() => {
    if (agent && !isPolarityAvailable && sentiment !== 'TRUST') {
      setSentiment('TRUST');
    }
  }, [agent, isPolarityAvailable, sentiment]);

  useEffect(() => {
    const activeTargetId = sentiment === 'TRUST' 
        ? id 
        : (agent?.type === 'CLAIM' ? (agent?.counterTermId || calculateCounterTripleId(id!)) : oppositionAgent?.id);

    if (action === 'LIQUIDATE' && inputAmount && parseFloat(inputAmount) > 0 && wallet && activeTargetId) {
        const timer = setTimeout(async () => {
            setIsQuoting(true);
            try {
                const quote = await getQuoteRedeem(inputAmount, activeTargetId, wallet, selectedCurveId);
                setEstimatedProceeds(parseFloat(quote).toFixed(4));
            } catch (e) {
                setEstimatedProceeds('0.0000');
            } finally {
                setIsQuoting(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    } else {
        setEstimatedProceeds('0.0000');
    }
  }, [inputAmount, action, wallet, id, sentiment, agent, oppositionAgent, selectedCurveId]);

  const addLog = (log: string) => {
    setTxModal(prev => ({ ...prev, logs: [...prev.logs, log] }));
  };

  const handleExecute = async () => {
        playClick();
        // Prefer wagmi address so we're in sync with header
        let activeWallet = wagmiAddress ?? wallet;
        if (!activeWallet) {
            activeWallet = await getConnectedAccount();
            if (!activeWallet) {
                toast.error("WALLET_CONNECTION_REQUIRED");
                return;
            }
            setWallet(activeWallet);
            setWalletBalance(await getWalletBalance(activeWallet));
        }

        let activeTargetId = id!;
        if (sentiment === 'DISTRUST') {
            if (agent?.type === 'CLAIM') {
                activeTargetId = agent.counterTermId || calculateCounterTripleId(id!);
            } else {
                activeTargetId = oppositionAgent?.id;
            }
        }

        if (!activeTargetId) {
            toast.error("Claim not found: opposition not initialized.");
            return;
        }

            if (action === 'ACQUIRE' && !isApproved) {
            setTxModal({ isOpen: true, status: 'processing', title: 'PERMISSION_HANDSHAKE', message: 'Authorizing protocol uplink...', logs: ['Simulating Handshake...'] });
            try {
                await grantProxyApproval(activeWallet);
                setIsApproved(true);
                setTxModal({ isOpen: false });
                toast.success("HANDSHAKE_VERIFIED");
            } catch (e) {
                setTxModal({ isOpen: true, status: 'error', title: 'AUTH_FAILED', message: parseProtocolError(e), logs: ['Simulation Failed.', 'Protocol Unreachable.'] });
            }
            return;
        }

        if (!inputAmount || parseFloat(inputAmount) <= 0) {
            toast.error(action === 'ACQUIRE' ? 'Enter transmission volume (amount to acquire).' : 'Enter share volume to liquidate.');
            return;
        }
        setTxModal({ 
            isOpen: true, 
            status: 'processing', 
            title: action === 'ACQUIRE' ? 'Acquire shares' : 'Redeem', 
            message: 'Executing protocol handshake...',
            logs: ['Initializing Secure Uplink...'] 
        });
        
        try {
            let res: any;
            const logHandler = (msg: string) => addLog(msg);

            if (action === 'ACQUIRE') {
                res = await depositToVault(inputAmount, activeTargetId, activeWallet, selectedCurveId, logHandler);
            } else {
                res = await redeemFromVault(inputAmount, activeTargetId, activeWallet, selectedCurveId, logHandler);
            }
            
            playSuccess();
            
            const tickerName = (agent?.label || 'NODE').toUpperCase();
            const assetLabel = sentiment === 'TRUST' 
                ? `TRUSTING_${tickerName}` 
                : `OPPOSING_${tickerName}`;
            
            const localTx: Transaction = { 
                id: res.hash, 
                type: action === 'ACQUIRE' ? 'DEPOSIT' : 'REDEEM', 
                assets: res.assets ? res.assets.toString() : parseEther(inputAmount).toString(),
                shares: res.shares.toString(),
                timestamp: Date.now(), 
                vaultId: activeTargetId, 
                assetLabel: assetLabel
            };
            
            saveLocalTransaction(localTx, activeWallet);
            const sharesFormatted = formatDisplayedShares(res.shares);
            const assetsFormatted = res.assets
              ? `${CURRENCY_SYMBOL}${formatMarketValue(parseFloat(formatEther(res.assets)))}`
              : (action === 'ACQUIRE' ? `${CURRENCY_SYMBOL}${formatMarketValue(parseFloat(inputAmount))}` : '—');
            sendTransactionReceiptEmail(activeWallet, {
              txHash: res.hash,
              type: action === 'ACQUIRE' ? 'acquired' : 'liquidated',
              side: sentiment === 'TRUST' ? 'trust' : 'distrust',
              marketLabel: agent?.label || 'Claim',
              sharesFormatted,
              assetsFormatted,
            });
            setActivityLog(prev => [localTx, ...prev]);
            setTxModal(prev => ({ 
                ...prev, 
                status: 'success', 
                title: 'Done', 
                message: 'Transaction verified on-chain.', 
                hash: res.hash,
                logs: [...prev.logs, 'Finalizing Local Ledger Sync...', 'Uplink Synchronized.']
            }));
            setInputAmount('');

            // Refresh share balance for selected curve so LIQUIDATE shows correct balance (RPC may lag briefly)
            getShareBalance(activeWallet, id!, selectedCurveId).then(setTrustBalance);
            if (agent?.type === 'CLAIM') {
              const cId = agent.counterTermId || calculateCounterTripleId(id!);
              getShareBalance(activeWallet, cId, selectedCurveId).then(setDistrustBalance);
            } else if (oppositionAgent) {
              getShareBalance(activeWallet, oppositionAgent.id, selectedCurveId).then(setDistrustBalance);
            }
            updatePositionSummary(activeWallet, sentiment, [localTx, ...activityLog], agent!, oppositionAgent, selectedCurveId);

            // Re-fetch with slight delay to allow indexer to breathe (use selected curve for balances)
            setTimeout(() => { fetchData(); }, 4000);
        } catch (e) {
            setTxModal(prev => ({ 
                ...prev, 
                status: 'error', 
                title: 'UPLINK_LOST', 
                message: parseProtocolError(e),
                logs: [...prev.logs, 'CRITICAL: Protocol Connection Timed Out.']
            }));
        }
  };

  const handleGenerateHistoryCard = (tx: Transaction) => {
    playClick();
    const sharesNum = safeParseUnits(tx.shares);
    const assetsNum = safeParseUnits(tx.assets);
    
    if (sharesNum <= 0 || assetsNum <= 0) {
        toast.error("INVALID_TX_DATA: Missing units.");
        return;
    }

    const { pnlPercent, entry, exit } = calculateRealizedPnL(sharesNum, assetsNum, activityLog, tx.vaultId);
    
    setCardStats({ pnl: pnlPercent, entry, exit });
    setShowShareCard(true);
  };

  const handleMax = () => {
        playClick();
        if (action === 'ACQUIRE') setInputAmount(walletBalance);
        else setInputAmount(sentiment === 'TRUST' ? trustBalance : distrustBalance);
  };

  const getConvictionMetadata = (shares: string | number) => {
    const s = typeof shares === 'string' ? parseFloat(formatEther(BigInt(shares))) : shares;
    const ts = parseFloat(formatEther(BigInt(agent?.totalShares || '1')));
    const pct = ts > 0 ? (s / ts) * 100 : 0;
    
    if (pct >= 5) return { label: 'MAX_CONVICTION', color: 'text-intuition-primary border-intuition-primary/40 bg-intuition-primary/10 shadow-glow-blue' };
    if (pct >= 1) return { label: 'HIGH_CONVICTION', color: 'text-white border-white/20 bg-white/5' };
    if (pct >= 0.1) return { label: 'MID_CONVICTION', color: 'text-slate-400 border-slate-800' };
    return { label: 'Acquire / Redeem', color: 'text-slate-600 border-slate-900 opacity-60' };
  };

  if (loading || !agent)
        return <div className="min-h-screen flex items-center justify-center text-intuition-primary font-mono animate-pulse uppercase tracking-[0.5em] bg-black">Loading claim...</div>;

  const selectedVault = vaultsByCurve.find((v) => v.curve_id === selectedCurveId);
  const overallSpotPrice = calculateAgentPrice(
    agent.totalAssets || '0',
    agent.totalShares || '0',
    agent.currentSharePrice
  );
  const currentSpotPrice = selectedVault
    ? calculateAgentPrice(
        selectedVault.total_assets,
        selectedVault.total_shares,
        selectedVault.current_share_price
      )
    : overallSpotPrice;
  const currentStrength = computeTrust(
    agent.totalAssets || '0',
    agent.totalShares || '0',
    agent.currentSharePrice
  );
  const mktCapVal = calculateMarketCap(
    agent.marketCap || agent.totalAssets || '0',
    agent.totalShares || '0',
    agent.currentSharePrice
  );
  const displayPrice = hoverData ? hoverData.price : currentSpotPrice;
  const theme = getTierTheme(currentStrength);
  const verified = isSystemVerified(agent);

  const tags = Array.from(new Map<string, { label: string; count: number }>(triples
        .filter(t => t.subject?.term_id === agent.id)
        .map(t => [t.object.term_id, { label: t.object.label, count: Math.floor(Math.random() * 2000) + 1 }])).values());
  
  const activeBalance = sentiment === 'TRUST' ? trustBalance : distrustBalance;

  return (
    <div className="w-full px-3 sm:px-6 lg:px-10 pt-4 sm:pt-6 pb-24 sm:pb-32 font-mono text-[#e2e8f0] bg-[#020308] max-w-[100vw] overflow-x-hidden">
        <Link
          to="/markets"
          onClick={playClick}
          onMouseEnter={playHover}
          className="inline-flex items-center gap-2 px-4 py-2.5 mb-6 border-2 border-slate-700 text-slate-400 hover:border-intuition-primary hover:text-intuition-primary font-black text-[10px] uppercase tracking-widest clip-path-slant transition-all duration-200 hover:shadow-glow-blue"
        >
          <ArrowLeft size={16} /> Back to claims
        </Link>
        <TransactionModal 
            isOpen={txModal.isOpen} 
            status={txModal.status} 
            title={txModal.title} 
            message={txModal.message} 
            hash={txModal.hash} 
            logs={txModal.logs}
            onClose={() => setTxModal(p => ({ ...p, isOpen: false }))} 
        />
        <CreateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
        <BondingCurvesInfoPanel isOpen={isCurveInfoOpen} onClose={() => setIsCurveInfoOpen(false)} />
        <AgentShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} agent={agent} mktCap={mktCapVal} price={currentSpotPrice} holders={totalHoldersCount} tags={tags} />
        
        {showShareCard && cardStats && (
          <div className="fixed inset-0 bg-black/98 z-[300] flex items-center justify-center p-4 backdrop-blur-3xl animate-in zoom-in duration-300" onClick={() => setShowShareCard(false)}>
            <div className="relative w-full max-lg" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowShareCard(false)} className="absolute -top-16 right-0 text-slate-500 hover:text-white transition-colors p-2 group"><X size={32} className="group-hover:rotate-90 transition-transform" /></button>
              <ShareCard 
                username={wallet || '0xUser'} 
                pnl={cardStats.pnl} 
                entryPrice={cardStats.entry} 
                currentPrice={cardStats.exit} 
                assetName={agent?.label || 'Unknown'} 
                assetImage={agent?.image} 
                side={sentiment} 
                themeColor={sentiment === 'DISTRUST' ? '#ff1e6d' : theme.color} 
              />
              <div className="text-center mt-6 text-slate-600 text-[8px] font-black font-mono uppercase tracking-[0.8em] animate-pulse">CLICK_OUTSIDE_TO_CLOSE</div>
            </div>
          </div>
        )}

        {/* Header telemetry and layout */}
        <div className="flex flex-wrap items-center gap-3 mb-10 overflow-x-auto pb-2 no-scrollbar">
            {tags.slice(0, 6).map((tag, idx) => (
                <div key={idx} className="flex items-center gap-2.5 px-5 py-2.5 bg-white/5 border border-white/10 rounded-full hover:border-intuition-primary/60 transition-all group cursor-default hover:shadow-glow-blue">
                    <span className="text-[10px] font-black text-white uppercase tracking-tight">{tag.label}</span>
                    <span className="text-[10px] text-slate-700 font-mono">•</span>
                    <div className="flex items-center gap-2">
                        <Users size={11} className="text-slate-600" />
                        <span className="text-[10px] font-mono text-slate-500">{formatLargeNumber(tag.count || 0)}</span>
                    </div>
                </div>))}
        </div>

        {/* Header content */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-8 mb-12 py-8 border-b border-white/5 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-4 shrink-0">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Total Mkt Cap</span>
                <div className="flex items-center gap-2.5">
                    <span className="text-xl font-black text-white font-display tracking-tight leading-none text-glow-white">{formatMarketValue(mktCapVal)}</span>
                    <Globe size={16} className="text-slate-700" />
                </div>
            </div>
            <div className="hidden lg:block w-[1px] h-4 bg-white/10"></div>
            <div className="flex items-center gap-4 shrink-0">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Total Holders</span>
                <span className="text-xl font-black text-white font-display tracking-tight leading-none text-glow-white">{formatLargeNumber(totalHoldersCount)}</span>
            </div>
            <div className="hidden lg:block w-[1px] h-4 bg-white/10"></div>
            <div className="flex items-center gap-4 shrink-0">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Followers</span>
                <span className="text-xl font-black text-white font-display tracking-tight leading-none text-glow-white">{formatLargeNumber(followersCount)}</span>
            </div>
            <div className="hidden lg:block w-[1px] h-4 bg-white/10"></div>
            <div className="flex items-center gap-5 shrink-0">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Creator</span>
                {agent.creator?.id ? (
                    <a href={`${EXPLORER_URL}/address/${agent.creator.id}`} target="_blank" rel="noreferrer" onClick={playClick} onMouseEnter={playHover} className="flex items-center gap-2.5 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full hover:border-intuition-primary/40 transition-all cursor-pointer group/creator">
                        <div className="w-5 h-5 rounded-full bg-slate-900 border border-white/20 overflow-hidden shrink-0 shadow-glow-blue"><img src={`https://effigy.im/a/${agent.creator.id}.png`} className="w-full h-full object-cover" alt="" /></div>
                        <span className="text-[10px] font-black text-white group-hover/creator:text-intuition-primary transition-colors">{agent.creator?.label || agent.creator?.id?.slice(0, 14)}</span>
                        <ExternalLink size={10} className="text-slate-600 group-hover/creator:text-intuition-primary" />
                    </a>) : (
                    <div className="flex items-center gap-2.5 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-slate-500"><User size={10} /><span className="text-[10px] font-black uppercase">Anonymous</span></div>)}
            </div>
            <div className="hidden lg:block w-[1px] h-4 bg-white/10"></div>
            <div className="flex items-center gap-5 lg:ml-auto">
                <button onClick={() => { playClick(); setIsShareModalOpen(true); }} onMouseEnter={playHover} className="w-11 h-11 flex items-center justify-center bg-black border border-white/10 hover:border-intuition-primary hover:text-intuition-primary transition-all rounded-full group shadow-2xl hover:shadow-glow-blue" title="Share claim"><Share2 size={20} className="group-hover:scale-110 transition-transform" /></button>
                <a href={`${EXPLORER_URL}/address/${agent.id}`} target="_blank" rel="noreferrer" onMouseEnter={playHover} className="w-11 h-11 flex items-center justify-center bg-black border border-white/10 hover:border-intuition-primary hover:text-intuition-primary transition-all rounded-full group shadow-2xl hover:shadow-glow-blue" title="INITIALIZE_NODE_RECON"><ScanSearch size={20} className="group-hover:scale-110 transition-transform" /></a>
            </div>
        </div>

        <div className="bg-[#02040a] border-2 clip-path-slant p-4 sm:p-6 md:p-8 mb-6 md:mb-8 flex flex-col md:flex-row items-center justify-between relative overflow-hidden shadow-2xl group/header transition-all duration-700" style={{ borderColor: `${theme.color}44`, boxShadow: `0 0 40px ${theme.bgGlow}` }}>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10"></div>
            <div className="flex items-center gap-4 sm:gap-6 md:gap-10 relative z-10 w-full min-w-0">
                <div className="relative shrink-0">
                    <div className="absolute -inset-4 md:-inset-6 blur-2xl opacity-0 group-hover/header:opacity-100 transition-opacity duration-1000" style={{ backgroundColor: `${theme.color}33` }}></div>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-slate-950 border-2 flex items-center justify-center overflow-hidden clip-path-slant shadow-2xl group-hover/header:scale-105 transition-all duration-700" style={{ borderColor: `${theme.color}66` }}>{agent.image ? <img src={agent.image} alt={agent.label} className="w-full h-full object-cover group-hover/header:scale-110 transition-transform duration-1000" /> : <User size={40} className="text-slate-800 md:w-[52px] md:h-[52px]" />}</div>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="w-2 h-2 rounded-full bg-intuition-success animate-pulse shadow-[0_0_10px_#00ff9d]"></div>
                        {verified ? (
                            <span className="flex items-center gap-1.5 px-2 sm:px-3 py-1 bg-intuition-primary/10 border border-intuition-primary/40 text-intuition-primary text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] shadow-glow-blue">
                                <BadgeCheck size={12} className="sm:w-[14px] sm:h-[14px]" /> System_Verified_Node
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 px-2 sm:px-3 py-1 bg-slate-900 border border-slate-700 text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em]">
                                <UserCog size={12} className="sm:w-[14px] sm:h-[14px]" /> Custom_User_Node
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black text-white font-display uppercase tracking-tighter text-glow-white leading-tight mb-2 sm:mb-4 break-words">{agent.label}</h1>
                    <div className="flex items-center gap-5 text-[9px] font-black text-slate-600 uppercase tracking-widest"><div className="flex items-center gap-2"><Hash size={13} className="text-slate-700" /><span>NODE_ID: <span className="text-slate-500 font-mono">{agent.id.slice(0, 18)}...</span></span></div><div className="w-1 h-1 rounded-full bg-slate-800"></div><span className="px-2.5 py-1 border font-black text-[8px] tracking-[0.2em]" style={{ color: theme.color, borderColor: `${theme.color}44`, backgroundColor: `${theme.color}11` }}>LINEAR_CURVE_UTILITY</span></div>
                </div>
            </div>
            
            <div className="mt-10 md:mt-0 flex flex-col items-end gap-3 relative z-10 text-right">
                <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">Network_Conviction_Score</div>
                <div className="flex items-end gap-8 mb-2">
                    <div className="flex flex-col items-center group/prob">
                        <div className="text-4xl font-black text-intuition-success text-glow-success transition-all group-hover/prob:scale-110">{currentStrength.toFixed(1)}%</div>
                        <div className="mt-1 flex items-center justify-center"><CurrencySymbol size="sm" className="text-slate-500" /></div>
                    </div>
                </div>
                <div className="text-sm font-black text-slate-700 font-mono uppercase tracking-[0.4em]">Convergence_L3_Confirmed</div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start mb-16">
            <div className="lg:col-span-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-black border p-8 clip-path-slant relative overflow-hidden group shadow-2xl h-full flex flex-col justify-center hover:border-white/40 transition-colors duration-700" style={{ borderColor: `${theme.color}44` }}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-125 transition-transform duration-1000"><Shield size={100} /></div>
                        <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] mb-8 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_12px_currentColor]" style={{ backgroundColor: theme.color }}></div> REPUTATION CLASS</div>
                        <div className="text-2xl sm:text-3xl md:text-5xl font-black font-display text-white text-glow-white mb-2 leading-none uppercase tracking-tighter transition-all duration-700" style={{ color: theme.color, textShadow: `0 0 20px ${theme.color}66` }}>{theme.label}</div>
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">NEURAL_CONVERGENCE: <span style={{ color: theme.color }}>{currentStrength.toFixed(1)}%</span></div>
                    </div>
                    <div className="md:col-span-2"><AIBriefing agent={agent} triples={triples} history={activityLog} /></div>
                </div>

                <div className="bg-black border border-slate-900 flex flex-col clip-path-slant relative overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)] min-h-[320px] h-[50vh] sm:h-[420px] md:h-[550px] lg:h-[650px] group/chart">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
                    <div className="p-4 sm:p-6 md:p-10 flex flex-col md:flex-row justify-between items-end bg-[#02040a]/80 backdrop-blur-md relative z-20 border-b border-white/5 gap-4 md:gap-8">
                        <div>
                            <div className="flex items-baseline gap-2 sm:gap-3 mb-2 flex-wrap"><div className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black text-white font-display tracking-tighter leading-none group-hover/chart:text-glow-white transition-all duration-700 flex items-baseline gap-2"><CurrencySymbol size="3xl" leading className="text-white/90" /><span>{formatMarketValue(displayPrice)}</span></div><div className="text-[10px] sm:text-[14px] text-slate-500 font-mono tracking-widest uppercase font-black">/ PORTAL_SHARE</div></div>
                            <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.4em] mt-3 text-glow" style={{ color: theme.color }}><Activity size={12} className="animate-pulse shadow-[0_0_15px_currentColor]" /> Live</div>
                        </div>
                        <div className="flex gap-12 font-black text-right pb-1">
                             <div className="flex flex-col items-end group/item"><span className="text-[9px] text-slate-600 uppercase tracking-widest mb-2 group-hover/item:text-white transition-colors">24H_VOLATILITY</span><span className="text-2xl text-white font-display tracking-tight text-glow-white">0.82%</span></div>
                             <div className="flex flex-col items-end group/item"><span className="text-[9px] text-slate-600 uppercase tracking-widest mb-2 group-hover/item:text-white transition-colors">LINEAR_MARKET_RATE</span><span className="text-2xl font-display tracking-tight uppercase text-glow" style={{ color: theme.color }}>STABLE</span></div>
                        </div>
                    </div>
                    <div className="px-3 sm:px-6 md:px-10 py-3 bg-white/5 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 z-20 overflow-x-auto">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { playClick(); setIsCurveInfoOpen(true); }} onMouseEnter={playHover} className="p-1.5 text-slate-500 hover:text-intuition-primary transition-colors" aria-label="How bonding curves work">
                          <Info size={16} />
                        </button>
                        {([LINEAR_CURVE_ID, OFFSET_PROGRESSIVE_CURVE_ID] as const).map((cid) => (
                          <button key={cid} onClick={() => { playClick(); setSelectedCurveId(cid); }} className={`min-h-[40px] px-3 py-2 text-[9px] font-black font-mono transition-all clip-path-slant uppercase tracking-widest shrink-0 ${selectedCurveId === cid ? 'bg-white text-black shadow-glow-white' : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'}`}>
                            {getCurveLabel(cid) === 'LINEAR' ? 'Linear' : 'Exponential'}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5 sm:gap-2 min-w-0">{(['15M', '30M', '1H', '4H', '1D', '1W', '1M', '1Y', 'ALL'] as Timeframe[]).map((tf) => (<button key={tf} onClick={() => { playClick(); setTimeframe(tf); }} className={`min-h-[44px] px-3 sm:px-4 py-2.5 sm:py-2 text-[9px] sm:text-[10px] font-black font-mono transition-all clip-path-slant uppercase tracking-widest shrink-0 ${timeframe === tf ? 'bg-white text-black shadow-glow-white' : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'}`}>{tf}</button>))}</div>
                    </div>
                    <div className="flex-1 w-full relative z-10 p-4 pt-10" style={{ background: `radial-gradient(circle at 50% -20%, ${theme.bgGlow}, transparent 70%)` }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} onMouseMove={(e: any) => { if (e?.activePayload) setHoverData(e.activePayload[0].payload); }} onMouseLeave={() => setHoverData(null)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                                <defs><linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={theme.color} stopOpacity={0.4}/><stop offset="95%" stopColor={theme.color} stopOpacity={0}/></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 6" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="timestamp" hide />
                                <YAxis orientation="right" domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={80} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: theme.color, strokeWidth: 1 }} />
                                <ReferenceLine y={currentSpotPrice} stroke={`${theme.color}33`} strokeDasharray="3 3" />
                                <Area type="monotone" dataKey="price" stroke={theme.color} strokeWidth={4} fill="url(#priceGrad)" isAnimationActive={true} animationDuration={1500} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
                <div className="bg-black border border-slate-900 p-8 clip-path-slant shadow-2xl relative overflow-hidden group hover:border-white/20 transition-colors duration-700">
                    <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">CIRCULATING_SHARES</h4>
                        <span className="text-[11px] font-black text-glow" style={{ color: theme.color }}>{formatDisplayedShares(selectedVault?.total_shares ?? (agent.totalShares || '0'))} UNITS</span>
                    </div>
                    <div className="flex gap-2.5 h-4 px-1">
                        {[...Array(12)].map((_, i) => {
                            const assetsVal = safeParseUnits(selectedVault?.total_assets ?? (agent.totalAssets || '0'));
                            const fill = Math.min(12, Math.floor(assetsVal / 8));
                            return <div key={i} className={`flex-1 h-full clip-path-slant transition-all duration-1000 ${i < fill ? 'shadow-glow' : 'bg-slate-900 opacity-20'}`} style={{ backgroundColor: i < fill ? theme.color : '' }}></div>;
                        })}
                    </div>
                    <div className="mt-4 text-[7px] text-slate-700 font-mono uppercase text-center tracking-[0.3em] opacity-60">{getCurveLabel(selectedCurveId)}_Curve_Active</div>
                </div>

                <div className={`bg-black border-2 p-1 clip-path-slant shadow-[0_0_60px_rgba(0,0,0,0.6)] group transition-all duration-500 hover:border-white/40 ${sentiment === 'DISTRUST' ? 'border-intuition-danger/40' : ''}`} style={{ borderColor: sentiment === 'TRUST' ? `${theme.color}44` : '' }}>
                    <div className="bg-[#050505] p-6 sm:p-8 border border-white/5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none" aria-hidden />
                        <h2 className={`text-sm font-black uppercase tracking-wider mb-6 flex items-center gap-2 ${sentiment === 'DISTRUST' ? 'text-intuition-danger' : ''}`} style={{ color: sentiment === 'TRUST' ? theme.color : '' }}>
                          Trade
                          <span className={`w-1.5 h-1.5 rounded-full ${sentiment === 'DISTRUST' ? 'bg-intuition-danger' : ''}`} style={{ backgroundColor: sentiment === 'TRUST' ? theme.color : '' }} />
                        </h2>
                        <div className="flex gap-1.5 mb-6">
                            <button
                              onClick={() => {
                                setAction('ACQUIRE');
                                playClick();
                              }}
                              className={`flex-1 py-3.5 text-[10px] font-black clip-path-slant transition-all uppercase tracking-wider border-2 ${
                                action === 'ACQUIRE'
                                  ? 'bg-white text-black border-white'
                                  : 'border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'
                              }`}
                            >
                              Buy
                            </button>
                            <button
                              onClick={() => {
                                setAction('LIQUIDATE');
                                setSelectedCurveId(LINEAR_CURVE_ID);
                                playClick();
                              }}
                              className={`flex-1 py-3.5 text-[10px] font-black clip-path-slant transition-all uppercase tracking-wider border-2 ${
                                action === 'LIQUIDATE'
                                  ? 'bg-intuition-secondary text-white border-intuition-secondary'
                                  : 'border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'
                              }`}
                            >
                              Sell
                            </button>
                        </div>

                        <div className="mb-6 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-400">
                              {getCurveLabel(selectedCurveId) === 'LINEAR' ? 'Linear' : 'Exponential'}
                            </span>
                            <button type="button" onClick={() => { playClick(); setIsCurveInfoOpen(true); }} onMouseEnter={playHover} className="p-1 text-slate-500 hover:text-intuition-primary transition-colors" aria-label="How curves work">
                              <Info size={12} />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            {selectedCurveId === LINEAR_CURVE_ID ? 'Low risk' : 'Higher risk, higher returns'}
                          </p>
                        </div>
                        
                        {isPolarityAvailable && (
                            <div className="mb-6">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Side</p>
                                <div className="flex gap-1.5 p-1 bg-black border border-white/5 clip-path-slant">
                                    <button onClick={() => { setSentiment('TRUST'); playClick(); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase transition-all clip-path-slant ${sentiment === 'TRUST' ? 'bg-intuition-success text-black' : 'text-slate-500 hover:text-white'}`}>{agent.type === 'CLAIM' ? 'Support' : 'Trust'}</button>
                                    <button onClick={() => { setSentiment('DISTRUST'); playClick(); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase transition-all clip-path-slant ${sentiment === 'DISTRUST' ? 'bg-intuition-danger text-white' : 'text-slate-500 hover:text-white'}`}>{agent.type === 'CLAIM' ? 'Oppose' : 'Distrust'}</button>
                                </div>
                            </div>
                        )}
                        
                        <div className="mb-6">
                            <div className="flex justify-between items-center gap-2 mb-2">
                                <span className="text-[10px] font-bold text-slate-500">
                                  {action === 'ACQUIRE' ? 'Amount' : 'Shares to sell'}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500">
                                      Balance: <span className="text-white font-mono">{action === 'ACQUIRE' ? parseFloat(walletBalance).toFixed(4) : activeBalance}</span>
                                    </span>
                                    <button onClick={handleMax} type="button" className="text-[9px] font-bold text-slate-400 hover:text-white px-2 py-0.5 border border-slate-600 hover:border-slate-500 transition-colors">Max</button>
                                </div>
                            </div>
                            <div className="relative border-2 border-slate-800 focus-within:border-white/30 p-1 transition-colors">
                                <input type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} className="w-full bg-[#080808] border-none p-4 pr-4 text-right text-white font-black font-mono text-2xl focus:outline-none" placeholder="0" />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono pointer-events-none">
                                  {action === 'ACQUIRE' ? <CurrencySymbol size="sm" leading /> : 'shares'}
                                </span>
                            </div>
                            
                            {action === 'LIQUIDATE' && inputAmount && parseFloat(inputAmount) > 0 && (
                                <div className="mt-3 py-3 px-4 bg-white/5 border border-white/10 flex items-center justify-between">
                                    <span className="text-[10px] text-slate-500">You receive</span>
                                    {isQuoting ? <Loader2 size={14} className="animate-spin text-intuition-primary" /> : (
                                        <span className="text-sm font-bold text-intuition-success font-mono">{estimatedProceeds} <CurrencySymbol size="sm" className="text-slate-500" /></span>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <button onClick={handleExecute} type="button" className={`w-full py-5 font-black text-sm uppercase tracking-wider clip-path-slant border-2 transition-all active:scale-[0.99] ${sentiment === 'DISTRUST' ? 'bg-intuition-danger border-intuition-danger text-white hover:bg-intuition-danger/90' : ''}`} style={{ backgroundColor: sentiment === 'TRUST' ? theme.color : '', borderColor: sentiment === 'TRUST' ? theme.color : '', color: sentiment === 'TRUST' ? '#000' : '' }}>
                            {!isApproved && action === 'ACQUIRE' ? 'Approve' : action === 'ACQUIRE' ? 'Acquire' : 'Redeem'}
                        </button>
                    </div>
                </div>

                {vaultsByCurve.length > 0 && (
                  <div className="bg-black border border-slate-800 p-5 clip-path-slant">
                    <h4 className="text-xs font-bold text-slate-400 mb-3">Curve</h4>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-white/10">
                          <th className="pb-2 pr-2 font-medium w-8" />
                          <th className="pb-2 pr-3 font-medium">Price</th>
                          <th className="pb-2 pr-3 font-medium">Market cap</th>
                          <th className="pb-2 font-medium">Holders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[LINEAR_CURVE_ID, OFFSET_PROGRESSIVE_CURVE_ID].map((cid) => {
                          const v = vaultsByCurve.find((x) => x.curve_id === cid);
                          const price = v ? calculateAgentPrice(v.total_assets, v.total_shares, v.current_share_price) : 0;
                          const mcap = v ? calculateMarketCap(v.total_assets, v.total_shares, v.current_share_price) : 0;
                          const label = getCurveLabel(cid) === 'LINEAR' ? 'Linear' : 'Exponential';
                          return (
                            <tr key={cid} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-2.5 pr-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="radio" name="curve-select" checked={selectedCurveId === cid} onChange={() => { playClick(); setSelectedCurveId(cid as 1 | 2); }} className="sr-only" />
                                  <span className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${selectedCurveId === cid ? 'border-intuition-primary bg-intuition-primary' : 'border-slate-600'}`}>
                                    {selectedCurveId === cid && <span className="w-1.5 h-1.5 bg-black rounded-sm" />}
                                  </span>
                                  <span className="text-white font-medium">{label}</span>
                                </label>
                              </td>
                              <td className="py-2.5 pr-3 text-slate-300 font-mono">{v ? formatMarketValue(price) : '—'}</td>
                              <td className="py-2.5 pr-3 text-slate-300 font-mono">{v ? formatMarketValue(mcap) : '—'}</td>
                              <td className="py-2.5 text-slate-300 font-mono">{v ? formatLargeNumber(v.position_count) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {userPosition && (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        setCardStats({
                          pnl: userPosition.pnl,
                          entry: userPosition.entry,
                          exit: userPosition.exit,
                        });
                        setShowShareCard(true);
                      }}
                      className="w-full bg-black border-2 border-slate-800 p-5 clip-path-slant text-left hover:border-intuition-success/50 transition-colors group"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-intuition-success flex items-center gap-1.5">
                          <TrendingUp size={12} /> Your position
                        </span>
                        <span
                          className={`text-xs font-bold font-mono px-2 py-0.5 ${
                            parseFloat(userPosition.pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {parseFloat(userPosition.pnl) >= 0 ? '+' : ''}
                          {userPosition.pnl}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[10px] text-slate-500 mb-0.5">Value</p>
                          <p className="text-lg font-bold text-white font-mono">
                            {userPosition.value}{' '}
                            <CurrencySymbol size="sm" className="text-slate-500" />
                          </p>
                        </div>
                        <div className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center group-hover:border-intuition-success transition-colors">
                          <Share size={14} className="text-slate-500 group-hover:text-intuition-success" />
                        </div>
                      </div>
                    </button>
                  </div>
                )}
            </div>
        </div>

        <div className="ares-frame bg-black clip-path-slant shadow-2xl overflow-hidden min-h-[600px]">
            <div className="flex flex-wrap border-b border-slate-900 bg-white/5">
                {[
                    { id: 'OVERVIEW', label: 'Overview', icon: Activity },
                    { id: 'POSITIONS', label: 'Positions', icon: Users },
                    { id: 'IDENTITIES', label: 'Identities', icon: Globe },
                    { id: 'CLAIMS', label: 'Claims', icon: MessageSquare },
                    { id: 'LISTS', label: 'Lists', icon: ListIcon },
                    { id: 'ACTIVITY', label: 'Activity', icon: Clock },
                    { id: 'CONNECTIONS', label: 'Connections', icon: Network }
                ].map((t) => (
                    <button key={t.id} onClick={() => { playClick(); setActiveTab(t.id as DetailTab); }} className={`flex-1 min-w-[150px] px-6 py-6 text-[10px] font-black tracking-[0.4em] uppercase flex items-center justify-center gap-3 transition-all relative border-r border-slate-900/50 ${activeTab === t.id ? 'text-white bg-white/5' : 'text-slate-600 hover:text-white hover:bg-white/5'}`}>
                        <t.icon size={16} className={activeTab === t.id ? 'animate-pulse' : ''} style={{ color: activeTab === t.id ? theme.color : '' }} /> {t.label}
                        {activeTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-1 shadow-glow" style={{ backgroundColor: theme.color }}></div>}
                    </button>))}
            </div>
            
            <div className="p-4 sm:p-6 md:p-10 overflow-x-hidden">
                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-20 animate-in fade-in duration-700">
                        <div className="space-y-12">
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-[0.6em] mb-6 flex items-center gap-3 text-glow" style={{ color: theme.color }}><Terminal size={14}/> Core_Alignment_Matrix</h4>
                                <p className="text-slate-400 text-base leading-relaxed font-mono font-bold uppercase tracking-tight group-hover:text-white transition-colors">Node <strong className="text-white text-glow-white">{agent.label}</strong> stabilized in Sector_04. Semantic weight currently projected at {triples.length} unique synapses. Linear Curve Utility (ID: 1) engaged.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6"><div className="p-4 md:p-6 bg-white/5 border border-white/10 clip-path-slant group hover:border-white/40 transition-all"><div className="text-[9px] text-slate-600 uppercase mb-2 font-black tracking-widest group-hover:text-white">TOTAL MKT CAP</div><div className="text-xl md:text-2xl font-black text-white font-display tracking-tight group-hover:text-glow-white inline-flex items-baseline gap-1"><CurrencySymbol size="xl" leading className="text-white/90" />{formatMarketValue(mktCapVal)}</div></div><div className="p-4 md:p-6 bg-white/5 border border-white/10 clip-path-slant group hover:border-white/40 transition-all"><div className="text-[9px] text-slate-600 uppercase mb-2 font-black tracking-widest group-hover:text-white">TOTAL_SHARES</div><div className="text-xl md:text-2xl font-black text-white font-display tracking-tight group-hover:text-glow-white">{formatLargeNumber(formatDisplayedShares(agent.totalShares || '0'))}</div></div></div>
                            
                            {/* NEW: PROVENANCE LINKS SECTION */}
                            {agent.links && agent.links.length > 0 && (
                                <div className="pt-4">
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.6em] mb-6 flex items-center gap-3 text-white">
                                        <LinkIcon size={14} className="text-intuition-primary" /> Node_Provenance_Uplinks
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {agent.links.map((link, idx) => {
                                            const href = link.url.startsWith('http') ? link.url : `https://${link.url}`;
                                            const displayUrl = href.replace(/^https?:\/\//, '');
                                            return (
                                                <a 
                                                    key={idx} 
                                                    href={href} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    onClick={playClick}
                                                    onMouseEnter={playHover}
                                                    className="flex items-center justify-between gap-3 p-4 bg-white/5 border border-white/10 clip-path-slant hover:border-intuition-primary hover:bg-intuition-primary/5 transition-all group/link"
                                                >
                                                    <span className="text-[10px] font-black text-slate-400 group-hover/link:text-white uppercase tracking-widest truncate shrink-0">{link.label || 'UPLINK_SOURCE'}</span>
                                                    <span className="px-2.5 py-1 rounded-md bg-[#7c3aed]/90 text-white text-[10px] font-bold truncate min-w-0 flex-1 text-center shadow-[0_0_10px_rgba(124,58,237,0.3)]" title={href}>{displayUrl}</span>
                                                    <ExternalLink size={12} className="text-slate-600 group-hover/link:text-intuition-primary shrink-0" />
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-6">
                            <h4 className="text-[11px] font-black text-white uppercase tracking-[0.6em] mb-6 text-glow-white">Protocol_Parameters</h4>
                            <div className="p-8 border border-white/5 bg-white/5 clip-path-slant font-mono text-xs space-y-5">
                                <div className="flex justify-between items-center group"><span className="text-slate-600 uppercase font-black tracking-widest group-hover:text-white transition-colors">Bonding_Curve</span><span className="font-bold text-glow" style={{ color: theme.color }}>Linear_Utility_1</span></div>
                                <div className="flex justify-between items-center group"><span className="text-slate-600 uppercase font-black tracking-widest group-hover:text-white transition-colors">Creator</span><span className="text-white font-bold group-hover:text-glow-white">{agent.creator?.label || agent.creator?.id?.slice(0, 18) || 'Null_Origin'}</span></div>
                                {(() => {
                                    const primaryLink = agent.links?.[0];
                                    const linkUrl = primaryLink?.url ? (primaryLink.url.startsWith('http') ? primaryLink.url : `https://${primaryLink.url}`) : null;
                                    return (
                                        <div className="flex justify-between items-center group gap-3">
                                            <span className="text-slate-600 uppercase font-black tracking-widest group-hover:text-white transition-colors shrink-0">Link</span>
                                            {linkUrl ? (
                                                <a href={linkUrl} target="_blank" rel="noreferrer" onClick={playClick} onMouseEnter={playHover} className="px-3 py-1.5 rounded-md bg-[#7c3aed]/90 hover:bg-[#7c3aed] text-white text-[10px] font-bold truncate max-w-full shadow-[0_0_12px_rgba(124,58,237,0.4)] hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] transition-all flex items-center gap-2" title={linkUrl}>
                                                    <span className="truncate">{linkUrl.replace(/^https?:\/\//, '')}</span>
                                                    <ExternalLink size={10} className="shrink-0 opacity-80" />
                                                </a>
                                            ) : (
                                                <span className="text-slate-600 font-bold group-hover:text-slate-500">—</span>
                                            )}
                                        </div>
                                    );
                                })()}
                                <div className="flex justify-between items-center group"><span className="text-slate-600 uppercase font-black tracking-widest group-hover:text-white transition-colors">Last_Interaction</span><span className="text-white font-bold group-hover:text-glow-white">{activityLog[0] ? new Date(activityLog[0].timestamp).toLocaleDateString() : 'Syncing...'}</span></div>
                                <div className="flex justify-between items-center group"><span className="text-slate-600 uppercase font-black tracking-widest group-hover:text-white transition-colors">Protocol_Tier</span><span className="px-3 py-0.5 text-black font-black uppercase text-[10px] shadow-glow" style={{ backgroundColor: theme.color }}>{theme.label}</span></div>
                            </div>
                        </div>
                    </div>)}
                {activeTab === 'POSITIONS' && (
                    <div className="w-full animate-in slide-in-from-bottom-4 duration-700 overflow-x-auto">
                        <table className="w-full text-left font-mono text-[10px] sm:text-[11px] min-w-[400px]">
                            <thead className="text-slate-700 uppercase font-black tracking-[0.3em] border-b border-slate-900 bg-[#080808]">
                                <tr>
                                    <th className="px-3 sm:px-6 md:px-8 py-4 sm:py-6">RANK</th>
                                    <th className="px-3 sm:px-6 md:px-8 py-4 sm:py-6">ACCOUNT</th>
                                    <th className="px-3 sm:px-6 md:px-8 py-4 sm:py-6">CONVICTION</th>
                                    <th className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-right">SHARES</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {holders.length > 0 ? holders.map((h, i) => {
                                    const meta = getConvictionMetadata(h.shares);
                                    return (
                                        <tr key={i} className="hover:bg-white/5 transition-all group">
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-slate-600 font-black">#{(i + 1).toString().padStart(2, '0')}</td>
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6">
                                                <Link to={`/profile/${h.account.id}`} className="flex items-center gap-2 sm:gap-4 group-hover:text-white transition-colors">
                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-none clip-path-slant bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden group-hover:border-white transition-all shadow-xl shrink-0">
                                                        {h.account.image ? <img src={h.account.image} className="w-full h-full object-cover" /> : <User size={12} className="text-slate-700 sm:w-[14px] sm:h-[14px]" />}
                                                    </div>
                                                    <span className="font-black text-white group-hover:text-glow-white transition-colors uppercase tracking-tight truncate max-w-[120px] sm:max-w-none">{h.account.label || h.account.id.slice(0, 24)}...</span>
                                                </Link>
                                            </td>
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6">
                                                <span className={`px-2 sm:px-3 py-0.5 sm:py-1 border rounded-sm font-black uppercase tracking-tighter transition-all text-[9px] sm:text-[10px] ${meta.color}`}>
                                                    {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-right text-white font-black text-base sm:text-lg font-display tracking-tight group-hover:text-glow-white">{formatDisplayedShares(h.shares)}</td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan={4} className="p-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px]">NULL_POSITIONS_DETECTED</td></tr>)}
                            </tbody>
                        </table>
                    </div>)}
                {activeTab === 'IDENTITIES' && (
                    <div className="animate-in fade-in duration-700">
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.6em] mb-10 flex items-center gap-4"><Fingerprint size={16}/> Neural Identities Engaged</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{engagedIdentities.length > 0 ? engagedIdentities.map((peer, i) => (<Link key={i} to={`/markets/${peer.term_id}`} className="p-6 bg-white/[0.02] border-2 border-slate-900 hover:border-white/40 transition-all clip-path-slant group relative overflow-hidden backdrop-blur-sm"><div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div><div className="flex items-center justify-between gap-6 relative z-10"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-black border-2 border-slate-800 clip-path-slant overflow-hidden group-hover:border-white transition-all shadow-xl group-hover:shadow-glow-white">{peer.image ? <img src={peer.image} className="w-full h-full object-cover" /> : <User size={24} className="text-slate-700" />}</div><div className="min-w-0"><div className="text-sm font-black text-white group-hover:text-glow-white transition-colors uppercase truncate max-w-[140px] font-display tracking-tight leading-none mb-1.5">{peer.label}</div><div className="text-[8px] text-slate-600 uppercase font-black tracking-widest">{peer.predicate || 'REPUTATION_LINK'}</div></div></div><div className="flex flex-col items-end"><div className="text-[10px] font-black text-intuition-success animate-pulse text-glow-success">LIVE</div><span className="text-[8px] font-black text-slate-700 uppercase tracking-widest mt-1">L3_SYNC</span></div></div></Link>)) : (<div className="col-span-full py-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px] border border-dashed border-slate-900">NULL_IDENTITIES_SYNCED</div>)}</div>
                    </div>
                )}
                {activeTab === 'CLAIMS' && (
                    <div className="animate-in fade-in duration-700">
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.6em] mb-10 flex items-center gap-4"><MessageSquare size={16}/> Semantic Claim Ledger</h4>
                        <div className="space-y-4">{triples.length > 0 ? triples.map((t, i) => (<div key={i} className="p-6 bg-white/[0.01] border-2 border-slate-900 hover:border-white/30 transition-all clip-path-slant flex flex-col md:flex-row items-center justify-between gap-6 group backdrop-blur-sm shadow-xl"><div className="flex items-center gap-6 flex-1 min-w-0"><div className="flex items-center flex-col"><div className="w-10 h-10 bg-slate-900 border border-slate-800 flex items-center justify-center clip-path-slant mb-2 overflow-hidden group-hover:border-white/40 transition-colors">{t.subject?.image ? <img src={t.subject.image} className="w-full h-full object-cover" /> : <User size={18} className="text-slate-600" />}</div><span className="text-[8px] text-slate-500 uppercase font-black truncate max-w-[80px] group-hover:text-white transition-colors">{t.subject?.label}</span></div><ArrowUpRight size={14} className="text-slate-800 group-hover:text-white transition-colors animate-pulse" /><div className="px-4 py-1.5 bg-black border text-white font-black text-[9px] uppercase tracking-widest clip-path-slant group-hover:shadow-glow-white transition-all" style={{ borderColor: `${theme.color}44`, color: theme.color }}>{t.predicate?.label}</div><ArrowUpRight size={14} className="text-slate-800 group-hover:text-white transition-colors animate-pulse" /><div className="flex flex-col items-center"><div className="w-10 h-10 bg-slate-900 border border-slate-800 flex items-center justify-center clip-path-slant mb-2 overflow-hidden group-hover:border-white/40 transition-colors">{t.object?.image ? <img src={t.object.image} className="w-full h-full object-cover" /> : <User size={18} className="text-slate-600" />}</div><span className="text-[8px] text-slate-500 uppercase font-black truncate max-w-[80px] group-hover:text-white transition-colors">{t.object?.label}</span></div></div><div className="flex flex-col items-end gap-2 shrink-0">
                                {t.creator && (
                                    <Link to={`/profile/${t.creator.id}`} onClick={playClick} className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 hover:border-intuition-primary transition-all clip-path-slant group/creator">
                                        <div className="w-4 h-4 bg-black border border-white/10 rounded-full overflow-hidden shrink-0 shadow-sm"><img src={t.creator.image || `https://effigy.im/a/${t.creator.id}.png`} className="w-full h-full object-cover" /></div>
                                        <span className="text-[8px] font-black text-slate-400 group-hover/creator:text-white uppercase tracking-widest">{t.creator.label || t.creator.id.slice(0, 10)}</span>
                                        <UserCircle size={10} className="text-slate-600 group-hover/creator:text-intuition-primary" />
                                    </Link>
                                )}
                                <div className="text-right">
                                    <div className="text-[8px] text-slate-600 uppercase font-black mb-1">Packet_Origin</div>
                                    <div className="text-[10px] text-white font-mono group-hover:text-glow-white transition-all">{t.transaction_hash?.slice(0, 14)}...</div>
                                </div>
                            </div></div>)) : (<div className="py-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px] border border-dashed border-slate-900">NULL_CLAIMS_RECORDED</div>)}</div>
                    </div>
                )}
                {activeTab === 'LISTS' && (
                    <div className="animate-in fade-in duration-700">
                        <div className="flex items-center justify-between mb-12"><h4 className="text-[11px] font-black uppercase tracking-[0.6em] flex items-center gap-4" style={{ color: theme.color }}><ListIcon size={16} className="animate-pulse" /> SEMANTIC_INCLUSION_VECTORS</h4><span className="text-[8px] font-mono text-slate-600 uppercase">Buffer: {lists.length} Linked Clusters</span></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">{lists.length > 0 ? lists.map((list, i) => (<Link key={i} to={`/markets/${list.id}`} className="group relative flex flex-col p-10 bg-white/[0.02] border-2 border-slate-800 hover:border-white transition-all shadow-[0_0_40px_rgba(0,243,255,0.5)] overflow-hidden min-h-[340px] text-center backdrop-blur-xl clip-path-slant" onClick={playClick} onMouseEnter={playHover}><div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:16px_16px] opacity-10 pointer-events-none"></div><div className="flex flex-col items-center justify-center flex-1 relative z-10"><div className="relative mb-10 group-hover:scale-110 transition-transform duration-700"><div className="absolute -inset-6 border-2 border-dashed border-white/10 rounded-full animate-spin-slow opacity-40 group-hover:opacity-100 transition-all"></div><div className="w-24 h-24 bg-black border-2 border-slate-700 flex items-center justify-center overflow-hidden transition-all group-hover:border-white shadow-2xl relative clip-path-slant group-hover:shadow-glow-white">{list.image ? <img src={list.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" /> : <Boxes size={32} className="text-slate-600 group-hover:text-white" />}</div></div><div className="relative z-10"><div className="text-[10px] font-black font-mono text-slate-500 uppercase tracking-[0.4em] mb-4 group-hover:text-white transition-colors">SUB_SECTOR_VECTOR</div><div className="text-3xl font-black font-display text-white uppercase group-hover:text-glow-blue transition-all tracking-tighter leading-none mb-6 drop-shadow-md">{list.label}</div><div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white/5 border border-white/5 clip-path-slant text-[9px] font-black text-slate-400 group-hover:text-white transition-all"><Database size={12} className="text-slate-600 group-hover:text-white" />CONSTITUENTS: {list.totalItems || 0}</div></div></div><div className="absolute bottom-6 right-6 text-slate-800 group-hover:text-white group-hover:translate-x-1 transition-all"><ArrowRight size={24} /></div></Link>)) : (<div className="col-span-full py-32 text-center text-slate-700 uppercase font-black tracking-[0.6em] text-[10px] border-2 border-dashed border-slate-900 clip-path-slant">NULL_VECTORS_DETECTED</div>)}</div>
                    </div>)}
                {activeTab === 'ACTIVITY' && (
                    <div className="animate-in fade-in duration-700 overflow-x-auto ares-frame bg-white/[0.01] border-2 border-slate-900 clip-path-slant shadow-2xl backdrop-blur-sm">
                        <table className="w-full text-left font-mono text-[9px] sm:text-[10px] min-w-[500px]">
                            <thead className="bg-black border-b border-slate-800 text-slate-600 font-black uppercase tracking-[0.2em] sm:tracking-[0.3em]">
                                <tr>
                                    <th className="px-3 sm:px-6 md:px-8 py-3 sm:py-5">TRANSACTION_HASH</th>
                                    <th className="px-3 sm:px-6 md:px-8 py-3 sm:py-5">ACTION</th>
                                    <th className="px-3 sm:px-6 md:px-8 py-3 sm:py-5 text-right">UNITS</th>
                                    <th className="px-3 sm:px-6 md:px-8 py-3 sm:py-5 text-right">TIMESTAMP</th>
                                    <th className="px-3 sm:px-6 md:px-8 py-3 sm:py-5 text-right">HANDSHAKE</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {activityLog.length > 0 ? activityLog.map((tx, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-all group">
                                        <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 font-mono text-slate-400 group-hover:text-white group-hover:text-glow-white transition-colors uppercase tracking-tighter">
                                            {tx.id.slice(0, 24)}...
                                        </td>
                                        <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6">
                                            <span className={`px-2 py-0.5 rounded-sm font-black border uppercase tracking-widest text-[8px] sm:text-[9px] ${tx.type === 'DEPOSIT' ? 'text-intuition-success bg-intuition-success/10 border-intuition-success/20 text-glow-success' : 'text-intuition-danger bg-intuition-danger/10 border-intuition-danger/20 text-glow-red'}`}>
                                                {tx.type}
                                            </span>
                                            {!tx.id.startsWith('0x') && <span className="ml-2 px-1.5 py-0.5 bg-intuition-warning/10 text-intuition-warning border border-intuition-warning/30 text-[7px] font-black">LOCAL_UNSYNCED</span>}
                                        </td>
                                        <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-right font-black text-white text-base sm:text-lg group-hover:text-glow-white transition-all">
                                            {formatDisplayedShares(tx.shares)}
                                        </td>
                                        <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-right font-mono text-slate-500 uppercase tracking-tighter whitespace-nowrap">
                                            {new Date(tx.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-right">
                                            <div className="flex justify-end gap-3">
                                                {tx.type === 'REDEEM' && (
                                                    <button 
                                                        onClick={() => handleGenerateHistoryCard(tx)}
                                                        className="p-2 bg-white/5 border border-white/10 hover:border-intuition-primary hover:text-intuition-primary transition-all rounded-lg group/btn"
                                                        title="GENERATE_PNL_CARD"
                                                    >
                                                        <Share2 size={14} className="group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                )}
                                                <a 
                                                    href={`${EXPLORER_URL}/tx/${tx.id}`} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="p-2 bg-white/5 border border-white/10 hover:border-intuition-primary hover:text-intuition-primary transition-all rounded-lg"
                                                >
                                                    <ExternalLink size={14} />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={5} className="p-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px]">NULL_ACTIVITY_LOGGED</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {activeTab === 'CONNECTIONS' && (
                    <div className="animate-in fade-in duration-700">
                        <div className="flex items-center gap-8 mb-12 bg-white/[0.02] p-10 border-2 border-slate-900 clip-path-slant group hover:border-white/20 transition-all shadow-2xl backdrop-blur-md"><div className="w-20 h-20 rounded-none clip-path-slant border-2 flex items-center justify-center bg-black shadow-2xl group-hover:scale-105 duration-500" style={{ borderColor: theme.color, boxShadow: `0 0 30px ${theme.bgGlow}` }}><Activity size={40} className="animate-pulse" style={{ color: theme.color }} /></div><div><h4 className="text-2xl font-black font-display text-white uppercase tracking-[0.4em] mb-2 text-glow-white">NEURAL_TOPOLOGY</h4><p className="text-[11px] text-slate-500 uppercase tracking-widest font-black group-hover:text-slate-300 transition-colors">Mapping semantic adjacency and synapse neighbors within Sector_04.</p></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{engagedIdentities.length > 0 ? engagedIdentities.map((peer, i) => (<Link key={i} to={`/markets/${peer.term_id}`} className="group p-8 bg-black border-2 border-slate-900 hover:border-white transition-all clip-path-slant flex items-center gap-8 relative overflow-hidden shadow-2xl"><div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div><div className="w-16 h-16 bg-slate-950 border-2 border-slate-800 flex items-center justify-center clip-path-slant shrink-0 group-hover:border-white transition-all shadow-2xl overflow-hidden">{peer.image ? <img src={peer.image} className="w-full h-full object-cover" /> : <User size={24} className="text-slate-700" />}</div><div className="min-w-0"><div className="text-lg font-black text-white group-hover:text-glow-white transition-colors truncate uppercase leading-none mb-2 tracking-tight">{peer.label}</div><div className="text-[8px] font-black font-mono text-slate-600 tracking-widest uppercase">SYMMETRIC_NEIGHBOR</div></div></Link>)) : (<div className="col-span-full py-32 text-center text-slate-700 uppercase font-black tracking-[0.6em] text-[10px] border-2 border-dashed border-slate-900 clip-path-slant">NULL_NETWORK_ADJACENCY</div>)}</div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

const ChevronsRight = ({ className, size }: { className: string, size: number }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="13 17 18 12 13 7"></polyline>
        <polyline points="6 17 11 12 6 7"></polyline>
    </svg>
);

export default MarketDetail;