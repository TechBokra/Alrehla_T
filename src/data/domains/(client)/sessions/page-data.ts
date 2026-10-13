import 'server-only';
import { readServerQuery } from '@/data/server-query';
import { getStudentSessions } from '@/data/domains/(client)/sessions/queries';
import { getServerNow, canChangeSessionAt } from '@/data/server-time';
import { studentSessionGroups } from '@/data/domains/(shared)/sessions/timing';
import { getSessions } from '@/data/domains/(shared)/sessions/queries';
import { getMySessionChange } from '@/data/domains/(shared)/sessions/changes';
import { getPublicInstructorById } from '@/data/domains/(shared)/instructors/public';
import { getSessionReport } from '@/data/domains/(shared)/sessions/reports';

export async function getStudentSessionsPageData() {
  return readServerQuery(async () => studentSessionGroups(
    await getStudentSessions({ throwOnError: true }), getServerNow(),
  ), 'تعذّر تحميل الجلسات. جرّب تاني.');
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
