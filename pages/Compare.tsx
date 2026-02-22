import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Activity, Zap, Trophy, Brain, Sword, Loader2, Quote, Terminal, Crosshair, Network, Shield, Users, BarChart3, TrendingUp } from 'lucide-react';
import { getAllAgents, getRedemptionCountForVault } from '../services/graphql';
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
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                setAnalysis('AI summary is disabled. Add VITE_GEMINI_API_KEY to .env.local to enable it.');
                setLoading(false);
                return;
            }
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `
                Compare two reputation-based assets for a normal (non-expert) user.

                Asset A: ${left.label} — Score: ${lScore.toFixed(1)}, Type: ${left.type || 'asset'}
                Asset B: ${right.label} — Score: ${rScore.toFixed(1)}, Type: ${right.type || 'asset'}
                Stronger so far: ${lScore > rScore ? left.label : right.label}

                Write one short, clear paragraph (2–4 sentences) that:
                - Says who is ahead and by how much (scores above).
                - Explains in plain language why one might be stronger (e.g. more volume, more holders, higher score).
                - Avoids jargon. Use everyday words: "ahead", "stronger", "more activity", "more support", "higher score". Do NOT use: protocol incursion, liquidity bleed, semantic fragging, neural arbitrage, consensus overload, or military/combat metaphors.
            `;

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: [{ parts: [{ text: prompt }] }],
            });
            setAnalysis(response.text || 'Could not generate summary. Try again.');
        } catch (e) {
            setAnalysis('Summary unavailable. Check your API key or connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-[#020308] via-[#040612] to-[#020308] border-2 border-intuition-primary/30 p-4 sm:p-6 md:p-10 relative overflow-hidden group shadow-2xl min-h-[180px] mb-6 md:mb-8 rounded-sm hover:border-intuition-primary/50 hover:shadow-[0_0_40px_rgba(0,243,255,0.08)] transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-intuition-primary/5 via-transparent to-intuition-secondary/5 pointer-events-none" />
            <div className="absolute -top-12 -right-12 opacity-[0.12] text-intuition-primary pointer-events-none group-hover:opacity-20 group-hover:scale-110 transition-all duration-700">
                <Brain size={280} />
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-black/80 border-2 border-intuition-primary/50 flex items-center justify-center text-intuition-primary shadow-glow-blue clip-path-slant">
                        <Brain size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-white tracking-wide">Comparison summary</h3>
                </div>
                
                {!analysis && !loading ? (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 pl-4 border-l-2 border-intuition-primary/30">
                        <p className="text-slate-300 font-sans text-sm leading-relaxed max-w-2xl">
                            Get a short, plain-language summary of how these two compare — who’s ahead and why.
                        </p>
                        <button 
                            onClick={() => { playClick(); generateAnalysis(); }}
                            className="px-8 py-3 bg-intuition-primary text-black font-bold text-sm tracking-wide hover:bg-white hover:shadow-glow-blue transition-all shadow-glow-blue whitespace-nowrap active:scale-95"
                        >
                            Generate summary
                        </button>
                    </div>
                ) : loading ? (
                    <div className="flex items-center gap-3 text-intuition-primary font-sans text-sm animate-pulse font-medium py-4 pl-4 border-l-2 border-intuition-primary/40">
                        <Loader2 size={16} className="animate-spin" /> Generating summary…
                    </div>
                ) : (
                    <div className="flex gap-6 items-start animate-in fade-in duration-500 pl-4 border-l-2 border-intuition-primary/50">
                        <Quote size={24} className="text-intuition-primary shrink-0 opacity-60 mt-1 text-glow-blue" />
                        <p className="text-slate-200 font-sans text-sm leading-relaxed">
                            {displayedText}
                            <span className="inline-block w-2 h-3.5 bg-intuition-primary ml-1 animate-pulse shadow-glow-blue rounded-sm"></span>
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
                <div className={`absolute -inset-4 rounded-full bg-gradient-to-r from-intuition-primary/20 via-intuition-secondary/20 to-intuition-primary/20 blur-xl opacity-30 group-hover:opacity-60 transition-all duration-700 animate-pulse`}></div>
                <div className={`absolute inset-0 rounded-full border-2 border-dashed ${tension > 30 ? 'border-intuition-danger/40' : 'border-intuition-primary/30'} group-hover:border-intuition-primary/60 transition-all duration-500`}></div>
                <button 
                    onClick={() => { playClick(); onSwap(); }}
                    onMouseEnter={playHover}
                    className={`relative w-16 h-16 bg-black border-2 rounded-full flex items-center justify-center text-white hover:text-black hover:bg-intuition-primary transition-all duration-500 hover:scale-110 shadow-2xl group-hover:shadow-glow-blue ${tension > 30 ? 'border-intuition-danger shadow-glow-red' : 'border-intuition-primary'}`}
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
            className={`relative flex-1 bg-gradient-to-b from-[#03050c] to-[#020308] border-2 p-4 sm:p-6 md:p-10 flex flex-col items-center justify-center min-h-[320px] sm:min-h-[380px] transition-all duration-500 group cursor-pointer overflow-hidden ${isWinner ? 'border-intuition-success/50 shadow-[0_0_60px_rgba(0,255,157,0.12)] hover:shadow-[0_0_80px_rgba(0,255,157,0.15)]' : isLoser ? 'border-intuition-danger/20 opacity-70 grayscale hover:grayscale-0 hover:opacity-90' : 'border-slate-800 hover:border-intuition-primary/50 hover:shadow-[0_0_30px_rgba(0,243,255,0.06)]'}`}
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
                <div className="flex flex-col items-center text-slate-600 group-hover:text-intuition-primary transition-all duration-500">
                    <div className="w-24 h-24 rounded-none border-2 border-dashed border-slate-800 flex items-center justify-center group-hover:border-intuition-primary group-hover:shadow-glow-blue transition-all duration-500 mb-6 bg-white/[0.02] group-hover:bg-intuition-primary/5">
                        <Crosshair size={32} className="opacity-30 group-hover:opacity-100 group-hover:text-intuition-primary" />
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
        <div className="flex items-center justify-between py-4 px-4 sm:px-6 md:px-10 transition-all group relative overflow-hidden min-h-[80px] sm:min-h-[100px] border-b border-white/5">
            {/* Asymmetrical Background Weight Bars */}
            <div className="absolute inset-0 flex pointer-events-none opacity-[0.08] group-hover:opacity-[0.12] transition-opacity">
                <div className="h-full bg-intuition-primary transition-all duration-1000 ease-out" style={{ width: `${lPct}%` }}></div>
                <div className="h-full bg-intuition-secondary transition-all duration-1000 ease-out" style={{ width: `${rPct}%` }}></div>
            </div>

            <div className={`relative z-10 w-1/3 text-right pr-12 transition-all duration-500 ${leftWins ? 'scale-110' : 'opacity-40 grayscale'}`}>
                <div className={`font-mono font-black text-3xl tracking-tighter ${leftWins ? 'text-intuition-primary text-glow-blue' : 'text-white'}`}>
                    {Number(leftVal).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <span className="inline-flex items-baseline text-slate-300 font-bold uppercase tracking-wider text-[10px] mt-0.5">{typeof unit === 'string' ? unit : unit}</span>
            </div>
            
            <div className="relative z-10 flex flex-col items-center w-1/3 shrink-0">
                <div className={`mb-2 p-2 bg-black border border-white/10 shadow-xl transition-all ${leftWins ? 'text-intuition-primary border-intuition-primary/40' : rightWins ? 'text-intuition-secondary border-intuition-secondary/40' : 'text-slate-500'}`}>
                    {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 16 })}
                </div>
                <div className="text-[10px] font-bold font-mono text-slate-200 text-center whitespace-nowrap px-1">{label}</div>
            </div>

            <div className={`relative z-10 w-1/3 text-left pl-12 transition-all duration-500 ${rightWins ? 'scale-110' : 'opacity-40 grayscale'}`}>
                <div className={`font-mono font-black text-3xl tracking-tighter ${rightWins ? 'text-intuition-secondary text-glow-red' : 'text-white'}`}>
                    {Number(rightVal).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <span className="inline-flex items-baseline text-slate-300 font-bold uppercase tracking-wider text-[10px] mt-0.5">{typeof unit === 'string' ? unit : unit}</span>
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
    const [leftExits, setLeftExits] = useState<number>(0);
    const [rightExits, setRightExits] = useState<number>(0);

    useEffect(() => {
        getAllAgents().then(data => setAgents(data.items));
    }, []);

    useEffect(() => {
        if (!leftAgent?.id || !rightAgent?.id) {
            setLeftExits(0);
            setRightExits(0);
            return;
        }
        let cancelled = false;
        Promise.all([
            getRedemptionCountForVault(leftAgent.id),
            getRedemptionCountForVault(rightAgent.id),
        ]).then(([l, r]) => {
            if (!cancelled) {
                setLeftExits(l);
                setRightExits(r);
            }
        });
        return () => { cancelled = true; };
    }, [leftAgent?.id, rightAgent?.id]);

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
        <div className="min-h-screen bg-[#020308] pt-12 pb-32 px-4 sm:px-6 max-w-[1500px] mx-auto relative font-mono selection:bg-intuition-primary selection:text-black min-w-0 overflow-x-hidden">
            <div className="fixed inset-0 pointer-events-none z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>

            <div className="flex flex-col lg:flex-row items-center justify-between mb-12 gap-8 border-b-2 border-slate-800 pb-10 relative z-10">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-black/80 border-2 border-intuition-primary/60 flex items-center justify-center text-intuition-primary shadow-glow-blue clip-path-slant">
                        <BarChart3 size={32} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-intuition-primary font-black font-mono text-[9px] tracking-[0.5em] uppercase mb-1">
                             <Zap size={10} className="animate-pulse" /> Signal_Parity_Module
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black font-display tracking-tight uppercase leading-tight mobile-break min-w-0">
                            <span className="text-white text-glow-white">COMPARISON</span><span className="text-intuition-secondary text-glow-red">_DECK</span>
                        </h1>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-4">
                    <div className="px-6 py-3 bg-black/60 border border-intuition-primary/20 font-mono text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                        <Terminal size={14} className="text-intuition-primary" /> TARGET_LOCK: <span className="text-white text-glow-white">{leftAgent && rightAgent ? 'SYNCHRONIZED' : 'AWAITING_UPLINK'}</span>
                    </div>
                    <div className="px-6 py-3 bg-intuition-secondary text-white font-black font-mono text-[10px] uppercase tracking-widest shadow-glow-red hover:shadow-[0_0_25px_rgba(255,30,109,0.4)] active:scale-95 transition-all">
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
                        {/* Side-by-side comparison — clear labels and visible units */}
                        <div className="bg-gradient-to-b from-[#04060c] to-[#020308] border border-white/10 shadow-2xl relative overflow-hidden clip-path-slant hover:border-intuition-primary/20 transition-all duration-500">
                            <div className="bg-gradient-to-r from-intuition-primary/10 via-transparent to-intuition-secondary/10 py-4 border-b border-intuition-primary/20 flex justify-center items-center relative z-20">
                                <div className="text-sm font-bold text-white uppercase tracking-wider">Comparison</div>
                            </div>
                            
                            <div className="bg-black/40">
                                <ComparisonRow 
                                    label="Trading volume" 
                                    leftVal={parseFloat(formatEther(BigInt(leftAgent.totalAssets || '0')))} 
                                    rightVal={parseFloat(formatEther(BigInt(rightAgent.totalAssets || '0')))}
                                    unit={<CurrencySymbol size="sm" className="text-slate-300" />}
                                    icon={<Shield />}
                                />
                                <ComparisonRow 
                                    label="Volatility" 
                                    leftVal={calculateVolatility(leftAgent.totalAssets || '0')} 
                                    rightVal={calculateVolatility(rightAgent.totalAssets || '0')}
                                    unit="index"
                                    icon={<Activity />}
                                />
                                <ComparisonRow 
                                    label="Holders" 
                                    leftVal={leftAgent.positionCount ?? 0} 
                                    rightVal={rightAgent.positionCount ?? 0}
                                    unit="count"
                                    icon={<Users />}
                                />
                                <ComparisonRow 
                                    label="Exits (sells)" 
                                    leftVal={leftExits} 
                                    rightVal={rightExits}
                                    unit="count"
                                    icon={<Activity />}
                                />
                                <ComparisonRow 
                                    label="Risk proxy" 
                                    leftVal={calculateVolatility(leftAgent.totalAssets || '0')} 
                                    rightVal={calculateVolatility(rightAgent.totalAssets || '0')}
                                    unit="σ"
                                    icon={<TrendingUp />}
                                />
                                <ComparisonRow 
                                    label="Signal strength" 
                                    leftVal={(lScore * 1.2).toFixed(0)} 
                                    rightVal={(rScore * 1.2).toFixed(0)}
                                    unit="score"
                                    icon={<Network />}
                                />
                            </div>
                        </div>

                        {/* LIVE TELEMETRY CHART */}
                        <div className="bg-gradient-to-b from-[#04060c] to-[#020308] border border-white/10 p-10 h-[520px] relative group shadow-2xl overflow-hidden clip-path-slant hover:border-intuition-primary/20 transition-all duration-500">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] pointer-events-none"></div>
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-intuition-primary/5 to-transparent pointer-events-none" />
                            
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
                                <div className="px-4 py-2 bg-black/80 border border-intuition-primary/30 text-[9px] font-black font-mono text-intuition-primary uppercase tracking-[0.3em] shadow-glow-blue">
                                    ROI_OVER_TIME
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
                                <div className="text-[10px] font-black font-mono text-slate-500 uppercase tracking-[0.6em] animate-pulse">
                                    MAGNITUDE & ROI TRAJECTORY
                                </div>
                                <div className="flex gap-2 h-1.5 w-48 bg-white/10 overflow-hidden rounded-full border border-white/10">
                                    <div className="h-full bg-intuition-primary animate-buffer-fill shadow-glow-blue rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto text-center py-32 border-2 border-dashed border-slate-800 bg-gradient-to-b from-slate-900/40 to-black/40 clip-path-slant relative group transition-all duration-500 hover:border-intuition-primary/40 hover:shadow-[0_0_60px_rgba(0,243,255,0.06)]">
                    <div className="absolute inset-0 bg-intuition-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Crosshair size={64} className="mx-auto text-slate-600 mb-8 opacity-40 group-hover:text-intuition-primary group-hover:opacity-100 transition-all duration-700 animate-spin-slow relative z-10" />
                    <h3 className="text-2xl font-black font-display text-slate-500 uppercase tracking-[0.5em] mb-4 group-hover:text-intuition-primary group-hover:text-glow-blue transition-all duration-500 relative z-10">AWAITING_CHALLENGERS</h3>
                    <p className="text-slate-600 font-mono text-[10px] uppercase tracking-[0.4em] px-8 leading-relaxed max-w-lg mx-auto font-black group-hover:text-slate-400 transition-colors relative z-10">
                        Select two identity nodes to initiate lethal semantic collision analysis and project arbitrage deltas across active corridors.
                    </p>
                </div>
            )}

            {isSelectorOpen && (
                <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsSelectorOpen(null)}>
                    <div className="w-full max-w-2xl bg-gradient-to-b from-[#06080e] to-[#020308] border-2 border-intuition-primary/40 p-10 clip-path-slant relative overflow-hidden shadow-[0_0_80px_rgba(0,243,255,0.1)] hover:shadow-[0_0_100px_rgba(0,243,255,0.15)] transition-shadow duration-500" onClick={e => e.stopPropagation()}>
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