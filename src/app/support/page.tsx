import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import SupportClient from './SupportClient';
import { getCurrentUser } from '@/data/domains/auth';
import { getSiteContent, getSiteSettings } from '@/data/domains/content';
import { parseFaqText } from '@/lib/support-faqs';
import { CONTENT_DEFAULTS } from '@/lib/site-content';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'الدعم والمساعدة',
    description: 'تواصل مع فريق الدعم الفني لحل أي مشكلة أو للإجابة على استفساراتك.',
    path: '/support',
  });
}

export default async function SupportPage() {
  const [user, settings, content] = await Promise.all([getCurrentUser(), getSiteSettings(), getSiteContent()]);
  // الأسئلة من «إدارة المحتوى ← الدعم والمساعدة» (`lib/support-faqs`).
  const vars = { مدة_الملفات: settings.fileRetentionDays };
  // ⚠️ لو النص اتكتب من غير «س:/ج:» القسم كان هيفضى — فبنرجع للأسئلة الأصلية.
  const read = (key: string) => {
    const list = parseFaqText(content[key], vars);
    return list.length ? list : parseFaqText(CONTENT_DEFAULTS[key], vars);
  };
  const faqs = {
    'enha-lak': read('support.faq.enhaLak'),
    'creative-writing': read('support.faq.creativeWriting'),
    partners: read('support.faq.partners'),
    general: read('support.faq.general'),
  };
  const text = Object.fromEntries(
    Object.entries(content).filter(([k]) => k.startsWith('support.') && !k.startsWith('support.faq.')),
  );
  // واتساب والبريد من «الإعدادات العامة» — كانوا زرار من غير رابط وإيميل مكتوب في الكود.
  return (
    <SupportClient
      isSignedIn={user.role !== 'visitor'}
      whatsappNumber={settings.whatsappNumber}
      contactEmail={settings.contactEmail}
      faqs={faqs}
      text={text}
    />
  );
}
