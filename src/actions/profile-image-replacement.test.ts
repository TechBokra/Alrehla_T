import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateMyProfile } from './profiles';
const mocks = vi.hoisted(() => ({ db: vi.fn(), cleanup: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.db }));
vi.mock('@/data/domains/(admin)/media/image-replacement', () => ({ cleanupReplacedImages: mocks.cleanup }));
vi.mock('@/data/domains/(shared)/auth/queries', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/audit', () => ({ logAuditAction: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/revalidate', () => ({ refreshPublicPages: vi.fn() }));
const old = 'https://res.cloudinary.com/demo/image/upload/v1/alrehla/avatars/old.jpg';
const next = old.replace('old.jpg', 'next.jpg');
let replies: unknown[];
describe('profile image save order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replies = [];
    const q: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'update']) q[method] = vi.fn(() => q);
    q.maybeSingle = vi.fn(async () => replies.shift());
    q.then = (resolve: (value: unknown) => unknown) => Promise.resolve(replies.shift()).then(resolve);
    mocks.db.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: () => q });
  });
  it('cleans the previous avatar after saving the replacement', async () => {
    replies = [{ data: { avatar_url: old } }, { data: [{ id: 'owner' }] }];
    expect(await updateMyProfile({ fullName: 'Instructor', avatarUrl: next })).toEqual({ ok: true });
    expect(mocks.cleanup).toHaveBeenCalledWith([old]);
  });
  it('keeps the old avatar when the update affects zero rows', async () => {
    replies = [{ data: { avatar_url: old } }, { data: [] }];
    expect((await updateMyProfile({ fullName: 'Instructor', avatarUrl: next })).ok).toBe(false);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it('does not delete an unchanged avatar', async () => {
    replies = [{ data: { avatar_url: old } }, { data: [{ id: 'owner' }] }];
    expect((await updateMyProfile({ fullName: 'Instructor', avatarUrl: old })).ok).toBe(true);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
});
