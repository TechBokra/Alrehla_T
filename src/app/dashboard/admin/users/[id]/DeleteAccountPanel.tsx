'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Archive, Loader2, RotateCcw } from 'lucide-react';
import { deleteUserAccount, restoreArchivedAccount } from '@/actions/admin-users';
import { FormError } from '@/components/ui/FormError';
import { formatCairo } from '@/lib/timezone';

/** أسماء الحركات زي ما بترجع من `account_activity` (ملف 10). */
const ACTIVITY_LABELS: Record<string, string> = {
  orders: 'طلب منتجات',
  box_subscriptions: 'اشتراك صندوق',
  course_subscriptions: 'اشتراك باقة',
  service_orders: 'طلب خدمة إبداعية',
  reviews: 'تقييم',
  support_tickets: 'تذكرة دعم',
  session_requests: 'طلب جلسة',
  feedback: 'رأي',
  work_profiles: 'حساب شغل (مدرب/ناشر/مقدّم خدمة)',
};

/**
 * حذف الحساب — لمدير النظام (ملاحظة تامر).
 *
 * الشاشة بتقول **قبل الضغط** هيحصل إيه بالظبط:
 *   • مفيش حركات ← «هيتمسح نهائيًا».
 *   • فيه حركات ← «هيتقفل ويتأرشف» + الحركات بالعدد، عشان محدش يفتكر إن
 *     الطلبات والفلوس هتتمسح.
 */
export function DeleteAccountPanel({
  userId,
  fullName,
  activity,
  archivedAt,
  pendingRequest,
}: {
  userId: string;
  fullName: string;
  /** `null` = ملف 10 لسه ماتشغّلش. */
  activity: Record<string, number> | null;
  archivedAt?: string | null;
  /** العميل طالب حذف حسابه — بيتقفل الطلب مع الحذف. */
  pendingRequest?: { reason: string; createdAt: string } | null;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [open, setOpen] = useState(Boolean(pendingRequest));
  const [reason, setReason] = useState(pendingRequest ? 'بناءً على طلب العميل' : '');
  const [error, setError] = useState('');
  const [done, setDone] = useState<'deleted' | null>(null);

  if (done === 'deleted') {
    return (
      <section className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 font-bold text-emerald-900">
        الحساب اتمسح نهائيًا.{' '}
        <Link href="/dashboard/admin/users" className="underline">
          رجوع للمستخدمين
        </Link>
      </section>
    );
  }

  if (archivedAt) {
    const restore = () => {
      if (!window.confirm(`ترجّع حساب «${fullName}»؟ الدخول والشراء هيرجعوا.`)) return;
      startTransition(async () => {
        setError('');
        const r = await restoreArchivedAccount(userId);
        if (!r.ok) setError(r.error);
        else router.refresh();
      });
    };
    return (
      <section className="mb-6 rounded-2xl border border-slate-300 bg-slate-100 p-5">
        <h2 className="mb-1 flex items-center gap-2 font-black text-slate-800">
          <Archive className="h-5 w-5" /> حساب محذوف (مؤرشف)
        </h2>
        <p className="mb-3 text-sm font-medium text-slate-600">
          اتحذف {formatCairo(archivedAt, { dateStyle: 'medium', timeStyle: 'short' })} — الدخول
          مقفول، وطلباته وحركاته محفوظة تحت للرجوع ليها.
        </p>
        <FormError message={error} />
        <button
          type="button"
          onClick={restore}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-slate-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          اتحذف بالغلط؟ رجّعه
        </button>
      </section>
    );
  }

  const total = activity?.total ?? 0;
  const items = activity
    ? Object.entries(activity).filter(([k, n]) => k !== 'total' && n > 0)
    : [];
  const willArchive = total > 0;

  const run = () => {
    const msg = willArchive
      ? `حساب «${fullName}» عليه حركات، فهيتقفل للأبد ويتأرشف.\n\nطلباته وفلوسه هتفضل محفوظة. تأكيد؟`
      : `حساب «${fullName}» هيتمسح نهائيًا هو وحسابات أطفاله — مفيش رجوع.\n\nتأكيد؟`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      setError('');
      const r = await deleteUserAccount({ userId, reason });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.mode === 'deleted') setDone('deleted');
      else router.refresh();
    });
  };

  return (
    <section className="mb-6 rounded-2xl border border-rose-200 bg-white p-5">
      <h2 className="mb-2 flex items-center gap-2 font-black text-rose-900">
        <Trash2 className="h-5 w-5" /> حذف الحساب
      </h2>

      {pendingRequest && (
        <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
          العميل طالب حذف حسابه ({pendingRequest.createdAt})
          {pendingRequest.reason ? ` — «${pendingRequest.reason}»` : ''}. الطلب هيتقفل مع الحذف.
        </p>
      )}

      {activity === null ? (
        <p className="text-sm font-medium text-slate-600">
          الحذف محتاج ملف القاعدة 10 يتشغّل الأول.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm font-medium leading-relaxed text-slate-600">
            {willArchive ? (
              <>
                الحساب ده <strong className="text-slate-800">عليه حركات</strong> (
                {items.map(([k, n]) => `${n.toLocaleString('ar-EG')} ${ACTIVITY_LABELS[k] ?? k}`).join(' · ')}
                )، فالحذف هيكون <strong className="text-slate-800">قفل للأبد وأرشفة</strong>: مش هيقدر
                يدخل، وهيختفي من القايمة، وكل حركاته تفضل محفوظة.
              </>
            ) : (
              <>
                مفيش أي حركات على الحساب ده، فالحذف{' '}
                <strong className="text-slate-800">نهائي</strong> — هو وحسابات أطفاله.
              </>
            )}
          </p>

          <FormError message={error} />

          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-rose-200 px-5 py-3 font-bold text-rose-700 hover:border-rose-400"
            >
              <Trash2 className="h-4 w-4" />
              احذف الحساب
            </button>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-600">سبب الحذف (مطلوب)</span>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy}
                  placeholder="حساب تجريبي، أو بطلب العميل…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={run}
                  disabled={busy || reason.trim().length < 3}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 font-bold text-white hover:bg-rose-700 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : willArchive ? (
                    <Archive className="h-4 w-4" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {willArchive ? 'اقفله وأرشفه' : 'احذفه نهائيًا'}
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
        </>
      )}
    </section>
  );
}
