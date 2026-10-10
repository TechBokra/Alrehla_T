import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChildProfile, CourseSubscription, PublicInstructor, SessionWithDetails, WritingPackage } from '@/types';
import { buildDependentFollowUpData, getDependentFollowUpData } from './dependent-follow-up';

const queries = vi.hoisted(() => ({ family: vi.fn(), subscriptions: vi.fn(), sessions: vi.fn(),
  packages: vi.fn(), instructors: vi.fn(), documents: vi.fn(), change: vi.fn() }));
vi.mock('./family', () => ({ getFamilyMembers: queries.family }));
vi.mock('./writing', () => ({ getCourseSubscriptions: queries.subscriptions, getSessions: queries.sessions,
  getWritingPackages: queries.packages, getPublicInstructors: queries.instructors, getStudentDocuments: queries.documents }));
vi.mock('./session-change-requests', () => ({ getMySessionChange: queries.change }));

const now = new Date('2026-10-09T12:00:00Z');
const child: ChildProfile = { id: 'child', userProfileId: 'guardian', fullName: 'Child',
  birthDate: '2016-10-09', createdAt: '2026-01-01', accountProfileId: 'student' };
const sub: CourseSubscription = { id: 'sub', childId: 'child', packageId: 'pkg', userId: 'guardian',
  participantType: 'child', status: 'active', startedAt: '2026-01-01', createdAt: '2026-01-01' };
function session(id: string, scheduledAt: string, status: SessionWithDetails['status'] = 'confirmed'): SessionWithDetails {
  return { id, scheduledAt, status, courseSubscriptionId: 'sub', packageId: 'pkg', sessionNumber: 1,
    instructorId: 'teacher', userId: 'guardian', participantType: 'child', childId: 'child',
    createdAt: '2026-01-01', updatedAt: '2026-01-01' };
}
const input = () => ({ child, subscriptions: [sub], sessions: [] as SessionWithDetails[],
  packages: [{ id: 'pkg', name: 'Package' }] as WritingPackage[],
  instructors: [{ id: 'teacher', displayName: 'Teacher' }] as PublicInstructor[],
  documents: [{ id: 'doc', status: 'reviewed' }] });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
  queries.family.mockResolvedValue([child]);
  queries.subscriptions.mockResolvedValue([sub]);
  queries.sessions.mockResolvedValue([]);
  queries.packages.mockResolvedValue(input().packages);
  queries.instructors.mockResolvedValue(input().instructors);
  queries.documents.mockResolvedValue(input().documents);
  queries.change.mockResolvedValue(null);
});

describe('dependent follow-up view model', () => {
  it('returns names, progress, document counts and age ready for presentation', () => {
    const data = buildDependentFollowUpData({ ...input(), sessions: [
      session('done', '2026-10-08T12:00:00Z', 'completed'), session('next', '2026-10-10T12:00:00Z'),
    ] }, now);
    expect(data.age).toBe(10);
    expect(data.reviewed).toBe(1);
    expect(data.subscriptions[0]).toMatchObject({ packageName: 'Package', sessionCount: 2, completedSessions: 1 });
    expect(data.nextSession).toMatchObject({ id: 'next', packageName: 'Package', instructorName: 'Teacher' });
    expect(data.asOf).toBe(now.toISOString());
  });
  it('filters subscriptions and sessions to the owned child', () => {
    const data = buildDependentFollowUpData({ ...input(), subscriptions: [sub, { ...sub, id: 'other', childId: 'other-child' }],
      sessions: [{ ...session('other', '2026-10-10T12:00:00Z'), courseSubscriptionId: 'other' }] }, now);
    expect(data.subscriptions).toHaveLength(1);
    expect(data.sessions).toEqual([]);
  });
  it('sorts instants correctly even with different timezone offsets', () => {
    const data = buildDependentFollowUpData({ ...input(), sessions: [
      session('later', '2026-10-10T08:00:00Z'), session('earlier', '2026-10-10T09:00:00+03:00'),
    ] }, now);
    expect(data.sessions.map((item) => item.id)).toEqual(['earlier', 'later']);
  });
  it('includes the exact time boundary but excludes past, completed, cancelled and invalid dates', () => {
    const data = buildDependentFollowUpData({ ...input(), sessions: [
      session('past', '2026-10-09T11:59:59Z'), session('done', now.toISOString(), 'completed'),
      session('cancelled', now.toISOString(), 'cancelled'), session('invalid', 'invalid'),
      session('boundary', now.toISOString()),
    ] }, now);
    expect(data.nextSession?.id).toBe('boundary');
  });
  it('calculates birthdays using the Cairo date, not UTC midnight', () => {
    expect(buildDependentFollowUpData(input(), new Date('2026-10-08T22:30:00Z')).age).toBe(10);
  });
  it.each([null, 'invalid', '2027-01-01'])('handles absent, invalid or future birth dates: %s', (birthDate) => {
    expect(buildDependentFollowUpData({ ...input(), child: { ...child, birthDate } }, now).age).toBeNull();
  });
  it('provides fallback package names and empty progress', () => {
    const data = buildDependentFollowUpData({ ...input(), packages: [], documents: [] }, now);
    expect(data.subscriptions[0]).toMatchObject({ packageName: 'باقة غير معروفة', sessionCount: 0, completedSessions: 0 });
    expect(data.nextSession).toBeNull();
    expect(data.reviewed).toBe(0);
  });
});

describe('dependent follow-up query result', () => {
  it('returns success and all prepared data', async () => {
    const result = await getDependentFollowUpData(child.id);
    expect(result).toMatchObject({ success: true, data: { child, reviewed: 1 } });
    expect(queries.subscriptions).toHaveBeenCalledWith({ throwOnError: true });
  });
  it('does not load related private data before ownership is confirmed', async () => {
    const result = await getDependentFollowUpData('someone-elses-child');
    expect(result).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(queries.documents).not.toHaveBeenCalled();
    expect(queries.sessions).not.toHaveBeenCalled();
  });
  it('does not request portfolio documents without a student account', async () => {
    queries.family.mockResolvedValue([{ ...child, accountProfileId: null }]);
    expect(await getDependentFollowUpData(child.id)).toMatchObject({ success: true, data: { documents: [], reviewed: 0 } });
    expect(queries.documents).not.toHaveBeenCalled();
  });
  it.each(['family', 'subscriptions', 'sessions', 'packages', 'instructors', 'documents'] as const)(
    'does not present a failed %s query as empty success', async (key) => {
      queries[key].mockRejectedValue(new Error('private database error'));
      const result = await getDependentFollowUpData(child.id);
      expect(result).toMatchObject({ success: false, error: { code: 'LOAD_FAILED' } });
      expect(JSON.stringify(result)).not.toContain('private database error');
    },
  );
  it('loads the change request only for the next eligible session', async () => {
    queries.sessions.mockResolvedValue([session('future', '2099-10-10T12:00:00Z')]);
    queries.change.mockResolvedValue({ id: 'change' });
    expect(await getDependentFollowUpData(child.id)).toMatchObject({ success: true, data: { nextChange: { id: 'change' } } });
    expect(queries.change).toHaveBeenCalledWith('future', { throwOnError: true });
  });
  it('returns a failure when the change request cannot be loaded', async () => {
    queries.sessions.mockResolvedValue([session('future', '2099-10-10T12:00:00Z')]);
    queries.change.mockRejectedValue(new Error('unavailable'));
    expect(await getDependentFollowUpData(child.id)).toMatchObject({ success: false, error: { code: 'LOAD_FAILED' } });
  });
});
