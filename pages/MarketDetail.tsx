import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Shield, ArrowLeft, ArrowRight, User, Star, Network, ArrowUpRight, Loader2, Zap, Info, Share2, Fingerprint, ChevronRight, ChevronDown, Clock, Users, Layers, ExternalLink, Search, List as ListIcon, Globe, Compass, MessageSquare, Link as LinkIcon, Box, Database, Plus, UserPlus, Share, Hash, Radio, ScanSearch, Target, Upload, Boxes, X, Download, Twitter, Copy, TrendingUp, ShieldAlert, UserCircle, BadgeCheck, UserCog } from 'lucide-react';
import { getAgentById, getAgentTriples, getAgentTriplesWithVaults, getMarketActivity, getHoldersForVault, getAtomInclusionListsWithVaults, getIdentitiesEngaged, getUserPositions, getIncomingTriplesForStats, getOppositionTriple, getVaultsForTerm, getCurveLabel, type VaultByCurve } from '../services/graphql';
import { depositToVault, redeemFromVault, connectWallet, getConnectedAccount, getWalletBalance, getShareBalanceEffective, toggleWatchlist, isInWatchlist, parseProtocolError, getProxyApprovalStatus, grantProxyApproval, saveLocalTransaction, getLocalTransactions, getQuoteRedeem, publicClient, calculateTripleId, calculateCounterTripleId } from '../services/web3';
import { Account, Triple, Transaction } from '../types';
import { formatEther, parseEther } from 'viem';
import { toast } from '../components/Toast';
import TransactionModal from '../components/TransactionModal';
import CreateModal from '../components/CreateModal';
import { playClick, playSuccess, playHover } from '../services/audio';
import { AIBriefing } from '../components/AISuite';
import { calculateTrustScore as computeTrust, calculateAgentPrice, formatDisplayedShares, formatMarketValue, formatLargeNumber, calculateMarketCap, safeParseUnits, safeWeiToEther, calculatePositionPnL, calculateRealizedPnL, isSystemVerified, getSharesFromHolderRowsForCurve, mergeTrustBalanceDisplay } from '../services/analytics';
import { APP_VERSION_DISPLAY, LINEAR_CURVE_ID, OFFSET_PROGRESSIVE_CURVE_ID, CURRENCY_SYMBOL, EXPLORER_URL, FEE_PROXY_ADDRESS, MULTI_VAULT_ADDRESS } from '../constants';

function isProtocolRouterAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return a === FEE_PROXY_ADDRESS.toLowerCase() || a === MULTI_VAULT_ADDRESS.toLowerCase();
}
import { sendTransactionReceiptEmail } from '../services/emailNotifications';
import { CurrencySymbol } from '../components/CurrencySymbol';
import html2canvas from 'html2canvas';
import Logo from '../components/Logo';
import ShareCard from '../components/ShareCard';
import BondingCurvesInfoPanel from '../components/BondingCurvesInfoPanel';
import { PageLoading } from '../components/PageLoading';

type Timeframe = '15M' | '30M' | '1H' | '4H' | '1D' | '1W' | '1M' | '1Y' | 'ALL';
type DetailTab = 'OVERVIEW' | 'POSITIONS' | 'IDENTITIES' | 'CLAIMS' | 'LISTS' | 'ACTIVITY' | 'CONNECTIONS';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const date = new Date(data.timestamp);
    const formattedDate = date.toLocaleDateString([], { day: '2-digit', month: 'short' });
    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="bg-black/95 border-2 border-intuition-primary p-4 rounded-3xl shadow-[0_0_40px_rgba(0,243,255,0.7)] backdrop-blur-xl z-50">
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
    if (strength >= 90) return { label: 'Sovereign', color: '#facc15', glow: 'rgba(250, 204, 21, 0.6)', bgGlow: 'rgba(250, 204, 21, 0.15)' };
    if (strength >= 75) return { label: 'Authentic', color: '#00f3ff', glow: 'rgba(0, 243, 255, 0.6)', bgGlow: 'rgba(0, 243, 255, 0.15)' };
    if (strength >= 60) return { label: 'Reliable', color: '#a855f7', glow: 'rgba(168, 85, 247, 0.6)', bgGlow: 'rgba(168, 85, 247, 0.15)' };
    if (strength >= 45) return { label: 'Credible', color: '#00ff9d', glow: 'rgba(0, 255, 157, 0.6)', bgGlow: 'rgba(0, 255, 157, 0.15)' };
    return { label: 'Emerging', color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)', bgGlow: 'rgba(148, 163, 184, 0.08)' };
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
        const text = `Inspecting ${agent.label || 'Node'} on @IntuRank. Quantifying trust at ${strength.toFixed(1)}% conviction. 🚀\n\nJoin the claim:`;
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
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-16 sm:pt-24 overflow-y-auto bg-black/98 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose}>
            <div className="w-full max-w-xl sm:max-w-2xl translate-y-0" onClick={e => e.stopPropagation()}>
                <div 
                    ref={cardRef} 
                    className="relative bg-[#020308] border-2 py-6 px-5 sm:px-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_0_150px_rgba(0,0,0,1)] overflow-hidden group/modal transition-all duration-1000"
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

                    <div className="flex justify-between items-center mb-5 relative z-10 gap-6">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-[10px] font-black font-mono uppercase tracking-[0.4em] mb-2 transition-colors duration-1000" style={{ color: theme.color }}>
                                <Activity size={14} className="animate-pulse" /> Activity
                            </div>
                            <h2 
                                className="text-2xl sm:text-3xl md:text-4xl font-black font-display text-white tracking-tighter uppercase leading-tight break-all transition-all duration-1000"
                                style={{ textShadow: `0 0 30px ${theme.color}66` }}
                            >
                                {agent.label}
                            </h2>
                        </div>
                        <div 
                            className="w-14 h-14 sm:w-16 sm:h-16 bg-black border-2 flex items-center justify-center rounded-xl shrink-0 group-hover/modal:border-white transition-all duration-1000 overflow-hidden shadow-2xl"
                            style={{ borderColor: `${theme.color}66`, boxShadow: `0 0 30px ${theme.bgGlow}` }}
                        >
                            {agent.image ? (
                              <img src={agent.image} className="w-full h-full object-cover" crossOrigin="anonymous" alt="" />
                            ) : (
                              <Logo className="w-8 h-8 sm:w-10 sm:h-10 transition-colors duration-1000" style={{ filter: `drop-shadow(0 0 8px ${theme.color})` }} />
                            )}
                        </div>
                    </div>

                    <div className="mb-5 relative z-10">
                        <div className="text-[10px] font-black font-mono text-slate-300 uppercase tracking-widest mb-3">SEMANTIC_TAGS:</div>
                        <div className="flex flex-wrap gap-2">
                            {tags.slice(0, 7).map((tag, i) => (
                                <span 
                                    key={i} 
                                    className="px-3 py-1.5 bg-white/5 border border-white/20 text-[10px] font-black text-white uppercase tracking-wider rounded-full hover:border-white/40 transition-all cursor-default"
                                    style={{ borderColor: i === 0 ? `${theme.color}66` : '' }}
                                >
                                    {tag.label}
                                </span>
                            ))}
                            {tags.length > 7 && <span className="px-3 py-1.5 bg-white/5 border border-white/20 text-[10px] font-black text-white uppercase tracking-wider rounded-full">+{tags.length - 7} more</span>}
                        </div>
                    </div>

                    <div className="mb-5 relative z-10">
                        <div className="text-[10px] font-black font-mono text-slate-300 uppercase tracking-widest mb-3">DESCRIPTION_PAYLOAD:</div>
                        <div className="p-4 bg-black/60 border border-white/10 rounded-xl relative group/desc">
                            <div 
                                className="absolute left-0 top-0 bottom-0 w-1 transition-colors duration-1000"
                                style={{ backgroundColor: `${theme.color}88` }}
                            ></div>
                            <p className="text-sm font-mono text-slate-200 leading-relaxed uppercase tracking-tight line-clamp-2 group-hover:text-white transition-colors">
                                {agent.description || "Establishing logical connectivity within the Intuition Trust Graph. Node identity verified and synchronized for global capital signaling."}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 relative z-10">
                        <div className="bg-black/60 border border-white/15 p-3 sm:p-4 rounded-xl group/stat hover:border-white/30 transition-all">
                            <div className="text-[9px] text-slate-300 uppercase font-black tracking-widest mb-1 group-hover:stat:text-white transition-colors">Mkt_Cap</div>
                            <div className="text-xl sm:text-2xl font-black text-white font-display tracking-tight leading-none group-hover:stat:text-glow-white">{formatMarketValue(mktCap)}</div>
                        </div>
                        <div className="bg-black/60 border border-white/15 p-3 sm:p-4 rounded-xl group/stat hover:border-white/30 transition-all">
                            <div className="text-[9px] text-slate-300 uppercase font-black tracking-widest mb-1 group-hover:stat:text-white transition-colors">Spot_Price</div>
                            <div className="text-xl sm:text-2xl font-black text-white font-display tracking-tight leading-none group-hover:stat:text-glow-white">{formatMarketValue(price)}</div>
                        </div>
                        <div className="bg-black/60 border p-3 sm:p-4 rounded-xl group/stat transition-all" style={{ borderColor: `${theme.color}55` }}>
                            <div 
                                className="text-[9px] uppercase font-black tracking-widest mb-1 transition-colors duration-1000"
                                style={{ color: theme.color }}
                            >Conviction</div>
                            <div 
                                className="text-xl sm:text-2xl font-black font-display tracking-tight leading-none transition-all duration-1000"
                                style={{ color: theme.color, textShadow: `0 0 15px ${theme.color}88` }}
                            >{strength.toFixed(1)}%</div>
                        </div>
                        <div className="bg-black/60 border border-white/15 p-3 sm:p-4 rounded-xl group/stat hover:border-white/30 transition-all">
                            <div className="text-[9px] text-slate-300 uppercase font-black tracking-widest mb-1 group-hover:stat:text-white transition-colors">Holders</div>
                            <div className="text-xl sm:text-2xl font-black text-white font-display tracking-tight leading-none group-hover:stat:text-glow-white">{formatLargeNumber(holders)}</div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-5 border-t border-white/10 opacity-80 relative z-10 font-mono">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">CERTIFIED_BY_INTURANK_PROTOCOL // {APP_VERSION_DISPLAY}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString()} // NEURAL_SYNC_S04</div>
                    </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <button onClick={handleShareX} className="flex-1 py-3.5 bg-white/5 border border-white/20 text-white hover:bg-white hover:text-black font-black uppercase text-[10px] tracking-[0.3em] rounded-full transition-all flex items-center justify-center gap-2 active:scale-95 shadow-2xl">
                        <Twitter size={14} /> Share_on_X
                    </button>
                    <button onClick={handleCopyLink} className="flex-1 py-3.5 bg-white/5 border border-white/20 text-white hover:bg-white hover:text-black font-black uppercase text-[10px] tracking-[0.3em] rounded-full transition-all flex items-center justify-center gap-2 active:scale-95 shadow-2xl">
                        <Copy size={14} /> Copy_Uplink
                    </button>
                    <button 
                        onClick={handleDownload} 
                        disabled={isDownloading} 
                        className="flex-1 py-3.5 text-black font-black uppercase text-[10px] tracking-[0.3em] rounded-full transition-all flex items-center justify-center gap-2 hover:bg-white active:scale-95 duration-700 shadow-2xl"
                        style={{ backgroundColor: theme.color, boxShadow: `0 0 50px ${theme.glow}` }}
                    >
                        {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                        Download_Frame
                    </button>
                </div>
                
                <div className="mt-5 text-center">
                    <button onClick={onClose} className="text-[10px] font-black font-mono text-slate-500 hover:text-white uppercase tracking-[0.8em] transition-colors">TERMINATE_SESSION</button>
                </div>
            </div>
        </div>
    );
};

const MarketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address: wagmiAddress } = useAccount();
  const [agent, setAgent] = useState<Account | null>(null);
  const [oppositionAgent, setOppositionAgent] = useState<any | null>(null);
  const [triples, setTriples] = useState<Triple[]>([]);
  const [claimsWithVaults, setClaimsWithVaults] = useState<Array<{
    id: string;
    counterTermId?: string;
    subject: { term_id: string; label: string; image?: string };
    predicate: { label: string };
    object: { term_id: string; label: string; image?: string };
    creator?: { id: string; label?: string; image?: string };
    transaction_hash?: string;
    supportTotalAssets: string;
    supportPositionCount: number;
    opposeTotalAssets: string;
    opposePositionCount: number;
  }>>([]);
  const [activityLog, setActivityLog] = useState<Transaction[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [totalHoldersCount, setTotalHoldersCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [lists, setLists] = useState<any[]>([]);
  const [showingListsContaining, setShowingListsContaining] = useState(true);
  const [listEntriesSearch, setListEntriesSearch] = useState('');
  const [listSort, setListSort] = useState<'label-asc' | 'label-desc'>('label-asc');
  const [engagedIdentities, setEngagedIdentities] = useState<any[]>([]);
  const [followingPositions, setFollowingPositions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  /** Distinct from loading spinner: invalid route or fetch failed (avoid infinite "Loading" when agent is null). */
  const [marketLoadError, setMarketLoadError] = useState<null | 'missing-id' | 'failed'>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('OVERVIEW');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [isWatched, setIsWatched] = useState(false);
  const [action, setAction] = useState<'ACQUIRE' | 'LIQUIDATE'>('ACQUIRE');
  const [sentiment, setSentiment] = useState<'TRUST' | 'DISTRUST'>('TRUST');
  const [inputAmount, setInputAmount] = useState('');
  const [wallet, setWallet] = useState<string | null>(null);
  /** Prefer wagmi so curve-switch / balance effects run before sync effect copies address into `wallet`. */
  const effectiveWallet = wagmiAddress ?? wallet;
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
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeTrackRef = useRef<HTMLDivElement | null>(null);
  /** Bumps on each fetch so late async batches don't apply after navigation. */
  const fetchGenRef = useRef(0);
  /** Last successfully loaded agent for this route — avoid wiping UI on transient GraphQL errors during refresh. */
  const lastAgentRef = useRef<Account | null>(null);
  /** Previous fetch route id — same id ⇒ soft refresh (no full-page wipe). */
  const lastStartedFetchIdRef = useRef<string | undefined>(undefined);

  // Determine if sentiment toggle should be available (Strictly Claims and Lists)
  const isPolarityAvailable = useMemo(() => {
    if (!agent) return false;
    return agent.type === 'CLAIM' || agent.type === 'LIST';
  }, [agent]);

  const filteredListEntries = useMemo(() => {
    const term = listEntriesSearch.trim().toLowerCase();
    let out = term ? lists.filter((e) => (e.label || '').toLowerCase().includes(term) || (e.id || '').toLowerCase().includes(term)) : [...lists];
    out = [...out].sort((a, b) => {
      const la = (a.label || '').toLowerCase();
      const lb = (b.label || '').toLowerCase();
      return listSort === 'label-asc' ? la.localeCompare(lb) : lb.localeCompare(la);
    });
    return out;
  }, [lists, listEntriesSearch, listSort]);

  const fetchData = async () => {
    if (!id) {
      setLoading(false);
      setMarketLoadError('missing-id');
      return;
    }
    const gen = ++fetchGenRef.current;
    setMarketLoadError(null);
    const isRefresh = lastStartedFetchIdRef.current === id;
    lastStartedFetchIdRef.current = id;
    if (!isRefresh) {
      setLoading(true);
      setAgent(null);
      setOppositionAgent(null);
      lastAgentRef.current = null;
      setTriples([]);
      setClaimsWithVaults([]);
      setActivityLog([]);
      setHolders([]);
      setTotalHoldersCount(0);
      setLists([]);
      setEngagedIdentities([]);
      setFollowersCount(0);
      setVaultsByCurve([]);
    }
    try {
      // Phase 1 — only what we need to render the hero, chart shell, and labels (fast).
      const [acc, agentData, oppoData] = await Promise.all([
        getConnectedAccount(),
        getAgentById(id),
        getOppositionTriple(id),
      ]);
      if (gen !== fetchGenRef.current) return;

      setWallet(acc);
      if (!acc) {
        setTrustBalance('0.00');
        setDistrustBalance('0.00');
        setUserPosition(null);
      }
      if (acc) {
        setIsWatched(isInWatchlist(id, acc));
        getProxyApprovalStatus(acc).then(setIsApproved);
      }

      setAgent(agentData);
      lastAgentRef.current = agentData;
      setOppositionAgent(oppoData);
      setChartData(
        generateAnchoredHistory(
          agentData.totalAssets || '0',
          agentData.totalShares || '0',
          agentData.currentSharePrice,
          timeframe
        )
      );
      setLoading(false);

      // Phase 2 — heavy subgraph + lists (no longer blocks first paint).
      void (async () => {
        try {
          const [
            triplesData,
            claimsWithVaultsData,
            activityData,
            holderResult,
            listDataForAtom,
            listDataForList,
            engagedData,
            incomingResult,
            vaults,
          ] = await Promise.all([
            getAgentTriples(id),
            getAgentTriplesWithVaults(id),
            getMarketActivity(id),
            getHoldersForVault(id),
            getAtomInclusionListsWithVaults(id, 'ATOM'),
            getAtomInclusionListsWithVaults(id, 'LIST'),
            getIdentitiesEngaged(id),
            getIncomingTriplesForStats(id),
            getVaultsForTerm(id),
          ]);
          if (gen !== fetchGenRef.current) return;

          setTriples(triplesData || []);
          setClaimsWithVaults(claimsWithVaultsData || []);

          let mergedActivity = activityData || [];
          if (acc) {
            const localHistory = getLocalTransactions(acc);
            const relevantLocal = localHistory.filter(
              (tx) =>
                tx.vaultId?.toLowerCase() === id.toLowerCase() ||
                (oppoData && tx.vaultId?.toLowerCase() === oppoData.id.toLowerCase()) ||
                (agentData?.counterTermId && tx.vaultId?.toLowerCase() === agentData.counterTermId.toLowerCase())
            );
            const onChainHashes = new Set(mergedActivity.map((tx) => tx.id.toLowerCase()));
            const uniqueLocal = relevantLocal.filter((tx) => !onChainHashes.has(tx.id.toLowerCase()));
            mergedActivity = [...uniqueLocal, ...mergedActivity].sort((a, b) => b.timestamp - a.timestamp);
          }
          setActivityLog(mergedActivity);

          setHolders(holderResult.holders || []);
          setTotalHoldersCount(holderResult.totalCount);
          const useListsContaining = (listDataForAtom?.length ?? 0) > 0;
          setShowingListsContaining(useListsContaining);
          setLists((useListsContaining ? listDataForAtom : listDataForList) || []);
          setEngagedIdentities(engagedData || []);
          setFollowersCount(incomingResult.totalCount);
          setVaultsByCurve(vaults || []);

          if (acc) {
            try {
              setWalletBalance(await getWalletBalance(acc));
              const linearBal = await getShareBalanceEffective(acc, id!, LINEAR_CURVE_ID);
              const offBal = await getShareBalanceEffective(acc, id!, OFFSET_PROGRESSIVE_CURVE_ID);
              const ln = parseFloat(linearBal);
              const on = parseFloat(offBal);
              let curveId: number = LINEAR_CURVE_ID;
              if (ln > 1e-8 && on > 1e-8) {
                curveId = ln >= on ? LINEAR_CURVE_ID : OFFSET_PROGRESSIVE_CURVE_ID;
              } else if (on > 1e-8 && ln <= 1e-8) {
                curveId = OFFSET_PROGRESSIVE_CURVE_ID;
              } else {
                curveId = LINEAR_CURVE_ID;
              }
              setSelectedCurveId(curveId as 1 | 2);
              const tShares = curveId === LINEAR_CURVE_ID ? linearBal : offBal;
              setTrustBalance(tShares);

              let dShares = '0.00';
              if (agentData.type === 'CLAIM') {
                const cId = agentData.counterTermId || calculateCounterTripleId(id!);
                dShares = await getShareBalanceEffective(acc, cId, curveId);
              } else if (oppoData) {
                dShares = await getShareBalanceEffective(acc, oppoData.id, curveId);
              }
              setDistrustBalance(dShares);

              await updatePositionSummary(acc, sentiment, mergedActivity, agentData, oppoData, curveId);
            } catch (rpcErr) {
              console.warn('MarketDetail wallet balance follow-up failed', rpcErr);
            }
          }
        } catch (secErr) {
          console.warn('MarketDetail secondary fetch failed', secErr);
        }
      })();
    } catch (e) {
      console.error(e);
      if (gen !== fetchGenRef.current) return;
      setLoading(false);
      // Transient GraphQL / rate-limit during post-tx refresh: keep showing last good market data.
      if (lastAgentRef.current && String(lastAgentRef.current.id).toLowerCase() === String(id).toLowerCase()) {
        setAgent(lastAgentRef.current);
        setMarketLoadError(null);
      } else {
        setMarketLoadError('failed');
        setAgent(null);
      }
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

    const sharesRaw = await getShareBalanceEffective(acc, currentVaultId, curveId);
    const sharesNum = parseFloat(sharesRaw);

    if (sharesNum > 0.0001) {
        const redeemableQuote = await getQuoteRedeem(sharesRaw, currentVaultId, acc, curveId);
        const redeemableNum = parseFloat(redeemableQuote);
        const spotPrice = redeemableNum / sharesNum;
        const { pnlPercent, avgEntryPrice } = calculatePositionPnL(sharesNum, spotPrice, activity, currentVaultId, curveId);
        
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

  // Re-run when route or wallet changes — previously only [id] missed the case where wagmi connected after mount (balances stayed 0).
  useEffect(() => { fetchData(); }, [id, wagmiAddress]);

  // When selected curve / vaults / timeframe changes: chart from that vault; balances + position use same curve (prefer wagmi address).
  useEffect(() => {
    const vault = vaultsByCurve.find((v) => Number(v.curve_id) === selectedCurveId);
    if (vault) {
      setChartData(generateAnchoredHistory(vault.total_assets, vault.total_shares, vault.current_share_price, timeframe));
    } else if (agent) {
      setChartData(generateAnchoredHistory(agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice, timeframe));
    }
    if (effectiveWallet && id) {
      getShareBalanceEffective(effectiveWallet, id, selectedCurveId).then(setTrustBalance);
      if (agent?.type === 'CLAIM') {
        const cId = agent.counterTermId || calculateCounterTripleId(id);
        getShareBalanceEffective(effectiveWallet, cId, selectedCurveId).then(setDistrustBalance);
      } else if (oppositionAgent) {
        getShareBalanceEffective(effectiveWallet, oppositionAgent.id, selectedCurveId).then(setDistrustBalance);
      }
      if (agent && id) updatePositionSummary(effectiveWallet, sentiment, activityLog, agent, oppositionAgent, selectedCurveId);
    }
  }, [selectedCurveId, vaultsByCurve, timeframe, effectiveWallet, id, agent, oppositionAgent, sentiment, activityLog]);

  // Sync wallet from wagmi so Execution Deck / SIGNAL_TRUST has connected wallet when user connected in header
  useEffect(() => {
    if (!wagmiAddress) {
      setWallet(null);
      setTrustBalance('0.00');
      setDistrustBalance('0.00');
      setUserPosition(null);
      return;
    }
    setWallet(wagmiAddress);
    getWalletBalance(wagmiAddress).then(setWalletBalance);
    if (id) {
      setIsWatched(isInWatchlist(id, wagmiAddress));
      getProxyApprovalStatus(wagmiAddress).then(setIsApproved);
    }
  }, [wagmiAddress, id]);

  useEffect(() => {
      if (effectiveWallet && agent) {
          updatePositionSummary(effectiveWallet, sentiment, activityLog, agent, oppositionAgent, selectedCurveId);
      }
  }, [sentiment, effectiveWallet, activityLog, selectedCurveId, agent, oppositionAgent, id]);

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

    if (action === 'LIQUIDATE' && inputAmount && parseFloat(inputAmount) > 0 && effectiveWallet && activeTargetId) {
        const timer = setTimeout(async () => {
            setIsQuoting(true);
            try {
                const quote = await getQuoteRedeem(inputAmount, activeTargetId, effectiveWallet, selectedCurveId);
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
  }, [inputAmount, action, effectiveWallet, id, sentiment, agent, oppositionAgent, selectedCurveId]);

  const addLog = (log: string) => {
    setTxModal((prev: any) => ({ ...prev, logs: [...prev.logs, log] }));
  };

  const handleExecute = async () => {
        if (txModal.status === 'processing') return;
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
            setActivityLog((prev: any) => [localTx, ...prev]);
            setTxModal((prev: any) => ({ 
                ...prev, 
                status: 'success', 
                title: 'Done', 
                message: 'Transaction verified on-chain.', 
                hash: res.hash,
                logs: [...prev.logs, 'Finalizing Local Ledger Sync...', 'Uplink Synchronized.']
            }));
            setInputAmount('');

            // Refresh share balance for selected curve so LIQUIDATE shows correct balance (RPC may lag briefly)
            getShareBalanceEffective(activeWallet, id!, selectedCurveId).then(setTrustBalance);
            if (agent?.type === 'CLAIM') {
              const cId = agent.counterTermId || calculateCounterTripleId(id!);
              getShareBalanceEffective(activeWallet, cId, selectedCurveId).then(setDistrustBalance);
            } else if (oppositionAgent) {
              getShareBalanceEffective(activeWallet, oppositionAgent.id, selectedCurveId).then(setDistrustBalance);
            }
            updatePositionSummary(activeWallet, sentiment, [localTx, ...activityLog], agent!, oppositionAgent, selectedCurveId);

            // Re-fetch with slight delay to allow indexer to breathe (use selected curve for balances)
            setTimeout(() => { fetchData(); }, 4000);
        } catch (e) {
            setTxModal((prev: any) => ({ 
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
        else
          setInputAmount(
            sentiment === 'TRUST' ? mergeTrustBalanceDisplay(trustBalance, holders, effectiveWallet, selectedCurveId) : distrustBalance
          );
  };

  const getConvictionMetadata = (shares: string | number) => {
    const s = typeof shares === 'string' ? parseFloat(formatEther(BigInt(shares))) : shares;
    const ts = parseFloat(formatEther(BigInt(agent?.totalShares || '1')));
    const pct = ts > 0 ? (s / ts) * 100 : 0;
    
    if (pct >= 5) return { label: 'Very high', color: 'text-intuition-primary border-intuition-primary/40 bg-intuition-primary/10 shadow-glow-blue' };
    if (pct >= 1) return { label: 'High', color: 'text-white border-white/20 bg-white/5' };
    if (pct >= 0.1) return { label: 'Medium', color: 'text-slate-400 border-slate-800' };
    return { label: 'Acquire / Redeem', color: 'text-slate-600 border-slate-900 opacity-60' };
  };

  const swipeFillRef = useRef<HTMLDivElement | null>(null);
  const swipeHandleRef = useRef<HTMLDivElement | null>(null);
  const lastProgressRef = useRef<number>(0);

  const applySwipeProgress = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    lastProgressRef.current = clamped;
    if (swipeFillRef.current) swipeFillRef.current.style.width = `${clamped}%`;
    if (swipeHandleRef.current) {
      const handlePct = Math.max(5, Math.min(95, clamped));
      swipeHandleRef.current.style.left = `${handlePct}%`;
    }
  };

  const updateSwipeFromClientX = (clientX: number) => {
    if (!swipeTrackRef.current) return;
    const rect = swipeTrackRef.current.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    applySwipeProgress(raw);
  };

  const handleSwipeStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (txModal.status === 'processing') return;
    e.preventDefault();
    setIsSwiping(true);
    if ('touches' in e) {
      if (e.touches.length > 0) updateSwipeFromClientX(e.touches[0].clientX);
    } else {
      updateSwipeFromClientX(e.clientX);
    }
  };

  const handleSwipeMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isSwiping) return;
    e.preventDefault();
    if ('touches' in e) {
      if (e.touches.length > 0) updateSwipeFromClientX(e.touches[0].clientX);
    } else {
      updateSwipeFromClientX(e.clientX);
    }
  };

  const handleSwipeEnd = () => {
    if (!isSwiping) return;
    const prev = lastProgressRef.current;
    setIsSwiping(false);
    setSwipeProgress(0);
    applySwipeProgress(0);
    if (prev >= 55 && txModal.status !== 'processing') handleExecute();
  };

  useEffect(() => {
    if (!isSwiping) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateSwipeFromClientX(e.clientX);
    };
    const handleMouseUp = () => handleSwipeEnd();
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        updateSwipeFromClientX(e.touches[0].clientX);
      }
    };
    const handleTouchEnd = () => handleSwipeEnd();

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove, true);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isSwiping]);

  /** Must run every render (before any early return) — Rules of Hooks. */
  const holderTrustLinear = useMemo(
    () => (effectiveWallet && holders.length ? getSharesFromHolderRowsForCurve(holders, effectiveWallet, LINEAR_CURVE_ID) : 0),
    [holders, effectiveWallet]
  );
  const holderTrustExp = useMemo(
    () => (effectiveWallet && holders.length ? getSharesFromHolderRowsForCurve(holders, effectiveWallet, OFFSET_PROGRESSIVE_CURVE_ID) : 0),
    [holders, effectiveWallet]
  );
  const displayTrustBalance = useMemo(
    () => mergeTrustBalanceDisplay(trustBalance, holders, effectiveWallet, selectedCurveId),
    [trustBalance, holders, effectiveWallet, selectedCurveId]
  );
  const curveMismatchTrust = useMemo(
    () =>
      selectedCurveId === OFFSET_PROGRESSIVE_CURVE_ID &&
      holderTrustExp < 1e-12 &&
      holderTrustLinear > 1e-12,
    [selectedCurveId, holderTrustLinear, holderTrustExp]
  );
  const curveMismatchTrustInverse = useMemo(
    () =>
      selectedCurveId === LINEAR_CURVE_ID &&
      holderTrustLinear < 1e-12 &&
      holderTrustExp > 1e-12,
    [selectedCurveId, holderTrustLinear, holderTrustExp]
  );
  const activeBalance = sentiment === 'TRUST' ? displayTrustBalance : distrustBalance;

  /** Full hex term id for this market (claims, SDK, copy) — normalized with 0x prefix. */
  const termIdNormalized = useMemo(() => {
    const raw = String(agent?.id ?? '').trim();
    if (!raw) return '';
    return raw.startsWith('0x') ? raw : `0x${raw}`;
  }, [agent?.id]);

  if (loading) {
    return (
      <>
        <PageLoading message="Loading market…" />
        {txModal.isOpen && (
          <TransactionModal
            isOpen={txModal.isOpen}
            status={txModal.status}
            title={txModal.title}
            message={txModal.message}
            hash={txModal.hash}
            logs={txModal.logs}
            onClose={() => setTxModal((p: any) => ({ ...p, isOpen: false }))}
          />
        )}
      </>
    );
  }

  if (marketLoadError || !agent) {
    const errMsg =
      marketLoadError === 'missing-id'
        ? 'Invalid market link.'
        : 'Could not load this market. Check your connection or try again.';
    return (
      <>
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 bg-[#020308] text-center">
          <p className="text-intuition-primary font-mono text-xs sm:text-sm uppercase tracking-[0.35em] max-w-md">{errMsg}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/markets/atoms"
              onClick={playClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-intuition-primary/50 text-intuition-primary font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-intuition-primary/10 transition-colors"
            >
              <ArrowLeft size={14} /> Back to markets
            </Link>
            {id && (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  void fetchData();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-600 text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-full hover:border-slate-400 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
        {txModal.isOpen && (
          <TransactionModal
            isOpen={txModal.isOpen}
            status={txModal.status}
            title={txModal.title}
            message={txModal.message}
            hash={txModal.hash}
            logs={txModal.logs}
            onClose={() => setTxModal((p: any) => ({ ...p, isOpen: false }))}
          />
        )}
      </>
    );
  }

  const selectedVault = vaultsByCurve.find((v) => Number(v.curve_id) === selectedCurveId);
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

  return (
    <div className="w-full px-3 sm:px-6 lg:px-10 pt-6 pb-24 sm:pb-32 font-mono text-[#e2e8f0] bg-gradient-to-br from-[#020308] via-[#020616] to-[#020308] max-w-[100vw] overflow-x-hidden">
      <div className="max-w-[1400px] mx-auto rounded-[3rem] bg-black/80 border border-slate-900/70 shadow-[0_24px_60px_rgba(0,0,0,0.9)] px-4 sm:px-6 md:px-8 lg:px-10 pt-6 pb-10 space-y-8">
        <Link
          to="/markets"
          onClick={playClick}
          onMouseEnter={playHover}
          className="inline-flex items-center gap-2 px-4 py-2.5 mb-2 border border-slate-700 text-slate-400 hover:border-intuition-primary hover:text-intuition-primary font-black text-[10px] uppercase tracking-widest rounded-full transition-all duration-200 hover:shadow-glow-blue"
        >
          <ArrowLeft size={16} /> Back to markets
        </Link>
        <TransactionModal 
            isOpen={txModal.isOpen} 
            status={txModal.status} 
            title={txModal.title} 
            message={txModal.message} 
            hash={txModal.hash} 
            logs={txModal.logs}
            onClose={() => setTxModal((p: any) => ({ ...p, isOpen: false }))} 
        />
        <CreateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
        <BondingCurvesInfoPanel isOpen={isCurveInfoOpen} onClose={() => setIsCurveInfoOpen(false)} />
        <AgentShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} agent={agent} mktCap={mktCapVal} price={currentSpotPrice} holders={totalHoldersCount} tags={tags} />
        
        {showShareCard && cardStats && (
          <div className="fixed inset-0 bg-black/98 z-[300] flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4 overflow-y-auto backdrop-blur-3xl animate-in zoom-in duration-300" onClick={() => setShowShareCard(false)}>
            <div className="relative w-full max-w-lg my-auto sm:my-0" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowShareCard(false)} className="absolute -top-16 right-0 text-slate-500 hover:text-white transition-colors p-2 group"><X size={32} className="group-hover:rotate-90 transition-transform" /></button>
              <ShareCard 
                username={effectiveWallet || '0xUser'} 
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
        <div className="flex flex-wrap items-center gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
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

        {/* Top summary row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-8 mb-10 py-6 border-b border-white/5 overflow-x-auto no-scrollbar">
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
                {agent.creator?.id && !isProtocolRouterAddress(agent.creator.id) ? (
                    <a href={`${EXPLORER_URL}/address/${agent.creator.id}`} target="_blank" rel="noreferrer" onClick={playClick} onMouseEnter={playHover} className="flex items-center gap-2.5 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full hover:border-intuition-primary/40 transition-all cursor-pointer group/creator">
                        <div className="w-5 h-5 rounded-full bg-slate-900 border border-white/20 overflow-hidden shrink-0 shadow-glow-blue"><img src={`https://effigy.im/a/${agent.creator.id}.png`} className="w-full h-full object-cover" alt="" /></div>
                        <span className="text-[10px] font-black text-white group-hover/creator:text-intuition-primary transition-colors">{agent.creator?.label || agent.creator?.id?.slice(0, 14)}</span>
                        <ExternalLink size={10} className="text-slate-600 group-hover/creator:text-intuition-primary" />
                    </a>) : agent.creator?.label ? (
                    <div className="flex items-center gap-2.5 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full max-w-[min(100%,14rem)]" title={agent.creator.label}>
                        <User size={10} className="text-slate-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-200 truncate">{agent.creator.label}</span>
                    </div>) : (
                    <div className="flex items-center gap-2.5 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-slate-500"><User size={10} /><span className="text-[10px] font-black uppercase">Anonymous</span></div>)}
            </div>
            <div className="hidden lg:block w-[1px] h-4 bg-white/10"></div>
            <div className="flex items-center gap-5 lg:ml-auto">
                <button onClick={() => { playClick(); setIsShareModalOpen(true); }} onMouseEnter={playHover} className="w-11 h-11 flex items-center justify-center bg-black border border-white/10 hover:border-intuition-primary hover:text-intuition-primary transition-all rounded-full group shadow-2xl hover:shadow-glow-blue" title="Share claim"><Share2 size={20} className="group-hover:scale-110 transition-transform" /></button>
                <a href={`${EXPLORER_URL}/address/${agent.id}`} target="_blank" rel="noreferrer" onMouseEnter={playHover} className="w-11 h-11 flex items-center justify-center bg-black border border-white/10 hover:border-intuition-primary hover:text-intuition-primary transition-all rounded-full group shadow-2xl hover:shadow-glow-blue" title="INITIALIZE_NODE_RECON"><ScanSearch size={20} className="group-hover:scale-110 transition-transform" /></a>
            </div>
        </div>

        <div className="bg-[#02040a] border-2 rounded-[2rem] p-4 sm:p-6 md:p-8 mb-8 flex flex-col md:flex-row items-center justify-between relative overflow-hidden shadow-2xl group/header transition-all duration-500" style={{ borderColor: `${theme.color}44`, boxShadow: `0 0 40px ${theme.bgGlow}` }}>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10"></div>
            <div className="flex items-center gap-4 sm:gap-6 md:gap-10 relative z-10 w-full min-w-0">
                <div className="relative shrink-0">
                    <div className="absolute -inset-4 md:-inset-6 blur-2xl opacity-0 group-hover/header:opacity-100 transition-opacity duration-1000" style={{ backgroundColor: `${theme.color}33` }}></div>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-slate-950 border-2 flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl group-hover/header:scale-105 transition-all duration-500" style={{ borderColor: `${theme.color}66` }}>{agent.image ? <img src={agent.image} alt={agent.label} className="w-full h-full object-cover group-hover/header:scale-110 transition-transform duration-1000" /> : <User size={40} className="text-slate-800 md:w-[52px] md:h-[52px]" />}</div>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div className="w-2 h-2 rounded-full bg-intuition-success animate-pulse shadow-[0_0_10px_#00ff9d]"></div>
                        {verified ? (
                            <span className="flex items-center gap-1.5 px-2 sm:px-3 py-1 bg-intuition-primary/10 border border-intuition-primary/40 text-intuition-primary text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] shadow-glow-blue">
                                <BadgeCheck size={12} className="sm:w-[14px] sm:h-[14px]" /> Verified by Intuition
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 px-2 sm:px-3 py-1 bg-slate-900 border border-slate-700 text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em]">
                                <UserCog size={12} className="sm:w-[14px] sm:h-[14px]" /> Community node
                            </span>
                        )}
                    </div>
                    <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-white font-display tracking-tight leading-[1.12] mb-2 sm:mb-4 break-words max-w-full">
                      {agent.label}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
                        <Hash size={13} className="text-slate-700 shrink-0" />
                        <span className="shrink-0">Term ID</span>
                        <span
                          className="text-slate-300 font-mono normal-case text-[10px] sm:text-[11px] tracking-normal break-all select-all"
                          title={termIdNormalized || undefined}
                        >
                          {termIdNormalized || '—'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!termIdNormalized) return;
                            void navigator.clipboard.writeText(termIdNormalized);
                            playClick();
                            toast.success('Term ID copied');
                          }}
                          className="shrink-0 inline-flex items-center justify-center p-1.5 rounded-md border border-slate-700 hover:border-intuition-primary hover:text-intuition-primary text-slate-500 transition-colors"
                          title="Copy term ID (for claims & integrations)"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-800 shrink-0 hidden sm:block" />
                      <span className="px-2.5 py-1 border font-black text-[8px] tracking-[0.2em] shrink-0" style={{ color: theme.color, borderColor: `${theme.color}44`, backgroundColor: `${theme.color}11` }}>Linear curve</span>
                    </div>
                </div>
            </div>
            
            <div className="mt-10 md:mt-0 flex flex-col items-end gap-3 relative z-10 text-right">
                <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">Trust score</div>
                <div className="flex items-end gap-8 mb-2">
                    <div className="flex flex-col items-center group/prob">
                        <div className="text-4xl font-black text-intuition-success text-glow-success transition-all group-hover/prob:scale-110">{currentStrength.toFixed(1)}%</div>
                        <div className="mt-1 flex items-center justify-center"><CurrencySymbol size="sm" className="text-slate-500" /></div>
                    </div>
                </div>
                <div className="text-sm font-black text-slate-700 font-mono uppercase tracking-[0.4em]">Score confirmed</div>
            </div>
        </div>

        {/* Core trading layout: left = chart + AI brief, right = trade + metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start mb-12">
            <div className="lg:col-span-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-black border p-8 rounded-3xl relative overflow-hidden group shadow-2xl h-full flex flex-col justify-center hover:border-white/40 transition-colors duration-700" style={{ borderColor: `${theme.color}44` }}>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]" aria-hidden>
                          <Shield size={100} className="text-slate-500" strokeWidth={1} />
                        </div>
                        <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] mb-6">Reputation</div>
                        <div
                          className="font-black font-display text-white text-glow-white mb-2 leading-tight tracking-tight transition-all duration-700 text-lg sm:text-xl md:text-2xl lg:text-3xl max-w-full"
                          style={{ color: theme.color, textShadow: `0 0 20px ${theme.color}66` }}
                        >
                          {theme.label}
                        </div>
                        <div className="text-[9px] font-black text-slate-500 tracking-wide font-sans">Trust score: <span style={{ color: theme.color }}>{currentStrength.toFixed(1)}%</span></div>
                    </div>
                    <div className="md:col-span-2"><AIBriefing agent={agent} triples={triples} history={activityLog} /></div>
                </div>

                <div className="bg-black border border-slate-900 flex flex-col rounded-[2rem] relative overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)] min-h-[320px] h-[50vh] sm:h-[420px] md:h-[550px] lg:h-[650px] group/chart">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
                    <div className="p-4 sm:p-6 md:p-10 flex flex-col md:flex-row justify-between items-end bg-[#02040a]/80 backdrop-blur-md relative z-20 border-b border-white/5 gap-4 md:gap-8">
                        <div>
                            <div className="flex items-baseline gap-2 sm:gap-3 mb-2 flex-wrap">
                              <div className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white font-display tracking-tighter leading-none group-hover/chart:text-glow-white transition-all duration-700 flex items-baseline gap-2">
                                <CurrencySymbol size="2xl" leading className="text-white/90" />
                                <span className="break-words max-w-full">{formatMarketValue(displayPrice)}</span>
                              </div>
                              <div className="text-[10px] sm:text-[12px] text-slate-500 font-mono tracking-widest uppercase font-black">
                                per share
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.4em] mt-3 text-glow" style={{ color: theme.color }}><Activity size={12} className="animate-pulse shadow-[0_0_15px_currentColor]" /> Live</div>
                        </div>
                        <div className="flex gap-12 font-black text-right pb-1">
                             <div className="flex flex-col items-end group/item"><span className="text-[9px] text-slate-600 uppercase tracking-widest mb-2 group-hover/item:text-white transition-colors">24h volatility</span><span className="text-2xl text-white font-display tracking-tight text-glow-white">0.82%</span></div>
                             <div className="flex flex-col items-end group/item"><span className="text-[9px] text-slate-600 uppercase tracking-widest mb-2 group-hover/item:text-white transition-colors">Curve status</span><span className="text-2xl font-display tracking-tight uppercase text-glow" style={{ color: theme.color }}>Stable</span></div>
                        </div>
                    </div>
                    <div className="px-3 sm:px-6 md:px-10 py-3 bg-white/5 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 z-20 overflow-x-auto">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { playClick(); setIsCurveInfoOpen(true); }} onMouseEnter={playHover} className="p-1.5 text-slate-500 hover:text-intuition-primary transition-colors" aria-label="How bonding curves work">
                          <Info size={16} />
                        </button>
                        {([LINEAR_CURVE_ID, OFFSET_PROGRESSIVE_CURVE_ID] as const).map((cid) => (
                          <button key={cid} onClick={() => { playClick(); setSelectedCurveId(cid); }} className={`min-h-[40px] px-3 py-2 text-[9px] font-black font-mono transition-all rounded-full uppercase tracking-widest shrink-0 ${selectedCurveId === cid ? 'bg-white text-black shadow-glow-white' : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'}`}>
                            {cid === LINEAR_CURVE_ID ? 'Linear' : 'Exponential'}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5 sm:gap-2 min-w-0">{(['15M', '30M', '1H', '4H', '1D', '1W', '1M', '1Y', 'ALL'] as Timeframe[]).map((tf) => (<button key={tf} onClick={() => { playClick(); setTimeframe(tf); }} className={`min-h-[44px] px-3 sm:px-4 py-2.5 sm:py-2 text-[9px] sm:text-[10px] font-black font-mono transition-all rounded-full uppercase tracking-widest shrink-0 ${timeframe === tf ? 'bg-white text-black shadow-glow-white' : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'}`}>{tf}</button>))}</div>
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
                <div className="bg-black border border-slate-900 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-500">
                    <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">Circulating shares</h4>
                        <span className="text-[11px] font-black text-glow" style={{ color: theme.color }}>{formatDisplayedShares(selectedVault?.total_shares ?? (agent.totalShares || '0'))} shares</span>
                    </div>
                    <div className="flex gap-2.5 h-4 px-1">
                        {[...Array(12)].map((_, i) => {
                            const assetsVal = safeParseUnits(selectedVault?.total_assets ?? (agent.totalAssets || '0'));
                            const fill = Math.min(12, Math.floor(assetsVal / 8));
                            return <div key={i} className={`flex-1 h-full rounded-full transition-all duration-1000 ${i < fill ? 'shadow-glow' : 'bg-slate-900 opacity-20'}`} style={{ backgroundColor: i < fill ? theme.color : '' }}></div>;
                        })}
                    </div>
                    <div className="mt-4 text-[7px] text-slate-700 font-mono uppercase text-center tracking-[0.3em] opacity-60">
                      {selectedCurveId === LINEAR_CURVE_ID ? 'Linear' : 'Exponential'} curve active
                    </div>
                </div>

                <div className={`bg-[#050505] border-2 rounded-[2rem] shadow-[0_0_60px_rgba(0,0,0,0.6)] group transition-all duration-500 ${sentiment === 'DISTRUST' ? 'border-intuition-danger/40' : 'border-slate-900/80'}`} style={{ borderColor: sentiment === 'TRUST' ? `${theme.color}55` : undefined }}>
                    <div className="p-6 sm:p-8 border border-white/5 rounded-2xl relative overflow-hidden bg-black/60">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none" aria-hidden />
                        <h2 className={`text-sm font-black uppercase tracking-wider mb-6 flex items-center gap-2 ${sentiment === 'DISTRUST' ? 'text-intuition-danger' : ''}`} style={{ color: sentiment === 'TRUST' ? theme.color : undefined }}>
                          Trade
                          <span className={`w-1.5 h-1.5 rounded-full ${sentiment === 'DISTRUST' ? 'bg-intuition-danger' : ''}`} style={{ backgroundColor: sentiment === 'TRUST' ? theme.color : '' }} />
                        </h2>
                        <div className="flex gap-1.5 mb-6">
                            <button
                              onClick={() => {
                                setAction('ACQUIRE');
                                playClick();
                              }}
                              className={`flex-1 py-3.5 text-[10px] font-black rounded-2xl transition-all uppercase tracking-wider border-2 ${
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
                              className={`flex-1 py-3.5 text-[10px] font-black rounded-2xl transition-all uppercase tracking-wider border-2 ${
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
                              {selectedCurveId === LINEAR_CURVE_ID ? 'Linear' : 'Exponential'}
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
                                <div className="flex gap-1.5 p-1 bg-black border border-white/5 rounded-full">
                                    <button onClick={() => { setSentiment('TRUST'); playClick(); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase transition-all rounded-full ${sentiment === 'TRUST' ? 'bg-intuition-success text-black' : 'text-slate-500 hover:text-white'}`}>{agent.type === 'CLAIM' ? 'Support' : 'Trust'}</button>
                                    <button onClick={() => { setSentiment('DISTRUST'); playClick(); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase transition-all rounded-full ${sentiment === 'DISTRUST' ? 'bg-intuition-danger text-white' : 'text-slate-500 hover:text-white'}`}>{agent.type === 'CLAIM' ? 'Oppose' : 'Distrust'}</button>
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
                            {action === 'LIQUIDATE' && sentiment === 'TRUST' && curveMismatchTrust && (
                              <p className="text-[10px] text-amber-400/95 mb-2 font-mono leading-relaxed">
                                Your position is on the <span className="font-black text-amber-300">Linear</span> curve. Select <span className="font-black text-amber-300">Linear</span> in the curve table to redeem — Exponential has a separate vault.
                              </p>
                            )}
                            {action === 'LIQUIDATE' && sentiment === 'TRUST' && curveMismatchTrustInverse && (
                              <p className="text-[10px] text-amber-400/95 mb-2 font-mono leading-relaxed">
                                Your position is on the <span className="font-black text-amber-300">Exponential</span> curve. Select <span className="font-black text-amber-300">Exponential</span> in the curve table to redeem.
                              </p>
                            )}
                            <div className="relative border-2 border-slate-800 focus-within:border-white/30 p-1 rounded-2xl transition-all duration-300">
                                <input type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} className="w-full bg-[#080808] border-none p-4 pr-4 text-right text-white font-black font-mono text-xl sm:text-2xl focus:outline-none rounded-xl" placeholder="0" />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono pointer-events-none">
                                  {action === 'ACQUIRE' ? <CurrencySymbol size="sm" leading /> : 'shares'}
                                </span>
                            </div>
                            
                            {action === 'LIQUIDATE' && inputAmount && parseFloat(inputAmount) > 0 && (
                                <div className="mt-3 py-3 px-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between transition-all duration-300">
                                    <span className="text-[10px] text-slate-500">You receive</span>
                                    {isQuoting ? <Loader2 size={14} className="animate-spin text-intuition-primary" /> : (
                                        <span className="text-sm font-bold text-intuition-success font-mono">{estimatedProceeds} <CurrencySymbol size="sm" className="text-slate-500" /></span>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {!isApproved && action === 'ACQUIRE' ? (
                          <div className="mt-4 flex flex-col items-center">
                            <p className="text-[10px] text-slate-400 font-mono text-center mb-3 leading-relaxed">
                              You are about to enable the IntuRank proxy contract.<br/>
                              This allows the protocol to process your acquisitions securely.
                            </p>
                            <button
                              onClick={handleExecute}
                              disabled={txModal.status === 'processing'}
                              className={`w-full py-4 rounded-full font-black uppercase text-[11px] tracking-[0.3em] transition-all flex items-center justify-center gap-2 ${
                                txModal.status === 'processing'
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-none'
                                  : 'bg-white text-black hover:bg-slate-200 active:scale-[0.98]'
                              }`}
                              style={txModal.status !== 'processing' ? { boxShadow: `0 0 20px ${theme.color}40` } : {}}
                            >
                              {txModal.status === 'processing' ? (
                                <>
                                  <Loader2 size={16} className="animate-spin" /> Confirm in wallet...
                                </>
                              ) : (
                                'Enable IntuRank Proxy'
                              )}
                            </button>
                          </div>
                        ) : (
                          <div
                            ref={swipeTrackRef}
                            className={`mt-4 w-full h-14 rounded-full bg-slate-900/80 border border-slate-700/80 relative overflow-visible select-none touch-none transition-opacity ${txModal.status === 'processing' ? 'pointer-events-none opacity-60 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                            style={{ touchAction: 'none', contain: 'layout' }}
                            onMouseDown={handleSwipeStart}
                            onTouchStart={handleSwipeStart}
                            onTouchMove={handleSwipeMove}
                          >
                            <div className="absolute inset-1 rounded-full bg-slate-950/80 overflow-hidden">
                              <div
                                ref={swipeFillRef}
                                className="h-full rounded-full"
                                style={{
                                  width: `${swipeProgress}%`,
                                  background:
                                    sentiment === 'DISTRUST'
                                      ? 'linear-gradient(90deg, rgba(248,113,113,0.2), #f97373)'
                                      : `linear-gradient(90deg, rgba(56,189,248,0.2), ${theme.color})`,
                                }}
                              />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-[11px] font-black font-mono uppercase tracking-[0.3em] text-slate-300">
                                {txModal.status === 'processing'
                                  ? 'Confirm in wallet...'
                                  : action === 'ACQUIRE'
                                  ? 'Swipe to acquire'
                                  : 'Swipe to redeem'}
                              </span>
                            </div>
                            <div
                              ref={swipeHandleRef}
                              className="absolute top-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center pointer-events-none z-10"
                              style={{
                                left: `${Math.max(5, Math.min(95, swipeProgress))}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                            >
                              <ArrowRight size={18} className="text-slate-900" />
                            </div>
                          </div>
                        )}
                    </div>
                </div>

                {vaultsByCurve.length > 0 && (
                  <div className="bg-black border border-slate-800 p-5 rounded-3xl">
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
                          const label = cid === LINEAR_CURVE_ID ? 'Linear' : 'Exponential';
                          return (
                            <tr key={cid} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-2.5 pr-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="radio" name="curve-select" checked={selectedCurveId === cid} onChange={() => { playClick(); setSelectedCurveId(cid as 1 | 2); }} className="sr-only" />
                                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${selectedCurveId === cid ? 'border-intuition-primary bg-intuition-primary' : 'border-slate-600'}`}>
                                    {selectedCurveId === cid && <span className="w-1.5 h-1.5 bg-black rounded-full" />}
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
                      className="w-full bg-black border-2 border-slate-800 p-5 rounded-3xl text-left hover:border-intuition-success/50 transition-all duration-300 group"
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

        <div className="ares-frame bg-black rounded-[2rem] shadow-2xl overflow-hidden min-h-[600px]">
            <div className="flex flex-wrap gap-2 p-4 sm:p-5 bg-black/40 border-b border-slate-900/80 overflow-x-auto no-scrollbar">
                {[
                    { id: 'OVERVIEW', label: 'Overview', icon: Activity },
                    { id: 'POSITIONS', label: 'Positions', icon: Users },
                    { id: 'IDENTITIES', label: 'Identities', icon: Globe },
                    { id: 'CLAIMS', label: 'Claims', icon: MessageSquare },
                    { id: 'LISTS', label: 'Lists', icon: ListIcon },
                    { id: 'ACTIVITY', label: 'Activity', icon: Clock },
                    { id: 'CONNECTIONS', label: 'Connections', icon: Network }
                ].map((t) => {
                    const isActive = activeTab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => { playClick(); setActiveTab(t.id as DetailTab); }}
                            className={`
                                relative min-w-[120px] sm:min-w-[130px] px-5 py-3 rounded-2xl text-[10px] font-black tracking-[0.3em] uppercase flex items-center justify-center gap-2.5
                                transition-all duration-300
                                ${isActive
                                    ? 'text-black border-2'
                                    : 'text-slate-500 bg-white/5 border-2 border-transparent hover:text-white hover:bg-white/10 hover:border-white/20 active:scale-[0.98]'
                                }
                            `}
                            style={isActive ? { backgroundColor: theme.color, borderColor: theme.color, boxShadow: `0 0 20px ${theme.color}66, 0 0 40px ${theme.color}22` } : undefined}
                        >
                            <t.icon size={14} className={isActive ? 'animate-pulse' : ''} style={{ color: isActive ? '#020308' : undefined }} />
                            <span>{t.label}</span>
                        </button>
                    );
                })}
            </div>
            
            <div className="p-4 sm:p-6 md:p-10 overflow-x-hidden">
                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-20 animate-in fade-in duration-700">
                        <div className="space-y-12">
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-[0.35em] mb-6 flex items-center gap-3 text-glow" style={{ color: theme.color }}><Activity size={14}/> At a glance</h4>
                                <p className="text-slate-400 text-base leading-relaxed font-sans font-medium tracking-tight group-hover:text-slate-200 transition-colors"><strong className="text-white text-glow-white">{agent.label}</strong> has {triples.length} related claims on the graph. This market uses a linear bonding curve.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                              <div className="p-4 md:p-6 bg-white/5 border border-white/10 rounded-2xl group hover:border-white/40 transition-all duration-300">
                                <div className="text-[9px] text-slate-600 uppercase mb-2 font-black tracking-widest group-hover:text-white">
                                  TOTAL MKT CAP
                                </div>
                                <div className="text-xl md:text-2xl font-black text-white font-display tracking-tight group-hover:text-glow-white inline-flex items-baseline gap-1">
                                  <CurrencySymbol size="xl" leading className="text-white/90" />
                                  {formatMarketValue(mktCapVal)}
                                </div>
                              </div>
                              <div className="p-4 md:p-6 bg-white/5 border border-white/10 rounded-2xl group hover:border-white/40 transition-all duration-300">
                                <div className="text-[9px] text-slate-600 uppercase mb-2 font-black tracking-widest group-hover:text-white">
                                  Total shares
                                </div>
                                <div className="text-xl md:text-2xl font-black text-white font-display tracking-tight group-hover:text-glow-white">
                                  {formatLargeNumber(formatDisplayedShares(agent.totalShares || '0'))}
                                </div>
                              </div>
                            </div>
                            
                            {/* NEW: PROVENANCE LINKS SECTION */}
                            {agent.links && agent.links.length > 0 && (
                                <div className="pt-4">
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.35em] mb-6 flex items-center gap-3 text-white">
                                        <LinkIcon size={14} className="text-intuition-primary" /> Links
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
                                                    className="flex items-center justify-between gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-intuition-primary hover:bg-intuition-primary/5 transition-all duration-300 group/link"
                                                >
                                                    <span className="text-[10px] font-bold text-slate-400 group-hover/link:text-white truncate shrink-0">{link.label || 'Link'}</span>
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
                            <h4 className="text-[11px] font-black text-white uppercase tracking-[0.35em] mb-6 text-glow-white">Market details</h4>
                            <div className="p-8 border border-white/5 bg-white/5 rounded-2xl font-sans text-xs space-y-5 transition-all duration-300">
                                <div className="flex justify-between items-center group gap-4"><span className="text-slate-500 font-semibold group-hover:text-slate-300 transition-colors shrink-0">Bonding curve</span><span className="font-bold text-glow text-right" style={{ color: theme.color }}>Linear (utility)</span></div>
                                <div className="flex justify-between items-center group gap-4"><span className="text-slate-500 font-semibold group-hover:text-slate-300 transition-colors shrink-0">Creator</span><span className="text-white font-bold group-hover:text-glow-white text-right break-all">{agent.creator?.id && !isProtocolRouterAddress(agent.creator.id) ? (agent.creator?.label || agent.creator.id.slice(0, 18)) : (agent.creator?.label || '—')}</span></div>
                                {(() => {
                                    const primaryLink = agent.links?.[0];
                                    const linkUrl = primaryLink?.url ? (primaryLink.url.startsWith('http') ? primaryLink.url : `https://${primaryLink.url}`) : null;
                                    return (
                                        <div className="flex justify-between items-center group gap-3">
                                            <span className="text-slate-500 font-semibold group-hover:text-slate-300 transition-colors shrink-0">Primary link</span>
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
                                <div className="flex justify-between items-center group gap-4"><span className="text-slate-500 font-semibold group-hover:text-slate-300 transition-colors shrink-0">Last activity</span><span className="text-white font-bold group-hover:text-glow-white">{activityLog[0] ? new Date(activityLog[0].timestamp).toLocaleDateString() : 'Loading…'}</span></div>
                                <div className="flex justify-between items-center group gap-4"><span className="text-slate-500 font-semibold group-hover:text-slate-300 transition-colors shrink-0">Reputation tier</span><span className="px-3 py-0.5 text-black font-bold text-[10px] shadow-glow rounded-sm" style={{ backgroundColor: theme.color }}>{theme.label}</span></div>
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
                                    <th className="px-3 sm:px-6 md:px-8 py-4 sm:py-6">CURVE</th>
                                    <th className="px-3 sm:px-6 md:px-8 py-4 sm:py-6">CONVICTION</th>
                                    <th className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-right">SHARES</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {holders.length > 0 ? holders.map((h, i) => {
                                    const meta = getConvictionMetadata(h.shares);
                                    return (
                                        <tr key={`${h.account?.id ?? 'x'}-${h.vault?.curve_id ?? i}-${i}`} className="hover:bg-white/5 transition-all group">
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-slate-600 font-black">#{(i + 1).toString().padStart(2, '0')}</td>
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6">
                                                <Link to={`/profile/${h.account.id}`} className="flex items-center gap-2 sm:gap-4 group-hover:text-white transition-colors">
                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden group-hover:border-white transition-all shadow-xl shrink-0">
                                                        {h.account.image ? <img src={h.account.image} className="w-full h-full object-cover" /> : <User size={12} className="text-slate-700 sm:w-[14px] sm:h-[14px]" />}
                                                    </div>
                                                    <span className="font-black text-white group-hover:text-glow-white transition-colors uppercase tracking-tight truncate max-w-[120px] sm:max-w-none">{h.account.label || h.account.id.slice(0, 24)}...</span>
                                                </Link>
                                            </td>
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-slate-400 font-mono text-[9px] sm:text-[10px]">
                                              {Number(h.vault?.curve_id) === LINEAR_CURVE_ID ? 'Linear' : Number(h.vault?.curve_id) === OFFSET_PROGRESSIVE_CURVE_ID ? 'Exponential' : '—'}
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
                                    <tr><td colSpan={5} className="p-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px]">NULL_POSITIONS_DETECTED</td></tr>)}
                            </tbody>
                        </table>
                    </div>)}
                {activeTab === 'IDENTITIES' && (
                    <div className="animate-in fade-in duration-700">
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.6em] mb-10 flex items-center gap-4"><Fingerprint size={16}/> Neural Identities Engaged</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{engagedIdentities.length > 0 ? engagedIdentities.map((peer, i) => (<Link key={i} to={`/markets/${peer.term_id}`} className="p-6 bg-white/[0.02] border-2 border-slate-900 hover:border-white/40 transition-all rounded-2xl group relative overflow-hidden backdrop-blur-sm"><div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div><div className="flex items-center justify-between gap-6 relative z-10"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-black border-2 border-slate-800 rounded-2xl overflow-hidden group-hover:border-white transition-all shadow-xl group-hover:shadow-glow-white">{peer.image ? <img src={peer.image} className="w-full h-full object-cover" /> : <User size={24} className="text-slate-700" />}</div><div className="min-w-0"><div className="text-sm font-black text-white group-hover:text-glow-white transition-colors uppercase truncate max-w-[140px] font-display tracking-tight leading-none mb-1.5">{peer.label}</div><div className="text-[8px] text-slate-600 uppercase font-black tracking-widest">{peer.predicate || 'REPUTATION_LINK'}</div></div></div><div className="flex flex-col items-end"><div className="text-[10px] font-black text-intuition-success animate-pulse text-glow-success">LIVE</div><span className="text-[8px] font-black text-slate-700 uppercase tracking-widest mt-1">L3_SYNC</span></div></div></Link>)) : (<div className="col-span-full py-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px] border border-dashed border-slate-900">NULL_IDENTITIES_SYNCED</div>)}</div>
                    </div>
                )}
                {activeTab === 'CLAIMS' && (
                    <div className="animate-in fade-in duration-700">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-8 h-8 rounded-lg bg-[#2D3A4B] flex items-center justify-center text-white font-black text-[10px] shrink-0">P</div>
                            <h4 className="text-base font-black text-white uppercase tracking-[0.4em]">Semantic Claim Ledger</h4>
                        </div>
                        <p className="text-[11px] text-slate-400 uppercase font-black tracking-widest mb-4">Claims involving this identity. Support or oppose each semantic relationship.</p>
                        <div className="overflow-x-auto bg-black border border-slate-800 rounded-xl">
                            <div className="divide-y divide-slate-800/60">
                            {claimsWithVaults.length > 0 ? claimsWithVaults.map((c) => {
                                const supportVal = safeWeiToEther(c.supportTotalAssets);
                                const opposeVal = safeWeiToEther(c.opposeTotalAssets);
                                const claimUrl = `/markets/${c.id}`;
                                const predicateLabel = (c.predicate?.label || 'LINK').replace(/_/g, ' ').toLowerCase();
                                return (
                                <div
                                    key={c.id}
                                    onClick={() => { navigate(claimUrl); playClick(); }}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-4 py-3 bg-black hover:bg-white/[0.02] transition-all group cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                        <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                            {c.subject?.image ? <img src={c.subject.image} alt="" className="w-full h-full object-cover" /> : <User size={16} className="text-slate-500" />}
                                        </div>
                                        <span className="text-sm font-bold text-white truncate">{c.subject?.label || 'Unknown'}</span>
                                        <span className="text-slate-500 text-xs shrink-0">{predicateLabel}</span>
                                        <span className="px-2.5 py-0.5 rounded-md bg-[#2D3A4B] text-white text-xs font-medium shrink-0">
                                            {c.object?.label || 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 sm:gap-6 shrink-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-1.5">
                                            <Users size={14} className="text-[#3498DB] shrink-0" />
                                            <span className="text-[12px] font-bold text-[#3498DB]">{formatLargeNumber(c.supportPositionCount)}</span>
                                            <span className="text-[12px] font-bold text-[#3498DB]">{formatMarketValue(supportVal)} TRUST</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Users size={14} className="text-[#F39C12] shrink-0" />
                                            <span className="text-[12px] font-bold text-[#F39C12]">{formatLargeNumber(c.opposePositionCount)}</span>
                                            <span className="text-[12px] font-bold text-[#F39C12]">{formatMarketValue(opposeVal)} TRUST</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Link to={claimUrl} onClick={playClick} className="px-4 py-2 bg-[#3498DB] text-white text-xs font-bold rounded-lg hover:bg-[#2980B9] transition-colors">
                                                Support
                                            </Link>
                                            <Link to={claimUrl} onClick={playClick} className="px-4 py-2 bg-[#F39C12] text-white text-xs font-bold rounded-lg hover:bg-[#E67E22] transition-colors">
                                                Oppose
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                                );
                            }) : (
                                <div className="py-16 text-center text-slate-500 uppercase font-black tracking-widest text-xs">
                                    NULL_CLAIMS_RECORDED
                                </div>
                            )}
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'LISTS' && (
                    <div className="animate-in fade-in duration-700">
                        <h4 className="text-sm font-black text-slate-200 uppercase tracking-[0.5em] mb-4 flex items-center gap-4"><ListIcon size={16}/> List Entries</h4>
                        <p className="text-[11px] text-slate-400 uppercase font-black tracking-widest mb-8">{showingListsContaining ? 'Lists containing this identity.' : 'Identities tagged with this list.'}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                            <div className="flex items-center gap-3 flex-1 max-w-md">
                                <div className="relative flex-1">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search list entries"
                                        value={listEntriesSearch}
                                        onChange={(e) => setListEntriesSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 bg-white/[0.02] border-2 border-slate-800 rounded-xl text-sm font-mono text-white placeholder:text-slate-500 focus:border-white/40 focus:outline-none transition-all"
                                    />
                                </div>
                                <div className="relative shrink-0">
                                    <select
                                        value={listSort}
                                        onChange={(e) => setListSort(e.target.value as 'label-asc' | 'label-desc')}
                                        className="appearance-none pl-4 pr-10 py-2.5 bg-white/[0.02] border-2 border-slate-800 rounded-xl text-sm font-mono text-white focus:border-white/40 focus:outline-none transition-all cursor-pointer"
                                    >
                                        <option value="label-asc" className="bg-black text-white">A-Z</option>
                                        <option value="label-desc" className="bg-black text-white">Z-A</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 uppercase font-black">List Entries: {filteredListEntries.length}</span>
                        </div>
                        <div className="overflow-x-auto ares-frame bg-white/[0.01] border-2 border-slate-900 rounded-2xl shadow-2xl backdrop-blur-sm">
                            <table className="w-full text-left font-mono text-[11px] sm:text-xs min-w-[500px]">
                                <thead className="bg-black border-b border-slate-800 text-slate-300 font-black uppercase tracking-[0.2em] sm:tracking-[0.3em]">
                                    <tr>
                                        <th className="px-3 sm:px-6 md:px-8 py-3 sm:py-5 w-12">#</th>
                                        <th className="px-3 sm:px-6 md:px-8 py-3 sm:py-5">Entry</th>
                                        <th className="px-3 sm:px-6 md:px-8 py-3 sm:py-5 text-right">Support</th>
                                        <th className="px-3 sm:px-6 md:px-8 py-3 sm:py-5 text-right">Oppose</th>
                                        <th className="px-3 sm:px-6 md:px-8 py-3 sm:py-5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredListEntries.length > 0 ? filteredListEntries.map((entry, i) => {
                                        const supportVal = safeWeiToEther(entry.supportTotalAssets);
                                        const opposeVal = safeWeiToEther(entry.opposeTotalAssets);
                                        const entryUrl = `/markets/${entry.id}`;
                                        return (
                                        <tr
                                            key={entry.tripleId ?? entry.id ?? i}
                                            onClick={() => { navigate(entryUrl); playClick(); }}
                                            className="hover:bg-white/5 transition-all group cursor-pointer"
                                        >
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-slate-400 font-black">{i + 1}</td>
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6">
                                                <Link to={entryUrl} onClick={(e) => e.stopPropagation()} className="flex items-center gap-4 group/entry">
                                                    <div className="w-10 h-10 bg-slate-900 border border-slate-800 flex items-center justify-center rounded-2xl overflow-hidden group-hover/entry:border-white/40 transition-colors shrink-0">
                                                        {entry.image ? <img src={entry.image} alt="" className="w-full h-full object-cover" /> : <User size={18} className="text-slate-400" />}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-white group-hover/entry:text-glow-white transition-colors uppercase truncate max-w-[200px] font-display tracking-tight">{entry.label || entry.id || 'Unknown'}</div>
                                                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{showingListsContaining ? 'contains this identity' : `has tag ${agent?.label || 'List'}`}</div>
                                                    </div>
                                                </Link>
                                            </td>
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-white font-black text-sm">{formatLargeNumber(entry.supportPositionCount ?? 0)}</span>
                                                    <span className="text-[11px] text-intuition-success uppercase font-black tracking-widest">{formatMarketValue(supportVal)} TRUST</span>
                                                </div>
                                            </td>
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-white font-black text-sm">{formatLargeNumber(entry.opposePositionCount ?? 0)}</span>
                                                    <span className="text-[11px] text-intuition-danger uppercase font-black tracking-widest">{formatMarketValue(opposeVal)} TRUST</span>
                                                </div>
                                            </td>
                                            <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-right" onClick={(e) => e.stopPropagation()}>
                                                <Link to={entryUrl} onClick={playClick} className="inline-flex items-center gap-2 px-3 py-1.5 bg-intuition-primary/20 border border-intuition-primary/40 hover:bg-intuition-primary/30 hover:border-intuition-primary transition-all rounded-xl text-[10px] font-black uppercase tracking-widest text-intuition-primary">
                                                    Support
                                                </Link>
                                                <Link to={entryUrl} onClick={playClick} className="inline-flex items-center gap-2 px-3 py-1.5 ml-2 bg-intuition-danger/20 border border-intuition-danger/40 hover:bg-intuition-danger/30 hover:border-intuition-danger transition-all rounded-xl text-[10px] font-black uppercase tracking-widest text-intuition-danger">
                                                    Oppose
                                                </Link>
                                            </td>
                                        </tr>
                                    );}) : (
                                        <tr><td colSpan={5} className="p-20 text-center text-slate-500 uppercase font-black tracking-widest text-xs">NULL_ENTRIES_DETECTED</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>)}
                {activeTab === 'ACTIVITY' && (
                    <div className="animate-in fade-in duration-700 overflow-x-auto ares-frame bg-white/[0.01] border-2 border-slate-900 rounded-2xl shadow-2xl backdrop-blur-sm">
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
                                        <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 font-mono text-slate-300 group-hover:text-white group-hover:text-glow-white transition-colors uppercase tracking-tighter">
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
                                        <td className="px-3 sm:px-6 md:px-8 py-4 sm:py-6 text-right font-mono text-slate-400 uppercase tracking-tighter whitespace-nowrap">
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
                                    <tr><td colSpan={5} className="p-20 text-center text-slate-600 font-medium text-sm">No activity yet</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {activeTab === 'CONNECTIONS' && (
                    <div className="animate-in fade-in duration-700">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8 mb-12 bg-white/[0.02] p-10 border-2 border-slate-900 rounded-2xl group hover:border-white/20 transition-all shadow-2xl backdrop-blur-md">
                          <div className="w-20 h-20 rounded-xl border-2 flex items-center justify-center bg-black shadow-2xl group-hover:scale-105 duration-500 shrink-0 mx-auto sm:mx-0" style={{ borderColor: theme.color, boxShadow: `0 0 30px ${theme.bgGlow}` }}><Activity size={40} className="animate-pulse" style={{ color: theme.color }} /></div>
                          <div className="min-w-0 text-center sm:text-left">
                            <h4 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight mb-2 text-glow-white">Connected markets</h4>
                            <p className="text-sm text-slate-500 font-medium group-hover:text-slate-400 transition-colors">Other markets linked through this graph.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{engagedIdentities.length > 0 ? engagedIdentities.map((peer, i) => (<Link key={i} to={`/markets/${peer.term_id}`} className="group p-8 bg-black border-2 border-slate-900 hover:border-white transition-all rounded-2xl flex items-center gap-8 relative overflow-hidden shadow-2xl"><div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div><div className="w-16 h-16 bg-slate-950 border-2 border-slate-800 flex items-center justify-center rounded-2xl shrink-0 group-hover:border-white transition-all shadow-2xl overflow-hidden">{peer.image ? <img src={peer.image} className="w-full h-full object-cover" /> : <User size={24} className="text-slate-700" />}</div><div className="min-w-0"><div className="text-lg font-black text-white group-hover:text-glow-white transition-colors truncate leading-none mb-2 tracking-tight">{peer.label}</div><div className="text-[8px] font-semibold text-slate-600 tracking-wide">Related market</div></div></Link>)) : (<div className="col-span-full py-32 text-center text-slate-600 font-medium text-sm border-2 border-dashed border-slate-900 rounded-2xl">No related markets yet</div>)}</div>
                    </div>
                )}
            </div>
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