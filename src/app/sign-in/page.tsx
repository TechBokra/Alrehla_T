import Link from 'next/link';
import { PageContainer } from '@/components/PageContainer';
import { LogIn } from 'lucide-react';
import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { getSafeRedirectPath } from '@/lib/safe-redirect';
import { SignInForm } from '@/components/SignInForm';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'تسجيل الدخول',
    description: 'سجل دخولك إلى حسابك في منصة الرحلة.',
    path: '/sign-in',
    noIndex: true,
  });
}

/**
 * ⚠️ **`?next=` بيتنقل بين الدخول والتسجيل.** عميل جديد جاي من المعالج
 *    (`/sign-in?next=/enha-lak/custom/…`) كان يدوس «أنشئ حسابًا» فيضيع
 *    الرجوع، ويخلص تسجيله في لوحة التحكم بدل ما يكمّل طلبه.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next ? getSafeRedirectPath(next) : '/';
  const otherHref = safeNext !== '/' ? `/sign-up?next=${encodeURIComponent(safeNext)}` : '/sign-up';
  return (
    <PageContainer className="py-12 space-y-12 md:py-16">
      <div className="mx-auto w-full max-w-md pt-12 pb-24">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-6">
            <LogIn className="h-6 w-6" />
          </Link>
          <h1 className="text-3xl font-black text-slate-800">مرحباً بعودتك</h1>
          <p className="mt-2 text-slate-500 font-medium">سجل دخولك لمتابعة رحلتك معنا</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <SignInForm />

          <div className="mt-8 text-center text-sm font-medium text-slate-600">
            ليس لديك حساب؟{' '}
            <Link href={otherHref} className="font-bold text-amber-700 hover:text-amber-800 hover:underline">
              أنشئ حساباً جديداً
            </Link>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
