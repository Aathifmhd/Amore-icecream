/**
 * Runs `task` now and then again every `visibleMs` while the page is on screen
 * (every `hiddenMs` in a background tab, or not at all when that is null), and right
 * away when the page comes back into view. Returns a function that stops it.
 */
export function startPolling(
  task: () => Promise<unknown>,
  { visibleMs, hiddenMs = null }: { visibleMs: number; hiddenMs?: number | null }
): () => void {
  let stopped = false;
  let running = false;
  let timer: number | undefined;

  const schedule = () => {
    window.clearTimeout(timer);
    if (stopped) return;
    const wait = document.hidden ? hiddenMs : visibleMs;
    if (wait !== null) timer = window.setTimeout(tick, wait);
  };

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await task();
    } catch {
      /* try again on the next tick */
    } finally {
      running = false;
      schedule();
    }
  };

  const onVisibility = () => {
    if (!document.hidden) void tick();
    else schedule();
  };

  document.addEventListener('visibilitychange', onVisibility);
  void tick();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

/** One poller shared by every component that subscribes; it runs while anyone is subscribed. */
export function sharedPoller(start: () => () => void): () => () => void {
  let subscribers = 0;
  let stop: (() => void) | null = null;
  return () => {
    if (subscribers++ === 0) stop = start();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      if (--subscribers === 0) {
        stop?.();
        stop = null;
      }
    };
  };
}
