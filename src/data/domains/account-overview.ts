import 'server-only';
import { compareAsc, isBefore, parseISO, subHours } from 'date-fns';
import { readServerQuery } from '@/data/server-query';
import { getServerNow, validDate } from '@/data/server-time';
import type { SessionWithDetails } from '@/types';
import { getCurrentUser } from './auth';
import { getFamilyMembers } from './family';
import { getMyServiceOrders } from './services';
import { getSessions } from './writing';

export function nextAccountSession(sessions: SessionWithDetails[], now: Date) {
  const cutoff = subHours(now, 1);
  return sessions.filter((session) => {
    const at = validDate(session.scheduledAt);
    // Preserve the existing one-hour grace window and status rules.
    return session.status !== 'cancelled' && !!at && !isBefore(at, cutoff);
  }).sort((a, b) => compareAsc(parseISO(a.scheduledAt), parseISO(b.scheduledAt)))[0] ?? null;
}

export async function getAccountOverviewData() {
  return readServerQuery(async () => {
    const user = await getCurrentUser();
    const options = { throwOnError: true };
    const [familyMembers, serviceOrders, sessions] = await Promise.all([
      getFamilyMembers(options), getMyServiceOrders(options), getSessions(options),
    ]);
    return { user, familyMembers, serviceOrders, sessions,
      openOrders: serviceOrders.filter((order) => !['completed', 'refunded', 'cancelled'].includes(order.status)),
      upcomingSession: nextAccountSession(sessions, getServerNow()),
      recent: serviceOrders.slice(0, 3), firstName: (user.fullName || '').trim().split(/\s+/)[0] || '' };
  }, 'تعذّر تحميل بيانات حسابك. جرّب تاني.');
}
