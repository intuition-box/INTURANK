import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { getFirstListIdWithPending, getTotalPendingCount } from '../services/arenaPendingBatch';
import { playClick } from '../services/audio';

const INTURANK_CYAN = '#00f3ff';
const INTURANK_MAGENTA = '#ff1e6d';

/**
 * Fixed bottom-right batch queue control (viewport-anchored).
 * Inline `right`/`left` so layout never mirrors to the wrong corner; renders to `document.body`.
 */
const ArenaBatchFab: React.FC = () => {
  const [count, setCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();

  const safeBottom = useMemo(
    () => `max(1.25rem, env(safe-area-inset-bottom, 0px))`,
    []
  );
  const safeRight = useMemo(() => `max(1.25rem, env(safe-area-inset-right, 0px))`, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const read = () => setCount(getTotalPendingCount());
    read();
    const id = window.setInterval(read, 1500);
    return () => window.clearInterval(id);
  }, [loc.pathname]);

  const onOpen = () => {
    const lid = getFirstListIdWithPending();
    playClick();
    if (loc.pathname === '/climb') {
      window.dispatchEvent(new CustomEvent('arena-batch-fab-toggle'));
      return;
    }
    if (lid) {
      void navigate(`/climb?openBatch=1&listId=${encodeURIComponent(lid)}`);
    } else {
      void navigate('/climb');
    }
  };

  if (!mounted || count < 1) return null;

  return createPortal(
    <button
      type="button"
      dir="ltr"
      onClick={onOpen}
      style={{
        position: 'fixed',
        /** Always clickable, including when batch popover is expanded. */
        zIndex: 760,
        left: 'auto',
        right: safeRight,
        bottom: safeBottom,
        width: '3.5rem',
        height: '3.5rem',
      }}
      className="sm:w-[3.35rem] sm:h-[3.35rem] rounded-2xl flex items-center justify-center
        border border-cyan-400/45
        shadow-[0_0_0_1px_rgba(0,243,255,0.12),0_16px_48px_rgba(0,0,0,0.55),0_0_40px_rgba(255,30,109,0.15)]
        bg-gradient-to-br from-[#0a1624]/95 via-[#080c14]/98 to-[#120818]/95
        backdrop-blur-xl backdrop-saturate-150
        hover:brightness-110 active:scale-[0.97] transition-[transform,box-shadow,filter]"
      aria-label={`Review ${count} queued stance${count === 1 ? '' : 's'}`}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-90"
        style={{
          background: `linear-gradient(135deg, ${INTURANK_CYAN}22 0%, transparent 42%, ${INTURANK_MAGENTA}18 100%)`,
        }}
        aria-hidden
      />
      <Layers className="relative w-6 h-6" style={{ color: INTURANK_CYAN }} strokeWidth={2.2} aria-hidden />
      <span
        className="absolute -top-1 -right-1 min-w-[1.35rem] h-5 px-1 rounded-lg text-white text-[11px] font-bold flex items-center justify-center border shadow-md"
        style={{
          background: `linear-gradient(135deg, ${INTURANK_MAGENTA}, #c4124a)`,
          borderColor: 'rgba(255,255,255,0.25)',
        }}
      >
        {count > 99 ? '99+' : count}
      </span>
    </button>,
    document.body
  );
};

export default ArenaBatchFab;
