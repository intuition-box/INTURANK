import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X, Loader2, Minus, Plus, FileText, Coins, Flame, Layers, Trash2 } from 'lucide-react';
import { playClick } from '../services/audio';
import type { ArenaPendingRow } from '../services/arenaPendingBatch';

export type ArenaBatchModalRow = ArenaPendingRow & {
  sourceListId: string;
  /** List title from registry — shown when batch spans multiple lists. */
  sourceListTitle?: string;
};

const CY = '#00f3ff';
const MG = '#ff1e6d';

type Props = {
  open: boolean;
  onClose: () => void;
  themeShort: string;
  contextSuffix: string;
  stakeLabel: string;
  rows: ArenaBatchModalRow[];
  onUpdateUnits: (sourceListId: string, key: string, units: number) => void;
  onToggleSupport: (sourceListId: string, key: string) => void;
  onRemove: (sourceListId: string, key: string) => void;
  /** Drops every queued row (after confirm); optional so older call sites stay valid. */
  onClearAll?: () => void;
  onSubmit: () => void;
  submitting: boolean;
  /** True when stake × units is below curve minimum on any row — submit would revert. */
  depositBlocked?: boolean;
  /** Protocol minimum TRUST label (e.g. "0.5") from `CURVE_OFFSET`. */
  minDepositLabel?: string;
};

function kindIcon(kind: ArenaPendingRow['item']['kind']) {
  switch (kind) {
    case 'token':
      return <Coins size={14} className="text-amber-200/90" strokeWidth={2.2} />;
    case 'atom':
      return <Flame size={14} className="text-[#7afcff]/90" strokeWidth={2.2} />;
    default:
      return <FileText size={14} className="text-cyan-200/90" strokeWidth={2.2} />;
  }
}

