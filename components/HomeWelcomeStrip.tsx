import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Sparkles } from 'lucide-react';
import { playClick, playHover } from '../services/audio';

type HomeWelcomeStripProps = {
  variant?: 'desktop' | 'mobile';
};

const H_PAD = { paddingLeft: 'clamp(1.5rem, 6vw, 4rem)', paddingRight: 'clamp(1.5rem, 6vw, 4rem)' } as const;

const GLASS_PANEL =
  'relative overflow-hidden rounded-[1.75rem] border border-white/[0.1] bg-[#05070c]/[0.88] shadow-[0_20px_50px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-white/[0.04]';

/**
 * Landing hero — same glass + cyan/magenta accents as PublicProfile (no rainbow deck).
 */
export const HomeWelcomeStrip: React.FC<HomeWelcomeStripProps> = ({ variant = 'desktop' }) => {
  const mobile = variant === 'mobile';

  const heroMinClass = mobile
    ? 'min-h-0 py-10 sm:py-12'
    : 'min-h-[min(78vh,44rem)] lg:min-h-[min(82vh,48rem)]';

  return (
    <section
      aria-label="IntuRank hero"
      className={
        mobile
          ? `relative flex flex-col overflow-hidden rounded-[1.75rem] border border-white/[0.08] ${heroMinClass}`
          : `relative flex flex-col overflow-x-clip scroll-mt-6 ${heroMinClass}`
      }
      style={mobile ? undefined : H_PAD}
    >
      <div className="absolute inset-0 bg-[#020308]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 0% 0%, rgba(0,243,255,0.12), transparent 52%), radial-gradient(ellipse 60% 45% at 100% 100%, rgba(255,30,109,0.08), transparent 48%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,243,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,243,255,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div
        className={
          mobile
            ? 'relative z-10 flex flex-1 flex-col px-5 py-8 sm:px-6'
            : 'relative z-10 mx-auto flex flex-1 w-full flex-col justify-center py-16 sm:py-20 lg:py-24'
        }
        style={mobile ? undefined : { maxWidth: 1200 }}
      >
        <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-white/[0.1] bg-[#05070c]/80 px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_32px_rgba(0,243,255,0.06)] sm:mb-8 sm:px-5">
          <p className="text-[11px] font-semibold leading-snug text-slate-300 sm:text-sm">
            IntuRank — a gamified way to <span className="font-bold text-white">rank items inside lists</span> and share
            that with friends, on Intuition.
          </p>
        </div>

        <div
          className={`mx-auto flex w-full max-w-5xl flex-col gap-8 ${mobile ? '' : 'lg:flex-row lg:items-stretch lg:gap-10'}`}
        >
          <div className={`${GLASS_PANEL} min-w-0 flex-1 p-6 sm:p-8 lg:p-10`}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                boxShadow: 'inset 0 0 80px rgba(0,243,255,0.04)',
              }}
            />
            <div className="relative text-center lg:text-left">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.38em] text-intuition-primary/85 sm:text-[11px]">
                IntuRank
              </p>
              <h1 className="mt-3 font-display text-[1.65rem] font-black leading-[1.08] tracking-tight text-white sm:text-3xl md:text-4xl lg:text-[2.75rem]">
                Anyone can create a game
                <span className="mt-3 block text-lg font-bold text-slate-200 sm:text-xl md:text-2xl">
                  Where the collective output is{' '}
                  <span className="bg-gradient-to-r from-white via-slate-100 to-intuition-primary bg-clip-text font-black text-transparent">
                    rank anything
                  </span>
                </span>
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base lg:mx-0">
                <span className="font-semibold text-intuition-primary/90">A game for your knowledge</span>
                {' — '}
                stack cards, fight for what belongs on top, then show your deck to the crowd.
              </p>

              <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
                <Link
                  to="/climb"
                  onClick={() => playClick()}
                  onMouseEnter={() => playHover()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-intuition-primary/45 bg-black/55 px-7 py-3.5 text-[11px] font-bold uppercase tracking-[0.22em] text-white shadow-[0_0_28px_rgba(0,243,255,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[transform,filter,box-shadow] hover:shadow-[0_0_36px_rgba(0,243,255,0.26)] active:scale-[0.99] sm:text-xs"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-intuition-primary" strokeWidth={2.5} aria-hidden />
                  Enter the Arena
                  <ArrowRight className="h-4 w-4 shrink-0 text-intuition-primary" strokeWidth={2.5} aria-hidden />
                </Link>
                <Link
                  to="/markets/atoms"
                  onClick={() => playClick()}
                  onMouseEnter={() => playHover()}
                  className="inline-flex items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300 backdrop-blur-sm transition-colors hover:border-intuition-primary/35 hover:text-white sm:text-xs"
                >
                  Browse the graph
                </Link>
              </div>
            </div>
          </div>

          <div
            className={`flex shrink-0 flex-col items-center justify-center gap-2 ${
              mobile ? 'w-full' : 'lg:w-48 xl:w-52'
            }`}
          >
            <Link
              to="/"
              state={{ scrollArenaContests: true, showArenaCreateGameToast: true }}
              onClick={() => playClick()}
              onMouseEnter={() => playHover()}
              className="group flex w-full max-w-[16rem] flex-col items-center justify-center gap-2 rounded-[1.75rem] border border-white/[0.1] bg-gradient-to-br from-intuition-secondary via-rose-600 to-orange-600 py-8 shadow-[0_16px_40px_rgba(255,30,109,0.25),inset_0_1px_0_rgba(255,255,255,0.12)] transition-[transform,filter] hover:brightness-110 lg:max-w-none lg:flex-1 lg:py-10"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white shadow-[0_0_24px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-105">
                <Plus className="h-7 w-7" strokeWidth={2.5} aria-hidden />
              </span>
              <span className="px-2 text-center text-[11px] font-black uppercase tracking-[0.18em] text-white">
                Create your game
              </span>
            </Link>
            <p className="max-w-[14rem] text-center text-[10px] leading-snug text-slate-500">
              Contest picker lives below. Graph Create is under nav for atoms / claims.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
