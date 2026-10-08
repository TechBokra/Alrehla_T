'use client';

import React, { useState, useTransition } from 'react';
import { Save, Trash2, CheckCircle2, Clock } from 'lucide-react';
import type { CreativeService, InstructorServiceOffer } from '@/types';
import {
  saveInstructorServiceOffer,
  removeInstructorServiceOffer,
  rejectInstructorServiceOffer,
} from '@/actions/instructor-services';
import { formatPrice, calculateFinalSessionPrice } from '@/lib/utils';
import type { PricingFormulaSettings } from '@/types';
import { Field, TextInput, Checkbox, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

interface Props {
  instructorId: string;
  services: CreativeService[];
  offers: InstructorServiceOffer[];
  formula: PricingFormulaSettings;
}

type RowState = { price: string; isActive: boolean };

export function InstructorServicesSection({ instructorId, services, offers, formula }: Props) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const offerFor = (serviceId: string) => offers.find((o) => o.serviceId === serviceId);

  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    for (const service of services) {
      const offer = offerFor(service.id);
      initial[service.id] = {
        price: offer?.approvedPrice != null ? String(offer.approvedPrice) : '',
        isActive: offer?.isActive ?? true,
      };
    }
    return initial;
  });

  const [isPending, startTransition] = useTransition();
  // أنهي زرار اتداس (`save:<id>` / `reject:<id>`) — عشان هو بس اللي يكتب «جارٍ…».
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // الخطأ على خانة بعينها في صف بعينه — رسالته بتظهر تحت الخانة.
  const [errorAt, setErrorAt] = useState<{ serviceId: string; field: string } | null>(null);
  const fieldError = (serviceId: string, field: string) =>
    errorAt?.serviceId === serviceId && errorAt.field === field ? (error ?? undefined) : undefined;

  const showError = (message: string, serviceId?: string, field?: string) => {
    setError(message);
    setErrorAt(serviceId && field ? { serviceId, field } : null);
  };
  const clearError = () => {
    setError(null);
    setErrorAt(null);
  };

  const update = (serviceId: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [serviceId]: { ...prev[serviceId], ...patch } }));

  const handleSave = (serviceId: string) => {
    const row = rows[serviceId];
    const parsed = row.price.trim() === '' ? null : Number(row.price);
    if (parsed !== null && (isNaN(parsed) || parsed <= 0)) {
      showError('السعر لازم يكون رقم أكبر من صفر', serviceId, 'price');
      return;
    }
    clearError();
    setActiveKey(`save:${serviceId}`);
    startTransition(async () => {
      try {
        const result = await saveInstructorServiceOffer({
          instructorId,
          serviceId,
          approvedPrice: parsed,
          isActive: row.isActive,
        });
        if (!result.ok) {
          showError(result.error, serviceId, result.field);
          return;
        }
        setSavedId(serviceId);
        setTimeout(() => setSavedId(null), 2500);
      } catch {
        // الأكشن بيرجّع رسالته؛ ده للانقطاع وأي حاجة غير متوقعة.
        showError('تعذّر الحفظ');
      }
    });
  };

  const handleReject = (serviceId: string) => {
    clearError();
    setActiveKey(`reject:${serviceId}`);
    startTransition(async () => {
      try {
        const result = await rejectInstructorServiceOffer(instructorId, serviceId, rejectNote);
        if (!result.ok) {
          showError(result.error, serviceId, result.field);
          return;
        }
        setRejectingId(null);
        setRejectNote('');
      } catch {
        showError('تعذّر الرفض');
      }
    });
  };

  const handleRemove = (serviceId: string) => {
    clearError();
    setActiveKey(`remove:${serviceId}`);
    startTransition(async () => {
      try {
        const result = await removeInstructorServiceOffer(instructorId, serviceId);
        if (!result.ok) {
          showError(result.error);
          return;
        }
        update(serviceId, { price: '', isActive: true });
      } catch {
        showError('تعذّر الحذف');
      }
    });
  };

  if (services.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8">
        <h3 className="font-black text-slate-800 mb-2 text-lg">الخدمات الإبداعية</h3>
        <p className="text-slate-500">لا توجد خدمات إبداعية معرّفة في النظام بعد.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8">
      <h3 className="font-black text-slate-800 mb-2 text-lg">الخدمات الإبداعية</h3>
      <p className="text-sm text-slate-500 mb-6">
        الرقم هنا هو <strong>حصيلة المدرب</strong>، وسعر العميل يُحسب فوقه بمعادلة المنصة
        (×{formula.platformMultiplier} + {formatPrice(formula.fixedAdminFee)}). الخدمة التي
        لها حصيلة معتمدة تظهر للعملاء؛ والتي بلا حصيلة تبقى قيد المراجعة ولا تظهر.
      </p>

      {error && !errorAt && <FormError message={error} className="mb-4" />}

      <div className="flex flex-col gap-3">
        {services.map((service) => {
          const offer = offerFor(service.id);
          const row = rows[service.id];
          const isApproved = offer?.status === 'approved' && offer.isActive;

          return (
            <div
              key={service.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="min-w-[180px] flex-1">
                <div className="font-bold text-slate-800">{service.name}</div>
                <div className="text-xs text-slate-500">
                  {service.category ?? 'بدون تصنيف'}
                  {service.priceType === 'starts_from' && ' · سعرها حسب المدرب'}
                </div>

                {/* ما طلبه المدرب — لم يكن يظهر للإدارة من قبل إطلاقًا. */}
                {offer?.requestedPrice != null &&
                  offer.requestedPrice !== offer.approvedPrice && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                      <span>
                        {offer.approvedPrice == null ? 'المدرب طلب' : 'المدرب يطلب تعديل الحصيلة إلى'}{' '}
                        {formatPrice(offer.requestedPrice)}
                        <span className="mx-1 text-amber-400">|</span>
                        العميل سيدفع{' '}
                        {formatPrice(calculateFinalSessionPrice(offer.requestedPrice, formula))}
                      </span>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          update(service.id, { price: String(offer.requestedPrice) })
                        }
                        className="rounded-lg bg-amber-600 px-2.5 py-1 text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                      >
                        استخدم هذا السعر
                      </button>
                    </div>
                  )}

                {Number(row.price) > 0 && (
                  <div className="mt-2 text-xs font-bold text-slate-500">
                    بهذه الحصيلة يدفع العميل{' '}
                    {formatPrice(calculateFinalSessionPrice(Number(row.price), formula))}
                  </div>
                )}
              </div>

              <Field
                label="حصيلة المدرب (ج.م)"
                name="price"
                error={fieldError(service.id, 'price')}
                className="w-40"
              >
                <TextInput
                  id={`price-${service.id}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="—"
                  value={row.price}
                  onChange={(e) => update(service.id, { price: e.target.value })}
                />
              </Field>

              <Checkbox
                label="مفعّلة"
                checked={row.isActive}
                onChange={(e) => update(service.id, { isActive: e.target.checked })}
              />

              <div className="flex min-w-[110px] items-center gap-1 text-xs font-bold">
                {isApproved ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> تظهر للعملاء
                  </span>
                ) : offer ? (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Clock className="h-4 w-4" /> قيد المراجعة
                  </span>
                ) : (
                  <span className="text-slate-400">غير مضافة</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <BusyButton
                  busy={isPending && activeKey === `save:${service.id}`}
                  disabled={isPending}
                  onClick={() => handleSave(service.id)}
                >
                  <Save className="h-4 w-4" />
                  {savedId === service.id ? 'تم' : 'حفظ'}
                </BusyButton>
                {offer && offer.status !== 'rejected' && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setRejectNote('');
                      setRejectingId(rejectingId === service.id ? null : service.id);
                    }}
                    className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                  >
                    رفض
                  </button>
                )}
                {offer && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRemove(service.id)}
                    className="rounded-xl border border-slate-200 p-2 text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50"
                    aria-label="حذف الخدمة من هذا المدرب"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {rejectingId === service.id && (
                <div className="w-full space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                  <Field
                    label="سبب الرفض (يصل للمدرب)"
                    name="adminNotes"
                    required
                    error={fieldError(service.id, 'adminNotes')}
                  >
                    <TextInput
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="مثال: السعر أعلى من المعتاد لهذه الخدمة"
                    />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <BusyButton busy={false} variant="secondary" onClick={() => setRejectingId(null)}>
                      إلغاء
                    </BusyButton>
                    <BusyButton
                      variant="danger"
                      busy={isPending && activeKey === `reject:${service.id}`}
                      pendingLabel="جارٍ الرفض…"
                      disabled={isPending}
                      onClick={() => handleReject(service.id)}
                    >
                      تأكيد الرفض
                    </BusyButton>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
