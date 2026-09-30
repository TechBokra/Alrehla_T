'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Banknote } from 'lucide-react';
import { formatPrice, formatDate } from '@/lib/utils';
import type { WithdrawalRequestRow } from '@/data/domains/admin';
import { setWithdrawalStatus } from '@/actions/withdrawals';

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'قيد المراجعة', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'معتمد — بانتظار التحويل', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'تم التحويل', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'مرفوض', className: 'bg-slate-200 text-slate-600' },
};

export function WithdrawalsClient({ requests }: { requests: WithdrawalRequestRow[] }) {
  const router = useRouter();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setActingOn(null);
      setNotes('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setBusy(false);
    }
  };

  if (requests.length === 0) {
    return (
      <p className="rounded-3xl border border-slate-200 bg-white py-16 text-center font-medium text-slate-500">
        لا توجد طلبات سحب.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {requests.map((request) => {
        const status = STATUS[request.status] ?? {
          label: request.status,
          className: 'bg-slate-100 text-slate-600',
        };
        const open = request.status === 'pending' || request.status === 'approved';

        return (
          <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-slate-800">
                    {request.ownerName}
                    {/* الإدارة لازم تعرف نوع الحساب: التحويل بيروح
                        لمدرب ولا لدار نشر، والبيانات بتختلف. */}
                    <span className="mr-2 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                      {request.ownerKind === 'publisher' ? 'ناشر' : 'مدرب'}
                    </span>
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {formatDate(request.createdAt)} · طريقة التحويل: {request.method}
                </p>
                {/* بيانات التحويل — من غيرها الإداري مايقدرش ينفّذ. */}
                {request.payoutDetails ? (
                  <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">
                    <span className="font-bold">بيانات التحويل: </span>
                    <span dir="auto">{request.payoutDetails}</span>
                  </p>
                ) : (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                    مفيش بيانات تحويل مع الطلب ده — كلّم المدرب قبل ما تنفّذ.
                  </p>
                )}

                {request.adminNotes && (
                  <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-600">
                    <span className="font-bold">ملاحظة الإدارة:</span> {request.adminNotes}
                  </p>
                )}
              </div>

              <div className="text-left">
                <p className="text-2xl font-black text-slate-800">{formatPrice(request.amount)}</p>
              </div>
            </div>

            {open && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {request.status === 'pending' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(() => setWithdrawalStatus({ requestId: request.id, status: 'approved' }))
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> اعتماد الطلب
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => setWithdrawalStatus({ requestId: request.id, status: 'paid' }))
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Banknote className="h-4 w-4" /> تم التحويل فعلاً
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotes('');
                    setActingOn(actingOn === request.id ? null : request.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <X className="h-4 w-4" /> رفض
                </button>
              </div>
            )}

            {actingOn === request.id && (
              <div className="mt-4 space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <label className="text-xs font-bold text-rose-800">
                  سبب الرفض (يصل للمدرب)
                </label>
                <input
                  className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: الرصيد المتاح أقل من المبلغ المطلوب"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActingOn(null)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        setWithdrawalStatus({
                          requestId: request.id,
                          status: 'rejected',
                          adminNotes: notes,
                        })
                      )
                    }
                    className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    تأكيد الرفض
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
