import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'تأكيد الحجز',
    description: 'مراجعة تفاصيل الحجز وإتمامه.',
    path: '/creative-writing/booking/confirm',
    noIndex: true,
  });
}

import { getSiteSettings } from '@/data/domains/content';
import {
  getWritingPackages,
  getPublicInstructors,
  getBookedSlotsByInstructor,
} from '@/data/domains/writing';
import Link from 'next/link';

import { PageContainer } from '@/components/PageContainer';
import { BookingConfirmClient } from './BookingConfirmClient';
import { Suspense } from 'react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function BookingConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    package?: string;
    instructor?: string;
    day?: string;
    time?: string;
    child?: string;
  }>;
}) {
  // الباقة والمدرب بيتقروا من القاعدة هنا، مش في المتصفح. الصفحة كانت
  // بتعرض اسم مدرب ثابت («سارة أحمد») وتاريخ النهاردة ووقت مخترع وسعر
  // 250 مكتوب في الكود — كل ده مالوش علاقة باللي العميل اختاره.
  const {
    package: packageId,
    instructor: instructorId,
    day: slotDay,
    time: slotTime,
    child: childParam,
  } = await searchParams;
  const [settings, packages, instructors] = await Promise.all([
    getSiteSettings(),
    getWritingPackages(),
    getPublicInstructors(),
  ]);

  const chosenPackage = packages.find((pkg) => pkg.id === packageId);
  const chosenInstructor = instructors.find((i) => i.id === instructorId);

  // الميعاد اللي جاي في الرابط بيتفحص هنا مرتين: إنه في جدول المدرب،
  // وإنه مش محجوز باشتراك شغّال. رابط متلاعب فيه — أو تبويبة قديمة
  // فُتحت قبل ما حد يحجز نفس الميعاد — ما يقدرش يعدّي.
  const booked = chosenInstructor
    ? (await getBookedSlotsByInstructor([chosenInstructor.id]))[chosenInstructor.id] ?? []
    : [];

  // من غير باقة صحيحة مفيش حجز. كان الكود بيحط 'dummy-package' ويكمّل.
  if (!chosenPackage) {
    return (
      <PageContainer className="!py-0 !space-y-0">
        <Section containerClassName="mx-auto w-full max-w-2xl py-24 text-center">
          <h1 className="mb-4 text-2xl font-black text-slate-800">
            الباقة مش محددة
          </h1>
          <p className="mb-8 font-medium text-slate-500">
            ابدأ الحجز من الأول واختار الباقة والمدرب.
          </p>
          <Link
            href="/creative-writing/booking"
            className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white"
          >
            الرجوع لصفحة الحجز
          </Link>
        </Section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section containerClassName="mx-auto w-full max-w-3xl pt-12 pb-24">
        <h1 className="mb-10 text-center text-3xl font-black text-slate-800 md:text-5xl">تأكيد ومراجعة الحجز</h1>
        <Card accentColor="emerald" className="p-6 md:p-10 shadow-xl shadow-slate-200/50">
          <Suspense fallback={<div className="p-8 text-center">جاري التحميل...</div>}>
            <BookingConfirmClient
              recording={settings.sessionRecording}
              paymentWalletNumber={settings.paymentWalletNumber}
              paymentQrUrl={settings.paymentQrUrl}
              packageId={chosenPackage.id}
              packageName={chosenPackage.name}
              packagePrice={chosenPackage.price}
              instructorId={chosenInstructor?.id}
              instructorName={chosenInstructor?.displayName}
              instructorAvatarUrl={chosenInstructor?.avatarUrl}
              presetChildId={childParam}
              preferredSlot={
                slotDay && slotTime &&
                (chosenInstructor?.weeklySchedule ?? []).some(
                  (s) => s.day === slotDay && s.time === slotTime,
                ) &&
                !booked.some((b) => b.day === slotDay && b.time === slotTime)
                  ? { day: slotDay, time: slotTime }
                  : undefined
              }
            />
          </Suspense>
        </Card>
      </Section>
    </PageContainer>
  );
}
