import Image from 'next/image';
import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'عن المنصة',
    description: 'تعرف على رؤيتنا ومهمتنا في منصة الرحلة لتطوير قدرات الأطفال والشباب.',
    path: '/about',
  });
}

import { PageContainer } from '@/components/PageContainer';
import { getSiteSettings, getSiteContent } from '@/data/domains/content';
import { slotImageUrl, blurPlaceholder } from '@/lib/cloudinary';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';
import {
  Sparkles,
  Target,
  Compass,
  HeartHandshake,
  Lightbulb,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';

export default async function AboutPage() {
  const settings = await getSiteSettings();
  const content = await getSiteContent();

  // الأيقونة واللون ثابتان لكل قيمة؛ الاسم والوصف بيتعدّلوا من لوحة الإدارة.
  const values = [
    { key: 'value1', icon: Compass, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'value2', icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-50' },
    { key: 'value3', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'value4', icon: UserCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { key: 'value5', icon: Users, color: 'text-rose-600', bg: 'bg-rose-50' },
  ].map((v) => ({
    ...v,
    title: content[`about.${v.key}.title`],
    description: content[`about.${v.key}.text`],
  }));

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Header */}
      <Section containerClassName="max-w-4xl space-y-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold tracking-widest text-slate-600 uppercase">
          {content['about.badge']}
        </div>
        <h1 className="text-4xl leading-tight font-black text-slate-900 md:text-6xl">
          {content['about.title']}
        </h1>
        <div className="relative mt-12 h-64 w-full overflow-hidden rounded-[2.5rem] md:h-96">
          {settings.images.aboutTeam ? (
            <Image
              src={slotImageUrl(settings.images.aboutTeam, 'aboutTeam')}
              alt="فريق منصة الرحلة"
              fill
              sizes="(max-width: 896px) 100vw, 896px"
              priority
              placeholder={blurPlaceholder(settings.images.aboutTeam) ? 'blur' : 'empty'}
              blurDataURL={blurPlaceholder(settings.images.aboutTeam)}
              className="object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ImagePlaceholder label="صورة صفحة رحلتنا" />
          )}
          {/* تدرّج تغميق اتشال: مفيش أي نص فوق الصورة دي، فكان بيغمّقها
              بلا سبب. مفيش طبقة فوق أي صورة في الموقع. */}
        </div>
      </Section>

      {/* The Spark */}
      <Section containerClassName="max-w-4xl">
        <Card accentColor="amber" className="relative overflow-hidden p-8 md:p-12">
          <div className="absolute top-0 right-0 -z-0 h-32 w-32 rounded-bl-full bg-amber-50"></div>
          <div className="relative z-10 flex flex-col items-start gap-8 md:flex-row">
            <div className="shrink-0 rounded-2xl bg-amber-100 p-4 text-amber-600">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-black text-slate-800">{content['about.spark.title']}</h2>
              <p className="text-lg leading-relaxed font-medium text-slate-600">
                {content['about.spark.text']}
              </p>
            </div>
          </div>
        </Card>
      </Section>

      {/* Mission & Vision */}
      <Section containerClassName="grid max-w-6xl gap-8 md:grid-cols-2">
        <Card accentColor="amber" className="bg-blue-50/50 p-8 md:p-12 border-blue-100">
          <div className="mb-6 flex items-center gap-4">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
              <Target className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">{content['about.mission.title']}</h2>
          </div>
          <p className="text-lg leading-relaxed font-medium text-slate-600">
            {content['about.mission.text']}
          </p>
        </Card>

        <Card accentColor="amber" className="bg-emerald-50/50 p-8 md:p-12 border-emerald-100">
          <div className="mb-6 flex items-center gap-4">
            <div className="rounded-xl bg-emerald-100 p-3 text-emerald-600">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">{content['about.vision.title']}</h2>
          </div>
          <p className="text-lg leading-relaxed font-medium text-slate-600">
            {content['about.vision.text']}
          </p>
        </Card>
      </Section>

      {/* Core Values */}
      <Section>
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['about.values.title']}
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <Card
                key={index}
                accentColor="amber"
                className={`p-6 transition-all hover:shadow-md ${index > 2 ? 'md:col-span-1.5' : ''}`}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${value.bg} ${value.color} mb-4`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-800">
                  {value.title}
                </h3>
                <p className="font-medium text-slate-500">
                  {value.description}
                </p>
              </Card>
            );
          })}
        </div>
      </Section>
    </PageContainer>
  );
}
