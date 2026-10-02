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
import Image from 'next/image';
import Link from 'next/link';
import { getInstructorMediaForAdmin } from '@/data/domains/instructor-media';
import { StatusBadge } from '@/components/StatusBadge';
import { optimizedImageUrl } from '@/lib/cloudinary';

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
  const media = await getInstructorMediaForAdmin(target.id);

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

      {/* ⚠️ **صور المدرب كانت مش ظاهرة هنا خالص** — الإداري كان لازم
          يروح «صور المدربين» ويدوّر على الاسم. دلوقتي ملخص هنا،
          والمراجعة نفسها في شاشتها. */}
      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-800">الغلاف وصور الأعمال</h2>
            <p className="text-sm font-medium text-slate-500">
              المدرب بيرفعها من «ملفي وصوري»، ومابتظهرش في صفحته قبل الاعتماد.
            </p>
          </div>
          <Link
            href="/dashboard/admin/instructors/review"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            مراجعة الصور
          </Link>
        </div>
        {media.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
            المدرب لسه مارفعش غلاف ولا صور أعمال.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {media.map((item) => (
              <li key={item.id} className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="relative aspect-square bg-slate-50">
                  <Image
                    src={optimizedImageUrl(item.imageUrl, 300)}
                    alt={item.title ?? 'صورة مدرب'}
                    fill
                    sizes="160px"
                    className="object-contain p-2"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1 p-2">
                  <p className="text-[11px] font-bold text-slate-600">
                    {item.kind === 'cover' ? 'غلاف' : item.title || 'عمل'}
                  </p>
                  <StatusBadge
                    type={
                      item.status === 'approved'
                        ? 'success'
                        : item.status === 'pending'
                          ? 'pending'
                          : 'danger'
                    }
                    label={
                      item.status === 'approved'
                        ? 'ظاهرة'
                        : item.status === 'pending'
                          ? 'مستنية'
                          : 'مرفوضة'
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
