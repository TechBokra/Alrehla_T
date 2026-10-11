import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/data/domains/auth';
import { getStudentDocuments } from '@/data/domains/writing';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { PortfolioListClient } from '@/app/(admin)/dashboard/student/portfolio/PortfolioListClient';

export const dynamic = 'force-dynamic';

/**
 * مساحة الكتابة للعميل (قرار تامر، 10 أكتوبر: «لكل الحسابات»).
 *
 * كانت للطفل اللي ليه حساب دخول بس (`/dashboard/student/portfolio`).
 * العميل — حتى لو حاجز باقة لنفسه ومعاه مدرب — ماكانش عنده مكان يكتب.
 * نفس المكوّنات ونفس الجدول، والصلاحيات من القاعدة زي ما هي (صاحب
 * المستند بيكتب، ومدربه بيقرا ويراجع).
 */
export default async function AccountWritingPage() {
  const user = await getCurrentUser();
  if (user.role === 'visitor') redirect('/sign-in?next=/account/writing');
  // الطفل بحساب ليه مساحته في لوحته.
  if (user.role === 'student') redirect('/dashboard/student/portfolio');

  const documents = await getStudentDocuments(user.id);
  return (
    <div className="space-y-6">
      <DashboardPageHeader title="مساحة الكتابة" backHref="/account" />
      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium leading-relaxed text-slate-600">
        مساحتك تكتب فيها في أي وقت. لو معاك مدرب في باقة من «بداية الرحلة»، تقدر
        تبعتله النص (أو ملف من جهازك) يراجعه ويكتبلك ملاحظاته.
      </p>
      <PortfolioListClient documents={documents} basePath="/account/writing" />
    </div>
  );
}
