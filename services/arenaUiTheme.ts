/**
 * Arena visual tokens — “trust terminal” skin inspired by Intuition market dashboards:
 * matte black glass, gold rim highlights, cyan verified/tech edges, violet tertiary accent.
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
  rimBar:
    'linear-gradient(90deg, #d4a824 0%, #38e8ff 42%, #c084fc 78%, #d4a824 100%)',
  heroTitle:
    'linear-gradient(118deg, #ffffff 0%, #fcefb7 26%, #7af0ff 52%, #ddd6fe 82%, #38e8ff 100%)',
  topAccentBar: 'linear-gradient(90deg, #c9a227 0%, #38e8ff 46%, #a855f7 92%)',
  heroGlow:
    'radial-gradient(ellipse 100% 80% at 12% 0%, rgba(232,197,71,0.12) 0%, transparent 52%), radial-gradient(ellipse 85% 55% at 88% 15%, rgba(56,232,255,0.1) 0%, transparent 48%)',
  shellGlass:
    'linear-gradient(155deg, rgba(14,14,18,0.94) 0%, rgba(6,7,10,0.92) 42%, rgba(12,10,22,0.55) 100%)',
  shellShadow:
    '0 28px 100px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(56,232,255,0.06), 0 0 48px rgba(232,197,71,0.04)',
  runPanelBg:
    'linear-gradient(178deg, rgba(9,9,11,0.992) 0%, rgba(5,5,7,0.998) 48%, rgba(8,8,12,0.99) 100%)',
  runPanelShadow: '-16px 0 52px rgba(0,0,0,0.55), inset 1px 0 0 rgba(232,197,71,0.06)',
  currentRunCard:
    'linear-gradient(145deg, rgba(232,197,71,0.08) 0%, rgba(8,10,16,0.94) 38%, rgba(56,232,255,0.06) 72%, rgba(168,85,247,0.05) 100%)',
} as const;
