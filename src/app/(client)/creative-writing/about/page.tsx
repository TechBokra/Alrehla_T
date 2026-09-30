import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'عن «بداية الرحلة»',
    description: 'برنامج الكتابة الإبداعية في منصة الرحلة: جلسات فردية تساعد الطفل واليافع على تطوير أدواته وصوته في الكتابة.',
    path: '/creative-writing/about',
  });
}

import { Sparkles, PenTool, Heart } from 'lucide-react';

import { PageContainer } from '@/components/PageContainer';
import { getSiteContent } from '@/data/domains/content';
import { SectionHeader } from '@/components/SectionHeader';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';


export default async function AboutProgramPage() {
  const content = await getSiteContent();

  // الأيقونات والألوان ثابتة؛ النصوص من لوحة الإدارة ← محتوى الصفحات.
  const features = [
    { key: 'feature1', icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'feature2', icon: PenTool, color: 'text-teal-600', bg: 'bg-teal-50' },
    { key: 'feature3', icon: Heart, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ].map((f) => ({
    ...f,
    title: content[`cwAbout.${f.key}.title`],
    description: content[`cwAbout.${f.key}.text`],
  }));

  const points = [
    content['cwAbout.point1'],
    content['cwAbout.point2'],
    content['cwAbout.point3'],
  ];

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Hero Section */}
      <Section containerClassName="pt-8">
        <SectionHeader
          title={content['cwAbout.title']}
          titleClassName="md:text-6xl"
          description={content['cwAbout.subtitle']}
        />
      </Section>

      {/* Why Us Section */}
      <Section containerClassName="mx-auto w-full max-w-5xl">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 md:p-16">
          <h2 className="mb-8 text-center text-3xl font-black text-slate-800">
            {content['cwAbout.why.title']}
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-lg font-medium text-slate-600">
            {content['cwAbout.why.text']}
          </p>
          <div className="space-y-6">
            {points.map((point, idx) => (
              <Card
                key={idx}
                accentColor="emerald"
                className="flex items-center gap-4 p-6"
              >
                <div className="h-3 w-3 shrink-0 rounded-full bg-emerald-500"></div>
                <p className="text-lg leading-relaxed font-medium text-slate-700">
                  {point}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      {/* Distinctive Features */}
      <Section containerClassName="mx-auto w-full max-w-6xl pb-20">
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['cwAbout.features.title']}
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card
                key={idx}
                accentColor="emerald"
                className="p-8 text-center"
              >
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${feature.bg} ${feature.color} mb-6`}
                >
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="mb-4 text-xl font-bold text-slate-800">
                  {feature.title}
                </h3>
                <p className="leading-relaxed font-medium text-slate-600">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
      </Section>
    </PageContainer>
  );
}
