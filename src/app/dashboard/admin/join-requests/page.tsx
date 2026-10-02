import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getJoinRequests } from '@/data/domains/admin';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { joinRequestRoleLabel } from '@/lib/join-roles';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSupport')) {
    return <Unauthorized />;
  }

  const requests = await getJoinRequests();

  // المقبول من غير حساب = لسه فيه خطوة. «مقبول» لوحدها كانت بتتقري «خلاص».
  const approvedEmails = requests
    .filter((r) => r.status === 'approved' && r.email)
    .map((r) => r.email!.trim().toLowerCase());
  const supabase = await createClient();
  const { data: existing } = approvedEmails.length
    ? await supabase.from('user_emails').select('email').in('email', approvedEmails)
    : { data: [] as { email: string }[] };
  const hasAccount = new Set((existing ?? []).map((e) => e.email.toLowerCase()));
  const waitingAccount = (r: (typeof requests)[number]) =>
    r.status === 'approved' && !!r.email && !hasAccount.has(r.email.trim().toLowerCase());

  const formatted = requests.map(r => ({
    ...r,
    nameDisplay: <Link href={`/dashboard/admin/join-requests/${r.id}`} className="font-bold text-blue-600 hover:underline">{r.applicantName}</Link>,
    roleDisplay: joinRequestRoleLabel(r.requestedRole),
    dateDisplay: formatDate(r.createdAt),
    statusDisplay: (
      waitingAccount(r) ? (
        <StatusBadge type="pending" label="مقبول — الحساب لسه ما اتعملش" />
      ) : (
        <StatusBadge
          type={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}
          label={r.status === 'approved' ? 'مقبول' : r.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
        />
      )
    )
  }));

  const columns = [
    { header: 'الاسم', accessorKey: 'nameDisplay' },
    { header: 'الدور المطلوب', accessorKey: 'roleDisplay' },
    { header: 'تاريخ التقديم', accessorKey: 'dateDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="طلبات الانضمام (مدربين/ناشرين)" />
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
