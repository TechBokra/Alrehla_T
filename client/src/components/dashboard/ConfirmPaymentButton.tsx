'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { confirmBookingPayment } from '@/actions/bookings';
import { confirmOrderPayment } from '@/actions/orders';
import { useAction } from '@/lib/use-action';
import { FormError, FormSuccess } from '@/components/ui/FormError';

/**
 * زرار «تأكيد استلام الدفع» عند الإدارة.
 *
 * ── ليه مكوّن لوحده ─────────────────────────────────────────
 *
 * الزرار كان `<form action={...}>` جوّه مكوّن خادم، والأكشن مكتوب كده:
 *
 *     const confirmPaymentAction = async () => {
 *       'use server';
 *       await confirmBookingPayment(target.id);   // النتيجة بتترمي
 *     };
 *
 * والدالة بترجّع `{ success, error }` — فلو رجعت فشلًا (الصلاحية
 * ناقصة، الاشتراك مش موجود، الحالة اتغيّرت)، **الإداري مبيشوفش حاجة**:
 * الصفحة بتعيد الرسم بنفس الحالة، فيدوس تاني وتالت.
 *
 * ⚠️ **وده أخطر موضع للسكوت في المشروع كله**، لأنه بالظبط نقطة
 *    التحويل من «فلوس وصلت» إلى «خدمة بتتنفّذ».
 *
 * ── والحالة اللي مفيش زرار كان يقولها ───────────────────────
 *
 * تأكيد حجز الباقة بيولّد الجلسات. ولو الجلسات ما اتعملتش — الباقة
 * مفيهاش `sessions_count`، أو الإدراج فشل — الدالة كانت بترجّع
 * `{ success: true, sessionsCreated: 0 }`.
 *
 * يعني: **الدفع اتأكد، والاشتراك بقى نشطًا، ومفيش ولا جلسة.** لوحة
 * الطالب فاضية، ولوحة المدرب فاضية، والأثر الوحيد سطر في سجل الخادم.
 *
 * الزرار ده بيقول الرقم صريحًا، وبيحوّل الصفر لتحذير أصفر فيه الخطوة
 * التالية — مش لرسالة نجاح.
 */
export function ConfirmPaymentButton({
  kind,
  targetId,
  label = 'تأكيد استلام الدفع',
}: {
  /** `booking` = حجز باقة (بيولّد جلسات) · `order` = طلب منتج. */
  kind: 'booking' | 'order';
  targetId: string;
  label?: string;
}) {
  const router = useRouter();
  const [done, setDone] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const confirm = useAction(
    async (id: string) =>
      kind === 'booking' ? confirmBookingPayment(id) : confirmOrderPayment(id),
    {
      onSuccess: (result) => {
        // `confirmBookingPayment` بترجّع `sessionsCreated`،
        // و`confirmOrderPayment` لأ — فالقراءة بتتم بحذر.
        const raw = (result as unknown as { sessionsCreated?: unknown })
          ?.sessionsCreated;
        const created = typeof raw === 'number' ? raw : null;

        if (kind === 'booking' && created === 0) {
          setDone(null);
          setWarning(
            'الدفع اتأكد والاشتراك بقى نشطًا — بس مفيش ولا جلسة اتعملت. ' +
              'غالبًا الباقة مفيهاش عدد جلسات محدَّد. اظبطها من إعدادات الباقات، ' +
              'وبعدين عيّن المدرب من هنا عشان الجلسات تتولّد.',
          );
        } else {
          setWarning(null);
          setDone(
            created !== null
              ? `اتأكد الدفع، واتعمل ${created} جلسة بمواعيد مبدئية.`
              : 'اتأكد الدفع.',
          );
        }
        router.refresh();
      },
      fallbackError: 'تعذّر تأكيد الدفع.',
    },
  );

  return (
    <div className="space-y-3">
      <FormError message={confirm.error} />
      <FormSuccess message={done} />

      {warning && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold leading-relaxed text-amber-900"
        >
          {warning}
        </div>
      )}

      <button
        type="button"
        onClick={() => confirm.run(targetId)}
        disabled={confirm.pending}
        aria-busy={confirm.pending || undefined}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-6 font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {confirm.pending ? (
          'جارٍ التأكيد…'
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5" />
            {label}
          </>
        )}
      </button>
    </div>
  );
}
