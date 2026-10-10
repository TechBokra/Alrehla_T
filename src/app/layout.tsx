import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';
import { FloatingActions } from '@/components/layout/FloatingActions';
import { Providers } from '@/components/providers/Providers';
import { getSiteSettings } from '@/data/domains/content';
import { slotImageUrl } from '@/lib/cloudinary';
import { SITE_URL } from '@/lib/seo';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { ClientTimeProvider } from '@/components/providers/ClientTimeProvider';
import { getServerNow } from '@/data/server-time';

const cairo = Cairo({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-cairo',
});

/**
 * بيانات الصفحة اللي بتظهر لما حد يبعت رابط الموقع.
 *
 * من غيرها، رابط الموقع على واتساب أو فيسبوك بيظهر نصًا أزرق سادة. معاها
 * بيظهر كارت فيه صورة وعنوان ووصف — وده أول انطباع عن المنصة.
 *
 * `metadataBase` هو اللي بيخلي روابط الصور تتكتب كاملة؛ من غيره التطبيقات
 * ما بتلاقيش الصورة أصلًا.
 */
/**
 * الصفحات العامة تُبنى مسبقًا وتتجدد كل ساعة على الأكثر.
 *
 * التجديد الفوري بيحصل لما الإدارة تحفظ محتوى — كل دوال الحفظ بتنادي
 * revalidatePath. والساعة دي شبكة أمان: لو البناء وقع وقت ما قاعدة
 * البيانات كانت مش متاحة، الصفحة بتصلّح نفسها من غير تدخّل.
 */
export const revalidate = 3600;


export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = settings.siteName?.trim() || 'الرحلة';
  const description =
    'منصة عربية لتعلّم الكتابة الإبداعية وتقديم قصص ومنتجات مخصصة للأطفال والشباب.';

  const share = settings.images.ogImage
    ? slotImageUrl(settings.images.ogImage, 'ogImage')
    : undefined;
  const icon = settings.images.favicon
    ? slotImageUrl(settings.images.favicon, 'favicon')
    : undefined;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${title}` },
    description,
    openGraph: {
      type: 'website',
      locale: 'ar_EG',
      siteName: title,
      title,
      description,
      images: share ? [{ url: share, width: 1200, height: 630, alt: title }] : undefined,
    },
    twitter: {
      card: share ? 'summary_large_image' : 'summary',
      title,
      description,
      images: share ? [share] : undefined,
    },
    // أيقونة التبويب بترفعها الإدارة؛ لو مرفعتش، المتصفح بيستخدم الافتراضي.
    icons: icon ? { icon: [{ url: icon }], apple: [{ url: icon }] } : undefined,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={`${cairo.variable} flex min-h-screen flex-col font-sans text-slate-800 antialiased bg-[#FCFDFD] selection:bg-amber-200 selection:text-amber-900`}
        suppressHydrationWarning
      >
        <GoogleAnalytics />
        <ClientTimeProvider initialTimestamp={getServerNow().getTime()}>
        <Providers>
          <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-rose-500 to-emerald-500 z-50" />
          <AnnouncementBar />
          <Header />
          <main className="relative flex w-full flex-1 flex-col">{children}</main>
          <Footer />
          <FloatingActions />
        </Providers>
        </ClientTimeProvider>
      </body>
    </html>
  );
}
