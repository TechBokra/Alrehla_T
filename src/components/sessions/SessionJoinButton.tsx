'use client';

import React, { useState, useTransition } from 'react';
import { ExternalLink, Loader2, Video } from 'lucide-react';
import { joinSessionRoom } from '@/actions/rooms';

/**
 * زرار «ادخل الجلسة» للمدرب وولي الأمر والطالب (5.3 في اختبار الإدارة).
 *
 * ⚠️ **كان موجود في الإدارة بس.** الجلسات ليها نوعين روابط: رابط بيتكتب
 *    باليد (`meeting_url`)، وغرفة الفيديو اللي النظام بيعملها لوحده
 *    (`room_name`) — ودي محتاجة **تذكرة باسم الداخل** لحظة الضغط
 *    (`joinSessionRoom`). الصفحات التانية كانت بتعرض الرابط اليدوي بس،
 *    فالمدرب والأهل يشوفوا «رابط الجلسة لم يُضَف بعد» والغرفة جاهزة.
 *
 * الرابط اليدوي لو موجود بيكسب (الإدارة حطّته عن قصد). غير كده الزرار
 * بيطلب تذكرة، ولو مفيش غرفة الرسالة بتقول كده.
 *
 * ⚠️ **النافذة بتتفتح قبل ما الرد يرجع**: المتصفح بيمنع فتح نافذة بعد
 *    انتظار (مش ضغطة مباشرة)، فبنفتحها فاضية ونحط فيها الرابط بعدين.
 */
export function SessionJoinButton({
  sessionId,
  meetingUrl,
  label = 'ادخل الجلسة',
  className = '',
}: {
  sessionId: string;
  meetingUrl?: string | null;
  label?: string;
  className?: string;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');
  const base =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 font-black text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50';

  if (meetingUrl) {
    return (
      <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className={`${base} ${className}`}>
        <Video className="h-5 w-5" aria-hidden="true" />
        {label}
      </a>
    );
  }

  const join = () => {
    setError('');
    const win = window.open('about:blank', '_blank');
    startTransition(async () => {
      try {
        const result = await joinSessionRoom(sessionId);
        if (!result.ok) {
          win?.close();
          setError(result.error);
          return;
        }
        if (win) {
          win.opener = null;
          win.location.href = result.url;
        } else {
          window.location.href = result.url;
        }
      } catch {
        win?.close();
        setError('تعذّر فتح الغرفة — حدّث الصفحة وجرّب تاني.');
      }
    });
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <button type="button" onClick={join} disabled={busy} className={`${base} w-full`}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Video className="h-5 w-5" aria-hidden="true" />}
        {label}
        {!busy && <ExternalLink className="h-4 w-4 opacity-70" aria-hidden="true" />}
      </button>
      {error && (
        <p role="alert" className="text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
