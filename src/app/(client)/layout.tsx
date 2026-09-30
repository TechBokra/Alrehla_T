import type { Metadata } from 'next';

import Header from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import Footer from '@/components/layout/Footer';
import { FloatingActions } from '@/components/layout/FloatingActions';
import { Providers } from '@/components/providers/Providers';
import { getSiteSettings } from '@/data/domains/content';
import { slotImageUrl } from '@/lib/cloudinary';
import { SITE_URL } from '@/lib/seo';

/** Public content is revalidated independently from the admin application. */
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
    icons: icon ? { icon: [{ url: icon }], apple: [{ url: icon }] } : undefined,
  };
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Providers>
      <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-gradient-to-r from-amber-400 via-rose-500 to-emerald-500" />
      <AnnouncementBar />
      <Header />
      <main className="relative flex w-full flex-1 flex-col">{children}</main>
      <Footer />
      <FloatingActions />
    </Providers>
  );
}
