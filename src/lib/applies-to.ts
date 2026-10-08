/**
 * «يظهر فين» — لأهداف التخصيص وخاناته (ملف 12).
 *
 *   `null`            = كل المنتجات + صندوق الرحلة
 *   `['<id>', 'box']` = المنتجات دي بس، و`'box'` = اشتراك صندوق الرحلة
 *
 * ⚠️ من غير React ولا قاعدة — نفس القاعدة في الشاشة واللوحة، وتتختبر.
 */

export type AppliesTo = string[] | null;

/** الكلمة اللي بتمثّل اشتراك صندوق الرحلة جوّه القايمة. */
export const BOX_TARGET = 'box';

/** المكان اللي العميل فيه: منتج بعينه، أو الصندوق. */
export type AppliesToTarget = { productId?: string; box?: boolean };

export function isVisibleFor(appliesTo: AppliesTo | undefined, target: AppliesToTarget): boolean {
  // فاضي = للكل. والمصفوفة الفاضية زيه (القاعدة بتحوّلها NULL أصلًا).
  if (!appliesTo || appliesTo.length === 0) return true;
  if (target.box) return appliesTo.includes(BOX_TARGET);
  if (target.productId) return appliesTo.includes(target.productId);
  // مكان مش معروف — نخفي المخصّص بدل ما يظهر في منتج مش بتاعه.
  return false;
}

/**
 * تنضيف القيمة قبل الحفظ: نصوص بس، من غير تكرار، والفاضي = `null`.
 * (فحص إن المنتجات موجودة فعلًا شغل القاعدة.)
 */
export function normalizeAppliesTo(raw: unknown): AppliesTo {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const id = v.trim();
    if (id && !out.includes(id)) out.push(id);
  }
  return out.length ? out.slice(0, 100) : null;
}

/** قراءة العمود من القاعدة — قبل ملف 12 مش موجود، فيبقى «للكل». */
export function readAppliesTo(raw: unknown): AppliesTo {
  return normalizeAppliesTo(raw);
}

/**
 * الخطأ ده معناه «ملف 12 لسه ماتشغّلش» (جدول أو عمود مش موجود)؟
 *
 * ⚠️ الكود ممكن يتنشر قبل ما الملف يتشغّل — فالقراءة لازم تفرّق بين
 *    «مش موجود لسه» (نرجع للقديم) و«القاعدة وقعت» (نقول).
 *    42P01/42703 من Postgres، وPGRST205/PGRST204 من PostgREST.
 */
export function isMissingSchemaError(error: { code?: string | null } | null | undefined): boolean {
  if (!error?.code) return false;
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code);
}

/** منتج في قايمة «يظهر فين» — اللي بيتخصص بس (مخصص أو مكتبة). */
export type AppliesToProduct = { id: string; name: string; category: string };

/** المنتجات اللي ليها خطوة تخصيص — الاشتراك ليه اختيار «الصندوق» لوحده. */
export function appliesToProducts<T extends AppliesToProduct>(products: T[]): AppliesToProduct[] {
  return products
    .filter((p) => p.category === 'custom' || p.category === 'library')
    .map((p) => ({ id: p.id, name: p.name, category: p.category }));
}

/** سطر قصير في اللوحة: «بيظهر في: كل المنتجات» / «… ٣ منتجات». */
export function appliesToSummary(appliesTo: AppliesTo): string {
  if (!appliesTo || appliesTo.length === 0) return 'بيظهر في: كل المنتجات';
  const products = appliesTo.filter((x) => x !== BOX_TARGET).length;
  const box = appliesTo.includes(BOX_TARGET);
  const parts: string[] = [];
  if (products === 1) parts.push('منتج واحد');
  else if (products === 2) parts.push('منتجين');
  else if (products > 2) parts.push(`${products.toLocaleString('ar-EG')} ${products <= 10 ? 'منتجات' : 'منتج'}`);
  if (box) parts.push('صندوق الرحلة');
  return `بيظهر في: ${parts.join(' و')}`;
}
