import React from 'react';
import { Layers } from 'lucide-react';
import { playClick } from '../services/audio';

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
    <div className="mt-4 rounded-2xl border-2 border-slate-800 bg-black/45 backdrop-blur-sm px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-slate-500">Queued stances</p>
        <button
          type="button"
          onClick={() => {
            playClick();
            onReviewBatch();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-intuition-primary/35 bg-intuition-primary/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-100 hover:bg-intuition-primary/16 hover:border-intuition-primary/50 transition-colors"
        >
          <Layers size={13} strokeWidth={2.2} className="text-intuition-primary shrink-0" aria-hidden />
          Review cart · {queuedBatchCount}
        </button>
      </div>
    </div>
  );
};

export default ArenaClimbTerrace;
