'use client';

import { createContext, startTransition, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeClock, subscribeDeadline } from '@/lib/client-clock';

const TimeContext = createContext<number | null>(null);

/** One shared timer. Unrelated children do not subscribe to the clock. */
export function ClientTimeProvider({ initialTimestamp, children }: {
  initialTimestamp: number;
  children?: ReactNode;
}) {
  const [now, setNow] = useState(initialTimestamp);
  // Non-urgent clock updates should not interrupt typing or streamed hydration.
  useEffect(() => subscribeClock((timestamp) => {
    startTransition(() => setNow(timestamp));
  }), []);
  return <TimeContext.Provider value={now}>{children}</TimeContext.Provider>;
}

export function useNow(): number {
  const now = useContext(TimeContext);
  if (now === null) throw new Error('useNow requires ClientTimeProvider');
  return now;
}

export function useDeadline(deadline: number | null): boolean {
  const now = useNow();
  const [expiredDeadline, setExpiredDeadline] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null || !Number.isFinite(deadline)) return;
    return subscribeDeadline(deadline, () => setExpiredDeadline(deadline));
  }, [deadline]);
  return deadline !== null && (now >= deadline || expiredDeadline === deadline);
}
