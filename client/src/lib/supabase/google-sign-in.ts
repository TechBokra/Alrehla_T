import { createClient } from './client'
import { getSafeRedirectPath } from '@/lib/safe-redirect'

export function googleOAuthRedirect(origin: string, next: string | null): string {
  const callback = new URL('/auth/callback', origin)
  callback.searchParams.set('next', next ? getSafeRedirectPath(next) : '/dashboard')
  return callback.toString()
}

/** Uses the existing cookie-based PKCE client; never requests Gmail inbox access. */
export async function signInWithGoogle(origin: string, next: string | null) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: googleOAuthRedirect(origin, next),
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error || !data.url) {
    throw new Error('تعذّر تسجيل الدخول باستخدام Google. جرّب تاني أو استخدم البريد وكلمة المرور.')
  }
}
