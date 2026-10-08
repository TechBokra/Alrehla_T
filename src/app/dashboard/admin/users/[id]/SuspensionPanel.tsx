'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, RotateCcw, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { setUserSuspension } from '@/actions/admin-users';
import { FormError } from '@/components/ui/FormError';
import { Field, TextInput, BusyButton } from '@/components/forms/Form';
import { formatCairo } from '@/lib/timezone';

/**
 * إيقاف حساب عن الشراء، أو **تعليقه بالكامل** (منع الدخول كمان) — وفكّه.
 *
 * التعليق الكامل اتضاف بطلب تامر («امكانية تعليق الحساب»). والإيقاف عن
 * الشراء بس فضل اختيار، لأنه الأنسب لخلاف على دفعة: الأهل بيفضلوا
 * شايفين الجلسات اللي دفعوا تمنها.
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
  loginBlocked = false,
}: {
  userId: string;
  fullName: string;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  isAdminAccount: boolean;
  /** محظور في Auth — يعني التعليق كامل مش شراء بس. */
  loginBlocked?: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [blockLogin, setBlockLogin] = useState(false);
  const [error, setError] = useState('');
  // الخطأ على خانة السبب نفسها؟ بيظهر تحتها بدل الصندوق.
  const [errorField, setErrorField] = useState<string | undefined>();

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
        blockLogin
          ? `هتعلّق حساب «${fullName}» بالكامل.\n\n` +
              'مش هيقدر يسجّل دخول ولا يشتري لحد ما تفكّ التعليق.\n\nتأكيد؟'
          : `هتوقف «${fullName}» عن الشراء الجديد.\n\n` +
              'هيفضل يدخل حسابه ويشوف جلساته وطلباته القديمة عادي — ' +
              'اللي هيتمنع الطلب الجديد وبس.\n\nتأكيد؟',
      );
      if (!sure) return;
    }

    startTransition(async () => {
      setError('');
      setErrorField(undefined);
      const result = await setUserSuspension({ userId, suspend, reason, blockLogin });
      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field);
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
        {suspended
          ? loginBlocked
            ? 'الحساب معلَّق — لا دخول ولا شراء'
            : 'الحساب موقوف عن الشراء (الدخول مسموح)'
          : 'الحساب شغّال'}
      </h2>

      {suspended ? (
        <div className="mb-4 space-y-1 text-sm font-bold text-rose-900">
          <p>
            من {suspendedAt ? formatCairo(suspendedAt, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
          </p>
          {suspensionReason && <p>السبب المسجَّل: {suspensionReason}</p>}
        </div>
      ) : (
        <ul className="mb-4 space-y-1 text-sm leading-relaxed font-medium text-slate-600">
          <li>
            • <strong className="text-slate-800">إيقاف الشراء</strong>: بيمنع الطلبات الجديدة بس،
            والحساب بيفضل شايف جلساته اللي دفع تمنها وطلباته القديمة.
          </li>
          <li>
            • <strong className="text-slate-800">تعليق كامل</strong>: كمان مايقدرش يسجّل دخول
            خالص لحد ما تفكّه.
          </li>
        </ul>
      )}

      <FormError message={errorField ? '' : error} />

      {suspended ? (
        <button
          type="button"
          onClick={() => run(false)}
          disabled={busy}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          {loginBlocked ? 'فكّ التعليق' : 'فكّ الإيقاف'}
        </button>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-2 rounded-xl border-2 border-rose-200 px-5 py-3 font-bold text-rose-700 transition-colors hover:border-rose-400"
        >
          <Ban className="h-4 w-4" />
          أوقف أو علّق الحساب
        </button>
      ) : (
        <div className="mt-2 space-y-3">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">نوع الإيقاف</legend>
            {[
              { v: false, t: 'إيقاف الشراء بس', d: 'يدخل ويشوف اللي دفع تمنه' },
              { v: true, t: 'تعليق كامل', d: 'لا دخول ولا شراء' },
            ].map((o) => (
              <label
                key={o.t}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-3 ${
                  blockLogin === o.v ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="suspension-kind"
                  checked={blockLogin === o.v}
                  onChange={() => setBlockLogin(o.v)}
                  disabled={busy}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-black text-slate-800">{o.t}</span>
                  <span className="block text-xs font-medium text-slate-500">{o.d}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <Field
            label="السبب"
            name="reason"
            required
            error={errorField === 'reason' ? error : undefined}
          >
            <TextInput
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              placeholder="تحويل مرتجع، أو بلاغ قيد المراجعة…"
            />
          </Field>

          <p className="flex gap-2 text-xs font-medium text-slate-500">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            السبب بيتسجّل مع الحساب وفي سجلّ التدقيق — ده اللي هيتقري لو حد
            سأل بعدين.
          </p>

          <div className="flex flex-wrap gap-3">
            <BusyButton
              variant="danger"
              busy={busy}
              pendingLabel="جارٍ التنفيذ…"
              onClick={() => run(true)}
              disabled={reason.trim().length < 3}
            >
              <Ban className="h-4 w-4" />
              {blockLogin ? 'علّق الحساب' : 'أوقف الشراء'}
            </BusyButton>
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
