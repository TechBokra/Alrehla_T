import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * فحص «الطفل التابع» مكانه صفحات الطلب، لا صفحات العرض.
 *
 * ── الحكاية ─────────────────────────────────────────────────
 *
 * الفحص كان في صفحات العرض (الخدمة، الباقات، تفاصيل الباقة). وعشان
 * يعرف لو الزائر طفل تابع، الصفحة لازم تقرا المستخدم — وأي صفحة
 * بتقرا المستخدم **بتتبني لكل زيارة**.
 *
 * بالقياس على الموقع المنشور:
 *
 *     صفحة بتتبني لكل زيارة : ٥٦٠–٩٠٥ مللي
 *     صفحة متخزّنة          : ٨٥–١٣٥ مللي
 *
 * يعني فحص بيخص أقلية كان بيكلّف **كل** زائر سبعة أضعاف الزمن على
 * أهم صفحتين بيع في الموقع.
 *
 * ── الحارس ده بيحمي حاجتين مع بعض ───────────────────────────
 *
 *   ١. **السرعة**: لو حد رجّع قراءة المستخدم لصفحة عرض، الصفحة
 *      بتخرج من التخزين **في سكوت** — مفيش خطأ، بس الموقع يبطّأ.
 *
 *   ٢. **الأهم — حماية الطفل**: التعليق الأصلي في `PackageCard`
 *      بيقول إن الطفل كان بيكمّل المعالج لآخر خطوة وياخد منع، «طريق
 *      مسدود بعد شغل». لو الفحص اتشال من صفحة الطلب، الطفل يرجع
 *      للطريق المسدود — أو أسوأ، لو الحارس في الأكشن اتغيّر كمان.
 *
 * فالاختبار بيفشل في الحالتين.
 */

const read = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

/** صفحات بتتخزّن: ماينفعش تقرا المستخدم ولا الرابط على الخادم. */
const CACHEABLE_PAGES = [
  'app/(client)/creative-writing/services/[serviceId]/page.tsx',
  'app/(client)/creative-writing/packages/page.tsx',
  'app/(client)/creative-writing/packages/[slug]/page.tsx',
];

/** صفحات بتتبني لكل زيارة أصلًا: **لازم** يكون فيها الفحص. */
const GUARDED_ACTION_PAGES = [
  'app/(client)/creative-writing/services/[serviceId]/order/page.tsx',
  'app/(client)/creative-writing/booking/page.tsx',
];

/** الكود من غير التعليقات — التعليقات بتشرح الأسماء دي بالحرف. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

describe('صفحات العرض بتفضل متخزّنة', () => {
  it('شيل التعليقات بيشتغل (الحارس بيتأكد من نفسه)', () => {
    expect(codeOnly('/* getCurrentUser في الشرح */ const a = 1;')).not.toContain('getCurrentUser');
    expect(codeOnly('// force-dynamic في الشرح\nconst a = 1;')).not.toContain('force-dynamic');
  });

  for (const page of CACHEABLE_PAGES) {
    it(`${page} — مابتقراش المستخدم ولا الرابط`, () => {
      const src = codeOnly(read(page));
      expect(src, 'بتقرا المستخدم ← بتخرج من التخزين').not.toContain('getCurrentUser');
      expect(src, 'بتقرا ولي الأمر ← بتخرج من التخزين').not.toContain('getDependentGuardian');
      expect(src, 'بتقرا الرابط على الخادم ← بتخرج من التخزين').not.toContain('searchParams');
      expect(src, 'force-dynamic = مفيش تخزين').not.toContain("dynamic = 'force-dynamic'");
    });
  }
});

describe('صفحات الطلب فيها حارس الطفل التابع', () => {
  for (const page of GUARDED_ACTION_PAGES) {
    it(`${page} — بتفحص وبتعرض بديلًا`, () => {
      const src = codeOnly(read(page));
      /**
       * ⚠️ **بندوّر على النداء `getDependentGuardian(`، لا على الاسم.**
       *
       *    أول نسخة من الحارس ده كانت بتدوّر على الاسم بس — وجرّبتها
       *    بإني شِلت النداء الحقيقي، **والاختبار عدّى**، لأن الاسم
       *    فاضل في سطر الاستيراد. حارس بيقيس وجود الاسم مش استعماله
       *    بيطمّن بالباطل.
       */
      expect(src, 'الفحص مش متنادى — الطفل هيكمّل الطلب').toMatch(
        /getDependentGuardian\s*\(/,
      );
      // ولازم يعرض البديل، مش يفحص وبس.
      expect(src, 'بيفحص بلا بديل معروض').toMatch(/<DependentRequestButton/);
    });
  }
});
