import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getInstructors } from '@/data/domains/(admin)/instructors/queries';
import { getAdminCourse, getTrainingRecords } from '@/data/domains/(admin)/training/queries';
import { hasAdminPermission } from '@/lib/utils';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { TRAINING_STATUS_LABELS, activeDuration, doneCount, trainingStatus } from '@/lib/training';
import { TrainingSettingsForm } from './TrainingSettingsForm';
import { TrainingImport } from './TrainingImport';

export const dynamic = 'force-dynamic';

const ar = (n: number) => n.toLocaleString('ar-EG');
const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('ar-EG', { timeZone: PLATFORM_TIMEZONE, dateStyle: 'medium' }) : '—';

const card = 'rounded-3xl border border-slate-200 bg-white p-6 shadow-sm';

/**
 * التأهيل التأسيسي — إعدادات الدورة ونسخها ونتايج كل المدربين.
 * (كان ملف HTML منفصل، ونتيجته بتوصل بإيميل يدوي — طلب تامر، ٢٤ أكتوبر.)
 */
export default async function TrainingAdminPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageInstructors')) return <Unauthorized />;

  const course = await getAdminCourse();
  if (course.state !== 'ok' || !course.data) {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <DashboardPageHeader title="التأهيل التأسيسي" backHref="/dashboard/admin/instructors" />
        <p className="rounded-3xl border border-amber-200 bg-amber-50 p-6 font-bold text-amber-900">
          {course.state === 'error'
            ? course.error
            : 'التأهيل لسه مش مفعّل — شغّل ترحيل 20261025120000_foundation_training في Supabase.'}
        </p>
      </div>
    );
  }
  const c = course.data;
  const instructors = await getInstructors();
  const records = await getTrainingRecords(null);
  const total = c.content.modules.length;

  const rows = instructors
    .map((i) => {
      const rec = i.userId ? records.get(i.userId) : undefined;
      const progress = rec?.progress ?? null;
      return { i, rec, progress, status: trainingStatus(progress, total) };
    })
    .sort((a, b) => {
      const order = { ready_for_final: 0, in_progress: 1, passed: 2, not_started: 3 } as const;
      return order[a.status] - order[b.status] || a.i.displayName.localeCompare(b.i.displayName, 'ar');
    });
  const counts = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-12">
      <DashboardPageHeader title="التأهيل التأسيسي" backHref="/dashboard/admin/instructors" />

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">{c.title}</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              الإصدار {c.version} · {ar(total)} وحدات · {ar(c.content.finalQuestions.length)} سؤال نهائي ·{' '}
              {c.isActive ? 'متاح للمدربين' : 'مقفول'} · آخر تعديل {day(c.updatedAt)}
            </p>
          </div>
          <Link
            href="/dashboard/admin/instructors/training/preview"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            عاين زي المدرب
          </Link>
        </div>
        <div className="mt-5 grid gap-3 text-center sm:grid-cols-4">
          {(['not_started', 'in_progress', 'ready_for_final', 'passed'] as const).map((s) => (
            <div key={s} className="rounded-2xl bg-slate-50 p-3">
              <p className="text-2xl font-black text-slate-900">{ar(counts[s] ?? 0)}</p>
              <p className="text-xs font-bold text-slate-600">{TRAINING_STATUS_LABELS[s]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={card} aria-labelledby="t-results">
        <h2 id="t-results" className="mb-4 text-lg font-black text-slate-800">
          نتايج المدربين
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-black text-slate-500">
                <th className="py-2 pl-3">المدرب</th>
                <th className="py-2 pl-3">الحالة</th>
                <th className="py-2 pl-3">الوحدات</th>
                <th className="py-2 pl-3">أعلى درجة</th>
                <th className="py-2 pl-3">محاولات</th>
                <th className="py-2 pl-3">الاجتياز</th>
                <th className="py-2">وقت الدراسة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ i, progress, status }) => (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="py-3 pl-3">
                    <Link href={`/dashboard/admin/instructors/${i.id}`} className="font-bold text-slate-900 hover:underline">
                      {i.displayName}
                    </Link>
                    {!i.userId && <span className="block text-xs text-amber-700">مالوش حساب دخول</span>}
                  </td>
                  <td className="py-3 pl-3 font-bold text-slate-700">{TRAINING_STATUS_LABELS[status]}</td>
                  <td className="py-3 pl-3">
                    {ar(doneCount(progress, total))}/{ar(total)}
                  </td>
                  <td className="py-3 pl-3">{progress?.bestScore != null ? `${ar(progress.bestScore)}٪` : '—'}</td>
                  <td className="py-3 pl-3">{ar(progress?.finalAttempts ?? 0)}</td>
                  <td className="py-3 pl-3">{day(progress?.passedAt)}</td>
                  <td className="py-3">{progress ? activeDuration(progress.activeSeconds) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className={card} aria-labelledby="t-settings">
          <h2 id="t-settings" className="mb-4 text-lg font-black text-slate-800">
            الإعدادات
          </h2>
          <TrainingSettingsForm course={c} />
        </section>
        <section className={card} aria-labelledby="t-import">
          <h2 id="t-import" className="mb-1 text-lg font-black text-slate-800">
            نسخة جديدة من المحتوى
          </h2>
          <p className="mb-4 text-sm font-medium text-slate-600">ارفع ملف الدورة زي ما بيوصلك (زي v5) والمحتوى بيتقري منه.</p>
          <TrainingImport currentVersion={c.version} />
        </section>
      </div>
    </div>
  );
}
