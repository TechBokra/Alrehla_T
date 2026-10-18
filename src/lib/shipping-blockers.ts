import { itemNeedsShipping } from '@/lib/item-format';

/**
 * مين بالظبط اللي بيمنع الطلب لما الشحن يتقفل — وإيه الخروج.
 *
 * ── العطل اللي بيقفله ───────────────────────────────────────
 *
 * ⚠️ **رسالة «سيب النسخة الإلكترونية بس» كانت غلط، وكانت طريقًا
 *    مسدودًا.**
 *
 *    بلاغ تامر (١٨ أكتوبر): «عطّل الدفع مع إن المستخدم ماكتبش حاجة
 *    في الشحن». وهو محقّ — بس العطل مش في الحقل الفاضي:
 *
 *    ١. **الرسالة كانت بتقرا الشرط الغلط.** كانت بتقول «تقدر تسيب
 *       النسخة الإلكترونية» لو `cartHasElectronic` — والدالة دي
 *       بترجّع `true` للبند «مطبوعة + إلكترونية» كمان. والبند ده
 *       **لسه محتاج شحن**. فالعميل بيتقاله «سيب الإلكتروني» وهو
 *       مالوش بند إلكتروني خالص.
 *
 *    ٢. **ومافيش زرار.** حتى لو الكلام كان صح، مفيش طريقة يعملها
 *       من الشاشة دي. بنقول له اعمل حاجة ومش مديينه إزاي.
 *
 *    والنتيجة: زرار باهت، ورسالة بتوصف حلًا مش موجود، وعميل
 *    وصل لآخر خطوة ووقف.
 *
 * ⚠️ **والتحويل من «مطبوعة» لـ«إلكترونية» مش بيتعمل هنا عن قصد.**
 *    السعر الإلكتروني مش في بند السلة — بند السلة شايل سعر النوع
 *    اللي اتختار. تحويل في المتصفح معناه اختراع سعر، والقاعدة هي
 *    اللي بتسعّر (نفس قاعدة الملف ده كله). فالخروج إما تعديل البند
 *    من شاشته، أو حفظه لوقت تاني.
 */

export type BlockerReason = 'printed' | 'addons' | 'box';

export type ShippingBlocker = {
  id: string;
  name: string;
  reason: BlockerReason;
  /** اسم المنتج في الرابط — لزرار «عدّلها». مش موجود في السلال القديمة. */
  slug?: string;
};

type BlockerItem = {
  id: string;
  name: string;
  productSlug?: string;
  type?: string;
  format?: unknown;
  addonIds?: string[];
  boxPlanId?: string;
};

const REASON_LABELS: Record<BlockerReason, string> = {
  printed: 'نسخة مطبوعة — محتاجة شحن',
  addons: 'فيها إضافات بتتشحن',
  box: 'اشتراك الصندوق بيتشحن كل شهر',
};

export function blockerLabel(reason: BlockerReason): string {
  return REASON_LABELS[reason];
}

/** ليه البند ده محتاج شحن؟ `null` = مش محتاج. */
function reasonFor(item: BlockerItem): BlockerReason | null {
  if (!itemNeedsShipping(item)) return null;
  if (item.type === 'subscription' || item.boxPlanId) return 'box';
  // ⚠️ الترتيب مهم: البند الإلكتروني اللي اتقفل عشان إضافة لازم
  //    يتقاله «الإضافات» مش «مطبوعة» — وإلا بيدوّر على حاجة مش
  //    موجودة في بنده.
  if (item.format === 'electronic') return 'addons';
  return (item.addonIds?.length ?? 0) > 0 ? 'addons' : 'printed';
}

/** البنود اللي بتمنع الطلب لما الشحن مقفول. */
export function shippingBlockers(items: BlockerItem[]): ShippingBlocker[] {
  return items.flatMap((i) => {
    const reason = reasonFor(i);
    return reason ? [{ id: i.id, name: i.name, reason, slug: i.productSlug }] : [];
  });
}

/**
 * فيه بند واحد على الأقل **مش** محتاج شحن؟
 *
 * ⚠️ **ودي مش `cartHasElectronic`.** دي الفرق اللي كان بيخلّي
 *    الرسالة تكدب: «مطبوعة + إلكترونية» عندها نسخة إلكترونية
 *    وبرضه محتاجة شحن. السؤال الصح مش «فيه إلكتروني؟» — السؤال
 *    «هيفضل في السلة حاجة تتطلب لو شلنا اللي محتاج شحن؟».
 */
export function hasOrderableRemainder(items: BlockerItem[]): boolean {
  return items.some((i) => !itemNeedsShipping(i));
}
