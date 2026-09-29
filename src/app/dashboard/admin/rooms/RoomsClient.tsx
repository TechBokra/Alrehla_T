'use client';

import React, { useState, useTransition } from 'react';
import { Video, FlaskConical, Loader2, Wrench, ExternalLink } from 'lucide-react';
import {
  ensureUpcomingRooms,
  joinSessionRoom,
  openTestRoom,
  rebuildStaleRooms,
} from '@/actions/rooms';
import { FormError } from '@/components/ui/FormError';

/**
 * أزرار لوحة الغرف.
 *
 * ⚠️ **الرابط بيتفتح في تبويب جديد بعد ما الخادم يرجّعه.** مش
 *    `<a href>` جاهز — الرابط مافيهوش تذكرة إلا بعد النداء، والتذكرة
 *    هي اللي بتفتح الغرفة. رابط جاهز في الصفحة معناه رابط بيتنسخ.
 */
export function RoomActions({ dailyReady }: { dailyReady: boolean }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const test = () =>
    startTransition(async () => {
      setError('');
      setNotice('');
      const result = await openTestRoom();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.open(result.url, '_blank', 'noopener,noreferrer');
    });

  const prepare = () =>
    startTransition(async () => {
      setError('');
      setNotice('');
      const result = await ensureUpcomingRooms();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        result.created === 0 && result.failed === 0
          ? 'كل الجلسات القادمة ليها غرف خلاص.'
          : `اتعمل ${result.created} غرفة${result.failed ? ` · فشل ${result.failed}` : ''}.`,
      );
    });

  return (
    <div className="space-y-4">
      <FormError message={error} />
      {notice && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={test}
          disabled={busy || !dailyReady}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 transition-colors hover:border-slate-400 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          جرّب غرفة
        </button>

        <button
          type="button"
          onClick={prepare}
          disabled={busy || !dailyReady}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
          جهّز غرف الجلسات القادمة
        </button>
      </div>

      {/* ⚠️ **الجملة دي كانت في الكود ومش في الشاشة.**
          غرفة التجربة مابتتسجّلش عن قصد — وأول تجربة حقيقية كانت
          بالظبط كده: جلسة اتعملت من هنا، وقايمة التسجيلات فضلت
          فاضية، والاستنتاج الطبيعي «التسجيل باظ». السلوك كان صح
          والشاشة هي اللي كانت ساكتة. */}
      <p className="text-xs font-medium text-slate-500">
        <strong className="text-slate-700">غرفة التجربة مابتتسجّلش</strong> — الغرض
        منها تجربة الصوت والصورة والشبكة، وتسجيلها بيتحاسب بلا سبب. لو عايز
        تجرّب التسجيل، اعمل جلسة من صفحة حجز واضغط «ادخل الغرفة».
      </p>
    </div>
  );
}

/**
 * زرّ إصلاح الغرف اللي إعداد التسجيل فيها قديم.
 *
 * مابيظهرش إلا لما يكون فيه غرف فعلًا كده — زرّ دايم لمشكلة نادرة
 * بيتحوّل لزينة، وأول ما يتضغط بالغلط بيحذف غرف سليمة.
 */
export function RebuildRoomsButton({ count }: { count: number }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const rebuild = () => {
    const sure = window.confirm(
      `هيتعاد عمل ${count} غرفة عشان إعداد التسجيل فيها قديم.\n\n` +
        'الغرف القديمة هتتحذف وتتعمل جديدة. الدخول في الموقع بتذكرة ' +
        'بتتولّد لحظة الضغط، فمفيش حد ماشي معاه رابط هيبوظ.\n\nتأكيد؟',
    );
    if (!sure) return;

    startTransition(async () => {
      setError('');
      setNotice('');
      const result = await rebuildStaleRooms();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        `اتعاد عمل ${result.rebuilt} غرفة${result.failed ? ` · فشل ${result.failed}` : ''}.`,
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
        onClick={rebuild}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-bold text-amber-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
        أعِد عمل الغرف دي ({count})
      </button>
    </div>
  );
}

/** زرّ دخول جلسة واحدة. */
export function JoinRoomButton({ sessionId }: { sessionId: string }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');

  const join = () =>
    startTransition(async () => {
      setError('');
      const result = await joinSessionRoom(sessionId);
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
        onClick={join}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
        ادخل الغرفة
        {!busy && <ExternalLink className="h-3.5 w-3.5 opacity-70" />}
      </button>
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
    </div>
  );
}
