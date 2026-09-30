import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import { NOTIFICATION_EVENTS } from '@/lib/notification-events';
import { NotificationsTabs } from '../NotificationsTabs';
import { TypesForm } from './TypesForm';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) {
    return <Unauthorized />;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'notifications')
    .maybeSingle();

  const disabled = ((data?.value as { disabled?: string[] } | null)?.disabled ?? []) as string[];

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="الإشعارات" />
      <NotificationsTabs />

      <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-bold text-amber-900">
          إيقاف نوع معناه إن الإشعار ده <strong>ما بيتبعتش من أصله</strong> —
          مش إنه بيتبعت ويتخفي.
        </p>
        <p className="mt-2 text-sm font-medium text-amber-800">
          الأنواع المقفولة مالهاش زرار: إيقافها معناه إن حد يدفع ومحدش يعرف.
        </p>
      </div>

      <TypesForm events={NOTIFICATION_EVENTS} disabled={disabled} />
    </div>
  );
}
