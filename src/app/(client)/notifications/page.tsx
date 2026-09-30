import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'الإشعارات',
    description: 'إشعارات حسابك على منصة الرحلة.',
    path: '/notifications',
    noIndex: true,
  });
}

import { redirect } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getNotifications } from '@/data/domains/account';
import { NotificationsClient } from './NotificationsClient';

export const dynamic = 'force-dynamic';

/**
 * Notifications for every role.
 *
 * They used to live only inside the customer account area, so an instructor —
 * the person with the most to be notified about — had no way to see them.
 */
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (user.role === 'visitor') redirect('/sign-in');

  const items = await getNotifications();

  return (
    <PageContainer className="!py-0 !space-y-0">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <DashboardPageHeader title="الإشعارات" />
        <div className="mt-6">
          <NotificationsClient items={items} />
        </div>
      </div>
    </PageContainer>
  );
}
