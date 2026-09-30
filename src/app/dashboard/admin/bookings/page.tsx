import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getCourseBookingsForAdmin } from '@/data/domains/writing';
import { hasAdminPermission, formatDate, formatPrice } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { StatusBadge, type StatusBadgeType } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; type: StatusBadgeType }> = {
  pending: { label: 'بانتظار الدفع', type: 'pending' },
  awaiting_verification: { label: 'بانتظار مراجعة التحويل', type: 'pending' },
  active: { label: 'نشط', type: 'success' },
  completed: { label: 'مكتمل', type: 'neutral' },
  cancelled: { label: 'ملغي', type: 'neutral' },
};

/**
 * حجوزات الكتابة الإبداعية.
 *
 * الشاشة كانت مبنية على جدول **الجلسات**، وبتطابقها بطلبات الخدمات بنفس
 * الرقم («نفترض تطابق 1:1» زي ما كان مكتوب في الكود). والحجز الحقيقي هو
 * صف الاشتراك — والجلسات بتتجدول بعد تأكيد الدفع، مش قبله.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) {
    return <Unauthorized />;
  }

  const bookings = await getCourseBookingsForAdmin();

  const formatted = bookings.map((b) => ({
    ...b,
    idDisplay: (
      <Link
        href={`/dashboard/admin/bookings/${b.id}`}
        dir="ltr"
        className="block text-right font-mono text-sm font-bold text-blue-600 hover:underline"
      >
        {b.paymentReference ?? b.id}
      </Link>
    ),
    dateDisplay: formatDate(b.createdAt),
    amountDisplay: b.amount != null ? formatPrice(b.amount) : '—',
    instructorDisplay: b.preferredInstructorName ?? 'لم يُحدَّد',
    sessionsDisplay: b.sessionsCount > 0 ? `${b.sessionsCount} جلسة` : 'لم تُجدول',
    // ⚠️ الموافقة بتظهر للإدارة **لأنها الدليل**. الفاضي في حجز جديد
    //    معناه إن الكتابة فشلت — مش تفصيلة تتساب لحد ما تحصل شكوى.
    consentDisplay: b.recordingConsentAt ? (
      <StatusBadge type="success" label={`وافق · ${formatDate(b.recordingConsentAt)}`} />
    ) : (
      <StatusBadge type="neutral" label="—" />
    ),
    statusDisplay: (
      <StatusBadge
        type={STATUS[b.status]?.type ?? 'warning'}
        label={STATUS[b.status]?.label ?? b.status}
      />
    ),
  }));

  const columns = [
    { header: 'الرقم المرجعي', accessorKey: 'idDisplay' },
    { header: 'تاريخ الحجز', accessorKey: 'dateDisplay' },
    { header: 'المشارك', accessorKey: 'participantName' },
    { header: 'الباقة', accessorKey: 'packageName' },
    { header: 'المبلغ', accessorKey: 'amountDisplay' },
    { header: 'المدرب المفضل', accessorKey: 'instructorDisplay' },
    { header: 'الجلسات', accessorKey: 'sessionsDisplay' },
    { header: 'موافقة التسجيل', accessorKey: 'consentDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <DashboardPageHeader title="إدارة الحجوزات" />
        <Link
          href="/dashboard/admin/bookings/calendar"
          className="mb-6 rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 transition-colors hover:bg-slate-200"
        >
          عرض التقويم / مجدولة
        </Link>
      </div>
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
