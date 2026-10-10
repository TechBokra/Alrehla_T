import 'server-only';
import { compareAsc, compareDesc, isBefore, parseISO } from 'date-fns';
import { readServerQuery } from '@/data/server-query';
import { canChangeSessionAt, getServerNow, validDate } from '@/data/server-time';
import type { StudentSession } from '@/types';
import { getStudentSessions, getInstructorSessions, getSessions, getPublicInstructorById, getSessionReport } from './writing';
import { getMySessionChange } from './session-change-requests';
import { getSiteContent, getSiteSettings } from './content';

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

export async function getStudentSessionsPageData() {
  return readServerQuery(async () => studentSessionGroups(
    await getStudentSessions({ throwOnError: true }), getServerNow(),
  ), 'تعذّر تحميل الجلسات. جرّب تاني.');
}

/** Route role guards remain in the page; session queries retain Supabase RLS. */
export async function getInstructorSessionPageData(id: string) {
  return readServerQuery(async () => {
    const options = { throwOnError: true };
    const sessions = await getInstructorSessions(options);
    const session = sessions.find((item) => item.id === id);
    if (!session) return null;
    const [settings, content, change, report] = await Promise.all([
      getSiteSettings(), getSiteContent(), getMySessionChange(id, options), getSessionReport(id),
    ]);
    return { session, settings, content, change, report, canRequestChange: canChangeSessionAt(session, getServerNow()) };
  }, 'تعذّر تحميل بيانات الجلسة. جرّب تاني.');
}

export async function getStudentSessionPageData(id: string) {
  return readServerQuery(async () => {
    const options = { throwOnError: true };
    const sessions = await getSessions(options);
    const session = sessions.find((item) => item.id === id);
    if (!session) return null;
    const [change, instructor, report] = await Promise.all([
      getMySessionChange(id, options),
      session.instructorId ? getPublicInstructorById(session.instructorId, options) : Promise.resolve(null),
      getSessionReport(id),
    ]);
    return { session, change, instructor, report, canRequestChange: canChangeSessionAt(session, getServerNow()) };
  }, 'تعذّر تحميل بيانات الجلسة. جرّب تاني.');
}
