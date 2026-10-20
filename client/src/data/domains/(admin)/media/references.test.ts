import { describe, expect, it, vi } from 'vitest';
import { getMediaScan } from './queries';
const mocks = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock('@/lib/supabase/admin', () => ({
  isAdminApiConfigured: () => true,
  createAdminClient: () => ({
    from: (table: string) => ({ select: () => ({ range: async () => ({
      data: table === 'profile_update_requests' ? mocks.rows : [], error: null,
    }) }) }),
  }),
}));
const image = 'https://res.cloudinary.com/demo/image/upload/v1/alrehla/avatars/previous.jpg';
describe('avatar reference lifetime', () => {
  it('keeps pending request images available for approval', async () => {
    mocks.rows = [{ status: 'pending', requested_changes: { avatarUrl: image } }];
    const scan = await getMediaScan();
    expect(scan.complete).toBe(true);
    expect(scan.usage.has('alrehla/avatars/previous')).toBe(true);
  });
  it('completed request history does not indefinitely retain obsolete avatars', async () => {
    mocks.rows = [{ status: 'approved', requested_changes: { avatarUrl: image } },
      { status: 'rejected', requested_changes: { avatarUrl: image } }];
    const scan = await getMediaScan();
    expect(scan.complete).toBe(true);
    expect(scan.usage.has('alrehla/avatars/previous')).toBe(false);
  });
});
