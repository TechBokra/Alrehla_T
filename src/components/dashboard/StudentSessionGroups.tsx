'use client';

import { useMemo } from 'react';
import { SessionsList, type SessionRow } from './SessionsList';
import { useNow } from '@/components/providers/ClientTimeProvider';
import { groupSessionsAt } from '@/lib/time-values';

/** Move sessions between groups as time passes without refetching private data. */
export function StudentSessionGroups({ upcoming, past }: { upcoming: SessionRow[]; past: SessionRow[] }) {
  const now = useNow();
  const groups = useMemo(() => groupSessionsAt([...upcoming, ...past], now), [upcoming, past, now]);
  return <>
    <h2 className="mb-4 font-black text-slate-800">القادمة ({groups.upcoming.length})</h2>
    <SessionsList sessions={groups.upcoming} />
    {groups.past.length > 0 && <>
      <h2 className="mt-10 mb-4 font-black text-slate-800">اللي عدّت ({groups.past.length})</h2>
      <SessionsList sessions={groups.past} />
    </>}
  </>;
}
