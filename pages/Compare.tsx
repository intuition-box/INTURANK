import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Search, TrendingUp, Shield, Activity, Zap, Users, Trophy } from 'lucide-react';
import { getAllAgents } from '../services/graphql';
import { Account } from '../types';
import { calculateTrustScore, calculateVolatility } from '../services/analytics';
import { formatEther } from 'viem';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { playClick, playHover } from '../services/audio';
import { Link } from 'react-router-dom';

const AgentCard: React.FC<{ 
    agent: Account | null, 
    onSelect: () => void, 
    isWinner?: boolean,
    label: string 
}> = ({ agent, onSelect, isWinner, label }) => {
    const score = agent ? calculateTrustScore(agent.totalAssets || '0', agent.totalShares || '0') : 0;
    
    return (
        <div 
            className={`relative flex-1 bg-black border-2 p-6 flex flex-col items-center justify-center min-h-[300px] clip-path-slant transition-all hover:bg-slate-900/50 group ${isWinner ? 'border-intuition-success shadow-[0_0_30px_rgba(0,255,157,0.2)]' : 'border-slate-800'}`}
            onClick={onSelect}
        >
            <div className="absolute top-4 left-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">{label}</div>
            
            {agent ? (
                <>
                    <div className="w-24 h-24 mb-6 rounded-full border-2 border-white/10 overflow-hidden group-hover:scale-110 transition-transform">
                        {agent.image ? <img src={agent.image} className="w-full h-full object-cover" /> : (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-2xl">?</div>
                        )}
                    </div>
                    <h2 className="text-2xl font-black font-display text-white text-center mb-2">{agent.label}</h2>
                    <div className={`text-4xl font-black ${isWinner ? 'text-intuition-success' : 'text-slate-500'}`}>
                        {score.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">TRUST SCORE</div>
                    
                    <Link 
                        to={`/markets/${agent.id}`} 
                        onClick={(e) => e.stopPropagation()}
                        className="mt-6 px-4 py-2 border border-slate-700 text-slate-400 text-xs font-mono hover:text-white hover:border-white transition-colors z-10"
                    >
                        FULL_PROFILE
                    </Link>
                </>
            ) : (
                <div className="flex flex-col items-center text-slate-600 group-hover:text-intuition-primary transition-colors cursor-pointer">
                    <Search size={48} className="mb-4 opacity-50" />
                    <span className="font-mono text-sm">SELECT_AGENT</span>
                </div>
            )}
        </div>
    );
};

const ComparisonRow: React.FC<{ 
    label: string, 
    leftVal: string | number, 
    rightVal: string | number, 
    unit?: string,
    icon: React.ReactNode 
}> = ({ label, leftVal, rightVal, unit = '', icon }) => {
    const lNum = parseFloat(leftVal.toString());
    const rNum = parseFloat(rightVal.toString());
    const leftWins = lNum > rNum;
    const rightWins = rNum > lNum;

    return (
        <div className="flex items-center justify-between py-4 border-b border-white/5 hover:bg-white/5 px-4 transition-colors">
            <div className={`font-mono font-bold text-lg w-1/3 text-right ${leftWins ? 'text-intuition-success' : 'text-slate-500'}`}>
                {Number(leftVal).toLocaleString()} {unit}
            </div>
            
            <div className="flex flex-col items-center w-1/3 px-2">
                <div className="text-slate-500 mb-1">{icon}</div>
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider text-center">{label}</div>
            </div>

            <div className={`font-mono font-bold text-lg w-1/3 text-left ${rightWins ? 'text-intuition-success' : 'text-slate-500'}`}>
                {Number(rightVal).toLocaleString()} {unit}
            </div>
        </div>
    );
};

const Compare: React.FC = () => {
    const [agents, setAgents] = useState<Account[]>([]);
    const [leftAgent, setLeftAgent] = useState<Account | null>(null);
    const [rightAgent, setRightAgent] = useState<Account | null>(null);
    const [isSelectorOpen, setIsSelectorOpen] = useState<'LEFT' | 'RIGHT' | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        getAllAgents().then(setAgents);
    }, []);

    const handleSelect = (agent: Account) => {
        if (isSelectorOpen === 'LEFT') setLeftAgent(agent);
        if (isSelectorOpen === 'RIGHT') setRightAgent(agent);
        setIsSelectorOpen(null);
        setSearch('');
        playClick();
    };

    const handleSwap = () => {
        const temp = leftAgent;
        setLeftAgent(rightAgent);
        setRightAgent(temp);
        playClick();
    };

    // --- Synthetic History Generator for Comparison ---
    const generateComparisonHistory = () => {
        const data = [];
        let lScore = leftAgent ? calculateTrustScore(leftAgent.totalAssets || '0', leftAgent.totalShares || '0') : 50;
        let rScore = rightAgent ? calculateTrustScore(rightAgent.totalAssets || '0', rightAgent.totalShares || '0') : 50;
        
        for (let i = 20; i >= 0; i--) {
            data.push({
                time: `-${i}h`,
                left: Math.max(0, lScore + (Math.random() - 0.5) * 10),
                right: Math.max(0, rScore + (Math.random() - 0.5) * 10),
            });
        }
        return data;
    };

    const chartData = generateComparisonHistory();

    const filteredAgents = agents.filter(a => a.label?.toLowerCase().includes(search.toLowerCase()) || a.id.includes(search));

    return (
        <div className="min-h-screen bg-intuition-dark pt-8 pb-20 px-4 max-w-6xl mx-auto">
            
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-black text-white font-display tracking-tight flex items-center gap-3">
                    <ArrowRightLeft className="text-intuition-primary" /> AGENT_COMPARISON
                </h1>
            </div>

            {/* Main Stage */}
            <div className="flex flex-col md:flex-row gap-8 relative mb-12">
                <AgentCard 
                    label="AGENT A"
                    agent={leftAgent} 
                    onSelect={() => setIsSelectorOpen('LEFT')} 
                    isWinner={leftAgent && rightAgent && calculateTrustScore(leftAgent.totalAssets || '0', leftAgent.totalShares || '0') > calculateTrustScore(rightAgent.totalAssets || '0', rightAgent.totalShares || '0')}
                />
                
                {/* Swap Button Absolute Center */}
                <button 
                    onClick={handleSwap}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-black border border-intuition-primary rounded-full flex items-center justify-center hover:bg-intuition-primary hover:text-black transition-all hover:scale-110 shadow-[0_0_20px_rgba(0,243,255,0.3)]"
                >
                    <ArrowRightLeft size={20} />
                </button>

                <AgentCard 
                    label="AGENT B"
                    agent={rightAgent} 
                    onSelect={() => setIsSelectorOpen('RIGHT')} 
                    isWinner={rightAgent && leftAgent && calculateTrustScore(rightAgent.totalAssets || '0', rightAgent.totalShares || '0') > calculateTrustScore(leftAgent.totalAssets || '0', leftAgent.totalShares || '0')}
                />
            </div>

            {/* Metrics Grid */}
            {leftAgent && rightAgent && (
                <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-8">
                    
                    {/* Data Table */}
                    <div className="bg-black border border-intuition-border clip-path-slant">
                        <div className="bg-intuition-card p-2 border-b border-intuition-border text-center text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                            Head-to-Head Analytics
                        </div>
                        
                        <ComparisonRow 
                            label="TVL (Liquidity)" 
                            leftVal={parseFloat(formatEther(BigInt(leftAgent.totalAssets || '0'))).toFixed(2)} 
                            rightVal={parseFloat(formatEther(BigInt(rightAgent.totalAssets || '0'))).toFixed(2)}
                            unit="TRUST"
                            icon={<Shield size={16} />}
                        />
                        <ComparisonRow 
                            label="Volatility" 
                            leftVal={calculateVolatility(leftAgent.totalAssets || '0').toFixed(0)} 
                            rightVal={calculateVolatility(rightAgent.totalAssets || '0').toFixed(0)}
                            unit="VIX"
                            icon={<Activity size={16} />}
                        />
                        <ComparisonRow 
                            label="Share Supply" 
                            leftVal={parseFloat(formatEther(BigInt(leftAgent.totalShares || '0'))).toFixed(4)} 
                            rightVal={parseFloat(formatEther(BigInt(rightAgent.totalShares || '0'))).toFixed(4)}
                            icon={<Users size={16} />}
                        />
                        <ComparisonRow 
                            label="Momentum" 
                            leftVal={(Math.random() * 100).toFixed(0)} 
                            rightVal={(Math.random() * 100).toFixed(0)}
                            unit="pts"
                            icon={<Zap size={16} />}
                        />
                    </div>

                    {/* Comparative Chart */}
                    <div className="bg-black border border-intuition-border p-6 h-[400px] clip-path-slant relative">
                        <div className="absolute top-4 left-4 z-10 flex gap-4 text-xs font-mono font-bold">
                            <span className="text-intuition-primary flex items-center gap-1"><div className="w-2 h-2 bg-intuition-primary rounded-full"></div> {leftAgent.label}</span>
                            <span className="text-intuition-secondary flex items-center gap-1"><div className="w-2 h-2 bg-intuition-secondary rounded-full"></div> {rightAgent.label}</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorLeft" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorRight" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0066ff" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#0066ff" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid #1f2937' }}
                                    itemStyle={{ fontSize: '12px', fontFamily: 'monospace' }}
                                />
                                <Area type="monotone" dataKey="left" stroke="#00f3ff" strokeWidth={2} fillOpacity={1} fill="url(#colorLeft)" />
                                <Area type="monotone" dataKey="right" stroke="#0066ff" strokeWidth={2} fillOpacity={1} fill="url(#colorRight)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                </div>
            )}

            {/* Selector Modal */}
            {isSelectorOpen && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsSelectorOpen(null)}>
                    <div className="w-full max-w-lg bg-intuition-dark border border-intuition-primary p-6 clip-path-slant" onClick={e => e.stopPropagation()}>
                        <div className="mb-4">
                            <input 
                                type="text" 
                                placeholder="SEARCH AGENT..." 
                                autoFocus
                                className="w-full bg-black border border-slate-700 p-3 text-white font-mono focus:border-intuition-primary outline-none"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto space-y-2">
                            {filteredAgents.map(a => (
                                <button 
                                    key={a.id}
                                    onClick={() => handleSelect(a)}
                                    className="w-full flex items-center gap-4 p-3 hover:bg-white/5 border border-transparent hover:border-intuition-primary/30 transition-all text-left group"
                                >
                                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center overflow-hidden">
                                        {a.image ? <img src={a.image} className="w-full h-full object-cover"/> : a.label?.[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white group-hover:text-intuition-primary">{a.label}</div>
                                        <div className="text-[10px] text-slate-500 font-mono">{a.id.slice(0,8)}...</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Compare;