'use client';

import React, { useState, useTransition } from 'react';
import { Play, Trash2, Loader2, ExternalLink, Eraser } from 'lucide-react';
import { openRecording, removeRecording, purgeRecordingsNow } from '@/actions/recordings';
import { FormError } from '@/components/ui/FormError';

/**
 * أزرار التسجيلات.
 *
 * ⚠️ **مفيش رابط مشاهدة جاهز في الصفحة** — زيّ غرف الجلسات بالظبط.
 *    الرابط بيتولّد لحظة الضغط وبيموت بعد ساعة، لأن دي تسجيلات فيها
 *    أطفال والرابط الدائم بيتنسخ ويعيش أطول من سببه.
 */
export function WatchRecordingButton({
  recordingId,
  roomName,
}: {
  recordingId: string;
  roomName: string;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');

  const watch = () =>
    startTransition(async () => {
      setError('');
      const result = await openRecording(recordingId, roomName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.open(result.url, '_blank', 'noopener,noreferrer');
    });

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={watch}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        شاهد
        {!busy && <ExternalLink className="h-3.5 w-3.5 opacity-70" />}
      </button>
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
    </div>
  );
}

/**
 * حذف تسجيل واحد.
 *
 * ⚠️ **التأكيد بيكتب الجلسة والتاريخ، مش «متأكد؟».** «متأكد؟» مجرّدة
 *    بتتضغط بالعادة؛ اسم وتاريخ قدّام العين بيخلّوك تقرا. ودي نفس
 *    القاعدة اللي مشينا عليها في حذف الصور.
 */
export function DeleteRecordingButton({
  recordingId,
  roomName,
  label,
  canDelete,
}: {
  recordingId: string;
  roomName: string;
  label: string;
  canDelete: boolean;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');

  // ⚠️ **الحذف لمدير النظام وحده**، والشرط متطبَّق في الأكشن كمان
  //    (قاعدة «ع»). إخفاء الزرّ راحة للعين مش حماية.
  if (!canDelete) return <span className="text-xs font-medium text-slate-400">—</span>;

  const remove = () => {
    const sure = window.confirm(
      `هتحذف تسجيل «${label}» نهائيًّا.\n\n` +
        'التسجيل ده هو الأثر الوحيد للّي حصل في الجلسة. لو جت شكوى بعد ' +
        'كده، مفيش حاجة تتراجع.\n\nتأكيد؟',
    );
    if (!sure) return;

    startTransition(async () => {
      setError('');
      const result = await removeRecording(recordingId, roomName);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border-2 border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 transition-colors hover:border-rose-400 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        احذف
      </button>
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
    </div>
  );
}

/**
 * تشغيل حذف المنتهي دلوقتي.
 *
 * موجود عشان الإدارة تشوف بعينها إن الوعد بيتنفّذ، بدل ما تستنى
 * المهمة اليومية وتفترض. بينادي **نفس الدالة** اللي المهمة بتناديها.
 */
export function PurgeNowButton({ retentionLabel }: { retentionLabel: string }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const purge = () => {
    const sure = window.confirm(
      `هتحذف كل تسجيل عدّى عليه ${retentionLabel}، نهائيًّا ومن غير تراجع.\n\n` +
        'ده اللي المهمة اليومية بتعمله — الزرّ ده بيشغّله دلوقتي بس.\n\nتأكيد؟',
    );
    if (!sure) return;

    startTransition(async () => {
      setError('');
      setNotice('');
      const result = await purgeRecordingsNow();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        result.deleted === 0
          ? 'مفيش تسجيل عدّى المدة — مفيش حاجة اتحذفت.'
          : `اتحذف ${result.deleted} تسجيل${result.failed ? ` · فشل ${result.failed}` : ''}.`,
      );
    });
  };

  return (
    <div className="space-y-2">
      <FormError message={error} />
      {notice && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          {notice}
        </p>
      )}
      <button
        type="button"
        onClick={purge}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 transition-colors hover:border-slate-400 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
        احذف المنتهي دلوقتي
      </button>
    </div>
  );
}
