import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Shield, ArrowLeft, ArrowRight, User, Star, Network, ArrowUpRight, Loader2, Terminal, Zap, Info, Share2, Fingerprint, ChevronRight, Clock, Users, Layers, ExternalLink, ChevronsRight, Search, List as ListIcon, Globe, Compass, MessageSquare, Link as LinkIcon, Box, Database, Plus, UserPlus, Share, Hash, Radio, ScanSearch, Target, Upload, Boxes, X, Download, Twitter, Copy } from 'lucide-react';
import { getAgentById, getAgentTriples, getMarketActivity, getHoldersForVault, getAtomInclusionLists, getIdentitiesEngaged, getUserPositions, getIncomingTriplesForStats } from '../services/graphql';
import { depositToVault, redeemFromVault, getConnectedAccount, getWalletBalance, getShareBalance, toggleWatchlist, isInWatchlist, parseProtocolError, checkProxyApproval, grantProxyApproval, saveLocalTransaction } from '../services/web3';
import { Account, Triple, Transaction } from '../types';
import { formatEther, parseEther } from 'viem';
import { toast } from '../components/Toast';
import TransactionModal from '../components/TransactionModal';
import CreateModal from '../components/CreateModal';
import { playClick, playSuccess, playHover } from '../services/audio';
import { AIBriefing } from '../components/AISuite';
import { calculateTrustScore as computeTrust, calculateAgentPrice, formatDisplayedShares, formatMarketValue, formatLargeNumber, calculateMarketCap } from '../services/analytics';
import { OFFSET_PROGRESSIVE_CURVE_ID, CURRENCY_SYMBOL, EXPLORER_URL } from '../constants';
import html2canvas from 'html2canvas';
import Logo from '../components/Logo';

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
                {Number(payload[0].value).toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-[10px] text-intuition-primary ml-1">{CURRENCY_SYMBOL}</span>
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

const AgentShareModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    agent: Account; 
    mktCap: number; 
    price: number; 
    holders: number; 
    tags: { label: string }[] 
}> = ({ isOpen, onClose, agent, mktCap, price, holders, tags }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    if (!isOpen) return null;
    const canonicalLink = `https://inturank.intuition.box/#/markets/${agent.id}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(canonicalLink);
        toast.success("SIGNAL_UPLINK_COPIED");
        playClick();
    };

    const handleShareX = () => {
        const text = `Inspecting ${agent.label} on IntuRank. Quantifying trust at ${computeTrust(agent.totalAssets || '0', agent.totalShares || '0').toFixed(1)}% conviction. 🚀\n\nJoin the reputation market:`;
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
                backgroundColor: '#020308',
                scale: 2,
                useCORS: true
            });
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `inturank-${agent.label.toLowerCase()}-signal.png`;
            link.click();
            toast.success("NEURAL_FRAME_DOWNLOADED");
        } catch (e) {
            toast.error("DOWNLOAD_FAILURE");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div className="w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div ref={cardRef} className="relative bg-[#050814] border-2 border-intuition-primary/40 p-12 clip-path-slant shadow-[0_0_120px_rgba(0,0,0,1)] overflow-hidden group/modal">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] opacity-10 pointer-events-none"></div>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,243,255,0.08),transparent_70%)]"></div>
                    
                    <div className="flex justify-between items-start mb-12 relative z-10">
                        <div className="flex-1 min-w-0 pr-6">
                            <div className="flex items-center gap-3 text-[10px] font-black font-mono text-intuition-primary uppercase tracking-[0.6em] mb-4 text-glow-blue">
                                <Activity size={14} className="animate-pulse" /> Neural_Signal_Packet
                            </div>
                            <h2 className="text-6xl font-black font-display text-white tracking-tighter uppercase text-glow-white leading-none truncate">
                                {agent.label}
                            </h2>
                        </div>
                        <div className="w-20 h-20 bg-black border-2 border-intuition-primary/30 flex items-center justify-center rounded-none clip-path-slant shadow-glow-blue shrink-0 group-hover/modal:border-intuition-primary transition-colors duration-700">
                            <Logo className="w-12 h-12 text-intuition-primary" />
                        </div>
                    </div>

                    <div className="mb-10 relative z-10">
                        <div className="text-[9px] font-black font-mono text-slate-500 uppercase tracking-widest mb-4">SEMANTIC_TAGS:</div>
                        <div className="flex flex-wrap gap-2">
                            {tags.slice(0, 5).map((tag, i) => (
                                <span key={i} className="px-4 py-1.5 bg-white/5 border border-white/10 text-[9px] font-black text-white uppercase tracking-wider rounded-full hover:border-intuition-primary transition-colors cursor-default">
                                    {tag.label}
                                </span>
                            ))}
                            {tags.length > 5 && <span className="px-4 py-1.5 bg-intuition-primary/10 border border-intuition-primary/20 text-[9px] font-black text-intuition-primary uppercase tracking-wider rounded-full">+{tags.length - 5} more</span>}
                        </div>
                    </div>

                    <div className="mb-12 relative z-10">
                        <div className="text-[9px] font-black font-mono text-slate-500 uppercase tracking-widest mb-4">DESCRIPTION_PAYLOAD:</div>
                        <div className="p-6 bg-black/60 border border-white/5 clip-path-slant relative group/desc">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-intuition-primary/30 group-hover/desc:bg-intuition-primary transition-colors"></div>
                            <p className="text-sm font-mono text-slate-300 leading-relaxed uppercase tracking-tight line-clamp-4 group-hover:text-white transition-colors">
                                {agent.description || "Establishing logical connectivity within the Intuition Trust Graph. Node identity verified and synchronized for global capital signaling."}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 relative z-10">
                        <div className="bg-black/40 border border-white/5 p-5 clip-path-slant group/stat hover:border-intuition-primary/40 transition-colors">
                            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 group-hover/stat:text-intuition-primary transition-colors">Mkt_Cap</div>
                            <div className="text-xl font-black text-white font-display tracking-tight leading-none group-hover/stat:text-glow-white">{formatMarketValue(mktCap)}</div>
                        </div>
                        <div className="bg-black/40 border border-white/5 p-5 clip-path-slant group/stat hover:border-intuition-primary/40 transition-colors">
                            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 group-hover/stat:text-intuition-primary transition-colors">Spot_Price</div>
                            <div className="text-xl font-black text-white font-display tracking-tight leading-none group-hover/stat:text-glow-white">{formatMarketValue(price)}</div>
                        </div>
                        <div className="bg-black/40 border border-white/5 p-5 clip-path-slant group/stat hover:border-intuition-success/40 transition-colors">
                            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 group-hover/stat:text-intuition-success transition-colors">Conviction</div>
                            <div className="text-xl font-black text-intuition-success font-display tracking-tight leading-none text-glow-success">{computeTrust(agent.totalAssets || '0', agent.totalShares || '0').toFixed(1)}%</div>
                        </div>
                        <div className="bg-black/40 border border-white/5 p-5 clip-path-slant group/stat hover:border-intuition-primary/40 transition-colors">
                            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-2 group-hover/stat:text-intuition-primary transition-colors">Holders</div>
                            <div className="text-xl font-black text-white font-display tracking-tight leading-none group-hover/stat:text-glow-white">{formatLargeNumber(holders)}</div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-8 border-t border-white/10 opacity-60 relative z-10 font-mono">
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.5em]">CERTIFIED_BY_INTURANK_PROTOCOL // V.1.3.0</div>
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{new Date().toLocaleDateString()} // NEURAL_SYNC_S04</div>
                    </div>
                </div>

                <div className="mt-10 flex flex-col md:flex-row gap-4">
                    <button onClick={handleShareX} className="flex-1 py-5 bg-white/5 border-2 border-white/10 text-white hover:bg-white hover:text-black font-black uppercase text-[10px] tracking-[0.3em] clip-path-slant transition-all flex items-center justify-center gap-3 active:scale-95 hover:shadow-2xl">
                        <Twitter size={16} /> Share_on_X
                    </button>
                    <button onClick={handleCopyLink} className="flex-1 py-5 bg-white/5 border-2 border-white/10 text-white hover:bg-white hover:text-black font-black uppercase text-[10px] tracking-[0.3em] clip-path-slant transition-all flex items-center justify-center gap-3 active:scale-95 hover:shadow-2xl">
                        <Copy size={16} /> Copy_Uplink
                    </button>
                    <button onClick={handleDownload} disabled={isDownloading} className="flex-1 py-5 bg-intuition-primary text-black font-black uppercase text-[10px] tracking-[0.3em] clip-path-slant transition-all flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(0,243,255,0.5)] hover:bg-white hover:shadow-[0_0_50px_rgba(255,255,255,0.7)] active:scale-95">
                        {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
                        Download_Frame
                    </button>
                </div>
                
                <div className="mt-8 text-center">
                    <button onClick={onClose} className="text-[9px] font-black font-mono text-slate-600 hover:text-intuition-danger uppercase tracking-[0.8em] transition-colors">TERMINATE_SESSION</button>
                </div>
            </div>
        </div>
    );
};

const MarketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Account | null>(null);
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
  const [shareBalance, setShareBalance] = useState('0.00');
  const [isApproved, setIsApproved] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [txModal, setTxModal] = useState<any>({ isOpen: false, status: 'idle', title: '', message: '', details: null });
  const [hoverData, setHoverData] = useState<any>(null);

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
          const [agentData, triplesData, activityData, holderResult, listData, engagedData, incomingResult] = await Promise.all([
              getAgentById(id),
              getAgentTriples(id),
              getMarketActivity(id),
              getHoldersForVault(id),
              getAtomInclusionLists(id),
              getIdentitiesEngaged(id),
              getIncomingTriplesForStats(id)
          ]);

          setAgent(agentData);
          setTriples(triplesData || []);
          setActivityLog(activityData || []);
          setHolders(holderResult.holders || []);
          setTotalHoldersCount(holderResult.totalCount);
          setLists(listData || []);
          setEngagedIdentities(engagedData || []);
          setFollowersCount(incomingResult.totalCount);
          setChartData(generateAnchoredHistory(agentData.totalAssets || '0', agentData.totalShares || '0', agentData.currentSharePrice, timeframe));
          
          if (acc) {
            setWalletBalance(await getWalletBalance(acc));
            const sharesRaw = await getShareBalance(acc, id, OFFSET_PROGRESSIVE_CURVE_ID);
            setShareBalance(sharesRaw);
          }

          if (agentData.type === 'ACCOUNT' || id.startsWith('0x')) {
              const following = await getUserPositions(id);
              setFollowingPositions(following || []);
          }
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
      if (agent) {
          setChartData(generateAnchoredHistory(agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice, timeframe));
      }
  }, [timeframe, agent]);

  const handleExecute = async () => {
      if (!wallet) return;
      if (action === 'ACQUIRE' && !isApproved) {
          setTxModal({ isOpen: true, status: 'processing', title: 'PERMISSION_HANDSHAKE', message: 'Authorizing protocol uplink...' });
          try { await grantProxyApproval(wallet); setIsApproved(true); setTxModal({ isOpen: false }); } 
          catch (e) { setTxModal({ isOpen: true, status: 'error', title: 'AUTH_FAILED', message: parseProtocolError(e) }); }
          return;
      }
      if (!inputAmount || parseFloat(inputAmount) <= 0) return;
      setTxModal({ isOpen: true, status: 'processing', title: 'SIGNAL_COMMIT', message: 'Transmitting packet to mainnet...' });
      try {
          let res: any;
          if (action === 'ACQUIRE') res = await depositToVault(inputAmount, id!, wallet);
          else res = await redeemFromVault(inputAmount, id!, wallet);
          playSuccess();
          saveLocalTransaction({ id: res.hash, type: action === 'ACQUIRE' ? 'DEPOSIT' : 'REDEEM', assets: action === 'ACQUIRE' ? parseEther(inputAmount).toString() : res.assets.toString(), shares: action === 'ACQUIRE' ? res.shares.toString() : parseEther(inputAmount).toString(), timestamp: Date.now(), vaultId: id!, assetLabel: agent?.label }, wallet);
          setTxModal({ isOpen: true, status: 'success', title: 'SIGNAL_LOCKED', message: 'Transaction verified on-chain.', hash: res.hash });
          setInputAmount('');
          setTimeout(() => fetchData(), 3000);
      } catch (e) { setTxModal({ isOpen: true, status: 'error', title: 'UPLINK_LOST', message: parseProtocolError(e) }); }
  };

  const handleMax = () => {
      playClick();
      if (action === 'ACQUIRE') setInputAmount(walletBalance);
      else setInputAmount(shareBalance);
  };

  if (loading || !agent) return <div className="min-h-screen flex items-center justify-center text-intuition-primary font-mono animate-pulse uppercase tracking-[0.5em] bg-black">Syncing_Signal...</div>;

  const currentSpotPrice = calculateAgentPrice(agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice);
  const currentStrength = computeTrust(agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice);
  const mktCapVal = calculateMarketCap(agent.totalAssets || '0', agent.totalShares || '0', agent.currentSharePrice);
  const displayPrice = hoverData ? hoverData.price : currentSpotPrice;

  const tags = Array.from(new Map<string, { label: string; count: number }>(
    triples
        .filter(t => t.subject?.term_id === agent.id)
        .map(t => [t.object.term_id, { label: t.object.label, count: Math.floor(Math.random() * 2000) + 1 }])
  ).values());

  return (
    <div className="w-full px-4 lg:px-10 pt-6 pb-32 font-mono text-[#e2e8f0] bg-[#020308]">
        <TransactionModal isOpen={txModal.isOpen} status={txModal.status} title={txModal.title} message={txModal.message} hash={txModal.hash} onClose={() => setTxModal(p => ({ ...p, isOpen: false }))} />
        <CreateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
        <AgentShareModal 
            isOpen={isShareModalOpen} 
            onClose={() => setIsShareModalOpen(false)} 
            agent={agent} 
            mktCap={mktCapVal} 
            price={currentSpotPrice} 
            holders={totalHoldersCount} 
            tags={tags} 
        />
        
        <div className="flex flex-wrap items-center gap-3 mb-10 overflow-x-auto pb-2 no-scrollbar">
            {tags.slice(0, 6).map((tag, idx) => (
                <div key={idx} className="flex items-center gap-2.5 px-5 py-2.5 bg-white/5 border border-white/10 rounded-full hover:border-intuition-primary/60 transition-all group cursor-default hover:shadow-glow-blue">
                    <span className="text-[10px] font-black text-white uppercase tracking-tight">{tag.label}</span>
                    <span className="text-[10px] text-slate-700 font-mono">•</span>
                    <div className="flex items-center gap-2">
                        <Users size={11} className="text-slate-600" />
                        <span className="text-[10px] font-mono text-slate-500">{formatLargeNumber(tag.count)}</span>
                    </div>
                </div>
            ))}
        </div>

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
                  <a 
                    href={`${EXPLORER_URL}/address/${agent.creator.id}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={playClick}
                    onMouseEnter={playHover}
                    className="flex items-center gap-2.5 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full hover:border-intuition-primary/40 transition-all cursor-pointer group/creator"
                  >
                      <div className="w-5 h-5 rounded-full bg-slate-900 border border-white/20 overflow-hidden shrink-0 shadow-glow-blue">
                          <img src={`https://effigy.im/a/${agent.creator.id}.png`} className="w-full h-full object-cover" alt="" />
                      </div>
                      <span className="text-[10px] font-black text-white group-hover/creator:text-intuition-primary transition-colors">{agent.creator?.label || agent.creator?.id?.slice(0, 14)}</span>
                      <ExternalLink size={10} className="text-slate-600 group-hover/creator:text-intuition-primary" />
                  </a>
                ) : (
                  <div className="flex items-center gap-2.5 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-slate-500">
                    <User size={10} />
                    <span className="text-[10px] font-black uppercase">Anonymous</span>
                  </div>
                )}
            </div>
            <div className="hidden lg:block w-[1px] h-4 bg-white/10"></div>
            <div className="flex items-center gap-5 lg:ml-auto">
                <button 
                    onClick={() => { playClick(); setIsShareModalOpen(true); }}
                    onMouseEnter={playHover}
                    className="w-11 h-11 flex items-center justify-center bg-black border border-white/10 hover:border-intuition-primary hover:text-intuition-primary transition-all rounded-full group shadow-2xl hover:shadow-glow-blue"
                    title="SHARE_NODE_SIGNAL"
                >
                    <Share2 size={20} className="group-hover:scale-110 transition-transform" />
                </button>
                <a 
                    href={`${EXPLORER_URL}/address/${agent.id}`} 
                    target="_blank" 
                    rel="noreferrer"
                    onMouseEnter={playHover}
                    className="w-11 h-11 flex items-center justify-center bg-black border border-white/10 hover:border-intuition-primary hover:text-intuition-primary transition-all rounded-full group shadow-2xl hover:shadow-glow-blue"
                    title="INITIALIZE_NODE_RECON"
                >
                    <ScanSearch size={20} className="group-hover:scale-110 transition-transform" />
                </a>
            </div>
        </div>

        <div className="bg-[#02040a] border-2 border-slate-900 clip-path-slant p-8 mb-8 flex flex-col md:flex-row items-center justify-between relative overflow-hidden shadow-2xl group/header hover:border-intuition-primary/20 transition-colors">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10"></div>
            <div className="flex items-center gap-10 relative z-10">
                <div className="relative">
                    <div className="absolute -inset-4 bg-intuition-primary/10 blur-2xl opacity-0 group-hover/header:opacity-100 transition-opacity duration-1000"></div>
                    <div className="w-28 h-28 bg-slate-950 border-2 border-intuition-primary/30 flex items-center justify-center overflow-hidden clip-path-slant shadow-[0_0_30px_rgba(0,243,255,0.2)] group-hover/header:border-intuition-primary transition-all duration-700">
                        {agent.image ? <img src={agent.image} alt={agent.label} className="w-full h-full object-cover group-hover/header:scale-110 transition-transform duration-1000" /> : <User size={52} className="text-slate-800" />}
                    </div>
                </div>
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-2 h-2 rounded-full bg-intuition-success animate-pulse shadow-[0_0_10px_#00ff9d]"></div>
                        <span className="text-[10px] font-black text-intuition-primary uppercase tracking-[0.5em] text-glow-blue">Neural_Node_Locked</span>
                    </div>
                    <h1 className="text-6xl font-black text-white font-display uppercase tracking-tighter text-glow-white leading-none mb-4">{agent.label}</h1>
                    <div className="flex items-center gap-5 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <Hash size={13} className="text-slate-700" />
                            <span>NODE_ID: <span className="text-slate-500 font-mono">{agent.id.slice(0, 18)}...</span></span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                        <span className="px-2.5 py-1 bg-intuition-primary/10 border border-intuition-primary/20 text-intuition-primary font-black text-[8px] tracking-[0.2em] text-glow-blue">LINEAR_CURVE_UTILITY</span>
                    </div>
                </div>
            </div>
            
            <div className="mt-10 md:mt-0 flex flex-col items-end gap-3 relative z-10 text-right">
                <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">Network_Conviction_Score</div>
                <div className="flex items-end gap-8 mb-2">
                    <div className="flex flex-col items-center group/prob">
                         <div className="text-4xl font-black text-intuition-success text-glow-success transition-all group-hover/prob:scale-110">{currentStrength.toFixed(1)}%</div>
                         <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">TRUST</div>
                    </div>
                    <div className="flex flex-col items-center group/prob">
                         <div className="text-4xl font-black text-intuition-danger text-glow-red transition-all group-hover/prob:scale-110">{(100-currentStrength).toFixed(1)}%</div>
                         <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">SKEPTICISM</div>
                    </div>
                </div>
                <div className="text-sm font-black text-slate-700 font-mono uppercase tracking-[0.4em]">Convergence_L3_Confirmed</div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start mb-16">
            <div className="lg:col-span-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-black border border-intuition-primary/20 p-8 clip-path-slant relative overflow-hidden group shadow-2xl h-full flex flex-col justify-center hover:border-intuition-primary/40 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-125 transition-transform duration-1000"><Shield size={100} /></div>
                        <div className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] mb-8 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-intuition-primary animate-pulse shadow-[0_0_122x_#00f3ff]"></div> REPUTATION CLASS
                        </div>
                        <div className="text-5xl font-black font-display text-white text-glow-white mb-2 leading-none uppercase tracking-tighter">
                            {currentStrength >= 90 ? 'SOVEREIGN' : currentStrength >= 75 ? 'AUTHENTIC' : currentStrength >= 60 ? 'RELIABLE' : currentStrength >= 45 ? 'CREDIBLE' : 'EMERGING'}
                        </div>
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">NEURAL_CONVERGENCE: <span className="text-intuition-primary text-glow-blue">{currentStrength.toFixed(1)}%</span></div>
                    </div>
                    <div className="md:col-span-2">
                        <AIBriefing agent={agent} triples={triples} history={activityLog} />
                    </div>
                </div>

                <div className="bg-black border border-slate-900 flex flex-col clip-path-slant relative overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)] h-[650px] group/chart">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
                    <div className="p-10 flex flex-col md:flex-row justify-between items-end bg-[#02040a]/80 backdrop-blur-md relative z-20 border-b border-white/5 gap-8">
                        <div>
                            <div className="flex items-baseline gap-3 mb-2">
                                <div className="text-7xl font-black text-white font-display tracking-tighter leading-none group-hover/chart:text-glow-white transition-all duration-700">{formatMarketValue(displayPrice)}</div>
                                <div className="text-[14px] text-slate-500 font-mono tracking-widest uppercase font-black">{CURRENCY_SYMBOL} / PORTAL_SHARE</div>
                            </div>
                            <div className="flex items-center gap-3 text-[9px] font-black text-intuition-primary uppercase tracking-[0.4em] mt-3 text-glow-blue">
                                <Activity size={12} className="animate-pulse shadow-[0_0_15px_#00f3ff]" /> SIGNAL_TELEMETRY_LIVE
                            </div>
                        </div>
                        <div className="flex gap-12 font-black text-right pb-1">
                             <div className="flex flex-col items-end group/item">
                                <span className="text-[9px] text-slate-600 uppercase tracking-widest mb-2 group-hover/item:text-white transition-colors">24H_VOLATILITY</span>
                                <span className="text-2xl text-white font-display tracking-tight text-glow-white">0.82%</span>
                             </div>
                             <div className="flex flex-col items-end group/item">
                                <span className="text-[9px] text-slate-600 uppercase tracking-widest mb-2 group-hover/item:text-white transition-colors">LINEAR_MARKET_RATE</span>
                                <span className="text-2xl text-intuition-primary font-display tracking-tight shadow-glow-blue uppercase text-glow-blue">STABLE</span>
                             </div>
                        </div>
                    </div>
                    <div className="px-10 py-4 bg-white/5 border-b border-white/5 flex items-center justify-between z-20">
                        <div className="flex gap-2">
                            {(['15M', '30M', '1H', '4H', '1D', '1W', '1M', '1Y', 'ALL'] as Timeframe[]).map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => { playClick(); setTimeframe(tf); }}
                                    className={`px-4 py-2 text-[10px] font-black font-mono transition-all clip-path-slant uppercase tracking-widest ${timeframe === tf ? 'bg-intuition-primary text-black shadow-[0_0_20px_#00f3ff]' : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 w-full relative z-10 p-4 pt-10 bg-[radial-gradient(circle_at_50%_-20%,_rgba(0,243,255,0.1),_transparent_70%)]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart 
                                data={chartData} 
                                onMouseMove={(e: any) => { if (e?.activePayload) setHoverData(e.activePayload[0].payload); }} 
                                onMouseLeave={() => setHoverData(null)}
                                margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 6" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="timestamp" hide />
                                <YAxis orientation="right" domain={['auto', 'auto']} tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={80} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#00f3ff', strokeWidth: 1 }} />
                                <ReferenceLine y={currentSpotPrice} stroke="#00f3ff20" strokeDasharray="3 3" />
                                <Area type="monotone" dataKey="price" stroke="#00f3ff" strokeWidth={4} fill="url(#priceGrad)" isAnimationActive={true} animationDuration={1500} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
                <div className="bg-black border border-slate-900 p-8 clip-path-slant shadow-2xl relative overflow-hidden group hover:border-intuition-primary/20 transition-colors">
                    <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">CIRCULATING_SHARES</h4>
                        <span className="text-[11px] font-black text-intuition-primary text-glow-blue">{formatDisplayedShares(agent.totalShares || '0')} UNITS</span>
                    </div>
                    <div className="flex gap-2.5 h-4 px-1">
                        {[...Array(12)].map((_, i) => {
                            const assetsVal = parseFloat(formatEther(BigInt(agent.totalAssets || '0')));
                            const fill = Math.min(12, Math.floor(assetsVal / 8));
                            return <div key={i} className={`flex-1 clip-path-slant transition-all duration-1000 ${i < fill ? 'bg-intuition-primary shadow-[0_0_15px_#00f3ff]' : 'bg-slate-900 opacity-20'}`}></div>;
                        })}
                    </div>
                    <div className="mt-4 text-[7px] text-slate-700 font-mono uppercase text-center tracking-[0.3em] opacity-60">Linear_Curve_Handshake_Active</div>
                </div>

                {/* --- UPDATED EXECUTION DECK --- */}
                <div className={`bg-black border-2 p-1 clip-path-slant shadow-[0_0_60px_rgba(0,0,0,0.6)] group transition-all duration-500 ${action === 'ACQUIRE' ? 'border-intuition-primary/30 hover:border-intuition-primary' : 'border-intuition-secondary/30 hover:border-intuition-secondary'}`}>
                    <div className="bg-[#050505] p-8 border border-white/5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
                        <div className="flex justify-between items-center mb-10">
                            <h2 className={`font-black font-display text-[11px] uppercase tracking-[0.6em] ${action === 'ACQUIRE' ? 'text-intuition-primary text-glow-blue' : 'text-intuition-secondary text-glow-red'}`}>EXECUTION DECK</h2>
                            <div className={`w-2 h-2 rounded-full animate-ping ${action === 'ACQUIRE' ? 'bg-intuition-primary shadow-[0_0_12px_#00f3ff]' : 'bg-intuition-secondary shadow-[0_0_12px_#ff1e6d]'}`}></div>
                        </div>

                        {/* ACQUIRE / LIQUIDATE TABS */}
                        <div className="flex gap-1.5 mb-10">
                            <button onClick={() => { setAction('ACQUIRE'); playClick(); }} className={`flex-1 py-4 text-[10px] font-black clip-path-slant transition-all uppercase tracking-[0.3em] border-2 shadow-lg ${action === 'ACQUIRE' ? 'bg-intuition-primary text-black border-intuition-primary shadow-[0_0_25px_rgba(0,243,255,0.4)]' : 'border-slate-800 text-slate-600 hover:text-white hover:border-slate-700'}`}>ACQUIRE</button>
                            <button onClick={() => { setAction('LIQUIDATE'); playClick(); }} className={`flex-1 py-4 text-[10px] font-black clip-path-slant transition-all uppercase tracking-[0.3em] border-2 shadow-lg ${action === 'LIQUIDATE' ? 'bg-intuition-secondary text-white border-intuition-secondary shadow-[0_0_25px_rgba(255,30,109,0.3)]' : 'border-slate-800 text-slate-600 hover:text-white hover:border-slate-700'}`}>LIQUIDATE</button>
                        </div>

                        {/* TRUST / DISTRUST SELECTOR */}
                        <div className="mb-10">
                            <div className="flex justify-between items-end mb-4 px-1">
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">TARGET_POSITION</span>
                                <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest">MAG_{currentStrength.toFixed(1)}%</span>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => { setSentiment('TRUST'); playClick(); }}
                                    className={`flex-1 p-4 border clip-path-slant text-left transition-all ${sentiment === 'TRUST' ? 'bg-intuition-success/10 border-intuition-success shadow-[0_0_15px_rgba(0,255,157,0.1)]' : 'border-slate-900 bg-black opacity-30 hover:opacity-100'}`}
                                >
                                    <div className={`font-black font-display text-sm tracking-tighter leading-none mb-1.5 ${sentiment === 'TRUST' ? 'text-intuition-success text-glow-success' : 'text-slate-600'}`}>TRUST</div>
                                    <div className="text-[8px] font-mono text-slate-600 uppercase tracking-widest font-black">SUPPORTIVE</div>
                                </button>
                                <button 
                                    onClick={() => { setSentiment('DISTRUST'); playClick(); }}
                                    className={`flex-1 p-4 border clip-path-slant text-left transition-all ${sentiment === 'DISTRUST' ? 'bg-intuition-danger/10 border-intuition-danger shadow-[0_0_15px_rgba(255,30,109,0.1)]' : 'border-slate-900 bg-black opacity-30 hover:opacity-100'}`}
                                >
                                    <div className={`font-black font-display text-sm tracking-tighter leading-none mb-1.5 ${sentiment === 'DISTRUST' ? 'text-intuition-danger text-glow-red' : 'text-slate-600'}`}>DISTRUST</div>
                                    <div className="text-[8px] font-mono text-slate-600 uppercase tracking-widest font-black">SKEPTICAL</div>
                                </button>
                            </div>
                        </div>

                        {/* VOLUME INPUT */}
                        <div className="mb-8">
                             <div className="flex justify-between items-center mb-4 px-1">
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{action === 'ACQUIRE' ? 'TRANSMISSION_VOLUME' : 'VOLUME_LIQUIDATE'}</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-black text-slate-500 font-mono flex items-center gap-2">
                                        BAL: <span className="text-white text-glow-white">{action === 'ACQUIRE' ? parseFloat(walletBalance).toFixed(4) : shareBalance}</span>
                                    </span>
                                    <button 
                                        onClick={handleMax}
                                        className={`px-3 py-0.5 bg-white/5 border border-white/10 hover:border-white hover:text-white text-slate-600 text-[8px] font-black uppercase clip-path-slant transition-all shadow-inner`}
                                    >
                                        MAX
                                    </button>
                                </div>
                             </div>
                            <div className={`relative group/input border-2 p-1 clip-path-slant transition-all duration-300 ${action === 'ACQUIRE' ? 'border-slate-900 group-focus-within:border-intuition-primary/40' : 'border-slate-900 group-focus-within:border-intuition-secondary/40'}`}>
                                <input type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} className="w-full bg-[#080808] border-none p-5 text-right text-white font-black font-mono text-3xl focus:outline-none transition-all shadow-inner" placeholder="0.00" />
                                <div className={`absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase pointer-events-none z-20 transition-all ${action === 'ACQUIRE' ? 'text-slate-700 group-focus-within/input:text-intuition-primary' : 'text-slate-700 group-focus-within/input:text-intuition-secondary'}`}>{action === 'ACQUIRE' ? CURRENCY_SYMBOL : 'TRUST'}</div>
                            </div>
                        </div>

                        {/* COMMIT BUTTON */}
                        <button onClick={handleExecute} className={`w-full py-6 font-black text-sm tracking-[0.5em] clip-path-slant shadow-2xl transition-all uppercase active:scale-95 border-2 ${action === 'ACQUIRE' ? 'bg-white text-black border-white hover:bg-black hover:text-white hover:shadow-glow-blue' : 'bg-[#1a080d] text-intuition-secondary border-intuition-secondary hover:bg-intuition-secondary hover:text-white hover:shadow-glow-red'}`}>
                            {!isApproved && action === 'ACQUIRE' ? 'ENABLE_PROTOCOL' : action === 'ACQUIRE' ? 'COMMIT_SIGNAL' : 'EXIT_POSITION'}
                        </button>
                        <p className="mt-6 text-[8px] text-slate-700 font-mono uppercase text-center tracking-[0.2em] opacity-60">Handshake Required for Mainnet Ingress</p>
                    </div>
                </div>
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
                    <button 
                        key={t.id}
                        onClick={() => { playClick(); setActiveTab(t.id as DetailTab); }} 
                        className={`flex-1 min-w-[150px] px-6 py-6 text-[10px] font-black tracking-[0.4em] uppercase flex items-center justify-center gap-3 transition-all relative border-r border-slate-900/50 ${activeTab === t.id ? 'text-intuition-primary bg-intuition-primary/5 text-glow-blue' : 'text-slate-600 hover:text-white hover:bg-white/5'}`}
                    >
                        <t.icon size={16} className={activeTab === t.id ? 'animate-pulse shadow-glow-blue' : ''} /> {t.label}
                        {activeTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-intuition-primary shadow-[0_0_20px_#00f3ff]"></div>}
                    </button>
                ))}
            </div>
            
            <div className="p-10">
                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-20 animate-in fade-in duration-700">
                        <div className="space-y-12">
                            <div>
                                <h4 className="text-[11px] font-black text-intuition-primary uppercase tracking-[0.6em] mb-6 flex items-center gap-3 text-glow-blue">
                                    <Terminal size={14}/> Core_Alignment_Matrix
                                </h4>
                                <p className="text-slate-400 text-base leading-relaxed font-mono font-bold uppercase tracking-tight group-hover:text-white transition-colors">
                                    Node <strong className="text-white text-glow-white">{agent.label}</strong> stabilized in Sector_04. Semantic weight currently projected at {triples.length} unique synapses. Linear Curve Utility (ID: 1) engaged.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-white/5 border border-white/10 clip-path-slant group hover:border-intuition-primary/40 transition-all hover:shadow-glow-blue">
                                    <div className="text-[9px] text-slate-600 uppercase mb-2 font-black tracking-widest group-hover:text-white">TOTAL MKT CAP</div>
                                    <div className="text-2xl font-black text-white font-display tracking-tight group-hover:text-glow-white">{formatMarketValue(mktCapVal)} {CURRENCY_SYMBOL}</div>
                                </div>
                                <div className="p-6 bg-white/5 border border-white/10 clip-path-slant group hover:border-intuition-secondary/40 transition-all hover:shadow-glow-red">
                                    <div className="text-[9px] text-slate-600 uppercase mb-2 font-black tracking-widest group-hover:text-white">TOTAL_SHARES</div>
                                    <div className="text-2xl font-black text-white font-display tracking-tight group-hover:text-glow-white">{formatLargeNumber(formatDisplayedShares(agent.totalShares || '0'))}</div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h4 className="text-[11px] font-black text-white uppercase tracking-[0.6em] mb-6 text-glow-white">Protocol_Parameters</h4>
                            <div className="p-8 border border-white/5 bg-white/5 clip-path-slant font-mono text-xs space-y-5">
                                <div className="flex justify-between items-center group">
                                    <span className="text-slate-600 uppercase font-black tracking-widest group-hover:text-white transition-colors">Bonding_Curve</span>
                                    <span className="text-intuition-primary font-bold text-glow-blue">Linear_Utility_1</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-slate-600 uppercase font-black tracking-widest group-hover:text-white transition-colors">Creator</span>
                                    <span className="text-white font-bold group-hover:text-glow-white">{agent.creator?.label || agent.creator?.id?.slice(0, 18) || 'Null_Origin'}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-slate-600 uppercase font-black tracking-widest group-hover:text-white transition-colors">Last_Interaction</span>
                                    <span className="text-white font-bold group-hover:text-glow-white">{activityLog[0] ? new Date(activityLog[0].timestamp).toLocaleDateString() : 'Syncing...'}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-slate-600 uppercase font-black tracking-widest group-hover:text-white transition-colors">Protocol_Tier</span>
                                    <span className="px-3 py-0.5 bg-intuition-primary text-black font-black uppercase text-[10px] shadow-glow-blue">
                                        {currentStrength >= 90 ? 'SOVEREIGN' : currentStrength >= 75 ? 'AUTHENTIC' : currentStrength >= 60 ? 'RELIABLE' : currentStrength >= 45 ? 'CREDIBLE' : 'EMERGING'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'POSITIONS' && (
                    <div className="w-full animate-in slide-in-from-bottom-4 duration-700">
                        <table className="w-full text-left font-mono text-[11px]">
                            <thead className="text-slate-700 uppercase font-black tracking-[0.3em] border-b border-slate-900 bg-[#080808]">
                                <tr>
                                    <th className="px-8 py-6">RANK</th>
                                    <th className="px-8 py-6">ACCOUNT</th>
                                    <th className="px-8 py-6">CONVICTION</th>
                                    <th className="px-8 py-6 text-right">SHARES</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {holders.length > 0 ? holders.map((h, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-all group">
                                        <td className="px-8 py-6 text-slate-600 font-black">#{(i + 1).toString().padStart(2, '0')}</td>
                                        <td className="px-8 py-6">
                                            <Link to={`/profile/${h.account.id}`} className="flex items-center gap-4 group-hover:text-intuition-primary transition-colors">
                                                <div className="w-8 h-8 rounded-none clip-path-slant bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden group-hover:border-intuition-primary transition-all group-hover:shadow-glow-blue">
                                                    {h.account.image ? <img src={h.account.image} className="w-full h-full object-cover" /> : <User size={14} className="text-slate-700" />}
                                                </div>
                                                <span className="font-black text-white group-hover:text-intuition-primary group-hover:text-glow-blue transition-colors uppercase tracking-tight">{h.account.label || h.account.id.slice(0, 24)}...</span>
                                            </Link>
                                        </td>
                                        <td className="px-8 py-6"><span className="px-3 py-1 bg-white/5 border border-white/10 rounded-sm font-black text-slate-400 uppercase tracking-tighter group-hover:text-white transition-colors">High_Conviction</span></td>
                                        <td className="px-8 py-6 text-right text-white font-black text-lg font-display tracking-tight group-hover:text-glow-white">{formatDisplayedShares(h.shares)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="p-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px]">NULL_POSITIONS_DETECTED</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {activeTab === 'IDENTITIES' && (
                    <div className="animate-in fade-in duration-700">
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.6em] mb-10 flex items-center gap-4"><Fingerprint size={16}/> Neural Identities Engaged</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {engagedIdentities.length > 0 ? engagedIdentities.map((peer, i) => (
                                <Link key={i} to={`/markets/${peer.term_id}`} className="p-6 bg-[#05080f] border-2 border-slate-900 hover:border-intuition-primary transition-all clip-path-slant group relative overflow-hidden hover:shadow-glow-blue">
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="flex items-center justify-between gap-6 relative z-10">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-black border-2 border-slate-800 clip-path-slant overflow-hidden group-hover:border-intuition-primary transition-all shadow-xl group-hover:shadow-glow-blue">
                                                {peer.image ? <img src={peer.image} className="w-full h-full object-cover" /> : <User size={24} className="text-slate-700" />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-black text-white group-hover:text-intuition-primary group-hover:text-glow-blue transition-colors uppercase truncate max-w-[140px] font-display tracking-tight leading-none mb-1.5">{peer.label}</div>
                                                <div className="text-[8px] text-slate-600 uppercase font-black tracking-widest">{peer.predicate || 'REPUTATION_LINK'}</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="text-[10px] font-black text-intuition-success animate-pulse text-glow-success">LIVE</div>
                                            <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest mt-1">L3_SYNC</span>
                                        </div>
                                    </div>
                                </Link>
                            )) : (
                                <div className="col-span-full py-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px] border border-dashed border-slate-900">NULL_IDENTITIES_SYNCED</div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'CLAIMS' && (
                    <div className="animate-in fade-in duration-700">
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.6em] mb-10 flex items-center gap-4"><MessageSquare size={16}/> Semantic Claim Ledger</h4>
                        <div className="space-y-4">
                            {triples.length > 0 ? triples.map((t, i) => (
                                <div key={i} className="p-6 bg-[#05080f] border-2 border-slate-900 hover:border-intuition-primary transition-all clip-path-slant flex flex-col md:flex-row items-center justify-between gap-6 group hover:shadow-glow-blue">
                                    <div className="flex items-center gap-6 flex-1 min-w-0">
                                        <div className="flex items-center flex-col">
                                            <div className="w-10 h-10 bg-slate-900 border border-slate-800 flex items-center justify-center clip-path-slant mb-2 overflow-hidden group-hover:border-intuition-primary/40 transition-colors">
                                                {t.subject?.image ? <img src={t.subject.image} className="w-full h-full object-cover" /> : <User size={18} className="text-slate-600" />}
                                            </div>
                                            <span className="text-[8px] text-slate-500 uppercase font-black truncate max-w-[80px] group-hover:text-white transition-colors">{t.subject?.label}</span>
                                        </div>
                                        <ArrowUpRight size={14} className="text-slate-700 group-hover:text-intuition-primary transition-colors animate-pulse" />
                                        <div className="px-4 py-1.5 bg-intuition-primary/5 border border-intuition-primary/20 text-intuition-primary font-black text-[9px] uppercase tracking-widest clip-path-slant text-glow-blue group-hover:bg-intuition-primary/10">
                                            {t.predicate?.label}
                                        </div>
                                        <ArrowUpRight size={14} className="text-slate-700 group-hover:text-intuition-primary transition-colors animate-pulse" />
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 bg-slate-900 border border-slate-800 flex items-center justify-center clip-path-slant mb-2 overflow-hidden group-hover:border-intuition-primary/40 transition-colors">
                                                {t.object?.image ? <img src={t.object.image} className="w-full h-full object-cover" /> : <User size={18} className="text-slate-600" />}
                                            </div>
                                            <span className="text-[8px] text-slate-500 uppercase font-black truncate max-w-[80px] group-hover:text-white transition-colors">{t.object?.label}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[8px] text-slate-600 uppercase font-black mb-1">Packet_Origin</div>
                                        <div className="text-[10px] text-white font-mono group-hover:text-glow-white transition-all">{t.transaction_hash?.slice(0, 14)}...</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px] border border-dashed border-slate-900">NULL_CLAIMS_RECORDED</div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'LISTS' && (
                    <div className="animate-in fade-in duration-700">
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.6em] mb-12 flex items-center gap-4"><ListIcon size={16}/> Semantic Inclusion Vectors</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                            {lists.length > 0 ? lists.map((list, i) => (
                                <Link key={i} to={`/markets/${list.id}`} 
                                    className="group relative flex flex-col p-12 bg-black border-2 border-slate-900 hover:border-intuition-primary transition-all shadow-2xl overflow-hidden min-h-[380px] text-center"
                                    style={{ 
                                        clipPath: 'polygon(50% 0%, 100% 15%, 100% 85%, 50% 100%, 0% 85%, 0% 15%)' 
                                    }}
                                    onClick={playClick}
                                    onMouseEnter={playHover}
                                >
                                    <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,243,255,0.1)_1px,transparent_1px)] bg-[size:15px_15px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none"></div>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-intuition-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                                    
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent -rotate-45 -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-[1400ms] ease-in-out pointer-events-none"></div>

                                    <div className="flex flex-col items-center justify-center flex-1 relative z-10 mb-10">
                                        <div className="relative mb-10 group-hover:scale-110 transition-transform duration-700">
                                            <div className="absolute inset-0 bg-intuition-primary blur-3xl opacity-0 group-hover:opacity-40 transition-all duration-700 rounded-full scale-150"></div>
                                            
                                            <div className="absolute -inset-6 border-2 border-dashed border-intuition-primary/30 rounded-full animate-spin-slow opacity-0 group-hover:opacity-100 group-hover:animate-spin-fast transition-all"></div>

                                            <div className="w-28 h-28 bg-black border-2 border-slate-800 flex items-center justify-center overflow-hidden transition-all group-hover:border-intuition-primary shadow-xl group-hover:shadow-glow-blue relative"
                                                 style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}>
                                                {list.image ? <img src={list.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" /> : <Boxes size={36} className="text-slate-700" />}
                                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-intuition-primary/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            </div>
                                        </div>
                                        <div className="relative z-10">
                                            <div className="text-[10px] font-black font-mono text-slate-600 uppercase tracking-[0.5em] mb-4 group-hover:text-intuition-primary transition-colors flex items-center justify-center gap-3">
                                                <div className="w-1 h-1 bg-current rounded-full animate-ping"></div>
                                                Sub_Sector_Vector
                                            </div>
                                            <div className="text-3xl font-black font-display text-white uppercase group-hover:text-glow-blue transition-all tracking-tight leading-none mb-4 drop-shadow-md">{list.label}</div>
                                            <div className="text-[9px] text-slate-600 uppercase font-black tracking-[0.4em] mb-4 group-hover:text-white transition-colors">ACTIVE_NODES: {list.totalItems || 'SYNCING'}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="absolute bottom-6 right-8 text-slate-800 group-hover:text-intuition-primary/60 group-hover:translate-x-1 transition-all group-hover:drop-shadow-[0_0_10px_#00f3ff]">
                                        <ArrowRight size={28} />
                                    </div>

                                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-intuition-primary to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-1000 origin-center opacity-50 shadow-[0_0_20px_#00f3ff]"></div>
                                </Link>
                            )) : (
                                <div className="col-span-full py-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px] border border-dashed border-slate-900">NULL_VECTORS_DETECTED</div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'ACTIVITY' && (
                    <div className="animate-in fade-in duration-700 overflow-hidden ares-frame bg-[#05080f]">
                        <table className="w-full text-left font-mono text-[10px]">
                            <thead className="bg-black/40 border-b border-slate-900 text-slate-600 font-black uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-8 py-4">TRANSACTION_HASH</th>
                                    <th className="px-8 py-4">ACTION</th>
                                    <th className="px-8 py-4 text-right">UNITS</th>
                                    <th className="px-8 py-4 text-right">TIMESTAMP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {activityLog.length > 0 ? activityLog.map((tx, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-all group">
                                        <td className="px-8 py-5 font-mono text-intuition-primary group-hover:text-white group-hover:text-glow-white transition-colors uppercase tracking-tighter">
                                            {tx.id.slice(0, 24)}...
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-2 py-0.5 rounded-sm font-black ${tx.type === 'DEPOSIT' ? 'text-intuition-success bg-intuition-success/10 border border-intuition-success/20 text-glow-success' : 'text-intuition-danger bg-intuition-danger/10 border border-intuition-danger/20 text-glow-red'}`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right font-black text-white group-hover:text-glow-white transition-all">
                                            {formatDisplayedShares(tx.shares)}
                                        </td>
                                        <td className="px-8 py-5 text-right text-slate-500 font-black group-hover:text-slate-300 transition-colors">
                                            {new Date(tx.timestamp).toLocaleTimeString()}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="p-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px]">NULL_ACTIVITY_LOGGED</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {activeTab === 'CONNECTIONS' && (
                    <div className="animate-in fade-in duration-700">
                        <div className="flex items-center gap-6 mb-12 bg-white/5 p-8 border border-white/5 clip-path-slant group hover:border-intuition-primary/20 transition-all">
                            <div className="w-16 h-16 rounded-none clip-path-slant border-2 border-intuition-primary flex items-center justify-center text-intuition-primary bg-black shadow-[0_0_20px_rgba(0,243,255,0.4)] group-hover:shadow-glow-blue transition-all">
                                <Activity size={32} className="animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-xl font-black font-display text-white uppercase tracking-widest font-black leading-none mb-2 text-glow-white">NEURAL_TOPOLOGY</h4>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black group-hover:text-slate-300 transition-colors">Mapping semantic adjacency and synapse neighbors.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {engagedIdentities.length > 0 ? engagedIdentities.map((peer, i) => (
                                <Link key={i} to={`/markets/${peer.term_id}`} className="group p-6 bg-black border border-slate-900 hover:border-intuition-primary transition-all clip-path-slant flex items-center gap-6 relative overflow-hidden hover:shadow-glow-blue">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-intuition-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="w-12 h-12 bg-slate-950 border border-slate-800 flex items-center justify-center clip-path-slant shrink-0 group-hover:border-intuition-primary transition-all group-hover:shadow-glow-blue">
                                        {peer.image ? <img src={peer.image} className="w-full h-full object-cover" /> : <User size={20} className="text-slate-700" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-black text-white group-hover:text-intuition-primary group-hover:text-glow-blue transition-colors truncate uppercase leading-none mb-1.5">{peer.label}</div>
                                        <div className="text-[7px] text-slate-600 font-mono tracking-widest uppercase">Neighbor_Node</div>
                                    </div>
                                </Link>
                            )) : (
                                <div className="col-span-full py-20 text-center text-slate-700 uppercase font-black tracking-widest text-[10px] border border-dashed border-slate-900">NULL_NETWORK_ADJACENCY</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default MarketDetail;
