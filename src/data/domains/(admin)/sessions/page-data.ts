import 'server-only';
import { readServerQuery } from '@/data/server-query';
import { getInstructorSessions } from '@/data/domains/(admin)/sessions/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { getSiteContent } from '@/data/domains/(shared)/content/queries';
import { getMySessionChange } from '@/data/domains/(shared)/sessions/changes';
import { getSessionReport } from '@/data/domains/(shared)/sessions/reports';
import { canChangeSessionAt, getServerNow } from '@/data/server-time';

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
