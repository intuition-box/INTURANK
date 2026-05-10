/**
 * Arena + Signal parity — Pulse “curated heat” spectrum: amber → cyan → violet → red.
 * Matches `PulseAtomTagCard` hot rail + teal tag rows; red encodes conviction / oppose energy.
 */
export const ARENA_THEME = {
  bgPage: '#030304',
  bgDeep: '#050507',
  gold: '#e8c547',
  goldBright: '#fcefb7',
  goldDim: 'rgba(232,197,71,0.12)',
  cyan: '#38e8ff',
  cyanMuted: '#7af0ff',
  violet: '#c084fc',
  violetDeep: '#9333ea',
  roseNo: '#f472b6',
  /** Strong red for accents (oppose, rim stops, CTAs). */
  red: '#f87171',
  redHot: '#ef4444',
  redDim: 'rgba(248,113,113,0.14)',
  /** Pulse Hot–style card rim (Tailwind arbitrary values OK in style/class consumers). */
  pulseHotCardShadow: '0 0 30px rgba(232,197,71,0.18), 0 0 40px rgba(248,113,113,0.06)',
  rimBar:
    'linear-gradient(90deg, #d4a824 0%, #38e8ff 34%, #c084fc 62%, #f87171 88%, #d4a824 100%)',
  heroTitle:
    'linear-gradient(118deg, #ffffff 0%, #fcefb7 22%, #7af0ff 48%, #ddd6fe 72%, #fca5a5 88%, #38e8ff 100%)',
  topAccentBar:
    'linear-gradient(90deg, #c9a227 0%, #38e8ff 38%, #a855f7 68%, #f87171 100%)',
  heroGlow:
    'radial-gradient(ellipse 100% 80% at 12% 0%, rgba(232,197,71,0.12) 0%, transparent 52%), radial-gradient(ellipse 85% 55% at 88% 15%, rgba(56,232,255,0.1) 0%, transparent 48%), radial-gradient(ellipse 70% 50% at 70% 0%, rgba(248,113,113,0.08) 0%, transparent 45%)',
  shellGlass:
    'linear-gradient(155deg, rgba(20,18,14,0.94) 0%, rgba(6,7,10,0.92) 38%, rgba(14,10,18,0.55) 72%, rgba(40,12,12,0.2) 100%)',
  shellShadow:
    '0 28px 100px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(251,191,36,0.08), 0 0 56px rgba(232,197,71,0.06), 0 0 72px rgba(248,113,113,0.05)',
  runPanelBg:
    'linear-gradient(178deg, rgba(9,9,11,0.992) 0%, rgba(5,5,7,0.998) 48%, rgba(8,8,12,0.99) 100%)',
  runPanelShadow: '-16px 0 52px rgba(0,0,0,0.55), inset 1px 0 0 rgba(232,197,71,0.06)',
  currentRunCard:
    'linear-gradient(145deg, rgba(232,197,71,0.08) 0%, rgba(8,10,16,0.94) 35%, rgba(56,232,255,0.06) 62%, rgba(168,85,247,0.06) 82%, rgba(127,29,29,0.12) 100%)',
  /** Same family as Signal welcome / Pulse deck (teal + violet + heat + red). */
  signalIntroStrip:
    'linear-gradient(150deg, rgba(251,191,36,0.08) 0%, rgba(56,232,255,0.07) 38%, rgba(8,8,12,0.9) 55%, rgba(192,132,252,0.08) 72%, rgba(248,113,113,0.06) 100%)',
  signalBrowseWell:
    'linear-gradient(158deg, rgba(251,191,36,0.06) 0%, rgba(56,232,255,0.06) 28%, rgba(5,7,10,0.94) 45%, rgba(18,10,22,0.92) 78%, rgba(40,10,10,0.35) 100%)',
  signalBrowseWellShadow:
    'inset 0 0 140px rgba(56,232,255,0.04), inset 0 0 80px rgba(248,113,113,0.04), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(251,191,36,0.08)',
  /** Run column — Pulse spectrum rim. */
  signalRunColumnBg:
    'linear-gradient(178deg, rgba(12,10,8,0.99) 0%, rgba(4,5,8,0.995) 40%, rgba(10,8,14,0.98) 100%)',
  signalRunColumnShadow:
    '-12px 0 48px rgba(0,0,0,0.5), inset 1px 0 0 rgba(251,191,36,0.12), inset 0 1px 0 rgba(248,113,113,0.06)',
} as const;
