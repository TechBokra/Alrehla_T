/**
 * حالة الدفع زي ما الإدارة والعميل المفروض يشوفوها — من مكان واحد.
 *
 * ⚠️ ميراث «التحويل + الإيصال»: الشاشات كانت بتفترض إن كل دفع ليه إيصال،
 *    فطلب مدفوع بالفيزا عن طريق XPay كان مكتوب عليه «لسه ما اترفعش إيصال
 *    — الطلب لسه بانتظار دفع العميل» (ALR-000069-RF، ١ نوفمبر). الدفع
 *    بالبوابة **مالوش إيصال** — تأكيده جاي من البوابة نفسها.
 */

/** وسايل بتيجي من بوابة الدفع (مش تحويل يدوي). */
export const GATEWAY_METHODS = new Set([
  'card',
  'fawry',
  'valu',
  'apple_pay',
  'wallet',
]);

export function isGatewayPayment(p: {
  provider?: string | null;
  method?: string | null;
}): boolean {
  if (p.provider) return p.provider !== 'manual';
  return !!p.method && GATEWAY_METHODS.has(p.method);
}

export type PaymentStateKind =
  | 'gateway_paid' // البوابة أكّدت
  | 'gateway_waiting' // العميل لسه ماكملش على البوابة
  | 'receipt_review' // إيصال تحويل مستني مراجعة
  | 'receipt_confirmed' // تحويل اتأكد
  | 'awaiting_transfer' // تحويل يدوي ولسه مفيش إيصال
  | 'cancelled';

/** حالات الطلب اللي معناها «الفلوس وصلت» في أي جدول (طلبات، خدمات، حجوزات). */
const SETTLED = new Set([
  'paid',
  'processing',
  'preparing',
  'shipped',
  'delivered',
  'completed',
  'active',
  'in_progress',
  'confirmed',
]);

export type PaymentState = {
  kind: PaymentStateKind;
  title: string;
  text: string;
  tone: 'ok' | 'wait' | 'muted';
};

export function paymentState(p: {
  provider?: string | null;
  method?: string | null;
  status: string;
  hasReceipt: boolean;
  paidAt?: string | null;
}): PaymentState {
  const status = String(p.status);
  const settled = !!p.paidAt || SETTLED.has(status);
  if (status === 'cancelled' || status === 'refunded') {
    return {
      kind: 'cancelled',
      title: 'الطلب ملغي',
      text: settled
        ? 'كان مدفوع قبل الإلغاء — راجع الاسترداد لو مطلوب.'
        : 'مفيش دفع مستني على الطلب ده.',
      tone: 'muted',
    };
  }
  if (isGatewayPayment(p)) {
    return settled
      ? {
          kind: 'gateway_paid',
          title: 'مدفوع إلكترونيًا — اتأكد تلقائيًا',
          text: 'الدفع اتم عن طريق بوابة الدفع (XPay) واتأكد منها مباشرة. مفيش إيصال يتراجع.',
          tone: 'ok',
        }
      : {
          kind: 'gateway_waiting',
          title: 'العميل لسه ماكملش الدفع',
          text: 'الطلب اتسجّل والعميل اتحوّل لبوابة الدفع، بس البوابة لسه مابلّغتش بنجاح الدفع.',
          tone: 'wait',
        };
  }
  if (settled) {
    return {
      kind: 'receipt_confirmed',
      title: 'التحويل اتأكد',
      text: p.hasReceipt
        ? 'الإيصال اتراجع والدفع اتأكد.'
        : 'الدفع اتأكد يدويًا.',
      tone: 'ok',
    };
  }
  if (p.hasReceipt || status === 'awaiting_verification') {
    return {
      kind: 'receipt_review',
      title: 'إيصال مستني المراجعة',
      text: 'راجع الإيصال والمبلغ قبل تأكيد الدفع.',
      tone: 'wait',
    };
  }
  return {
    kind: 'awaiting_transfer',
    title: 'لسه مفيش تحويل',
    text: 'لسه ما اترفعش إيصال — الطلب بانتظار تحويل العميل.',
    tone: 'wait',
  };
}
