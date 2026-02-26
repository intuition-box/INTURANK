import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Search, RefreshCw, ChevronDown, ListFilter, Terminal, Wifi, ShieldCheck, Zap, Brain, Sparkles, TrendingDown, TrendingUp, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { getGlobalActivity, getActivityOnMyMarkets, getActivityBySenderIds, getUserPositions, getUserHistory, getCurveLabel, type PositionActivityNotification } from '../services/graphql';
import ActivityRow from '../components/ActivityRow';
import { playClick, playHover } from '../services/audio';
import { GoogleGenAI } from "@google/genai";
import { formatEther } from 'viem';
import { getFollowedIdentities } from '../services/follows';
import { CurrencySymbol } from '../components/CurrencySymbol';
import { formatMarketValue, formatDisplayedShares } from '../services/analytics';
import { EXPLORER_URL } from '../constants';
import { Transaction } from '../types';
import { getLocalTransactions } from '../services/web3';

type SortOption = 'Newest' | 'Oldest' | 'Highest Volume';

type PersonalItem = PositionActivityNotification & { source?: 'holdings' | 'follow' };

const Feed: React.FC = () => {
    const { address: walletAddress } = useAccount();
    const [events, setEvents] = useState<any[]>([]);
    const [personalItems, setPersonalItems] = useState<PersonalItem[]>([]);
    const [personalLoading, setPersonalLoading] = useState(false);
    const [ownHistory, setOwnHistory] = useState<Transaction[]>([]);
    const [ownLoading, setOwnLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm, setDebouncedTerm] = useState('');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [activeSort, setActiveSort] = useState<SortOption>('Newest');
    const [aresPulse, setAresPulse] = useState<string>('SYNCHRONIZING_NEURAL_SENSORS...');
    const [isAresLoading, setIsAresLoading] = useState(false);
    
    const PAGE_SIZE = 40;
    const observerTarget = useRef<HTMLDivElement>(null);
    const syncIntervalRef = useRef<any>(null);

    const generateAresPulse = async (currentEvents: any[]) => {
        if (currentEvents.length < 5 || isAresLoading) return;
        setIsAresLoading(true);
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                setAresPulse("NEURAL_UPLINK_FRAGMENTED_STANDBY");
                setIsAresLoading(false);
                return;
            }
            const ai = new GoogleGenAI({ apiKey });
            const summary = currentEvents.slice(0, 15).map(e => 
                `${e.sender?.label || 'Node'} ${e.type} ${e.assets ? formatEther(BigInt(e.assets)) : ''} on ${e.target?.label}`
            ).join('; ');

            const prompt = `
                Analyze these recent semantic graph activities: [${summary}]
                Role: Tactical Graph Architect.
                Output: One punchy, aggressive cyberpunk sentence summarizing the "Vibe" or "Trend". 
                Keywords: Ingress, Arbitrage, Dominance, Liquidity, Neural Shift.
                Format: ALL CAPS, Max 20 words. No emojis.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });
            setAresPulse(response.text?.trim() || "EQUILIBRIUM_MAINTAINED_IN_SECTOR_04");
        } catch (e) {
            setAresPulse("NEURAL_UPLINK_FRAGMENTED_STANDBY");
        } finally {
            setIsAresLoading(false);
        }
    };

    const fetchActivity = useCallback(async (isInitial = false, reset = false) => {
        if (isSyncing || (loadingMore && !reset)) return;
        
        if (reset) {
            setLoading(true);
            setOffset(0);
            setHasMore(true);
        } else if (!isInitial) {
            setIsSyncing(true);
        }

        try {
            const currentOffset = reset ? 0 : offset;
            const data = await getGlobalActivity(PAGE_SIZE, currentOffset);
            
            setEvents(prev => {
                const combined = reset ? data.items : [...prev, ...data.items];
                const uniqueMap = new Map();
                combined.forEach(item => uniqueMap.set(item.id, item));
                const final = Array.from(uniqueMap.values());
                if (reset) generateAresPulse(final);
                return final;
            });

            if (data.items.length < PAGE_SIZE) setHasMore(false);
        } catch (e) {
            console.warn("[ARES_CORE] ACTIVITY_FETCH_FAILURE:", e);
        } finally {
            setLoading(false);
            setIsSyncing(false);
            setLoadingMore(false);
        }
    }, [offset, isSyncing, loadingMore]);

    useEffect(() => {
        fetchActivity(true, true);
        syncIntervalRef.current = setInterval(() => fetchActivity(false, false), 30000);
        return () => clearInterval(syncIntervalRef.current);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedTerm(searchTerm), 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchMore = async () => {
        if (loadingMore || !hasMore || loading) return;
        setLoadingMore(true);
        const nextOffset = offset + PAGE_SIZE;
        try {
            const data = await getGlobalActivity(PAGE_SIZE, nextOffset);
            setEvents(prev => {
                const combined = [...prev, ...data.items];
                const uniqueMap = new Map();
                combined.forEach(item => uniqueMap.set(item.id, item));
                return Array.from(uniqueMap.values());
            });
            if (data.items.length < PAGE_SIZE) setHasMore(false);
            setOffset(nextOffset);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && debouncedTerm === '') {
                    fetchMore();
                }
            },
            { threshold: 0.1 }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, debouncedTerm]);

    const filteredEvents = events.filter(ev => {
        if (!debouncedTerm) return true;
        const term = debouncedTerm.toLowerCase();
        return (ev.sender?.label || '').toLowerCase().includes(term) ||
               (ev.sender?.id || '').toLowerCase().includes(term) ||
               (ev.target?.label || '').toLowerCase().includes(term) ||
               (ev.target?.id || '').toLowerCase().includes(term);
    });

    const holdingsItems = personalItems.filter((n) => n.source !== 'follow');
    const followItems = personalItems.filter((n) => n.source === 'follow');

    // Personalized notifications: activity on holdings + followed accounts
    useEffect(() => {
        const fetchPersonal = async () => {
            if (!walletAddress) {
                setPersonalItems([]);
                return;
            }
            setPersonalLoading(true);
            setOwnLoading(true);
            try {
                const [positions, historyFromGraph] = await Promise.all([
                    getUserPositions(walletAddress),
                    getUserHistory(walletAddress).catch(() => []),
                ]);
                const vaultIds = (positions || [])
                    .map((p: any) => p.vault?.term_id)
                    .filter(Boolean);
                const holdings = await getActivityOnMyMarkets(walletAddress, vaultIds, 40);

                const follows = getFollowedIdentities(walletAddress);
                let followActivity: PositionActivityNotification[] = [];
                if (follows.length > 0) {
                    const senderIds = follows.map((f) => f.identityId);
                    followActivity = await getActivityBySenderIds(senderIds, 30);
                }

                const seen = new Set<string>();
                const merged: PersonalItem[] = [];
                for (const n of holdings) {
                    if (!seen.has(n.id)) {
                        seen.add(n.id);
                        merged.push({ ...n, source: 'holdings' });
                    }
                }
                for (const n of followActivity) {
                    if (!seen.has(n.id)) {
                        seen.add(n.id);
                        merged.push({ ...n, source: 'follow' });
                    }
                }
                merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                setPersonalItems(merged);

                // Own history: merge graph history with local txs so buys/sells always show up
                const local = getLocalTransactions(walletAddress) || [];
                const combinedHistory: Transaction[] = [...local, ...(historyFromGraph || [])];
                const historyMap = new Map<string, Transaction>();
                combinedHistory.forEach((tx) => {
                    if (!tx?.id) return;
                    if (!historyMap.has(tx.id)) historyMap.set(tx.id, tx);
                });
                const mergedHistory = Array.from(historyMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                setOwnHistory(mergedHistory.slice(0, 60));
            } catch (e) {
                setPersonalItems([]);
                setOwnHistory([]);
            } finally {
                setPersonalLoading(false);
                setOwnLoading(false);
            }
        };
        fetchPersonal();
        const t = setInterval(fetchPersonal, 60_000);
        return () => clearInterval(t);
    }, [walletAddress]);

    return (
        <div className="w-full max-w-[1600px] mx-auto px-6 py-12 pb-40 font-mono relative z-10">
            {/* Header Readout */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 border-b-2 border-slate-900 pb-10">
                <div className="relative">
                    <div className="flex items-center gap-6 text-intuition-primary mb-4 relative z-10">
                        <div className="w-16 h-16 bg-black border-2 border-intuition-primary flex items-center justify-center shadow-glow-blue clip-path-slant">
                             <Activity size={32} className="animate-pulse" />
                        </div>
                        <div>
                             <div className="text-xs font-bold tracking-[0.3em] uppercase text-slate-400 mb-1">Global activity</div>
                             <h1 className="text-4xl md:text-7xl font-black text-white font-display uppercase tracking-tighter text-glow-white leading-none">ACTIVITY</h1>
                        </div>
                    </div>
                    <p className="text-slate-300 font-mono text-sm uppercase tracking-wider leading-relaxed max-w-2xl border-l-2 border-slate-700 pl-6">
                        Reconciling real-time capital flow and semantic shifts in the global trust graph. Surveillance layer S04 activated.
                    </p>
                </div>
                
                <div className="flex items-center gap-8 relative z-10">
                    <div className="text-right hidden sm:block">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Throughput</div>
                        <div className="flex items-center justify-end gap-4">
                             <span className="text-2xl font-black text-intuition-success font-display tracking-widest uppercase text-glow-success leading-none">LOCKED</span>
                             <div className="w-4 h-4 rounded-none bg-intuition-success animate-pulse shadow-glow-success clip-path-slant"></div>
                        </div>
                    </div>
                    <div className="w-[2px] h-12 bg-slate-800 hidden sm:block"></div>
                    <div className="flex flex-col gap-1 items-end">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Signal integrity</div>
                        <div className="text-xl font-black text-white font-mono tracking-tighter">99.98%</div>
                    </div>
                </div>
            </div>

            {/* ARES_PULSE Tactical Ticker */}
            <div className="mb-10 p-1 bg-gradient-to-r from-intuition-primary/20 via-intuition-secondary/20 to-intuition-primary/20 clip-path-slant shadow-2xl">
                <div className="bg-black p-4 sm:p-6 flex flex-col md:flex-row items-center gap-4 sm:gap-6 md:gap-8 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center text-intuition-primary clip-path-slant shadow-inner">
                            <Brain size={24} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-intuition-primary uppercase tracking-wider">ARES pulse</div>
                            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <Sparkles size={10} className="text-intuition-secondary" /> Neural dynamics
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 px-4 border-l-2 border-white/5 py-1">
                        <p className={`text-sm font-black font-mono tracking-tight uppercase transition-all duration-700 ${isAresLoading ? 'opacity-30 blur-sm' : 'opacity-100'}`}>
                            <span className="text-intuition-primary mr-2">{">>"}</span>
                            <span className="text-white text-glow-white italic">{aresPulse}</span>
                            <span className="inline-block w-2 h-4 bg-intuition-primary ml-2 animate-pulse"></span>
                        </p>
                    </div>
                    <button 
                        onClick={() => generateAresPulse(events)}
                        disabled={isAresLoading}
                        onMouseEnter={playHover}
                        className="px-8 py-3 bg-white/5 border border-white/10 hover:border-intuition-primary hover:text-intuition-primary transition-all text-[9px] font-black uppercase tracking-widest clip-path-slant"
                    >
                        {isAresLoading ? 'SYNTHESIZING...' : 'FORCE_RECON'}
                    </button>
                </div>
            </div>

            {/* Personalized Notifications */}
            <div className="mb-14 grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-1 space-y-5">
                    {/* Header card */}
                    <div className="bg-black border border-slate-900 clip-path-slant shadow-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-800 bg-white/5 flex items-center justify-between gap-4">
                            <div>
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 flex items-center gap-2">
                                    <Zap size={12} className="text-intuition-secondary" /> Personalized notifications
                                </div>
                                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-[0.25em]">
                                    YOUR GRAPH SIGNALS
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* Card 1: Holdings activity */}
                    <div className="bg-black border border-slate-900 clip-path-slant shadow-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-800 bg-white/5 flex items-center justify-between gap-4">
                            <span className="text-[10px] font-mono text-slate-100 uppercase tracking-[0.25em]">
                                Holdings activity
                            </span>
                        </div>
                        <div className="max-h-[260px] overflow-y-auto custom-scrollbar px-3 py-3 space-y-2">
                            {!walletAddress && (
                                <div className="px-4 py-6 text-[11px] font-mono text-slate-400 uppercase tracking-widest text-center">
                                    Connect your wallet to see activity on your claims.
                                </div>
                            )}
                            {walletAddress && personalLoading && holdingsItems.length === 0 && (
                                <div className="flex items-center justify-center py-6 text-slate-400 text-[10px] font-mono uppercase tracking-widest">
                                    <RefreshCw size={16} className="animate-spin mr-2" /> Synchronizing…
                                </div>
                            )}
                            {walletAddress && !personalLoading && holdingsItems.length === 0 && (
                                <div className="px-4 py-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center">
                                    No recent activity detected on your holdings.
                                </div>
                            )}
                            {walletAddress && holdingsItems.slice(0, 15).map((n) => {
                                const sharesNum = n.shares ? parseFloat(formatEther(BigInt(n.shares))) : 0;
                                const assetsNum = n.assets ? parseFloat(formatEther(BigInt(n.assets))) : 0;
                                return (
                                    <div
                                        key={n.id}
                                        className="flex items-start gap-2 px-3 py-2.5 border border-slate-800 hover:border-intuition-primary/50 hover:bg-white/5 transition-all duration-200 group motion-hover-lift"
                                    >
                                        <span className={`flex-shrink-0 mt-0.5 ${n.type === 'liquidated' ? 'text-intuition-danger' : 'text-intuition-success'}`}>
                                            {n.type === 'liquidated' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-bold font-mono text-white leading-tight">
                                                <span className="font-black text-intuition-primary">{n.senderLabel}</span>
                                                {' '}
                                                <span className="text-slate-200">{n.type === 'liquidated' ? 'liquidated' : 'acquired'}</span>
                                                {sharesNum > 0 ? (
                                                    <span className="text-slate-300 font-semibold">
                                                        {' '}{formatDisplayedShares(n.shares!)} shares
                                                        {assetsNum > 0 && (
                                                            <span className="text-slate-400 font-bold">
                                                                {' '}(<CurrencySymbol size="sm" leading className="text-slate-400" />{formatMarketValue(assetsNum)})
                                                            </span>
                                                        )}
                                                        {' '}in{' '}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300"> shares in </span>
                                                )}
                                                <Link
                                                    to={`/markets/${n.vaultId}`}
                                                    onClick={playClick}
                                                    onMouseEnter={playHover}
                                                    className="font-bold text-slate-100 group-hover:text-intuition-primary transition-colors truncate inline-block max-w-full align-baseline underline-offset-2 group-hover:underline"
                                                >
                                                    {n.marketLabel}
                                                </Link>
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[9px] font-mono text-slate-500">
                                                <span>{new Date(n.timestamp).toLocaleString()}</span>
                                                <span className="border border-slate-700 px-2 py-0.5 clip-path-slant" title="Bonding curve type">
                                                    {getCurveLabel(n.curveId)}
                                                </span>
                                                {n.txHash && (
                                                    <a
                                                        href={`${EXPLORER_URL}/tx/${n.txHash}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onMouseEnter={playHover}
                                                        className="text-slate-500 hover:text-intuition-primary inline-flex items-center gap-1"
                                                    >
                                                        <Terminal size={10} /> TX
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Card 2: People you follow */}
                    <div className="bg-black border border-slate-900 clip-path-slant shadow-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-800 bg-white/5 flex items-center justify-between gap-4">
                            <span className="text-[10px] font-mono text-amber-300 uppercase tracking-[0.25em] flex items-center gap-1">
                                <UserPlus size={10} /> People you follow
                            </span>
                        </div>
                        <div className="max-h-[260px] overflow-y-auto custom-scrollbar px-3 py-3 space-y-2">
                            {!walletAddress && (
                                <div className="px-4 py-6 text-[11px] font-mono text-slate-400 uppercase tracking-widest text-center">
                                    Connect your wallet and follow accounts to see their trades.
                                </div>
                            )}
                            {walletAddress && personalLoading && followItems.length === 0 && (
                                <div className="flex items-center justify-center py-6 text-slate-400 text-[10px] font-mono uppercase tracking-widest">
                                    <RefreshCw size={16} className="animate-spin mr-2" /> Synchronizing…
                                </div>
                            )}
                            {walletAddress && !personalLoading && followItems.length === 0 && (
                                <div className="px-4 py-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center">
                                    No recent trades from people you follow.
                                </div>
                            )}
                            {walletAddress && followItems.slice(0, 15).map((n) => {
                                const sharesNum = n.shares ? parseFloat(formatEther(BigInt(n.shares))) : 0;
                                const assetsNum = n.assets ? parseFloat(formatEther(BigInt(n.assets))) : 0;
                                return (
                                    <div
                                        key={n.id}
                                        className="flex items-start gap-2 px-3 py-2.5 border border-slate-800 hover:border-amber-400/70 hover:bg-amber-500/5 transition-all duration-200 group motion-hover-lift"
                                    >
                                        <span className={`flex-shrink-0 mt-0.5 ${n.type === 'liquidated' ? 'text-intuition-danger' : 'text-intuition-success'}`}>
                                            {n.type === 'liquidated' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-bold font-mono text-white leading-tight">
                                                <span className="inline-flex items-center gap-1 mr-1 text-amber-300/90 text-[9px] border border-amber-500/60 px-1 py-0.5 clip-path-slant" title="Someone you follow">
                                                    <UserPlus size={9} /> FOLLOW
                                                </span>
                                                <span className="font-black text-intuition-primary">{n.senderLabel}</span>
                                                {' '}
                                                <span className="text-slate-200">{n.type === 'liquidated' ? 'liquidated' : 'acquired'}</span>
                                                {sharesNum > 0 ? (
                                                    <span className="text-slate-300 font-semibold">
                                                        {' '}{formatDisplayedShares(n.shares!)} shares
                                                        {assetsNum > 0 && (
                                                            <span className="text-slate-400 font-bold">
                                                                {' '}(<CurrencySymbol size="sm" leading className="text-slate-400" />{formatMarketValue(assetsNum)})
                                                            </span>
                                                        )}
                                                        {' '}in{' '}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300"> shares in </span>
                                                )}
                                                <Link
                                                    to={`/markets/${n.vaultId}`}
                                                    onClick={playClick}
                                                    onMouseEnter={playHover}
                                                    className="font-bold text-slate-100 group-hover:text-intuition-primary transition-colors truncate inline-block max-w-full align-baseline underline-offset-2 group-hover:underline"
                                                >
                                                    {n.marketLabel}
                                                </Link>
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[9px] font-mono text-slate-500">
                                                <span>{new Date(n.timestamp).toLocaleString()}</span>
                                                <span className="border border-slate-700 px-2 py-0.5 clip-path-slant" title="Bonding curve type">
                                                    {getCurveLabel(n.curveId)}
                                                </span>
                                                {n.txHash && (
                                                    <a
                                                        href={`${EXPLORER_URL}/tx/${n.txHash}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onMouseEnter={playHover}
                                                        className="text-slate-500 hover:text-intuition-primary inline-flex items-center gap-1"
                                                    >
                                                        <Terminal size={10} /> TX
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Card 3: Your actions */}
                    <div className="bg-black border border-slate-900 clip-path-slant shadow-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-800 bg-white/5 flex items-center justify-between gap-4">
                            <span className="text-[10px] font-mono text-slate-100 uppercase tracking-[0.25em] flex items-center gap-1">
                                <ShieldCheck size={10} className="text-intuition-success" /> Your actions
                            </span>
                        </div>
                        <div className="max-h-[260px] overflow-y-auto custom-scrollbar px-3 py-3 space-y-2">
                            {!walletAddress && (
                                <div className="px-4 py-6 text-[11px] font-mono text-slate-400 uppercase tracking-widest text-center">
                                    Connect your wallet to see your own buys, sells, and creations.
                                </div>
                            )}
                            {walletAddress && ownLoading && ownHistory.length === 0 && (
                                <div className="flex items-center justify-center py-6 text-slate-400 text-[10px] font-mono uppercase tracking-widest">
                                    <RefreshCw size={16} className="animate-spin mr-2" /> Loading your history…
                                </div>
                            )}
                            {walletAddress && !ownLoading && ownHistory.length === 0 && (
                                <div className="px-4 py-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center">
                                    No recent buys, sells, or creations.
                                </div>
                            )}
                            {walletAddress && !ownLoading && ownHistory.slice(0, 20).map((tx) => {
                                const assetsNum = tx.assets ? parseFloat(formatEther(BigInt(tx.assets))) : 0;
                                const isRedeem = tx.type === 'REDEEM';
                                return (
                                    <div
                                        key={tx.id}
                                        className="flex items-start gap-2 px-3 py-2.5 border border-slate-800 hover:border-intuition-primary/60 hover:bg-white/5 transition-all duration-200 group motion-hover-lift"
                                    >
                                        <span className={`flex-shrink-0 mt-0.5 ${isRedeem ? 'text-intuition-danger' : 'text-intuition-success'}`}>
                                            {isRedeem ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-bold font-mono text-white leading-tight">
                                                <span className="font-black text-intuition-primary">You</span>
                                                {' '}
                                                <span className="text-slate-200">{isRedeem ? 'liquidated' : 'acquired'}</span>
                                                {' '}
                                                <span className="text-slate-300 font-semibold">
                                                    {formatDisplayedShares(tx.shares)} shares
                                                    {assetsNum > 0 && (
                                                        <span className="text-slate-400 font-bold">
                                                            {' '}(<CurrencySymbol size="sm" leading className="text-slate-400" />{formatMarketValue(assetsNum)})
                                                        </span>
                                                    )}
                                                    {' '}in{' '}
                                                </span>
                                                <Link
                                                    to={`/markets/${tx.vaultId}`}
                                                    onClick={playClick}
                                                    onMouseEnter={playHover}
                                                    className="font-bold text-slate-100 group-hover:text-intuition-primary transition-colors truncate inline-block max-w-full align-baseline underline-offset-2 group-hover:underline"
                                                >
                                                    {tx.assetLabel || tx.vaultId.slice(0, 10) + '…'}
                                                </Link>
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[9px] font-mono text-slate-500">
                                                <span>{new Date(tx.timestamp).toLocaleString()}</span>
                                                <span className="border border-slate-700 px-2 py-0.5 clip-path-slant" title="Bonding curve type">
                                                    {getCurveLabel(tx.curveId)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="xl:col-span-2">

            {/* Action Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 mb-8">
                <div className="flex-1 relative group p-[2px] bg-slate-900 clip-path-slant focus-within:bg-intuition-primary/40 transition-colors">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-intuition-primary transition-colors">
                        <Search size={18} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search by wallet, node or claim…" 
                        className="w-full bg-[#050505] py-3 sm:py-4 pl-12 sm:pl-14 pr-4 sm:pr-10 text-white font-mono text-xs sm:text-sm focus:outline-none placeholder-slate-500 uppercase tracking-wider clip-path-slant min-h-[42px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 sm:gap-3 min-h-[40px] px-4 sm:px-6 md:px-8 py-3 md:py-4 bg-black border-2 border-slate-800 text-slate-300 hover:text-white hover:border-white transition-all text-[11px] sm:text-xs font-bold uppercase tracking-wider clip-path-slant group relative overflow-hidden">
                        <ListFilter size={16} className="shrink-0" /> <span className="hidden sm:inline">Filter</span>
                    </button>
                    
                    <div className="relative min-w-0 flex-1 sm:flex-initial">
                        <button 
                            onClick={() => { playClick(); setIsSortOpen(!isSortOpen); }}
                            className={`w-full sm:w-auto flex items-center justify-between gap-4 sm:gap-8 min-h-[40px] px-4 sm:px-6 md:px-8 py-3 md:py-4 bg-black border-2 transition-all text-[11px] sm:text-xs font-bold uppercase tracking-wider clip-path-slant min-w-0 sm:min-w-[180px] md:min-w-[220px] ${isSortOpen ? 'border-intuition-primary text-white shadow-glow-blue' : 'border-slate-800 text-slate-300'}`}
                        >
                            {activeSort} <ChevronDown size={14} className={`transition-transform duration-500 ${isSortOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isSortOpen && (
                            <div className="absolute right-0 top-full mt-2 w-full bg-black border-2 border-intuition-primary/40 shadow-[0_0_80px_rgba(0,0,0,1)] z-[100] p-1 clip-path-slant animate-in fade-in slide-in-from-top-3 duration-300">
                                {(['Newest', 'Oldest', 'Highest Volume'] as SortOption[]).map((opt) => (
                                    <button 
                                        key={opt}
                                        onClick={() => { setActiveSort(opt); setIsSortOpen(false); playClick(); }}
                                        className={`w-full min-h-[44px] px-4 sm:px-6 py-3 sm:py-4 text-left text-sm font-bold uppercase tracking-wider transition-all hover:bg-intuition-primary hover:text-black ${activeSort === opt ? 'text-intuition-primary bg-white/5' : 'text-slate-300'}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Activity Feed Container */}
            <div className="relative min-h-[600px] z-10">
                <div className="flex items-center gap-3 text-slate-400 font-bold text-xs tracking-wider uppercase mb-6 px-1">
                    <Wifi size={12} className="animate-pulse" /> Live stream · Sector 04
                </div>

                {loading && events.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 text-intuition-primary">
                        <div className="relative">
                            <div className="w-24 h-24 border-4 border-intuition-primary/10 border-t-intuition-primary rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Terminal size={32} className="animate-pulse" />
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-2 text-center">
                             <span className="font-mono text-sm font-bold text-white tracking-wider uppercase animate-pulse">Loading activity…</span>
                             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Connecting to network…</div>
                        </div>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-48 border-2 border-dashed border-slate-900 bg-black/40 clip-path-slant relative group">
                        <div className="absolute inset-0 bg-intuition-danger/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Zap size={64} className="text-slate-800 mb-8 opacity-40 group-hover:text-intuition-danger transition-colors" />
                        <div className="text-center space-y-2">
                            <span className="text-sm font-bold font-mono text-slate-400 uppercase tracking-wider group-hover:text-white transition-colors">No results</span>
                            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">No activity matches your search.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {filteredEvents.map((ev, i) => (
                            <div key={ev.id + i} className="animate-in fade-in slide-in-from-right-2 duration-500 fill-mode-both" style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}>
                                <ActivityRow event={ev} />
                            </div>
                        ))}
                    </div>
                )}

                {/* Observer / Loader */}
                <div ref={observerTarget} className="h-64 flex flex-col items-center justify-center mt-12 border-t border-white/5 pt-12">
                    {loadingMore ? (
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative">
                                <div className="w-12 h-12 border-2 border-intuition-primary/10 border-t-intuition-primary rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Activity size={18} className="text-intuition-primary animate-pulse" />
                                </div>
                            </div>
                            <span className="text-sm font-bold font-mono text-intuition-primary uppercase tracking-wider animate-pulse">Loading more…</span>
                        </div>
                    ) : !hasMore && events.length > 0 && (
                        <div className="flex flex-col items-center gap-6 opacity-80">
                            <div className="w-10 h-10 bg-black border border-slate-700 flex items-center justify-center text-slate-400">
                                <Terminal size={18} />
                            </div>
                            <div className="text-center space-y-2">
                                <span className="text-sm font-bold font-mono text-slate-400 uppercase tracking-wider">End of feed</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
                </div>
            </div>

            {/* Sub-Watermark HUD elements */}
            <div className="fixed bottom-12 right-12 z-50 pointer-events-none opacity-40 hidden 2xl:block">
                <div className="flex flex-col items-end gap-3 font-mono">
                    <div className="flex items-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">
                        <ShieldCheck size={12} className="text-intuition-success" /> Network_Secured
                    </div>
                    <div className="text-[11px] font-black text-slate-700 uppercase tracking-[0.8em]">ARES_ACTIVE</div>
                </div>
            </div>
        </div>
    );
};

export default Feed;