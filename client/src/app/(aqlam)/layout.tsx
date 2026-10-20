import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { aqlamReadable } from '@/lib/aqlam/settings';

/**
 * Layout «أقلام الرحلة» — **منفصل عن باقي الموقع عن قصد**.
 *
 * بيستخدم الهيدر والفوتر الموجودين، من غير شريط الإعلان ولا الأزرار
 * العايمة (ده الفرق عن `(client)/layout`). وده المكان الوحيد اللي بيتحمّل
 * منه أي كود خاص بأقلام الرحلة: مفيش صفحة برّه `/aqlam` بتعرف إنه موجود،
 * والـlayout الجذري ما اتلمسش.
 *
 * ⚠️ العلم مقفول = 404 (قراءة الإعدادات هنا من نفس الكاش اللي الهيدر بيقراه،
 *    فمفيش استعلام زيادة). ده مش الحارس الأمني: القاعدة نفسها بترجّع
 *    صفر نصوص لما التشغيل مقفول، والـlayout والصفحة بيترندروا بالتوازي.
 */
export default async function AqlamLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();
  if (!aqlamReadable(settings.aqlam)) notFound();

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gradient-to-r from-amber-400 via-rose-500 to-emerald-500" />
      <Header />
      <main className="relative flex w-full flex-1 flex-col">{children}</main>
      <Footer />
    </>
  );
}
