'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Pause, Play, Clock, AlertCircle, Plus, Pencil } from 'lucide-react';
import type { CreativeService, InstructorServiceOffer, PricingFormulaSettings } from '@/types';
import { formatPrice, calculateFinalSessionPrice } from '@/lib/utils';
import {
  proposeServiceOffer,
  setMyOfferActive,
  withdrawMyOffer,
} from '@/actions/instructor-services';

interface Props {
  services: CreativeService[];
  offers: InstructorServiceOffer[];
  /**
   * بتُستخدم عشان نعرض للمدرب **سعر العميل** جنب حصيلته.
   *
   * المعادلة نفسها مبقتش معروضة: كانت مكتوبة في الشاشة بأرقامها
   * (×المضاعف + الرسم الثابت)، وده تسعير داخلي مالوش لزوم إن المدرب
   * يعرفه. المهم عنده حاجتين: حصيلته، والرقم اللي العميل هيشوفه.
   */
  formula: PricingFormulaSettings;
  /** فوق الرقم ده بيظهر تنبيه — والمدرب يقدر يكمل. صفر = مفيش تنبيه. */
  priceAlert?: number;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm font-medium outline-none transition-colors focus:border-amber-500 focus:bg-white';

export function MyServiceOffersClient({ services, offers, formula, priceAlert = 0 }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const offerFor = (serviceId: string) => offers.find((o) => o.serviceId === serviceId);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setEditingId(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      if (msg.includes('Server Components render') || msg.includes('digest')) {
        setError('تعذّر إرسال العرض للإدارة حالياً. يرجى إعادة المحاولة.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const customerPrice = (earning: number) => calculateFinalSessionPrice(earning, formula);

  const startEditing = (serviceId: string, current?: number | null) => {
    setError('');
    setDraftPrice(current != null ? String(current) : '');
    setEditingId(serviceId);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-bold">المبلغ الذي تقترحه هو حصيلتك أنت.</p>
        <p className="mt-1">
          وسيظهر لك سعر العميل النهائي فور كتابته، والإدارة تعتمده قبل أن تظهر
          الخدمة.
        </p>
      </div>

      {services.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
          لا توجد خدمات إبداعية متاحة حاليًا.
        </p>
      )}

      {services.map((service) => {
        const offer = offerFor(service.id);
        const isEditing = editingId === service.id;

        const pendingNewPrice =
          offer?.status === 'approved' &&
          offer.requestedPrice != null &&
          offer.requestedPrice !== offer.approvedPrice;

        return (
          <div
            key={service.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black text-slate-800">{service.name}</h3>

                  {!offer && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">
                      لا تقدّمها
                    </span>
                  )}
                  {offer?.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                      <Clock className="h-3 w-3" /> قيد المراجعة
                    </span>
                  )}
                  {offer?.status === 'approved' && offer.isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                      <Check className="h-3 w-3" /> معتمدة وظاهرة للعملاء
                    </span>
                  )}
                  {offer?.status === 'approved' && !offer.isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                      <Pause className="h-3 w-3" /> موقوفة مؤقتًا
                    </span>
                  )}
                  {offer?.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                      <X className="h-3 w-3" /> مرفوضة
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm font-medium text-slate-500">
                  {service.description || '—'}
                </p>

                {offer?.status === 'approved' && offer.approvedPrice != null && (
                  <p className="mt-3 text-sm font-bold text-slate-700">
                    حصيلتك: {formatPrice(offer.approvedPrice)}
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="text-slate-500">
                      العميل يدفع: {formatPrice(customerPrice(offer.approvedPrice))}
                    </span>
                  </p>
                )}

                {offer?.status === 'pending' && offer.requestedPrice != null && (
                  <p className="mt-3 text-sm font-bold text-amber-700">
                    اقترحتَ {formatPrice(offer.requestedPrice)} — بانتظار اعتماد الإدارة
                  </p>
                )}

                {pendingNewPrice && offer.requestedPrice != null && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm font-bold text-amber-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    طلبتَ تعديل الحصيلة إلى {formatPrice(offer.requestedPrice)} — الخدمة تظل
                    معروضة بالسعر الحالي حتى تعتمد الإدارة الجديد.
                  </p>
                )}

                {offer?.adminNotes && (
                  <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-600">
                    <span className="font-bold">ملاحظة الإدارة:</span> {offer.adminNotes}
                  </p>
                )}
              </div>

              {!isEditing && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {!offer && (
                    <button
                      type="button"
                      onClick={() => startEditing(service.id, null)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-600"
                    >
                      <Plus className="h-4 w-4" /> أقدّم هذه الخدمة
                    </button>
                  )}

                  {offer && (
                    <button
                      type="button"
                      onClick={() =>
                        startEditing(service.id, offer.requestedPrice ?? offer.approvedPrice)
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4" />
                      {offer.status === 'approved' ? 'طلب تعديل الحصيلة' : 'تعديل المقترح'}
                    </button>
                  )}

                  {offer?.status === 'approved' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => setMyOfferActive(service.id, !offer.isActive))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      {offer.isActive ? (
                        <>
                          <Pause className="h-4 w-4" /> إيقاف مؤقت
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" /> إعادة التفعيل
                        </>
                      )}
                    </button>
                  )}

                  {offer && offer.status !== 'approved' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => withdrawMyOffer(service.id))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" /> سحب الطلب
                    </button>
                  )}
                </div>
              )}
            </div>

            {isEditing && (
              <div className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    حصيلتك المقترحة من هذه الخدمة (ج.م)
                  </label>
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={draftPrice}
                    onChange={(e) => setDraftPrice(e.target.value)}
                    placeholder="مثال: 400"
                    autoFocus
                  />
                  {Number(draftPrice) > 0 && (
                    <p className="text-xs font-bold text-slate-500">
                      العميل سيدفع: {formatPrice(customerPrice(Number(draftPrice)))}
                    </p>
                  )}
                  {/*
                    تنبيه لا منع. كان في الكود سقف ثابت بيرفض الطلب، والرقم
                    المنطقي بيختلف من خدمة لخدمة — والإدارة بتراجع كل رقم
                    قبل الاعتماد أصلًا.
                  */}
                  {priceAlert > 0 && Number(draftPrice) > priceAlert && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-amber-100 p-2 text-xs font-bold text-amber-800">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        الرقم ده أعلى من المعتاد ({formatPrice(priceAlert)}). تقدر تكمل،
                        وهتراجعه الإدارة قبل الاعتماد.
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" /> إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => proposeServiceOffer(service.id, Number(draftPrice)))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> {busy ? 'جارٍ الإرسال…' : 'إرسال للإدارة'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
