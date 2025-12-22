
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRightLeft, Search, TrendingUp, Shield, Activity, Zap, Users, Trophy, Brain, Flame, Sword, Info, Loader2, Sparkles, Quote, Terminal, ChevronRight } from 'lucide-react';
import { getAllAgents, getAgentTriples } from '../services/graphql';
import { Account, Triple } from '../types';
import { calculateTrustScore, calculateVolatility } from '../services/analytics';
import { formatEther } from 'viem';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { playClick, playHover } from '../services/audio';
import { Link } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-3-flash-preview';

// AI Rivalry Analysis Component
const RivalryAnalysis: React.FC<{ left: Account; right: Account; lScore: number; rScore: number }> = ({ left, right, lScore, rScore }) => {
    const [analysis, setAnalysis] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const generateAnalysis = async () => {
        setLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
                Perform a high-stakes competitive analysis between two reputation-based assets in a trust graph.
                Entity A: ${left.label} (Score: ${lScore.toFixed(1)}, Type: ${left.type})
                Entity B: ${right.label} (Score: ${rScore.toFixed(1)}, Type: ${right.type})
                
                Scenario: They are competing for semantic dominance in the Intuition Network.
                Winner Projection: ${lScore > rScore ? left.label : right.label} currently leads.
                
                Provide a 3-sentence "Combat Report" in a gritty, techno-financial style. 
                Use terms like "Liquidity Front", "Semantic Friction", and "Conviction Attack".
            `;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
            });
            setAnalysis(response.text || 'Synthesis incomplete. Tactical data corrupted.');
        } catch (e) {
            setAnalysis('AI Uplink severed. Manual calculation required.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-8 bg-black border-2 border-intuition-primary/30 p-8 clip-path-slant relative overflow-hidden group shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-gradient-to-br from-intuition-primary/5 via-transparent to-transparent"></div>
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                <Brain size={120} className="text-intuition-primary" />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-intuition-primary/10 border border-intuition-primary/40 rounded text-intuition-primary">
                            <Sword size={20} />
                        </div>
                        <h3 className="text-lg font-black font-display text-white tracking-widest uppercase">CONFLICT_SIMULATION_V2</h3>
                    </div>
                    
                    {!analysis && !loading ? (
                        <p className="text-slate-500 font-mono text-xs mb-6 uppercase tracking-widest leading-relaxed">
                            Initialize Neural Intelligence to project market collision outcomes between constituents.
                        </p>
                    ) : loading ? (
                        <div className="space-y-4 py-2">
                             <div className="flex items-center gap-3 text-intuition-primary font-mono text-xs animate-pulse">
                                <Loader2 size={16} className="animate-spin" /> RUNNING_REPUTATION_WAR_GAMES...
                             </div>
                             <div className="h-1 w-full bg-slate-900 overflow-hidden">
                                <div className="h-full bg-intuition-primary w-1/3 animate-[marquee_1.5s_linear_infinite]"></div>
                             </div>
                        </div>
                    ) : (
                        <div className="relative pl-6 border-l-2 border-intuition-primary/50 py-1">
                            <p className="text-slate-200 font-mono text-sm leading-relaxed italic">
                                <Quote size={14} className="inline mr-2 text-intuition-primary/50" fill="currentColor" />
                                {analysis}
                            </p>
                        </div>
                    )}
                </div>

                {!analysis && !loading && (
                    <button 
                        onClick={() => { playClick(); generateAnalysis(); }}
                        className="px-10 py-4 bg-intuition-primary text-black font-black font-display text-xs tracking-[0.2em] clip-path-slant hover:bg-white transition-all shadow-[0_0_20px_rgba(0,243,255,0.4)] whitespace-nowrap"
                    >
                        RUN_ANALYSIS
                    </button>
                )}
            </div>
        </div>
    );
};

const AgentCard: React.FC<{ 
    agent: Account | null, 
    onSelect: () => void, 
    isWinner?: boolean,
    isLoser?: boolean,
    label: string 
}> = ({ agent, onSelect, isWinner, isLoser, label }) => {
    const score = agent ? calculateTrustScore(agent.totalAssets || '0', agent.totalShares || '0') : 0;
    
    return (
        <div 
            className={`relative flex-1 bg-[#05080f] border-2 p-10 flex flex-col items-center justify-center min-h-[420px] transition-all duration-500 hover:bg-slate-900/40 group cursor-pointer overflow-hidden ${isWinner ? 'border-intuition-success shadow-[0_0_60px_rgba(0,255,157,0.15)] scale-[1.02] z-10' : isLoser ? 'border-intuition-danger/30 opacity-80' : 'border-slate-800 hover:border-intuition-primary/50'}`}
            onClick={() => { playClick(); onSelect(); }}
            onMouseEnter={playHover}
        >
            <div className={`absolute top-6 left-6 text-[10px] font-black font-mono uppercase tracking-[0.3em] px-3 py-1 border ${isWinner ? 'bg-intuition-success/20 text-intuition-success border-intuition-success/40' : 'bg-black text-slate-500 border-slate-800'}`}>
                {label}
            </div>

            {/* Scanline Effect */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
            
            {agent ? (
                <>
                    <div className="relative mb-8">
                        <div className={`absolute inset-0 rounded-full blur-[30px] opacity-40 animate-pulse ${isWinner ? 'bg-intuition-success' : 'bg-intuition-primary'}`}></div>
                        <div className={`relative w-40 h-40 rounded-full border-4 overflow-hidden group-hover:scale-110 transition-transform duration-700 shadow-2xl ${isWinner ? 'border-intuition-success shadow-[0_0_30px_rgba(0,255,157,0.5)]' : 'border-white/10'}`}>
                            {agent.image ? <img src={agent.image} className="w-full h-full object-cover" /> : (
                                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-4xl text-slate-600 font-black">?</div>
                            )}
                        </div>
                        {isWinner && (
                            <div className="absolute -top-6 -right-6 bg-intuition-warning text-black p-3 rounded-full shadow-[0_0_20px_#facc15] animate-bounce z-20 border-2 border-black">
                                <Trophy size={20} fill="currentColor" />
                            </div>
                        )}
                    </div>
                    
                    <h2 className="text-3xl font-black font-display text-white text-center mb-4 z-10 group-hover:text-intuition-primary transition-colors text-glow uppercase tracking-tighter">{agent.label}</h2>
                    
                    <div className="flex flex-col items-center gap-1 mb-8">
                        <div className={`text-6xl font-black z-10 leading-none ${isWinner ? 'text-intuition-success text-glow-success' : 'text-white'}`}>
                            {score.toFixed(1)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono font-black uppercase tracking-[0.4em]">Trust_Magnitude</div>
                    </div>
                    
                    <Link 
                        to={`/markets/${agent.id}`} 
                        onClick={(e) => e.stopPropagation()}
                        className={`px-8 py-3 border font-display text-[10px] font-black tracking-[0.3em] transition-all z-10 clip-path-slant ${isWinner ? 'bg-intuition-success/10 border-intuition-success text-intuition-success hover:bg-intuition-success hover:text-black' : 'border-slate-700 text-slate-400 hover:text-white hover:border-intuition-primary hover:bg-intuition-primary/10'}`}
                    >
                        INSPECT_SIGNAL
                    </Link>
                </>
            ) : (
                <div className="flex flex-col items-center text-slate-700 group-hover:text-intuition-primary transition-all duration-500">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-intuition-primary/20 blur-2xl rounded-full scale-150 animate-pulse"></div>
                        <div className="w-32 h-32 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center group-hover:border-intuition-primary group-hover:rotate-45 transition-all duration-1000">
                             <Search size={48} className="opacity-40" />
                        </div>
                    </div>
                    <span className="font-display font-black text-sm tracking-[0.5em] uppercase">LINK_NODE</span>
                    <div className="mt-4 flex gap-1">
                        <div className="w-1 h-1 bg-intuition-primary rounded-full animate-bounce"></div>
                        <div className="w-1 h-1 bg-intuition-primary rounded-full animate-bounce delay-75"></div>
                        <div className="w-1 h-1 bg-intuition-primary rounded-full animate-bounce delay-150"></div>
                    </div>
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

    const max = Math.max(lNum, rNum);
    const leftPercent = max > 0 ? (lNum / max) * 100 : 0;
    const rightPercent = max > 0 ? (rNum / max) * 100 : 0;

    return (
        <div className="flex items-center justify-between py-8 border-b border-white/5 hover:bg-white/5 px-10 transition-all group relative overflow-hidden">
            {/* Visual Bars Background */}
            <div className="absolute left-0 top-0 bottom-0 bg-intuition-success/5 transition-all duration-1000" style={{ width: `${leftPercent / 2}%` }}></div>
            <div className="absolute right-0 top-0 bottom-0 bg-intuition-success/5 transition-all duration-1000" style={{ width: `${rightPercent / 2}%` }}></div>

            <div className={`font-mono font-black text-2xl w-1/3 text-right relative z-10 ${leftWins ? 'text-intuition-success text-glow-success scale-110' : 'text-slate-600'} transition-all`}>
                {Number(leftVal).toLocaleString()} <span className="text-[10px] text-slate-700 tracking-tighter ml-1">{unit}</span>
            </div>
            
            <div className="flex flex-col items-center w-1/3 px-6 relative z-10">
                <div className={`mb-2 transition-all duration-300 ${leftWins ? 'text-intuition-primary' : rightWins ? 'text-intuition-secondary' : 'text-slate-600'} group-hover:scale-125`}>{icon}</div>
                <div className="text-[9px] font-black font-mono text-slate-500 uppercase tracking-[0.3em] text-center">{label}</div>
            </div>

            <div className={`font-mono font-black text-2xl w-1/3 text-left relative z-10 ${rightWins ? 'text-intuition-success text-glow-success scale-110' : 'text-slate-600'} transition-all`}>
                {Number(rightVal).toLocaleString()} <span className="text-[10px] text-slate-700 tracking-tighter ml-1">{unit}</span>
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

    const lScore = useMemo(() => leftAgent ? calculateTrustScore(leftAgent.totalAssets || '0', leftAgent.totalShares || '0') : 50, [leftAgent]);
    const rScore = useMemo(() => rightAgent ? calculateTrustScore(rightAgent.totalAssets || '0', rightAgent.totalShares || '0') : 50, [rightAgent]);

    const chartData = useMemo(() => {
        const data = [];
        for (let i = 24; i >= 0; i--) {
            data.push({
                time: `-${i}h`,
                left: Math.max(0, lScore + (Math.random() - 0.5) * 8),
                right: Math.max(0, rScore + (Math.random() - 0.5) * 8),
            });
        }
        return data;
    }, [lScore, rScore]);

    const tensionIndex = Math.abs(lScore - rScore);
    const filteredAgents = agents.filter(a => a.label?.toLowerCase().includes(search.toLowerCase()) || a.id.includes(search));

    return (
        <div className="min-h-screen bg-intuition-dark pt-12 pb-32 px-4 max-w-[1400px] mx-auto">
            
            {/* Header Telemetry */}
            <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-6 border-b border-white/5 pb-10">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-intuition-primary/10 border-2 border-intuition-primary flex items-center justify-center text-intuition-primary shadow-[0_0_20px_rgba(0,243,255,0.2)] group-hover:rotate-180 transition-all clip-path-slant">
                        <ArrowRightLeft size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black text-white font-display tracking-tight text-glow uppercase">AGENT_COMPARISON</h1>
                        <p className="text-intuition-primary/50 font-mono text-xs tracking-[0.4em] uppercase mt-2">>> NEURAL_REPUTATION_ARBITRAGE_ENGINE</p>
                    </div>
                </div>
                
                <div className="flex gap-4">
                    <div className="px-6 py-3 bg-black border-2 border-slate-800 rounded-none font-mono text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                        <Terminal size={14} /> MODE: <span className="text-intuition-primary">HEAD-TO-HEAD</span>
                    </div>
                    <div className="px-6 py-3 bg-intuition-primary text-black font-black font-mono text-[10px] uppercase tracking-widest clip-path-slant shadow-[0_0_15px_#00f3ff]">
                        UPLINK: ACTIVE
                    </div>
                </div>
            </div>

            {/* Arena Stage */}
            <div className="flex flex-col lg:flex-row gap-8 relative mb-20 items-stretch">
                <AgentCard 
                    label="CHALLENGER A"
                    agent={leftAgent} 
                    onSelect={() => setIsSelectorOpen('LEFT')} 
                    isWinner={leftAgent && rightAgent && lScore > rScore}
                    isLoser={leftAgent && rightAgent && lScore < rScore}
                />
                
                {/* Arena Centerpiece */}
                <div className="flex flex-col items-center justify-center gap-6 min-w-[120px] relative">
                    {/* Vertical Tension Line */}
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-slate-800 to-transparent"></div>
                    
                    <div className="text-[10px] font-black font-mono text-slate-600 uppercase tracking-widest bg-intuition-dark z-10 px-2 py-1">Tension_Index</div>
                    <div className={`text-2xl font-black font-mono z-10 transition-colors ${tensionIndex > 30 ? 'text-intuition-danger text-glow-danger' : tensionIndex > 15 ? 'text-intuition-warning' : 'text-slate-400'}`}>
                        {tensionIndex.toFixed(1)}
                    </div>
                    
                    <div className="relative group z-20">
                        <div className="absolute inset-0 bg-intuition-primary rounded-full blur-2xl opacity-40 group-hover:opacity-80 transition-all duration-500 animate-pulse"></div>
                        <button 
                            onClick={handleSwap}
                            className="relative w-20 h-20 bg-black border-2 border-intuition-primary rounded-full flex items-center justify-center text-white hover:text-black hover:bg-intuition-primary transition-all duration-500 hover:scale-110 shadow-[0_0_40px_rgba(0,243,255,0.4)] ring-8 ring-black"
                        >
                            <span className="font-black font-display text-3xl italic tracking-tighter">VS</span>
                        </button>
                    </div>

                    <div className="text-[10px] font-black font-mono text-slate-600 uppercase tracking-widest bg-intuition-dark z-10 px-2 py-1 mt-auto">Arbitrage_Delta</div>
                    <div className="text-lg font-bold font-mono text-slate-400 z-10 mb-4">
                        {Math.abs(parseFloat(formatEther(BigInt(leftAgent?.totalAssets || '0'))) - parseFloat(formatEther(BigInt(rightAgent?.totalAssets || '0')))).toFixed(2)}
                    </div>
                </div>

                <AgentCard 
                    label="CHALLENGER B"
                    agent={rightAgent} 
                    onSelect={() => setIsSelectorOpen('RIGHT')} 
                    isWinner={rightAgent && leftAgent && rScore > lScore}
                    isLoser={rightAgent && leftAgent && rScore < lScore}
                />
            </div>

            {/* Simulation & Metrics */}
            {leftAgent && rightAgent ? (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                    
                    {/* Rivalry AI Synthesis */}
                    <RivalryAnalysis left={leftAgent} right={rightAgent} lScore={lScore} rScore={rScore} />

                    {/* Multi-Metric Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Data Telemetry Table */}
                        <div className="bg-black border border-intuition-border clip-path-slant shadow-2xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            <div className="bg-intuition-card p-4 border-b border-intuition-border text-center text-xs font-black font-mono text-intuition-primary uppercase tracking-[0.5em]">
                                Raw_Sector_Comparison
                            </div>
                            
                            <ComparisonRow 
                                label="Protocol_Volume" 
                                leftVal={parseFloat(formatEther(BigInt(leftAgent.totalAssets || '0'))).toFixed(2)} 
                                rightVal={parseFloat(formatEther(BigInt(rightAgent.totalAssets || '0'))).toFixed(2)}
                                unit="TRUST"
                                icon={<Shield size={20} />}
                            />
                            <ComparisonRow 
                                label="Market_Entropy" 
                                leftVal={calculateVolatility(leftAgent.totalAssets || '0').toFixed(0)} 
                                rightVal={calculateVolatility(rightAgent.totalAssets || '0').toFixed(0)}
                                unit="E"
                                icon={<Activity size={20} />}
                            />
                            <ComparisonRow 
                                label="Stake_Holders" 
                                leftVal={Math.floor(Math.random() * 500) + 10} 
                                rightVal={Math.floor(Math.random() * 500) + 10}
                                unit="QTY"
                                icon={<Users size={20} />}
                            />
                            <ComparisonRow 
                                label="Semantic_Reach" 
                                leftVal={(lScore * 1.5).toFixed(0)} 
                                rightVal={(rScore * 1.5).toFixed(0)}
                                icon={<Flame size={20} />}
                            />
                        </div>

                        {/* Relative Performance Chart */}
                        <div className="bg-black border border-intuition-border p-10 h-[450px] clip-path-slant relative neon-panel group">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
                            <div className="absolute top-10 right-10 z-10">
                                <div className="p-2 bg-black border border-slate-800 rounded animate-pulse">
                                    <Activity size={16} className="text-intuition-primary" />
                                </div>
                            </div>
                            <div className="flex gap-8 mb-10 text-[10px] font-black font-mono">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-intuition-primary shadow-[0_0_10px_#00f3ff]"></div>
                                    <span className="text-white uppercase tracking-widest">{leftAgent.label}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-intuition-secondary shadow-[0_0_10px_#0066ff]"></div>
                                    <span className="text-white uppercase tracking-widest">{rightAgent.label}</span>
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorL" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorR" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0066ff" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#0066ff" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
                                    <XAxis dataKey="time" hide />
                                    <YAxis domain={[0, 100]} hide />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#05080f', border: '1px solid #00f3ff', borderRadius: '0', clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                                        itemStyle={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase' }}
                                    />
                                    <Area type="monotone" dataKey="left" stroke="#00f3ff" strokeWidth={4} fillOpacity={1} fill="url(#colorL)" />
                                    <Area type="monotone" dataKey="right" stroke="#0066ff" strokeWidth={4} fillOpacity={1} fill="url(#colorR)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto text-center py-20 border-2 border-dashed border-slate-800 bg-black/40 clip-path-slant animate-in zoom-in duration-500">
                    <Sword size={64} className="mx-auto text-slate-800 mb-6 opacity-40" />
                    <h3 className="text-2xl font-black font-display text-slate-600 uppercase tracking-[0.4em] mb-4">Awaiting_Constituents</h3>
                    <p className="text-slate-700 font-mono text-xs uppercase tracking-widest px-10 leading-relaxed">
                        Select two identity nodes from the global database to initiate semantic collision analysis and project future market sentiment delta.
                    </p>
                    <div className="mt-10 flex justify-center gap-3">
                         <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-pulse"></div>
                         <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-pulse delay-75"></div>
                         <div className="w-1.5 h-1.5 bg-slate-800 rounded-full animate-pulse delay-150"></div>
                    </div>
                </div>
            )}

            {/* High-Tech Selector Modal */}
            {isSelectorOpen && (
                <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-2xl animate-in fade-in duration-300" onClick={() => setIsSelectorOpen(null)}>
                    <div className="w-full max-w-2xl bg-[#05080f] border-2 border-intuition-primary shadow-[0_0_100px_rgba(0,243,255,0.1)] p-10 clip-path-slant relative" onClick={e => e.stopPropagation()}>
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                        
                        <div className="flex items-center gap-4 mb-8">
                             <div className="p-3 bg-intuition-primary/10 border border-intuition-primary text-intuition-primary clip-path-slant">
                                 <Search size={24} />
                             </div>
                             <div>
                                 <h4 className="text-xl font-black font-display text-white tracking-widest uppercase">Select_Market_Entity</h4>
                                 <div className="text-[10px] font-mono text-intuition-primary/60 tracking-[0.2em] uppercase mt-1">Accessing Global Intuition Nodes...</div>
                             </div>
                        </div>

                        <div className="mb-10 relative">
                            <input 
                                type="text" 
                                placeholder="QUERY_SYSTEM_ID [NAME | 0xADDRESS]" 
                                autoFocus
                                className="w-full bg-black border-b-2 border-slate-700 p-5 text-white font-mono text-sm focus:border-intuition-primary outline-none transition-all placeholder-slate-700 uppercase tracking-widest"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <div className="absolute right-4 bottom-4 flex gap-1">
                                 <div className="w-1.5 h-1.5 bg-intuition-primary animate-pulse"></div>
                                 <div className="w-1.5 h-1.5 bg-intuition-primary animate-pulse delay-100"></div>
                            </div>
                        </div>

                        <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-4 custom-scrollbar relative z-10">
                            {filteredAgents.length > 0 ? filteredAgents.map(a => (
                                <button 
                                    key={a.id}
                                    onClick={() => handleSelect(a)}
                                    className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 hover:bg-intuition-primary/10 hover:border-intuition-primary transition-all group rounded-none text-left clip-path-slant"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-black border border-white/10 flex items-center justify-center overflow-hidden shrink-0 group-hover:border-intuition-primary transition-all">
                                            {a.image ? <img src={a.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"/> : <div className="text-xl font-black text-slate-700">{a.label?.[0]}</div>}
                                        </div>
                                        <div>
                                            <div className="font-black font-display text-lg text-white group-hover:text-intuition-primary transition-colors tracking-tight uppercase">{a.label}</div>
                                            <div className="text-[10px] text-slate-500 font-mono tracking-widest flex items-center gap-2 mt-1 uppercase">
                                                <span className="text-intuition-primary/40 font-bold">{a.type || 'ATOM'}</span> • ID: {a.id.slice(0,10)}...
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="text-xs font-black font-mono text-white tracking-widest">{calculateTrustScore(a.totalAssets || '0', a.totalShares || '0').toFixed(1)}</div>
                                        <div className="text-[8px] text-slate-600 font-mono uppercase font-black">Score</div>
                                    </div>
                                </button>
                            )) : (
                                <div className="py-20 text-center text-slate-600 font-mono uppercase tracking-[0.3em] border border-dashed border-slate-800">
                                    NULL_RESULTS_FOR_QUERY
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest pt-6 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <Info size={12} /> Click to Establish Linkage
                            </div>
                            <div className="flex items-center gap-2">
                                System Status: <span className="text-intuition-success font-black animate-pulse">Ready</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Compare;