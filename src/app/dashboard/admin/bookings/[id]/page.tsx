import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getCourseBookingsForAdmin, getInstructors } from '@/data/domains/writing';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { PaymentReviewPanel } from '@/components/admin/PaymentReviewPanel';
import { ConfirmPaymentButton } from '@/components/dashboard/ConfirmPaymentButton';
import { AssignInstructor } from './AssignInstructor';
import { AddSession } from './AddSession';
import { getSubscriptionSessionPlan } from '@/data/domains/session-admin';
import { quotaNotice } from '@/lib/session-plan';
import { formatCairo } from '@/lib/timezone';
import { sessionStatusView } from '@/lib/session-status';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending: 'بانتظار الدفع',
  awaiting_verification: 'بانتظار مراجعة التحويل',
  active: 'نشط',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

/**
 * تفاصيل حجز كتابة.
 *
 * الصفحة كانت بتقرا **جلسة** وبتطابقها بطلب خدمة بنفس الرقم، وبتبعت رقم
 * الجلسة لدالة تأكيد الدفع اللي بتنتظر رقم اشتراك. دلوقتي الصفحة على
 * الاشتراك نفسه، فالتأكيد بيوصل للصف الصح.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const [bookings, instructors, plan] = await Promise.all([
    getCourseBookingsForAdmin(),
    getInstructors(),
    getSubscriptionSessionPlan(id),
  ]);
  const target = bookings.find((b) => b.id === id);
  if (!target) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title={`تفاصيل الحجز ${target.paymentReference ?? ''}`}
        backHref="/dashboard/admin/bookings"
      />

      <PaymentReviewPanel
        reference={target.paymentReference}
        amount={target.amount ?? 0}
        method={target.paymentMethod}
        receiptUrl={target.paymentReceiptUrl}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <div className="mb-1 text-sm text-slate-500">المشارك</div>
            <div className="text-lg font-bold text-slate-800">{target.participantName}</div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-500">الباقة</div>
            <div className="text-lg font-bold text-slate-800">{target.packageName}</div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-500">حالة الحجز</div>
            <div className="text-lg font-bold text-slate-800">
              {STATUS_LABEL[target.status] ?? target.status}
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-500">المدرب المفضل</div>
            <div className="text-lg font-bold text-slate-800">
              {target.preferredInstructorName ?? 'لم يُحدَّد'}
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-500">تاريخ الحجز</div>
            <div className="text-lg font-bold text-slate-800">{formatDate(target.createdAt)}</div>
          </div>
          <div>
            <div className="mb-1 text-sm text-slate-500">الجلسات</div>
            <div className="text-lg font-bold text-slate-800">
              {target.sessionsCount > 0 ? `${target.sessionsCount} جلسة` : 'لم تُجدول بعد'}
            </div>
          </div>
        </div>

        {/* الإهداء الخاص — اللي العميل كتبه وقت الحجز. بيتقفل بعد
            الإنشاء، فاللي ظاهر هنا هو نص العميل الأصلي. */}
        {target.giftMessage && (
          <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="mb-2 text-sm font-bold text-emerald-900">إهداء خاص</div>
            <p className="whitespace-pre-wrap text-lg font-medium text-slate-800">
              {target.giftMessage}
            </p>
          </div>
        )}

        <AssignInstructor
          subscriptionId={target.id}
          currentId={target.preferredInstructorId}
          instructors={instructors
            .filter((i) => i.status === 'active')
            .map((i) => ({ id: i.id, name: i.displayName }))}
        />

        {/* ── الجلسات ───────────────────────────────────── */}
        {plan && (
          <div className="mb-8">
            <AddSession
              subscriptionId={target.id}
              nextNumber={plan.nextNumber}
              quotaText={quotaNotice(plan.quota)}
              isExtra={plan.quota.isExtra}
              defaultInstructorId={plan.instructorId}
              instructors={instructors
                .filter((i) => i.status === 'active')
                .map((i) => ({ id: i.id, name: i.displayName }))}
            />

            {plan.sessions.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {plan.sessions.map((session) => {
                  const view = sessionStatusView(session.status);
                  return (
                    <li
                      key={session.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <span className="font-bold text-slate-800">
                        جلسة {session.sessionNumber}
                      </span>
                      <span className="text-sm font-medium text-slate-600">
                        {formatCairo(session.scheduledAt, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      <StatusBadge type={view.badge} label={view.label} />
                      {/* ⚠️ الغرفة الناقصة معناها إن المدرب والطالب
                          مالهمش مكان يتقابلوا فيه لما ييجي الميعاد. */}
                      {session.hasRoom ? (
                        <StatusBadge type="success" label="الغرفة جاهزة" />
                      ) : (
                        <StatusBadge type="danger" label="بلا غرفة" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {target.status === 'awaiting_verification' && (
          <div className="mb-6">
            <ConfirmPaymentButton
              kind="booking"
              targetId={target.id}
              label="تأكيد استلام الدفع وتفعيل الحجز"
            />
            <p className="mt-2 text-xs font-medium text-slate-500">
              راجع الإيصال والمبلغ فوق قبل التأكيد. بعد التفعيل تُجدول الجلسات.
            </p>
          </div>
        )}

        <div className="flex gap-4 border-t border-slate-100 pt-6">
          <Link
            href="/dashboard/admin/bookings/calendar"
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-700"
          >
            تقويم الجلسات
          </Link>
        </div>
      </div>
    </div>
  );
}
