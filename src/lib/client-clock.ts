/** Browser subscriptions; invoked from effects only, never while rendering. */
export function subscribeClock(onTick: (timestamp: number) => void, intervalMs = 30_000) {
  const tick = () => {
    if (document.visibilityState !== 'hidden') onTick(Date.now());
  };
  const initial = window.setTimeout(tick, 0);
  const interval = window.setInterval(tick, intervalMs);
  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', tick);
  return () => {
    window.clearTimeout(initial);
    window.clearInterval(interval);
    window.removeEventListener('focus', tick);
    document.removeEventListener('visibilitychange', tick);
  };
}

export function subscribeDeadline(deadline: number, onExpire: () => void) {
  let timeout: number;
  const check = () => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) onExpire();
    else timeout = window.setTimeout(check, Math.min(remaining, 2_147_483_647));
  };
  // Async even for an already-expired cached page: first hydration stays stable.
  timeout = window.setTimeout(check, Math.min(Math.max(0, deadline - Date.now()), 2_147_483_647));
  return () => window.clearTimeout(timeout);
}
