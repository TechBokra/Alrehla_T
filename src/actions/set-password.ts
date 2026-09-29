'use server';

import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { MUST_SET_PASSWORD, needsPasswordSetup } from '@/lib/first-login';

export type SetPasswordResult = { ok: true } | { ok: false; error: string };

/**
 * أول دخول: الشخص بيحطّ كلمة مروره بدل الرمز المؤقت.
 *
 * ── الترتيب هنا مقصود ───────────────────────────────────────
 *
 *   ١. نغيّر كلمة المرور
 *   ٢. **وبعدين** نشيل العلامة
 *
 * ⚠️ **ولو اتعكس الترتيب** والعلامة اتشالت الأول ثم فشل تغيير كلمة
 *    المرور، يبقى الحساب عدّى الشاشة و**لسه على الرمز المؤقت** — وهو
 *    رمز مرّ على واتساب. الترتيب ده بيخلّي أسوأ حالة إن الشاشة تتكرر،
 *    مش إن الحاجز يتفتح.
 *
 * ⚠️ **وشيل العلامة محتاج مفتاح الخدمة** لأنها في `app_metadata` —
 *    وده مقصود: لو المستخدم كان يقدر يشيلها، كان الحاجز بلا معنى.
 */
export async function setMyPassword(
  newPassword: string,
  /**
   * الكلمة الحالية — **مطلوبة في التغيير العادي، لا في أول دخول
   * ولا في الاسترجاع**. اقرا الشرح تحت.
   */
  currentPassword?: string,
): Promise<SetPasswordResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'لازم تسجّل الدخول' };

  const password = typeof newPassword === 'string' ? newPassword : '';
  if (password.length < 8) {
    return { ok: false, error: 'كلمة المرور لازم تكون ٨ حروف أو أرقام على الأقل.' };
  }

  // ── ⓪ الكلمة الحالية ─────────────────────────────────────
  //
  // ⚠️ **الجلسة وحدها مش إثبات كفاية لتغيير كلمة المرور.** أي حد
  //    يلاقي الجهاز مفتوح — في البيت أو الشغل — كان يقدر يغيّرها
  //    ويقفل صاحب الحساب **برّه حسابه هو**، من غير ما يعرف حاجة
  //    عنه أصلًا. وتغيير كلمة المرور مش زيّ أي تعديل تاني: هو
  //    الإجراء الوحيد اللي بيخلّي الاستيلاء **دائمًا**.
  //
  // ⚠️ **وحالتان مستثنيتان، والاستثناء بيتقرّر من الخادم:**
  //
  //      • **أول دخول** — الشخص لسه على رمز مؤقت
  //      • **الاسترجاع** — هو ناسي كلمته، ودي المشكلة اللي جاي
  //        يحلّها؛ طلبها منه بيقفل الطريق الوحيد المتاح له
  //
  //    الاتنين بيتعرفوا بعلامة `MUST_SET_PASSWORD` في
  //    `app_metadata` — ومسار الاسترجاع بيحطّها في `/auth/callback`
  //    بعد ما الكود يتبدّل بجلسة بنجاح.
  //
  //    ⚠️ **والقرار في الخادم لا في الشاشة**: لو كنا سيبنا الشاشة
  //       هي اللي تقرّر، أي نداء مباشر للأكشن من غير الكلمة
  //       الحالية كان بيعدّي (قاعدة «ع») — يعني الحاجز شكله حاجز
  //       وهو مفتوح.
  if (!needsPasswordSetup(user)) {
    const current = typeof currentPassword === 'string' ? currentPassword : '';
    if (!current) {
      return { ok: false, error: 'اكتب كلمة المرور الحالية عشان تغيّرها.' };
    }
    if (!user.email) {
      return { ok: false, error: 'الحساب ده مالوش بريد — كلّم الإدارة.' };
    }

    // ⚠️ **الفحص بعميل بلا كوكيز عن قصد.** `signInWithPassword`
    //    على العميل العادي بتكتب جلسة جديدة في الكوكيز — يعني
    //    محاولة فاشلة كانت ممكن تلخبط جلسة الشخص القايمة وهو
    //    مجرّد غلط في الكتابة.
    const { error: checkError } = await createPublicClient().auth.signInWithPassword({
      email: user.email,
      password: current,
    });

    if (checkError) {
      console.error('Password change: wrong current password', user.id);
      return { ok: false, error: 'كلمة المرور الحالية غلط.' };
    }
  }

  // ① كلمة المرور الجديدة.
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    console.error('Error setting password', updateError);
    // Supabase بيرفض الكلمة اللي زي القديمة — ودي حالة متوقّعة هنا
    // بالذات، لأن الرمز المؤقت قدّام الشخص وهو بيكتب.
    if (/same/i.test(updateError.message ?? '')) {
      return { ok: false, error: 'اختار كلمة مرور غير الرمز المؤقت.' };
    }
    return { ok: false, error: 'تعذّر حفظ كلمة المرور. جرّب تاني.' };
  }

  // ② العلامة — والحساب اللي مالوش علامة أصلًا (حد غيّر كلمة مروره
  //    من شاشته) ما يحتاجش مفتاح خدمة ولا رسالة خطأ.
  if (!needsPasswordSetup(user)) return { ok: true };

  if (!isAdminApiConfigured()) {
    console.error('SUPABASE_SERVICE_ROLE_KEY missing — cannot clear must_set_password');
    return {
      ok: false,
      error: 'كلمة المرور اتحفظت، بس فيه إعداد ناقص على الخادم. كلّم الإدارة.',
    };
  }

  const { error: metaError } = await createAdminClient().auth.admin.updateUserById(user.id, {
    app_metadata: { [MUST_SET_PASSWORD]: false },
  });

  if (metaError) {
    console.error('Error clearing must_set_password', metaError);
    // كلمة المرور اتغيّرت فعلًا، فالشخص مش مقفول برّه — بس الحاجز
    // هيتكرر. بنقول الحقيقة بدل ما نقول «تم».
    return {
      ok: false,
      error: 'كلمة المرور اتحفظت، بس الشاشة دي ممكن تظهرلك تاني. كلّم الإدارة لو حصل.',
    };
  }

  return { ok: true };
}
