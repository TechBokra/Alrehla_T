'use client';

import React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateSiteSettings, SiteSettingsResult } from '@/actions/content';

/**
 * الفورم بيقول حصل إيه.
 *
 * قبل كده كان بينادي دالة الحفظ ومبيعرضش أي نتيجة: لا نجاح ولا فشل.
 * فلو القاعدة رفضت الكتابة، الشاشة كانت بتتحدّث والقيم ترجع زي ما هي،
 * ومحدش يعرف السبب.
 */
export function SettingsForm({ children }: { children: React.ReactNode }) {
  const [state, action] = useActionState<SiteSettingsResult | null, FormData>(
    updateSiteSettings,
    null
  );

  return (
    <form action={action} className="space-y-6">
      {children}

      <div className="flex flex-wrap items-center justify-end gap-4">
        {state && (
          <p
            className={`text-sm font-bold ${
              state.ok ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {state.ok ? 'اتحفظ ✓' : state.error}
          </p>
        )}
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? 'جاري الحفظ…' : 'حفظ الإعدادات'}
    </button>
  );
}
