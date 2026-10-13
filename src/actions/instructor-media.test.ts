import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitInstructorMedia, removeInstructorMedia } from './instructor-media';
const mocks = vi.hoisted(() => ({ db: vi.fn(), auth: vi.fn(), cleanup: vi.fn(), notify: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.db }));
vi.mock('@/lib/auth-guard', () => ({ requireInstructor: mocks.auth, requireAdmin: vi.fn() }));
vi.mock('@/data/domains/(admin)/media/image-replacement', () => ({ cleanupReplacedImages: mocks.cleanup }));
vi.mock('@/lib/notifications', () => ({ notifyAdmins: mocks.notify }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/revalidate', () => ({ refreshPublicPages: vi.fn() }));
vi.mock('@/lib/audit', () => ({ logAuditAction: vi.fn() }));
const old = 'https://res.cloudinary.com/demo/image/upload/v1/alrehla/instructors/works/old.jpg';
const next = old.replace('old.jpg', 'next.jpg');
let replies: unknown[];
let update: ReturnType<typeof vi.fn>;
let insert: ReturnType<typeof vi.fn>;
function form() {
  const data = new FormData();
  data.set('kind', 'work'); data.set('id', 'work-1'); data.set('imageUrl', next);
  return data;
}
describe('instructor image replacement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ instructorId: 'own-instructor', user: { fullName: 'Instructor' } });
    mocks.cleanup.mockResolvedValue(undefined);
    mocks.notify.mockResolvedValue(undefined);
    replies = [];
    const q: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'neq', 'delete']) q[method] = vi.fn(() => q);
    update = vi.fn(() => q); insert = vi.fn(() => q);
    q.update = update; q.insert = insert;
    q.maybeSingle = vi.fn(async () => replies.shift());
    q.then = (resolve: (value: unknown) => unknown) => Promise.resolve(replies.shift()).then(resolve);
    mocks.db.mockResolvedValue({ from: vi.fn(() => q) });
  });
  it('updates the owned record rather than adding another work at the limit', async () => {
    replies = [{ data: { image_url: old } }, { count: 12 }, { data: { status: 'approved' } }, { data: { id: 'work-1' } }];
    expect(await submitInstructorMedia(form())).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ image_url: next, status: 'pending' }));
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledWith([old]);
  });
  it('rejects a record not owned by the instructor', async () => {
    replies = [{ data: null }];
    expect((await submitInstructorMedia(form())).ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it('keeps the previous asset when saving the replacement fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    replies = [{ data: { image_url: old } }, { count: 1 }, { data: { status: 'pending' } }, { data: null, error: { message: 'failed' } }];
    expect((await submitInstructorMedia(form())).ok).toBe(false);
    expect(mocks.cleanup).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('uses the deleted database reference for cleanup', async () => {
    replies = [{ data: { id: 'work-1', image_url: old } }];
    expect(await removeInstructorMedia(form())).toEqual({ ok: true });
    expect(mocks.cleanup).toHaveBeenCalledWith([old]);
  });
  it('returns success for a saved record when notification delivery fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    replies = [{ data: { image_url: old } }, { count: 1 }, { data: { status: 'pending' } }, { data: { id: 'work-1' } }];
    mocks.notify.mockRejectedValue(new Error('notification unavailable'));
    expect(await submitInstructorMedia(form())).toEqual({ ok: true });
    vi.restoreAllMocks();
  });
});
