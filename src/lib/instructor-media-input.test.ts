import { describe, it, expect } from 'vitest';
import { parseMediaInput } from './instructor-media-input';

const fd = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};
const url = 'https://res.cloudinary.com/x/image/upload/a.jpg';

describe('صورة المدرب', () => {
  it('🔴 الغلاف من غير خانتي العنوان والمشاركة بيعدّي (كان «Invalid input»)', () => {
    const r = parseMediaInput(fd({ kind: 'cover', imageUrl: url }));
    expect(r).toEqual({ ok: true, data: { imageUrl: url, title: '', contribution: '' } });
  });

  it('العمل بعنوانه ومشاركته', () => {
    const r = parseMediaInput(fd({ imageUrl: url, title: ' كتاب ', contribution: 'رسوم' }));
    expect(r.ok && r.data.title).toBe('كتاب');
  });

  it('الرسائل بالعربي', () => {
    expect(parseMediaInput(fd({}))).toEqual({ ok: false, error: 'ارفع صورة الأول' });
    expect(parseMediaInput(fd({ imageUrl: 'https://evil.com/a.jpg' }))).toEqual({
      ok: false,
      error: 'الصورة لازم تترفع من الموقع نفسه',
    });
    const long = parseMediaInput(fd({ imageUrl: url, title: 'x'.repeat(121) }));
    expect(long).toEqual({ ok: false, error: 'العنوان طويل أوي' });
  });
});
