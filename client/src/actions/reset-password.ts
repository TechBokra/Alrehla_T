'use server';

import { createClient } from '@/lib/supabase/server';
import { hasRecoverySession } from '@/lib/recovery-session';
import { redirect } from 'next/navigation';

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'newPassword' | 'confirmPassword' };

export async function resetRecoveredPassword(password: string, confirmation: string): Promise<ResetPasswordResult> {
  if (typeof password !== 'string' || password.length < 8) {
    return { ok: false, error: 'كلمة المرور لازم تكون ٨ حروف أو أرقام على الأقل.', field: 'newPassword' };
  }
  if (password !== confirmation) {
    return { ok: false, error: 'الكلمتين مش زي بعض.', field: 'confirmPassword' };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || !(await hasRecoverySession(supabase, user.id))) {
      return { ok: false, error: 'رابط الاسترجاع انتهى أو مش صالح. اطلب رابطًا جديدًا.' };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return { ok: false, error: error.code === 'same_password'
        ? 'اختار كلمة مرور مختلفة عن القديمة.'
        : 'تعذّر حفظ كلمة المرور. اختار كلمة قوية وجرّب تاني.', field: 'newPassword' };
    }

    // Revoke refresh sessions after recovery. Existing access JWTs expire normally.
    // A logout failure must not report an already-saved password as a failed update.
    try {
      const { error: logoutError } = await supabase.auth.signOut({ scope: 'global' });
      if (logoutError) await supabase.auth.signOut({ scope: 'local' });
    } catch {
      console.error('Password recovery saved, but session cleanup failed');
    }
  } catch {
    return { ok: false, error: 'حصلت مشكلة في الاتصال. جرّب تاني.' };
  }
  // Cookie deletion re-renders the recovery page. Navigate in the same response
  // so a successful reset cannot accidentally render the expired-link screen.
  redirect('/sign-in?passwordReset=success');
}
