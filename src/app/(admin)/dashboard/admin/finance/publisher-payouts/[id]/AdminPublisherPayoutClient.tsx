'use client';
import { formatPrice } from '@/lib/utils';
import React, { useState } from 'react';
import { PublisherPayout, Publisher } from '@/types';
import { markPublisherPayoutAsPaid } from '@/actions/finance';
import { CheckCircle2, Building, AlertCircle } from 'lucide-react';

interface Props {
  payout: PublisherPayout;
  publisher: Publisher | undefined;
}

export function AdminPublisherPayoutClient({ payout, publisher }: Props) {
  const [status, setStatus] = useState(payout.status);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMarkAsPaid = async () => {
    setIsProcessing(true);
    try {
      await markPublisherPayoutAsPaid(payout.id);
      setStatus('paid');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {status === 'paid' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3 text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div className="text-sm font-bold">
            <p>تم تحويل هذه الدفعة بنجاح.</p>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h3 className="text-xl font-black text-slate-800 mb-6">تفاصيل المستحقات</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="text-sm text-slate-500 mb-1">الناشر</div>
            <div className="font-bold text-slate-800 text-lg">{publisher?.name || payout.publisherId}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">المبلغ المطلوب</div>
            <div className="font-black text-blue-600 text-2xl">{formatPrice(payout.amount)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">فترة الاستحقاق</div>
            <div className="font-bold text-slate-800 text-lg">{payout.period}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">حالة الدفعة</div>
            <div className="font-bold text-slate-800 text-lg">
              {status === 'paid' ? (
                <span className="text-emerald-600 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> تم الدفع</span>
              ) : (
                <span className="text-amber-600 flex items-center gap-2"><AlertCircle className="h-5 w-5" /> قيد الانتظار</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Building className="h-6 w-6 text-slate-400" />
          <h3 className="text-xl font-black text-slate-800">بيانات التحويل البنكي</h3>
        </div>
        
        {/* The bank name and IBAN printed here were invented
            (EG90000100000000000000000000) and shown next to the real payee's
            name, so an admin could confirm a transfer against an account that
            does not exist. There is no column anywhere for a payee's bank
            details yet. */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="mb-1 text-sm font-bold text-amber-900">اسم المستفيد</div>
          <div className="mb-4 font-black text-amber-900">{publisher?.name || 'مؤسسة النشر'}</div>
          <p className="text-sm font-medium text-amber-800">
            بيانات الحساب البنكي غير مسجّلة في المنصة بعد — احصل عليها من المستفيد
            مباشرة قبل التحويل.
          </p>
        </div>

        {status !== 'paid' && (
          <div className="mt-8 pt-8 border-t border-slate-100 flex justify-end gap-4">
            <button 
              onClick={handleMarkAsPaid}
              disabled={isProcessing}
              className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? 'جاري التنفيذ...' : 'تأكيد إتمام التحويل'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
