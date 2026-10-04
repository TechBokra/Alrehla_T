import React from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser, getAllUsers } from '@/data/domains/auth';
import { getFeedbackForLine } from '@/data/domains/feedback';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { FEEDBACK_LINE_LABELS, type FeedbackLine } from '@/lib/feedback-lines';
import { FeedbackSeenButton } from './FeedbackSeenButton';

/**
 * آراء العملاء لخط واحد — تبويب في «طلبات المنتجات» لـ«إنها لك»، وفي
 * «الباقات والاشتراكات» لـ«بداية الرحلة» (ملاحظة تامر: الرأي يروح لقسمه).
 */
export async function FeedbackListPage({ line }: { line: FeedbackLine }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSupport')) return <Unauthorized />;

  const [rows, users] = await Promise.all([getFeedbackForLine(line), getAllUsers()]);
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  const label = FEEDBACK_LINE_LABELS[line];

  const avg = rows && rows.length > 0 ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
  const fresh = rows?.filter((r) => r.status === 'new').length ?? 0;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`آراء العملاء — ${label}`} />

      {rows === null ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 font-bold text-amber-900">
          الشاشة دي محتاجة ملف القاعدة 10 يتشغّل.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center font-medium text-slate-600">
          مفيش آراء لسه. العميل بيكتب رأيه من حسابه («رأيك يهمنا») بعد أول طلب أو اشتراك في «{label}».
        </p>
      ) : (
        <>
          <p className="mb-6 text-sm font-bold text-slate-600">
            {rows.length.toLocaleString('ar-EG')} رأي · متوسط{' '}
            {avg.toLocaleString('ar-EG', { maximumFractionDigits: 1 })} من ٥
            {fresh > 0 && ` · ${fresh.toLocaleString('ar-EG')} جديد`}
          </p>
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className={`rounded-2xl border p-5 ${
                  r.status === 'new' ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <Link href={`/dashboard/admin/users/${r.userId}`} className="text-blue-700 hover:underline">
                      {nameById.get(r.userId) ?? 'عميل'}
                    </Link>
                    <span className="text-amber-500" aria-label={`${r.rating} من ٥`}>
                      {'★'.repeat(r.rating)}
                      <span className="text-slate-300">{'★'.repeat(5 - r.rating)}</span>
                    </span>
                    <span className="text-xs font-medium text-slate-400">{formatDate(r.createdAt)}</span>
                  </div>
                  <FeedbackSeenButton id={r.id} seen={r.status === 'seen'} />
                </div>
                {r.comment ? (
                  <p className="text-sm leading-relaxed text-slate-700">{r.comment}</p>
                ) : (
                  <p className="text-sm text-slate-400">تقييم من غير تعليق</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
