'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { createServiceOrder, submitServiceOrderPayment } from '@/actions/service-orders';
import { PaymentProofForm, type PaymentMethod } from '@/components/checkout/PaymentProofForm';

interface Props {
  /** Read from site settings — it used to be the placeholder {paymentWalletNumber}. */
  paymentWalletNumber: string;
  /** InstaPay QR from site settings, when one has been uploaded. */
  paymentQrUrl?: string;
  serviceId: string;
  serviceName: string;
  providerId: string | null;
  providerName: string | null;
  amount: number;
  /**
   * المستفيد محدَّد مسبقًا — بييجي من موافقة ولي الأمر على طلب ابنه.
   *
   * من غيره كان ولي الأمر يوصل للشاشة ولازم يختار «لأحد أفراد العائلة»
   * بإيده ويدوّر على الاسم، فيكمّل الطلب باسمه هو بالغلط والخدمة تتنفّذ
   * على إنها له.
   */
  presetChildId?: string;
}

export function OrderServiceClient({
  serviceId,
  serviceName,
  providerId,
  providerName,
  amount,
  paymentWalletNumber,
  paymentQrUrl,
  presetChildId,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [placed, setPlaced] = useState<{ id: string; reference: string } | null>(null);

  // ── المستفيد من الخدمة ──────────────────────────────────────
  //
  // حجز الباقة بيسأل السؤال ده، وطلب الخدمة **مكانش بيسأله خالص**:
  // ولي أمر يطلب «مراجعة نص» لابنه، والطلب يتسجّل باسمه هو، ومقدّم
  // الخدمة مايعرفش النص لمين ولا سنه كام.
  const [participantType, setParticipantType] = useState<'self' | 'child'>(
    presetChildId ? 'child' : 'self',
  );
  const [childId, setChildId] = useState(presetChildId ?? '');
  const [family, setFamily] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    import('@/app/actions/family')
      .then((mod) => mod.fetchFamilyMembers())
      .then((members) =>
        setFamily((members ?? []).map((m) => ({ id: m.id, name: m.fullName }))),
      )
      .catch(() => setFamily([]));
  }, []);

  /** الخطوة الأولى: تسجيل الطلب — منه بييجي الرقم المرجعي. */
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await createServiceOrder({
          serviceId,
          providerId,
          participantType,
          childId: participantType === 'child' ? childId : null,
        });
        setPlaced({ id: result.orderId, reference: result.paymentReference });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر إنشاء الطلب');
      }
    });
  };

  /** الخطوة التانية: الإيصال بعد التحويل. */
  const handleReceipt = (payment: { method: PaymentMethod; receiptUrl: string }) => {
    if (!placed) return;
    setError(null);
    startTransition(async () => {
      const result = await submitServiceOrderPayment(placed.id, payment);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push('/account/orders/creative-writing');
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8">
        <h2 className="mb-6 text-xl font-black text-slate-800">ملخص الطلب</h2>

        <div className="flex justify-between border-b border-slate-100 py-3">
          <span className="font-medium text-slate-500">الخدمة</span>
          <span className="font-bold text-slate-800">{serviceName}</span>
        </div>

        {providerName && (
          <div className="flex justify-between border-b border-slate-100 py-3">
            <span className="font-medium text-slate-500">مقدّم الخدمة</span>
            <span className="font-bold text-slate-800">{providerName}</span>
          </div>
        )}

        <div className="flex justify-between py-3">
          <span className="font-medium text-slate-500">الإجمالي</span>
          <span className="text-2xl font-black text-emerald-600">{formatPrice(amount)}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {placed ? (
        <PaymentProofForm
          reference={placed.reference}
          amount={amount}
          walletNumber={paymentWalletNumber}
          qrUrl={paymentQrUrl}
          accent="emerald"
          busy={isPending}
          onSubmit={handleReceipt}
        />
      ) : (
        <form onSubmit={handleRegister} className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8">
            <h2 className="mb-1 text-lg font-black text-slate-800">الخدمة دي لمين؟</h2>
            {presetChildId && (
              <p className="mb-3 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">
                الطلب ده جاي من موافقتك على طلب{' '}
                {family.find((m) => m.id === presetChildId)?.name ?? 'ابنك'} — المستفيد
                متحدد تلقائيًا.
              </p>
            )}
            <p className="mb-5 text-sm font-medium text-slate-500">
              مقدّم الخدمة بيحتاج يعرف المستفيد عشان يظبط الشغل على سنّه
              ومستواه.
            </p>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 font-bold text-slate-700 transition-colors hover:border-emerald-400">
                <input
                  type="radio"
                  name="participant"
                  checked={participantType === 'self'}
                  onChange={() => setParticipantType('self')}
                  className="h-4 w-4 accent-emerald-600"
                />
                ليا أنا
              </label>

              <label
                className={
                  family.length === 0
                    ? 'flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 font-bold text-slate-400'
                    : 'flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 font-bold text-slate-700 transition-colors hover:border-emerald-400'
                }
              >
                <input
                  type="radio"
                  name="participant"
                  disabled={family.length === 0}
                  checked={participantType === 'child'}
                  onChange={() => setParticipantType('child')}
                  className="h-4 w-4 accent-emerald-600"
                />
                لأحد أفراد العائلة
              </label>

              {family.length === 0 && (
                <p className="text-xs font-bold text-slate-500">
                  مفيش أفراد عائلة على حسابك. ضيفهم من «أفراد العائلة» في حسابك
                  الأول.
                </p>
              )}

              {participantType === 'child' && family.length > 0 && (
                <select
                  required
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium outline-none focus:border-emerald-500"
                >
                  <option value="">اختار المستفيد</option>
                  {family.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-sm font-medium text-slate-600">
            الدفع بالتحويل (إنستاباي أو فودافون كاش). سجّل الطلب الأول، وهيظهرلك
            رقم مرجعي تكتبه في ملاحظة التحويل، وبعدها ترفع صورة الإيصال.
          </div>

          <button
            type="submit"
            disabled={isPending || (participantType === 'child' && !childId)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 py-4 font-black text-white shadow-lg transition-colors hover:bg-emerald-700 disabled:opacity-70"
          >
            <CheckCircle2 className="h-5 w-5" />
            {isPending ? 'جاري تسجيل الطلب...' : 'سجّل الطلب واعرض بيانات التحويل'}
          </button>
        </form>
      )}
    </div>
  );
}
