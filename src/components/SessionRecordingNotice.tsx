import React from 'react';
import { Video } from 'lucide-react';
import { recordingNotice } from '@/lib/session-recording';

/**
 * «الجلسة دي بتتسجّل» — الجملة اللي لازم ولي الأمر يشوفها.
 *
 * ── ليه مكوّن واحد ──────────────────────────────────────────
 *
 * الإفصاح ده لازم يظهر في تلات أماكن على الأقل: **قبل الدفع**، وفي
 * شاشة ولي الأمر، وفي شاشة المدرب وهو داخل الجلسة. ولو اتكتب في كل
 * شاشة على حدة، أول تعديل في المدة بيخلّي شاشة منهم بتقول رقمًا
 * قديمًا — وده وعد مكسور مش خطأ تنسيق.
 *
 * ⚠️ **وبيرجع `null` لما التسجيل مقفول.** شاشة بتقول «بتتسجّل»
 *    والتسجيل مقفول بتكسر الثقة زي ما العكس بيكسرها بالظبط.
 */
export function SessionRecordingNotice({
  enabled,
  retentionDays,
  tone = 'info',
  className = '',
}: {
  enabled: boolean;
  retentionDays: number;
  /** `info` للمتابعة، و`prominent` للشاشة اللي قبل الدفع. */
  tone?: 'info' | 'prominent';
  className?: string;
}) {
  if (!enabled) return null;

  const prominent = tone === 'prominent';

  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 ${
        prominent
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-slate-200 bg-slate-50 text-slate-600'
      } ${className}`}
    >
      <Video
        aria-hidden="true"
        className={`mt-0.5 h-5 w-5 shrink-0 ${prominent ? 'text-amber-600' : 'text-slate-400'}`}
      />
      <p className={`text-sm leading-relaxed ${prominent ? 'font-bold' : 'font-medium'}`}>
        {recordingNotice(retentionDays)}
      </p>
    </div>
  );
}
