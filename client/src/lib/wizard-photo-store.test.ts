import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PHOTO_TTL_HOURS, isFresh, photoKey } from './wizard-photo-store';

const H = 60 * 60 * 1000;

describe('isFresh', () => {
  const now = 1_700_000_000_000;

  it('الصورة الجديدة صالحة', () => {
    expect(isFresh(now, now)).toBe(true);
    expect(isFresh(now - 1 * H, now)).toBe(true);
    expect(isFresh(now - (PHOTO_TTL_HOURS - 1) * H, now)).toBe(true);
  });

  it('الأقدم من المدة مش صالحة', () => {
    expect(isFresh(now - (PHOTO_TTL_HOURS + 1) * H, now)).toBe(false);
  });

  it('الحد بالظبط لسه صالح', () => {
    expect(isFresh(now - PHOTO_TTL_HOURS * H, now)).toBe(true);
  });

  /**
   * ⚠️ وقت من المستقبل = ساعة الجهاز اتغيّرت. لو اعتبرناه صالحًا،
   *    صورة طفل ممكن تقعد في المتصفح لأجل غير مسمّى.
   */
  it('الوقت من المستقبل بيتعامل كقديم', () => {
    expect(isFresh(now + 1, now)).toBe(false);
  });

  it('القيم الباظة مش صالحة', () => {
    for (const v of [null, undefined, '', 'أمس', NaN, Infinity, {}]) {
      expect(isFresh(v, now), String(v)).toBe(false);
    }
  });
});

describe('photoKey', () => {
  it('المنتج والخانة — مفيش تصادم بين منتجين', () => {
    expect(photoKey('p1', 'facePhotoFile')).toBe('p1::facePhotoFile');
    expect(photoKey('p1', 'facePhotoFile')).not.toBe(photoKey('p2', 'facePhotoFile'));
    expect(photoKey('p1', 'facePhotoFile')).not.toBe(photoKey('p1', 'secondPhotoFile'));
  });
});

/**
 * ── القرار اللي لازم يفضل ───────────────────────────────────
 *
 * ⚠️ **الصورة مابترفعش قبل الطلب.** الحل الأسهل كان نرفعها أول ما
 *    تتختار ونحفظ رقمها كنص. ومرفوض: صور الأطفال في مجلّد خاص
 *    بنوع `authenticated`، ومهمة تنضيف الوسائط بتقرا `type:'upload'`
 *    وبس، ومهمة حذف صور الأطفال بتشتغل على المربوط بـ`order_items`.
 *
 *    فصورة اترفعت ومااتطلبتش مابتبقاش في أي خطة حذف — صورة طفل
 *    حقيقية تقعد في Cloudinary للأبد، وإحنا كاتبين في سياسة
 *    الخصوصية إنها بتتحذف.
 */
describe('الحارس: مفيش رفع بدري', () => {
  const read = (rel: string) =>
    readFileSync(new URL(rel, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('مخزن الصور مابيعرفش Cloudinary خالص', () => {
    const src = read('./wizard-photo-store.ts');
    expect(src).not.toMatch(/cloudinary|uploadPrivatePhoto/i);
    expect(src).toContain('indexedDB');
  });

  it('المعالج بيرفع عند التسجيل بس، مش عند اختيار الصورة', () => {
    const src = read('../components/enha-lak/PersonalizationWizard.tsx');
    // الرفع موجود مرة واحدة، جوّه مسار التسجيل.
    expect(src).toMatch(/uploadPrivatePhoto\(/);
    // والحفظ في المتصفح مش بيعدّي على Cloudinary.
    expect(src).toMatch(/savePhoto\(photoKey\(/);
  });

  it('الصور بتتشال من المتصفح بعد ما البند يدخل السلة', () => {
    const src = read('../components/enha-lak/PersonalizationWizard.tsx');
    const clears = src.match(/clearProductPhotos\(/g) ?? [];
    // مساري نجاح: الاشتراك، والبند العادي.
    expect(clears.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * ⚠️ الاسترجاع مابيكتبش فوق اختيار العميل: القراءة من `IndexedDB`
   *    غير متزامنة، وممكن تخلص بعد ما يكون اختار صورة جديدة.
   */
  it('الاسترجاع مابيدوسش على صورة اختارها العميل', () => {
    const src = read('../components/enha-lak/PersonalizationWizard.tsx');
    expect(src).toMatch(/if \(file && !methods\.getValues\(field\)\)/);
  });
});
