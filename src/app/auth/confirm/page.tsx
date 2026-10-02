import { Metadata } from 'next';
import { MailOpen } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { pageMetadata } from '@/lib/seo';
import { ConfirmInviteForm } from './ConfirmInviteForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'دعوة للانضمام',
    description: 'خطوة واحدة وتدخل حسابك.',
    path: '/auth/confirm',
    noIndex: true,
  });
}

/**
 * الصفحة اللي رابط الدعوة بيفتحها.
 *
 * ⚠️ **الصفحة نفسها مابتعملش حاجة** — بتعرض زرار وبس. التحقق من الرمز
 *    بيحصل لما الشخص يضغط (`confirmInvite`)، عشان معاينة واتساب
 *    للرابط ماتستهلكش الرمز. الشرح كامل في الأكشن.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash: tokenHash = '' } = await searchParams;

  return (
    <PageContainer className="space-y-12 py-12 md:py-16">
      <div className="mx-auto w-full max-w-md pt-12 pb-24">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <MailOpen className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">
            أهلًا بيك في الرحلة
          </h1>
          <p className="mt-2 font-medium text-slate-500">
            الإدارة عملتلك حساب. اضغط الزرار وبعدها اختار كلمة المرور اللي هتدخل
            بيها.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          {tokenHash ? (
            <ConfirmInviteForm tokenHash={tokenHash} />
          ) : (
            <p className="text-center font-bold text-rose-700">
              الرابط ناقص — انسخه كامل من الرسالة وافتحه تاني.
            </p>
          )}
          <p className="mt-6 text-center text-xs font-medium text-slate-400">
            لو فاتح حساب تاني على الجهاز ده، هيتقفل وتدخل بالحساب الجديد.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
