'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

/** «افحص تاني» — بيعيد قراءة الأرقام من القاعدة ويطلّع النتيجة من جديد. */
export function RescanButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-black text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} aria-hidden="true" />
      {pending ? 'بيفحص…' : 'افحص تاني'}
    </button>
  );
}
