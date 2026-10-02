'use client';

import React, { useActionState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { confirmInvite, type ConfirmState } from '@/actions/auth-confirm';
import { FormError } from '@/components/ui/FormError';

export function ConfirmInviteForm({ tokenHash }: { tokenHash: string }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(
    confirmInvite,
    null
  );

  return (
    <form action={action} className="space-y-6">
      <FormError message={state?.error ?? ''} />
      <input type="hidden" name="token_hash" value={tokenHash} />
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-4 font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ArrowLeft className="h-5 w-5" />
        )}
        {pending ? 'جارٍ التحقق…' : 'ادخل وحدّد كلمة مرورك'}
      </button>
    </form>
  );
}
