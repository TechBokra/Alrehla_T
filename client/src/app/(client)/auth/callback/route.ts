import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getSafeRedirectPath } from '@/lib/safe-redirect'
import { RECOVERY_PATH } from '@/lib/recovery-claims'
import { hasRecoverySession } from '@/lib/recovery-session'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = getSafeRedirectPath(requestUrl.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // A URL destination is not proof of recovery. Verify the signed session.
      if (next === RECOVERY_PATH &&
          (!data?.user || !(await hasRecoverySession(supabase, data.user.id)))) {
        return NextResponse.redirect(new URL('/auth/auth-code-error', requestUrl.origin))
      }
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(new URL('/auth/auth-code-error', requestUrl.origin))
}
