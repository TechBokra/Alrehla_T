import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getInstructors, getSessions } from '@/data/domains/writing';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { sessionStatusView } from '@/lib/session-status';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageInstructors')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const instructors = await getInstructors();
  const target = instructors.find(i => i.id === id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!target) notFound();
  
  const allSessions = await getSessions();
  const instructorSessions = allSessions.filter(s => s.instructorId === target.id);

  const formattedSessions = instructorSessions.map(s => {
    const view = sessionStatusView(s.status);
    return {
      ...s,
      // ⚠️ كان بيودّي لـ`/dashboard/admin/bookings/<معرّف الجلسة>` —
      //    **مسار الحجوزات بمعرّف جلسة**، يعني «غير موجود» دايمًا.
      //    والعنوان كان `#${b.id.split('-')[1]}` — قطعة من UUID
      //    مالهاش معنى، معروضة تحت اسم «رقم الحجز» وهي مش رقم حجز.
      idDisplay: (
        <Link
          href={`/dashboard/admin/sessions/${s.id}`}
          className="font-bold text-blue-600 hover:underline"
        >
          جلسة {s.sessionNumber}
        </Link>
      ),
      referenceDisplay: (
        <span dir="ltr" className="block text-right font-mono text-xs text-slate-500">
          {s.paymentReference ?? '—'}
        </span>
      ),
      participantDisplay: s.packageName ?? '—',
      dateDisplay: formatDate(s.scheduledAt),
      // الحالة كانت بتتعرض خام بالإنجليزي، و`confirmed` وحدها كانت
      //  ملوّنة — وهي القيمة اللي **القاعدة عمرها ما كتبتها**.
      statusDisplay: <StatusBadge type={view.badge} label={view.label} />,
    };
  });

  const columns = [
    { header: 'الجلسة', accessorKey: 'idDisplay' },
    { header: 'الرقم المرجعي', accessorKey: 'referenceDisplay' },
    { header: 'الباقة', accessorKey: 'participantDisplay' },
    { header: 'تاريخ الجلسة', accessorKey: 'dateDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`جلسات المدرب: ${target.displayName}`} backHref={`/dashboard/admin/instructors/${target.id}`} />
      <SimpleDataTable columns={columns} data={formattedSessions} />
    </div>
  );
}
