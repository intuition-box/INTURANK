import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronRight, Star } from 'lucide-react';
import { playClick, playHover } from '../services/audio';
import type { RankItem } from '../pages/RankedList';

type Props = {
  title: string;
  description: string;
  tag: string;
  categoryLabel: string;
  constituentCount: number;
  previewItems: RankItem[];
  onSelect: () => void;
  reduceMotion: boolean | null;
  listGlyph?: string;
  /** When set, renders a corner star toggle (Arena favorites). */
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
};

/** Compact list card — category chip + preview row; hover stays subtle (no big vertical jumps). */
const ArenaListCard: React.FC<Props> = ({
  title,
  description,
  tag: _tag,
  categoryLabel,
  constituentCount,
  previewItems,
  onSelect,
  reduceMotion,
  listGlyph,
  isFavorite,
  onFavoriteToggle,
}) => {
  const showStar = Boolean(onFavoriteToggle);

  return (
    <div className="group/card relative rounded-2xl min-w-0 w-full shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] hover:shadow-[0_12px_40px_rgba(0,243,255,0.12)] hover:border-[#00f3ff]/35 overflow-hidden transition-shadow border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-[#040810]/90 backdrop-blur-md">
      {showStar ? (
        <button
          type="button"
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Remove from starred lists' : 'Star this list'}
          title={isFavorite ? 'Unstar list' : 'Star list'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFavoriteToggle?.();
          }}
          onMouseEnter={playHover}
          className={`absolute top-2 right-2 z-30 flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-sm transition-colors ${
            isFavorite
              ? 'border-amber-400/50 bg-black/65 text-amber-300 hover:bg-amber-500/15'
              : 'border-white/10 bg-black/55 text-slate-500 hover:text-amber-200/90 hover:border-amber-400/30 hover:bg-black/75'
          }`}
        >
          <Star
            className="h-[18px] w-[18px]"
            strokeWidth={2.25}
            fill={isFavorite ? 'currentColor' : 'none'}
          />
        </button>
      ) : null}

      <motion.button
        type="button"
        onClick={() => {
          playClick();
          onSelect();
        }}
        onMouseEnter={playHover}
        whileHover={reduceMotion ? undefined : { scale: 1.008 }}
        whileTap={reduceMotion ? undefined : { scale: 0.993 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="group relative flex flex-col text-left w-full min-w-0 p-4 sm:p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00f3ff]/50"
      >
        <div
          className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,243,255,0.15), transparent)',
          }}
        />
        <div className="flex items-start gap-3 relative z-10">
          <div className="shrink-0 w-14 h-14 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-2xl text-[#7afcff]/95 group-hover:border-[#00f3ff]/40 group-hover:shadow-[0_0_24px_rgba(0,243,255,0.18)] transition-all duration-300">
            {listGlyph ? (
              <span className="font-black leading-none" aria-hidden>
                {listGlyph}
              </span>
            ) : (
              <ChevronRight className="w-6 h-6 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2 gap-y-1 mb-1">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#00f3ff]/90 px-2 py-0.5 rounded-md bg-[#00f3ff]/10 border border-[#00f3ff]/20">
                {categoryLabel}
              </span>
              <span className="text-[9px] text-slate-500 font-mono tabular-nums">{constituentCount} items</span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white leading-tight line-clamp-2 group-hover:text-cyan-50 transition-colors">
              {title}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{description}</p>
          </div>
          <div className="shrink-0 self-center opacity-40 group-hover/card:opacity-100 group-hover/card:translate-x-0.5 transition-all duration-300">
            <ArrowRight className="w-5 h-5 text-[#00f3ff]/90" />
          </div>
        </div>

        <div className="flex items-center justify-end -space-x-1.5 mt-4 pl-[4.5rem] relative z-10">
          {previewItems.slice(0, 5).map((it, i) => (
            <div
              key={`${it.id}-${i}`}
              className="w-7 h-7 rounded-lg border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden text-[9px] font-bold text-slate-400"
            >
              {it.image ? (
                <img src={it.image} className="w-full h-full object-cover" alt="" />
              ) : (
                (it.label || '?').charAt(0).toUpperCase()
              )}
            </div>
          ))}
          {constituentCount > 5 && (
            <div className="w-7 h-7 rounded-lg border-2 border-[#00f3ff]/25 bg-[#061018]/90 text-[#00f3ff]/90 flex items-center justify-center text-[9px] font-bold">
              +{constituentCount - 5}
            </div>
          )}
        </div>
      </motion.button>
    </div>
  );
};

export default ArenaListCard;
