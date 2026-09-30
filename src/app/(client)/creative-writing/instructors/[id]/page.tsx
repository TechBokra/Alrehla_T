import Link from 'next/link';
import Image from 'next/image';
import { PageContainer } from '@/components/PageContainer';
import { ArrowLeft, User, Star, Award, BookOpen, MessageCircle } from 'lucide-react';
import { getPublicInstructors } from '@/data/domains/writing';
import { getInstructorRatingSummary, getReviewsForInstructor } from '@/data/domains/reviews';
import { formatDate } from '@/lib/utils';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageMetadata } from '@/lib/seo';
import { instructorSchema, breadcrumbSchema } from '@/lib/structured-data';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructors = await getPublicInstructors();
  const instructor = instructors.find((i) => i.id === id);
  if (!instructor) return { title: 'مدرب غير موجود' };
  return pageMetadata({
    title: `${instructor.displayName} — مدرب كتابة إبداعية`,
    description:
      instructor.bio ||
      `احجز جلسة كتابة إبداعية فردية مع ${instructor.displayName} على منصة الرحلة.`,
    path: `/creative-writing/instructors/${instructor.id}`,
    image: instructor.avatarUrl,
    type: 'profile',
  });
}

export default async function InstructorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const instructors = await getPublicInstructors();
  const instructor = instructors.find(i => i.id === resolvedParams.id);

  if (!instructor) {
    notFound();
  }

  const [rating, reviews] = await Promise.all([
    getInstructorRatingSummary(instructor.id),
    getReviewsForInstructor(instructor.id),
  ]);

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* التقييم هنا بيتكتب من تقييمات حقيقية بس — لو مفيش، الحقل مش بيتبعت أصلًا. */}
      <JsonLd
        data={[
          instructorSchema({
            name: instructor.displayName,
            description: instructor.bio,
            image: instructor.avatarUrl ? optimizedImageUrl(instructor.avatarUrl, 600) : undefined,
            path: `/creative-writing/instructors/${instructor.id}`,
            rating: rating.average,
            ratingCount: rating.count,
          }),
          breadcrumbSchema([
            { name: 'الرئيسية', path: '/' },
            { name: 'بداية الرحلة', path: '/creative-writing' },
            { name: 'المدربون', path: '/creative-writing/instructors' },
            { name: instructor.displayName, path: `/creative-writing/instructors/${instructor.id}` },
          ]),
        ]}
      />

      <Section containerClassName="mx-auto w-full max-w-5xl pt-12 pb-24">
        {/* Back link */}
        <Link href="/creative-writing/instructors" className="mb-8 inline-flex items-center gap-2 font-bold text-slate-500 hover:text-emerald-600 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          العودة للمدربين
        </Link>

        {/* Profile Card */}
        <Card accentColor="emerald" className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50 p-0">
          <div className="h-48 w-full bg-gradient-to-r from-emerald-100 via-teal-50 to-sky-100"></div>
          
          <div className="relative px-8 pb-12 sm:px-12">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div className="relative -mt-20 flex flex-col sm:flex-row sm:items-end gap-6">
                <div className="relative flex h-40 w-40 items-center justify-center rounded-[2rem] border-4 border-white bg-white shadow-lg overflow-hidden">
                   {instructor.avatarUrl ? (
                      <Image src={optimizedImageUrl(instructor.avatarUrl, 400)} alt={`صورة المدرب ${instructor.displayName}`} fill sizes="160px" className="object-cover" referrerPolicy="no-referrer" priority />
                    ) : (
                      <User className="h-16 w-16 text-slate-300" />
                    )}
                </div>
                <div className="mb-2">
                  <h1 className="text-3xl font-black text-slate-900">{instructor.displayName}</h1>
                  <p className="text-lg font-medium text-emerald-600 mt-1">{instructor.specialties?.[0] || "مدرب معتمد"}</p>
                </div>
              </div>
              <div className="mb-2 shrink-0">
                <Button
                  href="/creative-writing/booking"
                  accentColor="emerald"
                  className="w-full sm:w-auto !bg-slate-900 !text-white hover:!bg-emerald-600"
                >
                  احجز جلسة الآن
                  <MessageCircle className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="mt-12 grid gap-12 lg:grid-cols-3">
              {/* Main Info */}
              <div className="lg:col-span-2 space-y-10">
                <section>
                  <h2 className="mb-4 text-2xl font-black text-slate-800 flex items-center gap-2">
                    <User className="h-6 w-6 text-emerald-500" />
                    النبذة الشخصية
                  </h2>
                  {/* Only what the instructor actually wrote. A second,
                      invented paragraph used to be printed here for everyone. */}
                  <p className="text-lg leading-relaxed font-medium text-slate-600">
                    {instructor.bio || 'لم تُضف نبذة بعد.'}
                  </p>
                </section>

                <section>
                  <h2 className="mb-4 text-2xl font-black text-slate-800 flex items-center gap-2">
                    <Award className="h-6 w-6 text-emerald-500" />
                    الخبرات والمنهجية
                  </h2>
                  {/* The instructor's own specialties — this list used to be
                      the same four invented lines on every profile. */}
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {(instructor.specialties ?? []).map((item, idx) => (
                      <li key={idx} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-bold text-slate-700">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        {item}
                      </li>
                    ))}
                    {(instructor.specialties ?? []).length === 0 && (
                      <li className="font-medium text-slate-600">لم تُضف التخصصات بعد.</li>
                    )}
                  </ul>
                </section>

                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-slate-800">
                    <Star className="h-6 w-6 text-emerald-500" />
                    تقييمات المتدربين
                  </h2>
                  {reviews.length === 0 ? (
                    <p className="rounded-2xl bg-slate-50 p-6 font-medium text-slate-500">
                      لا توجد تقييمات بعد.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <div
                          key={review.id}
                          className="rounded-2xl border border-slate-200 bg-white p-5"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="font-bold text-slate-800">{review.reviewerName}</span>
                            <span className="text-xs font-bold text-slate-400">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                          <div className="mb-3 flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={`h-4 w-4 ${
                                  n <= review.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                          {review.comment && (
                            <p className="leading-relaxed font-medium whitespace-pre-wrap text-slate-600">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Sidebar Stats */}
              <div className="space-y-6">
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-center">
                  <Star className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
                  {/* Was hard-coded "4.9/5" for every instructor. */}
                  {rating.average == null ? (
                    <>
                      <div className="text-2xl font-black text-emerald-700">مدرب جديد</div>
                      <p className="font-bold text-emerald-600/80">لا توجد تقييمات بعد</p>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-black text-emerald-700">
                        {rating.average.toFixed(1)}/5
                      </div>
                      <p className="font-bold text-emerald-600/80">
                        من {rating.count} تقييم
                      </p>
                    </>
                  )}
                </div>

                <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6 text-center">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-blue-600" />
                  <div className="text-3xl font-black text-blue-700">
                    {instructor.yearsExperience}
                  </div>
                  <p className="font-bold text-blue-600/80">
                    {instructor.yearsExperience === 1 ? 'سنة خبرة' : 'سنوات خبرة'}
                  </p>
                </div>

              </div>
            </div>

          </div>
        </Card>
      </Section>
    </PageContainer>
  );
}
