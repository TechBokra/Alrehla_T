import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getSiteContent } from '@/data/domains/content';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { PageContentClient } from './PageContentClient';

export const dynamic = 'force-dynamic';

/**
 * تعديل نصوص الصفحات.
 *
 * الشاشة القديمة كانت جدول فيه أربع صفحات مكتوبين في الكود، وزرار «تعديل
 * المحتوى» رابطه `#` — يعني مكانش بيعمل أي حاجة. دي الشاشة الحقيقية.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) {
    return <Unauthorized />;
  }

  const content = await getSiteContent();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="محتوى الصفحات" />
      <PageContentClient content={content} />
    </div>
  );
}
