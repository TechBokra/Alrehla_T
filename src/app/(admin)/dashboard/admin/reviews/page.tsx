import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { getAllReviews } from '@/data/domains/reviews';
import { hasAdminPermission } from '@/lib/utils';
import { AdminReviewsClient } from './AdminReviewsClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) return <Unauthorized />;

  const reviews = await getAllReviews();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <DashboardPageHeader title="التقييمات" />
      <p className="mb-6 text-slate-600">
        التقييمات تُنشر فور إرسالها. الإخفاء هنا للمسيء أو المخالف فقط، ويُسجَّل سببه.
      </p>
      <AdminReviewsClient reviews={reviews} />
    </div>
  );
}
