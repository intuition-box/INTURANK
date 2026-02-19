import React, { useEffect, useState, useMemo } from 'react';
import { getAllAgents } from '../services/graphql';
import { Account } from '../types';
import { categorizeAgent, calculateIndexValue, AgentCategory, calculateTrustScore } from '../services/analytics';
import { TrendingUp, Layers, ChevronRight, Activity, Globe, User, Users, Hash, Info, ExternalLink, Shield, Zap, ArrowRight, BarChart3, AlertCircle, Database, Network, Brain, Wallet } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { playClick, playHover } from '../services/audio';

const IndexCard: React.FC<{ 
    category: AgentCategory,
    title: string, 
    agents: Account[], 
    icon: React.ReactNode, 
    onSelect: () => void 
}> = ({ category, title, agents, icon, onSelect }) => {
    const { value, change } = calculateIndexValue(agents);
    const isUp = change >= 0;
    
    const sparkData = useMemo(() => {
        const data = [];
        let walker = value - (change * 2);
        for (let i = 0; i < 24; i++) {
            walker += (change / 24) + (Math.random() - 0.5) * (value * 0.002);
            data.push({ val: walker });
        }
        return data;
    }, [value, change]);

    const totalSentiment = useMemo(() => {
        if (agents.length === 0) return 50;
        const sum = agents.reduce((acc, a) => acc + calculateTrustScore(a.totalAssets || '0', a.totalShares || '0'), 0);
        return sum / agents.length;
    }, [agents]);

    return (
        <div 
            onClick={() => { playClick(); onSelect(); }}
            onMouseEnter={playHover}
            className="group relative transition-all duration-500 cursor-pointer overflow-visible hover:z-20"
        >
            {/* The Hex-Chassis Body */}
            <div 
                className="relative bg-[#080a12] border-2 border-slate-900 group-hover:border-intuition-primary/50 p-10 pt-12 transition-all duration-500 shadow-2xl flex flex-col min-h-[380px]"
                style={{ 
                    clipPath: 'polygon(15% 0, 85% 0, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0 85%, 0 15%)'
                }}
            >
                <div className={`absolute inset-0 bg-gradient-to-tr ${isUp ? 'from-intuition-success/5' : 'from-intuition-danger/5'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
                
                <div className="flex justify-between items-start mb-8 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            {/* Gravity Ring */}
                            <div className="absolute -inset-4 border border-dashed border-intuition-primary/20 rounded-full animate-spin-slow opacity-20 group-hover:opacity-100 group-hover:animate-spin transition-all"></div>
                            <div className="w-16 h-16 bg-black border-2 border-slate-800 flex items-center justify-center text-slate-500 group-hover:text-intuition-primary group-hover:border-intuition-primary transition-all shadow-xl rotate-45 overflow-hidden">
                                <div className="-rotate-45">{icon}</div>
                                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,243,255,0.05)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black font-display text-white group-hover:text-intuition-primary transition-colors tracking-tight uppercase leading-none mb-2">{title}</h3>
                            <div className="text-[7px] font-mono text-slate-600 uppercase tracking-[0.4em] font-black">Core_Sector_Module</div>
                        </div>
                    </div>
                    <div className={`text-[9px] font-black font-mono px-3 py-1 border transition-all ${isUp ? 'text-intuition-success border-intuition-success/30 bg-intuition-success/5' : 'text-intuition-danger border-intuition-danger/30 bg-intuition-danger/5'}`}>
                        {isUp ? 'STABLE_UP' : 'VOL_FLUX'}
                    </div>
                </div>
                
                <div className="flex items-end justify-between mb-10 relative z-10">
                    <div>
                        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-2 font-black">Composite_Score</div>
                        <div className="text-5xl font-black text-white font-mono tracking-tighter text-glow-white leading-none">
                            {value.toFixed(0)}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-2xl font-black font-mono leading-none ${isUp ? 'text-intuition-success' : 'text-intuition-danger'}`}>
                            {isUp ? '+' : ''}{change.toFixed(2)}%
                        </div>
                        <div className="text-[8px] font-mono text-slate-600 uppercase mt-1 font-black">24H_DELTA</div>
                    </div>
                </div>

                <div className="h-16 w-full mb-8 opacity-20 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData}>
                            <Line type="monotone" dataKey="val" stroke={isUp ? '#00ff9d' : '#ff1e6d'} strokeWidth={3} dot={false} isAnimationActive={true} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="relative z-10 pt-6 border-t border-white/5 mt-auto">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em]">Neural_Density</span>
                        <span className="text-[9px] font-black font-mono text-white tracking-widest">{agents.length} NODES_ACTIVE</span>
                    </div>
                    <div className="flex gap-1.5 h-2">
                        {[...Array(10)].map((_, i) => (
                            <div 
                                key={i} 
                                className={`flex-1 transition-all duration-700 clip-path-slant ${i < Math.floor(totalSentiment / 10) ? (isUp ? 'bg-intuition-success shadow-[0_0_10px_#00ff9d]' : 'bg-intuition-primary shadow-[0_0_10px_#00f3ff]') : 'bg-slate-900 opacity-20'}`}
                            ></div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* perspective shadow floor */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-4 bg-black/40 blur-xl -z-10 group-hover:bg-intuition-primary/10 transition-colors"></div>
        </div>
    );
};

const Indexes: React.FC = () => {
    const [agents, setAgents] = useState<Account[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<AgentCategory | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getAllAgents().then(data => {
            // Fix: Access the 'items' property from the result of getAllAgents()
            setAgents(data.items);
            setLoading(false);
        });
    }, []);

    // FIX: Included missing 'PERSON' property to exhaustively cover AgentCategory type.
    const categorizedAgents: Record<AgentCategory, Account[]> = useMemo(() => ({
        'FOUNDER': agents.filter(a => categorizeAgent(a) === 'FOUNDER'),
        'PERSON': agents.filter(a => categorizeAgent(a) === 'PERSON'),
        'CREATOR': agents.filter(a => categorizeAgent(a) === 'CREATOR'),
        'MEME': agents.filter(a => categorizeAgent(a) === 'MEME'),
        'PROTOCOL': agents.filter(a => categorizeAgent(a) === 'PROTOCOL'),
        'AI': agents.filter(a => categorizeAgent(a) === 'AI'),
        'INVESTOR': agents.filter(a => categorizeAgent(a) === 'INVESTOR'),
        'UNKNOWN': []
    }), [agents]);

    const activeAgents = selectedCategory ? categorizedAgents[selectedCategory] : [];
    const indexMeta = useMemo(() => calculateIndexValue(activeAgents), [activeAgents]);

    const activeCategories = useMemo(() => {
        return (Object.entries(categorizedAgents) as [AgentCategory, Account[]][])
            .filter(([_, list]) => list.length > 0)
            .map(([cat]) => cat);
    }, [categorizedAgents]);

    // FIX: Included missing 'PERSON' mapping to satisfy Record<AgentCategory, T> requirement.
    const CATEGORY_META: Record<AgentCategory, { title: string, icon: any }> = {
        'FOUNDER': { title: 'FOUNDERS_50', icon: User },
        'PERSON': { title: 'INDIVIDUALS', icon: Users },
        'PROTOCOL': { title: 'PROTOCOL_ALPHA', icon: Globe },
        'CREATOR': { title: 'CREATOR_ECON', icon: Activity },
        'MEME': { title: 'MEME_VELOCITY', icon: Hash },
        'AI': { title: 'NEURAL_MODELS', icon: Brain },
        'INVESTOR': { title: 'CAPITAL_NODES', icon: Wallet },
        'UNKNOWN': { title: 'UNKNOWN', icon: Shield }
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-8 text-intuition-primary font-mono bg-black">
            <div className="relative">
                <div className="w-24 h-24 border-2 border-intuition-primary/10 border-t-intuition-primary rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center"><Network size={32} className="animate-pulse" /></div>
            </div>
            <div className="animate-pulse tracking-[0.6em] uppercase text-[11px] font-black text-glow-blue">Synchronizing_Market_Segments...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-intuition-dark pt-12 pb-40 px-6 max-w-[1500px] mx-auto relative font-mono">
            <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] pointer-events-none -z-10"></div>

            <div className="mb-16 relative z-10 border-b border-white/5 pb-12">
                <div className="flex items-center gap-4 text-intuition-primary mb-6">
                    <Database size={20} className="animate-pulse shadow-[0_0_15px_rgba(0,243,255,0.4)]" />
                    <span className="text-[11px] font-black tracking-[0.8em] uppercase">Protocol_Aggregate_v42.S</span>
                </div>
                <h1 className="text-5xl md:text-8xl font-black text-white font-display tracking-tighter mb-8 text-glow-white uppercase leading-none">
                    REPUTATION_INDEXES
                </h1>
                
                <div className="flex flex-col lg:flex-row gap-12 items-end justify-between">
                    <div className="flex-1 max-w-3xl">
                        <p className="text-slate-400 font-mono text-sm leading-relaxed uppercase tracking-[0.2em] mb-8 font-bold">
                            // Analyzing aggregate performance across primary semantic sectors. track the collective conviction of influential entities in the trust graph.
                        </p>
                        
                        <div className="flex items-center gap-6">
                            <div className="bg-black/80 border border-slate-800 p-5 clip-path-slant flex flex-col min-w-[200px] group hover:border-intuition-primary transition-all shadow-xl">
                                <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-2 group-hover:text-slate-300">Macro_System_Health</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 bg-intuition-success rounded-full animate-pulse shadow-[0_0_10px_#00ff9d]"></div>
                                    <span className="text-2xl font-black text-white font-display uppercase tracking-tight group-hover:text-glow-white">STABLE</span>
                                </div>
                                <span className="text-[7px] text-intuition-success uppercase mt-1.5 font-black tracking-[0.3em]">UPLINK_SECURE</span>
                            </div>
                            <div className="bg-black/80 border border-slate-800 p-5 clip-path-slant flex flex-col min-w-[200px] group hover:border-intuition-secondary transition-all shadow-xl">
                                <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-2 group-hover:text-slate-300">Active_Corridors</span>
                                <div className="flex items-center gap-3">
                                    <Activity size={20} className="text-intuition-primary" />
                                    <span className="text-2xl font-black text-white font-display uppercase tracking-tight group-hover:text-glow-red">{activeCategories.length} SECTORS</span>
                                </div>
                                <span className="text-[7px] text-intuition-primary uppercase mt-1.5 font-black tracking-[0.3em]">PRIMARY_LAYER_V2</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {selectedCategory ? (
                <div className="animate-in fade-in slide-in-from-bottom-12 duration-700 relative z-10">
                    <button 
                        onClick={() => { playClick(); setSelectedCategory(null); }} 
                        className="mb-10 flex items-center gap-3 text-slate-500 hover:text-white font-mono text-[10px] font-black hover:tracking-[0.4em] transition-all group border-b border-transparent hover:border-white pb-1.5"
                    >
                        <ArrowRight size={14} className="rotate-180" /> BACK_TO_PRIMARY_DECK
                    </button>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                        <div className="lg:col-span-2 bg-[#020408] border-2 border-intuition-primary p-12 clip-path-slant relative overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] group">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,243,255,0.12),transparent)]"></div>
                            <div className="absolute bottom-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform">
                                <Database size={160} />
                            </div>
                            <div className="relative z-10">
                                <div className="text-xs font-black font-mono text-intuition-primary mb-4 uppercase tracking-[0.5em]">Sector_Telemetry_Online</div>
                                <h2 className="text-5xl md:text-6xl font-black font-display text-white mb-10 tracking-tighter uppercase leading-none">{selectedCategory}_CLUSTER</h2>
                                <div className="flex flex-wrap gap-12 md:gap-16">
                                    <div className="group/stat">
                                        <div className="text-[9px] text-slate-600 uppercase font-black tracking-[0.4em] mb-3 group-hover/stat:text-slate-400">Current_Index_Composite</div>
                                        <div className="text-7xl font-black text-white font-mono tracking-tighter text-glow-white leading-none">
                                            {indexMeta.value.toFixed(0)}
                                        </div>
                                    </div>
                                    <div className="pt-4">
                                        <div className="text-[9px] text-slate-600 uppercase font-black tracking-[0.4em] mb-4">Price_Velocity</div>
                                        <div className={`text-3xl font-black font-mono flex items-center gap-3 ${indexMeta.change >= 0 ? 'text-intuition-success' : 'text-intuition-danger'}`}>
                                            {indexMeta.change >= 0 ? '▲' : '▼'} {Math.abs(indexMeta.change).toFixed(2)}%
                                        </div>
                                        <div className="mt-3 h-1 w-full bg-slate-900 rounded-full overflow-hidden max-w-[150px]">
                                            <div style={{ width: '65%' }} className={`h-full ${indexMeta.change >= 0 ? 'bg-intuition-success' : 'bg-intuition-danger'} animate-pulse`}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-black border-2 border-slate-900 p-10 clip-path-slant flex flex-col justify-between shadow-2xl relative group hover:border-white/20 transition-all">
                             <div className="space-y-8">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] flex items-center gap-3">
                                    <BarChart3 size={16} className="text-intuition-primary"/> Intelligence_Digest
                                </h4>
                                <p className="text-sm text-slate-300 leading-relaxed font-bold italic font-mono border-l-2 border-intuition-primary/40 pl-6 py-3 bg-white/5 clip-path-slant uppercase tracking-wider">
                                    {indexMeta.forecast}
                                </p>
                             </div>
                             <div className="mt-12 pt-8 border-t border-white/5">
                                <div className="flex justify-between items-end mb-4 px-1">
                                    <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest group-hover:text-white transition-colors">Vol_Vector_Intensity</span>
                                    <span className="text-xl font-black text-white font-display uppercase tracking-tight">{indexMeta.volatility}</span>
                                </div>
                                <div className="flex gap-1.5">
                                    {[1,2,3,4,5].map(i => (
                                        <div 
                                            key={i} 
                                            className={`flex-1 h-8 clip-path-slant transition-all duration-1000 ${i <= indexMeta.volatilityLevel ? 'bg-intuition-primary shadow-[0_0_15px_#00f3ff]' : 'bg-slate-900 opacity-20'}`}
                                        ></div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    </div>

                    <div className="bg-black border border-white/10 clip-path-slant overflow-hidden shadow-2xl">
                        <div className="px-10 py-6 bg-white/5 border-b border-white/10 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6em] flex items-center gap-4"><Users size={16}/> Synapse_Nodes_Active ({activeAgents.length})</span>
                            <div className="flex items-center gap-2 text-[8px] font-mono text-slate-700 uppercase font-black">
                                <Activity size={10} /> Realtime_Gravity_Sync
                            </div>
                        </div>
                        <div className="divide-y divide-white/5">
                            {activeAgents.map((agent, i) => {
                                const trust = calculateTrustScore(agent.totalAssets || '0', agent.totalShares || '0');
                                return (
                                    <Link 
                                        key={agent.id} 
                                        to={`/markets/${agent.id}`}
                                        className="flex items-center justify-between px-10 py-8 hover:bg-white/5 transition-all group relative overflow-hidden"
                                    >
                                        <div className="absolute left-0 top-0 h-full w-1 bg-intuition-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-700"></div>
                                        <div className="flex items-center gap-8 relative z-10">
                                            <span className="font-mono text-slate-800 font-black text-xl w-10 group-hover:text-intuition-primary transition-colors">{(i + 1).toString().padStart(2, '0')}</span>
                                            <div className="w-16 h-16 bg-slate-900 border-2 border-slate-800 flex items-center justify-center overflow-hidden clip-path-slant group-hover:border-intuition-primary transition-all shadow-2xl">
                                                {agent.image ? <img src={agent.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" /> : <User size={24} className="text-slate-700" />}
                                            </div>
                                            <div>
                                                <div className="text-xl font-black font-display tracking-tight uppercase text-white group-hover:text-intuition-primary transition-colors mb-1">{agent.label}</div>
                                                <div className="flex items-center gap-4 text-[9px] font-mono font-black text-slate-500 uppercase tracking-widest">
                                                    <span className="text-intuition-success">CONVICTION: {trust.toFixed(1)}%</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                                                    <span>UID: {agent.id.slice(0, 14)}...</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right relative z-10">
                                            <div className="text-2xl font-black text-white font-mono tracking-tighter group-hover:text-glow-white">
                                                {(100 / activeAgents.length).toFixed(2)}%
                                            </div>
                                            <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1 group-hover:text-intuition-primary transition-colors">SECTOR_INFLUENCE</div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16 relative z-10">
                    {activeCategories.map(cat => (
                        <IndexCard 
                            key={cat}
                            category={cat}
                            title={CATEGORY_META[cat].title} 
                            agents={categorizedAgents[cat]} 
                            icon={React.createElement(CATEGORY_META[cat].icon, { size: 28 })} 
                            onSelect={() => setSelectedCategory(cat)}
                        />
                    ))}
                </div>
            )}
            
            <div className="mt-32 p-12 bg-black/40 border-2 border-dashed border-slate-900 text-center clip-path-slant relative overflow-hidden group shadow-inner">
                 <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(0,243,255,0.02),transparent)] -translate-x-full group-hover:animate-[marquee_4s_linear_infinite]"></div>
                 <AlertCircle size={40} className="mx-auto text-slate-800 mb-6 opacity-40 group-hover:text-intuition-primary group-hover:opacity-100 transition-all duration-1000" />
                 <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.8em] mb-4">Semantic_Expansion_Protocol_Pending</h4>
                 <p className="text-slate-800 font-mono text-[9px] uppercase tracking-[0.3em] max-w-xl mx-auto leading-relaxed font-bold">
                     Sector constituent weights are derived from verified on-chain semantic atoms. establish new corridors by utilizing the "Define_Synapse" protocol from the command deck.
                 </p>
            </div>
        </div>
    );
};

export default Indexes;