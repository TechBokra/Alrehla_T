'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setFeedbackSeen } from '@/actions/feedback';
import { BusyButton } from '@/components/forms/Form';

export function FeedbackSeenButton({ id, seen }: { id: string; seen: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  // ⚠️ الفشل كان بيسكت (الزرار يرجع زي ما هو من غير سبب) — دلوقتي بيقول.
  const [error, setError] = useState('');
  return (
    <div className="flex flex-col items-end gap-1">
      <BusyButton
        variant="secondary"
        busy={busy}
        onClick={() =>
          start(async () => {
            setError('');
            try {
              const r = await setFeedbackSeen(id, !seen);
              if (r.ok) router.refresh();
              else setError(r.error);
            } catch {
              setError('حصل خطأ غير متوقع — حدّث الصفحة وجرّب تاني.');
            }
          })
        }
        className="text-xs"
      >
        {seen ? 'رجّعه جديد' : 'اتقرا ✓'}
      </BusyButton>
      {error && (
        <span role="alert" className="text-xs font-bold text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
