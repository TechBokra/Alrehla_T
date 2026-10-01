import type { Metadata } from 'next';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';
import { PageContainer } from '@/components/PageContainer';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'الشراء من حساب ولي الأمر',
    description: 'الطلبات والاشتراكات بتتعمل من حساب ولي الأمر.',
    path: '/enha-lak/ask-guardian',
    noIndex: true,
  });
}

/**
 * حساب طفل تابع حاول يبدأ شراء (`requireShopper`).
 *
 * بدل ما يملا المعالج كله ويترفض في الآخر، بيوصل هنا من أول ضغطة.
 */
export default function AskGuardianPage() {
  return (
    <PageContainer className="py-16">
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
          <Users className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-black text-slate-900">الطلب من حساب ولي أمرك</h1>
        <p className="mt-3 leading-relaxed text-slate-700">
          حسابك مربوط بحساب ولي أمرك، والطلبات والاشتراكات بتتعمل من حسابه هو.
          قوله على القصة أو الكتاب اللي عجبك، ويقدر يطلبه لك باسمك.
        </p>
        <Link
          href="/enha-lak/library"
          className="mt-6 inline-block rounded-xl bg-rose-700 px-6 py-3 font-bold text-white hover:bg-rose-800"
        >
          ارجع للمكتبة
        </Link>
      </div>
    </PageContainer>
  );
}
