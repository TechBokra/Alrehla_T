import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'مدربو بداية الرحلة',
    description: 'تعرّف على مدربي الكتابة الإبداعية في منصة الرحلة، وتقييمات المشاركين، واحجز جلستك مع المدرب المناسب.',
    path: '/creative-writing/instructors',
  });
}

import { getPublicInstructors } from '@/data/domains/writing';
import { getInstructorRatingSummaries } from '@/data/domains/reviews';
import { RatingStars } from '@/components/services/RatingStars';
import { User, Award, CheckCircle } from 'lucide-react';
import { optimizedImageUrl } from '@/lib/cloudinary';

import { PageContainer } from '@/components/PageContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';
import { getSiteContent } from '@/data/domains/content';


export default async function InstructorsPage() {
  const [instructors, content] = await Promise.all([
    getPublicInstructors(),
    getSiteContent(),
  ]);
  const ratings = await getInstructorRatingSummaries(instructors.map((i) => i.id));

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Header */}
      <Section containerClassName="pt-8 pb-12">
        <SectionHeader
          title={content['instructors.title']}
          
          description={content['instructors.description']}
        />
      </Section>

      {/* Instructors Grid */}
      <Section containerClassName="mx-auto w-full max-w-6xl pb-20">
        <div className="grid gap-8 md:grid-cols-2">
          {instructors.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 font-medium text-lg">{content['instructors.empty']}</div>
        ) : instructors.map((instructor, i) => (
          // ⚠️ `transition-all` اتشالت: `all` بتحرّك كل خاصية
          //    بتتغيّر — ومنها `border-color` و`padding` — وبعضها
          //    بيعيد حساب التخطيط فبتتلعثم على الأجهزة الضعيفة.
          //    `interactive` في `Card` بتحرّك `transform` و
          //    `box-shadow` وبس، وجوّه `motion-safe:`.
          <Reveal key={instructor.id} delay={Math.min(i, 5) * 60} className="h-full">
            <Card
              accentColor="emerald"
              interactive
              className="relative flex h-full flex-col overflow-hidden p-6 hover:shadow-xl hover:shadow-emerald-500/10 md:p-8"
            >
              {/* ⚠️ الشارة كانت `absolute top-4 right-4` — وفي اتجاه
                  اليمين-لليسار دي **نفس ناحية الصورة والاسم**، فكانت
                  بتركب فوقهم. والكارت كان شايل `mt-4` دايمًا عشان
                  يفضّي لها مكان، حتى في الكروت اللي مالهاش شارة أصلًا. */}
              {instructor.isSample && (
                <div className="mb-4 w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                  بيانات تجريبية
                </div>
              )}

              <div className="mb-6 flex items-center gap-4 md:gap-6">
                {/*
                  الكارت كان بيرسم أيقونة الشخص الرمادية **دايمًا**، من غير
                  أي شرط — يعني حتى لو الصورة موجودة ما كانتش هتظهر هنا.
                  دي غير عطل البيانات اللي في `getPublicInstructors`: ده
                  عطل عرض مستقل، وكان لازم الاتنين يتصلحوا عشان الصورة
                  تبان في القايمة.
                */}
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 md:h-20 md:w-20">
                  {instructor.avatarUrl ? (
                    <Image
                      src={optimizedImageUrl(instructor.avatarUrl, 160)}
                      alt={`صورة المدرب ${instructor.displayName}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="h-10 w-10 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="mb-2 text-xl font-black break-words text-slate-800 md:text-2xl">
                    <Link
                      href={`/creative-writing/instructors/${instructor.id}`}
                      className="hover:text-emerald-700 hover:underline"
                    >
                      {instructor.displayName}
                    </Link>
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                      <Award className="h-4 w-4" />
                      خبرة {instructor.yearsExperience}{' '}
                      {instructor.yearsExperience === 1 ? 'سنة' : 'سنوات'}
                    </div>
                    <RatingStars
                      summary={ratings.get(instructor.id) ?? { average: null, count: 0 }}
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              <p className="mb-6 flex-1 leading-relaxed font-medium text-slate-600 md:mb-8 md:text-base">
                {instructor.bio}
              </p>

              <div>
                <h3 className="mb-3 text-sm font-bold tracking-wider text-slate-800 uppercase">
                  التخصصات:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {instructor.specialties.map((specialty: string, idx: number) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600"
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-slate-400" />
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>

              {/* الكارت كان مالوش أي لينك: صفحة المدرب موجودة وشغّالة،
                  وما كانش فيه طريق يوصّلك ليها من القايمة. */}
              <Link
                href={`/creative-writing/instructors/${instructor.id}`}
                className="mt-6 block rounded-xl bg-slate-900 px-6 py-3 md:mt-8 text-center font-bold text-white transition-colors hover:bg-slate-800"
              >
                عرض الملف الكامل
              </Link>
            </Card>
          </Reveal>
          ))}
        </div>
      </Section>
    </PageContainer>
  );
}
