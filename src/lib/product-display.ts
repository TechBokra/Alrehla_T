import type { PersonalizedProduct } from '@/types';

/**
 * فلترة وترتيب منتجات المكتبة — **حساب نقي، بلا شاشة**.
 *
 * اتفصل عن `LibraryClient` عشان يتختبر: المكوّن بيستورد
 * `next/image` و`next/link`، فاختباره بيتحوّل لتجهيز بيئة متصفح
 * كاملة عشان تتأكّد إن الترتيب صح.
 */

export type ProductSort = 'newest' | 'price-asc' | 'price-desc' | 'name';

export const PRODUCT_SORTS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'name', label: 'الاسم (أ – ي)' },
  { value: 'price-asc', label: 'السعر: من الأقل للأعلى' },
  { value: 'price-desc', label: 'السعر: من الأعلى للأقل' },
];

/**
 * ترتيب المنتجات.
 *
 * ⚠️ **«الأحدث» كانت بترتّب بـ`id.localeCompare`.** رقم المنتج
 *    `uuid` عشوائي، يعني الترتيب كان **عشوائيًّا وثابتًا** — العميل
 *    يختار «الأحدث» ويشوف ترتيبًا مالوش علاقة بالتاريخ، وماحدّش
 *    يلاحظ لأن مفيش تاريخ معروض يكذّبه.
 *
 *    السبب إن `createdAt` مكانش بيتقرا من القاعدة أصلًا. بقى بيتقرا.
 *
 * ⚠️ **والمنتج بلا تاريخ بيروح لآخر القايمة** لا لأولها: الفاضي
 *    مش «أحدث حاجة».
 */
export function sortProducts(
  products: PersonalizedProduct[],
  sort: ProductSort,
): PersonalizedProduct[] {
  const result = [...products];

  if (sort === 'price-asc') return result.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') return result.sort((a, b) => b.price - a.price);
  if (sort === 'name') return result.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  return result.sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (at === bt) return a.name.localeCompare(b.name, 'ar');
    return bt - at;
  });
}

/**
 * فلترة بالبحث وبدار النشر.
 *
 * ⚠️ **البحث بيشمل الوصف مش الاسم بس.** العميل بيدوّر بكلمة فاكرها
 *    من القصة («ديناصور»)، مش باسمها الكامل. البحث في الاسم وحده
 *    بيرجّع صفر على بحث سليم، والصفر بيتقري «مش عندكم» لا «دوّر
 *    بطريقة تانية».
 */
export function filterProducts(
  products: PersonalizedProduct[],
  options: { query?: string; publisherId?: string },
): PersonalizedProduct[] {
  const query = options.query?.trim().toLowerCase() ?? '';
  const publisherId = options.publisherId && options.publisherId !== 'all'
    ? options.publisherId
    : null;

  return products.filter((p) => {
    if (publisherId && p.publisherId !== publisherId) return false;
    if (!query) return true;
    const haystack = `${p.name} ${p.shortDescription ?? ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

/**
 * جملة العدد اللي فوق الشبكة.
 *
 * ⚠️ **العدد مش زينة.** من غيره العميل اللي فلتر مايعرفش هو بيبصّ
 *    على الكل ولا على جزء، ومايعرفش إن الفلتر قصّ النتايج أصلًا.
 */
export function resultLabel(shown: number, total: number): string {
  if (total === 0) return '';
  if (shown === total) return shown === 1 ? 'كتاب واحد' : `${total} كتاب`;
  return `${shown} من ${total}`;
}

/** فيه فلتر شغّال دلوقتي؟ — بيفرّق بين «مفيش نتايج» و«مفيش منتجات». */
export function hasActiveFilter(options: { query?: string; publisherId?: string }): boolean {
  return Boolean(
    (options.query && options.query.trim()) ||
      (options.publisherId && options.publisherId !== 'all'),
  );
}
