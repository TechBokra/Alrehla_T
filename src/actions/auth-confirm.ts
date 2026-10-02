'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SET_PASSWORD_PATH } from '@/lib/first-login';

export type ConfirmState = { error: string } | null;

/**
 * فتح رابط الدعوة — **بضغطة زرار، مش بفتح الرابط**.
 *
 * ── ليه الرابط مابيدخّلش الشخص لوحده ────────────────────────
 *
 * الرابط بيتبعت على واتساب، وواتساب (وأغلب برامج البريد) بيفتح أي
 * رابط **من خادمه** عشان يعمل له معاينة. لو فتح الصفحة كان كفاية،
 * المعاينة دي كانت هتستهلك الرمز — والرمز بيشتغل مرة واحدة — فالشخص
 * يفتح الرابط يلاقيه «منتهي» من غير ما يكون لمسه.
 *
 * الحل: الصفحة بتعرض زرار، والزرار هو اللي بيبعت الرمز. برامج
 * المعاينة بتقرا الصفحات، مابتضغطش زراير.
 *
 * ── ليه مش رابط Supabase نفسه زي الأول ─────────────────────
 *
 * رابط Supabase بيرجّع الشخص للموقع والجلسة **بعد علامة `#` في
 * العنوان** — والجزء ده مابيوصلش للخادم أصلًا، فالموقع كان بيستقبله
 * من غير جلسة. وكمان كان بيرجّع على «عنوان الموقع» المتسجّل في
 * Supabase، واللي في القاعدة الجديدة لسه `localhost:3000`.
 *
 * دلوقتي الرابط على موقعنا، والتحقق من الرمز بيحصل **هنا في الخادم**
 * (`verifyOtp`)، والجلسة بتتكتب في الكوكيز مباشرة.
 *
 * ⚠️ **النوع `invite` بس.** الأكشن ده مفتوح لأي زائر (اللي جاي من
 *    الدعوة لسه مش مسجّل)، فمابيقبلش أي نوع تاني من الرموز.
 */
export async function confirmInvite(
  _prev: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const tokenHash = String(formData.get('token_hash') ?? '').trim();
  if (!tokenHash) {
    return { error: 'الرابط ناقص — انسخه كامل من الرسالة وجرّب تاني.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: 'invite',
    token_hash: tokenHash,
  });

  if (error) {
    console.error('Invite verification failed', error.message);
    return {
      error:
        'الرابط ده مابقاش صالح — يا إما اتستعمل قبل كده يا إما مدته خلصت. اطلب من الإدارة رابطًا جديدًا.',
    };
  }

  // الحساب عليه علامة «لازم يحط كلمة مرور» من ساعة الدعوة، فالحارس
  // كان هيوقفه هناك على أي حال — بنوديه على طول.
  redirect(SET_PASSWORD_PATH);
}
