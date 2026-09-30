'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, RotateCcw, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { setUserSuspension } from '@/actions/admin-users';
import { FormError } from '@/components/ui/FormError';
import { formatCairo } from '@/lib/timezone';

/**
 * إيقاف حساب عن الشراء — وفكّه.
 *
 * ── الشاشة بتقول اللي بيحصل بالظبط، مش «إيقاف» ──────────────
 *
 * ⚠️ **الإيقاف عندنا مش منع دخول.** الموقوف بيفضل شايف جلساته
 *    اللي دفع تمنها ومعرض شغل ابنه وطلباته القديمة؛ اللي بيتمنع
 *    **الطلب الجديد**.
 *
 *    والكلمة لوحدها بتتقري «اتقفل برّه»، وإداري فاكرها كده ممكن
 *    يستعملها في موقف مش مناسب لها — أو يتجنّبها في موقف مناسب.
 *    فالشاشة بتسرد المسموح والممنوع بدل ما تسمّي الإجراء وخلاص.
 *
 * ⚠️ **والسبب مطلوب عند الإيقاف لا عند فكّه** — ده الأثر الوحيد
 *    اللي بيفضل لو حد سأل بعد شهور «ليه الحساب ده كان موقوف؟».
 */
export function SuspensionPanel({
  userId,
  fullName,
  suspendedAt,
  suspensionReason,
  isAdminAccount,
}: {
  userId: string;
  fullName: string;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  isAdminAccount: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const suspended = Boolean(suspendedAt);

  // ⚠️ القاعدة بترفض إيقاف الحسابات الإدارية (ملف 118). إخفاء الزرّ
  //    راحة للعين؛ الرفض الحقيقي هناك.
  if (isAdminAccount) {
    return (
      <div className="mb-6 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
        <ShieldCheck className="h-5 w-5 shrink-0 text-slate-400" />
        <span>
          ده حساب إداري — <strong className="text-slate-800">مابيتوقفش</strong>. الإيقاف
          إجراء على الشراء، والإداري مش بيشتري.
        </span>
      </div>
    );
  }

  const run = (suspend: boolean) => {
    if (suspend) {
      const sure = window.confirm(
        `هتوقف «${fullName}» عن الشراء الجديد.\n\n` +
          'هيفضل يدخل حسابه ويشوف جلساته وطلباته القديمة عادي — ' +
          'اللي هيتمنع الطلب الجديد وبس.\n\nتأكيد؟',
      );
      if (!sure) return;
    }

    startTransition(async () => {
      setError('');
      const result = await setUserSuspension({ userId, suspend, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReason('');
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <section
      className={`mb-6 rounded-2xl border p-5 ${
        suspended ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'
      }`}
    >
      <h2
        className={`mb-2 flex items-center gap-2 font-black ${
          suspended ? 'text-rose-900' : 'text-slate-800'
        }`}
      >
        {suspended ? <Ban className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5 text-slate-400" />}
        {suspended ? 'الحساب موقوف عن الشراء' : 'الشراء متاح للحساب ده'}
      </h2>

      {suspended ? (
        <div className="mb-4 space-y-1 text-sm font-bold text-rose-900">
          <p>
            من {suspendedAt ? formatCairo(suspendedAt, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
          </p>
          {suspensionReason && <p>السبب المسجَّل: {suspensionReason}</p>}
        </div>
      ) : (
        <p className="mb-4 text-sm leading-relaxed font-medium text-slate-600">
          الإيقاف بيمنع <strong className="text-slate-800">الطلبات الجديدة</strong> في
          المتجر والباقات والخدمات الإبداعية. ومابيمنعش الدخول: الحساب بيفضل
          شايف جلساته اللي دفع تمنها ومعرض شغل ابنه وطلباته القديمة.
        </p>
      )}

      <FormError message={error} />

      {suspended ? (
        <button
          type="button"
          onClick={() => run(false)}
          disabled={busy}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          فكّ الإيقاف
        </button>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-2 rounded-xl border-2 border-rose-200 px-5 py-3 font-bold text-rose-700 transition-colors hover:border-rose-400"
        >
          <Ban className="h-4 w-4" />
          أوقف الشراء
        </button>
      ) : (
        <div className="mt-2 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">
              سبب الإيقاف (مطلوب)
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              placeholder="تحويل مرتجع، أو بلاغ قيد المراجعة…"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800"
            />
          </label>

          <p className="flex gap-2 text-xs font-medium text-slate-500">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            السبب بيتسجّل مع الحساب وفي سجلّ التدقيق — ده اللي هيتقري لو حد
            سأل بعدين.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => run(true)}
              disabled={busy || reason.trim().length < 3}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              أوقف الشراء
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
        </div>
      )}
    </section>
  );
}
