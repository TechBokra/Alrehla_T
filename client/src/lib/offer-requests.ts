/**
 * «طلب تقديم خدمة» = عرض في `provider_services` مستني قرار من الإدارة.
 *
 * نوعين:
 *  - جديد: الحالة `pending`.
 *  - تعديل سعر: العرض معتمد، والمقدّم طلب رقم غير المعتمد.
 *
 * التعريف ده في مكان واحد عشان العدّاد في الرئيسية وصفحة الطلبات
 * مايختلفوش على مين «مستني».
 */
export type OfferLike = {
  status: string | null;
  requested_price: number | null;
  approved_price: number | null;
};

export type OfferRequestKind = 'new' | 'price_change';

export function offerRequestKind(o: OfferLike): OfferRequestKind | null {
  if ((o.status ?? 'pending') === 'pending') return 'new';
  if (o.status === 'approved' && o.requested_price != null && o.requested_price !== o.approved_price) {
    return 'price_change';
  }
  return null;
}

/** نفس الفلتر على مستوى القاعدة — بيجيب المرشّحين، و`offerRequestKind` يحسم. */
export const OFFER_REQUEST_FILTER = 'status.eq.pending,and(status.eq.approved,requested_price.not.is.null)';
