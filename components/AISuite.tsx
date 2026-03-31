import React, { useState, useEffect } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Account, Triple, Transaction } from '../types';
import { formatEther } from 'viem';
import { formatDisplayedShares } from '../services/analytics';
import { CURRENCY_SYMBOL, getGeminiApiKey, GEMINI_MODEL } from '../constants';

/** Stable IDs first — preview names often 404 for many keys */
const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'] as const;

function modelsToTry(): string[] {
  const preferred = GEMINI_MODEL.trim();
  const rest = GEMINI_FALLBACK_MODELS.filter((m) => m !== preferred);
  return [...new Set([preferred, ...rest])];
}

function extractGeminiText(response: unknown): string | undefined {
  const r = response as {
    text?: string;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const direct = typeof r.text === 'string' ? r.text.trim() : '';
  if (direct) return direct;
  const parts = r.candidates?.[0]?.content?.parts;
  if (!parts?.length) return undefined;
  const joined = parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
  return joined || undefined;
}

function heuristicBrief(agent: Account, triples: Triple[], history: Transaction[]): string {
  const label = agent.label || 'This market';
  const kind = agent.type || 'entry';
  const tc = triples?.length ?? 0;
  const hc = history?.length ?? 0;
  const vol = agent.totalAssets ? formatEther(BigInt(agent.totalAssets)) : '0';
  const shares = agent.totalShares ? formatDisplayedShares(agent.totalShares) : '0';
  const claimsWord = tc === 1 ? 'claim' : 'claims';
  const activityWord = hc === 1 ? 'activity' : 'activities';
  return (
    `${label} is a ${kind} with ${tc} linked ${claimsWord} and ${hc} recent ${activityWord} on file. ` +
    `About ${vol} ${CURRENCY_SYMBOL} in assets and ${shares} shares are shown for this page. ` +
    `Use this as context alongside price and liquidity—not as financial advice.`
  );
}

export const AIBriefing: React.FC<{ agent: Account; triples: Triple[]; history: Transaction[] }> = ({ agent, triples, history }) => {
    const [brief, setBrief] = useState<string>('');
    const [loading, setLoading] = useState(true);
    /** When Gemini fails, we still show a useful on-chain summary */
    const [mode, setMode] = useState<'gemini' | 'heuristic' | 'no_key'>('gemini');

    useEffect(() => {
        const generateBrief = async () => {
            if (!agent.id) return;
            
            setLoading(true);
            setMode('gemini');
            try {
                const apiKey = getGeminiApiKey();
                if (!apiKey) {
                    setBrief(
                        'Live summaries are turned off because no AI key is configured for this build. Ask the site owner to add a Google AI key, or check the project README for setup.'
                    );
                    setMode('no_key');
                    setLoading(false);
                    return;
                }
                const ai = new GoogleGenAI({ apiKey });
                const triplesContext = (triples || [])
                    .slice(0, 5)
                    .map(t => `${t.subject?.label || 'Subject'} -> ${t.predicate?.label || 'Link'} -> ${t.object?.label || 'Object'}`)
                    .join(', ');

                const prompt = `
                    Summarize this IntuRank / Intuition market entry for a regular reader (not a developer).
                    Data:
                    - Name: "${agent.label || 'Unknown'}"
                    - Type: ${agent.type || 'Standard'}
                    - Assets: ${agent.totalAssets ? formatEther(BigInt(agent.totalAssets)) : '0'} ${CURRENCY_SYMBOL}
                    - Shares: ${agent.totalShares ? formatDisplayedShares(agent.totalShares) : '0'}
                    - Related claims: ${triples?.length || 0}
                    - Recent activity rows: ${history?.length || 0}
                    - Sample relationships: [${triplesContext || 'None listed'}]

                    Write exactly two short sentences in plain English. No slang, no ALL CAPS labels, no underscores, no fake "system" jargon. Be neutral and informative.
                `;

                let lastError: unknown;
                let success = false;
                for (const model of modelsToTry()) {
                    try {
                        const response = await ai.models.generateContent({
                            model,
                            contents: prompt,
                        });
                        const text = extractGeminiText(response);
                        if (text) {
                            setBrief(text);
                            setMode('gemini');
                            success = true;
                            break;
                        }
                    } catch (e) {
                        lastError = e;
                    }
                }
                if (!success) {
                    setBrief(heuristicBrief(agent, triples, history));
                    setMode('heuristic');
                    if (import.meta.env.DEV && lastError) console.warn('[AIBriefing] Gemini failed, using heuristic:', lastError);
                }
            } catch (e) {
                setBrief(heuristicBrief(agent, triples, history));
                setMode('heuristic');
                if (import.meta.env.DEV) console.warn('[AIBriefing] Gemini failed, using heuristic:', e);
            } finally {
                setLoading(false);
            }
        };
        generateBrief();
    }, [agent.id, agent.totalAssets, triples?.length, history?.length]);

    return (
        <div className="bg-black border border-slate-900 p-8 clip-path-slant relative overflow-hidden group min-h-[160px] shadow-[0_8px_32px_rgba(0,0,0,0.45)] transition-colors duration-200">
            {/* Watermark: centered behind content (corner placement read as “broken” alignment) */}
            <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-600"
                aria-hidden
            >
                <Brain className="h-[min(9rem,42vw)] w-[min(9rem,42vw)] opacity-[0.06]" strokeWidth={1} />
            </div>
            <h3 className="mb-5 relative z-10 text-sm font-semibold text-slate-100 tracking-tight">
                AI summary
            </h3>
            {loading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-1">
                    <Loader2 size={18} className="animate-spin shrink-0 text-intuition-primary/80" aria-hidden />
                    <span>Writing summary…</span>
                </div>
            ) : (
                <div className="relative z-10 pl-4 border-l-2 border-intuition-primary/50 py-1">
                    <p className="text-sm md:text-base text-slate-200 leading-relaxed tracking-tight group-hover:text-slate-100 transition-colors">
                        {brief}
                    </p>
                    {mode === 'heuristic' && (
                        <p className="mt-3 text-xs text-slate-500 leading-snug">
                            The AI service didn&apos;t respond, so this text is assembled from the numbers on this page instead.
                        </p>
                    )}
                    {mode === 'no_key' && (
                        <p className="mt-3 text-xs text-amber-200/90 leading-snug">
                            Turning on live summaries requires setup on the server side.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};