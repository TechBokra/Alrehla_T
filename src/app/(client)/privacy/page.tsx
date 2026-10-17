import Link from 'next/link';
import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { RichText } from '@/components/ui/RichText';
import { getSiteContent } from '@/data/domains/(shared)/content/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { fillContentTokens } from '@/lib/content-tokens';
import { retentionLabel } from '@/lib/session-recording';

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
  const [content, settings] = await Promise.all([getSiteContent(), getSiteSettings()]);

  /**
   * ⚠️ **المدد بتتقرا من الإعدادات، مش مكتوبة في النص.** السياسة كانت
   *    بتقول «شهر واحد» كرقم مكتوب، والمدة إعداد بيتغيّر من اللوحة —
   *    فأول ما الإدارة تخلّيه أسبوعين، السياسة تبقى بتوعد بحاجة
   *    والنظام بيعمل حاجة تانية. دلوقتي النص بيكتب `{المدة}`
   *    و`{مدة_الملفات}` والرقم بييجي من نفس المكان اللي النظام
   *    بيشتغل بيه.
   */
  const body = fillContentTokens(content['privacy.body'], {
    المدة: retentionLabel(settings.sessionRecording.retentionDays),
    مدة_الملفات: settings.fileRetentionDays,
  });

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section containerClassName="max-w-3xl py-20">
        <Card accentColor="amber" className="p-8 shadow-sm md:p-12">
          <h1 className="mb-2 text-center text-3xl font-black text-slate-900 md:text-4xl">
            {content['privacy.title']}
          </h1>
          {/* ⚠️ التاريخ ده مش زينة: السياسة من غير تاريخ القارئ مايعرفش
              هو بيقرا نسخة النهارده ولا نسخة من سنة. */}
          {content['privacy.updated'] && (
            <p className="mb-8 text-center text-sm font-bold text-slate-500">
              آخر تحديث: {content['privacy.updated']}
            </p>
          )}
          <div className="prose prose-slate max-w-none leading-relaxed text-slate-700">
            <RichText value={body} className="space-y-6" />
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
