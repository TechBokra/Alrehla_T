import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'حجز جلسة',
    description: 'اختر الباقة والمدرب والموعد المناسب لجلستك.',
    path: '/creative-writing/booking',
    noIndex: true,
  });
}

import { Suspense } from 'react';
import { PageContainer } from '@/components/PageContainer';
import { BookingWizardClient } from '@/components/creative-writing/BookingWizardClient';
import { getVisibleInstructors } from '@/data/domains/(shared)/instructors/public';
import { getWritingPackages } from '@/data/domains/(shared)/writing/packages';
import { getBookedSlotsByInstructor } from '@/data/domains/(client)/bookings/queries';
import { fetchFamilyMembers } from '@/app/actions/family';
import { getDependentGuardian } from '@/lib/auth-guard';
import { DependentRequestButton } from '@/components/services/DependentRequestButton';
import { StaffAccountNotice } from '@/components/account/StaffAccountNotice';
import { staffPurchaseBlock } from '@/lib/buying-roles';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { Section } from '@/components/ui/Section';

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string; instructor?: string; child?: string }>;
}) {
  const { instructor: instructorParam, child: childParam } = await searchParams;
  const [instructors, packages] = await Promise.all([
    getVisibleInstructors(),
    getWritingPackages(),
  ]);

  // الإتاحة بتتحسب من جلسات المدربين القادمة، مش من علامة `isBooked`
  // اللي مفيش حاجة بتكتبها. من غير ده عميلين يقدروا يحجزوا نفس المدرب
  // في نفس الساعة من نفس اليوم.
  const bookedSlots = await getBookedSlotsByInstructor(
    instructors.filter((i) => i.status === 'active').map((i) => i.id),
  );

  // المستفيد بييجي من موافقة ولي الأمر على طلب ابنه.
  //
  // ⚠️ الاسم بيتحلّ من **قايمة أبناء الداخل دلوقتي**، فرقم طفل حد
  //    تاني بيتجاهل بلا أي تسريب — ولا حتى وجود الرقم بيتأكد.
  const family = childParam ? await fetchFamilyMembers() : [];
  const presetChild = family.find((c) => c.id === childParam) ?? null;

  /* ── الطفل التابع ─────────────────────────────────────────────
   *
   * ⚠️ **الفحص ده كان في صفحة الباقات العامة** — والصفحة بتقرا
   *    المستخدم عشانه، فبتتبني لكل زيارة: **٨٨٨ مللي** بالقياس على
   *    المنشور، مقابل ١٢٠ للمتخزّنة. يعني كل زائر كان بيدفع تمن فحص
   *    يخص أقلية.
   *
   * ⚠️ **ولازم يفضل موجود هنا.** التعليق في `PackageCard` بيقول
   *    السبب الأصلي: الطفل كان بيكمّل المعالج لآخر خطوة وياخد منع —
   *    «طريق مسدود بعد شغل». الفحص هنا بيوقفه **قبل** المعالج، فنفس
   *    الحماية بالظبط من غير تكلفة على باقي الزوّار.
   */
  let dependentOf = null;
  try {
    dependentOf = await getDependentGuardian();
  } catch {
    dependentOf = null;
  }

  const packageParam = (await searchParams).package;

  /* ── حساب الشغل ───────────────────────────────────────────────
   *
   * ⚠️ **وأخطر حالة هنا هي المدرب.** الحجز بيختار مدربًا، ومافيش
   *    حاجة كانت بتمنع إن الحاجز هو نفس المدرب — فتطلع جلسة بين
   *    الشخص ونفسه، ومستحقاتها بتتحسب عليها. الفحص قبل المعالج
   *    زي الطفل التابع بالظبط.
   */
  const viewer = await getCurrentUser();
  if (staffPurchaseBlock(viewer.role)) {
    return (
      <PageContainer className="!py-0 !space-y-0">
        <Section containerClassName="mx-auto w-full max-w-2xl pt-16 pb-24">
          <StaffAccountNotice role={viewer.role} what="الحجز" />
        </Section>
      </PageContainer>
    );
  }

  if (dependentOf) {
    return (
      <PageContainer className="!py-0 !space-y-0">
        <Section containerClassName="mx-auto w-full max-w-2xl pt-16 pb-24">
          <div className="rounded-card border border-amber-200 bg-amber-50 p-6">
            <h1 className="mb-2 text-2xl font-black text-amber-900">محتاج موافقة ولي أمرك</h1>
            <p className="mb-5 font-medium text-amber-900">
              الحجز بيتم من حساب ولي أمرك. ابعتله الطلب من هنا، وهو يكمّل الحجز ويختار الموعد.
            </p>
            <DependentRequestButton
              kind="package"
              packageId={packageParam}
              label="اطلب الباقة من ولي أمرك"
            />
          </div>
        </Section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section containerClassName="mx-auto w-full max-w-4xl pt-12 pb-24">
        <h1 className="mb-10 text-center text-3xl font-black text-slate-800 md:text-5xl">حجز مسار تدريبي</h1>
        <p className="mx-auto mb-12 max-w-2xl text-center text-lg font-medium text-slate-500">
          اختر الباقة المناسبة والمدرب، ثم حدد موعدك الأسبوعي الثابت طوال فترة التدريب.
        </p>
        <Suspense fallback={<div className="p-8 text-center font-medium text-slate-500">جاري التحميل…</div>}>
        <BookingWizardClient
          instructors={instructors}
          bookedSlots={bookedSlots}
          presetInstructorId={instructorParam}
          presetChild={presetChild ? { id: presetChild.id, name: presetChild.fullName } : undefined}
          packages={packages
            .filter((pkg) => pkg.isActive)
            .map((pkg) => ({
              id: pkg.id,
              name: pkg.name,
              price: pkg.price,
              ageGroup: pkg.ageGroup,
            }))}
        />
        </Suspense>
      </Section>
    </PageContainer>
  );
}
