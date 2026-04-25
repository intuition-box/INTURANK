import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Cpu,
    Zap,
    Info,
    BookOpen,
    ExternalLink,
    ShieldCheck,
    History,
    ChevronRight,
} from 'lucide-react';
import SkillChat from '../components/SkillChat';
import { SkillErrorBoundary } from '../components/SkillErrorBoundary';
import { playClick, playHover } from '../services/audio';
import { CURRENCY_SYMBOL, PAGE_HERO_TITLE } from '../constants';

const useInView = (options: { once?: boolean; threshold?: number } = {}) => {
    const [isInView, setIsInView] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    if (options.once) observer.unobserve(entry.target);
                } else if (!options.once) {
                    setIsInView(false);
                }
            },
            { threshold: 0.1, ...options }
        );

        const el = ref.current;
        if (el) observer.observe(el);
        return () => {
            if (el) observer.unobserve(el);
        };
    }, [options.once]);

    return [ref, isInView] as const;
};

const Reveal: React.FC<{
    children: React.ReactNode;
    delay?: number;
    className?: string;
}> = ({ children, delay = 0, className = '' }) => {
    const [ref, isInView] = useInView({ once: true });
    return (
        <div
            ref={ref}
            className={`transition-[opacity,transform] duration-500 ${isInView ? 'opacity-100' : 'opacity-0'} ${className}`}
            style={{
                transitionDelay: `${delay}ms`,
                transform: isInView ? 'translateY(0)' : 'translateY(14px)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
        >
            {children}
        </div>
    );
};

const REF_CARD =
    'group relative overflow-hidden rounded-[1.5rem] border border-white/[0.1] bg-[#04060c]/80 ' +
    'shadow-[0_20px_50px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.07)] ' +
    'ring-1 ring-inset ring-white/[0.04] backdrop-blur-2xl backdrop-saturate-150 motion-hover-lift';

const TIP_CARD =
    'group relative overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#03050a]/75 ' +
    'shadow-[0_12px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] ' +
    'ring-1 ring-inset ring-white/[0.03] backdrop-blur-xl backdrop-saturate-150 motion-hover-lift';

/** Fixed-height shell: inner message list scrolls; outer height does not grow with message count. */
const CHAT_SHELL =
    'flex flex-col min-h-0 rounded-3xl sm:rounded-[1.75rem] ' +
    'border-2 border-intuition-primary/30 bg-[#05070d]/[0.97] backdrop-blur-xl backdrop-saturate-150 p-1.5 sm:p-2 shadow-[0_0_72px_rgba(0,243,255,0.12),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-black/30 ' +
    'overflow-hidden ' +
    'h-[min(88dvh,calc(100dvh-7.5rem))] max-h-[min(88dvh,calc(100dvh-7.5rem))] ' +
    'sm:h-[min(86dvh,calc(100dvh-8.5rem))] sm:max-h-[min(86dvh,calc(100dvh-8.5rem))] ' +
    'xl:h-[min(82dvh,calc(100dvh-9rem))] xl:max-h-[min(82dvh,calc(100dvh-9rem))]';

const SkillPlayground: React.FC = () => {
    const [skillChatKey, setSkillChatKey] = useState(0);

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
                            <BookOpen size={14} /> Intuition Docs <ExternalLink size={10} />
                        </a>
                    </div>
                </header>

                {/* Chat left; reference + tips on the right (xl+) */}
                <div className="flex flex-col xl:flex-row xl:items-stretch gap-5 lg:gap-6 xl:gap-8 flex-1 min-h-0">
                    <div className={`${CHAT_SHELL} flex-1 min-w-0 min-h-0 shrink`}>
                        <SkillErrorBoundary
                            resetKey={skillChatKey}
                            onReset={() => setSkillChatKey((k) => k + 1)}
                        >
                            <SkillChat key={skillChatKey} />
                        </SkillErrorBoundary>
                    </div>

                    <aside className="w-full xl:w-[min(100%,300px)] 2xl:w-[320px] shrink-0 xl:sticky xl:top-20 xl:self-start xl:max-h-[min(calc(100dvh-6rem),920px)] overflow-y-auto custom-scrollbar space-y-4">
                        <Reveal delay={0}>
                            <div
                                className={`${REF_CARD} p-5 sm:p-6 transition-[border-color,box-shadow] duration-300 hover:border-intuition-primary/30 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(0,243,255,0.08),inset_0_1px_0_rgba(255,255,255,0.08)]`}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 opacity-[0.5]"
                                    style={{
                                        background:
                                            'radial-gradient(ellipse 90% 70% at 100% 0%, rgba(0,243,255,0.12), transparent 55%), radial-gradient(ellipse 70% 50% at 0% 100%, rgba(255,30,109,0.08), transparent 50%)',
                                    }}
                                />
                                <div className="absolute -right-2 top-3 opacity-[0.12] transition-opacity group-hover:opacity-20">
                                    <ChevronRight
                                        strokeWidth={1.25}
                                        className="h-20 w-20 text-intuition-primary"
                                        aria-hidden
                                    />
                                </div>
                                <div className="relative">
                                    <p className="mb-2 font-mono text-[9px] font-black uppercase tracking-[0.35em] text-slate-500">
                                        Playbook
                                    </p>
                                    <h2 className="mb-3 flex items-center gap-2 font-sans text-sm font-semibold text-white">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-intuition-primary/30 bg-intuition-primary/10 shadow-[0_0_20px_rgba(0,243,255,0.15)]">
                                            <Info size={15} className="text-intuition-primary" />
                                        </span>
                                        Quick reference
                                    </h2>

                                    <p className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
                                        <span>Natural language in.</span>
                                        <span className="inline-flex items-center gap-0.5 text-slate-300">
                                            Chain
                                            <ArrowRight className="h-3.5 w-3.5 text-intuition-primary/80" />
                                        </span>
                                        <span>
                                            review, then{' '}
                                            <span className="font-medium text-slate-100">Sign &amp; broadcast</span>
                                        </span>
                                    </p>

                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Typical costs
                                    </p>
                                    <div className="mb-1 grid grid-cols-2 gap-2">
                                        <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5">
                                            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                                Atom
                                            </div>
                                            <div className="mt-0.5 font-mono text-xs tabular-nums text-intuition-primary">
                                                ~0.15 {CURRENCY_SYMBOL}
                                                <span className="text-slate-500"> + dep.</span>
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5">
                                            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                                Triple
                                            </div>
                                            <div className="mt-0.5 font-mono text-xs tabular-nums text-intuition-primary">
                                                ~0.15 {CURRENCY_SYMBOL}
                                                <span className="text-slate-500"> + dep.</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
                                        <span className="text-slate-500">Vault deposit</span>
                                        <span className="font-medium text-slate-300">Varies</span>
                                    </div>

                                    <div className="mt-4 border-t border-white/10 pt-4">
                                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-400/90">
                                            <Zap size={12} className="shrink-0" />
                                            Tip
                                        </div>
                                        <p className="text-sm text-slate-500">
                                            Browse without a wallet. Connect to move{' '}
                                            <span className="text-slate-300">TRUST</span> on Mainnet.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Reveal>

                        <Reveal delay={90}>
                            <div
                                className={`${TIP_CARD} p-4 lg:p-5 transition-[border-color,box-shadow] duration-300 hover:border-intuition-primary/40 hover:shadow-[0_0_32px_rgba(0,243,255,0.1),inset_0_1px_0_rgba(255,255,255,0.07)]`}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 opacity-40"
                                    style={{
                                        background:
                                            'radial-gradient(ellipse 80% 60% at 0% 0%, rgba(0,243,255,0.15), transparent 50%)',
                                    }}
                                />
                                <div className="relative">
                                    <div className="mb-2.5 flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-intuition-primary/35 bg-gradient-to-br from-intuition-primary/20 to-intuition-primary/5 shadow-[0_0_24px_rgba(0,243,255,0.2)]">
                                            <Zap size={18} className="text-intuition-primary" />
                                        </div>
                                        <h3 className="font-sans text-sm font-semibold text-white">Autonomous creation</h3>
                                    </div>
                                    <p className="text-sm leading-relaxed text-slate-400">
                                        Agent assembles calldata and fees. You sign in your wallet.
                                    </p>
                                </div>
                            </div>
                        </Reveal>

                        <Reveal delay={180}>
                            <div
                                className={`${TIP_CARD} p-4 lg:p-5 transition-[border-color,box-shadow] duration-300 hover:border-[#ff3d7a]/40 hover:shadow-[0_0_32px_rgba(255,30,109,0.12),inset_0_1px_0_rgba(255,255,255,0.07)]`}
                            >
                                <div
                                    className="pointer-events-none absolute inset-0 opacity-50"
                                    style={{
                                        background:
                                            'radial-gradient(ellipse 90% 70% at 100% 100%, rgba(255,30,109,0.12), transparent 55%)',
                                    }}
                                />
                                <div className="relative">
                                    <div className="mb-2.5 flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ff1e6d]/30 bg-gradient-to-br from-[#ff1e6d]/20 to-[#3d0a18]/40 shadow-[0_0_20px_rgba(255,30,109,0.15)]">
                                            <ShieldCheck size={18} className="text-[#ff6b9d]" />
                                        </div>
                                        <h3 className="font-sans text-sm font-semibold text-white">You stay in control</h3>
                                    </div>
                                    <p className="text-sm leading-relaxed text-slate-400">
                                        Read every summary before signing. Your keys, your transactions.
                                    </p>
                                </div>
                            </div>
                        </Reveal>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default SkillPlayground;
