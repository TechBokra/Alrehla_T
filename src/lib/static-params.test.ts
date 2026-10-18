import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `generateStaticParams` على صفحات المسار المتغيّر العامة.
 *
 * ── الحكاية ─────────────────────────────────────────────────
 *
 * صفحة بمسار متغيّر (`[id]`) **مابتتخزّنش أبدًا** من غير
 * `generateStaticParams` — ولا بتدّي أي خطأ، بس كل زيارة بتتبني من
 * الأول. مقيس على الموقع المنشور بثلاث نقاط:
 *
 *     /blog/[slug]              عنده  → MISS ثم HIT (٨٢ مللي)
 *     /enha-lak/product/[slug]  عنده  → MISS ثم HIT (٧٣ مللي)
 *     /creative-writing/services/[serviceId]  ماكانش عنده → MISS
 *                                             دايمًا (٩٦١ مللي)
 *
 * ── والنص التاني من الاختبار أهم ────────────────────────────
 *
 * ⚠️ صفحة بتعرض حاجة **خاصة بمستخدم** ماينفعش تتخزّن أبدًا —
 *    التخزين بيخلّي أول زائر يحدّد اللي الباقي هيشوفه. وصفحتا
 *    التخصيص بيقروا خصم المشترك (`getMyAddonDiscount`)، فتخزينهم
 *    معناه **خصم عميل بيبان لعميل تاني**.
 *
 *    فالاختبار بيمنع `generateStaticParams` عليهم — لا يضيفها حد
 *    بحسن نية وهو بيحسّن السرعة.
 */

const read = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
const has = (src: string) => /export\s+(async\s+)?function\s+generateStaticParams/.test(src);

/**
 * صفحات عامة بالكامل ومقيسة إنها بتتخزّن فعلًا.
 *
 * ⚠️ **ماتزوّدش هنا من غير قياس.** اقرا القسم اللي تحت.
 */
const SHOULD_CACHE = [
  'app/(client)/creative-writing/services/[serviceId]/page.tsx',
  'app/(client)/creative-writing/packages/[slug]/page.tsx',
  'app/(client)/blog/[slug]/page.tsx',
  'app/(client)/enha-lak/product/[slug]/page.tsx',
];

/**
 * صفحات **ممنوع** يتحط عليها `generateStaticParams`.
 *
 * ⚠️ **الصفحتين الأولانيين منع بسبب الخصوصية**: بيقروا خصم
 *    المشترك، فالتخزين بيعرض خصم عميل لعميل تاني.
 *
 * ⚠️ **والباقي منع بسبب عطل حقيقي حصل في الإنتاج.** حطّيت
 *    `generateStaticParams` على ملف المدرب وهو بيقرا الكوكيز
 *    (`getReviewsForInstructor` بتستعمل عميل الخادم)، فالصفحة
 *    **رجّعت 500 للزوّار** لحد ما اترجّعت. الصفحة اللي بتقرا
 *    الكوكيز ماينفعش تتبني مقدّمًا — Next بيرمي، والصفحة بتقع.
 */
const MUST_NOT_CACHE = [
  'app/(client)/enha-lak/custom/[productSlug]/page.tsx',
  'app/(client)/enha-lak/custom-library/[productSlug]/page.tsx',
  'app/(client)/creative-writing/instructors/[id]/page.tsx',
  'app/(aqlam)/aqlam/p/[id]/page.tsx',
  'app/(aqlam)/aqlam/w/[slug]/page.tsx',
  'app/(client)/enha-lak/custom-subscription/[tierId]/page.tsx',
];

describe('الصفحات العامة بتتخزّن', () => {
  for (const page of SHOULD_CACHE) {
    it(`${page} — عندها generateStaticParams`, () => {
      expect(has(read(page)), 'من غيرها الصفحة بتتبني لكل زيارة').toBe(true);
    });
  }
});

describe('الصفحات اللي ممنوع تتخزّن', () => {
  for (const page of MUST_NOT_CACHE) {
    it(`${page} — مفيش generateStaticParams`, () => {
      expect(
        has(read(page)),
        'الصفحة بتقرا كوكيز أو بتعرض حاجة خاصة بمستخدم — التخزين ' +
          'بيطلّعها 500 أو بيسرّب بيانات. حصل فعلًا في الإنتاج.',
      ).toBe(false);
    });
  }
});

/**
 * الدرس المكتوب: **الدالة دي مش مجانية.**
 *
 * فكّرت إنها «مابتأذيش» — إن الصفحة اللي بتقرا الكوكيز هتفضل
 * بتتبني لكل زيارة وخلاص. ده كان **غلط**: Next بيحاول يبنيها
 * مقدّمًا، وقراءة الكوكيز بترمي، والزائر بيشوف صفحة عطل.
 *
 * القاعدة: ماتحطّهاش غير بعد ما تتأكد إن الصفحة وكل استعلاماتها
 * **مابتقراش كوكيز** — وبعد النشر قيس الصفحة فعلًا.
 */
describe('القاعدة مكتوبة', () => {
  it('الدرس موثّق في الملف ده', () => {
    const self = readFileSync(join(process.cwd(), 'src/lib/static-params.test.ts'), 'utf8');
    expect(self).toContain('500');
  });
});
