import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pageMetadata } from '@/lib/seo';
import { PageContainer } from '@/components/PageContainer';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { StaffAccountNotice } from '@/components/account/StaffAccountNotice';
import { staffPurchaseBlock } from '@/lib/buying-roles';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'الطلب من حساب عميل',
    description: 'حسابات الشغل مابتطلبش من نفس الحساب.',
    path: '/enha-lak/staff-account',
    noIndex: true,
  });
}

/**
 * حساب شغل (مدرب/مقدّم خدمة/إداري) حاول يبدأ شراء (`requireShopper`).
 *
 * الصفحة دي أخت `ask-guardian`: بدل ما يملا المعالج كله ويترفض في آخر
 * زرار، بيوصل هنا من أول ضغطة ويعرف السبب والحل.
 *
 * ⚠️ **والدور بيتقرا هنا تاني**، مش بيتبعت في الرابط: لو كان في
 *    `?role=`، أي حد كان يقدر يفتح الصفحة بأي دور ويشوف رسالة
 *    مش بتخصّه.
 */
export default async function StaffAccountPage() {
  const user = await getCurrentUser();

  // العميل العادي مالوش لازمة هنا — بيرجع للمتجر بدل صفحة مابتقول له حاجة.
  if (!staffPurchaseBlock(user.role)) redirect('/enha-lak');

  return (
    <PageContainer className="py-16">
      <div className="mx-auto max-w-lg">
        <StaffAccountNotice role={user.role} what="الطلب" />
        <div className="mt-6 text-center">
          <Link href="/enha-lak" className="font-bold text-slate-600 hover:text-slate-900">
            ارجع للمتجر
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
