import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getCertificateById } from '@/data/domains/(shared)/certificates/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { certificateViewable } from '@/lib/certificates';
import { formatCairo } from '@/lib/timezone';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'شهادة إتمام',
  robots: { index: false, follow: false },
};

/**
 * الشهادة الرقمية — صفحة لوحدها من غير هيدر الموقع عشان تتطبع نضيفة (A4 بالعرض).
 * صلاحيات القاعدة بتسمح بس لولي الأمر صاحب الحجز وللإدارة.
 */
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (user.role === 'visitor') redirect(`/sign-in?next=${encodeURIComponent(`/certificate/${id}`)}`);

  const cert = await getCertificateById(id);
  if (!cert) notFound();

  if (!certificateViewable(cert.status)) {
    return (
      <main className="mx-auto max-w-xl p-10 text-center">
        <p className="text-lg font-bold text-slate-700">الشهادة لسه بتتجهّز — هيوصلك إشعار أول ما تبقى جاهزة.</p>
        <Link href="/account/bookings" className="mt-6 inline-block font-bold text-blue-700 hover:underline">
          رجوع للحجوزات
        </Link>
      </main>
    );
  }

  const settings = await getSiteSettings();
  const logo = settings.images.logo;
  const siteName = settings.siteName || 'منصة الرحلة';
  const issued = cert.issuedAt ?? cert.completedAt;

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-slate-100 p-6 print:block print:bg-white print:p-0">
      <style>{`@page { size: A4 landscape; margin: 0; } @media print { html, body { background: #fff; } }`}</style>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton />
        <Link
          href="/account/bookings"
          className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-slate-300 bg-white px-5 font-bold text-slate-700"
        >
          رجوع
        </Link>
      </div>

      <article
        dir="rtl"
        className="relative aspect-[297/210] w-full max-w-[1100px] bg-white shadow-xl print:h-[210mm] print:w-[297mm] print:max-w-none print:shadow-none"
      >
        <div className="absolute inset-[3%] flex flex-col items-center justify-between border-[6px] border-double border-amber-500 px-[6%] py-[4%] text-center">
          <div className="flex flex-col items-center gap-3">
            {logo ? (
              <img src={logo} alt={siteName} className="h-16 w-auto object-contain" />
            ) : (
              <p className="text-2xl font-black text-slate-800">{siteName}</p>
            )}
            <p className="text-sm font-bold tracking-wide text-amber-700">برنامج «بداية الرحلة» للكتابة الإبداعية</p>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-black text-slate-900 md:text-5xl">شهادة إتمام</h1>
            <p className="text-lg font-medium text-slate-600">تشهد {siteName} بإتمام</p>
            <p className="text-4xl font-black text-amber-700 md:text-5xl">{cert.participantName}</p>
            <p className="text-lg font-medium leading-9 text-slate-700">
              رحلة الكتابة الإبداعية بنجاح في باقة
              <br />
              <strong className="text-2xl text-slate-900">«{cert.packageName}»</strong>
            </p>
          </div>

          <div className="flex w-full items-end justify-between text-sm text-slate-600">
            <div className="text-start">
              <p>
                تاريخ الإصدار: <strong>{formatCairo(issued, { dateStyle: 'long' })}</strong>
              </p>
              {cert.certificateNo && (
                <p>
                  رقم الشهادة: <strong dir="ltr">{cert.certificateNo}</strong>
                </p>
              )}
            </div>
            <div className="text-center">
              <div className="mb-1 h-px w-48 bg-slate-400" />
              <p className="font-bold">إدارة {siteName}</p>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
