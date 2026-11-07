import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getBlogPlan } from '@/data/domains/(admin)/content/blog-plan';
import { hasAdminPermission } from '@/lib/utils';
import { cairoDate } from '@/lib/box-schedule';
import { BlogPlanClient } from './BlogPlanClient';

export const dynamic = 'force-dynamic';

/**
 * خطة محتوى المدونة (٧ نوفمبر): المقالات المخطّطة بمواعيدها ومراحلها. كل مرحلة
 * مهمة في «مهامي» لمسؤولها — المسؤولين من «سير العمل والتوزيع ← المدونة».
 */
export default async function BlogPlanPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) return <Unauthorized />;

  const plan = await getBlogPlan();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-12">
      <DashboardPageHeader title="خطة محتوى المدونة" backHref="/dashboard/admin/content/blog" />
      {plan === null ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 font-bold text-amber-900">
          الخطة محتاجة ملف القاعدة 20261107110000 يتشغّل الأول.
        </p>
      ) : (
        <BlogPlanClient
          items={plan.items}
          posts={plan.posts}
          today={cairoDate(new Date())}
          canAssign={hasAdminPermission(user, 'canAssignWork')}
        />
      )}
    </div>
  );
}
