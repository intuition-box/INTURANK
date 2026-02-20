import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Activity, Zap, Trophy, Brain, Sword, Loader2, Quote, Terminal, Crosshair, Network, Shield, Users, BarChart3 } from 'lucide-react';
import { getAllAgents } from '../services/graphql';
import { Account } from '../types';
import { calculateTrustScore, calculateVolatility, formatMarketValue } from '../services/analytics';
import { formatEther } from 'viem';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { playClick, playHover } from '../services/audio';
import { Link } from 'react-router-dom';
import { CURRENCY_SYMBOL } from '../constants';
import { CurrencySymbol } from '../components/CurrencySymbol';
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-3-pro-preview';

// --- TACTICAL CONFLICT SIMULATION COMPONENT (Updated to V3 Inspo) ---
const RivalryAnalysis: React.FC<{ left: Account; right: Account; lScore: number; rScore: number }> = ({ left, right, lScore, rScore }) => {
    const [analysis, setAnalysis] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        if (analysis) {
            let i = 0;
            setDisplayedText('');
            const interval = setInterval(() => {
                setDisplayedText(analysis.slice(0, i));
                i++;
                if (i > analysis.length) clearInterval(interval);
            }, 8);
            return () => clearInterval(interval);
        }
    }, [analysis]);

    const generateAnalysis = async () => {
        setLoading(true);
        try {
            // Fix: Always use process.env.API_KEY directly as per initialization guidelines
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
                Perform an aggressive, high-stakes tactical comparison between two competing reputation-based assets in a decentralized trust-graph combat arena.
                
                ENTITY_ALPHA: ${left.label} (Magnitude: ${lScore.toFixed(1)}, Sector: ${left.type})
                ENTITY_OMEGA: ${right.label} (Magnitude: ${rScore.toFixed(1)}, Sector: ${right.type})
                
                SCENARIO: They are in a zero-sum semantic collision for global consensus dominance.
                DOMINANT_NODE: ${lScore > rScore ? left.label : right.label}
                
                Provide a "Combat Report" paragraph.
                Style: Brutalist cypherpunk, military intelligence, high-frequency finance.
                Terms: "Liquidity Bleed", "Protocol Incursion", "Semantic Fragging", "Neural Arbitrage", "Consensus Overload".
            `;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: [{ parts: [{ text: prompt }] }],
            });
            setAnalysis(response.text || 'ERROR: SYNTHESIS_FRAGMENTED.');
        } catch (e) {
            setAnalysis('ERROR: NEURAL_LINK_SEVERED_BY_FIREWALL.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#020308] border border-intuition-primary/40 p-10 relative overflow-hidden group shadow-2xl min-h-[180px] mb-8">
            {/* Background Brain Icon Decal as per Inspo */}
            <div className="absolute -top-12 -right-12 opacity-[0.08] text-intuition-primary pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                <Brain size={280} />
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-black border border-intuition-primary/40 flex items-center justify-center text-intuition-primary shadow-glow-blue clip-path-slant">
                        <Sword size={20} />
                    </div>
                    <h3 className="text-[12px] font-black font-display text-white tracking-[0.5em] uppercase">CONFLICT_SIMULATION_V3</h3>
                </div>
                
                {!analysis && !loading ? (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 pl-4 border-l-2 border-slate-900">
                        <p className="text-slate-500 font-mono text-[11px] uppercase tracking-widest leading-relaxed max-w-2xl">
                            // Standby for semantic projection. Initialize AI synthesis to project takeover probability and identify consensus vulnerabilities.
                        </p>
                        <button 
                            onClick={() => { playClick(); generateAnalysis(); }}
                            className="px-8 py-3 bg-intuition-primary text-black font-black text-[10px] tracking-widest hover:bg-white transition-all shadow-glow-blue uppercase whitespace-nowrap active:scale-95"
                        >
                            INITIATE_PROJECTION
                        </button>
                    </div>
                ) : loading ? (
                    <div className="flex items-center gap-3 text-intuition-primary font-mono text-[11px] animate-pulse font-black py-4 pl-4 border-l-2 border-intuition-primary/20">
                        <Loader2 size={16} className="animate-spin" /> RUNNING_NEURAL_WAR_GAMES...
                    </div>
                ) : (
                    <div className="flex gap-6 items-start animate-in fade-in duration-500 pl-4 border-l-2 border-intuition-primary/40">
                        <Quote size={24} className="text-intuition-primary shrink-0 opacity-40 mt-1" />
                        <p className="text-slate-200 font-mono text-xs leading-relaxed font-bold uppercase tracking-tight italic">
                            {displayedText}
                            <span className="inline-block w-2 h-3.5 bg-intuition-primary ml-1 animate-pulse shadow-glow-blue"></span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- DYNAMIC COLLISION VISUAL (Updated to Inspo) ---
const NeuralCollision: React.FC<{ tension: number, arbitrage: number, onSwap: () => void }> = ({ tension, arbitrage, onSwap }) => {
    return (
        <div className="flex flex-col items-center justify-between min-w-[140px] relative h-full py-4">
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-slate-800 to-transparent"></div>
            
            <div className="flex flex-col items-center gap-2 z-10">
                <div className="text-[7px] font-black font-mono text-slate-500 uppercase tracking-[0.4em]">Tension_Index</div>
                <div className={`text-2xl font-black font-mono transition-all duration-700 ${tension > 30 ? 'text-intuition-danger text-glow-red' : 'text-white'}`}>
                    {tension.toFixed(1)}
                </div>
            </div>

            <div className="relative group z-20 my-2">
                <div className={`absolute inset-0 bg-intuition-primary rounded-full blur-2xl opacity-10 group-hover:opacity-40 transition-all duration-1000 animate-pulse`}></div>
                
                <button 
                    onClick={() => { playClick(); onSwap(); }}
                    onMouseEnter={playHover}
                    className={`relative w-16 h-16 bg-black border-2 rounded-full flex items-center justify-center text-white hover:text-black hover:bg-intuition-primary transition-all duration-700 hover:scale-110 shadow-2xl group-hover:shadow-glow-blue ${tension > 30 ? 'border-intuition-danger' : 'border-intuition-primary'}`}
                >
                    <span className="font-black font-display text-xl italic tracking-tighter">VS</span>
                </button>
            </div>

            <div className="flex flex-col items-center gap-2 z-10">
                <div className="text-[7px] font-black font-mono text-slate-500 uppercase tracking-[0.4em]">Arbitrage_Delta</div>
                <div className="text-sm font-black font-mono text-white tracking-tighter">
                    {arbitrage.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
            </div>
        </div>
    );
};

const AgentCard: React.FC<{ 
    agent: Account | null, 
    onSelect: () => void, 
    isWinner?: boolean,
    isLoser?: boolean,
    position: 'LEFT' | 'RIGHT'
}> = ({ agent, onSelect, isWinner, isLoser, position }) => {
    const score = agent ? calculateTrustScore(agent.totalAssets || '0', agent.totalShares || '0') : 0;
    
    return (
        <div 
            className={`relative flex-1 bg-[#02040a] border-2 p-10 flex flex-col items-center justify-center min-h-[380px] transition-all duration-500 hover:bg-slate-900/10 group cursor-pointer overflow-hidden ${isWinner ? 'border-intuition-success/40 shadow-[0_0_50px_rgba(0,255,157,0.05)]' : isLoser ? 'border-intuition-danger/10 opacity-60 grayscale' : 'border-slate-900 hover:border-intuition-primary/40'}`}
            onClick={() => { playClick(); onSelect(); }}
            onMouseEnter={playHover}
        >
            <div className={`absolute top-4 ${position === 'LEFT' ? 'left-4' : 'right-4'} text-[8px] font-black font-mono uppercase tracking-[0.5em] px-2 py-0.5 border ${isWinner ? 'bg-intuition-success/10 text-intuition-success border-intuition-success/20' : 'bg-black text-slate-600 border-slate-900'}`}>
                {isWinner ? 'DOMINANT' : isLoser ? 'SUBORDINATE' : `NODE_${position}`}
            </div>
            
            {agent ? (
                <>
                    <div className="relative mb-8">
                        <div className={`absolute inset-0 rounded-full blur-[40px] opacity-10 ${isWinner ? 'bg-intuition-success' : 'bg-intuition-primary'}`}></div>
                        <div className={`relative w-28 h-28 md:w-32 md:h-32 rounded-none border-2 flex items-center justify-center overflow-hidden transition-all duration-700 group-hover:scale-105 shadow-2xl ${isWinner ? 'border-intuition-success shadow-glow-success' : 'border-white/10'}`}>
                            {agent.image ? <img src={agent.image} className="w-full h-full object-cover" /> : (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-3xl text-slate-700 font-black">?</div>
                            )}
                        </div>
                    </div>
                    
                    <h2 className="text-xl md:text-3xl font-black font-display text-white text-center mb-8 uppercase tracking-tighter leading-tight drop-shadow-md">{agent.label}</h2>
                    
                    <div className="flex flex-col items-center gap-1 mb-8">
                        <div className={`text-5xl md:text-6xl font-black font-mono tracking-tighter ${isWinner ? 'text-intuition-success text-glow-success' : 'text-white'}`}>
                            {score.toFixed(1)}
                        </div>
                        <div className="text-[8px] text-slate-600 font-mono font-black uppercase tracking-[0.6em]">Signal_Magnitude</div>
                    </div>
                    
                    <Link 
                        to={`/markets/${agent.id}`} 
                        onClick={(e) => e.stopPropagation()}
                        className={`px-8 py-3 border font-display text-[9px] font-black tracking-[0.3em] transition-all ${isWinner ? 'bg-intuition-success text-black border-intuition-success shadow-glow-success' : 'bg-black border-slate-700 text-slate-500 hover:text-white'}`}
                    >
                        TERMINAL_ACCESS
                    </Link>
                </>
            ) : (
                <div className="flex flex-col items-center text-slate-800 group-hover:text-intuition-primary transition-all duration-500">
                    <div className="w-24 h-24 rounded-none border-2 border-dashed border-slate-900 flex items-center justify-center group-hover:border-intuition-primary transition-all mb-6">
                        <Crosshair size={32} className="opacity-10 group-hover:opacity-60" />
                    </div>
                    <span className="font-display font-black text-xs tracking-[0.5em] uppercase">CONNECT_NODE</span>
                </div>
            )}
        </div>
    );
};

// --- UPDATED COMPARISON ROW WITH WEIGHT BARS ---
const ComparisonRow: React.FC<{ 
    label: string, 
    leftVal: string | number, 
    rightVal: string | number, 
    unit?: string | React.ReactNode,
    icon: React.ReactNode 
}> = ({ label, leftVal, rightVal, unit = '', icon }) => {
    const lNum = parseFloat(leftVal.toString());
    const rNum = parseFloat(rightVal.toString());
    const total = lNum + rNum;
    
    // Percentage for background bars (min 5% for visibility)
    const lPct = total > 0 ? Math.max(5, (lNum / total) * 100) : 50;
    const rPct = total > 0 ? Math.max(5, (rNum / total) * 100) : 50;

    const leftWins = lNum > rNum;
    const rightWins = rNum > lNum;

    return (
        <div className="flex items-center justify-between py-6 px-10 transition-all group relative overflow-hidden min-h-[100px] border-b border-white/5">
            {/* Asymmetrical Background Weight Bars */}
            <div className="absolute inset-0 flex pointer-events-none opacity-[0.08] group-hover:opacity-[0.12] transition-opacity">
                <div className="h-full bg-intuition-primary transition-all duration-1000 ease-out" style={{ width: `${lPct}%` }}></div>
                <div className="h-full bg-intuition-secondary transition-all duration-1000 ease-out" style={{ width: `${rPct}%` }}></div>
            </div>

            <div className={`relative z-10 w-1/3 text-right pr-12 transition-all duration-500 ${leftWins ? 'scale-110' : 'opacity-40 grayscale'}`}>
                <div className={`font-mono font-black text-3xl tracking-tighter ${leftWins ? 'text-intuition-primary text-glow-blue' : 'text-white'}`}>
                    {Number(leftVal).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <span className="inline-flex items-baseline text-slate-600 font-black uppercase tracking-widest">{typeof unit === 'string' ? <span className="text-[8px]">{unit}</span> : unit}</span>
            </div>
            
            <div className="relative z-10 flex flex-col items-center w-1/3 shrink-0">
                <div className={`mb-2 p-2 bg-black border border-white/10 shadow-xl transition-all ${leftWins ? 'text-intuition-primary border-intuition-primary/40' : rightWins ? 'text-intuition-secondary border-intuition-secondary/40' : 'text-slate-700'}`}>
                    {/* Fixed: Cast icon to ReactElement with expected props for cloneElement compatibility */}
                    {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 16 })}
                </div>
                <div className="text-[7px] font-black font-mono text-slate-500 uppercase tracking-[0.4em] text-center whitespace-nowrap">{label}</div>
            </div>

            <div className={`relative z-10 w-1/3 text-left pl-12 transition-all duration-500 ${rightWins ? 'scale-110' : 'opacity-40 grayscale'}`}>
                <div className={`font-mono font-black text-3xl tracking-tighter ${rightWins ? 'text-intuition-secondary text-glow-red' : 'text-white'}`}>
                    {Number(rightVal).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <span className="inline-flex items-baseline text-slate-600 font-black uppercase tracking-widest">{typeof unit === 'string' ? <span className="text-[8px]">{unit}</span> : unit}</span>
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

    // Fix: Access the 'items' property from the result of getAllAgents()
    useEffect(() => {
        getAllAgents().then(data => setAgents(data.items));
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

    // --- ENHANCED CHART DATA (Fixed "Bad" Look) ---
    const chartData = useMemo(() => {
        const data = [];
        let lBase = lScore;
        let rBase = rScore;
        for (let i = 40; i >= 0; i--) {
            // Simulate "Neural Drift"
            lBase += (Math.random() - 0.5) * 1.5;
            rBase += (Math.random() - 0.5) * 1.5;
            lBase = Math.max(10, Math.min(95, lBase));
            rBase = Math.max(10, Math.min(95, rBase));
            data.push({
                time: i,
                left: parseFloat(lBase.toFixed(2)),
                right: parseFloat(rBase.toFixed(2)),
            });
        }
        return data;
    }, [lScore, rScore]);

    const tensionIndex = Math.abs(lScore - rScore);
    const arbitrageDelta = useMemo(() => {
        if (!leftAgent || !rightAgent) return 0;
        const lAssets = parseFloat(formatEther(BigInt(leftAgent.totalAssets || '0')));
        const rAssets = parseFloat(formatEther(BigInt(rightAgent.totalAssets || '0')));
        return Math.abs(lAssets - rAssets) * 0.42; // Simplified delta logic for visual
    }, [leftAgent, rightAgent]);

    const filteredAgents = agents.filter(a => (a.label || '').toLowerCase().includes(search.toLowerCase()) || a.id.includes(search));

    return (
        <div className="min-h-screen bg-[#020308] pt-12 pb-32 px-6 max-w-[1500px] mx-auto relative font-mono selection:bg-intuition-primary selection:text-black">
            <div className="fixed inset-0 pointer-events-none z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>

            <div className="flex flex-col lg:flex-row items-center justify-between mb-12 gap-8 border-b-2 border-slate-900 pb-10 relative z-10">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-black border-2 border-intuition-primary flex items-center justify-center text-intuition-primary shadow-glow-blue clip-path-slant">
                        <BarChart3 size={32} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-intuition-primary font-black font-mono text-[9px] tracking-[0.5em] uppercase mb-1">
                             <Zap size={10} className="animate-pulse" /> Signal_Parity_Module
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-white font-display tracking-tight uppercase leading-none text-glow-white">
                            COMPARISON<span className="text-intuition-secondary text-glow-red">_DECK</span>
                        </h1>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-4">
                    <div className="px-6 py-3 bg-black border border-slate-800 font-mono text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                        <Terminal size={14} className="text-intuition-primary" /> TARGET_LOCK: <span className="text-white text-glow-white">{leftAgent && rightAgent ? 'SYNCHRONIZED' : 'AWAITING_UPLINK'}</span>
                    </div>
                    <div className="px-6 py-3 bg-intuition-secondary text-white font-black font-mono text-[10px] uppercase tracking-widest shadow-glow-red active:scale-95 transition-all">
                        UPLINK: ACTIVE
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 mb-12 items-stretch z-10">
                <AgentCard 
                    position="LEFT"
                    agent={leftAgent} 
                    onSelect={() => setIsSelectorOpen('LEFT')} 
                    isWinner={!!(leftAgent && rightAgent && lScore > rScore)}
                    isLoser={!!(leftAgent && rightAgent && lScore < rScore)}
                />
                
                <NeuralCollision tension={tensionIndex} arbitrage={arbitrageDelta} onSwap={handleSwap} />

                <AgentCard 
                    position="RIGHT"
                    agent={rightAgent} 
                    onSelect={() => setIsSelectorOpen('RIGHT')} 
                    isWinner={!!(rightAgent && leftAgent && rScore > lScore)}
                    isLoser={!!(rightAgent && leftAgent && rScore < lScore)}
                />
            </div>

            {leftAgent && rightAgent ? (
                <div className="space-y-12 animate-in fade-in zoom-in-95 duration-700 relative z-10">
                    <RivalryAnalysis left={leftAgent} right={rightAgent} lScore={lScore} rScore={rScore} />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* RAW SECTOR COMPARISON TABLE */}
                        <div className="bg-[#03040a] border border-white/5 shadow-2xl relative overflow-hidden clip-path-slant">
                            <div className="bg-black py-4 border-b border-white/5 flex justify-center items-center relative z-20">
                                <div className="text-[11px] font-black font-display text-intuition-primary uppercase tracking-[0.6em] text-glow-blue">RAW_SECTOR_COMPARISON</div>
                            </div>
                            
                            <div className="bg-black/40">
                                <ComparisonRow 
                                    label="PROTOCOL_VOLUME" 
                                    leftVal={parseFloat(formatEther(BigInt(leftAgent.totalAssets || '0')))} 
                                    rightVal={parseFloat(formatEther(BigInt(rightAgent.totalAssets || '0')))}
                                    unit={<CurrencySymbol size="sm" className="text-slate-600" />}
                                    icon={<Shield />}
                                />
                                <ComparisonRow 
                                    label="MARKET_ENTROPY" 
                                    leftVal={calculateVolatility(leftAgent.totalAssets || '0')} 
                                    rightVal={calculateVolatility(rightAgent.totalAssets || '0')}
                                    unit="E"
                                    icon={<Activity />}
                                />
                                <ComparisonRow 
                                    label="STAKE_HOLDERS" 
                                    leftVal={Math.floor(Math.random() * 800) + 200} // Mocked for visual density
                                    rightVal={Math.floor(Math.random() * 800) + 200}
                                    unit="QTY"
                                    icon={<Users />}
                                />
                                <ComparisonRow 
                                    label="SEMANTIC_REACH" 
                                    leftVal={(lScore * 1.2).toFixed(0)} 
                                    rightVal={(rScore * 1.2).toFixed(0)}
                                    unit="SYNC"
                                    icon={<Network />}
                                />
                            </div>
                        </div>

                        {/* LIVE TELEMETRY CHART (Fixed with Inspo Styling) */}
                        <div className="bg-[#03040a] border border-white/10 p-10 h-[520px] relative group shadow-2xl overflow-hidden clip-path-slant">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] pointer-events-none"></div>
                            
                            <div className="flex justify-between items-center mb-10 relative z-10">
                                <div className="flex gap-8 text-[10px] font-black font-mono">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 bg-intuition-primary shadow-glow-blue clip-path-slant"></div>
                                        <span className="text-white uppercase tracking-widest">{leftAgent.label}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 bg-intuition-secondary shadow-glow-red clip-path-slant"></div>
                                        <span className="text-white uppercase tracking-widest">{rightAgent.label}</span>
                                    </div>
                                </div>
                                <div className="px-4 py-2 bg-black border border-white/10 text-[9px] font-black font-mono text-slate-500 uppercase tracking-[0.3em] shadow-xl">
                                    LIVE_TELEMETRY
                                </div>
                            </div>

                            <div className="h-[280px] w-full relative z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorL" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorR" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ff1e6d" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#ff1e6d" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 6" stroke="#ffffff08" vertical={false} />
                                        <XAxis dataKey="time" hide />
                                        <YAxis domain={[0, 100]} hide />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.95)', border: '1px solid #333', fontSize: '10px', fontWeight: 'bold' }}
                                        />
                                        <Area type="monotone" dataKey="left" stroke="#00f3ff" strokeWidth={4} fillOpacity={1} fill="url(#colorL)" animationDuration={2000} />
                                        <Area type="monotone" dataKey="right" stroke="#ff1e6d" strokeWidth={4} fillOpacity={1} fill="url(#colorR)" animationDuration={2000} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="mt-12 flex flex-col items-center gap-4 relative z-10">
                                <div className="text-[10px] font-black font-mono text-slate-700 uppercase tracking-[0.6em] animate-pulse">
                                    SIMULATING NEURAL DRIFT SEQUENCE
                                </div>
                                <div className="flex gap-2 h-1 w-48 bg-white/5 overflow-hidden rounded-full">
                                    <div className="h-full bg-intuition-primary animate-marquee w-1/3 shadow-glow-blue"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto text-center py-32 border-2 border-dashed border-slate-900 bg-black/20 clip-path-slant relative group transition-all">
                    <Crosshair size={64} className="mx-auto text-slate-800 mb-8 opacity-20 group-hover:text-intuition-primary group-hover:opacity-100 transition-all duration-1000 animate-spin-slow" />
                    <h3 className="text-2xl font-black font-display text-slate-700 uppercase tracking-[0.5em] mb-4 group-hover:text-white transition-colors">AWAITING_CHALLENGERS</h3>
                    <p className="text-slate-800 font-mono text-[9px] uppercase tracking-[0.4em] px-8 leading-relaxed max-w-lg mx-auto font-black">
                        Select two identity nodes to initiate lethal semantic collision analysis and project arbitrage deltas across active corridors.
                    </p>
                </div>
            )}

            {isSelectorOpen && (
                <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsSelectorOpen(null)}>
                    <div className="w-full max-w-2xl bg-[#050508] border border-intuition-primary/40 p-10 clip-path-slant relative overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-5 mb-10">
                             <div className="p-3 bg-intuition-primary/10 border border-intuition-primary/30 text-intuition-primary clip-path-slant shadow-glow-blue">
                                 <Search size={24} />
                             </div>
                             <div>
                                 <h4 className="text-xl font-black font-display text-white uppercase leading-none mb-1 tracking-widest">Target_Acquisition</h4>
                                 <div className="text-[9px] font-mono text-intuition-primary/60 tracking-[0.4em] uppercase font-black">Mainnet_Node_Directory</div>
                             </div>
                        </div>

                        <div className="mb-10 group">
                            <input 
                                type="text" 
                                placeholder="QUERY_IDENT_HASH..." 
                                autoFocus
                                className="w-full bg-black border-b border-slate-800 p-6 text-white font-mono text-sm focus:border-intuition-primary outline-none transition-all placeholder-slate-800 uppercase tracking-widest font-black"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-4 custom-scrollbar">
                            {filteredAgents.map(a => (
                                <button 
                                    key={a.id}
                                    onClick={() => handleSelect(a)}
                                    className="w-full flex items-center justify-between p-5 bg-white/5 border border-slate-900 hover:border-intuition-primary hover:bg-intuition-primary/5 transition-all group text-left clip-path-slant"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 bg-black border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 group-hover:border-intuition-primary transition-all shadow-xl">
                                            {a.image ? <img src={a.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0"/> : <div className="text-xs font-black text-slate-700">{a.label?.[0]}</div>}
                                        </div>
                                        <div>
                                            <div className="font-black text-sm text-white group-hover:text-intuition-primary transition-colors uppercase leading-none mb-1.5 tracking-tight">{a.label}</div>
                                            <div className="text-[7px] text-slate-600 font-mono tracking-[0.2em] uppercase font-bold">UID: {a.id.slice(0,20)}...</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-black font-mono text-white group-hover:text-intuition-primary leading-none mb-1">{calculateTrustScore(a.totalAssets || '0', a.totalShares || '0').toFixed(1)}</div>
                                        <div className="text-[7px] text-slate-700 font-mono uppercase font-black tracking-widest">MAGNITUDE</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        
                        <div className="mt-10 pt-8 border-t border-white/5 flex justify-center">
                            <button onClick={() => setIsSelectorOpen(null)} className="text-[10px] font-black font-mono text-slate-700 hover:text-white uppercase tracking-[0.6em] transition-colors">TERMINATE_SEARCH</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Compare;