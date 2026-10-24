'use client';

import { useState, useTransition } from 'react';
import { BusyButton } from '@/components/forms/Form';
import { resetTrainingProgress } from '@/actions/training';

/** إعادة التأهيل لمدرب — بخطوتين (تأكيد)، والمحاولات القديمة بتفضل. */
export function ResetTrainingButton({ userId, instructorId }: { userId: string; instructorId?: string }) {
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BusyButton
        busy={pending}
        variant={confirm ? 'danger' : 'secondary'}
        pendingLabel="جارٍ الإعادة…"
        onClick={() => {
          if (!confirm) {
            setConfirm(true);
            return;
          }
          start(async () => {
            const r = await resetTrainingProgress(userId, instructorId);
            setMsg(r.ok ? 'اتعادت — المدرب هيبدأ الوحدات من جديد.' : r.error);
            setConfirm(false);
          });
        }}
      >
        {confirm ? 'أكّد: أعد التأهيل' : 'أعد التأهيل للمدرب'}
      </BusyButton>
      {confirm && !pending && (
        <span className="text-xs font-bold text-slate-600">الوحدات والاجتياز بيرجعوا لأول، والمحاولات القديمة بتفضل في السجل.</span>
      )}
      {msg && (
        <span role="status" className="text-sm font-bold text-slate-700">
          {msg}
        </span>
      )}
    </div>
  );
}
