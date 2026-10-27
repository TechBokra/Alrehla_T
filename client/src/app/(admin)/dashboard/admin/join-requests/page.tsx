import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getJoinFollowUps, getJoinRequests } from '@/data/domains/(admin)/join-requests/queries';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { joinRequestRoleLabel } from '@/lib/join-roles';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { id: 'action', label: 'محتاج تصرّف' },
  { id: 'waiting', label: 'مستنيين المتقدّم' },
  { id: 'all', label: 'الكل' },
] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageSupport')) {
    return <Unauthorized />;
  }

  const all = await getJoinRequests();
  // ⚠️ الافتراضي «محتاج تصرّف» (طلب تامر، ٢٧ أكتوبر): الجديد، واللي وصل
  //    فيه رد، واللي المتقدّم اتأخر فيه. اللي رديت عليه ومستني بيتخبّى هنا.
  const followUps = await getJoinFollowUps(all);
  const sp = await searchParams;
  const filter = (FILTERS.find((f) => f.id === sp.filter)?.id ?? 'action') as (typeof FILTERS)[number]['id'];
  const counts = {
    action: all.filter((r) => followUps.get(r.id)?.needsAction).length,
    waiting: all.filter((r) => followUps.get(r.id)?.kind === 'waiting').length,
    all: all.length,
  };
  const requests = all
    .filter((r) =>
      filter === 'all' ? true : filter === 'waiting' ? followUps.get(r.id)?.kind === 'waiting' : followUps.get(r.id)?.needsAction,
    )
    // الأقدم في الانتظار الأول.
    .sort((a, b) => (followUps.get(b.id)?.days ?? 0) - (followUps.get(a.id)?.days ?? 0));

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
    followDisplay: (() => {
      const f = followUps.get(r.id);
      if (!f) return <span className="text-xs text-slate-400">—</span>;
      const tone =
        f.kind === 'replied' || f.late
          ? 'bg-rose-50 text-rose-800'
          : f.kind === 'new' || f.kind === 'stale'
            ? 'bg-amber-50 text-amber-900'
            : 'bg-slate-100 text-slate-600';
      return <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>{f.label}</span>;
    })(),
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
    { header: 'المتابعة', accessorKey: 'followDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="طلبات الانضمام (مدربين/ناشرين)" />
      <nav aria-label="فلترة الطلبات" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`?filter=${f.id}`}
            aria-current={filter === f.id ? 'page' : undefined}
            className={`min-h-[40px] rounded-full border px-4 py-2 text-sm font-bold ${
              filter === f.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {f.label} ({counts[f.id].toLocaleString('ar-EG')})
          </Link>
        ))}
      </nav>
      {requests.length === 0 ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center font-bold text-emerald-900">
          {filter === 'action'
            ? 'مفيش طلب محتاج منك حاجة دلوقتي. الطلبات اللي رديت عليها في «مستنيين المتقدّم».'
            : 'مفيش طلبات هنا.'}
        </p>
      ) : (
        <SimpleDataTable columns={columns} data={formatted} />
      )}
    </div>
  );
}
