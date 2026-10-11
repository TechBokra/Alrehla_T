import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getPublisherPayouts } from '@/data/domains/admin';
import { getCurrentUser } from '@/data/domains/auth';
import { getPublishers } from '@/data/domains/products';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { AdminPublisherPayoutClient } from './AdminPublisherPayoutClient';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageFinance')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const payouts = await getPublisherPayouts();
  const target = payouts.find(p => p.id === id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!target) notFound();
  
  const publishers = await getPublishers();
  const publisher = publishers.find(p => p.id === target.publisherId);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`مراجعة مستحقات الناشر #${target.id.split('-')[1] || target.id}`} backHref="/dashboard/admin/finance/publisher-payouts" />
      <AdminPublisherPayoutClient payout={target} publisher={publisher} />
    </div>
  );
}
