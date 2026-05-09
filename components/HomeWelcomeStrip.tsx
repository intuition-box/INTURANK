import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Trophy } from 'lucide-react';
import { playClick, playHover } from '../services/audio';

type HomeWelcomeStripProps = {
  variant?: 'desktop' | 'mobile';
};

const H_PAD = { paddingLeft: 'clamp(1.5rem, 6vw, 4rem)', paddingRight: 'clamp(1.5rem, 6vw, 4rem)' } as const;

const QUICK: Array<{ to: string; label: string }> = [
  { to: '/markets/atoms', label: 'Atoms' },
  { to: '/create', label: 'Claims' },
  { to: '/markets/lists', label: 'Lists' },
  { to: '/documentation', label: 'Docs' },
];

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Landing hero (always on Home): staggered cascade. Wallet connection does not hide this block.
 */
export const HomeWelcomeStrip: React.FC<HomeWelcomeStripProps> = ({ variant = 'desktop' }) => {
  const mobile = variant === 'mobile';
  const reduceMotion = useReducedMotion();

  const container = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.11, delayChildren: 0.16 },
        },
      };

  const item = reduceMotion
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 36 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.62, ease: EASE },
        },
      };

  const heroMinClass = mobile
    ? 'min-h-[72vh] sm:min-h-[68vh]'
    : 'min-h-[min(92vh,56rem)] lg:min-h-[min(94vh,58rem)] xl:min-h-[min(96vh,62rem)]';

  return (
    <section
      aria-label="Welcome"
      className={
        mobile
          ? `relative flex flex-col overflow-hidden rounded-[1.75rem] border border-white/[0.06] ${heroMinClass}`
          : `relative flex flex-col overflow-x-clip scroll-mt-6 ${heroMinClass}`
      }
      style={mobile ? undefined : H_PAD}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#050014] via-[#030508] to-[#030508]" />

      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.42]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,243,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(0,243,255,0.028) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[8%] z-0 h-[min(95vw,640px)] w-[min(140vw,1100px)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.2)_0%,rgba(99,102,241,0.14)_35%,rgba(168,85,247,0.08)_55%,transparent_72%)] blur-[3px]"
        initial={reduceMotion ? false : { opacity: 0.35, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.15, ease: EASE }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[12%] z-0 h-[480px] w-[min(90vw,720px)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,243,255,0.18),transparent_100%)] opacity-90 mix-blend-screen"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ duration: 1.0, delay: 0.2, ease: EASE }}
      />
      <div className="pointer-events-none absolute left-1/2 top-[20%] z-0 h-[min(100vmin,560px)] w-full max-w-5xl -translate-x-1/2 bg-[conic-gradient(from_200deg_at_50%_45%,transparent,rgba(34,211,238,0.09)_25%,transparent_50%,rgba(192,132,252,0.07)_75%,transparent)] opacity-70" />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#030508_0%,transparent_45%,#030508_100%)] opacity-[0.88]" />

      <motion.div
        aria-hidden
        initial={reduceMotion ? false : { opacity: 0, scale: 0.86, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1.05, delay: 0.08, ease: EASE }}
        className={`pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 ${mobile ? 'top-[8%] h-64 w-[92%]' : 'top-[4%] h-[min(44vh,36rem)] w-full max-w-2xl lg:max-w-3xl'}`}
      >
        <div className="absolute inset-[8%] rounded-[2rem] border border-white/[0.14] bg-gradient-to-b from-white/[0.12] via-cyan-400/[0.04] to-violet-600/[0.06] shadow-[0_0_80px_rgba(34,211,238,0.15),0_0_120px_rgba(139,92,246,0.12),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-2xl sm:rounded-[2.25rem]" />
        <div className="absolute inset-[14%] rotate-[2deg] rounded-[1.75rem] border border-white/[0.06] bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent opacity-80" />
      </motion.div>

      {/* “Opens” toward content below */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-[6%] right-[6%] z-[5] h-[2px] rounded-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent origin-center lg:left-[12%] lg:right-[12%]"
        initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.85, delay: 0.75, ease: EASE }}
      />

      <motion.div
        className={
          mobile
            ? 'relative z-10 flex flex-1 flex-col justify-center px-5 py-14 sm:px-6 sm:py-16'
            : 'relative z-10 mx-auto flex flex-1 flex-col justify-center px-2 py-20 sm:py-24 lg:py-28 xl:py-32'
        }
        style={mobile ? undefined : { maxWidth: 1280 }}
        variants={container}
        initial="hidden"
        animate="show"
      >
        <div className="relative mx-auto max-w-[58rem] text-center">
          <motion.p
            variants={item}
            className="mb-6 font-mono text-[10px] font-black uppercase tracking-[0.38em] text-slate-500 sm:mb-8 sm:text-[11px]"
          >
            INTURANK <span className="text-slate-600">•</span> WEB3 REPUTATION
          </motion.p>

          <motion.h1
            variants={item}
            className={`font-display font-black uppercase not-italic leading-[1.05] tracking-[-0.02em] ${mobile ? 'text-[1.75rem] sm:text-[2.35rem]' : 'text-[2.1rem] sm:text-4xl md:text-5xl lg:text-6xl xl:text-[4.25rem]'}`}
          >
            <span className="block text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.06)]">A trust-native layer</span>
            <span className="mt-2 block bg-gradient-to-r from-[#22d3ee] via-[#a5b4fc] to-[#e9d5ff] bg-clip-text text-transparent sm:mt-2.5 lg:mt-3 [text-shadow:none]">
              for intuition markets
            </span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mx-auto mt-7 max-w-xl font-sans text-sm font-normal leading-relaxed text-slate-400 sm:mt-9 sm:max-w-2xl sm:text-base"
          >
            Surface atoms, claims, and lists priced in TRUST. Rank and read free; connect a wallet when you are ready
            to trade, duel, and earn XP.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-9 flex flex-col items-stretch gap-4 sm:mt-11 sm:flex-row sm:items-center sm:justify-center sm:gap-5"
          >
            <div className="mx-auto w-full max-w-[20rem] rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-500 p-[2px] shadow-[0_0_42px_rgba(99,102,241,0.45),0_0_28px_rgba(34,211,238,0.25)] sm:mx-0 sm:w-auto sm:max-w-none">
              <Link
                to="/markets/atoms"
                onClick={() => playClick()}
                onMouseEnter={() => playHover()}
                className="flex items-center justify-center gap-2.5 rounded-full bg-[#030508] px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.24em] text-white transition-colors hover:bg-[#050814] sm:px-10 sm:py-4 sm:text-xs"
              >
                Explore markets
                <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300" strokeWidth={2.5} aria-hidden />
              </Link>
            </div>
            <Link
              to="/climb"
              onClick={() => playClick()}
              onMouseEnter={() => playHover()}
              className="mx-auto flex w-full max-w-[20rem] items-center justify-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/[0.06] px-8 py-3.5 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-100 shadow-[0_0_24px_rgba(167,139,250,0.12)] backdrop-blur-md transition-all hover:border-violet-400/50 hover:bg-violet-500/[0.1] hover:text-white sm:mx-0 sm:w-auto sm:max-w-none sm:px-9 sm:text-xs"
            >
              <Trophy className="h-4 w-4 shrink-0 text-violet-300" strokeWidth={2.25} aria-hidden />
              Climb the leaderboard
            </Link>
          </motion.div>

          <motion.nav
            variants={item}
            aria-label="Quick links"
            className="mt-9 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-600 sm:mt-11 sm:text-[11px]"
          >
            {QUICK.map((q, i) => (
              <React.Fragment key={q.label}>
                {i > 0 ? <span className="text-slate-700">•</span> : null}
                <Link
                  to={q.to}
                  onClick={() => playClick()}
                  onMouseEnter={() => playHover()}
                  className="text-slate-500 transition-colors hover:text-cyan-400/90"
                >
                  {q.label}
                </Link>
              </React.Fragment>
            ))}
          </motion.nav>
        </div>
      </motion.div>
    </section>
  );
};
