import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Layers, Terminal, X } from 'lucide-react';
import { playClick } from '../services/audio';

export type ArenaBatchSuccessPayload = {
  itemCount: number;
  /** Already formatted TRUST total (e.g. from formatEther). */
  trustLabel: string;
  themeShort: string;
  contextSuffix: string;
  /** e.g. `Wallet — YES for "Owl" in "Animal Archetype"` */
  humanLine?: string;
  /** Shown when optional attestation failed but stakes succeeded. */
  footnote?: string;
  /** Activity XP delta awarded across this batch (after daily caps & dedupe). */
  activityXpEarned?: number;
  /** Arena XP delta from this batch (lifetime pick-credit additions). */
  arenaXpEarned?: number;
};

type Props = {
  open: boolean;
  payload: ArenaBatchSuccessPayload | null;
  onClose: () => void;
};

const ArenaBatchSuccessModal: React.FC<Props> = ({ open, payload, onClose }) => {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        playClick();
        requestClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const target = e.target as Node | null;
      if (target && !panelRef.current.contains(target)) {
        requestClose();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [open, requestClose]);

  const springPop = { type: 'spring' as const, stiffness: 400, damping: 34, mass: 0.82 };

  const p = payload;

  return createPortal(
    <AnimatePresence mode="wait">
      {open && p ? (
        <motion.div
          key="arena-batch-success"
          className="fixed inset-0 z-[610] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black/72 backdrop-blur-md pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              playClick();
              requestClose();
            }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="arena-success-title"
            aria-describedby="arena-success-desc"
            className="pointer-events-auto relative w-[min(92vw,420px)] overflow-hidden rounded-3xl border-2 border-emerald-500/35 bg-slate-950/94 backdrop-blur-xl shadow-[0_28px_88px_rgba(0,0,0,0.82),0_0_0_1px_rgba(16,185,129,0.12)]"
            initial={reduceMotion ? { opacity: 0, scale: 0.98 } : { opacity: 0, scale: 0.9, y: 16 }}
            animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
            transition={reduceMotion ? { duration: 0.2 } : springPop}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-600 rounded-l-[inherit]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(16,185,129,0.045)_1px,transparent_1px)] bg-[size:18px_18px] opacity-50"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/45 to-transparent"
              aria-hidden
            />

            <div className="relative flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/[0.07]">
              <div className="min-w-0 flex items-start gap-3">
                <div className="shrink-0 w-11 h-11 rounded-xl border-2 border-emerald-500/45 bg-emerald-950/50 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <CheckCircle2 className="w-[22px] h-[22px] text-emerald-400" strokeWidth={2.4} aria-hidden />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[10px] font-mono font-bold tracking-[0.22em] text-emerald-400/95 uppercase mb-1">
                    System_confirmed
                  </p>
                  <h2
                    id="arena-success-title"
                    className="text-base font-black font-display text-white uppercase tracking-tight leading-tight"
                  >
                    Claims on-chain
                  </h2>
                  <p className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1.5 truncate">
                    <Layers className="w-3 h-3 text-intuition-primary shrink-0" strokeWidth={2.2} aria-hidden />
                    <span className="text-intuition-primary/90">{p.themeShort}</span>
                    <span className="text-slate-600">·</span>
                    <span>{p.contextSuffix}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playClick();
                  requestClose();
                }}
                className="shrink-0 p-2 rounded-xl border border-slate-700 bg-black/45 text-slate-400 hover:text-white hover:border-emerald-500/40 hover:bg-white/[0.05] transition-colors"
                aria-label="Close"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div id="arena-success-desc" className="relative px-5 py-5 space-y-4">
              <div className={`grid gap-3 ${(p.activityXpEarned ?? 0) > 0 || (p.arenaXpEarned ?? 0) > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="rounded-2xl border border-white/[0.08] bg-black/40 px-3 py-3">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-1">Items</p>
                  <p className="text-xl font-black font-mono tabular-nums text-white">{p.itemCount}</p>
                </div>
                <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 px-3 py-3">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-amber-500/80 mb-1">Trust locked</p>
                  <p className="text-xl font-black font-mono tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500">
                    {p.trustLabel}
                  </p>
                  <p className="text-[9px] font-mono text-amber-600/90 mt-0.5 uppercase tracking-wide">TRUST</p>
                </div>
                {(p.activityXpEarned ?? 0) > 0 || (p.arenaXpEarned ?? 0) > 0 ? (
                  <div className="rounded-2xl border border-intuition-primary/30 bg-cyan-950/25 px-3 py-3">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-intuition-primary/80 mb-1">XP earned</p>
                    <p className="text-xl font-black font-mono tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-cyan-200 to-intuition-primary">
                      +{(p.activityXpEarned ?? 0) + (p.arenaXpEarned ?? 0)}
                    </p>
                    <p className="text-[9px] font-mono text-intuition-primary/85 mt-0.5 uppercase tracking-wide">
                      {(p.arenaXpEarned ?? 0) > 0 ? `Arena +${p.arenaXpEarned}` : ''}
                      {(p.activityXpEarned ?? 0) > 0 && (p.arenaXpEarned ?? 0) > 0 ? ' · ' : ''}
                      {(p.activityXpEarned ?? 0) > 0 ? `Activity +${p.activityXpEarned}` : ''}
                    </p>
                  </div>
                ) : null}
              </div>

              {p.humanLine ? (
                <p className="text-[12px] text-slate-100 leading-snug font-sans border-l-[3px] border-emerald-500/55 pl-3.5 py-1 pr-1 rounded-r-lg bg-emerald-950/20">
                  {p.humanLine}
                </p>
              ) : null}

              <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                Your Arena stances are written to Intuition. Leaderboard XP catches up after indexer sync.
              </p>

              {p.footnote ? (
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/25 px-3 py-2.5 flex gap-2.5">
                  <Terminal className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" strokeWidth={2.2} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[9px] font-mono font-bold tracking-[0.18em] text-cyan-400/95 uppercase mb-1">
                      Personal tags · FYI
                    </p>
                    <p className="text-[11px] text-slate-300 font-mono leading-snug">{p.footnote}</p>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playClick();
                  requestClose();
                }}
                className="w-full rounded-2xl py-3 text-sm font-black uppercase tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 text-white border border-emerald-400/35 shadow-[0_0_24px_rgba(16,185,129,0.22)] hover:from-emerald-500 hover:to-teal-500 transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};

export default ArenaBatchSuccessModal;
