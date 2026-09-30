import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getSafeRedirectPath } from '@/lib/safe-redirect'
import { RECOVERY_PATH, markRecoverySession } from '@/lib/password-reset-flag'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = getSafeRedirectPath(requestUrl.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // ⚠️ **الجلسة الجاية من رابط استرجاع بتتعلّم هنا.**
      //
      //    تغيير كلمة المرور بقى بيطلب الكلمة الحالية، واللي جاي من
      //    «نسيت كلمة المرور» مش معاه — دي المشكلة اللي هو جاي
      //    يحلّها. والتفرقة لازم تتعمل على الخادم، لأن الأكشن ممكن
      //    يتنادى من غير الشاشة (قاعدة «ع»).
      //
      //    والعلامة بتتحطّ **بعد** ما الكود اتبدّل بجلسة بنجاح: كود
      //    غلط بيروح لصفحة الخطأ ومفيش حاجة بتتعلّم، فمفيش طريق
      //    لحد يعلّم جلسته بنفسه.
      if (next === RECOVERY_PATH) {
        await markRecoverySession(data?.user?.id)
      }
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(new URL('/auth/auth-code-error', requestUrl.origin))
}
