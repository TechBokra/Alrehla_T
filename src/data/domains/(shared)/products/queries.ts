import { PersonalizedProduct } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { fetchAllPages } from '@/lib/fetch-all';
import { mapProductRow } from '@/data/domains/(shared)/products/products-internal';

export { productRedirectPath } from '@/lib/product-display';

/**
 * ترتيب الإدارة (ملف 06) فوق ترتيب «الأحدث».
 *
 * ⚠️ **بيتعمل هنا مش في الاستعلام** عن قصد: `.order('sort_order')` قبل ما
 *    ملف 06 يتشغّل كان هيرجّع خطأ «العمود مش موجود» — والصفحات العامة
 *    بتعتبر الخطأ «مفيش منتجات»، يعني المتجر كله يفضى. هنا العمود الغايب
 *    = صفر للكل = نفس الترتيب القديم.
 *
 *    والترتيب في JavaScript ثابت (stable)، فالمتساويين (كل المكتبة، أو
 *    الجديد اللي لسه ماترتّبش) بيفضلوا بالأحدث أولًا.
 */
export function byDisplayOrder(a: PersonalizedProduct, b: PersonalizedProduct): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}

/**
 * منتجات لوحات التحكم — **بجلسة الداخل، لا بصلاحية الزائر**.
 *
 * ═══════════════════════════════════════════════════════════
 * 🔴 ليه دالة منفصلة — عطل كان قاعد مستني
 * ═══════════════════════════════════════════════════════════
 *
 * شاشة «المنتجات» في الإدارة، و«منتجاتي» عند الناشر، وصفحة تعديل
 * الناشر كانوا بينادوا `getPersonalizedProducts({ includeInactive:
 * true })`. والدالة دي بتقرا **بعميل الزائر** (`createPublicClient` —
 * من غير كوكيز، عشان الصفحات العامة تتخزّن).
 *
 * ومن ملف 130، سياسة الزائر:
 *     USING ( review_status = 'approved' AND is_active )
 *
 * يعني `includeInactive` **بقت ما بتعملش حاجة** — الفلتر بيحصل في
 * القاعدة قبل ما الكود يطلب. والنتيجة:
 *
 *   • الإدارة توقف منتج ← **يختفي من شاشة المنتجات**، ومفيش مكان
 *     ترجّعه منه. وعمود «موقوف» في الجدول مستحيل يظهر.
 *   • الناشر يعدّل منتجه ← الحارس بيرجّعه «في الانتظار» ← **يختفي من
 *     «منتجاتي»**، وصفحة تعديله بتقول «غير موجود».
 *
 * كل ده **بلا أي خطأ** — مصيدة «ك» بالحرف. وتشخيص 131 قال إن صفر
 * منتجات متأثرة **لحد النهارده**: العطل كان مستني أول إيقاف.
 *
 * ⚠️ **وشاشة المراجعة كانت عارفة المصيدة دي** (`getPendingProducts`
 *    تحت بتقرا بالجلسة وبتشرح ليه). الإصلاح اتعمل في الشاشة الجديدة
 *    وما وصلش للقديمة — درس ٢٠ بشكل تاني.
 *
 * ── ومين بيشوف إيه ──────────────────────────────────────────
 *
 * السياسات هي اللي بتقرّر، لا الدالة: الإداري بيشوف كله (`is_admin()`)،
 * والناشر بيشوف بتاعه بأي حالة + المعتمد العام. والشاشة بتفلتر بالناشر
 * بعد كده — **الفلترة دي عرض، مش حماية**.
 */
export async function getManagedProducts(): Promise<PersonalizedProduct[]> {
  const supabase = await createClient();
  // على دفعات — Supabase بيقف عند ١٠٠٠ صف من غير رسالة (`lib/fetch-all`).
  const { data, error } = await fetchAllPages((from, to) =>
    supabase
      .from('personalized_products')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  );

  if (error) {
    // ⚠️ بيترمي ولا بيرجّع فاضي: الفاضي هنا بيتقري «مفيش منتجات»،
    //    والإداري يفتكر إن الكتالوج اتمسح. الشاشة بتعرض صفحة الخطأ.
    console.error('تعذّر قراءة منتجات اللوحة', error);
    throw new Error('تعذّر تحميل المنتجات');
  }
  return data.map(mapProductRow);
}

/**
 * أسماء منتجات بعينها — **حتى لو اتخفت** (4.4 في اختبار الإدارة).
 *
 * ⚠️ قواعد الحماية بتخلّي العميل يقرا المنتجات المعروضة بس، فالمنتج اللي
 *    اتخفى كان بيظهر في «طلباتي» «منتج لم يعد معروضًا» — والعميل مش فاهم
 *    هو طلب إيه. بعميل الإدارة، **الاسم بس**، ولأرقام جاية من طلبات العميل
 *    نفسه (الصفحة بتبعتها).
 */
export async function getProductNamesFor(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return {};
  const { createAdminClient, isAdminApiConfigured } = await import('@/lib/supabase/admin');
  if (!isAdminApiConfigured()) return {};
  const { data } = await createAdminClient()
    .from('personalized_products')
    .select('id, name')
    .in('id', unique.slice(0, 200));
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.name]));
}
