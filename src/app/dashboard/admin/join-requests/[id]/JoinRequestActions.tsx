'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { setJoinRequestStatus } from '@/actions/join-requests';
import { FormError } from '@/components/ui/FormError';

/**
 * قبول طلب الانضمام أو رفضه.
 *
 * ⚠️ **والقبول وحده مش بينشئ حسابًا** — ولا المفروض. ملف المدرب محتاج
 *    تخصصات وسنين خبرة ونموذج عمل مش موجودين في الطلب، والإنشاء
 *    التلقائي هيطلّع ملفًّا نصّه فاضي.
 *
 * ⚠️ **وزرار «كمّل إنشاء الحساب» مش هنا.** كان هنا، وبعد القبول الصفحة
 *    بتتحدّث فالمكوّن ده بيختفي (هو للطلب المعلَّق بس) — فالزرار كان
 *    بيظهر لحظة ويختفي، والإداري يفتكر إن الحساب اتعمل. دلوقتي الصفحة
 *    نفسها بتعرضه لأي طلب مقبول مالوش حساب، ويفضل ظاهر لحد ما الحساب
 *    يتعمل.
 */
export function JoinRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState('');

  const decide = async (status: 'approved' | 'rejected') => {
    setBusy(status);
    setError('');
    try {
      const result = await setJoinRequestStatus(requestId, status);

      // ⚠️ النتيجة كانت بتترمي في الزبالة: الشاشة كانت بتعمل `refresh`
      //    سواء نجح الطلب أو رجع برسالة رفض.
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحديث الطلب');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="w-full space-y-3">
      <FormError message={error} />
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => decide('approved')}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === 'approved' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle className="h-5 w-5" />
          )}
          قبول الطلب
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => decide('rejected')}
          className="flex items-center gap-2 rounded-xl bg-rose-50 px-6 py-3 font-bold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
        >
          {busy === 'rejected' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          رفض الطلب
        </button>
      </div>
    </div>
  );
}
