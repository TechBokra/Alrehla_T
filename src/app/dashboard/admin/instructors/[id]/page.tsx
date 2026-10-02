import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getInstructors } from '@/data/domains/writing';
import { getProfileUpdateRequestsByInstructor, getInstructorCertification, getPricingFormulaSettings } from '@/data/domains/writing';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { AdminInstructorClient } from './AdminInstructorClient';
import { getStandaloneServices, getInstructorServiceOffers } from '@/data/domains/services';
import { getWritingPackages, getPublicInstructorById } from '@/data/domains/writing';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageInstructors')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const instructors = await getInstructors();
  const target = instructors.find(i => i.id === id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!target) notFound();
  const updateRequests = await getProfileUpdateRequestsByInstructor(target.id);
  const certification = await getInstructorCertification(target.id);
  const services = await getStandaloneServices({ includeInactive: true });
  const serviceOffers = await getInstructorServiceOffers(target.id);
  const formula = await getPricingFormulaSettings();

  // الباقات المفعّلة + اللي المدرب مسجَّل عليها دلوقتي.
  // ⚠️ بتتقري من الدالة العامة عشان تبقى **نفس المصدر** اللي معالج
  //    الحجز بيقرا منه — مصدرين لنفس الرقم بيفترقوا يوم ما.
  const allPackages = (await getWritingPackages()).filter((p) => p.isActive !== false);
  const publicRow = await getPublicInstructorById(target.id);
  const instructorPackageIds = publicRow?.packageIds ?? [];

  let accountEmail: string | undefined;
  if (target.userId) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const adminSupabase = createAdminClient();
      const { data: userAuth } = await adminSupabase.auth.admin.getUserById(target.userId);
      accountEmail = userAuth?.user?.email;
    } catch {
      // Non-fatal fallback
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`إدارة المدرب: ${target.displayName}`} backHref="/dashboard/admin/instructors" />
      <AdminInstructorClient 
        instructor={target} 
        accountEmail={accountEmail}
        updateRequests={updateRequests} 
        certification={certification} 
        packages={allPackages.map((p) => ({
          id: p.id,
          name: p.name,
          track: p.track ?? null,
          ageGroup: p.ageGroup,
          sessionsCount: p.sessionsCount ?? null,
        }))}
        selectedPackageIds={instructorPackageIds}
        services={services}
        serviceOffers={serviceOffers}
        formula={formula}
      />
    </div>
  );
}
