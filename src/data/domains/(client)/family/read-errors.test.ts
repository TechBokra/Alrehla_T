import { describe, expect, it, vi } from 'vitest';
import { getCourseSubscriptions } from '@/data/domains/(shared)/bookings/queries';
import { getSessions } from '@/data/domains/(shared)/sessions/queries';
import { getWritingPackages } from '@/data/domains/(shared)/writing/packages';
import { getPublicInstructors } from '@/data/domains/(shared)/instructors/public';
import { getStudentDocuments } from '@/data/domains/(shared)/portfolio/queries';
import { getMySessionChange } from '@/data/domains/(shared)/sessions/changes';
import { getFamilyMembers } from '@/data/domains/(client)/family/queries';

const mocks = vi.hoisted(() => {
  const error = { code: '42501', message: 'permission denied' };
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error }).then(resolve),
  };
  return { error, query, client: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'guardian' } }, error: null }) },
    from: vi.fn(() => query), rpc: vi.fn().mockResolvedValue({ data: null, error }) } };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => mocks.client }));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => mocks.client }));

describe('opt-in strict reads', () => {
  const readers = [
    { name: 'family', read: getFamilyMembers }, { name: 'subscriptions', read: getCourseSubscriptions },
    { name: 'sessions', read: getSessions }, { name: 'packages', read: getWritingPackages },
    { name: 'instructors', read: getPublicInstructors },
    { name: 'documents', read: (options = {}) => getStudentDocuments('student', options) },
  ];
  it.each(readers)('$name rejects database failures for the composed query', async ({ read }) => {
    await expect(read({ throwOnError: true })).rejects.toEqual(mocks.error);
  });
  it.each(readers)('$name keeps the existing fallback for other callers', async ({ read }) => {
    await expect(read()).resolves.toEqual([]);
  });
  it('keeps absent change requests distinct from failed requests in strict mode', async () => {
    await expect(getMySessionChange('session', { throwOnError: true })).rejects.toEqual(mocks.error);
    await expect(getMySessionChange('session')).resolves.toBeNull();
  });
  it('filters child reads to the verified guardian', async () => {
    await getFamilyMembers();
    expect(mocks.query.eq).toHaveBeenCalledWith('user_profile_id', 'guardian');
  });
});
