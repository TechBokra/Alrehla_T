import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { getSiteSettings } from '@/data/domains/content';
import { hasAdminPermission } from '@/lib/utils';
import { SiteImagesClient } from './SiteImagesClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) return <Unauthorized />;

  const settings = await getSiteSettings();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="صور الموقع" />
      <p className="mb-6 text-slate-600">
        كل صورة ثابتة على الموقع، ومكانها بالضبط. الصور كانت تُجلب من موقع صور
        عشوائية على الإنترنت — الآن هي صورك أنت.
      </p>
      <SiteImagesClient images={settings.images} />
    </div>
  );
}
