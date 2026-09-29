import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { MUST_SET_PASSWORD } from '@/lib/first-login';

/** الوجهة اللي رابط استرجاع كلمة المرور بيروح لها بعد `/auth/callback`. */
export const RECOVERY_PATH = '/reset-password';

/**
 * تعليم الجلسة إنها جاية من رابط استرجاع.
 *
 * ── ليه الحتة دي موجودة أصلًا ───────────────────────────────
 *
 * تغيير كلمة المرور بقى **بيطلب الكلمة الحالية** — عشان حد يلاقي
 * جهازًا مفتوحًا ما يقدرش يغيّرها ويقفل صاحبه برّه حسابه.
 *
 * ⚠️ **بس اللي جاي من «نسيت كلمة المرور» مش معاه الكلمة الحالية —
 *    دي المشكلة اللي هو جاي يحلّها.** فطلبها منه بيقفل الطريق
 *    الوحيد المتاح له.
 *
 * والتفرقة بين الحالتين لازم تتعمل **على الخادم**: الشاشة اللي
 * بتقول «أنا صفحة الاسترجاع» مش دليل، لأن الأكشن ممكن يتنادى من
 * غيرها خالص (قاعدة «ع»).
 *
 * ── والحل إعادة استعمال حاجز موجود ──────────────────────────
 *
 * بدل ما نفكّ شفرة الـJWT وندوّر على طريقة الدخول — وده تفصيل
 * داخلي في Supabase ممكن يتغيّر، **وفشله بيقفل الاسترجاع على
 * ناس نسيت كلمة مرورها فعلًا** — بنحطّ نفس علامة أول دخول
 * (`MUST_SET_PASSWORD`).
 *
 * فالنتيجة: صفحة الاسترجاع بتشتغل بالظبط زي أول دخول، بنفس
 * الكود المجرَّب، و`setMyPassword` بتشيل العلامة بعد النجاح.
 *
 * ⚠️ **والعلامة في `app_metadata` لا `user_metadata`** — التانية
 *    المستخدم يعدّلها من متصفحه بنداء واحد، فكانت هتبقى باب
 *    خلفي حوالين طلب الكلمة الحالية بدل ما تكون حاجزًا.
 */
export async function markRecoverySession(userId: string | undefined): Promise<void> {
  if (!userId) return;

  if (!isAdminApiConfigured()) {
    // ⚠️ بنسجّل بصوت عالي: من غير المفتاح، الشخص هيوصل لصفحة
    //    الاسترجاع وهي هتطلب منه الكلمة اللي هو ناسيها.
    console.error('SUPABASE_SERVICE_ROLE_KEY missing — recovery session not marked');
    return;
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    app_metadata: { [MUST_SET_PASSWORD]: true },
  });

  if (error) console.error('Error marking recovery session', error);
}
