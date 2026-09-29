import Link from 'next/link';
import { PageContainer } from '@/components/PageContainer';
import { UserPlus } from 'lucide-react';
import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { SignUpForm } from '@/components/SignUpForm';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'إنشاء حساب جديد',
    description: 'أنشئ حساباً جديداً في منصة الرحلة وابدأ رحلتك.',
    path: '/sign-up',
    noIndex: true,
  });
}

export default function SignUpPage() {
  return (
    <PageContainer className="py-12 space-y-12 md:py-16">
      <div className="mx-auto w-full max-w-md pt-12 pb-24">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-6">
            <UserPlus className="h-6 w-6" />
          </Link>
          <h1 className="text-3xl font-black text-slate-800">حساب جديد</h1>
          <p className="mt-2 text-slate-500 font-medium">انضم إلى مجتمع الرحلة وابدأ القصة</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <SignUpForm />

          <div className="mt-8 text-center text-sm font-medium text-slate-600">
            لديك حساب بالفعل؟{' '}
            <Link href="/sign-in" className="font-bold text-amber-700 hover:text-amber-800 hover:underline">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
