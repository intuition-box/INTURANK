import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Cpu, Zap, Info, Terminal, BookOpen, ExternalLink, ShieldCheck, History } from 'lucide-react';
import SkillChat from '../components/SkillChat';
import { playClick, playHover } from '../services/audio';
import { CURRENCY_SYMBOL, PAGE_HERO_TITLE } from '../constants';

/** Fixed-height shell: inner message list scrolls; outer height does not grow with message count. */
const CHAT_SHELL =
    'flex flex-col min-h-0 rounded-3xl sm:rounded-[1.75rem] ' +
    'border-2 border-intuition-primary/30 bg-[#06080f]/95 backdrop-blur-md p-1.5 sm:p-2 shadow-[0_0_72px_rgba(0,243,255,0.12),inset_0_1px_0_rgba(255,255,255,0.04)] ' +
    'overflow-hidden ' +
    'h-[min(88dvh,calc(100dvh-7.5rem))] max-h-[min(88dvh,calc(100dvh-7.5rem))] ' +
    'sm:h-[min(86dvh,calc(100dvh-8.5rem))] sm:max-h-[min(86dvh,calc(100dvh-8.5rem))] ' +
    'xl:h-[min(82dvh,calc(100dvh-9rem))] xl:max-h-[min(82dvh,calc(100dvh-9rem))]';

