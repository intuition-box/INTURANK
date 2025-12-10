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
            className={`relative flex-1 bg-black border-2 p-8 flex flex-col items-center justify-center min-h-[350px] clip-path-slant transition-all duration-300 hover:bg-slate-900/50 group cursor-pointer ${isWinner ? 'border-intuition-success shadow-[0_0_40px_rgba(0,255,157,0.2)]' : 'border-slate-800 hover:border-intuition-primary/50'}`}
            onClick={() => { playClick(); onSelect(); }}
            onMouseEnter={playHover}
        >
            <div className="absolute top-4 left-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-black px-2 py-1 border border-slate-800">{label}</div>
            
            {/* Background Glow */}
            {agent && (
                <div className={`absolute inset-0 bg-gradient-to-b ${isWinner ? 'from-intuition-success/10' : 'from-intuition-primary/5'} to-transparent opacity-50 pointer-events-none`}></div>
            )}

            {agent ? (
                <>
                    <div className={`w-32 h-32 mb-6 rounded-full border-2 overflow-hidden group-hover:scale-110 transition-transform duration-500 relative z-10 ${isWinner ? 'border-intuition-success shadow-[0_0_20px_rgba(0,255,157,0.5)]' : 'border-white/10 shadow-lg'}`}>
                        {agent.image ? <img src={agent.image} className="w-full h-full object-cover" /> : (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-2xl text-slate-500">?</div>
                        )}
                    </div>
                    
                    <h2 className="text-3xl font-black font-display text-white text-center mb-2 z-10 text-glow">{agent.label}</h2>
                    
                    <div className={`text-5xl font-black z-10 ${isWinner ? 'text-intuition-success drop-shadow-[0_0_15px_rgba(0,255,157,0.8)]' : 'text-slate-500'}`}>
                        {score.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1 z-10 uppercase tracking-widest">TRUST SCORE</div>
                    
                    <Link 
                        to={`/markets/${agent.id}`} 
                        onClick={(e) => e.stopPropagation()}
                        className="mt-8 px-6 py-2 border border-slate-700 text-slate-400 text-xs font-mono font-bold hover:text-white hover:border-intuition-primary hover:bg-intuition-primary/10 transition-colors z-10 clip-path-slant"
                    >
                        VIEW PROFILE
                    </Link>
                </>
            ) : (
                <div className="flex flex-col items-center text-slate-600 group-hover:text-intuition-primary transition-colors z-10">
                    <Search size={64} className="mb-4 opacity-50 animate-pulse" />
                    <span className="font-mono text-sm tracking-widest">SELECT_AGENT</span>
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

    // Calculate relative bars
    const max = Math.max(lNum, rNum);
    const leftPercent = max > 0 ? (lNum / max) * 100 : 0;
    const rightPercent = max > 0 ? (rNum / max) * 100 : 0;

    return (
        <div className="flex items-center justify-between py-6 border-b border-white/5 hover:bg-white/5 px-6 transition-colors group relative overflow-hidden">
            {/* Visual Bars Background */}
            <div className="absolute left-0 top-0 bottom-0 bg-intuition-primary/5 transition-all duration-1000" style={{ width: `${leftPercent / 2.5}%` }}></div>
            <div className="absolute right-0 top-0 bottom-0 bg-intuition-primary/5 transition-all duration-1000" style={{ width: `${rightPercent / 2.5}%` }}></div>

            <div className={`font-mono font-bold text-xl w-1/3 text-right relative z-10 ${leftWins ? 'text-intuition-success text-glow-success' : 'text-slate-500'}`}>
                {Number(leftVal).toLocaleString()} <span className="text-xs text-slate-600">{unit}</span>
            </div>
            
            <div className="flex flex-col items-center w-1/3 px-4 relative z-10">
                <div className="text-slate-500 mb-1 group-hover:text-white transition-colors">{icon}</div>
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest text-center">{label}</div>
            </div>

            <div className={`font-mono font-bold text-xl w-1/3 text-left relative z-10 ${rightWins ? 'text-intuition-success text-glow-success' : 'text-slate-500'}`}>
                {Number(rightVal).toLocaleString()} <span className="text-xs text-slate-600">{unit}</span>
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
        <div className="min-h-screen bg-intuition-dark pt-12 pb-20 px-4 max-w-7xl mx-auto">
            
            <div className="flex items-center justify-between mb-12">
                <h1 className="text-4xl font-black text-white font-display tracking-tight flex items-center gap-4 text-glow">
                    <ArrowRightLeft className="text-intuition-primary" size={40} /> AGENT_COMPARISON
                </h1>
                <div className="hidden md:block text-xs font-mono text-intuition-primary border border-intuition-primary px-3 py-1 rounded bg-intuition-primary/10">
                    HEAD-TO-HEAD MODE
                </div>
            </div>

            {/* Main Stage */}
            <div className="flex flex-col md:flex-row gap-8 relative mb-16 items-stretch">
                <AgentCard 
                    label="CHALLENGER A"
                    agent={leftAgent} 
                    onSelect={() => setIsSelectorOpen('LEFT')} 
                    isWinner={leftAgent && rightAgent && calculateTrustScore(leftAgent.totalAssets || '0', leftAgent.totalShares || '0') > calculateTrustScore(rightAgent.totalAssets || '0', rightAgent.totalShares || '0')}
                />
                
                {/* Swap Button Absolute Center with Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-intuition-primary rounded-full blur-lg opacity-50 group-hover:opacity-100 transition-opacity animate-pulse"></div>
                        <button 
                            onClick={handleSwap}
                            className="relative w-16 h-16 bg-black border-2 border-intuition-primary rounded-full flex items-center justify-center text-white hover:text-black hover:bg-intuition-primary transition-all duration-300 hover:scale-110 shadow-[0_0_30px_rgba(0,243,255,0.5)]"
                        >
                            <span className="font-black font-display text-xl italic">VS</span>
                        </button>
                    </div>
                </div>

                <AgentCard 
                    label="CHALLENGER B"
                    agent={rightAgent} 
                    onSelect={() => setIsSelectorOpen('RIGHT')} 
                    isWinner={rightAgent && leftAgent && calculateTrustScore(rightAgent.totalAssets || '0', rightAgent.totalShares || '0') > calculateTrustScore(leftAgent.totalAssets || '0', leftAgent.totalShares || '0')}
                />
            </div>

            {/* Metrics Grid */}
            {leftAgent && rightAgent && (
                <div className="grid grid-cols-1 gap-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    
                    {/* Data Table */}
                    <div className="bg-black border border-intuition-border clip-path-slant shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                        <div className="bg-intuition-card p-3 border-b border-intuition-border text-center text-xs font-mono font-bold text-slate-400 uppercase tracking-[0.2em]">
                            Performance Telemetry
                        </div>
                        
                        <ComparisonRow 
                            label="TVL (Liquidity)" 
                            leftVal={parseFloat(formatEther(BigInt(leftAgent.totalAssets || '0'))).toFixed(2)} 
                            rightVal={parseFloat(formatEther(BigInt(rightAgent.totalAssets || '0'))).toFixed(2)}
                            unit="TRUST"
                            icon={<Shield size={20} />}
                        />
                        <ComparisonRow 
                            label="Volatility" 
                            leftVal={calculateVolatility(leftAgent.totalAssets || '0').toFixed(0)} 
                            rightVal={calculateVolatility(rightAgent.totalAssets || '0').toFixed(0)}
                            unit="VIX"
                            icon={<Activity size={20} />}
                        />
                        <ComparisonRow 
                            label="Share Supply" 
                            leftVal={parseFloat(formatEther(BigInt(leftAgent.totalShares || '0'))).toFixed(4)} 
                            rightVal={parseFloat(formatEther(BigInt(rightAgent.totalShares || '0'))).toFixed(4)}
                            icon={<Users size={20} />}
                        />
                        <ComparisonRow 
                            label="Momentum" 
                            leftVal={(Math.random() * 100).toFixed(0)} 
                            rightVal={(Math.random() * 100).toFixed(0)}
                            unit="pts"
                            icon={<Zap size={20} />}
                        />
                    </div>

                    {/* Comparative Chart */}
                    <div className="bg-black border border-intuition-border p-8 h-[450px] clip-path-slant relative neon-panel">
                        <div className="absolute top-6 left-6 z-10 flex gap-6 text-xs font-mono font-bold">
                            <span className="text-intuition-primary flex items-center gap-2 bg-intuition-primary/10 px-3 py-1 rounded border border-intuition-primary/30">
                                <div className="w-2 h-2 bg-intuition-primary rounded-full shadow-[0_0_5px_currentColor]"></div> {leftAgent.label}
                            </span>
                            <span className="text-intuition-secondary flex items-center gap-2 bg-intuition-secondary/10 px-3 py-1 rounded border border-intuition-secondary/30">
                                <div className="w-2 h-2 bg-intuition-secondary rounded-full shadow-[0_0_5px_currentColor]"></div> {rightAgent.label}
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorLeft" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorRight" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0066ff" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#0066ff" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#05080f', border: '1px solid #00f3ff', boxShadow: '0 0 20px rgba(0,243,255,0.2)' }}
                                    itemStyle={{ fontSize: '12px', fontFamily: 'monospace' }}
                                />
                                <Area type="monotone" dataKey="left" stroke="#00f3ff" strokeWidth={3} fillOpacity={1} fill="url(#colorLeft)" activeDot={{r: 6, fill: '#fff', stroke: '#00f3ff'}} />
                                <Area type="monotone" dataKey="right" stroke="#0066ff" strokeWidth={3} fillOpacity={1} fill="url(#colorRight)" activeDot={{r: 6, fill: '#fff', stroke: '#0066ff'}} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                </div>
            )}

            {/* Selector Modal */}
            {isSelectorOpen && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsSelectorOpen(null)}>
                    <div className="w-full max-w-lg bg-[#05080f] border border-intuition-primary shadow-[0_0_50px_rgba(0,243,255,0.15)] p-6 clip-path-slant" onClick={e => e.stopPropagation()}>
                        <div className="mb-6 relative">
                            <input 
                                type="text" 
                                placeholder="SEARCH AGENT DATABASE..." 
                                autoFocus
                                className="w-full bg-black border border-slate-700 p-4 pl-12 text-white font-mono text-sm focus:border-intuition-primary outline-none transition-all shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {filteredAgents.map(a => (
                                <button 
                                    key={a.id}
                                    onClick={() => handleSelect(a)}
                                    className="w-full flex items-center gap-4 p-3 hover:bg-intuition-primary/10 border border-transparent hover:border-intuition-primary/30 transition-all text-left group rounded-sm"
                                >
                                    <div className="w-10 h-10 bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 group-hover:border-intuition-primary transition-colors">
                                        {a.image ? <img src={a.image} className="w-full h-full object-cover"/> : a.label?.[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white group-hover:text-intuition-primary group-hover:text-glow">{a.label}</div>
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