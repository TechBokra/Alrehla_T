import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { StatusBadge } from '@/components/StatusBadge';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import {
  getStudioMode,
  getStudioStages,
  getStudioTasks,
  listStudioProjects,
  listStudioStaff,
} from '@/data/domains/(admin)/studio/queries';
import { DeadlineChip } from '@/components/admin/DeadlineChip';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import {
  OWNER_LABELS,
  STUDIO_PIPELINE,
  isStudioStatus,
  isTerminal,
  stageOwner,
  statusLabel,
  statusTone,
} from '@/lib/studio';

export const dynamic = 'force-dynamic';

type View = 'active' | 'mine' | 'hold' | 'done';

const VIEWS: { id: View; label: string }[] = [
  { id: 'active', label: 'الشغّال' },
  { id: 'mine', label: 'مشاريعي' },
  { id: 'hold', label: 'موقوف' },
  { id: 'done', label: 'منتهي' },
];

export default async function StudioInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canWorkStudio')) return <Unauthorized />;
  const canManage = hasAdminPermission(user, 'canManageStudio');

  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.id === sp.view) ? (sp.view as View) : 'active';
  const statusFilter = sp.status && isStudioStatus(sp.status) ? sp.status : null;

  const [mode, result, staff, stages, tasks] = await Promise.all([
    getStudioMode(),
    listStudioProjects(),
    listStudioStaff(),
    getStudioStages(),
    getStudioTasks(),
  ]);
  const label = (s: string) => statusLabel(s, stages.labels);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const all = result.success ? result.data : [];

  const mine = (p: (typeof all)[number]) => p.editorId === user.id || p.artLeadId === user.id;
  const shown = all.filter((p) => {
    if (statusFilter) return p.status === statusFilter;
    if (view === 'mine') return mine(p) && !isTerminal(p.status);
    if (view === 'hold') return p.status === 'on_hold';
    if (view === 'done') return isTerminal(p.status);
    return !isTerminal(p.status) && p.status !== 'on_hold';
  });

  const counts = new Map<string, number>();
  for (const p of all) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-12">
      <DashboardPageHeader
        title="استوديو القصص"
        action={canManage ? { label: 'الإعدادات', href: '/dashboard/admin/studio/settings' } : undefined}
      />

      {mode === 'off' && (
        <p role="status" className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
          الاستوديو مقفول: مفيش مشاريع بتتفتح تلقائيًا عند الدفع.{' '}
          {canManage ? (
            <Link href="/dashboard/admin/studio/settings" className="underline">
              شغّله من الإعدادات
            </Link>
          ) : (
            'اطلب من مسؤول الإنتاج تشغيله.'
          )}
        </p>
      )}

      {!result.success && (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-900">
          {result.error.message}{' '}
          {canManage && (
            <Link href="/dashboard/admin/studio/settings" className="underline">
              شوف حالة التجهيز
            </Link>
          )}
        </p>
      )}

      {/* عدّاد المراحل — كل رقم رابط فلتر */}
      <nav aria-label="المراحل" className="flex flex-wrap gap-2">
        {STUDIO_PIPELINE.filter(
          // التبويب المخفي من الإعدادات مابيختفيش وفيه مشاريع (عشان ماحدّش يتوه).
          (s) => s !== 'delivered' && (!stages.hiddenTabs.includes(s) || (counts.get(s) ?? 0) > 0 || statusFilter === s),
        ).map((s) => {
          const n = counts.get(s) ?? 0;
          const active = statusFilter === s;
          return (
            <Link
              key={s}
              href={`/dashboard/admin/studio?status=${s}`}
              aria-current={active ? 'true' : undefined}
              className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {label(s)} · {n.toLocaleString('ar-EG')}
            </Link>
          );
        })}
      </nav>

      <div role="tablist" aria-label="العرض" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const active = !statusFilter && view === v.id;
          return (
            <Link
              key={v.id}
              role="tab"
              aria-selected={active}
              href={`/dashboard/admin/studio?view=${v.id}`}
              className={`min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-bold ${
                active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {v.label}
            </Link>
          );
        })}
        {statusFilter && (
          <Link href="/dashboard/admin/studio" className="min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 underline">
            إلغاء فلتر «{label(statusFilter)}»
          </Link>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
          {all.length === 0 ? 'لسه مفيش مشاريع قصص.' : 'مفيش مشاريع في العرض ده.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => {
            const owner = OWNER_LABELS[stageOwner(p.status)];
            const tk = tasks.get(p.id);
            return (
              <li key={p.id}>
                <Link
                  href={`/dashboard/admin/studio/${p.id}`}
                  className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-400 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-lg font-black text-slate-900 [overflow-wrap:anywhere]">
                      {p.childName ? `قصة ${p.childName}` : 'قصة مخصّصة'}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {p.ageBand ? `${p.ageBand} سنة · ` : ''}
                      {p.pageTarget ? `${p.pageTarget.toLocaleString('ar-EG')} صفحة · ` : ''}
                      {p.faceMode === 'real' ? 'وجه حقيقي' : 'كرتوني'}
                      {p.sensitiveTopic ? ' · موضوع حسّاس' : ''}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      المحرّر: {p.editorId ? (names.get(p.editorId) ?? 'معيّن') : 'غير معيّن'} · المشرف الفني:{' '}
                      {p.artLeadId ? (names.get(p.artLeadId) ?? 'معيّن') : 'غير معيّن'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
                    <StatusBadge label={label(p.status)} type={statusTone(p.status)} />
                    {p.orderClosed && <StatusBadge label="الطلب اتلغى — محتاج قرار" type="danger" />}
                    {!isTerminal(p.status) && p.status !== 'on_hold' && (
                      <span className="text-xs font-medium text-slate-500">عند: {owner}</span>
                    )}
                    {tk && !isTerminal(p.status) && <DeadlineChip d={tk.deadline} dueAt={tk.dueAt} />}
                    {p.dueAt && (
                      <span className={`text-xs font-bold ${p.overdue ? 'text-rose-700' : 'text-slate-500'}`}>
                        {p.overdue ? 'تسليم المشروع متأخر · ' : 'تسليم المشروع: '}
                        {formatDate(p.dueAt)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {all.length >= 200 && (
        <p className="text-center text-xs font-medium text-slate-500">بيظهر أول ٢٠٠ مشروع بس — استخدم الفلاتر.</p>
      )}
    </div>
  );
}