const SkillPlayground: React.FC = () => {
    return (
        <div className="min-h-[calc(100dvh-4rem)] flex flex-col bg-[#020308] pt-6 sm:pt-8 pb-8 sm:pb-12 px-3 sm:px-5 lg:px-8 xl:px-10 2xl:px-14 relative overflow-x-hidden">
            <div className="fixed inset-0 pointer-events-none z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
            <div className="absolute inset-0 pointer-events-none opacity-[0.05] retro-grid" aria-hidden />
            <div className="absolute top-0 right-0 w-[min(80vw,720px)] h-[min(80vw,720px)] bg-intuition-primary/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[min(60vw,520px)] h-[min(60vw,520px)] bg-[#ff1e6d]/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-[min(1800px,100%)] mx-auto relative z-10 flex flex-col flex-1 min-h-0">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between shrink-0 mb-5 sm:mb-6 lg:mb-7">
                    <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-black border-2 border-intuition-primary/80 flex items-center justify-center rounded-2xl sm:rounded-3xl shadow-[0_0_32px_rgba(0,243,255,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <Cpu size={26} className="text-intuition-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-slate-500 font-sans mb-0.5">
                                Brought to you by{' '}
                                <Link
                                    to="/"
                                    onClick={playClick}
                                    onMouseEnter={playHover}
                                    className="font-semibold text-intuition-primary hover:text-intuition-primary/85 transition-colors"
                                >
                                    IntuRank
                                </Link>
                            </p>
                            <h1 className={PAGE_HERO_TITLE}>Intuition Skill Playground</h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
                        <Link
                            to="/create"
                            onClick={playClick}
                            onMouseEnter={playHover}
                            className="px-4 sm:px-5 py-2.5 bg-white/5 border border-white/10 hover:border-intuition-primary text-slate-300 hover:text-white text-sm font-medium rounded-2xl inline-flex items-center gap-2 transition-all"
                        >
                            <ArrowLeft size={14} /> Back
                        </Link>
                        <a
                            href="https://explorer.intuition.systems"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={playClick}
                            onMouseEnter={playHover}
                            className="px-4 sm:px-5 py-2.5 bg-white/5 border-2 border-intuition-primary/40 hover:border-intuition-primary hover:bg-intuition-primary/10 text-intuition-primary hover:text-white text-sm font-medium transition-all rounded-2xl inline-flex items-center gap-2 shadow-[0_0_20px_rgba(0,243,255,0.12)]"
                        >
                            <History size={14} /> Explorer
                        </a>
                        <a
                            href="https://docs.intuition.systems"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 sm:px-5 py-2.5 bg-intuition-primary text-black text-sm font-semibold rounded-2xl shadow-[0_0_28px_rgba(0,243,255,0.35)] inline-flex items-center gap-2"
                        >
                            <BookOpen size={14} /> Docs <ExternalLink size={10} />
                        </a>
                    </div>
                </header>

                {/* Chat left; reference + tips on the right (xl+) */}
                <div className="flex flex-col xl:flex-row xl:items-stretch gap-5 lg:gap-6 xl:gap-8 flex-1 min-h-0">
                    <div className={`${CHAT_SHELL} flex-1 min-w-0 min-h-0 shrink`}>
                        <SkillChat />
                    </div>

                    <aside className="w-full xl:w-[min(100%,300px)] 2xl:w-[320px] shrink-0 xl:sticky xl:top-20 xl:self-start xl:max-h-[min(calc(100dvh-6rem),920px)] overflow-y-auto custom-scrollbar space-y-4">
                        <div className="bg-black/80 border border-white/10 p-5 sm:p-6 rounded-2xl lg:rounded-3xl relative overflow-hidden group shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                            <div className="absolute -right-4 -top-4 opacity-[0.06] pointer-events-none group-hover:opacity-[0.1] transition-opacity">
                                <Terminal size={88} className="text-intuition-primary" />
                            </div>

                            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2 relative font-sans">
                                <Info size={15} className="text-intuition-primary shrink-0" />
                                Quick reference
                            </h2>

                            <div className="space-y-4 text-sm text-slate-400 leading-relaxed relative font-sans">
                                <p>
                                    Ask in plain language. When a step needs the chain, review the summary and use{' '}
                                    <span className="text-slate-200">Sign &amp; broadcast</span>.
                                </p>

                                <div>
                                    <div className="text-xs font-medium text-slate-500 mb-2">Typical costs (approx.)</div>
                                    <ul className="space-y-2 text-sm text-slate-300">
                                        <li className="flex justify-between gap-2 border-b border-white/5 pb-2">
                                            <span>Atom</span>
                                            <span className="text-intuition-primary tabular-nums">~0.15 {CURRENCY_SYMBOL} + deposit</span>
                                        </li>
                                        <li className="flex justify-between gap-2 border-b border-white/5 pb-2">
                                            <span>Triple</span>
                                            <span className="text-intuition-primary tabular-nums">~0.15 {CURRENCY_SYMBOL} + deposit</span>
                                        </li>
                                        <li className="flex justify-between gap-2">
                                            <span>Vault deposit</span>
                                            <span className="text-slate-500">Varies</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="pt-2 border-t border-white/10">
                                    <div className="text-xs font-medium text-amber-400/90 mb-1 flex items-center gap-1.5">
                                        <Zap size={10} className="shrink-0" /> Tip
                                    </div>
                                    <p className="text-slate-500 text-sm">
                                        You can explore without a wallet. Connect when you are ready to spend TRUST on Intuition Mainnet.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-black/40 border border-white/10 rounded-2xl lg:rounded-3xl p-4 lg:p-5 hover:border-intuition-primary/30 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-1.5 bg-intuition-primary/15 rounded-lg border border-intuition-primary/25">
                                    <Zap size={16} className="text-intuition-primary" />
                                </div>
                                <h3 className="text-sm font-semibold text-white font-sans">Autonomous creation</h3>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed font-sans">
                                Describe what you want in everyday language. The agent builds calldata and fees. You approve in your wallet.
                            </p>
                        </div>

                        <div className="bg-black/40 border border-white/10 rounded-2xl lg:rounded-3xl p-4 lg:p-5 hover:border-[#ff1e6d]/30 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-1.5 bg-[#ff1e6d]/10 rounded-lg border border-[#ff1e6d]/25">
                                    <ShieldCheck size={16} className="text-[#ff1e6d]" />
                                </div>
                                <h3 className="text-sm font-semibold text-white font-sans">You stay in control</h3>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed font-sans">
                                Transactions follow Intuition standards. Always read the summary before signing. Your keys, your approval.
                            </p>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default SkillPlayground;
