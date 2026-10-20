'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { requestAccountDeletion } from '@/actions/account-deletion';
import { Field, TextArea, BusyButton } from '@/components/forms/Form';

/**
 * طلب حذف الحساب.
 *
 * مش حذف فوري: الطلب بيروح للإدارة، وهي اللي بتنفّذ بعد ما تتأكد إن
 * مفيش طلبات أو مستحقات معلّقة. ده اللي بيمنع حساب يتمسح وسايب وراه
 * طلب مدفوع بلا صاحب.
 */
export function DeleteAccountClient({ hasOpenRequest }: { hasOpenRequest: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (hasOpenRequest || done) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-2 font-black text-amber-900">طلب الحذف قيد المراجعة</h2>
        <p className="text-sm font-medium text-amber-900">
          وصلنا طلبك وبنراجعه. هنتواصل معاك قبل تنفيذ أي حاجة، خصوصًا لو عندك
          طلبات أو حجوزات لسه شغّالة.
        </p>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await requestAccountDeletion(reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError('تعذّر إرسال الطلب — جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <div className="mb-3 flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div>
          <h2 className="font-black text-red-900">حذف الحساب</h2>
          <p className="mt-1 text-sm font-medium text-red-900">
            هتبعت طلب للإدارة. مش هيتمسح حاجة في نفس اللحظة — بنراجع الأول لو
            كان عندك طلبات أو حجوزات أو مستحقات لسه مفتوحة.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-red-300 bg-white p-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {open ? (
        <div className="space-y-3">
          <Field label="سبب الطلب (اختياري)" name="reason">
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="سبب الطلب (اختياري)"
              className="h-24 text-sm"
            />
          </Field>
          <div className="flex gap-3">
            <BusyButton variant="danger" busy={busy} pendingLabel="جارٍ الإرسال…" onClick={submit}>
              إرسال طلب الحذف
            </BusyButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl px-6 py-3 font-bold text-red-700 hover:text-red-900"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-red-300 bg-white px-6 py-3 font-bold text-red-700 transition-colors hover:bg-red-100"
        >
          أريد حذف حسابي
        </button>
      )}
    </div>
  );
}
