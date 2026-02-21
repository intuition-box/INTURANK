import React, { useState, useEffect } from 'react';
import { Brain, ShieldCheck, Zap, Loader2, AlertCircle, Quote, Terminal } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Account, Triple, Transaction } from '../types';
import { formatEther } from 'viem';
import { formatDisplayedShares } from '../services/analytics';
import { CURRENCY_SYMBOL } from '../constants';

const MODEL_NAME = 'gemini-3-flash-preview';

export const AIBriefing: React.FC<{ agent: Account; triples: Triple[]; history: Transaction[] }> = ({ agent, triples, history }) => {
    const [brief, setBrief] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const generateBrief = async () => {
            if (!agent.id) return;
            
            setLoading(true);
            try {
                const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
                if (!apiKey) {
                    setBrief('ERROR: Set VITE_GEMINI_API_KEY in .env.local for AI briefing.');
                    setLoading(false);
                    return;
                }
                const ai = new GoogleGenAI({ apiKey });
                const triplesContext = (triples || [])
                    .slice(0, 5)
                    .map(t => `${t.subject?.label || 'Subject'} -> ${t.predicate?.label || 'Link'} -> ${t.object?.label || 'Object'}`)
                    .join(', ');

                const prompt = `
                    Perform a high-fidelity semantic audit of the following trust graph node:
                    - Entity: "${agent.label || 'Unknown Agent'}"
                    - Classification: ${agent.type || 'Standard Atom'}
                    - Protocol Volume: ${agent.totalAssets ? formatEther(BigInt(agent.totalAssets)) : '0'} ${CURRENCY_SYMBOL}
                    - Circulating Shares: ${agent.totalShares ? formatDisplayedShares(agent.totalShares) : '0'} Portal Units
                    - Graph Depth: ${triples?.length || 0} semantic claims identified.
                    - Historical Interactions: ${history?.length || 0} on-chain transmissions.
                    - Logical Context: [${triplesContext || 'Isolated Node'}]

                    Role: You are a Lead Intelligence Architect for IntuRank.
                    Objective: Provide a 2-sentence tactical briefing for a high-frequency reputation trader. 
                    Style: Cypherpunk, objective, techno-financial, concise.
                `;

                const response = await ai.models.generateContent({
                    model: MODEL_NAME,
                    contents: [{ parts: [{ text: prompt }] }],
                });
                
                setBrief(response.text || 'Synthesis incomplete. Core data stream fragmented.');
            } catch (e) {
                setBrief('Neural uplink restricted. Satellite hand-off required.');
            } finally {
                setLoading(false);
            }
        };
        generateBrief();
    }, [agent.id, agent.totalAssets, triples?.length, history?.length]);

    return (
        <div className="bg-black border border-slate-900 p-8 clip-path-slant relative overflow-hidden group min-h-[160px] shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-500">
            <div className="absolute top-0 right-0 p-6 opacity-5 text-slate-800 group-hover:scale-125 transition-transform duration-1000">
                <Brain size={120} />
            </div>
            <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-[10px] font-black font-mono text-intuition-primary uppercase tracking-[0.4em] flex items-center gap-3">
                    <Terminal size={14} className="text-intuition-primary animate-pulse" />
                    NEURAL_INTELLIGENCE_UPLINK
                </h3>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 text-[8px] font-black font-mono text-slate-500 uppercase tracking-widest">
                    <span>GEMINI_CORE_L3</span>
                </div>
            </div>
            {loading ? (
                <div className="space-y-4 py-2">
                    <div className="flex items-center gap-3 text-slate-600 font-mono text-[10px] tracking-widest animate-pulse uppercase">
                        <Loader2 size={16} className="animate-spin" /> SYNCHRONIZING_SIGNAL_DATA...
                    </div>
                </div>
            ) : (
                <div className="relative z-10 pl-6 border-l-4 border-intuition-primary/40 py-2">
                    <p className="text-sm md:text-base text-slate-200 leading-relaxed font-mono italic tracking-tight group-hover:text-white transition-colors">
                        <Quote size={20} className="inline-block mr-3 text-intuition-primary/60" fill="currentColor" />
                        {brief}
                    </p>
                </div>
            )}
        </div>
    );
};