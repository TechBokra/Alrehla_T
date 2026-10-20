import React from 'react';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';
import { optimizedImageUrl } from '@/lib/cloudinary';

/**
 * ⚠️ الوسائل الأربعة الأخيرة بتيجي من بوابة الدفع، مش من تحويل بنكي —
 *    الطلب المدفوع بالبوابة مالوش إيصال يتراجع، وبيبان هنا بوسيلته.
 */
const METHOD_LABEL: Record<string, string> = {
  instapay: 'إنستاباي',
  vodafone_cash: 'فودافون كاش',
  card: 'بطاقة بنكية',
  fawry: 'فوري',
  valu: 'فاليو (تقسيط)',
  apple_pay: 'Apple Pay',
  wallet: 'محفظة إلكترونية',
};

/**
 * لوحة مراجعة الدفع في لوحة الإدارة.
 *
 * قبل كده كان زرار «تأكيد الدفع» موجود لوحده: الإدارة بتأكد التحويل من
 * غير ما تشوف إيصال ولا تعرف الوسيلة، والرقم الوحيد المتاح رقم العميل
 * بيكتبه بإيده. اللوحة دي بتحط قدام اللي بيراجع كل اللي محتاجه:
 * الرقم المرجعي بتاعنا، المبلغ، الوسيلة، وصورة الإيصال نفسها.
 */
export function PaymentReviewPanel({
  reference,
  amount,
  method,
  receiptUrl,
  legacyReference,
}: {
  reference?: string | null;
  amount: number;
  method?: string | null;
  receiptUrl?: string | null;
  /** رقم العملية القديم اللي كان العميل بيكتبه — بيظهر للطلبات القديمة بس. */
  legacyReference?: string | null;
}) {
  return (
    <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-black text-slate-800">مراجعة الدفع</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold text-slate-500">الرقم المرجعي</p>
          <p dir="ltr" className="mt-1 text-right font-mono text-sm font-black text-slate-800">
            {reference || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500">المبلغ</p>
          <p className="mt-1 font-black text-slate-800">{formatPrice(amount)}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500">وسيلة الدفع</p>
          <p className="mt-1 font-bold text-slate-800">
            {method ? (METHOD_LABEL[method] ?? method) : 'لم تُحدَّد بعد'}
          </p>
        </div>
      </div>

      {legacyReference && (
        <p className="mt-4 text-xs font-medium text-slate-500">
          رقم عملية كتبه العميل (طلب قديم):{' '}
          <span dir="ltr" className="font-mono">{legacyReference}</span>
        </p>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-bold text-slate-500">إيصال التحويل</p>
        {receiptUrl ? (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block h-64 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
          >
            {/* الإيصال الخاص (`lib/receipt-ref`) رابطه مؤقت ومن `api.cloudinary.com`
                — مايعدّيش على مُحسِّن الصور، بيتعرض زي ما هو. */}
            {receiptUrl.startsWith('https://res.cloudinary.com/') ? (
              <Image
                src={optimizedImageUrl(receiptUrl, 800)}
                alt="إيصال التحويل"
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-contain"
              />
            ) : (
              <img src={receiptUrl} alt="إيصال التحويل" className="h-full w-full object-contain" />
            )}
          </a>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            لسه ما اترفعش إيصال — الطلب لسه بانتظار دفع العميل.
          </p>
        )}
      </div>
    </div>
  );
}
