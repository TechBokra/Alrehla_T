'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Inbox } from 'lucide-react';
import type { PricingFormulaSettings } from '@/types';
import type { OfferRequest } from '@/data/domains/(admin)/providers/offer-requests';
import { saveInstructorServiceOffer, rejectInstructorServiceOffer } from '@/actions/instructor-services';
import { saveProviderOffering } from '@/actions/providers';
import { formatPrice, calculateFinalSessionPrice } from '@/lib/utils';
import { Field, TextInput, BusyButton } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

type Props = { requests: OfferRequest[]; formula: PricingFormulaSettings };

const KIND_LABEL: Record<OfferRequest['kind'], string> = {
  new: 'طلب جديد',
  price_change: 'تعديل سعر',
};

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function providerHref(r: OfferRequest): string {
  return r.instructorId ? `/dashboard/admin/instructors/${r.instructorId}` : '/dashboard/admin/providers';
}

export function OfferRequestsClient({ requests, formula }: Props) {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white p-12 text-center">
        <Inbox className="h-10 w-10 text-slate-300" aria-hidden="true" />
        <p className="font-bold text-slate-700">مفيش طلبات مستنية قرار دلوقتي.</p>
        <p className="text-sm text-slate-500">
          أي مدرب أو مقدّم يطلب خدمة جديدة أو تعديل سعر هيظهر هنا، وكمان في «مطلوب منك» في الرئيسية.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-bold text-slate-500">
        {requests.length} طلب · الأقدم أولًا · سعر العميل = الحصيلة × {formula.platformMultiplier} +{' '}
        {formatPrice(formula.fixedAdminFee)}
      </p>
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} formula={formula} />
      ))}
    </div>
  );
}

function RequestCard({ request: r, formula }: { request: OfferRequest; formula: PricingFormulaSettings }) {
  const [price, setPrice] = useState(String(r.requestedPrice ?? r.approvedPrice ?? ''));
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const days = daysSince(r.since);
  const parsed = Number(price);
  const isInstructor = Boolean(r.instructorId);

  const run = (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, doneLabel: string) => {
    setError(null);
    setActive(key);
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          setError(res.error ?? 'تعذّر الحفظ');
          return;
        }
        setDone(doneLabel);
      } catch {
        setError('تعذّر الاتصال — جرّب تاني');
      }
    });
  };

  const approve = () => {
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('اكتب الحصيلة المعتمدة (رقم أكبر من صفر)');
      return;
    }
    run(
      'approve',
      () =>
        isInstructor
          ? saveInstructorServiceOffer({
              instructorId: r.instructorId!,
              serviceId: r.serviceId,
              approvedPrice: parsed,
              isActive: true,
            })
          : saveProviderOffering({
              providerId: r.providerId,
              serviceId: r.serviceId,
              approvedPrice: parsed,
              status: 'approved',
              isActive: true,
            }),
      `اتعتمدت بحصيلة ${formatPrice(parsed)}`,
    );
  };

  // تعديل السعر المرفوض: العرض يفضل معتمد بسعره القديم، والطلب بس اللي يتقفل.
  const keepOldPrice = () =>
    run(
      'keep',
      () =>
        isInstructor
          ? saveInstructorServiceOffer({
              instructorId: r.instructorId!,
              serviceId: r.serviceId,
              approvedPrice: r.approvedPrice,
              isActive: r.isActive,
              adminNotes: note.trim() || undefined,
            })
          : saveProviderOffering({
              providerId: r.providerId,
              serviceId: r.serviceId,
              approvedPrice: r.approvedPrice,
              status: 'approved',
              isActive: r.isActive,
              adminNotes: note.trim() || undefined,
            }),
      `اتقفل الطلب — السعر فضل ${formatPrice(r.approvedPrice ?? 0)}`,
    );

  const reject = () => {
    if (!note.trim()) {
      setError('اكتب سبب الرفض عشان يوصل للمقدّم');
      return;
    }
    run(
      'reject',
      () =>
        isInstructor
          ? rejectInstructorServiceOffer(r.instructorId!, r.serviceId, note)
          : saveProviderOffering({
              providerId: r.providerId,
              serviceId: r.serviceId,
              approvedPrice: null,
              status: 'rejected',
              isActive: false,
              adminNotes: note,
            }),
      'اترفض الطلب',
    );
  };

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        {r.providerName} — {r.serviceName}: {done}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                r.kind === 'new' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {KIND_LABEL[r.kind]}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
              {isInstructor ? 'مدرب' : 'مقدّم مستقل'}
            </span>
            <span className={`text-xs font-bold ${days >= 3 ? 'text-rose-600' : 'text-slate-400'}`}>
              {days === 0 ? 'النهارده' : `من ${days} يوم`}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black text-slate-800">{r.serviceName}</h3>
          <Link
            href={providerHref(r)}
            className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline"
          >
            {r.providerName}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">طلب</dt>
            <dd className="font-black text-slate-800">
              {r.requestedPrice != null ? formatPrice(r.requestedPrice) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">المعتمد حاليًا</dt>
            <dd className="font-black text-slate-800">
              {r.approvedPrice != null ? formatPrice(r.approvedPrice) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">سعر الكتالوج</dt>
            <dd className="font-bold text-slate-600">{formatPrice(r.catalogPrice)}</dd>
          </div>
        </dl>
      </div>

      {r.adminNotes && (
        <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          ملاحظة سابقة: {r.adminNotes}
        </p>
      )}

      {error && <FormError message={error} className="mb-3" />}

      <div className="flex flex-wrap items-end gap-3">
        <Field label="الحصيلة المعتمدة (ج.م)" name="price" className="w-44">
          <TextInput
            id={`price-${r.id}`}
            type="number"
            min={0}
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <div className="pb-3 text-xs font-bold text-slate-500">
          {parsed > 0 ? <>العميل يدفع {formatPrice(calculateFinalSessionPrice(parsed, formula))}</> : null}
        </div>
        <div className="mr-auto flex flex-wrap gap-2">
          <BusyButton busy={isPending && active === 'approve'} disabled={isPending} onClick={approve}>
            اعتماد
          </BusyButton>
          <BusyButton
            variant="secondary"
            busy={false}
            disabled={isPending}
            onClick={() => setRejecting((v) => !v)}
          >
            {r.kind === 'price_change' ? 'مش موافق على التعديل' : 'رفض'}
          </BusyButton>
        </div>
      </div>

      {rejecting && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
          <Field
            label={r.kind === 'price_change' ? 'ملاحظة للمقدّم (اختياري)' : 'سبب الرفض (بيوصل للمقدّم)'}
            name="note"
            className="min-w-[240px] flex-1"
          >
            <TextInput id={`note-${r.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {r.kind === 'price_change' ? (
            <BusyButton busy={isPending && active === 'keep'} disabled={isPending} onClick={keepOldPrice}>
              إبقاء السعر الحالي {formatPrice(r.approvedPrice ?? 0)}
            </BusyButton>
          ) : (
            <BusyButton variant="danger" busy={isPending && active === 'reject'} disabled={isPending} onClick={reject}>
              تأكيد الرفض
            </BusyButton>
          )}
        </div>
      )}
    </div>
  );
}
