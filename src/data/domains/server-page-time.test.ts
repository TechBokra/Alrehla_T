import { describe, expect, it, vi } from 'vitest';
import type { InstructorSession, SessionWithDetails, StudentSession } from '@/types';
import type { SiteSettings } from './content';
import { adminOverviewTiming, instructorOverviewTiming, roomsTiming } from './dashboard-time';
import { blogPublicationData, visibleAnnouncement } from './content-time';
import { loginBlockedAt } from './admin-user-auth';
import { studentSessionGroups } from './session-pages';
import { nextAccountSession } from './account-overview';
import { readServerQuery } from '@/data/server-query';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: vi.fn() }));
const now = new Date('2026-10-09T12:00:00Z');
const row = (id: string, scheduledAt: string, status = 'confirmed') => ({ id, scheduledAt, status });

describe('server page temporal view models', () => {
  it('uses one boundary to split student sessions without duplication', () => {
    const sessions = [row('past', '2026-10-09T11:59:59Z'), row('now', now.toISOString()),
      row('future', '2026-10-10T12:00:00Z'), row('invalid', 'invalid')] as StudentSession[];
    const result = studentSessionGroups(sessions, now);
    expect(result.upcoming.map((s) => s.id)).toEqual(['now', 'future']);
    expect(result.past.map((s) => s.id)).toEqual(['past']);
  });
  it('sorts past sessions newest first and future sessions soonest first', () => {
    const result = studentSessionGroups([
      row('old', '2026-10-01T12:00:00Z'), row('recent', '2026-10-08T12:00:00Z'),
      row('later', '2026-10-11T12:00:00Z'), row('sooner', '2026-10-10T12:00:00Z'),
    ] as StudentSession[], now);
    expect(result.past.map((s) => s.id)).toEqual(['recent', 'old']);
    expect(result.upcoming.map((s) => s.id)).toEqual(['sooner', 'later']);
  });
  it('preserves the account one-hour grace window', () => {
    const result = nextAccountSession([
      row('too-old', '2026-10-09T10:59:59Z'), row('boundary', '2026-10-09T11:00:00Z'),
      row('cancelled', '2026-10-09T11:01:00Z', 'cancelled'),
    ] as SessionWithDetails[], now);
    expect(result?.id).toBe('boundary');
  });
  it('preserves the instructor outstanding list and assigns Cairo display values', () => {
    const result = instructorOverviewTiming([
      row('overdue', '2026-10-08T12:00:00Z'), row('midnight', '2026-10-08T22:30:00Z'),
      row('cancelled', '2026-10-09T12:00:00Z', 'cancelled'), row('done', '2026-10-09T12:00:00Z', 'completed'),
    ] as InstructorSession[], now);
    expect(result.confirmedBookings.map((s) => s.id)).toEqual(['overdue', 'midnight']);
    expect(result.previewSessions[1]).toMatchObject({ isToday: true, dayOfMonth: 9 });
  });
  it('counts admin today, overdue, seven-day orders and publication boundaries', () => {
    const result = adminOverviewTiming([
      row('today', '2026-10-08T22:30:00Z'), row('past', '2026-10-08T12:00:00Z'),
      row('cancelled', '2026-10-09T12:00:00Z', 'cancelled'),
    ], [{ createdAt: '2026-10-02T12:00:00Z' }, { createdAt: '2026-10-02T11:59:59Z' }],
    [{ publishedAt: now.toISOString() }, { publishedAt: '2026-10-09T12:00:01Z' }], now);
    expect(result.todaySessions.map((s) => s.id)).toEqual(['today']);
    expect(result.overdueSessions.map((s) => s.id)).toEqual(['today', 'past']);
    expect(result.ordersThisWeek).toBe(1);
    expect(result.publishedPosts).toBe(1);
  });
  it('uses Cairo days for room projections and filters past/cancelled sessions', () => {
    const result = roomsTiming([row('past', '2026-10-08T12:00:00Z'), row('future', '2026-10-10T12:00:00Z'),
      row('cancelled', '2026-10-10T12:00:00Z', 'cancelled')], new Date('2026-10-08T22:30:00Z'));
    expect(result.upcoming.map((s) => s.id)).toEqual(['future']);
    expect(result.dayOfMonth).toBe(9);
  });
  it('hides expired announcements at the exact boundary', () => {
    const announcement = { enabled: true, text: 'Notice', until: now.toISOString() } as SiteSettings['announcement'];
    expect(visibleAnnouncement(announcement, now)).toBeNull();
    expect(visibleAnnouncement({ ...announcement, until: '2026-10-09T12:00:01Z' }, now)).toEqual({ text: 'Notice', expiresAt: Date.parse('2026-10-09T12:00:01Z') });
    expect(visibleAnnouncement({ ...announcement, until: 'invalid' }, now)).toEqual({ text: 'Notice', expiresAt: null });
    expect(visibleAnnouncement({ ...announcement, enabled: false }, now)).toBeNull();
  });
  it('sets blog status from one publication boundary', () => {
    expect(blogPublicationData([{ publishedAt: now.toISOString() }, { publishedAt: '2026-10-09T12:00:01Z' }], now)
      .map((post) => post.isDraft)).toEqual([false, true]);
  });
  it('only treats a future valid auth ban as active', () => {
    expect(loginBlockedAt('2026-10-09T12:00:01Z', now)).toBe(true);
    expect(loginBlockedAt(now.toISOString(), now)).toBe(false);
    expect(loginBlockedAt('invalid', now)).toBe(false);
  });
  it('returns successful query data', async () => {
    expect(await readServerQuery(async () => ({ count: 2 }), 'Failed')).toEqual({ success: true, data: { count: 2 } });
  });
  it('does not leak query failures or report empty success', async () => {
    expect(await readServerQuery(async () => { throw new Error('private details'); }, 'Failed'))
      .toEqual({ success: false, error: { code: 'LOAD_FAILED', message: 'Failed' } });
  });
});
