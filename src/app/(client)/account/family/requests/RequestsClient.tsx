'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Clock, MessageSquare } from 'lucide-react';
import type { DependentRequestRow } from '@/data/domains/dependent-requests';
import {
  approveDependentRequest,
  approveNameChange,
  rejectDependentRequest,
} from '@/actions/dependent-requests';
import { formatCairo } from '@/lib/timezone';

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'مستني ردك', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'وافقت', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'رفضت', className: 'bg-rose-50 text-rose-700' },
  cancelled: { label: 'اتسحب', className: 'bg-slate-100 text-slate-500' },
};

/**
 * طلبات الأبناء عند ولي الأمر.
 *
 * الموافقة **مابتعملش الطلب** — بتوصّلك لشاشة الطلب العادية بالبيانات
 * جاهزة، وتكمّل الدفع زي أي عملية. كده مسار الشراء واحد مش اتنين.
 */
export function RequestsClient({ requests }: { requests: DependentRequestRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  /**
   * طلب تغيير الاسم بيتطبّق هنا وخلاص — مفيش شاشة يكمّل منها.
   *
   * ⚠️ الفرق ده مقصود: طلبات الباقات والخدمات بتودّي لمسار الشراء
   *    عشان ولي الأمر يراجع ويدفع. أما الاسم فقرار من كلمة واحدة.
   */
  const approveName = (id: string) => {
    setError('');
    startTransition(async () => {
      const result = await approveNameChange(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const approve = (id: string) => {
    setError('');
    startTransition(async () => {
      const result = await approveDependentRequest(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // على طول لشاشة الدفع — الموافقة من غير استكمال مالهاش معنى.
      router.push(result.href);
    });
  };

  const reject = (id: string) => {
    setError('');
    startTransition(async () => {
      const result = await rejectDependentRequest(id, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRejectingId(null);
      setNote('');
      router.refresh();
    });
  };

  if (requests.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center font-medium text-slate-500">
        مفيش طلبات من أبنائك دلوقتي.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      {requests.map((request) => {
        const status = STATUS[request.status] ?? STATUS.pending;
        return (
          <div
            key={request.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-slate-800">
                    {request.kind === 'name_change'
                      ? `يبقى اسمه: ${request.targetName}`
                      : request.targetName}
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>
                    {status.label}
                  </span>
                  <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                    {request.childName}
                  </span>
                </div>

                <p className="mt-1 text-xs font-bold text-slate-400">
                  {request.kind === 'name_change'
                    ? 'تغيير الاسم'
                    : request.kind === 'package'
                      ? 'باقة'
                      : 'خدمة إبداعية'}
                  {request.providerName && ` · ${request.providerName}`}
                  {' · '}
                  {formatCairo(request.createdAt, { dateStyle: 'long' })}
                </p>

                {request.note && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-600">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    {request.note}
                  </p>
                )}

                {request.guardianNote && (
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    ردك: {request.guardianNote}
                  </p>
                )}
              </div>

              {request.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      request.kind === 'name_change'
                        ? approveName(request.id)
                        : approve(request.id)
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />{' '}
                    {request.kind === 'name_change' ? 'وافق' : 'وافق وكمّل'}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setRejectingId(rejectingId === request.id ? null : request.id);
                      setNote('');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-rose-300 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" /> ارفض
                  </button>
                </div>
              )}
            </div>

            {rejectingId === request.id && (
              <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-xs font-bold text-slate-600">
                  اكتب سبب مختصر — ابنك هيقراه
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-amber-500"
                  placeholder="مثال: نأجلها للشهر الجاي"
                />
                <button
                  type="button"
                  disabled={isPending || !note.trim()}
                  onClick={() => reject(request.id)}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  ابعت الرد
                </button>
              </div>
            )}

            {request.status === 'approved' && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-amber-700">
                <Clock className="h-3.5 w-3.5" />
                وافقت على الطلب ده — لو ما كمّلتش الدفع، ادخل على الخدمة واطلبها عادي.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
