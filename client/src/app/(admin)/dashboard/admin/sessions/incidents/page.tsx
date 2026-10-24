import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getIncidentsForAdmin } from '@/data/domains/(admin)/sessions/incidents';
import { hasAdminPermission } from '@/lib/utils';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { StatusBadge } from '@/components/StatusBadge';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, Select, SubmitButton, TextArea } from '@/components/forms/Form';
import { updateIncident } from '@/actions/incidents';
import { INCIDENT_STATUS_LABEL, categoryLabel } from '@/lib/incidents';

export const dynamic = 'force-dynamic';

const ROLE: Record<string, string> = { guardian: 'ولي الأمر', instructor: 'المدرب', student: 'الطالب' };
const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' });

/**
 * بلاغات الجلسات — قرار تامر (٢٤ أكتوبر، بند ١١).
 *
 * الترتيب: الجديد الأول، والعاجل قبل العادي. اللي بيحرّك البلاغ من
 * «جديد» بيبقى هو الماسكه. والقفل محتاج قرار مكتوب بيوصل لصاحب البلاغ.
 *
 * ── خطوات التعامل (مكتوبة في الصفحة للفريق) ─────────────────
 *   عاجل: كلّم ولي الأمر في نفس اليوم، ووقّف جلسات المدرب مع الطفل
 *   ده لحد ما الموقف يتفهم لو البلاغ عن سلوك المدرب.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) return <Unauthorized />;
  const rows = await getIncidentsForAdmin();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="بلاغات الجلسات" />

      <section className="mb-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm leading-relaxed font-medium text-slate-700">
        <h2 className="mb-2 text-base font-black text-slate-800">إزاي نتعامل</h2>
        <ol className="list-decimal space-y-1 pr-5">
          <li>
            <b>العاجل</b> (وأي بلاغ عن سلامة طفل): حد يمسكه في نفس اليوم، ويكلّم ولي الأمر بنفسه.
          </li>
          <li>لو البلاغ عن سلوك المدرب: الجلسات الجاية للطفل ده تتأجل لحد ما الموقف يتفهم من الطرفين.</li>
          <li>لو الجلسة خرجت عن السيطرة: كلّم المدرب الأول، وبعدين ولي الأمر، وقرّروا تكمّلوا ولا تغيّروا المدرب.</li>
          <li>قبل القفل: اكتب القرار — بيوصل لصاحب البلاغ كإشعار. الملاحظات الداخلية للفريق بس.</li>
        </ol>
      </section>

      {rows === null ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900">
          جدول البلاغات لسه مش موجود — محتاج ترحيل قاعدة البيانات (٢٤ أكتوبر) يترفع.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
          مفيش بلاغات.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <article
              key={r.id}
              className={`rounded-3xl border bg-white p-6 shadow-sm ${
                r.severity === 'urgent' && r.status !== 'resolved' ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
              }`}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {r.severity === 'urgent' && <StatusBadge type="danger" label="عاجل" />}
                <StatusBadge
                  type={r.status === 'resolved' ? 'success' : r.status === 'in_progress' ? 'pending' : 'warning'}
                  label={INCIDENT_STATUS_LABEL[r.status]}
                />
                <span className="text-sm font-black text-slate-800">{categoryLabel(r.category)}</span>
                <span className="text-xs font-medium text-slate-500">
                  {ROLE[r.reporterRole] ?? r.reporterRole}: {r.reporterName} · {fmt(r.createdAt)}
                </span>
                {r.sessionId && (
                  <Link
                    href={`/dashboard/admin/sessions/${r.sessionId}`}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    الجلسة {r.sessionNumber ?? ''} ←
                  </Link>
                )}
              </div>
              <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{r.description}</p>
              {r.assignedName && <p className="mb-3 text-xs font-bold text-slate-500">ماسكه: {r.assignedName}</p>}

              <ActionForm action={updateIncident} successMessage="اتحفظ ✓" className="space-y-3">
                <input type="hidden" name="id" value={r.id} />
                <Field label="الحالة" name="status">
                  <Select defaultValue={r.status}>
                    <option value="open">جديد</option>
                    <option value="in_progress">جاري التعامل</option>
                    <option value="resolved">اتحلّ</option>
                  </Select>
                </Field>
                <Field label="ملاحظات داخلية (للفريق)" name="adminNote">
                  <TextArea rows={2} defaultValue={r.adminNote ?? ''} />
                </Field>
                <Field label="القرار (بيوصل لصاحب البلاغ عند القفل)" name="resolution">
                  <TextArea rows={2} defaultValue={r.resolution ?? ''} />
                </Field>
                <SubmitButton>حفظ</SubmitButton>
              </ActionForm>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
