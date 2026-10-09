'use client';

import Link from 'next/link';

/**
 * صفحة «حصل عطل» لأي صفحة في الموقع.
 *
 * ⚠️ لما القاعدة تقع، الصفحات **بتقول كده** بدل ما تعرض متجر فاضي أو
 *    «مفيش طلبات» (مراجعة م. محمد). والزرار بيعيد المحاولة من غير ما
 *    المستخدم يخرج من الصفحة.
 */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div dir="rtl" className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-black text-slate-900">حصل عطل مؤقت</h1>
      <p className="font-medium text-slate-600">
        مقدرناش نحمّل الصفحة دي دلوقتي. بياناتك سليمة — جرّب تاني بعد لحظات.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-[44px] rounded-xl bg-slate-900 px-6 font-bold text-white hover:bg-slate-800"
        >
          جرّب تاني
        </button>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 px-6 font-bold text-slate-800 hover:border-slate-500"
        >
          الرئيسية
        </Link>
      </div>
    </div>
  );
}
