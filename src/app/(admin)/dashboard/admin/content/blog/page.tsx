import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getAdminBlogPublicationData } from '@/data/domains/(admin)/content/page-data';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { PUBLISH_MODE_LABELS } from '@/lib/blog-publish';

/** المجدول بيظهر بالتاريخ والوقت (القاهرة)، المنشور بالتاريخ بس. */
function formatScheduled(iso: string, withTime: boolean): string {
  if (!withTime) return formatDate(iso);
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) {
    return <Unauthorized />;
  }

  // كل المقالات (منشور + مجدول + مسودة) — بتتقرا بجلسة الأدمن لأن القاعدة
  // بتخفي غير المنشور عن الزوار.
  const posts = await getAdminBlogPublicationData();

  const formatted = posts.map((p) => ({
    ...p,
    titleDisplay: <Link href={`/dashboard/admin/content/blog/${p.id}`} className="font-bold text-blue-600 hover:underline">{p.title}</Link>,
    // المسودة تاريخها مالوش معنى للقارئ، فمش بنعرضه.
    dateDisplay: p.status === 'draft' ? '—' : formatScheduled(p.publishedAt, p.status === 'scheduled'),
    statusDisplay: (
      <StatusBadge
        type={p.status === 'published' ? 'success' : p.status === 'scheduled' ? 'info' : 'neutral'}
        label={PUBLISH_MODE_LABELS[p.status]}
      />
    )
  }));

  const columns = [
    { header: 'العنوان', accessorKey: 'titleDisplay' },
    { header: 'الكاتب', accessorKey: 'authorName' },
    { header: 'تاريخ النشر / الموعد', accessorKey: 'dateDisplay' },
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
