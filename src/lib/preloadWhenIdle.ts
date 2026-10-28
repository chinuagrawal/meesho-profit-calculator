type Connection = { saveData?: boolean; effectiveType?: string };

// One page at a time, after the current screen has had time to render.
// Explicit navigation/hover preloads still work on constrained connections.
export function preloadWhenIdle(loaders: Array<() => Promise<unknown>>) {
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return () => {};
  let stopped = false;
  let cancelScheduled = () => {};
  const queue = [...loaders];
  const schedule = () => {
    if (stopped || !queue.length) return;
    const run = () => {
      if (stopped) return;
      // Do not spend bandwidth on a dashboard in a hidden browser tab.
      if (document.visibilityState === "hidden") {
        const resume = () => {
          if (document.visibilityState === "hidden") return;
          document.removeEventListener("visibilitychange", resume);
          schedule();
        };
        document.addEventListener("visibilitychange", resume);
        cancelScheduled = () => document.removeEventListener("visibilitychange", resume);
        return;
      }
      const load = queue.shift()!;
      void Promise.resolve().then(load).catch(() => {}).then(schedule);
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(run, { timeout: 3000 });
      cancelScheduled = () => window.cancelIdleCallback(handle);
    } else {
      const handle = window.setTimeout(run, 750);
      cancelScheduled = () => window.clearTimeout(handle);
    }
  };
  const delay = window.setTimeout(schedule, 1200);
  cancelScheduled = () => window.clearTimeout(delay);
  return () => { stopped = true; cancelScheduled(); };
}
