
import React, { useState, useEffect } from 'react';
import { Brain, ShieldCheck, Zap, Loader2, AlertCircle, Quote, Terminal } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Account, Triple, Transaction } from '../types';
import { formatEther } from 'viem';

const MODEL_NAME = 'gemini-3-flash-preview';

export const AIBriefing: React.FC<{ agent: Account; triples: Triple[]; history: Transaction[] }> = ({ agent, triples, history }) => {
    const [brief, setBrief] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const generateBrief = async () => {
            if (!agent.id) return;
            setLoading(true);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const triplesContext = (triples || [])
                    .slice(0, 5)
                    .map(t => `${t.subject?.label || 'Subject'} -> ${t.predicate?.label || 'Link'} -> ${t.object?.label || 'Object'}`)
                    .join(', ');

                const prompt = `
                    Analyze the following trust graph data for an agent named "${agent.label || 'Unknown Agent'}".
                    - Protocol Volume: ${agent.totalAssets ? formatEther(BigInt(agent.totalAssets)) : '0'} TRUST
                    - Stake Supply: ${agent.totalShares ? formatEther(BigInt(agent.totalShares)) : '0'}
                    - Network Claims: ${triples?.length || 0}
                    - Market Activity: ${history?.length || 0} transactions
                    - Contextual Relations: ${triplesContext || 'None identified'}

                    Provide a 2-sentence professional research briefing for a financial terminal. 
                    Be objective, concise, and highlight market sentiment.
                `;

                const response = await ai.models.generateContent({
                    model: MODEL_NAME,
                    contents: prompt,
                });
                setBrief(response.text || 'Insufficient data for synthesis.');
            } catch (e) {
                console.error("AI_SYNTHESIS_FAILURE:", e);
                setBrief('Neural uplink restricted. Real-time intel unavailable.');
            } finally {
                setLoading(false);
            }
        };
        generateBrief();
    }, [agent.id, triples?.length, history?.length]);

    return (
        <div className="bg-intuition-card border border-intuition-primary/40 p-6 clip-path-slant relative overflow-hidden group min-h-[140px] shadow-[0_0_30px_rgba(0,243,255,0.05)] hover:shadow-[0_0_40px_rgba(0,243,255,0.15)] transition-all duration-500">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-intuition-primary group-hover:scale-110 transition-transform duration-700">
                <Brain size={64} />
            </div>
            
            {/* Header with Pulse */}
            <div className="flex justify-between items-center mb-4 relative z-10">
                <h3 className="text-[10px] font-mono text-intuition-primary uppercase tracking-[0.3em] flex items-center gap-2 font-black">
                    <div className="relative">
                        <Brain size={14} className="text-intuition-primary" />
                        <div className="absolute inset-0 bg-intuition-primary blur-sm opacity-50 animate-pulse"></div>
                    </div>
                    Neural_Intelligence_Uplink
                </h3>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-intuition-primary/10 border border-intuition-primary/20 rounded text-[8px] font-mono text-intuition-primary">
                    <Terminal size={10} /> GEMINI_CORE_FLASH
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col gap-3 py-2">
                    <div className="flex items-center gap-3 text-slate-500 font-mono text-xs">
                        <Loader2 size={14} className="animate-spin" /> SYNCHRONIZING_COGNITION...
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-intuition-primary w-1/3 animate-[marquee_2s_linear_infinite] shadow-[0_0_10px_#00f3ff]"></div>
                    </div>
                </div>
            ) : (
                <div className="relative z-10">
                    <div className="absolute -left-1 top-0 bottom-0 w-[2px] bg-gradient-to-b from-intuition-primary via-intuition-primary/50 to-transparent"></div>
                    <p className="text-sm md:text-base text-slate-200 leading-relaxed font-mono italic pl-6 group-hover:text-white transition-colors">
                        <Quote size={16} className="inline-block mr-2 text-intuition-primary/50 -translate-y-1" fill="currentColor" />
                        {brief}
                    </p>
                </div>
            )}
        </div>
    );
};

export const RealityCheck: React.FC<{ agent: Account; score: number }> = ({ agent, score }) => {
    const getStatus = () => {
        if (score > 80) return { label: 'OVERSOLD_TRUST', color: 'text-emerald-400', icon: ShieldCheck, glow: 'text-glow-success' };
        if (score < 30) return { label: 'CRITICAL_DISTRUST', color: 'text-rose-400', icon: AlertCircle, glow: 'text-glow-danger' };
        return { label: 'STABLE_EQUILIBRIUM', color: 'text-blue-400', icon: Zap, glow: 'text-glow' };
    };
    const status = getStatus();
    const Icon = status.icon;

    return (
        <div className="bg-black border border-white/10 p-5 clip-path-slant group hover:border-white/30 transition-all hover:bg-white/5 shadow-lg">
            <div className="flex justify-between items-center mb-3">
                <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">Terminal Market Status</div>
                <div className={`text-[9px] font-mono font-black ${status.color} uppercase tracking-widest ${status.glow}`}>{status.label}</div>
            </div>
            <div className="flex items-center gap-4">
                <div className={`p-2 bg-black border ${status.color.replace('text-', 'border-').replace('400', '400/30')} rounded group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
                    <Icon size={20} className={status.color} />
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-end mb-1.5">
                        <span className="text-[10px] font-mono text-slate-500">Conviction Strength</span>
                        <span className={`text-sm font-mono font-black ${status.color}`}>{score.toFixed(1)}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 p-[1px]">
                        <div 
                            style={{ width: `${score}%` }} 
                            className={`h-full transition-all duration-1000 ${status.color === 'text-emerald-400' ? 'bg-emerald-400' : status.color === 'text-rose-400' ? 'bg-rose-400' : 'bg-blue-400'} shadow-[0_0_10px_currentColor]`}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ShieldScore: React.FC<{ history: Transaction[] }> = ({ history }) => {
    const deposits = (history || []).filter(h => h.type === 'DEPOSIT').length;
    const total = (history || []).length || 1;
    const integrity = Math.min(100, Math.floor((deposits / total) * 100));

    return (
        <div className="bg-black border border-white/10 p-5 clip-path-slant group hover:border-white/30 transition-all hover:bg-white/5 shadow-lg">
            <div className="flex justify-between items-center mb-3">
                <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">Shield Integrity Index</div>
                <div className="text-[10px] font-mono text-intuition-primary font-black uppercase text-glow">{integrity}%</div>
            </div>
            <div className="flex gap-1.5 h-4 px-1">
                {[...Array(10)].map((_, i) => (
                    <div 
                        key={i} 
                        className={`flex-1 transition-all duration-700 clip-path-slant ${i < integrity / 10 ? 'bg-intuition-primary shadow-[0_0_12px_#00f3ff]' : 'bg-slate-900 opacity-20'}`}
                        style={{ transitionDelay: `${i * 60}ms` }}
                    ></div>
                ))}
            </div>
            <div className="mt-2 text-[8px] font-mono text-slate-600 text-center uppercase tracking-widest opacity-60">
                Data reconciler active // Community Signal ratio
            </div>
        </div>
    );
};
