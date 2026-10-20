import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signParams, privateUploadTicket, privateImageUrl } from './cloudinary-private';

const ENV = { ...process.env };

describe('cloudinary-private', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo';
    process.env.CLOUDINARY_API_KEY = 'key123';
    process.env.CLOUDINARY_API_SECRET = 'abcd';
  });
  afterEach(() => {
    process.env = { ...ENV };
  });

  it('التوقيع مطابق لمثال Cloudinary الرسمي', () => {
    // من وثائق Cloudinary: «Generating authentication signatures».
    expect(
      signParams(
        { eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 },
        'abcd',
      ),
    ).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });

  it('التذكرة: مجلّد خاص ونوع authenticated، والسرّ مش جواها', () => {
    const t = privateUploadTicket('children', 1_800_000_000_000)!;
    expect(t.folder).toBe('alrehla/private/children');
    expect(t.type).toBe('authenticated');
    expect(t.timestamp).toBe(1_800_000_000);
    expect(JSON.stringify(t)).not.toContain('abcd');
    expect(t.signature).toBe(
      signParams(
        { allowed_formats: t.allowedFormats, folder: t.folder, timestamp: t.timestamp, type: 'authenticated' },
        'abcd',
      ),
    );
  });

  it('رابط الصورة بينتهي بعد ساعة، وفيه التوقيع مش السرّ', () => {
    const url = new URL(
      privateImageUrl({ publicId: 'alrehla/private/children/x', format: 'jpg' }, { now: 1_800_000_000_000 })!,
    );
    expect(url.origin + url.pathname).toBe('https://api.cloudinary.com/v1_1/demo/image/download');
    expect(url.searchParams.get('expires_at')).toBe(String(1_800_000_000 + 3600));
    expect(url.searchParams.get('type')).toBe('authenticated');
    expect(url.searchParams.get('attachment')).toBeNull();
    expect(url.toString()).not.toContain('abcd');
  });

  it('التحميل بيضيف attachment للتوقيع', () => {
    const a = new URL(privateImageUrl({ publicId: 'p', format: 'png' }, { attachment: true, now: 0 })!);
    const b = new URL(privateImageUrl({ publicId: 'p', format: 'png' }, { now: 0 })!);
    expect(a.searchParams.get('attachment')).toBe('true');
    expect(a.searchParams.get('signature')).not.toBe(b.searchParams.get('signature'));
  });

  it('من غير مفاتيح: null مش رابط مكسور', () => {
    delete process.env.CLOUDINARY_API_SECRET;
    expect(privateUploadTicket('covers')).toBeNull();
    expect(privateImageUrl({ publicId: 'p', format: 'jpg' })).toBeNull();
  });
});