const ArenaBatchReviewModal: React.FC<Props> = ({
  open,
  onClose,
  themeShort,
  contextSuffix,
  stakeLabel,
  rows,
  onUpdateUnits,
  onToggleSupport,
  onRemove,
  onClearAll,
  onSubmit,
  submitting,
  depositBlocked = false,
  minDepositLabel,
}) => {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const requestClose = useCallback(() => {
    setConfirmClearAll(false);
    onClose();
  }, [onClose]);

  const stakeN = useMemo(() => {
    const t = parseFloat(stakeLabel);
    return Number.isFinite(t) ? t : 0;
  }, [stakeLabel]);

  const minClaim = useMemo(() => {
    const t = parseFloat(minDepositLabel || '');
    return Number.isFinite(t) ? t : 0;
  }, [minDepositLabel]);

  const rowBelowMinimum = useCallback(
    (units: number) => minClaim > 0 && stakeN * units < minClaim - 1e-12,
    [minClaim, stakeN]
  );

  const rowsNeedAttention = depositBlocked || rows.some((r) => rowBelowMinimum(r.units));

  useEffect(() => {
    if (!open) setConfirmClearAll(false);
  }, [open]);

  useEffect(() => {
    if (rows.length === 0) setConfirmClearAll(false);
  }, [rows.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        playClick();
        if (confirmClearAll) setConfirmClearAll(false);
        else requestClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, confirmClearAll, requestClose]);

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

  const trustTotal = useMemo(() => {
    if (stakeN <= 0) return 0;
    let t = 0;
    for (const r of rows) t += stakeN * r.units;
    return t;
  }, [rows, stakeN]);

  const springPop = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.85 };

  return createPortal(
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div
          key="arena-batch-popup"
          className="fixed inset-0 z-[600] pointer-events-none"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="arena-batch-title"
            aria-describedby="arena-batch-desc"
            className="pointer-events-auto fixed right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[calc(max(1rem,env(safe-area-inset-bottom,0px))+4.5rem)] z-10 w-[min(92vw,430px)] max-h-[min(74dvh,640px)] flex flex-col overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_0_0_1px_rgba(0,243,255,0.08),0_24px_80px_rgba(0,0,0,0.75),0_0_100px_rgba(0,243,255,0.12)]"
            style={{
              background: 'linear-gradient(165deg, rgba(8,12,24,0.98) 0%, rgba(5,6,14,0.99) 50%, rgba(16,4,12,0.97) 100%)',
            }}
            initial={reduceMotion ? { opacity: 0, scale: 0.98 } : { opacity: 0, scale: 0.88, y: 34, x: 8 }}
            animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 26, x: 8 }}
            transition={reduceMotion ? { duration: 0.2 } : springPop}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.5] rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${CY}12 0%, transparent 45%, ${MG}10 100%)`,
              }}
              aria-hidden
            />

            <p id="arena-batch-desc" className="sr-only">
              {themeShort}. Base stake {stakeN.toFixed(2)} TRUST per line times weight multiplier.
              {minDepositLabel
                ? ` Each on-chain claim needs at least ${minDepositLabel} TRUST deposit (base times weight).`
                : ''}
            </p>

            <div className="relative flex items-start justify-between gap-2 px-4 pt-3 pb-3 border-b border-white/[0.06] shrink-0 z-10">
              <div className="min-w-0 flex items-start gap-2.5">
                <div
                  className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border"
                  style={{ borderColor: `${CY}44`, background: `linear-gradient(135deg, ${CY}18, ${MG}12)` }}
                >
                  <Layers className="w-5 h-5" style={{ color: CY }} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 id="arena-batch-title" className="text-base font-bold text-white tracking-tight leading-tight">
                    Your batch
                    <span className="text-slate-500 font-mono font-normal"> · </span>
                    <span className="font-medium" style={{ color: CY }}>
                      {contextSuffix}
                    </span>
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playClick();
                  requestClose();
                }}
                className="shrink-0 p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-[#00f3ff]/35 hover:bg-white/[0.04] transition-colors z-20"
                aria-label="Close"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            {rows.length > 0 && onClearAll ? (
              <div className="relative px-4 pb-2 shrink-0 z-10">
                {confirmClearAll ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-950/30 px-3 py-2.5">
                    <span className="text-[11px] text-slate-300 pr-2">
                      Remove all {rows.length} queued stance{rows.length === 1 ? '' : 's'}?
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={(e) => {
                          e.stopPropagation();
                          playClick();
                          setConfirmClearAll(false);
                        }}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-300 border border-white/15 hover:bg-white/[0.06] disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={(e) => {
                          e.stopPropagation();
                          playClick();
                          setConfirmClearAll(false);
                          onClearAll();
                        }}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-rose-600/90 text-white border border-rose-400/45 hover:bg-rose-600 disabled:opacity-40"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={(e) => {
                        e.stopPropagation();
                        playClick();
                        setConfirmClearAll(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold
                    text-slate-400 hover:text-rose-300 border border-transparent hover:border-rose-500/35 hover:bg-rose-500/10
                    disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      aria-label={`Clear all ${rows.length} queued stances`}
                    >
                      <Trash2 size={13} strokeWidth={2.2} aria-hidden />
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5 z-10 custom-scrollbar">
              {rows.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-10">Nothing queued.</p>
              ) : (
                rows.map((row) => {
                  const lineTrust = stakeN * row.units;
                  const belowMin = rowBelowMinimum(row.units);
                  const rowKey = `${row.sourceListId}:${row.key}`;
                  return (
                    <div
                      key={rowKey}
                      className={`rounded-xl border backdrop-blur-md px-2.5 py-2.5 flex flex-col gap-2 ${
                        belowMin ? 'border-amber-500/55 bg-amber-500/[0.08]' : 'border-white/[0.08] bg-white/[0.04]'
                      }`}
                      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 p-1.5 rounded-lg bg-black/40 border border-white/10 shrink-0">
                          {kindIcon(row.item.kind)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2">{row.item.label}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5 font-mono truncate">
                            {row.item.pairKind}
                            {row.sourceListTitle ? (
                              <span className="text-slate-600"> · {row.sourceListTitle}</span>
                            ) : null}
                          </p>
                          <p className="text-[10px] font-mono font-bold mt-1.5" style={{ color: CY }}>
                            {lineTrust.toFixed(2)} TRUST
                            {belowMin ? (
                              <span className="ml-2 text-amber-200 normal-case tracking-normal">
                                (need ≥ {minDepositLabel ?? '…'} TRUST)
                              </span>
                            ) : null}
                            {row.units > 1 ? (
                              <span className="text-slate-500 font-normal"> · {stakeN.toFixed(2)} × {row.units}</span>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              onToggleSupport(row.sourceListId, row.key);
                            }}
                            className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
                            style={
                              row.support
                                ? { background: `linear-gradient(135deg, ${CY}cc, #0891b2)`, color: '#020308' }
                                : { background: 'rgba(255,30,109,0.2)', color: '#fecdd3', border: '1px solid rgba(255,30,109,0.4)' }
                            }
                          >
                            {row.support ? 'Yes' : 'No'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              onRemove(row.sourceListId, row.key);
                            }}
                            className="p-1 rounded-md text-slate-500 hover:text-rose-300 hover:bg-rose-500/10"
                            aria-label="Remove from batch"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 pl-0.5 pt-1 border-t border-white/[0.05]">
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider mr-1">Weight</span>
                        <button
                          type="button"
                          disabled={row.units <= 1}
                            onClick={() => {
                            playClick();
                            onUpdateUnits(row.sourceListId, row.key, Math.max(1, row.units - 1));
                          }}
                          className="h-8 w-8 rounded-lg border border-white/15 bg-black/50 text-slate-200 disabled:opacity-35 flex items-center justify-center"
                        >
                          <Minus size={15} />
                        </button>
                        <span className="text-sm font-bold tabular-nums min-w-[2.5rem] text-center text-white">{row.units}×</span>
                        <button
                          type="button"
                          disabled={row.units >= 99}
                            onClick={() => {
                            playClick();
                            onUpdateUnits(row.sourceListId, row.key, Math.min(99, row.units + 1));
                          }}
                          className="h-8 w-8 rounded-lg border border-white/15 bg-black/50 text-slate-200 disabled:opacity-35 flex items-center justify-center"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {rowsNeedAttention && minDepositLabel ? (
              <div className="mx-3 mb-2 shrink-0 z-10 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2">
                <p className="text-[11px] text-amber-100/95 leading-snug">
                  Each row needs <span className="font-bold text-white">≥ {minDepositLabel} TRUST</span> (raise stake or
                  weight).
                </p>
              </div>
            ) : null}

            <div className="p-3 border-t border-white/[0.08] shrink-0 z-10 bg-gradient-to-t from-black/60 to-transparent">
              <button
                type="button"
                disabled={rows.length === 0 || submitting || rowsNeedAttention}
                onClick={() => {
                  playClick();
                  onSubmit();
                }}
                className="w-full rounded-xl py-3.5 px-3 text-center text-sm font-black text-[#020308] disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(100deg, ${CY} 0%, #5ee7ff 38%, #fda4c8 70%, ${MG} 100%)`,
                  boxShadow: '0 0 32px rgba(0,243,255,0.3), inset 0 1px 0 rgba(255,255,255,0.35)',
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Sending…
                  </>
                ) : (
                  <>Confirm · {trustTotal.toFixed(2)} TRUST</>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};

export default ArenaBatchReviewModal;
