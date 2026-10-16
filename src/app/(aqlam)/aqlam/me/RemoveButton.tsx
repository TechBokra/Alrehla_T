'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeMyPost } from '@/actions/aqlam';

/** «شيل» بخطوتين داخل الصفحة (من غير نافذة تأكيد المتصفح). */
export function RemoveButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function remove() {
    setError('');
    startTransition(async () => {
      const res = await removeMyPost(postId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const base =
    'inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-bold focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none disabled:opacity-60 ';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <span className="text-sm font-bold text-slate-700">متأكد إنك عايز تشيله؟</span>
          <button type="button" onClick={remove} disabled={pending} className={base + 'bg-rose-700 text-white hover:bg-rose-800'}>
            {pending ? 'جارٍ الشيل…' : 'أيوه، شيله'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={base + 'border border-slate-300 text-slate-700'}>
            لأ
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={base + 'border border-slate-300 text-slate-700 hover:border-slate-500'}>
          شيل
        </button>
      )}
      {error && (
        <span role="alert" className="text-sm font-bold text-rose-700">
          {error}
        </span>
      )}
    </div>
  );
}
