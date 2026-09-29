'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Loader2, AlertTriangle } from 'lucide-react';
import { createSessionForSubscription } from '@/actions/admin-sessions';
import { FormError } from '@/components/ui/FormError';

/**
 * إضافة جلسة لاشتراك قائم.
 *
 * ── ليه الشاشة دي موجودة ────────────────────────────────────
 *
 * الجلسات كانت بتتولّد من حتة واحدة بس: تأكيد دفع الحجز. يعني جلسة
 * اتلغت، أو المدرب غاب، أو الاتنين اتفقوا على موعد إضافي — **مفيش
 * طريقة**. الحل الوحيد كان حجز جديد، أي دفعة جديدة.
 *
 * ⚠️ **والسبب اللي بيخلّي الشاشة دي تقول أرقامًا بدل ما تسأل
 *    «متأكد؟»:** الجلسة بتتربط باشتراك اشترى عددًا محدّدًا. الجلسة
 *    اللي بعد العدد **جلسة ببلاش** — ممكن تكون مقصودة تمامًا
 *    (تعويض)، ومستحيل تكون بالغلط. فالرقم قدّام العين قبل الضغطة.
 */
export function AddSession({
  subscriptionId,
  nextNumber,
  quotaText,
  isExtra,
  instructors,
  defaultInstructorId,
}: {
  subscriptionId: string;
  nextNumber: number;
  quotaText: string;
  isExtra: boolean;
  instructors: { id: string; name: string }[];
  defaultInstructorId: string | null;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState('');
  const [instructorId, setInstructorId] = useState(defaultInstructorId ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ⚠️ **السبب مطلوب للجلسة الزيادة وحدها.** إلزامه في كل الحالات
  //    بيخلّيه خانة بتتملّى بـ«جلسة» وخلاص — والخانة اللي بتتملّى
  //    بالعادة مابتوثّقش حاجة.
  const reasonMissing = isExtra && reason.trim().length < 3;

  const submit = () =>
    startTransition(async () => {
      setError('');
      setNotice('');
      const result = await createSessionForSubscription({
        subscriptionId,
        scheduledAt: when,
        instructorId: instructorId || null,
        reason: reason.trim(),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNotice(
        result.roomReady
          ? `اتعملت جلسة ${result.sessionNumber} وغرفتها جاهزة.`
          : `اتعملت جلسة ${result.sessionNumber} — بس الغرفة ما اتعملتش. جهّزها من لوحة الغرف.`,
      );
      setWhen('');
      setReason('');
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-700">إضافة جلسة</p>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            <CalendarPlus className="h-4 w-4" />
            جلسة جديدة
          </button>
        )}
      </div>

      <p className="text-sm font-medium text-slate-600">{quotaText}</p>

      {notice && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
          {notice}
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          <FormError message={error} />

          {isExtra && (
            <p className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>
                دي <strong>جلسة زيادة عن المتعاقَد عليه</strong> — يعني جلسة
                ببلاش. اكتب السبب؛ بيتسجّل مع الجلسة.
              </span>
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">
                الموعد (بتوقيت القاهرة)
              </span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">المدرب</span>
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800"
              >
                <option value="">— بلا مدرب —</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">
              السبب {isExtra ? '(مطلوب)' : '(اختياري)'}
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              placeholder="تعويض عن جلسة ٣ اللي المدرب غاب فيها"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy || !when || reasonMissing}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
              )}
              اعمل جلسة {nextNumber}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-xl border-2 border-slate-200 bg-white px-5 py-3 font-bold text-slate-600 disabled:opacity-40"
            >
              إلغاء
            </button>
          </div>

          <p className="text-xs font-medium text-slate-500">
            بيتبعت إشعار للمدرب وللطالب بالموعد، وبتتعمل غرفة الجلسة مع
            الإنشاء.
          </p>
        </div>
      )}
    </div>
  );
}
