/**
 * Runs `fn` every `ms` while the document tab is visible.
 * Pauses the timer when the tab is hidden to avoid backlog of work and UI jank after idle.
 * Returns an unsubscribe function for useEffect cleanup.
 */
export function subscribeVisibilityAwareInterval(fn: () => void | Promise<void>, ms: number): () => void {
  let id: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    void fn();
  };

  const start = () => {
    if (id != null) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    tick();
    id = setInterval(tick, ms);
  };

  const stop = () => {
    if (id != null) {
      clearInterval(id);
      id = null;
    }
  };

  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.hidden) stop();
    else start();
  };

  start();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  return () => {
    stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
