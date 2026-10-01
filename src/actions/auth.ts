'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { syncUserProfile } from '@/data/domains/auth'
import { authErrorMessage } from '@/lib/auth-errors'
import { getSafeRedirectPath } from '@/lib/safe-redirect'
import { SITE_URL } from '@/lib/seo'

/**
 * تنظيف البريد قبل ما يروح لـSupabase.
 *
 * ⚠️ النسخ واللصق بيجيب مسافة في الآخر مش باينة على الشاشة، وSupabase
 *    بيعتبرها جزءًا من البريد. فالمستخدم بيشوف بريده صح قدامه والدخول
 *    بيترفض. وSupabase بيوحّد حالة الحروف بنفسه، لكن بنعملها هنا برضه
 *    عشان المقارنة تبقى متوقَّعة.
 */
function normalizeEmail(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * شكل ردّ شاشات الدخول والتسجيل.
 *
 * ⚠️ النوع مكتوب صراحةً عشان `error` و`notice` يبقوا **الاتنين**
 *    معروفين للمكوّن. من غيره TypeScript بيطلّع اتحاد أشكال، والمكوّن
 *    مايقدرش يقرا الحقل اللي مش في الفرع اللي رجع.
 */
export type AuthActionResult = { error?: string; notice?: string }

export async function signIn(formData: FormData): Promise<AuthActionResult> {
  const email = normalizeEmail(formData.get('email'))
  const password = formData.get('password')

  if (!email || typeof password !== 'string' || password === '') {
    return { error: 'اكتب البريد الإلكتروني وكلمة المرور.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // ⚠️ النص الإنجليزي بتاع Supabase **مبيوصلش** للمستخدم — بيتترجم
    //    لرسالة بتقول له يعمل إيه (قاعدة «هـ»).
    return { error: authErrorMessage(error) }
  }

  try {
    if (data.user) {
      await syncUserProfile(data.user)
    }
  } catch {
    // الملف مش موجود ومش قادرين نعمله = الحساب مش صالح للاستعمال.
    // بنطلّعه بدل ما يدخل على شاشات فاضية.
    await supabase.auth.signOut()
    return {
      error: 'الحساب موجود بس ملفه ناقص. كلّم إدارة المنصة تضبطهولك.',
    }
  }

  // المكان اللي كان رايحه قبل ما الحارس يوقفه، لو فيه.
  //
  // ⚠️ بيمر على `getSafeRedirectPath` لأن القيمة جاية من الرابط —
  //    يعني من أي حد. من غيرها الرابط ده بيبقى باب تحويل لموقع برّه
  //    (Open Redirect) على صفحة الدخول نفسها.
  const nextRaw = formData.get('next')
  const next = getSafeRedirectPath(typeof nextRaw === 'string' ? nextRaw : null)

  // `/dashboard` بيوزّع كل دور على لوحته — فمفيش توجيه بالدور هنا.
  redirect(next === '/' ? '/dashboard' : next)
}

// عامّة بالضرورة: دي دالة إنشاء الحساب نفسها، فمفيش مستخدم تتحقق منه.
// الحماية هنا من Supabase Auth (منع التكرار وحدود المحاولات).
export async function signUp(formData: FormData): Promise<AuthActionResult> {
  const email = normalizeEmail(formData.get('email'))
  const password = formData.get('password')
  const fullNameRaw = formData.get('fullName')
  const fullName = typeof fullNameRaw === 'string' ? fullNameRaw.trim() : ''

  // ⚠️ `required` في الواجهة مش دليل إن القيمة وصلت (قاعدة «ع»).
  if (!email || !fullName || typeof password !== 'string' || password.length < 6) {
    return { error: 'راجع الخانات: الاسم والبريد مطلوبين، وكلمة المرور ٦ على الأقل.' }
  }

  // الصفحة اللي العميل جاي منها — بيرجعلها بعد التسجيل، أو بعد تأكيد
  // البريد (رابط التأكيد بيعدّي على `/auth/callback?next=`).
  const nextRaw = formData.get('next')
  const next = getSafeRedirectPath(typeof nextRaw === 'string' ? nextRaw : null)

  const supabase = await createClient()

  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      // ⚠️ لازم `/auth/callback` يبقى في Redirect URLs في Supabase (هو
      //    نفسه بتاع استرجاع كلمة المرور). لو مش مسموح، Supabase بيرجع
      //    لعنوان الموقع الأساسي — زي ما كان قبل السطر ده بالظبط.
      emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next === '/' ? '/dashboard' : next)}`,
    },
  })

  if (error) {
    return { error: authErrorMessage(error) }
  }

  // ── الحساب اتعمل. عنده جلسة ولا لأ؟ ───────────────────────
  //
  // ⚠️ **دي كانت أخطر نقطة في الملف.**
  //
  // لما `Confirm email` يكون مفتوح في إعدادات Supabase، `signUp`
  // بترجّع **مستخدمًا بلا جلسة**. والكود القديم كان بيحوّل على
  // `/dashboard` على طول — والحارس بيرجّعه لصفحة الدخول، وهو يحاول
  // يدخل فيشوف «البريد أو كلمة المرور غير صحيحة». فالمستخدم فاكر إن
  // كلمة سره غلط، والحقيقة إنه مستني رسالة بريد.
  //
  // ودي مش نظرية: تلات حسابات وقفوا كده فعلًا (ملف 94)، ومحدّش عرف
  // ليه إلا لما حد فيهم اشتكى.
  //
  // ⚠️ الإعداد ده **في لوحة Supabase لا في الكود** — يعني ممكن يتفتح
  //    تاني في أي وقت من غير ما نعدّل حرفًا. فالكود لازم يتعامل مع
  //    الحالتين مهما كان الإعداد النهارده.
  if (!data.session) {
    return {
      notice:
        'الحساب اتعمل. لسه ناقص تأكيد البريد: هتلاقي رسالة على بريدك فيها رابط التفعيل. '
        + 'لو ما وصلتش خلال شوية، شوف في الـSpam أو كلّم إدارة المنصة.',
    }
  }

  // ⚠️ **الإدراج اليدوي في `user_profiles` اتشال من هنا.**
  //
  //    كان: `await supabase.from('user_profiles').insert({...})` بلا
  //    أي فحص لنتيجته (قاعدة «و»). وطلع إنه **زيادة أصلًا**: في محفّز
  //    `on_auth_user_created → handle_new_user` على `auth.users`
  //    بيعمل الصف تلقائيًا (ملف 94 أثبته: ٢٢ حسابًا، صفر بلا ملف).
  //
  //    فالسطر كان بيفشل بصمت على تصادم المفتاح ومحدّش شايف. وشيله
  //    بيخلّي مصدر الملف واحدًا: المحفّز، و`syncUserProfile` احتياطًا
  //    عند أول دخول.

  redirect(next === '/' ? '/dashboard' : next)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

/**
 * «نسيت كلمة المرور» — بنبعت رابط استرجاع على البريد.
 *
 * ── العطل اللي بيقفله ───────────────────────────────────────
 *
 * الموقع **مكانش فيه طريق واحد** لاسترجاع كلمة مرور منسية. اللي
 * بينسى كلمة مروره بيبقى مقفول برّه للأبد — الطريق الوحيد إنه يكلّم
 * الإدارة وحد يعيّنها له بإيده من لوحة التحكم. ودي مش خدمة عملاء،
 * دي عميل ضايع.
 *
 * ── وليه الرسالة واحدة في كل الحالات ────────────────────────
 *
 * ⚠️ **مابنقولش إذا كان البريد مسجَّل عندنا ولا لأ.** لو قلنا،
 *    يبقى أي حد يقدر يكتب بريد ويعرف منّنا هل صاحبه عميل عندنا —
 *    ودي معلومة عن عملائنا مش عنّا. فالرسالة واحدة دايمًا:
 *    «لو البريد مسجّل، الرسالة في طريقها».
 *
 * ⚠️ **وحتى الخطأ من Supabase مابيتعرضش.** الخطأ الوحيد اللي بيرجع
 *    هو بريد مكتوب غلط شكلًا — وده الشخص نفسه يقدر يشوفه.
 *
 * ── الرابط بيودّي فين ───────────────────────────────────────
 *
 * `/auth/callback?next=/reset-password` — نفس الطريق اللي بيبدّل
 * الكود بجلسة. فالشخص بيوصل `/reset-password` **وهو مسجَّل دخوله
 * فعلًا**، وبيحطّ كلمة مروره بنفس الأكشن اللي بيستخدمه أول دخول.
 *
 * ⚠️ **ولازم العنوان ده يتسجّل في Supabase** تحت
 *    Authentication ← URL Configuration ← Redirect URLs، وإلا
 *    الرابط بيرجّع الشخص للصفحة الرئيسية بلا جلسة.
 */
export async function requestPasswordReset(email: string): Promise<AuthActionResult> {
  const clean = typeof email === 'string' ? email.trim() : '';

  // فحص شكلي بس — مش تأكيد إن البريد موجود عندنا.
  if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return { error: 'اكتب بريدًا إلكترونيًّا صحيحًا.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(clean, {
    redirectTo: `${SITE_URL}/auth/callback?next=/reset-password`,
  });

  // بنسجّله عندنا ومابنقولوش للزائر — الرسالة واحدة في كل الحالات.
  if (error) console.error('Error sending password reset', error);

  return {
    notice:
      'لو البريد ده مسجّل عندنا، هيوصله رابط لتغيير كلمة المرور خلال دقايق. شوف صندوق الوارد والبريد المهمَل.',
  };
}
