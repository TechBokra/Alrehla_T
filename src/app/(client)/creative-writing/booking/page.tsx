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
import {
  getPublicInstructors,
  getWritingPackages,
  getBookedSlotsByInstructor,
} from '@/data/domains/writing';
import { fetchFamilyMembers } from '@/app/actions/family';
import { Section } from '@/components/ui/Section';

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string; instructor?: string; child?: string }>;
}) {
  const { instructor: instructorParam, child: childParam } = await searchParams;
  const [instructors, packages] = await Promise.all([
    getPublicInstructors(),
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
