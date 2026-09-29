'use client';
import { formatPrice } from '@/lib/utils';
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Calendar, Clock, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { createCourseBooking, submitBookingPaymentProof } from '@/actions/bookings';
import { PaymentProofForm, type PaymentMethod } from '@/components/checkout/PaymentProofForm';
import { Button } from '@/components/ui/Button';
import { TransferInstructions } from '@/components/checkout/TransferInstructions';
import { PersonAvatar } from '@/components/ui/PersonAvatar';
import { SessionRecordingNotice } from '@/components/SessionRecordingNotice';
import { consentLabel, type SessionRecordingSettings } from '@/lib/session-recording';

export function BookingConfirmClient({
  paymentWalletNumber,
  paymentQrUrl,
  packageId,
  packageName,
  packagePrice,
  instructorId,
  instructorName,
  instructorAvatarUrl,
  preferredSlot,
  presetChildId,
  recording,
  recordingText,
}: {
  paymentWalletNumber: string;
  paymentQrUrl?: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  instructorId?: string;
  instructorName?: string;
  /** صورة المدرب — نفس العطل اللي اتكرر في أربع شاشات قبل دي. */
  instructorAvatarUrl?: string;
  /** الموعد الأسبوعي اللي العميل اختاره في المعالج، بعد التأكد إنه في جدول المدرب. */
  preferredSlot?: { day: string; time: string };
  /**
   * المشارك محدَّد مسبقًا — بييجي من موافقة ولي الأمر على طلب ابنه.
   * من غيره كان لازم يختاره بإيده، فيحجز باسمه هو بالغلط.
   */
  presetChildId?: string;
  /** إعدادات تسجيل الجلسات — الإفصاح والموافقة بيتبنوا منها. */
  recording: SessionRecordingSettings;
  /** نصوص التسجيل من لوحة التحكم — المدة بتتحط مكان {المدة}. */
  recordingText: { notice: string; consent: string };
}) {
  const [participantType, setParticipantType] = useState<'self' | 'child'>(
    presetChildId ? 'child' : 'self',
  );
  const [childId, setChildId] = useState<string>(presetChildId ?? '');
  const [children, setChildren] = useState<{id:string, name:string}[]>([]);

  React.useEffect(() => {
    import('@/app/actions/family').then(mod => mod.fetchFamilyMembers()).then(data => setChildren(data ? data.map((d: any) => ({id: d.id, name: d.fullName})) : []));
  }, []);

  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<{ id: string; reference: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // ⚠️ **الموافقة مبدئيًّا مش متعلَّمة، ومفيش «موافق ضمنًا».** ولي
  //    الأمر لازم يعمل الفعل بنفسه، وإلا مابقتش موافقة.
  const [recordingConsent, setRecordingConsent] = useState(false);
  const consentNeeded = recording.enabled;
  const consentMissing = consentNeeded && !recordingConsent;

  /** الخطوة الأولى: تسجيل الحجز — منها بييجي الرقم المرجعي. */
  const handleRegisterBooking = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError('');
      if (participantType === 'child' && !childId) {
        setError('اختار المشارك الأول');
        return;
      }

      // المبلغ مش بيتبعت من هنا: القاعدة بتاخده من سعر الباقة.
      const result = await createCourseBooking({
        packageId,
        instructorId,
        participantType,
        childId: childId || undefined,
        preferredSlot,
        // الخادم بيرفض الحجز لو التسجيل شغّال والقيمة دي مش `true` —
        // فالمربّع مش مجرد زينة في الشاشة.
        recordingConsent,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setBooking({ id: result.subscriptionId, reference: result.paymentReference });
    });
  };

  /** الخطوة التانية: الإيصال بعد التحويل. */
  const handleReceipt = (payment: { method: PaymentMethod; receiptUrl: string }) => {
    if (!booking) return;
    startTransition(async () => {
      setError('');
      const result = await submitBookingPaymentProof(booking.id, payment);
      if (!result.success) {
        setError(result.error ?? 'تعذّر إرسال الإيصال');
        return;
      }
      setIsSuccess(true);
    });
  };

  if (isSuccess) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-500">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h2 className="mb-4 text-3xl font-black text-slate-800">
          بانتظار تأكيد الدفع
        </h2>
        <p className="mb-8 text-slate-600">
          لقد استلمنا طلب الحجز الخاص بك وجاري مراجعة التحويل. سنؤكد حجزك قريبًا.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button href="/account/orders/creative-writing" variant="neutral" className="px-8 py-3">
            تتبع الحجز
          </Button>
          <Button href="/creative-writing" variant="secondary" accentColor="emerald" className="px-8 py-3">
            العودة للرئيسية
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 rounded-2xl bg-slate-50 p-6 border border-slate-100">
        <h2 className="mb-6 text-xl font-bold text-slate-800">تفاصيل الجلسة</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-500" />
              <span>المدرب</span>
            </div>
            <span className="flex items-center gap-2 font-bold text-slate-900">
              {instructorName && (
                <PersonAvatar
                  name={instructorName}
                  avatarUrl={instructorAvatarUrl}
                  size={32}
                />
              )}
              {instructorName ?? 'يحدده فريق المنصة'}
            </span>
          </div>
          <div className="flex items-center justify-between font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-500" />
              <span>الباقة</span>
            </div>
            <span className="font-bold text-slate-900">{packageName}</span>
          </div>
          {/* التاريخ والوقت كانوا معروضين هنا: تاريخ النهاردة و«04:30 مساءً»
              مكتوبين في الكود. الجدولة الحقيقية بتحصل بعد تأكيد الدفع. */}
          <div className="flex items-center justify-between font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-500" />
              <span>الموعد</span>
            </div>
            <span className="font-bold text-slate-900">يتحدد بعد تأكيد الدفع</span>
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-2xl bg-emerald-50 p-6 border border-emerald-100">
        <h2 className="mb-4 text-lg font-bold text-slate-800">ملخص الدفع</h2>
        <div className="flex justify-between text-xl font-black text-slate-900">
          <span>قيمة الباقة</span>
          <span className="text-emerald-700">{formatPrice(packagePrice)}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {booking ? (
        <PaymentProofForm
          reference={booking.reference}
          amount={packagePrice}
          walletNumber={paymentWalletNumber}
          qrUrl={paymentQrUrl}
          accent="emerald"
          busy={isPending}
          onSubmit={handleReceipt}
        />
      ) : (
        <form onSubmit={handleRegisterBooking} className="space-y-6">
          {/* ── المشارك ────────────────────────────────────────────
              ⚠️ الشاشة دي كانت بتجيب قايمة الأبناء من `fetchFamilyMembers`
                 **ومبتعرضهاش**: `setParticipantType` و`setChildId` مكانوش
                 بيتنادوا من أي مكان. يعني ولي الأمر ما كانش يقدر يحجز
                 لابنه خالص إلا لما يوافق على طلب مرسَل منه — والحجز كان
                 بيتسجّل باسمه هو. */}
          <div className="space-y-3">
            <h2 className="text-xl font-black text-slate-800">الحجز لمين؟</h2>

            {presetChildId ? (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
                الحجز ده لطلب ابنك اللي وافقت عليه — المشارك محدَّد تلقائيًا.
              </p>
            ) : (
              <>
                <div role="radiogroup" aria-label="المشارك" className="grid gap-3 sm:grid-cols-2">
                  {[
                    { value: 'self' as const, title: 'ليا أنا', note: 'الحجز باسمك' },
                    {
                      value: 'child' as const,
                      title: 'لواحد من أبنائي',
                      note: children.length
                        ? 'من المركز العائلي'
                        : 'مفيش أبناء في المركز العائلي لسه',
                    },
                  ].map((choice) => {
                    const active = participantType === choice.value;
                    const blocked = choice.value === 'child' && children.length === 0;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={blocked}
                        onClick={() => {
                          setParticipantType(choice.value);
                          if (choice.value === 'self') setChildId('');
                        }}
                        className={`rounded-2xl border-2 p-4 text-start transition-colors disabled:opacity-50 ${active ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        <span className="block font-bold text-slate-800">{choice.title}</span>
                        <span className="mt-1 block text-xs font-medium text-slate-600">
                          {choice.note}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {participantType === 'child' && (
                  <select
                    value={childId}
                    onChange={(e) => setChildId(e.target.value)}
                    aria-label="اختيار المشارك"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-600"
                  >
                    <option value="">اختار المشارك…</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          {/* ⚠️ **«الإهداء الخاص» اتشال بقرار تامر (27 سبتمبر).**

              كان بند اختياري في شاشة المراجعة بيتخزّن في
              `course_subscriptions.gift_message` (ملف SQL 86).
              فريق العمل قال إنه مش محتاجه، فاتشال من الشاشة.

              ⚠️ **والعمود في القاعدة ما اتشالش عن قصد** — فيه حجوزات
                 قديمة ممكن تكون كاتبة فيه، وحذف العمود بيمسحها.
                 والدالة `create_course_booking` لسه بتقبل المعامل
                 (بقيمة فاضية)، فمفيش كسر في القاعدة ولا في الدالة. */}

          <h2 className="text-xl font-black text-slate-800">طريقة الدفع</h2>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-medium text-slate-600">
            الدفع بالتحويل (إنستاباي أو فودافون كاش). سجّل الحجز الأول، وهيظهرلك
            رقم مرجعي تكتبه في ملاحظة التحويل، وبعدها ترفع صورة الإيصال.
          </div>

          {/* ── الإفصاح والموافقة — قبل الدفع، مش بعده ──────────

              ⚠️ **مكانها هنا مقصود.** ولي الأمر لازم يعرف إن
                 الجلسة هتتسجّل **قبل** ما يدفع، لا في شاشة تأكيد
                 بعد ما فلوسه راحت. الإفصاح اللي بييجي بعد الدفع
                 مش إفصاح — هو إخطار بأمر واقع.

              ⚠️ **والمربّع ده بيمنع الحجز فعلًا** (`disabled`)،
                 لكن الفحص في المتصفح مش دليل (قاعدة «ع»). تسجيل
                 الموافقة نفسها في القاعدة خطوة لسه ما اتعملتش —
                 موثّقة في خطة التكامل. */}
          {consentNeeded && (
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <SessionRecordingNotice
                enabled={recording.enabled}
                retentionDays={recording.retentionDays}
                template={recordingText.notice}
                tone="prominent"
              />
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={recordingConsent}
                  onChange={(e) => setRecordingConsent(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm leading-relaxed font-bold text-slate-700">
                  {consentLabel(recording.retentionDays, recordingText.consent)}
                </span>
              </label>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button
              type="submit"
              disabled={isPending || consentMissing}
              accentColor="emerald"
              className="flex-1 py-4 text-center disabled:opacity-70"
            >
              {isPending ? 'جارٍ تسجيل الحجز…' : 'سجّل الحجز واعرض بيانات التحويل'}
              {!isPending && <CheckCircle2 className="h-5 w-5" />}
            </Button>
            <Button
              href="/creative-writing/booking"
              variant="secondary"
              accentColor="emerald"
              className="sm:w-1/3 py-4 text-center"
            >
              <ArrowRight className="h-5 w-5" />
              تعديل الاختيار
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
