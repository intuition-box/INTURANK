import React from 'react';
import { ARENA_THEME } from '../../services/arenaUiTheme';

/** Dark IntuRank / Arena shell for Curate → Rank → Compare (not white blueprint). */
export const ArenaContestStepShell: React.FC<{
  chromeTitle: string;
  /** Tailwind max-width / width utilities (`max-w-none w-full` uses parent width). */
  maxWidthClass?: string;
  /** Inner padding around step content — tighten horizontally when using full width. */
  innerPaddingClassName?: string;
  children: React.ReactNode;
}> = ({
  chromeTitle,
  maxWidthClass = 'max-w-3xl',
  innerPaddingClassName = 'p-4 sm:p-6 md:p-8',
  children,
}) => (
  <div
    className={`relative mx-auto w-full ${maxWidthClass} overflow-hidden rounded-2xl border border-white/[0.1]`}
    style={{
      background: ARENA_THEME.runPanelBg,
      boxShadow: ARENA_THEME.shellShadow,
    }}
  >
    <div className="flex h-9 items-center gap-1.5 border-b border-white/[0.08] bg-black/50 px-3">
      <span className="h-2 w-2 rounded-full bg-slate-500/80" />
      <span className="h-2 w-2 rounded-full bg-slate-500/55" />
      <span className="h-2 w-2 rounded-full bg-slate-500/40" />
      <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{chromeTitle}</span>
    </div>
    <div
      className={innerPaddingClassName}
      style={{
        background: ARENA_THEME.signalBrowseWell,
        boxShadow: ARENA_THEME.signalBrowseWellShadow,
      }}
    >
      {children}
    </div>
  </div>
);
