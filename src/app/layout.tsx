import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';
import { SITE_URL } from '@/lib/seo';

const cairo = Cairo({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-cairo',
});

/**
 * The root layout is intentionally application-agnostic. Route groups below it
 * provide the client storefront and admin dashboard shells independently.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'الرحلة',
  description: 'منصة الرحلة',
};

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
        {children}
      </body>
    </html>
  );
}
