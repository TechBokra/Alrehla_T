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

/** صفحات عامة بالكامل — لازم تتخزّن. */
const SHOULD_CACHE = [
  'app/(client)/creative-writing/services/[serviceId]/page.tsx',
  'app/(client)/creative-writing/packages/[slug]/page.tsx',
  'app/(client)/creative-writing/instructors/[id]/page.tsx',
  'app/(aqlam)/aqlam/p/[id]/page.tsx',
  'app/(aqlam)/aqlam/w/[slug]/page.tsx',
  'app/(client)/blog/[slug]/page.tsx',
  'app/(client)/enha-lak/product/[slug]/page.tsx',
];

/** صفحات بتعرض حاجة خاصة بمستخدم — **ممنوع** تتخزّن. */
const MUST_NOT_CACHE = [
  'app/(client)/enha-lak/custom/[productSlug]/page.tsx',
  'app/(client)/enha-lak/custom-library/[productSlug]/page.tsx',
];

describe('الصفحات العامة بتتخزّن', () => {
  for (const page of SHOULD_CACHE) {
    it(`${page} — عندها generateStaticParams`, () => {
      expect(has(read(page)), 'من غيرها الصفحة بتتبني لكل زيارة').toBe(true);
    });
  }
});

describe('صفحات المستخدم مابتتخزّنش', () => {
  for (const page of MUST_NOT_CACHE) {
    it(`${page} — مفيش generateStaticParams، والسبب موجود`, () => {
      const src = read(page);
      expect(
        has(src),
        'الصفحة بتعرض خصم المشترك — تخزينها بيعرضه لعميل تاني',
      ).toBe(false);
      // ولازم السبب يفضل مكتوب في الصفحة، عشان الاختبار ده يبان مفهومًا.
      expect(src, 'الخصم الخاص بالمستخدم اتشال؟ راجع قرار التخزين').toContain(
        'getMyAddonDiscount',
      );
    });
  }
});
