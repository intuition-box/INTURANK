import React, { useEffect, useState, useMemo } from 'react';
import { getAllAgents } from '../services/graphql';
import { Account } from '../types';
import { categorizeAgent, calculateIndexValue, AgentCategory, calculateTrustScore } from '../services/analytics';
import { TrendingUp, Layers, ChevronRight, Activity, Globe, User, Users, Hash, Info, ExternalLink, Shield, Zap, ArrowRight, BarChart3, AlertCircle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { playClick, playHover } from '../services/audio';

const IndexCard: React.FC<{ 
    title: string, 
    agents: Account[], 
    icon: React.ReactNode, 
    onSelect: () => void 
}> = ({ title, agents, icon, onSelect }) => {
    const { value, change } = calculateIndexValue(agents);
    const isUp = change >= 0;
    
    // Generate trend-aligned sparkline data
    const sparkData = useMemo(() => {
        const data = [];
        let walker = value - (change * 5); // Start slightly offset to show the trend
        for (let i = 0; i < 24; i++) {
            walker += (change / 24) + (Math.random() - 0.5) * (value * 0.005);
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
            className="group relative bg-[#05080f] border-2 border-intuition-border p-8 clip-path-slant hover:border-intuition-primary transition-all cursor-pointer overflow-hidden hover:shadow-[0_0_40px_rgba(0,243,255,0.1)]"
        >
            <div className={`absolute -right-20 -top-20 w-64 h-64 blur-[80px] opacity-20 pointer-events-none transition-colors duration-700 ${isUp ? 'bg-intuition-success' : 'bg-intuition-danger'}`}></div>
            
            <div className="flex justify-between items-start mb-10 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-black border-2 border-slate-800 rounded-none clip-path-slant text-slate-500 group-hover:text-intuition-primary group-hover:border-intuition-primary transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-2xl font-black font-display text-white group-hover:text-intuition-primary transition-colors tracking-tight uppercase leading-none mb-1">{title}</h3>
                        <div className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.3em] font-bold">{agents.length} Constituents Indexed</div>
                    </div>
                </div>
                <div className={`text-xs font-mono font-black px-3 py-1 border-2 clip-path-slant ${isUp ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5' : 'text-rose-400 border-rose-400/30 bg-rose-400/5'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-10 relative z-10">
                <div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1 font-bold">Composite Score</div>
                    <div className="text-5xl font-black text-white font-mono tracking-tighter text-glow-white">{value.toFixed(0)}</div>
                </div>
                <div className="h-16 opacity-60 group-hover:opacity-100 transition-all duration-700 -mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData}>
                            <Line 
                                type="monotone" 
                                dataKey="val" 
                                stroke={isUp ? '#00ff9d' : '#ff0055'} 
                                strokeWidth={3} 
                                dot={false} 
                                isAnimationActive={true}
                                animationDuration={1000}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="relative z-10 pt-6 border-t border-white/5">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-[9px] font-mono text-slate-500 uppercase font-black">Market Sentiment Heat</span>
                    <span className={`text-[10px] font-mono font-bold ${totalSentiment > 50 ? 'text-intuition-success' : 'text-intuition-danger'}`}>
                        {totalSentiment > 50 ? 'OPTIMISTIC' : 'SKEPTICAL'}
                    </span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-none overflow-hidden flex border border-white/5">
                    <div style={{ width: `${totalSentiment}%` }} className="h-full bg-intuition-success shadow-[0_0_10px_rgba(0,255,157,0.5)] transition-all duration-1000"></div>
                    <div className="h-full bg-intuition-danger shadow-[0_0_10px_rgba(255,0,85,0.5)] flex-1"></div>
                </div>
            </div>

            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={24} className="text-intuition-primary animate-pulse" />
            </div>
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
            setAgents(data);
            setLoading(false);
        });
    }, []);

    const categorizedAgents = useMemo(() => ({
        'FOUNDER': agents.filter(a => categorizeAgent(a) === 'FOUNDER'),
        'CREATOR': agents.filter(a => categorizeAgent(a) === 'CREATOR'),
        'MEME': agents.filter(a => categorizeAgent(a) === 'MEME'),
        'PROTOCOL': agents.filter(a => categorizeAgent(a) === 'PROTOCOL'),
        'AI': agents.filter(a => categorizeAgent(a) === 'AI'),
        'INVESTOR': agents.filter(a => categorizeAgent(a) === 'INVESTOR'),
        'UNKNOWN': []
    }), [agents]);

    const activeAgents = selectedCategory ? categorizedAgents[selectedCategory] : [];
    const indexMeta = useMemo(() => calculateIndexValue(activeAgents), [activeAgents]);

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-intuition-primary font-mono">
            <Zap className="animate-spin" size={48} />
            <div className="animate-pulse tracking-[0.4em] uppercase text-sm">Synchronizing_Market_Sectors...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-intuition-dark pt-12 pb-32 px-4 max-w-[1400px] mx-auto relative font-mono">
            <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>

            <div className="mb-16 relative z-10 border-b border-intuition-primary/20 pb-12">
                <h1 className="text-5xl md:text-7xl font-black text-white font-display tracking-tight mb-6 flex items-center gap-6 text-glow">
                    <Layers className="text-intuition-primary animate-pulse-fast" size={56} /> 
                    REPUTATION_INDEXES
                </h1>
                
                <div className="flex flex-col lg:flex-row gap-12 items-start">
                    <div className="flex-1">
                        <p className="text-intuition-primary/60 font-mono text-sm mb-8 max-w-2xl leading-relaxed uppercase tracking-widest">
                            {" >> "} Aggregate performance across specific semantic sectors. Track the collective conviction of the most influential entities in the trust graph.
                        </p>
                        
                        <div className="bg-black border border-intuition-primary/30 p-6 flex items-start gap-5 max-w-3xl clip-path-slant shadow-[0_0_30px_rgba(0,243,255,0.05)] group hover:border-intuition-primary/60 transition-all">
                            <Info className="text-intuition-primary shrink-0 mt-1" size={24} />
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Protocol_Methodology</h4>
                                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                    Index values represent the weighted average <span className="text-white">Trust Score</span> of constituent agents, normalized by sector volume and scaled by <span className="text-intuition-primary">Network Gravity (x42)</span>.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
                        <div className="bg-intuition-card p-6 border border-white/5 clip-path-slant min-w-[180px]">
                            <div className="text-[9px] text-slate-500 uppercase mb-2 font-bold tracking-widest">Macro Health</div>
                            <div className="text-2xl font-black text-white font-display uppercase">Stable</div>
                            <div className="text-[9px] text-intuition-success font-bold mt-1">UPLINK_SECURE</div>
                        </div>
                        <div className="bg-intuition-card p-6 border border-white/5 clip-path-slant min-w-[180px]">
                            <div className="text-[9px] text-slate-500 uppercase mb-2 font-bold tracking-widest">Active Corridors</div>
                            <div className="text-2xl font-black text-white font-display">{Object.values(categorizedAgents).filter(a => a.length > 0).length} SECTORS</div>
                            <div className="text-[9px] text-intuition-primary font-bold mt-1">PRIMARY_LAYER</div>
                        </div>
                    </div>
                </div>
            </div>

            {selectedCategory ? (
                <div className="animate-in fade-in slide-in-from-right-10 duration-700 relative z-10">
                    <button 
                        onClick={() => { playClick(); setSelectedCategory(null); }} 
                        className="mb-10 flex items-center gap-3 text-slate-500 hover:text-white font-mono text-xs font-black hover:tracking-[0.2em] transition-all group"
                    >
                        <ArrowRight size={16} className="rotate-180 group-hover:text-intuition-primary" /> RETURN_TO_SECTORS
                    </button>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                        <div className="lg:col-span-2 bg-black border-2 border-intuition-primary p-12 clip-path-slant relative overflow-hidden shadow-[0_0_60px_rgba(0,243,255,0.15)]">
                            <div className="absolute inset-0 bg-gradient-to-br from-intuition-primary/10 via-transparent to-transparent pointer-events-none"></div>
                            
                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-8">
                                <div>
                                    <div className="text-xs font-black font-mono text-intuition-primary mb-2 uppercase tracking-[0.4em]">Sector Profile</div>
                                    <h2 className="text-5xl font-black font-display text-white mb-6 tracking-tighter uppercase leading-none">{selectedCategory} ALPHA INDEX</h2>
                                    <div className="flex gap-10">
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Composite Score</div>
                                            <div className="text-7xl font-black text-white font-mono tracking-tighter text-glow-white">
                                                {indexMeta?.value.toFixed(2)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">24H Dynamics</div>
                                            <div className={`text-3xl font-black font-mono mt-3 ${indexMeta && indexMeta.change >= 0 ? 'text-intuition-success' : 'text-intuition-danger'}`}>
                                                {indexMeta && (indexMeta.change >= 0 ? '▲ +' : '▼ ')}{indexMeta?.change.toFixed(2)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 bg-white/5 border border-white/10 rounded-sm font-mono text-right min-w-[200px]">
                                    <div className="text-[10px] text-slate-500 uppercase mb-3">Sector Dominance</div>
                                    <div className="text-2xl font-black text-white">{(activeAgents.length / agents.length * 100).toFixed(1)}%</div>
                                    <div className="text-[9px] text-slate-600 mt-1 italic">Network Weight</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#05080f] border border-intuition-border p-8 clip-path-slant flex flex-col justify-between group hover:border-intuition-primary transition-all">
                             <div>
                                <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                    <BarChart3 size={16} className="text-intuition-primary"/> Performance Forecast
                                </h4>
                                <p className="text-sm text-slate-400 leading-relaxed font-medium italic">
                                    "{indexMeta.forecast}"
                                </p>
                             </div>
                             <div className="mt-8 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-600 uppercase font-black">Volatility Index</span>
                                    <span className="text-xl font-black text-white uppercase">{indexMeta.volatility}</span>
                                </div>
                                <div className="flex gap-1">
                                    {[1,2,3,4,5].map(i => (
                                        <div 
                                            key={i} 
                                            className={`w-1.5 h-6 clip-path-slant transition-all duration-700 ${i <= indexMeta.volatilityLevel ? 'bg-intuition-primary shadow-[0_0_8px_#00f3ff]' : 'bg-slate-800'}`}
                                        ></div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    </div>

                    <div className="bg-black border border-intuition-border clip-path-slant overflow-hidden shadow-2xl">
                        <div className="px-10 py-6 bg-intuition-card border-b border-intuition-border font-mono text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex justify-between items-center">
                            <span className="flex items-center gap-3"><Users size={14}/> SECTOR_CONSTITUENTS</span>
                            <span>INDEX_ALLOCATION</span>
                        </div>
                        <div className="divide-y divide-white/5">
                            {activeAgents.length > 0 ? activeAgents.map((agent, i) => {
                                const trust = calculateTrustScore(agent.totalAssets || '0', agent.totalShares || '0');
                                return (
                                    <Link 
                                        key={agent.id} 
                                        to={`/markets/${agent.id}`}
                                        className="flex items-center justify-between px-10 py-6 hover:bg-intuition-primary/5 transition-all group relative overflow-hidden"
                                    >
                                        <div className="absolute left-0 top-0 h-full w-1 bg-intuition-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-500"></div>
                                        
                                        <div className="flex items-center gap-8 relative z-10">
                                            <span className="font-mono text-slate-700 font-black text-lg w-8 tracking-tighter">{(i + 1).toString().padStart(2, '0')}</span>
                                            <div className="w-14 h-14 bg-black border-2 border-slate-800 flex items-center justify-center overflow-hidden clip-path-slant group-hover:border-intuition-primary transition-all">
                                                {agent.image ? <img src={agent.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" /> : <Shield className="text-slate-700" />}
                                            </div>
                                            <div>
                                                <div className="text-xl font-black font-display tracking-tight uppercase leading-none mb-1 text-white group-hover:text-intuition-primary transition-colors">{agent.label}</div>
                                                <div className="flex items-center gap-3 text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                                                    <span>Trust: {trust.toFixed(1)}</span>
                                                    <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
                                                    <span className="text-intuition-primary/60">ID: {agent.id.slice(0, 12)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="text-right relative z-10">
                                            <div className="text-2xl font-black text-white font-mono tracking-tighter group-hover:text-glow transition-all">
                                                {(100 / activeAgents.length + (Math.random() * 0.2 - 0.1)).toFixed(2)}%
                                            </div>
                                            <div className="text-[9px] font-mono font-black text-slate-600 uppercase tracking-widest flex items-center justify-end gap-2">
                                                WEIGHT <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            }) : (
                                <div className="p-32 text-center text-slate-700 font-mono border-2 border-dashed border-slate-900 m-8 bg-[#02040a] flex flex-col items-center gap-6">
                                    <AlertCircle size={48} className="opacity-20" />
                                    <div className="tracking-[0.5em] uppercase text-xs">NO_ACTIVE_CONSTITUENTS</div>
                                    <button onClick={() => setSelectedCategory(null)} className="px-6 py-2 border border-slate-800 text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">Reset</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    <IndexCard 
                        title="FOUNDERS_50" 
                        agents={categorizedAgents['FOUNDER']} 
                        icon={<User size={32} />} 
                        onSelect={() => setSelectedCategory('FOUNDER')}
                    />
                    <IndexCard 
                        title="PROTOCOL_ALPHA" 
                        agents={categorizedAgents['PROTOCOL']} 
                        icon={<Globe size={32} />} 
                        onSelect={() => setSelectedCategory('PROTOCOL')}
                    />
                    <IndexCard 
                        title="CREATOR_ECON" 
                        agents={categorizedAgents['CREATOR']} 
                        icon={<Activity size={32} />} 
                        onSelect={() => setSelectedCategory('CREATOR')}
                    />
                    <IndexCard 
                        title="MEME_VELOCITY" 
                        agents={categorizedAgents['MEME']} 
                        icon={<Hash size={32} />} 
                        onSelect={() => setSelectedCategory('MEME')}
                    />
                </div>
            )}
        </div>
    );
};

export default Indexes;