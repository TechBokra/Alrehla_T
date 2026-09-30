import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getTestimonials } from '@/data/domains/content';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { TestimonialsClient } from './TestimonialsClient';

export const dynamic = 'force-dynamic';

/**
 * جدول `testimonials` كان موجودًا والصفحات العامة بتقرأ منه، لكن مفيش أي
 * شاشة بتكتب فيه — فأقسام آراء العملاء في الصفحة الرئيسية و«إنها لك»
 * و«بداية الرحلة» كانت فاضية دائمًا. دي الشاشة الناقصة.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) {
    return <Unauthorized />;
  }

  const testimonials = await getTestimonials();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="آراء العملاء" />
      <TestimonialsClient testimonials={testimonials} />
    </div>
  );
}
