import Link from 'next/link';
import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { RichText } from '@/components/ui/RichText';
import { getSiteContent } from '@/data/domains/content';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'سياسة الخصوصية',
    description: 'تعرف على سياسة الخصوصية وكيفية حماية بياناتك في منصة الرحلة.',
    path: '/privacy',
  });
}

// نص السياسة كان مكتوبًا في الكود — أي تعديل قانوني كان محتاج مبرمج.
// بقى يتعدّل من: لوحة الإدارة ← محتوى الصفحات ← سياسة الخصوصية.
export default async function PrivacyPage() {
  const content = await getSiteContent();

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section containerClassName="max-w-3xl py-20">
        <Card accentColor="amber" className="p-8 shadow-sm md:p-12">
          <h1 className="mb-8 text-center text-3xl font-black text-slate-900 md:text-4xl">
            {content['privacy.title']}
          </h1>
          <div className="prose prose-slate max-w-none leading-relaxed text-slate-700">
            <RichText value={content['privacy.body']} className="space-y-6" />
            <p className="mt-8 border-t border-slate-100 pt-6">
              {content['privacy.footer']}{' '}
              <Link
                href="/support"
                className="font-bold text-amber-600 hover:underline"
              >
                مركز الدعم
              </Link>
              .
            </p>
          </div>
        </Card>
      </Section>
    </PageContainer>
  );
}
