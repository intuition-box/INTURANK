import React from 'react';
import { Layers } from 'lucide-react';
import { playClick } from '../services/audio';
import { ARENA_THEME } from '../services/arenaUiTheme';

export type ArenaClimbTerraceProps = {
  queuedBatchCount: number;
  onReviewBatch?: () => void;
};

/**
 * Batch-review strip only when the conviction cart has rows — no generic nav chips
 * (Markets / Stats / Ranked picks live elsewhere).
 */
const ArenaClimbTerrace: React.FC<ArenaClimbTerraceProps> = ({ queuedBatchCount, onReviewBatch }) => {
  if (queuedBatchCount < 1 || !onReviewBatch) return null;

  return (
    <div
      className="mt-4 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-sm px-3 py-2.5 ring-1 ring-amber-500/15"
      style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 24px ${ARENA_THEME.redDim}` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-amber-200/50">
          Queued stances
        </p>
        <button
          type="button"
          onClick={() => {
            playClick();
            onReviewBatch();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-400/40 bg-gradient-to-b from-cyan-500/18 to-black/80 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-50 hover:border-amber-400/45 hover:shadow-[0_0_18px_rgba(248,113,113,0.15)] transition-colors"
        >
          <Layers size={13} strokeWidth={2.2} className="text-cyan-200 shrink-0" aria-hidden />
          Review cart · {queuedBatchCount}
        </button>
      </div>
    </div>
  );
};

export default ArenaClimbTerrace;
