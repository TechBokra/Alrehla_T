import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { pageMetadata } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'نسيت كلمة المرور',
    description: 'ابعت لنفسك رابطًا لتغيير كلمة المرور.',
    path: '/forgot-password',
    noIndex: true,
  });
}

/**
 * «نسيت كلمة المرور».
 *
 * ⚠️ **الموقع مكانش فيه طريق واحد لده.** اللي بينسى كلمة مروره كان
 *    بيفضل مقفول برّه للأبد، والحل الوحيد إنه يكلّم الإدارة وحد
 *    يعيّنها له بإيده. عميل ضايع على خطوة ناقصة.
 *
 * واللي داخل أصلًا مالوش لزمة هنا — بيغيّرها من إعدادات حسابه.
 */
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/account/settings');

  return (
    <PageContainer className="py-12 space-y-12 md:py-16">
      <div className="mx-auto w-full max-w-md pt-12 pb-24">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">نسيت كلمة المرور؟</h1>
          <p className="mt-2 font-medium text-slate-500">
            اكتب بريدك وهنبعتلك رابطًا تحطّ منه كلمة مرور جديدة.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <ForgotPasswordForm />
        </div>
      </div>
    </PageContainer>
  );
}
