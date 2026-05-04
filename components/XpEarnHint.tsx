import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight } from 'lucide-react';
import {
  ARENA_XP_PER_RANK_PICK,
  PROTOCOL_XP_ADD_TO_LIST,
  PROTOCOL_XP_CREATE_ATOM,
  PROTOCOL_XP_CREATE_CLAIM,
  PROTOCOL_XP_MARKET_ACQUIRE,
  PROTOCOL_XP_SEND_TRUST,
  PROTOCOL_XP_SEND_TRUST_MIN_TRUST_UNITS,
  PROTOCOL_XP_SKILL_TRIPLE,
} from '../constants';

export type XpEarnHintVariant =
  | 'arena'
  | 'markets'
  | 'market_detail'
  | 'create_hub'
  | 'skill'
  | 'send_trust';

const DOC_HREF = '/documentation#activity-xp';

function hintCopy(variant: XpEarnHintVariant): string {
  switch (variant) {
    case 'arena':
      return `Climb votes earn at least ${ARENA_XP_PER_RANK_PICK} Arena XP each (more if you stake TRUST on picks). Market buys can add up to +${PROTOCOL_XP_MARKET_ACQUIRE} activity XP depending on buy size.`;
    case 'markets':
      return `Market buys scale toward up to +${PROTOCOL_XP_MARKET_ACQUIRE} activity XP; list adds toward up to +${PROTOCOL_XP_ADD_TO_LIST} — bigger deposits earn more (dust earns little).`;
    case 'market_detail':
      return `This buy can earn up to +${PROTOCOL_XP_MARKET_ACQUIRE} activity XP; the amount scales with how much TRUST you put in.`;
    case 'create_hub':
      return `Atoms scale toward up to +${PROTOCOL_XP_CREATE_ATOM} activity XP; claims +${PROTOCOL_XP_CREATE_CLAIM}; Skill triples +${PROTOCOL_XP_SKILL_TRIPLE} — larger vault deposits earn more.`;
    case 'skill':
      return `Skill publishes scale toward up to +${PROTOCOL_XP_SKILL_TRIPLE} for triples and +${PROTOCOL_XP_CREATE_ATOM} for atoms based on deposit size.`;
    case 'send_trust':
      return `Wallet sends earn +${PROTOCOL_XP_SEND_TRUST} activity XP only at ${PROTOCOL_XP_SEND_TRUST_MIN_TRUST_UNITS}+ TRUST per transfer (daily limits still apply).`;
    default:
      return '';
  }
}

/** Minimal Arena footer: two numbers + docs link (detail lives in Documentation). */
function ArenaXpRewardsDeck({ className }: { className?: string }) {
  return (
    <div
      className={`relative w-full rounded-2xl border border-slate-800 bg-slate-950/75 backdrop-blur-md overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.55)] ${className ?? ''}`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(0,243,255,0.025)_1px,transparent_1px)] bg-[size:18px_18px] opacity-35"
        aria-hidden
      />

      <div className="relative z-10 p-3 sm:p-3 pb-2.5 sm:pb-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className="text-[8px] font-black font-mono text-intuition-primary/85 uppercase tracking-[0.3em]">XP snapshot</p>
          <Link
            to={DOC_HREF}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-black/40 px-2 py-1 text-[8px] font-black font-mono uppercase tracking-widest text-slate-400 hover:border-intuition-primary/40 hover:text-intuition-primary transition-colors"
            title="Open Documentation: How XP works"
          >
            How XP works
            <ArrowRight size={11} className="opacity-90" aria-hidden />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-black/65 border border-white/10 px-2.5 py-2 text-center sm:text-left">
            <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Climb</span>
            <span className="text-base font-mono font-black text-white tabular-nums leading-tight">≥{ARENA_XP_PER_RANK_PICK}</span>
          </div>
          <div className="rounded-xl bg-black/65 border border-white/10 px-2.5 py-2 text-center sm:text-left">
            <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Market buy</span>
            <span className="text-base font-mono font-black text-intuition-primary tabular-nums leading-tight">+{PROTOCOL_XP_MARKET_ACQUIRE}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Subtle on-page reminder of XP mirrors; canonical numbers live in `constants.ts` and Documentation. */
export function XpEarnHint({
  variant,
  className = '',
  showDocLink = true,
  presentation = 'default',
}: {
  variant: XpEarnHintVariant;
  className?: string;
  showDocLink?: boolean;
  /** Arena-only: compact metric strip */
  presentation?: 'default' | 'arena-deck';
}) {
  if (variant === 'arena' && presentation === 'arena-deck') {
    return <ArenaXpRewardsDeck className={className} />;
  }

  const text = hintCopy(variant);
  if (!text) return null;

  return (
    <div className={`space-y-1 ${className}`}>
      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[11px] leading-snug text-slate-500">
        <Zap size={12} className="shrink-0 translate-y-[2px] text-amber-400/85" aria-hidden />
        <span>{text}</span>
        {showDocLink ? (
          <Link
            to={DOC_HREF}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-intuition-primary/75 hover:text-intuition-primary underline-offset-2 hover:underline font-medium"
          >
            Full table
          </Link>
        ) : null}
      </p>
      <p className="text-[10px] leading-snug text-slate-600 pl-[18px]">
        Anti-spam: tiny deposits earn little or no activity XP; each category has a daily cap (UTC).
      </p>
    </div>
  );
}
