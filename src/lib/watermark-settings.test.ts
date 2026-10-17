import { describe, it, expect } from 'vitest';
import {
  cleanWatermarkText,
  DEFAULT_WATERMARK,
  DEFAULT_WATERMARK_TEXT,
  normalizeWatermark,
  watermarkLayer,
} from '@/lib/watermark-settings';

describe('إعدادات العلامة المائية', () => {
  it('مفيش حاجة محفوظة = شغّالة بالشكل الافتراضي (زي ما كانت)', () => {
    expect(normalizeWatermark(undefined)).toEqual(DEFAULT_WATERMARK);
    expect(normalizeWatermark({})).toEqual(DEFAULT_WATERMARK);
  });

  it('مقفولة = مفيش طبقة، والصور زي ما هي', () => {
    expect(watermarkLayer(normalizeWatermark({ enabled: false }))).toBeNull();
  });

  it('اختيار مش معروف بيرجع للافتراضي', () => {
    const w = normalizeWatermark({ style: 'neon', size: 'huge', position: 'top_left' });
    expect(w.style).toBe('light');
    expect(w.size).toBe('medium');
    expect(w.position).toBe('bottom');
  });

  it('الحروف اللي بتكسر الرابط بتتشال، والطول بيتقص', () => {
    expect(cleanWatermarkText('a/b,c%d')).toBe('a b c d');
    expect(cleanWatermarkText('x'.repeat(90)).length).toBe(40);
    expect(normalizeWatermark({ text: '   ' }).text).toBe(DEFAULT_WATERMARK_TEXT);
  });

  it('الطبقة: الشكل والحجم والمكان', () => {
    const dark = watermarkLayer({ ...DEFAULT_WATERMARK, style: 'dark', size: 'large', position: 'center' })!;
    expect(dark).toContain('co_rgb:ffffff');
    expect(dark).toContain('w_0.32');
    expect(dark).toContain('g_center');
    expect(dark).not.toContain('y_0.24');
    const light = watermarkLayer(DEFAULT_WATERMARK)!;
    expect(light).toContain('g_south,y_0.24');
    // مفيش `/` ولا `,` جوّه الكتابة نفسها — كانوا هيكسروا الرابط.
    const custom = watermarkLayer({ ...DEFAULT_WATERMARK, text: 'منصة/الرحلة, 2026' })!;
    expect(custom.split('/').length).toBe(1);
  });
});

/**
 * ⚠️ **الشكل القديم كان بطاقة وحدها** — كتابة على خلفية مصمتة، وده
 *    ملصق فوق الصورة مش علامة مائية. الاختبارات دي على الفرق نفسه.
 */
describe('شكل العلامة ودرجة وضوحها', () => {
  it('«علامة مائية» = كتابة شفافة من غير خلفية ولا إطار', () => {
    const plain = watermarkLayer({ ...DEFAULT_WATERMARK, look: 'plain' })!;
    expect(plain).not.toContain('b_rgb');
    expect(plain).not.toContain('bo_');
    expect(plain).not.toContain('r_16');
    // ⚠️ الفاصلة قبل `o_` مش زينة: `Cairo_40_bold` فيها `o_40`،
    //    فـ`/o_\d+/` لوحدها بتمسك حجم الخط مش الشفافية — وده خلّى
    //    الاختبار ده يعدّي على الفاضي أول مرة.
    expect(plain).toMatch(/,o_\d+/);
  });

  it('«بطاقة» لسه موجودة بخلفيتها', () => {
    const badge = watermarkLayer({ ...DEFAULT_WATERMARK, look: 'badge' })!;
    expect(badge).toContain('b_rgb:ffffffcc');
    expect(badge).toContain('r_16');
  });

  it('كل ما الوضوح قلّ، الشفافية قلّت — والمائية أخفّ من البطاقة', () => {
    const num = (l: string) => Number(/,o_(\d+)/.exec(l)![1]);
    const soft = num(watermarkLayer({ ...DEFAULT_WATERMARK, opacity: 'soft' })!);
    const strong = num(watermarkLayer({ ...DEFAULT_WATERMARK, opacity: 'strong' })!);
    expect(soft).toBeLessThan(strong);

    const asPlain = num(watermarkLayer({ ...DEFAULT_WATERMARK, look: 'plain' })!);
    const asBadge = num(watermarkLayer({ ...DEFAULT_WATERMARK, look: 'badge' })!);
    expect(asPlain).toBeLessThan(asBadge);
  });

  /**
   * ⚠️ **ده اللي يمنع تغيير صور موقع شغّال في سكوت.** إعدادات اتحفظت
   *    قبل الخانة دي كانت بطاقة فعلًا؛ تحويلها لشفافة من غير ما حد
   *    يطلب بيغيّر كل الصور.
   */
  it('إعدادات قديمة محفوظة بتفضل بطاقة، والجديد بيبدأ مائية', () => {
    expect(normalizeWatermark({ style: 'light', size: 'medium' }).look).toBe('badge');
    expect(normalizeWatermark({}).look).toBe('plain');
  });
});
