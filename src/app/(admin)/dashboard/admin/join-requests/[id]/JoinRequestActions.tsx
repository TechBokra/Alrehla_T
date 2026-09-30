'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { setJoinRequestStatus } from '@/actions/join-requests';
import { FormError, FormSuccess } from '@/components/ui/FormError';

/**
 * قبول طلب الانضمام أو رفضه.
 *
 * الزرّان كانا بلا أي معالج، فالطلب يفضل «قيد المراجعة» مهما ضغطت
 * الإدارة.
 *
 * ⚠️ **والقبول وحده مش بينشئ حسابًا** — ولا المفروض. ملف المدرب محتاج
 *    تخصصات وسنين خبرة ونموذج عمل مش موجودين في الطلب، والإنشاء
 *    التلقائي هيطلّع ملفًّا نصّه فاضي. فالقبول بيسجّل القرار **وبيوصّل
 *    الإدارة لشاشة الإنشاء والخانات متملّية**.
 *
 *    ولأن الخطوة دي هي اللي بتخلّي القبول يعني حاجة، الزرار بتاعها
 *    بيفضل معروضًا لحد ما الإدارة تدوسه — مش بيختفي بعد ثانية.
 */
export function JoinRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState('');
  const [next, setNext] = useState<{ href: string; label: string } | null>(null);

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

      if (result.nextHref) {
        setNext({ href: result.nextHref, label: result.nextLabel ?? 'كمّل الخطوة' });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تحديث الطلب');
    } finally {
      setBusy(null);
    }
  };

  if (next) {
    return (
      <div className="w-full space-y-4">
        <FormSuccess message="الطلب اتقبل. فاضل تعمل الحساب." />
        <button
          type="button"
          onClick={() => router.push(next.href)}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
          {next.label}
        </button>
        <p className="text-sm font-medium text-slate-500">
          الشاشة هتفتح والخانات متملّية من الطلب — تكمّل الباقي وتضغط.
        </p>
      </div>
    );
  }

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
