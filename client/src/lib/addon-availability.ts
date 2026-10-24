import type { ItemFormat } from '@/lib/item-format';

/**
 * أنهي إضافة تظهر مع أنهي نسخة — قرار تامر (٢٤ أكتوبر).
 *
 * «لما العميل يختار طلب إلكتروني يظهر له **فقط** الإضافات المتاحة
 *  إلكترونيًا، أو لو مفيش توصيل لمنطقته».
 *
 * ── القاعدة ──────────────────────────────────────────────────
 *
 *   نوع الإضافة (من لوحة التحكم ← الإضافات):
 *     printed     مطبوعة بس — بتتشحن
 *     electronic  إلكترونية بس — على الإيميل
 *     both        الاتنين
 *
 *   • النسخة **الإلكترونية**: الإضافات الإلكترونية و«الاتنين» بس.
 *     و«الاتنين» هنا **بتوصل إلكترونية بس** — الطلب كله من غير شحن.
 *   • النسخة **المطبوعة** أو **الاتنين**: كل الإضافات.
 *   • **مفيش توصيل لمنطقته** (أو التوصيل متوقف): البند مايتشحنش، فالنسخة
 *     لازم تبقى إلكترونية — وبالتالي نفس قاعدة الإلكتروني.
 *
 * ⚠️ قبل كده النسخة الإلكترونية كانت بتقبل بوستر مطبوع، والبند يتحوّل
 *    لـ«محتاج شحن» من غير ما العميل ياخد باله. ده اتقفل هنا وفي القاعدة
 *    (`guard_order_item_addons` — ترحيل ٢٤ أكتوبر).
 */

export type AddonFormat = 'printed' | 'electronic' | 'both';

export function addonFormatOf(addon: { deliveryFormat?: string | null }): AddonFormat {
  return addon.deliveryFormat === 'electronic' || addon.deliveryFormat === 'both'
    ? addon.deliveryFormat
    : 'printed';
}

/** الإضافة دي متاحة مع النسخة دي؟ */
export function addonAllowedWith(addon: { deliveryFormat?: string | null }, format: ItemFormat): boolean {
  if (format !== 'electronic') return true;
  return addonFormatOf(addon) !== 'printed';
}

/** الإضافة هتوصل إزاي مع النسخة دي؟ */
export function addonDeliveredAs(
  addon: { deliveryFormat?: string | null },
  format: ItemFormat,
): AddonFormat {
  const own = addonFormatOf(addon);
  return format === 'electronic' && own === 'both' ? 'electronic' : own;
}

/** الإضافات المسموحة بس من المختار — لما العميل يغيّر النسخة. */
export function keepAllowedAddons<T extends { id: string; deliveryFormat?: string | null }>(
  addons: T[],
  selectedIds: string[],
  format: ItemFormat,
): string[] {
  return selectedIds.filter((id) => {
    const addon = addons.find((a) => a.id === id);
    return addon ? addonAllowedWith(addon, format) : false;
  });
}

export const ADDON_DELIVERY_TEXT: Record<AddonFormat, string> = {
  printed: 'بتتشحن لعنوانك',
  electronic: 'بتوصلك على الإيميل',
  both: 'بتتشحن لعنوانك ومعاها نسخة على الإيميل',
};
