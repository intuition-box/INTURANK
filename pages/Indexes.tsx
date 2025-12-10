import React, { useEffect, useState } from 'react';
import { getAllAgents } from '../services/graphql';
import { Account } from '../types';
import { categorizeAgent, calculateIndexValue, AgentCategory } from '../services/analytics';
import { TrendingUp, Layers, ChevronRight, Activity, Globe, User, Hash, Info, ExternalLink } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
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
    
    // Mock sparkline based on index value
    const sparkData = Array.from({length: 20}, (_, i) => ({
        val: value + (Math.random() - 0.5) * (value * 0.05)
    }));

    return (
        <div 
            onClick={() => { playClick(); onSelect(); }}
            onMouseEnter={playHover}
            className="group relative bg-[#05080f] border border-intuition-border p-8 clip-path-slant hover:border-intuition-primary transition-all cursor-pointer overflow-hidden hover:shadow-[0_0_30px_rgba(0,243,255,0.15)]"
        >
            {/* Hover Glow Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-intuition-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="p-4 bg-black border border-slate-800 rounded-lg text-slate-400 group-hover:text-intuition-primary group-hover:border-intuition-primary transition-all shadow-lg">
                    {icon}
                </div>
                <div className={`text-xs font-mono font-bold px-2 py-1 rounded border ${isUp ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-400 border-rose-500/30 bg-rose-500/10'}`}>
                    {isUp ? '+' : ''}{change.toFixed(2)}%
                </div>
            </div>
            
            <h3 className="text-2xl font-black font-display text-white mb-2 group-hover:text-intuition-primary transition-colors group-hover:text-glow relative z-10">{title}</h3>
            <div className="text-xs font-mono text-slate-500 mb-8 uppercase tracking-wider relative z-10">{agents.length} Constituents</div>
            
            <div className="flex justify-between items-end relative z-10">
                <div>
                    <div className="text-4xl font-bold text-white font-mono tracking-tight">{value.toFixed(0)}</div>
                    <div className="text-[10px] font-mono text-slate-600 uppercase mt-1">Composite Score</div>
                </div>
                <div className="w-32 h-12 opacity-50 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData}>
                            <Line type="monotone" dataKey="val" stroke={isUp ? '#34d399' : '#fb7185'} strokeWidth={3} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const Indexes: React.FC = () => {
    const [agents, setAgents] = useState<Account[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<AgentCategory | null>(null);

    useEffect(() => {
        getAllAgents().then(setAgents);
    }, []);

    const categorizedAgents = {
        'FOUNDER': agents.filter(a => categorizeAgent(a) === 'FOUNDER'),
        'CREATOR': agents.filter(a => categorizeAgent(a) === 'CREATOR'),
        'MEME': agents.filter(a => categorizeAgent(a) === 'MEME'),
        'PROTOCOL': agents.filter(a => categorizeAgent(a) === 'PROTOCOL'),
        'UNKNOWN': []
    };

    const activeAgents = selectedCategory ? categorizedAgents[selectedCategory] : [];

    return (
        <div className="min-h-screen bg-intuition-dark pt-12 pb-20 px-4 max-w-7xl mx-auto">
            <div className="mb-12">
                <h1 className="text-5xl font-black text-white font-display tracking-tight mb-4 flex items-center gap-4 text-glow">
                    <Layers className="text-intuition-primary animate-pulse-fast" size={48} /> REPUTATION_INDEXES
                </h1>
                <p className="text-intuition-primary/60 font-mono text-sm mb-6 max-w-2xl">
                    Sector-specific aggregate performance. Track the collective trust sentiment of entire ecosystems.
                </p>
                
                <div className="bg-black/50 border border-intuition-primary/30 p-4 rounded-sm flex items-start gap-4 max-w-3xl clip-path-slant shadow-[0_0_15px_rgba(0,243,255,0.1)]">
                    <Info className="text-intuition-primary shrink-0 mt-1" size={20} />
                    <p className="text-xs text-slate-300 font-mono leading-relaxed">
                        <strong className="text-white">Index Logic:</strong> Values represent the weighted average "Trust Score" of the top agents in each category, scaled by a factor of 42. A higher index indicates stronger collective reputation.
                    </p>
                </div>
            </div>

            {selectedCategory ? (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                    <button 
                        onClick={() => { playClick(); setSelectedCategory(null); }} 
                        className="mb-8 flex items-center gap-2 text-slate-500 hover:text-white font-mono text-xs hover:tracking-widest transition-all"
                    >
                        &larr; RETURN_TO_SECTORS
                    </button>
                    
                    <div className="bg-black border-2 border-intuition-primary p-10 mb-8 clip-path-slant relative overflow-hidden shadow-[0_0_40px_rgba(0,243,255,0.2)]">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-intuition-primary/10 rounded-full blur-[80px] pointer-events-none"></div>
                        
                        <div className="relative z-10">
                            <h2 className="text-4xl font-black font-display text-white mb-2">{selectedCategory} INDEX</h2>
                            <div className="text-8xl font-bold text-white font-mono tracking-tighter text-glow-white">
                                {calculateIndexValue(activeAgents).value.toFixed(2)}
                            </div>
                            <div className="text-sm font-mono text-intuition-primary mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Activity size={16} /> Composite Sector Score
                            </div>
                        </div>
                    </div>

                    <div className="bg-black border border-intuition-border clip-path-slant neon-panel">
                        <div className="px-8 py-5 bg-intuition-card border-b border-intuition-border font-mono text-xs font-bold text-slate-500 uppercase tracking-widest flex justify-between">
                            <span>Constituent Agent</span>
                            <span>Weight</span>
                        </div>
                        {activeAgents.length > 0 ? activeAgents.map((agent, i) => (
                            <Link 
                                key={agent.id} 
                                to={`/markets/${agent.id}`}
                                className="flex items-center justify-between px-8 py-5 border-b border-white/5 hover:bg-intuition-primary/10 transition-colors group relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 h-full w-1 bg-intuition-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-300"></div>
                                
                                <div className="flex items-center gap-6">
                                    <span className="font-mono text-slate-600 w-8">{(i + 1).toString().padStart(2, '0')}</span>
                                    <div className="w-12 h-12 bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 group-hover:border-intuition-primary transition-colors">
                                        {agent.image ? <img src={agent.image} className="w-full h-full object-cover" /> : null}
                                    </div>
                                    <div className="font-bold text-lg text-white group-hover:text-intuition-primary transition-colors font-display tracking-wide">{agent.label}</div>
                                </div>
                                <div className="font-mono text-white text-lg font-bold flex items-center gap-2">
                                    {(Math.random() * 5).toFixed(2)}% <ExternalLink size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                </div>
                            </Link>
                        )) : (
                            <div className="p-16 text-center text-slate-500 font-mono border-2 border-dashed border-slate-800 m-4">
                                NO AGENTS INDEXED IN THIS SECTOR YET.
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                    <IndexCard 
                        title="FOUNDERS 50" 
                        agents={categorizedAgents['FOUNDER']} 
                        icon={<User size={32} />} 
                        onSelect={() => setSelectedCategory('FOUNDER')}
                    />
                    <IndexCard 
                        title="CREATOR ECON" 
                        agents={categorizedAgents['CREATOR']} 
                        icon={<Activity size={32} />} 
                        onSelect={() => setSelectedCategory('CREATOR')}
                    />
                    <IndexCard 
                        title="MEME ALPHA" 
                        agents={categorizedAgents['MEME']} 
                        icon={<Hash size={32} />} 
                        onSelect={() => setSelectedCategory('MEME')}
                    />
                    <IndexCard 
                        title="DEFI PROTOCOLS" 
                        agents={categorizedAgents['PROTOCOL']} 
                        icon={<Globe size={32} />} 
                        onSelect={() => setSelectedCategory('PROTOCOL')}
                    />
                </div>
            )}
        </div>
    );
};

export default Indexes;