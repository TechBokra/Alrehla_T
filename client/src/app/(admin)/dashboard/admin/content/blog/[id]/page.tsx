import React from 'react';
import { notFound } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getBlogPostById } from '@/data/domains/(admin)/content/blog';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { BlogEditor } from '../BlogEditor';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  // The editor used to ignore its own [id] and show the same sample text for
  // every post.
  const post = await getBlogPostById(id);
  if (!post) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="تعديل مقال" backHref="/dashboard/admin/content/blog" />
      <BlogEditor post={post} />
    </div>
  );
}
