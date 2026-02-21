import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Search, RefreshCw, ChevronDown, ListFilter, Terminal, Wifi, ShieldCheck, Zap, Brain, Sparkles } from 'lucide-react';
import { getGlobalActivity } from '../services/graphql';
import ActivityRow from '../components/ActivityRow';
import { playClick, playHover } from '../services/audio';
import { GoogleGenAI } from "@google/genai";
import { formatEther } from 'viem';

type SortOption = 'Newest' | 'Oldest' | 'Highest Volume';

const Feed: React.FC = () => {
    const [events, setEvents] = useState<any[]>([]);
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
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
                             <div className="text-[11px] font-black tracking-[0.5em] uppercase text-slate-500 mb-1">Global_Sync_Protocol</div>
                             <h1 className="text-4xl md:text-7xl font-black text-white font-display uppercase tracking-tighter text-glow-white leading-none">ACTIVITY</h1>
                        </div>
                    </div>
                    <p className="text-slate-400 font-mono text-sm uppercase tracking-widest leading-relaxed max-w-2xl border-l-2 border-slate-800 pl-6">
                        Reconciling real-time capital flow and semantic shifts in the global trust graph. Surveillance layer S04 activated.
                    </p>
                </div>
                
                <div className="flex items-center gap-8 relative z-10">
                    <div className="text-right hidden sm:block">
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-2">Throughput_Relay</div>
                        <div className="flex items-center justify-end gap-4">
                             <span className="text-2xl font-black text-intuition-success font-display tracking-widest uppercase text-glow-success leading-none">LOCKED</span>
                             <div className="w-4 h-4 rounded-none bg-intuition-success animate-pulse shadow-glow-success clip-path-slant"></div>
                        </div>
                    </div>
                    <div className="w-[2px] h-12 bg-slate-800 hidden sm:block"></div>
                    <div className="flex flex-col gap-1 items-end">
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Signal_Integrity</div>
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
                            <div className="text-[8px] font-black text-intuition-primary uppercase tracking-[0.4em]">ARES_Pulse_Synthesis</div>
                            <div className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Sparkles size={10} className="text-intuition-secondary" /> NEURAL_DYNAMICS
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

            {/* Action Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 mb-10">
                <div className="flex-1 relative group p-[2px] bg-slate-900 clip-path-slant focus-within:bg-intuition-primary/40 transition-colors">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-intuition-primary transition-colors">
                        <Search size={18} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="QUERY_LEDGER: [WALLET_NODE_OR_CLAIM]..." 
                        className="w-full bg-[#050505] py-4 sm:py-5 pl-12 sm:pl-14 pr-4 sm:pr-10 text-white font-mono text-xs focus:outline-none placeholder-slate-700 uppercase tracking-widest clip-path-slant min-h-[48px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 sm:gap-3 min-h-[44px] px-4 sm:px-6 md:px-10 py-4 md:py-5 bg-black border-2 border-slate-900 text-slate-400 hover:text-white hover:border-white transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] clip-path-slant group relative overflow-hidden">
                        <ListFilter size={16} className="shrink-0" /> <span className="hidden sm:inline">Filter_Module</span>
                    </button>
                    
                    <div className="relative min-w-0 flex-1 sm:flex-initial">
                        <button 
                            onClick={() => { playClick(); setIsSortOpen(!isSortOpen); }}
                            className={`w-full sm:w-auto flex items-center justify-between gap-4 sm:gap-8 min-h-[44px] px-4 sm:px-6 md:px-10 py-4 md:py-5 bg-black border-2 transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] clip-path-slant min-w-0 sm:min-w-[200px] md:min-w-[240px] ${isSortOpen ? 'border-intuition-primary text-white shadow-glow-blue' : 'border-slate-900 text-slate-400'}`}
                        >
                            {activeSort} <ChevronDown size={14} className={`transition-transform duration-500 ${isSortOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isSortOpen && (
                            <div className="absolute right-0 top-full mt-2 w-full bg-black border-2 border-intuition-primary/40 shadow-[0_0_80px_rgba(0,0,0,1)] z-[100] p-1 clip-path-slant animate-in fade-in slide-in-from-top-3 duration-300">
                                {(['Newest', 'Oldest', 'Highest Volume'] as SortOption[]).map((opt) => (
                                    <button 
                                        key={opt}
                                        onClick={() => { setActiveSort(opt); setIsSortOpen(false); playClick(); }}
                                        className={`w-full min-h-[44px] px-4 sm:px-6 py-3 sm:py-4 text-left text-[9px] font-black uppercase tracking-widest transition-all hover:bg-intuition-primary hover:text-black ${activeSort === opt ? 'text-intuition-primary bg-white/5' : 'text-slate-400'}`}
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
                <div className="flex items-center gap-3 text-slate-700 font-black text-[9px] tracking-[0.6em] uppercase mb-6 px-1 opacity-80">
                    <Wifi size={10} className="animate-pulse" /> Live_Temporal_Stream // Sector_04_ARES
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
                             <span className="font-mono text-sm font-black tracking-[0.6em] uppercase animate-pulse">Synchronizing_Temporal_Ledger...</span>
                             <div className="text-[8px] font-black text-slate-700 uppercase tracking-widest mt-2">Connecting_Node_Clusters</div>
                        </div>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-48 border-2 border-dashed border-slate-900 bg-black/40 clip-path-slant relative group">
                        <div className="absolute inset-0 bg-intuition-danger/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Zap size={64} className="text-slate-800 mb-8 opacity-40 group-hover:text-intuition-danger transition-colors" />
                        <div className="text-center space-y-2">
                            <span className="text-sm font-black font-mono text-slate-600 uppercase tracking-[0.5em] group-hover:text-white transition-colors">NULL_SIGNAL_RECOVERED</span>
                            <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest">Target query produced zero entropy matches.</p>
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
                            <span className="text-[10px] font-black font-mono text-intuition-primary/80 uppercase tracking-[0.8em] animate-pulse">Neural_Buffer_Sector_04...</span>
                        </div>
                    ) : !hasMore && events.length > 0 && (
                        <div className="flex flex-col items-center gap-6 opacity-60">
                            <div className="w-10 h-10 bg-black border border-slate-900 flex items-center justify-center text-slate-700">
                                <Terminal size={18} />
                            </div>
                            <div className="text-center space-y-2">
                                <span className="text-[10px] font-black font-mono text-slate-600 uppercase tracking-[1em]">END_OF_TEMPORAL_LEDGER</span>
                            </div>
                        </div>
                    )}
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