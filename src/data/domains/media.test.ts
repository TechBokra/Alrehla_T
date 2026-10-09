import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}), isAdminApiConfigured: () => false }));

describe('cloudinaryIdsIn — فحص الصور المستخدمة', () => {
  it('بيلاقي الصور في أي خانة: قايمة، JSON، نص مقال، رابط متحوّل', async () => {
    const { cloudinaryIdsIn } = await import('./media');
    const row = {
      cover_image_url: 'https://res.cloudinary.com/d/image/upload/v1/alrehla/a.jpg',
      gallery_image_urls: ['https://res.cloudinary.com/d/image/upload/v2/alrehla/b.png'],
      pending_changes: { cover_image_url: 'https://res.cloudinary.com/d/image/upload/v3/alrehla/c.jpg' },
      content: '![x](https://res.cloudinary.com/d/image/upload/f_auto,w_800/v4/alrehla/d.jpg) نص',
      other: 'https://example.com/x.jpg',
    };
    expect(cloudinaryIdsIn(row).sort()).toEqual(['alrehla/a', 'alrehla/b', 'alrehla/c', 'alrehla/d']);
  });

  it('مفتاح الخدمة مش متظبط = فحص ناقص (الحذف مقفول)', async () => {
    const { getMediaScan } = await import('./media');
    const scan = await getMediaScan();
    expect(scan.complete).toBe(false);
  });
});
