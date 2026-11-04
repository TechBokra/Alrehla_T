import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getLearnerCourse } from '@/data/domains/(admin)/training/queries';
import { hasAdminPermission } from '@/lib/utils';
import { TrainingPlayer } from '@/app/(admin)/dashboard/instructor/training/TrainingPlayer';

export const dynamic = 'force-dynamic';

/** معاينة الإدارة — نفس شاشة المدرب، والتصحيح شغّال من غير حفظ. */
export default async function TrainingPreviewPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageInstructors')) return <Unauthorized />;
  const load = await getLearnerCourse();
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <DashboardPageHeader title="معاينة التأهيل" backHref="/dashboard/admin/instructors/training" />
      {load.state === 'ok' && load.data ? (
        <TrainingPlayer course={load.data} name="" />
      ) : (
        <p className="rounded-2xl bg-amber-50 p-4 font-bold text-amber-900">
          {load.state === 'error' ? load.error : 'التأهيل مش متاح (مقفول أو الترحيل لسه ماتشغّلش).'}
        </p>
      )}
    </div>
  );
}
