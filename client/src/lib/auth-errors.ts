/**
 * ترجمة أخطاء Supabase Auth لرسائل عربية تقول للمستخدم **يعمل إيه**.
 *
 * ── المشكلة اللي بيحلّها ────────────────────────────────────
 *
 * `signIn` و`signUp` كانوا بيرجّعوا `error.message` زي ما هو — وده نص
 * إنجليزي جاي من Supabase. فالمستخدم العربي بيشوف:
 *
 *     Invalid login credentials
 *
 * ودي رسالة **بتخفي** السبب أكتر ما بتوضّحه: Supabase بيرجّعها في
 * حالتين مختلفتين تمامًا — كلمة سر غلط، **وبريد مش مؤكَّد**. وده اللي
 * حصل فعلًا: تلات حسابات وقفوا برّه، والمستخدم فاكر إن كلمة سره غلط
 * فبيحاول تاني وتالت بنفس الكلمة الصح.
 *
 * ⚠️ **ليه بنقرا `code` قبل `message`؟** نص الرسالة بيتغيّر بين
 *    إصدارات Supabase من غير إنذار، لكن `code` ثابت. فالنص احتياطي
 *    للإصدارات القديمة اللي مكانش فيها `code`.
 *
 * ⚠️ **وليه مبنقولش «البريد ده مش مسجّل»؟** ده هيخلّي أي حد يعرف
 *    مين عنده حساب عندنا بتجربة بريد ورا التاني. Supabase بيرجّع نفس
 *    الرسالة للحالتين عن قصد، وإحنا بنمشي على نفس المبدأ.
 */

type AuthLikeError = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
};

const GENERIC = 'حصلت مشكلة ومكملناش. جرّب تاني، ولو فضلت كلّمنا.';

/** أخطاء الدخول — بالكود أولًا، وبالنص احتياطيًا. */
const BY_CODE: Record<string, string> = {
  invalid_credentials:
    'البريد الإلكتروني أو كلمة المرور غير صحيحة. راجع الاتنين وجرّب تاني.',
  email_not_confirmed:
    'الحساب اتعمل بس البريد لسه مش مؤكَّد. كلّم إدارة المنصة تفعّلهولك.',
  user_already_exists:
    'فيه حساب بالبريد ده بالفعل. جرّب تسجّل الدخول، أو استعمل بريدًا تانيًا.',
  email_exists:
    'فيه حساب بالبريد ده بالفعل. جرّب تسجّل الدخول، أو استعمل بريدًا تانيًا.',
  weak_password:
    'كلمة المرور قصيرة أوي. خليها ٦ حروف أو أرقام على الأقل.',
  validation_failed:
    'في بيانات ناقصة أو شكلها مش مظبوط. راجع الخانات وجرّب تاني.',
  email_address_invalid:
    'شكل البريد الإلكتروني مش مظبوط. راجعه وجرّب تاني.',
  signup_disabled:
    'التسجيل مقفول حاليًا. كلّم إدارة المنصة.',
  over_email_send_rate_limit:
    'بعتنا رسايل كتير في وقت قصير. استنى شوية وجرّب تاني.',
  over_request_rate_limit:
    'محاولات كتير في وقت قصير. استنى دقيقة وجرّب تاني.',
  user_banned:
    'الحساب ده موقوف. كلّم إدارة المنصة.',
  session_expired:
    'الجلسة انتهت. سجّل دخولك تاني.',
};

/** احتياطي: مطابقة بالنص للإصدارات اللي مبترجّعش `code`. */
const BY_TEXT: Array<[RegExp, string]> = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials],
  [/email not confirmed/i, BY_CODE.email_not_confirmed],
  [/user already registered|already been registered/i, BY_CODE.user_already_exists],
  [/password should be at least/i, BY_CODE.weak_password],
  [/unable to validate email address|invalid format/i, BY_CODE.email_address_invalid],
  [/signups? not allowed/i, BY_CODE.signup_disabled],
  [/email rate limit exceeded/i, BY_CODE.over_email_send_rate_limit],
  [/for security purposes|request this after/i, BY_CODE.over_request_rate_limit],
  [/banned/i, BY_CODE.user_banned],
];

export function authErrorMessage(error: AuthLikeError | null | undefined): string {
  if (!error) return GENERIC;

  const code = typeof error.code === 'string' ? error.code : '';
  if (code && BY_CODE[code]) return BY_CODE[code];

  const message = typeof error.message === 'string' ? error.message : '';
  for (const [pattern, text] of BY_TEXT) {
    if (pattern.test(message)) return text;
  }

  // ⚠️ النص الإنجليزي **مبيوصلش** للمستخدم. غير المعروف بيبقى رسالة
  //    عامة، والتفصيل بيروح للسجل — عشان نص Supabase ممكن يسرّب
  //    تفاصيل عن الحساب.
  if (message) console.error('[auth] رسالة غير مترجَمة:', code || '(بلا كود)', message);
  return GENERIC;
}
