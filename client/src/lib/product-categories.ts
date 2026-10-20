import type { ProductCategory } from '@/types';

/**
 * تصنيفات منتجات «إنها لك» — مصدر واحد.
 *
 * ── العطل اللي بيقفله الملف ده ──────────────────────────────
 *
 * ⚠️ **المنتج كان بيتقسّم بحقلين مستقلين، وكل شاشة بتسأل حقلًا
 *    مختلفًا:**
 *
 *      شاشة «أنت البطل»      →  `category = 'custom'`
 *      شاشة «المكتبة»        →  `category = 'library'`
 *      صفحة المنتج           →  `owner_type` **الأول**
 *      معالج القصة الكاملة   →  بيرفض أي حاجة `owner_type <> 'platform'`
 *      معالج تخصيص الغلاف    →  بيرفض أي حاجة `category <> 'library'`
 *
 *    والنتيجة اتنين:
 *
 *    **①** منتج للمنصة تصنيفه «مكتبة» ليه **طريقان**: زرار الكارت
 *    بيوديه لتخصيص الغلاف، وزرار صفحته بيقول «ابدأ التخصيص» ويوديه
 *    لمعالج القصة الكاملة — لأن الصفحة بتسأل المالك الأول. نفس
 *    المنتج، نفس السعر، وشغل مختلف حسب الزرار.
 *    (التشخيص لقى **اتنين** كده فعلًا.)
 *
 *    **②** منتج لناشر تصنيفه «مخصص» طريقه **مسدود**: بيظهر في «أنت
 *    البطل»، والمعالج بيرفضه لأنه مش `platform`.
 *
 * ── القاعدة بعد الإصلاح ─────────────────────────────────────
 *
 *      **التصنيف** يقرّر **المسار** — إيه اللي العميل هياخده.
 *      **المالك**  يقرّر **الفلوس** — مين بياخد نصيبه.
 *
 * حقل واحد لكل قرار، ومفيش تنافس بينهم.
 *
 * ⚠️ **والقيم دي هي اللي القاعدة بتقبلها بالظبط** — النوع المعرَّف
 *    `product_category` فيه تلاتة وبس (اتأكدنا من القاعدة في ملف 98،
 *    مش من ملفات المشروع). النماذج كانت بتعرض «كتاب» و«لعبة» و«ملحق»
 *    كمان — **وتلاتتهم بيترفضوا عند الحفظ**، وشاشة الناشر كانت بتعرض
 *    تلاتة غير صالحين من أربعة.
 */

export const PRODUCT_CATEGORIES = ['library', 'custom', 'subscription'] as const;

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  library: 'المكتبة — تخصيص الغلاف',
  custom: 'قصة مخصصة من الصفر',
  subscription: 'اشتراك',
};

/** الاسم القصير للجداول والقوايم. */
export const PRODUCT_CATEGORY_SHORT: Record<ProductCategory, string> = {
  library: 'مكتبة',
  custom: 'مخصص',
  subscription: 'اشتراك',
};

export function productCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'غير محدَّد';
  return PRODUCT_CATEGORY_SHORT[category as ProductCategory] ?? category;
}

export function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === 'string' && (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * التصنيفات اللي بتتعرض في نماذج الإضافة.
 *
 * ⚠️ **«اشتراك» مش هنا عن قصد.** شاشة الاشتراك بتقرا من جدول تاني
 *    خالص (`box_subscription_plans`) — فمنتج بتصنيف «اشتراك»
 *    **مفيش ولا شاشة واحدة بتعرضه**، يتحفظ ويختفي. القاعدة لسه
 *    بتقبل القيمة (فالصفوف القديمة ما بتتكسرش)، بس مفيش سبب نعرض
 *    للإدارة بابًا بيودّي لحتة فاضية.
 */
export const ASSIGNABLE_PRODUCT_CATEGORIES: ProductCategory[] = ['library', 'custom'];

/**
 * التصنيفات المتاحة للناشر.
 *
 * ⚠️ **«مخصص» مش للناشر.** القصة المخصصة بتتكتب من الصفر في المنصة
 *    بعد الطلب — مش إصدارًا جاهزًا عند ناشر. ولو الناشر قدر يختارها،
 *    المنتج بيظهر في «أنت البطل هنا» ومعالجه بيرفضه: **الحالة
 *    المسدودة ②**. منعها هنا بيقفل الباب من أوله بدل ما نمسكها بعدين.
 */
export const PUBLISHER_PRODUCT_CATEGORIES: ProductCategory[] = ['library'];

/**
 * المسار اللي العميل بياخده حسب التصنيف.
 *
 * ⚠️ **ده بديل عن `owner_type` في قرار المسار.** مين بياخد فلوس حاجة
 *    تانية خالص وبتتقرّر من `owner_type` و`publisher_cost`.
 */
export function customizationPath(
  category: string | null | undefined,
  slug: string,
): { href: string; label: string } | null {
  if (category === 'custom') {
    return { href: `/enha-lak/custom/${slug}`, label: 'ابدأ التخصيص' };
  }
  if (category === 'library') {
    return {
      href: `/enha-lak/custom-library/${slug}`,
      label: 'تخصيص الغلاف وإضافة للسلة',
    };
  }
  // «اشتراك» مالوش معالج منتج — شاشة الاشتراك ليها مسارها الخاص.
  return null;
}
