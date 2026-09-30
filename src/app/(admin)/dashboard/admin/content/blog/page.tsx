import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getBlogPosts } from '@/data/domains/content';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) {
    return <Unauthorized />;
  }

  // Drafts are dated in the future, so they never reach the public listing —
  // but the admin must see them.
  const posts = await getBlogPosts({ includeDrafts: true });

  const formatted = posts.map(p => ({
    ...p,
    titleDisplay: <Link href={`/dashboard/admin/content/blog/${p.id}`} className="font-bold text-blue-600 hover:underline">{p.title}</Link>,
    dateDisplay: formatDate(p.publishedAt),
    statusDisplay: (
      <StatusBadge 
        type={new Date(p.publishedAt) > new Date() ? 'neutral' : 'success'} 
        label={new Date(p.publishedAt) > new Date() ? 'مسودة' : 'منشور'} 
      />
    )
  }));

  const columns = [
    { header: 'العنوان', accessorKey: 'titleDisplay' },
    { header: 'الكاتب', accessorKey: 'authorName' },
    { header: 'تاريخ النشر', accessorKey: 'dateDisplay' },
    { header: 'الحالة', accessorKey: 'statusDisplay' }
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title="إدارة المدونة"
        action={{ label: 'مقال جديد', href: '/dashboard/admin/content/blog/new' }}
      />
      <SimpleDataTable columns={columns} data={formatted} />
    </div>
  );
}
