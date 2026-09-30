import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { JoinForm } from './JoinForm';
import { Button } from '@/components/ui/Button';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'انضم إلينا كمدرب أو ناشر',
    description: 'قدم طلبك للانضمام إلى فريق منصة الرحلة كمدرب معتمد أو دار نشر.',
    path: '/join-us',
  });
}

import { PageContainer } from '@/components/PageContainer';
import { getSiteContent } from '@/data/domains/content';
import {
  Heart,
  Users,
  Map,
  TrendingUp,
  PenTool,
  Image as ImageIcon,
  Mic,
} from 'lucide-react';

export default async function JoinUsPage() {
  const content = await getSiteContent();

  // الأيقونات والألوان ثابتة؛ النصوص من لوحة الإدارة ← محتوى الصفحات.
  const reasons = [
    { key: 'reason1', icon: Heart, bg: 'bg-rose-50', color: 'text-rose-600' },
    { key: 'reason2', icon: Users, bg: 'bg-blue-50', color: 'text-blue-600' },
    { key: 'reason3', icon: Map, bg: 'bg-amber-50', color: 'text-amber-600' },
    { key: 'reason4', icon: TrendingUp, bg: 'bg-emerald-50', color: 'text-emerald-600' },
  ].map((r) => ({
    ...r,
    title: content[`join.${r.key}.title`],
    description: content[`join.${r.key}.text`],
  }));

  const roles = [
    { key: 'role1', icon: PenTool },
    { key: 'role2', icon: ImageIcon },
    { key: 'role3', icon: Mic },
  ].map((r) => ({
    ...r,
    title: content[`join.${r.key}.title`],
    description: content[`join.${r.key}.text`],
  }));

  return (
    <PageContainer className="!py-0 !space-y-0">
      {/* Hero Section */}
      <Section containerClassName="max-w-4xl space-y-6 text-center">
        <h1 className="text-4xl leading-tight font-black text-slate-900 md:text-6xl">
          {content['join.title']}
        </h1>
        <p className="mx-auto max-w-3xl text-lg leading-relaxed font-medium text-slate-500 md:text-xl">
          {content['join.subtitle']}
        </p>
      </Section>

      {/* Why Join Us */}
      <Section containerClassName="max-w-6xl">
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['join.why.title']}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason, idx) => {
            const Icon = reason.icon;
            return (
              <Card
                key={idx}
                accentColor="amber"
                className="p-8 text-center"
              >
                <div
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${reason.bg} ${reason.color} mb-6`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-800">
                  {reason.title}
                </h3>
                <p className="text-sm leading-relaxed font-medium text-slate-600">
                  {reason.description}
                </p>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Available Roles */}
      <Section containerClassName="max-w-5xl rounded-3xl border border-slate-100 bg-slate-50 p-8 md:p-16">
        <h2 className="mb-12 text-center text-3xl font-black text-slate-800">
          {content['join.roles.title']}
        </h2>
        <div className="space-y-6">
          {roles.map((role, idx) => {
            const Icon = role.icon;
            return (
              <Card
                key={idx}
                accentColor="amber"
                className="flex flex-col items-start gap-6 p-6 md:flex-row md:p-8"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="mb-2 text-xl font-bold text-slate-800">
                    {role.title}
                  </h3>
                  <p className="leading-relaxed font-medium text-slate-600">
                    {role.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Application Form */}
      <Section containerClassName="max-w-3xl">
        <Card accentColor="amber" className="p-8 shadow-xl shadow-slate-200/50 md:p-12">
          <h2 className="mb-8 text-center text-3xl font-black text-slate-800">
            {content['join.form.title']}
          </h2>
          <JoinForm />
        </Card>
      </Section>
    </PageContainer>
  );
}
