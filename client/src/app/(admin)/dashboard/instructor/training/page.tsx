import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getLearnerCourse } from '@/data/domains/(admin)/training/queries';
import { TrainingPlayer } from './TrainingPlayer';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'التأهيل التأسيسي', robots: { index: false } };

/**
 * التأهيل التأسيسي الذاتي — جوّه لوحة المدرب (طلب تامر، ٢٤ أكتوبر).
 * كان ملف HTML منفصل بيحفظ على المتصفح؛ دلوقتي في حسابه والإدارة شايفاه.
 */
export default async function InstructorTrainingPage() {
  const user = await getCurrentUser();
  if (user.role !== 'instructor') redirect('/dashboard');

  const load = await getLearnerCourse();

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <DashboardPageHeader title="التأهيل التأسيسي" backHref="/dashboard/instructor" />
      {load.state === 'not_set_up' || (load.state === 'ok' && !load.data) ? (
        <p className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-700">
          التأهيل لسه مش متاح — الإدارة بتجهّزه، وهيظهر هنا أول ما يتفعّل.
        </p>
      ) : load.state === 'error' ? (
        <p role="alert" className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-900">
          {load.error}
        </p>
      ) : (
        <TrainingPlayer course={load.data!} name={user.fullName ?? ''} />
      )}
    </div>
  );
}
