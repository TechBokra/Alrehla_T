/**
 * نوع النسخة: مطبوعة · إلكترونية · الاتنين (ملف 138).
 *
 * ⚠️ **الحساب الحقيقي في `create_customer_order`** — الدوال هنا للعرض
 *    وبنفس قواعد القاعدة بالظبط، عشان الرقم اللي العميل بيشوفه هو اللي
 *    بيدفعه:
 *      • الإلكتروني لـ«أنت البطل هنا» (`custom`) اللي ليها سعر إلكتروني
 *      • الإلكتروني والاتنين = **كمية واحدة** (ملف واحد مالوش نسختين)
 *      • الشحن لو فيه مطبوع **أو إضافة** (قرار تامر)
 */

export type ItemFormat = 'printed' | 'electronic' | 'both';

export const ITEM_FORMATS: ItemFormat[] = ['printed', 'electronic', 'both'];

export const FORMAT_LABELS: Record<ItemFormat, string> = {
  printed: 'نسخة مطبوعة',
  electronic: 'نسخة إلكترونية',
  both: 'مطبوعة + إلكترونية',
};

export function isItemFormat(v: unknown): v is ItemFormat {
  return typeof v === 'string' && (ITEM_FORMATS as string[]).includes(v);
}

/** المنتج ليه نسخة إلكترونية؟ نفس شرط القاعدة. */
export function electronicAvailable(product: { category?: string; electronicPrice?: number | null }): boolean {
  return product.category === 'custom' && (product.electronicPrice ?? 0) > 0;
}

/** سعر القصة نفسها (من غير الإضافات) حسب النوع. */
export function basePriceForFormat(
  product: { price: number; electronicPrice?: number | null },
  format: ItemFormat,
): number {
  const e = product.electronicPrice ?? 0;
  if (format === 'electronic') return e;
  if (format === 'both') return product.price + e;
  return product.price;
}

/** الكمية مقفولة على ١ — الإلكتروني ملف واحد. */
export function isQuantityLocked(format: unknown): boolean {
  return format === 'electronic' || format === 'both';
}

type CartLike = { type?: string; format?: unknown; addonIds?: string[] };

export function itemNeedsShipping(item: CartLike): boolean {
  if (item.type === 'subscription') return false;
  return item.format !== 'electronic' || (item.addonIds?.length ?? 0) > 0;
}

export function cartNeedsShipping(items: CartLike[]): boolean {
  return items.some(itemNeedsShipping);
}

export function cartHasElectronic(items: CartLike[]): boolean {
  return items.some((i) => isQuantityLocked(i.format));
}

/** نفس فحص القاعدة — عشان الرسالة تطلع قبل ما الطلب يتبعت. */
export function isValidDeliveryEmail(v: string): boolean {
  const s = v.trim();
  return s.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

/**
 * إجمالي الإضافات المختارة — **للعرض**، بنفس حساب القاعدة (السعر +
 * فرق التخصيص للمخصّصة بس).
 *
 * ⚠️ السلة كانت بتاخد سعر القصة **من غير الإضافات**: العميل يختار
 *    ميدالية بـ١٢٠، والسلة والدفع يعرضوا سعر القصة لوحدها — والطلب
 *    في القاعدة بالإضافة. ورقم «حوّل كذا» كان طالع من السلة.
 */
export function addonsDisplayTotal(
  addons: { id: string; price: number; customizationPrice?: number }[],
  selectedIds: string[] = [],
  customizedIds: string[] = [],
): number {
  return addons
    .filter((a) => selectedIds.includes(a.id))
    .reduce(
      (sum, a) => sum + a.price + (customizedIds.includes(a.id) ? (a.customizationPrice ?? 0) : 0),
      0,
    );
}
