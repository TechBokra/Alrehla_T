import type { readPaymentSettingsForAdmin } from '@/actions/payments';

/**
 * ⚠️ **مشتقّ من الأكشن نفسه، مش مكتوب بالإيد.** لو شكل الإرجاع اتغيّر،
 *    المترجم بيمسك الفرق هنا بدل ما الشاشة تقرا حقلًا مش موجود.
 */
export type PaymentSettingsPayload = Awaited<ReturnType<typeof readPaymentSettingsForAdmin>>;
