import 'server-only';
import type { StudentSession } from '@/types';
import { validDate } from '@/data/server-time';
import { isBefore, compareAsc, parseISO, compareDesc } from 'date-fns';

export function studentSessionGroups(sessions: StudentSession[], now: Date) {
  const rows = sessions.map((session) => ({ id: session.id,
    href: `/dashboard/student/sessions/${session.id}`, title: `الجلسة ${session.sessionNumber}`,
    subtitle: session.instructorName ? `${session.packageName} · ${session.instructorName}` : session.packageName,
    scheduledAt: session.scheduledAt, status: session.status, meetingUrl: session.meetingUrl }));
  const upcoming: typeof rows = [];
  const past: typeof rows = [];
  for (const row of rows) {
    const at = validDate(row.scheduledAt);
    if (!at) continue;
    (isBefore(at, now) ? past : upcoming).push(row);
  }
  upcoming.sort((a, b) => compareAsc(parseISO(a.scheduledAt), parseISO(b.scheduledAt)));
  past.sort((a, b) => compareDesc(parseISO(a.scheduledAt), parseISO(b.scheduledAt)));
  return { upcoming, past };
}
