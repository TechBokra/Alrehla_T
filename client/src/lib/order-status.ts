import type { StatusBadgeType } from '@/components/StatusBadge';

/**
 * حالات الطلبات — **مصدر واحد للاسم واللون**.
 *
 * ── إيه اللي كان موجود ──────────────────────────────────────
 *
 * تلات أماكن، وكل واحد بيقول حاجة:
 *
 *   صفحة الطلب        : `ORDER_STATUS_LABEL` — أسماء بلا ألوان
 *   طلبات الخدمات     : `ORDER_STATUS` — أسماء وألوان
 *   تفاصيل المستخدم   : `{o.status}` — **القيمة الخام من القاعدة**
 *
 * ⚠️ والتالتة عطل مش تفاوت: الإداري بيشوف «awaiting_verification»
 *    إنجليزي في شاشة عربية.
 *
 * ── وطلب المنتج غير طلب الخدمة ──────────────────────────────
 *
 * ⚠️ **مش خريطة واحدة لأن الحالات مختلفة فعلًا**: طلب المنتج فيه
 *    `preparing` و`shipped` (شحن حقيقي)، وطلب الخدمة فيه
 *    `in_progress` و`completed`. دمجهم في خريطة واحدة كان هيخلّي
 *    كل شاشة تعرض حالات مالهاش معنى عندها.
 *
 * ── وتصحيح في الألوان ───────────────────────────────────────
 *
 * ⚠️ `in_progress` و`delivered` كانوا `warning`. **التحذير معناه
 *    «فيه حاجة غلط، بُصّ»** — وطلب جاري تنفيذه أو اتسلّم مافيهوش
 *    حاجة غلط. بقوا `info` (معلومة: المسار ماشي).
 *
 *    الفرق مش شكلي: لما التقدّم الطبيعي بلون التحذير، الإداري
 *    بيتعلّم يتجاهل البرتقالي — **وساعتها بيتجاهل الطلب اللي فيه
 *    مشكلة حقيقية**.
 */

type View = { label: string; type: StatusBadgeType };

/** طلب منتج (شحن حقيقي). */
export const PRODUCT_ORDER_STATUS: Record<string, View> = {
  pending: { label: 'بانتظار الدفع', type: 'pending' },
  awaiting_verification: { label: 'بانتظار تأكيد الدفع', type: 'pending' },
  paid: { label: 'تم الدفع', type: 'success' },
  preparing: { label: 'قيد التجهيز', type: 'info' },
  shipped: { label: 'تم الشحن', type: 'info' },
  delivered: { label: 'تم التسليم', type: 'success' },
  cancelled: { label: 'ملغي', type: 'neutral' },
  refunded: { label: 'مسترجع', type: 'neutral' },
  // ⚠️ **دي الوحيدة اللي `danger` بجد**: الدفع فشل، وفيه عميل
  //    مستني حاجة مش جاية.
  failed: { label: 'فشل الدفع', type: 'danger' },
};

/** طلب خدمة (تنفيذ، مافيش شحن). */
export const SERVICE_ORDER_STATUS: Record<string, View> = {
  pending: { label: 'بانتظار الدفع', type: 'pending' },
  awaiting_verification: { label: 'بانتظار تأكيد الدفع', type: 'pending' },
  paid: { label: 'مدفوع', type: 'success' },
  in_progress: { label: 'جاري التنفيذ', type: 'info' },
  delivered: { label: 'تم التسليم', type: 'info' },
  completed: { label: 'مكتمل', type: 'success' },
  refunded: { label: 'مسترجع', type: 'neutral' },
  cancelled: { label: 'ملغي', type: 'neutral' },
};

/**
 * ⚠️ **الفرع الاحتياطي بيعرض القيمة الخام** بدل ما يخترع اسمًا.
 *    لو القاعدة فيها حالة إحنا مانعرفهاش، اللي بيشوف الشاشة لازم
 *    يشوف إن فيه حاجة غريبة — لا اسمًا مطمئنًا غلط.
 */
export function productOrderStatus(status: string): View {
  return PRODUCT_ORDER_STATUS[status] ?? { label: status, type: 'neutral' };
}

export function serviceOrderStatus(status: string): View {
  return SERVICE_ORDER_STATUS[status] ?? { label: status, type: 'neutral' };
}
