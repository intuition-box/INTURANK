import React, { useEffect, useState } from 'react';
import { getAllAgents } from '../services/graphql';
import { Account } from '../types';
import { categorizeAgent, calculateIndexValue, AgentCategory } from '../services/analytics';
import { TrendingUp, Layers, ChevronRight, Activity, Globe, User, Hash, Info } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { playClick } from '../services/audio';

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
            className="bg-black border border-intuition-border p-6 clip-path-slant hover:border-intuition-primary hover:-translate-y-1 transition-all cursor-pointer group"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-intuition-primary/10 rounded border border-intuition-primary/30 text-intuition-primary group-hover:text-white group-hover:bg-intuition-primary transition-colors">
                    {icon}
                </div>
                <div className={`text-xs font-mono font-bold px-2 py-1 rounded border ${isUp ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-400 border-rose-500/30 bg-rose-500/10'}`}>
                    {isUp ? '+' : ''}{change.toFixed(2)}%
                </div>
            </div>
            
            <h3 className="text-xl font-black font-display text-white mb-1 group-hover:text-intuition-primary transition-colors">{title}</h3>
            <div className="text-sm font-mono text-slate-500 mb-6">{agents.length} Constituents</div>
            
            <div className="flex justify-between items-end">
                <div>
                    <div className="text-3xl font-bold text-white font-mono">{value.toFixed(0)}</div>
                    <div className="text-[8px] font-mono text-slate-600 uppercase mt-1">Composite Rep Score</div>
                </div>
                <div className="w-24 h-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData}>
                            <Line type="monotone" dataKey="val" stroke={isUp ? '#34d399' : '#fb7185'} strokeWidth={2} dot={false} />
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
        <div className="min-h-screen bg-intuition-dark pt-8 pb-20 px-4 max-w-7xl mx-auto">
            <div className="mb-10">
                <h1 className="text-4xl font-black text-white font-display tracking-wide mb-2 flex items-center gap-3">
                    <Layers className="text-intuition-primary" size={40} /> REPUTATION_INDEXES
                </h1>
                <p className="text-intuition-primary/60 font-mono text-sm mb-4">Aggregated semantic performance across sectors.</p>
                
                <div className="bg-intuition-card border border-intuition-border p-4 rounded-lg flex items-start gap-3 max-w-2xl">
                    <Info className="text-intuition-primary shrink-0" size={18} />
                    <p className="text-xs text-slate-400 font-mono leading-relaxed">
                        <strong className="text-white">Index Value:</strong> Represents the weighted average "Trust Score" of the top agents in each category, scaled by a factor of 42. A higher index indicates stronger collective reputation and higher average staking conviction for that sector.
                    </p>
                </div>
            </div>

            {selectedCategory ? (
                <div className="animate-in fade-in slide-in-from-right-8">
                    <button 
                        onClick={() => setSelectedCategory(null)} 
                        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-white font-mono text-xs"
                    >
                        &larr; BACK_TO_OVERVIEW
                    </button>
                    
                    <div className="bg-black border border-intuition-primary/50 p-8 mb-8 clip-path-slant relative overflow-hidden">
                        <div className="absolute inset-0 bg-intuition-primary/5 pointer-events-none"></div>
                        <h2 className="text-3xl font-black font-display text-white mb-2">{selectedCategory} INDEX</h2>
                        <div className="text-6xl font-bold text-white font-mono tracking-tighter">
                            {calculateIndexValue(activeAgents).value.toFixed(2)}
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-2 uppercase tracking-widest">Composite Sector Score</div>
                    </div>

                    <div className="bg-black border border-intuition-border clip-path-slant">
                        <div className="px-6 py-4 bg-intuition-card border-b border-intuition-border font-mono text-xs font-bold text-slate-500 uppercase tracking-widest flex justify-between">
                            <span>Constituent Agent</span>
                            <span>Weight</span>
                        </div>
                        {activeAgents.length > 0 ? activeAgents.map((agent, i) => (
                            <Link 
                                key={agent.id} 
                                to={`/markets/${agent.id}`}
                                className="flex items-center justify-between px-6 py-4 border-b border-white/5 hover:bg-intuition-primary/10 transition-colors group"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="font-mono text-slate-500 w-6">{(i + 1).toString().padStart(2, '0')}</span>
                                    <div className="w-10 h-10 bg-slate-800 rounded-full overflow-hidden">
                                        {agent.image ? <img src={agent.image} className="w-full h-full object-cover" /> : null}
                                    </div>
                                    <div className="font-bold text-white group-hover:text-intuition-primary transition-colors">{agent.label}</div>
                                </div>
                                <div className="font-mono text-white">
                                    {(Math.random() * 5).toFixed(2)}%
                                </div>
                            </Link>
                        )) : (
                            <div className="p-12 text-center text-slate-500 font-mono">NO AGENTS INDEXED IN THIS SECTOR YET.</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    <IndexCard 
                        title="FOUNDERS 50" 
                        agents={categorizedAgents['FOUNDER']} 
                        icon={<User size={24} />} 
                        onSelect={() => setSelectedCategory('FOUNDER')}
                    />
                    <IndexCard 
                        title="CREATOR ECON" 
                        agents={categorizedAgents['CREATOR']} 
                        icon={<Activity size={24} />} 
                        onSelect={() => setSelectedCategory('CREATOR')}
                    />
                    <IndexCard 
                        title="MEME ALPHA" 
                        agents={categorizedAgents['MEME']} 
                        icon={<Hash size={24} />} 
                        onSelect={() => setSelectedCategory('MEME')}
                    />
                    <IndexCard 
                        title="DEFI PROTOCOLS" 
                        agents={categorizedAgents['PROTOCOL']} 
                        icon={<Globe size={24} />} 
                        onSelect={() => setSelectedCategory('PROTOCOL')}
                    />
                </div>
            )}
        </div>
    );
};

export default Indexes;