import { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'الرابط مابقاش صالح',
    description: 'الرابط اتستعمل قبل كده أو مدته خلصت.',
    path: '/auth/auth-code-error',
    noIndex: true,
  });
}

/**
 * لما رابط من الإيميل (تأكيد بريد أو استرجاع كلمة مرور) يفشل.
 *
 * ⚠️ `/auth/callback` كان بيوجّه لهنا من زمان، **والصفحة نفسها ماكانتش
 *    موجودة** — يعني أي رابط منتهي كان بيوصّل لصفحة «غير موجود» من غير
 *    أي تفسير.
 */
export default function Page() {
  return (
    <PageContainer className="space-y-12 py-12 md:py-16">
      <div className="mx-auto w-full max-w-md pt-12 pb-24 text-center">
        <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black text-slate-800">
          الرابط مابقاش صالح
        </h1>
        <p className="mt-3 leading-relaxed font-medium text-slate-500">
          الروابط اللي بتوصل على الإيميل بتشتغل مرة واحدة وبتنتهي بعد فترة. لو
          كنت بتغيّر كلمة المرور اطلب رابطًا جديدًا، ولو كنت بتأكّد بريدك جرّب
          تسجّل دخول.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800"
          >
            رابط جديد لكلمة المرور
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            تسجيل الدخول
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
