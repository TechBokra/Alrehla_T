'use client';

import React, { useState } from 'react';
import { Building, CreditCard } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { submitWithdrawalRequest } from '@/actions/finance';
import { useAction } from '@/lib/use-action';
import { FormError, FormSuccess } from '@/components/ui/FormError';

/**
 * طلب سحب المستحقات — للمدرب وللناشر.
 *
 * ── ليه مكوّن مشترك ─────────────────────────────────────────
 *
 * شاشة الناشر كانت مكتوب فيها بالنص:
 *
 *     «لطلب السحب، تواصل مع الإدارة —
 *      الطلب من داخل الموقع غير متاح بعد.»
 *
 * وده كان صادقًا، لأن جدول `withdrawal_requests` عمود المالك فيه
 * `instructor_id` **ومطلوب** — الناشر مكانش ليه مكان فيه أصلًا (ملف
 * SQL 100 فتحه).
 *
 * ⚠️ **ونسخ النموذج للناشر كان هيكرّر عطلًا اتصلّح مرة.** خانات
 *    «اسم البنك» و«رقم الحساب» كانت `required` **ومش مربوطة بأي
 *    حالة**: المستخدم يملاها، والمتصفح يسمحله، والخادم ياخد
 *    `method` وحده. فالإدارة تشوف «تحويل بنكي» من غير رقم حساب.
 *    النسخة التانية كانت هتبدأ من نفس النقطة.
 *
 * ── اللي بيتبعت وللي مبيتبعتش ───────────────────────────────
 *
 * ⚠️ **المبلغ مبيتبعتش من هنا.** الخادم بيحسبه من جدول المستحقات،
 *    **ومحفّز في القاعدة بيعيد كتابته** من الرصيد الحقيقي (ملف 100)
 *    — فاللي جاي من المتصفح بيتجاهل مرتين. الرقم اللي في الشاشة
 *    للعرض وبس.
 */
export function WithdrawalRequestForm({
  availableAmount,
  onDone,
}: {
  /** للعرض وحده — الخادم بيحسب المبلغ بنفسه. */
  availableAmount: number;
  onDone?: () => void;
}) {
  const [method, setMethod] = useState<'bank' | 'wallet'>('bank');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [walletNumber, setWalletNumber] = useState('');
  const [done, setDone] = useState('');

  const withdraw = useAction(submitWithdrawalRequest, {
    onSuccess: (result) => {
      if (result.ok) {
        // ⚠️ الرقم من رد الخادم لا من `availableAmount`: المحفّز ممكن
        //    يكون حسب رصيدًا مختلفًا لو مستحق اتسجّل في نفس اللحظة.
        setDone(`اتقدّم طلب سحب بـ${formatPrice(result.amount)} للمراجعة.`);
        onDone?.();
      }
    },
    fallbackError: 'تعذّر إرسال طلب السحب.',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone('');
    const details =
      method === 'bank'
        ? `تحويل بنكي · البنك: ${bankName.trim()} · الحساب/الآيبان: ${bankAccount.trim()}`
        : `محفظة إلكترونية · الرقم: ${walletNumber.trim()}`;
    await withdraw.run(method, details);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-2 text-xl font-black text-slate-800">تقديم طلب سحب</h3>
      <p className="mb-6 text-sm font-medium text-slate-500">
        المبلغ بيتحسب من رصيدك المعلّق ({formatPrice(availableAmount)}) وقت التقديم.
      </p>

      <FormSuccess message={done} className="mb-4" />
      <FormError message={withdraw.error} className="mb-4" />

      <form onSubmit={submit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">طريقة السحب</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setMethod('bank')}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 font-bold transition-all ${
                  method === 'bank'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <Building className="h-5 w-5" />
                تحويل بنكي
              </button>
              <button
                type="button"
                onClick={() => setMethod('wallet')}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 font-bold transition-all ${
                  method === 'wallet'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <CreditCard className="h-5 w-5" />
                محفظة إلكترونية
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {method === 'bank' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">اسم البنك</label>
                  <input
                    required
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    رقم الحساب أو الآيبان (IBAN)
                  </label>
                  <input
                    required
                    type="text"
                    dir="ltr"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left outline-none focus:border-blue-500"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">رقم المحفظة (الهاتف)</label>
                <input
                  required
                  type="tel"
                    inputMode="tel"
                    pattern="[+]?[0-9\s()-]{7,20}"
                  dir="ltr"
                  value={walletNumber}
                  onChange={(e) => setWalletNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="rounded-xl px-6 py-3 font-bold text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
          )}
          <button
            type="submit"
            disabled={withdraw.pending}
            aria-busy={withdraw.pending || undefined}
            className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {withdraw.pending ? 'جاري التقديم...' : 'تأكيد طلب السحب'}
          </button>
        </div>
      </form>
    </div>
  );
}
