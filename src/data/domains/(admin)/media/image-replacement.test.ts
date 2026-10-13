import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupReplacedImages } from './image-replacement';

const mocks = vi.hoisted(() => ({ scan: vi.fn(), remove: vi.fn() }));
vi.mock('./queries', () => ({ getMediaScan: mocks.scan }));
vi.mock('@/lib/cloudinary-admin', async (original) => ({
  ...(await original<Record<string, unknown>>()), deleteAssets: mocks.remove,
}));
const old = 'https://res.cloudinary.com/demo/image/upload/v1/alrehla/avatars/old.jpg';

describe('replacement cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'demo');
    mocks.scan.mockResolvedValue({ complete: true, usage: new Map() });
    mocks.remove.mockResolvedValue({ ok: true, data: { deleted: ['alrehla/avatars/old'] } });
  });
  it('removes an unused previous image', async () => {
    await cleanupReplacedImages([old]);
    expect(mocks.remove).toHaveBeenCalledWith(['alrehla/avatars/old']);
  });
  it('keeps an image referenced elsewhere or by a pending approval', async () => {
    mocks.scan.mockResolvedValue({ complete: true, usage: new Map([['alrehla/avatars/old', ['pending request']]]) });
    await cleanupReplacedImages([old]);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('does not delete after an incomplete database read', async () => {
    mocks.scan.mockResolvedValue({ complete: false, usage: new Map() });
    await cleanupReplacedImages([old]);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('rejects other clouds and unrelated asset folders', async () => {
    await cleanupReplacedImages([old.replace('/demo/', '/other/'), old.replace('/avatars/', '/products/')]);
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('does not report an already saved image as failed when deletion fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.remove.mockRejectedValue(new Error('Cloudinary unavailable'));
    await expect(cleanupReplacedImages([old])).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});
