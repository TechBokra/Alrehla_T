import { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { PageContainer } from '@/components/PageContainer';
import { pageMetadata } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { SetPasswordForm } from '@/app/(client)/set-password/SetPasswordForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'كلمة مرور جديدة',
    description: 'اختر كلمة مرور جديدة لحسابك.',
    path: '/reset-password',
    noIndex: true,
  });
}

/**
 * نهاية رحلة «نسيت كلمة المرور».
 *
 * رابط الاسترجاع بيعدّي على `/auth/callback` الأول، وهو بيبدّل الكود
 * بجلسة حقيقية ويوجّه لهنا. **فاللي بيوصل الصفحة دي مسجَّل دخوله
 * فعلًا** — والأكشن `setMyPassword` هو نفسه اللي بيستخدمه أول دخول.
 *
 * ⚠️ **ومفيش جلسة = الرابط انتهى أو اتفتح غلط.** بنقول كده صراحةً
 *    بدل ما نرمي الشخص على صفحة الدخول من غير ما يعرف السبب — لأن
 *    اللي وصل لهنا أصلًا بيحاول يحلّ مشكلة دخول، ورميه في نفس
 *    الشاشة تاني هي الحلقة اللي هو فيها.
 *
 * ⚠️ **والرابط بينتهي بعد فترة ومرة واحدة**: ده إعداد Supabase، وهو
 *    الصح — رابط بيفضل شغّال معناه إن أي حد يوصل لبريد قديم يدخل
 *    الحساب.
 */
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PageContainer className="py-12 space-y-12 md:py-16">
        <div className="mx-auto w-full max-w-md pt-12 pb-24 text-center">
          <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-800">الرابط مابقاش صالح</h1>
          <p className="mt-3 leading-relaxed font-medium text-slate-500">
            روابط تغيير كلمة المرور بتشتغل مرة واحدة وبتنتهي بعد فترة قصيرة.
            اطلب رابطًا جديدًا وهيوصلك على طول.
          </p>
          <Link
            href="/forgot-password"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:bg-slate-800"
          >
            اطلب رابطًا جديدًا
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-12 space-y-12 md:py-16">
      <div className="mx-auto w-full max-w-md pt-12 pb-24">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">كلمة مرور جديدة</h1>
          <p className="mt-2 font-medium text-slate-500">
            اختار كلمة مرور جديدة لحسابك — وبعدها هتدخل بيها على طول.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <SetPasswordForm />
        </div>
      </div>
    </PageContainer>
  );
}
