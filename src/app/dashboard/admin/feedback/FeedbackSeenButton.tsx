'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setFeedbackSeen } from '@/actions/feedback';

export function FeedbackSeenButton({ id, seen }: { id: string; seen: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await setFeedbackSeen(id, !seen);
          if (r.ok) router.refresh();
        })
      }
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-slate-400 disabled:opacity-50"
    >
      {seen ? 'رجّعه جديد' : 'اتقرا ✓'}
    </button>
  );
}
