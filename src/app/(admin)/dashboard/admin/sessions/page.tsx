import React from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getSessionsForAdmin } from '@/data/domains/writing';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { sessionStatusView } from '@/lib/session-status';
import { formatCairo } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * الجلسات وتقارير المدربين.
 *
 * ── البلاغ اللي الصفحة دي بترد عليه ─────────────────────────
 *
 * «المدرب أرسل تقريرًا وجاءت رسالة بأنه تم تسجيل الجلسة بنجاح، ولكن
 *  **لم أجد في لوحة تحكم الإدارة أي صفحة لمتابعة هذه التقارير**…
 *  ولم يظهر التقرير المرسل في أي مكان من السلسلة.»
 *
 * ⚠️ **الصفحة اللي بتعرض التقرير كانت موجودة.** اللي مكانش موجود هو
 *    **القايمة اللي تودّي لها**: مفيش فهرس، ومفيش رابط في القايمة
 *    الجانبية. تقرير محفوظ في القاعدة، وشاشة سليمة بتعرضه، ومفيش
 *    طريق بينهم. والإدارة بتقول «التقرير ضاع» وهو مش ضايع.
 *
 * ── وليه «تحتاج متابعة» هي أول تبويب ────────────────────────
 *
 * القايمة مرتّبة بالمعاد، والافتراضي هو الجلسات اللي **معادها فات
 * وما اتقفلتش** — لأن دي الشغل الإداري الحقيقي: يا إما المدرب نسي
 * التقرير، يا إما الحصة ما حصلتش وحد لازم يسأل.
 */

type Filter = 'attention' | 'reported' | 'upcoming' | 'all';

const TABS: { key: Filter; label: string }[] = [
  { key: 'attention', label: 'تحتاج متابعة' },
  { key: 'reported', label: 'فيها تقرير' },
  { key: 'upcoming', label: 'قادمة' },
  { key: 'all', label: 'كل الجلسات' },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) {
    return <Unauthorized />;
  }

  const { filter: raw } = await searchParams;
  const filter: Filter = TABS.some((t) => t.key === raw) ? (raw as Filter) : 'attention';

  const sessions = await getSessionsForAdmin();

  // ⚠️ العدّادات بتتحسب على **الكل** لا على المعروض — عشان الرقم على
  //    التبويب يفضل صح وإنت واقف على تبويب تاني.
  const counts = {
    attention: sessions.filter((s) => s.isOverdue).length,
    reported: sessions.filter((s) => s.reportedAt).length,
    upcoming: sessions.filter((s) => !s.isOverdue && s.status !== 'completed' && s.status !== 'cancelled').length,
    all: sessions.length,
  };

  const visible = sessions.filter((s) => {
    if (filter === 'attention') return s.isOverdue;
    if (filter === 'reported') return Boolean(s.reportedAt);
    if (filter === 'upcoming')
      return !s.isOverdue && s.status !== 'completed' && s.status !== 'cancelled';
    return true;
  });

  const rows = visible.map((s) => {
    const view = sessionStatusView(s.status);
    return {
      ...s,
      sessionDisplay: (
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
      dateDisplay: (
        <span className={s.isOverdue ? 'font-bold text-rose-700' : undefined}>
          {formatCairo(s.scheduledAt, { dateStyle: 'medium', timeStyle: 'short' })}
          {s.isOverdue ? ' ⚠️' : ''}
        </span>
      ),
      instructorDisplay: s.instructorName ?? 'لم يُسنَد',
      statusDisplay: <StatusBadge type={view.badge} label={view.label} />,
      // ⚠️ تلات حالات مختلفة، لا اتنين: فيه تقرير بحضور، فيه تقرير
      //    بغياب، ومفيش تقرير. الغياب مش نجاح.
      reportDisplay: !s.reportedAt ? (
        <StatusBadge
          type={s.isOverdue ? 'danger' : 'neutral'}
          label={s.isOverdue ? 'متأخر — بلا تقرير' : 'لم يُسجَّل بعد'}
        />
      ) : (
        <div className="space-y-1">
          <StatusBadge
            type={s.attendance === 'absent' ? 'warning' : 'success'}
            label={s.attendance === 'absent' ? 'لم يحضر' : 'حضر'}
          />
          <p className="max-w-xs truncate text-xs font-medium text-slate-500">
            {s.reportText || 'بدون ملاحظات'}
          </p>
        </div>
      ),
    };
  });

  const columns = [
    { header: 'الجلسة', accessorKey: 'sessionDisplay' },
    { header: 'الرقم المرجعي', accessorKey: 'referenceDisplay' },
    { header: 'المتدرب', accessorKey: 'participantName' },
    { header: 'الباقة', accessorKey: 'packageName' },
    { header: 'المدرب', accessorKey: 'instructorDisplay' },
    { header: 'الموعد', accessorKey: 'dateDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' },
    { header: 'التقرير', accessorKey: 'reportDisplay' },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title="الجلسات وتقارير المدربين"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.key === filter;
          return (
            <Link
              key={tab.key}
              href={`/dashboard/admin/sessions?filter=${tab.key}`}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                active
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'
              }`}
            >
              {tab.label}
              <span
                className={`ms-2 rounded-full px-2 py-0.5 text-xs ${
                  active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {counts[tab.key]}
              </span>
            </Link>
          );
        })}
      </div>

      {filter === 'attention' && counts.attention > 0 && (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          الجلسات دي معادها فات وما اتقفلتش. الجلسة بتتقفل لمّا المدرب
          يسجّل التقرير — فاللي بلا تقرير هنا يا إما المدرب نسيه، يا إما
          الحصة ما حصلتش.
        </p>
      )}

      <SimpleDataTable
        columns={columns}
        data={rows}
        pageSize={20}
        searchPlaceholder="ابحث باسم المتدرب أو المدرب أو الرقم المرجعي..."
        emptyMessage={
          filter === 'attention'
            ? 'مفيش جلسة متأخرة بلا إقفال — كل حاجة في معادها.'
            : 'لا توجد جلسات في هذا التصنيف.'
        }
      />
    </div>
  );
}
