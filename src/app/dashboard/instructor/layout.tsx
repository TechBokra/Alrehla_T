import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/auth';
import Link from 'next/link';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { getMyInstructorId } from '@/data/domains/services';
import { getInstructorById, getProfileUpdateRequestsByInstructor } from '@/data/domains/writing';
import { onboardingState } from '@/lib/instructor-onboarding';

/**
 * لوحة المدرب.
 *
 * التحقق من الدور كان متكرر في كل صفحة على حدة — ولو صفحة جديدة اتنسي
 * فيها، بتبقى مفتوحة لأي حد. دلوقتي في مكان واحد.
 */
export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user.role !== 'instructor') redirect('/dashboard');

  // المدرب الجديد (من طلب انضمام) بيكمّل ملفه الأول — الشريط ده على كل
  // صفحات اللوحة لحد ما الملف يتعتمد (`@/lib/instructor-onboarding`).
  const instructorId = await getMyInstructorId();
  const [instructor, requests] = instructorId
    ? await Promise.all([
        getInstructorById(instructorId),
        getProfileUpdateRequestsByInstructor(instructorId),
      ])
    : [null, []];
  const onboarding = instructor ? onboardingState(instructor, requests) : 'complete';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <DashboardTabs
        tabs={[
          { href: '/dashboard/instructor', label: 'نظرة عامة' },
          { href: '/dashboard/instructor/sessions', label: 'جلساتي' },
          { href: '/dashboard/instructor/students', label: 'طلابي' },
          // «خدماتي» فيها الخدمات اللي بيقدّمها **وطلباتها** في نفس
          // الشاشة — فمفيش تبويبة منفصلة للطلبات عشان ما يبقاش فيه
          // قايمتين لنفس الحاجة.
          { href: '/dashboard/instructor/services', label: 'خدماتي وطلباتها' },
          { href: '/dashboard/instructor/ratings', label: 'تقييماتي' },
          { href: '/dashboard/instructor/payouts', label: 'مستحقاتي' },
          { href: '/dashboard/instructor/profile', label: 'ملفي وصوري' },
          { href: '/dashboard/instructor/settings', label: 'الإعدادات' },
        ]}
      />
      {onboarding === 'needs_profile' && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-amber-900">
              خطوة واحدة قبل ما حسابك يتفعّل: كمّل ملفك (صورتك، نبذة، تخصصاتك، سنين
              خبرتك) وابعته للإدارة تراجعه.
            </p>
            <Link
              href="/dashboard/instructor/profile"
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              كمّل ملفي
            </Link>
          </div>
        </div>
      )}
      {onboarding === 'in_review' && (
        <div className="border-b border-sky-200 bg-sky-50 px-6 py-4">
          <p className="mx-auto max-w-6xl text-sm font-bold text-sky-900">
            ملفك وصل للإدارة وبيتراجع. أول ما يتعتمد وتخلّص التدريب، حسابك هيتفعّل
            ويبدأ يظهر للأهالي.
          </p>
        </div>
      )}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
