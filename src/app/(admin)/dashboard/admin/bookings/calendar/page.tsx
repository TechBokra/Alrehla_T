import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getParticipantName } from '@/data/domains/account';
import { getCurrentUser } from '@/data/domains/auth';
import { getSessions } from '@/data/domains/writing';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) {
    return <Unauthorized />;
  }

  const allBookings = await getSessions();
  
  // Sort by date ascending to simulate a timeline/calendar view
  const sorted = [...allBookings].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  
  const formatted = await Promise.all(sorted.map(async b => ({
    ...b,
    studentName: await getParticipantName(b.childId || b.userId, b.userId),
    idDisplay: <Link href={`/dashboard/admin/bookings/${b.id}`} className="font-bold text-blue-600 hover:underline">#{b.id.split('-')[1]}</Link>,
    dateDisplay: formatDate(b.scheduledAt),
    timeDisplay: new Date(b.scheduledAt).toLocaleTimeString('ar-EG', { timeZone: PLATFORM_TIMEZONE, hour: '2-digit', minute: '2-digit' })
  })));

  const columns = [
    { header: 'التاريخ', accessorKey: 'dateDisplay' },
    { header: 'الوقت', accessorKey: 'timeDisplay' },
    { header: 'رقم الحجز', accessorKey: 'idDisplay' },
    { header: 'الطالب', accessorKey: 'studentName' },
    { header: 'المدرب', accessorKey: 'instructorId' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="تقويم الحجوزات (جدول زمني)" backHref="/dashboard/admin/bookings" />
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
