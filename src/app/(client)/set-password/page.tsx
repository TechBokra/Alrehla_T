import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { pageMetadata } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { needsPasswordSetup } from '@/lib/first-login';
import { SetPasswordForm } from './SetPasswordForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'حدّد كلمة مرورك',
    description: 'خطوة أخيرة قبل الدخول.',
    path: '/set-password',
    noIndex: true,
  });
}

/**
 * الشاشة اللي بيتوقف عندها صاحب الحساب الجديد.
 *
 * ⚠️ **والحماية هنا مكررة عن قصد.** الحارس (`middleware.ts`) بيوجّه
 *    لهنا، والصفحة دي بتسأل تاني بنفسها. السبب إن الحارس بيشتغل على
 *    مسارات محددة، والصفحة دي بتفضل موجودة لأي حد يكتب عنوانها —
 *    فلو ما سألتش، أي مستخدم كان هيشوف شاشة «حط كلمة مرورك» في وقت
 *    مالهاش فيه معنى.
 */
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');
  // مالوش علامة = عدّى الخطوة دي خلاص. `/dashboard` بتوزّعه على لوحته.
  if (!needsPasswordSetup(user)) redirect('/dashboard');

  return (
    <PageContainer className="py-12 space-y-12 md:py-16">
      <div className="mx-auto w-full max-w-md pt-12 pb-24">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">حدّد كلمة مرورك</h1>
          <p className="mt-2 font-medium text-slate-500">
            دخلت بالرمز المؤقت. اختار دلوقتي كلمة مرور تخصّك — بعدها الرمز
            مايبقاش ينفع.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <SetPasswordForm />
        </div>
      </div>
    </PageContainer>
  );
}
