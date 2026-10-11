import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { getSessionChangesForAdmin } from '@/data/domains/session-change-requests';
import { hasAdminPermission } from '@/lib/utils';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { DecisionButton } from '@/components/forms/DecisionButton';
import { Field, TextArea } from '@/components/forms/Form';
import { decideSessionChangeForm } from '@/actions/session-change-requests';

export const dynamic = 'force-dynamic';

const ROLE: Record<string, string> = { guardian: 'ولي الأمر', instructor: 'المدرب', student: 'الطالب' };
const STATUS: Record<string, { label: string; type: 'pending' | 'success' | 'danger' | 'neutral' }> = {
  pending: { label: 'مستني', type: 'pending' },
  approved: { label: 'اتوافق — الموعد اتغيّر', type: 'success' },
  rejected: { label: 'اترفض', type: 'danger' },
  cancelled: { label: 'اتسحب', type: 'neutral' },
};
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE, dateStyle: 'full', timeStyle: 'short' }) : '—';

/**
 * طلبات تغيير موعد الجلسات (ملف 16 — #LQMO).
 *
 * الموافقة بتغيّر الموعد بنفس طريقة «إعدادات الجلسة» (إشعار للمدرب
 * والعميل، والغرفة على الميعاد الجديد، وسطر في السجل). الرفض محتاج سبب
 * بيوصل لصاحب الطلب.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) return <Unauthorized />;
  const rows = await getSessionChangesForAdmin();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="طلبات تغيير المواعيد" />
      <p className="mb-6 text-sm font-medium text-slate-600">
        ولي الأمر أو المدرب أو الطالب بيقترح موعد تاني لجلسة. الموافقة بتغيّر الموعد وبيوصل إشعار للطرفين.
        اتأكد إن الموعد الجديد مناسب للمدرب قبل ما توافق.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center font-medium text-slate-600">
          مفيش طلبات.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 text-sm">
                  <p className="font-black text-slate-900">
                    <Link href={`/dashboard/admin/sessions/${r.sessionId}`} className="hover:underline">
                      جلسة {r.sessionNumber?.toLocaleString('ar-EG') ?? ''}
                    </Link>{' '}
                    · {ROLE[r.requesterRole] ?? r.requesterRole}: {r.requesterName}
                  </p>
                  <p className="text-slate-700">الموعد الحالي: {fmt(r.sessionAt)}</p>
                  <p className="font-bold text-slate-900">المقترح: {fmt(r.proposedAt)}</p>
                  <p className="text-slate-700">السبب: {r.reason}</p>
                  {r.adminNote && <p className="text-slate-600">ردّ الإدارة: {r.adminNote}</p>}
                </div>
                <StatusBadge label={STATUS[r.status]?.label ?? r.status} type={STATUS[r.status]?.type ?? 'neutral'} />
              </div>

              {r.status === 'pending' && (
                <ActionForm action={decideSessionChangeForm} className="mt-4 space-y-3">
                  <input type="hidden" name="id" value={r.id} />
                  <Field label="سبب الرفض (للرفض بس)" name="note">
                    <TextArea name="note" rows={2} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <DecisionButton name="decision" value="approved" pendingLabel="جارٍ تغيير الموعد…">
                      وافق وغيّر الموعد
                    </DecisionButton>
                    <DecisionButton name="decision" value="rejected" variant="secondary" pendingLabel="جارٍ الرفض…">
                      ارفض
                    </DecisionButton>
                  </div>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
