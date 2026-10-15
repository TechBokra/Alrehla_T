import 'server-only';
import type { InstructorSession } from '@/types';
import { isCairoToday, validDate, cairoCalendarDate, getServerNow, canChangeSessionAt, ageAt } from '@/data/server-time';
import { getDate, parseISO, compareAsc, isBefore, subHours, isAfter } from 'date-fns';

type SessionTimeRow = { scheduledAt: string; status: string };

export function instructorOverviewTiming(sessions: InstructorSession[], now: Date) {
  const confirmedBookings = sessions.filter((session) => !['cancelled', 'completed'].includes(session.status));
  // Preserve the existing outstanding-session list, including overdue sessions.
  const upcomingSessions = confirmedBookings.map((session) => ({ ...session,
    isToday: isCairoToday(session.scheduledAt, now),
    dayOfMonth: validDate(session.scheduledAt) ? getDate(cairoCalendarDate(parseISO(session.scheduledAt))) : null,
  })).sort((a, b) => compareAsc(parseISO(a.scheduledAt), parseISO(b.scheduledAt)));
  return { confirmedBookings, upcomingSessions,
    todaySessions: sessions.filter((session) => session.status !== 'cancelled' && isCairoToday(session.scheduledAt, now)),
    nextSession: upcomingSessions[0] ?? null, previewSessions: upcomingSessions.slice(0, 3) };
}

export async function getInstructorOverviewTiming(sessions: InstructorSession[]) {
  return instructorOverviewTiming(sessions, getServerNow());
}

export function adminOverviewTiming<T extends SessionTimeRow>(
  sessions: T[], orders: { createdAt: string }[], posts: { publishedAt: string; isDraft?: boolean }[], now: Date,
) {
  const todaySessions = sessions.filter((session) => session.status !== 'cancelled' && isCairoToday(session.scheduledAt, now))
    .sort((a, b) => compareAsc(parseISO(a.scheduledAt), parseISO(b.scheduledAt)));
  const overdueSessions = sessions.filter((session) => {
    const date = validDate(session.scheduledAt);
    return session.status === 'confirmed' && !!date && isBefore(date, now);
  });
  const cutoff = subHours(now, 7 * 24);
  const ordersThisWeek = orders.filter((order) => {
    const date = validDate(order.createdAt);
    return !!date && !isBefore(date, cutoff);
  }).length;
  const publishedPosts = posts.filter((post) => {
    if (post.isDraft) return false;
    const date = validDate(post.publishedAt);
    return !!date && !isAfter(date, now);
  }).length;
  return { todaySessions, overdueSessions, ordersThisWeek, publishedPosts };
}

export async function getAdminOverviewTiming<T extends SessionTimeRow>(sessions: T[], orders: { createdAt: string }[], posts: { publishedAt: string; isDraft?: boolean }[]) {
  return adminOverviewTiming(sessions, orders, posts, getServerNow());
}

export function roomsTiming<T extends SessionTimeRow>(sessions: T[], now: Date) {
  return { upcoming: sessions.filter((session) => canChangeSessionAt(session, now)).slice(0, 50),
    dayOfMonth: getDate(cairoCalendarDate(now)) };
}

export async function getRoomsTiming<T extends SessionTimeRow>(sessions: T[]) {
  return roomsTiming(sessions, getServerNow());
}

export async function getChildrenAgeData<T extends { birth_date: string | null }>(children: T[]) {
  const now = getServerNow();
  return children.map((child) => ({ ...child, age: ageAt(child.birth_date, now) }));
}
