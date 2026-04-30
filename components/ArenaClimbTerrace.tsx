import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ChevronRight, Layers, LineChart, ListTree } from 'lucide-react';
import { playClick } from '../services/audio';

const CY = '#00f3ff';

type LinkChipProps = {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

function LinkChip({ to, icon, children }: LinkChipProps) {
  return (
    <Link
      to={to}
      onClick={() => playClick()}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-[#c5fcff] hover:border-[#00f3ff]/35 hover:bg-[#00f3ff]/8 transition-colors"
    >
      <span className="text-[#89faff]/90" aria-hidden>
        {icon}
      </span>
      {children}
      <ChevronRight size={12} className="opacity-50 shrink-0" aria-hidden />
    </Link>
  );
}

export type ArenaClimbTerraceProps = {
  /** When true (desktop climb column), terraces hug the viewport bottom inside a flex column. */
  pinBottom?: boolean;
  queuedBatchCount: number;
  onReviewBatch?: () => void;
};

/**
 * Lightweight “floor” for /climb when a list is active — fills dead viewport space with
 * high-signal shortcuts (no essays).
 */
const ArenaClimbTerrace: React.FC<ArenaClimbTerraceProps> = ({
  pinBottom,
  queuedBatchCount,
  onReviewBatch,
}) => {
  return (
    <div
      className={`${pinBottom ? 'mt-8 lg:mt-auto' : 'mt-6 sm:mt-8'} rounded-2xl border border-white/[0.07] px-4 py-3.5 sm:py-4`}
      style={{
        background:
          'linear-gradient(165deg, rgba(0,243,255,0.045) 0%, rgba(5,10,18,0.55) 45%, rgba(255,30,109,0.03) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 40px rgba(0,243,255,0.03)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.28em] text-slate-600">
          <span style={{ color: CY }} className="font-bold">
            ···
          </span>{' '}
          Terrace
        </p>
        {queuedBatchCount > 0 && onReviewBatch ? (
          <button
            type="button"
            onClick={() => {
              playClick();
              onReviewBatch();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#00f3ff]/30 bg-[#00f3ff]/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#b5fbff] hover:bg-[#00f3ff]/18 transition-colors"
          >
            <Layers size={13} strokeWidth={2.2} style={{ color: CY }} aria-hidden />
            Batch · {queuedBatchCount}
          </button>
        ) : null}
      </div>
      <nav className="mt-3 flex flex-wrap gap-2" aria-label="Arena shortcuts">
        <LinkChip to="/markets/atoms" icon={<BarChart3 size={13} strokeWidth={2.2} />}>
          Markets
        </LinkChip>
        <LinkChip to="/stats" icon={<LineChart size={13} strokeWidth={2.2} />}>
          Stats
        </LinkChip>
        <LinkChip to="/portfolio#arena-rankings" icon={<ListTree size={13} strokeWidth={2.2} />}>
          Ranked picks
        </LinkChip>
      </nav>
    </div>
  );
};

export default ArenaClimbTerrace;
