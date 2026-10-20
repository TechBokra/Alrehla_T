'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deletePortfolioDocument } from '@/actions/portfolio';

/**
 * مسح نص من مساحة الكتابة — على خطوتين لأنه مالوش رجوع (النص وملفاته
 * وملاحظات المدرب). بعد المسح بيروح لـ`afterHref` أو بيحدّث الصفحة.
 */
export function DeleteDocumentButton({
  documentId,
  afterHref,
  className = '',
}: {
  documentId: string;
  afterHref?: string;
  className?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await deletePortfolioDocument(documentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (afterHref) router.replace(afterHref);
      router.refresh();
    } catch {
      setError('تعذّر مسح النص — جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      {confirming ? (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-900">
            النص هيتمسح نهائي، ومعاه ملفاته وملاحظات المدرب عليه.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="min-h-[40px] flex-1 rounded-lg bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'جارٍ المسح…' : 'امسح نهائي'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="min-h-[40px] rounded-lg bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200"
            >
              لأ
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          مسح النص
        </button>
      )}
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
