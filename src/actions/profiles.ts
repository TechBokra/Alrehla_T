'use server';

import { revalidatePath } from 'next/cache';
import { refreshPublicPages } from '@/lib/revalidate';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/data/domains/auth';
import { logAuditAction } from '@/lib/audit';

/**
 * A person editing their own profile.
 *
 * All three profile screens (instructor, publisher, student) used one shared
 * form whose save button was wired to nothing at all: the fields could be
 * typed into, the button clicked, and nothing was ever written.
 *
 * ⚠️ **بترجّع ولا بترمي** (قاعدة «هـ»): Next بيمسح نصّ الاستثناء في
 *    الإنتاج، فالمستخدم كان بيشوف رسالة إنجليزي عامة بدل «اكتب اسمك».
 *    و`field` = اسم الخانة اللي عليها الخطأ، والشاشة بتعلّمها.
 */
export type ProfileResult = { ok: true } | { ok: false; error: string; field?: string };

const fail = (error: string, field?: string): { ok: false; error: string; field?: string } =>
  field ? { ok: false, error, field } : { ok: false, error };

/** The signed-in user's own name and picture, stored in `user_profiles`. */
export async function updateMyProfile(params: {
  fullName: string;
  avatarUrl?: string;
}): Promise<ProfileResult> {
  const fullName = params.fullName.trim();
  if (!fullName) return fail('اكتب اسمك', 'fullName');
  if (fullName.length > 120) return fail('الاسم طويل جدًا', 'fullName');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('يجب تسجيل الدخول أولاً');

  // ⚠️ الصورة بتتلمس بس لو اتبعتت: المدرب المفعّل بيبعت الاسم لوحده
  //    (صورته بتروح في طلب المراجعة — ملف 15)، وكانت `undefined` هنا
  //    بتمسح صورته.
  const { data: saved, error } = await supabase
    .from('user_profiles')
    .update({
      full_name: fullName,
      ...(params.avatarUrl !== undefined ? { avatar_url: params.avatarUrl.trim() || null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select('id');

  if (error) {
    console.error('Error updating profile', error);
    // حارس ملف 15 — رسالته عربي ومفهومة، فبتوصل زي ما هي.
    if (error.message?.includes('صورة المدرب')) return fail(error.message);
    return fail('تعذّر حفظ البيانات');
  }

  // ⚠️ قاعدة (و): `UPDATE` على صف مش موجود — أو صف بترفضه الصلاحيات —
  // بينجح بصفر صفوف وبلا أي خطأ. من غير الفحص ده الشاشة بتقول «اتحفظ»
  // ومفيش حاجة وصلت للقاعدة، والمستخدم بيدوّر على صورته وما بيلاقيهاش.
  if (!saved || saved.length === 0) {
    return fail('لم يصل الحفظ إلى قاعدة البيانات. جرّب تاني.');
  }

  revalidatePath('/dashboard/student/profile');
  revalidatePath('/dashboard/instructor/profile');
  revalidatePath('/account');
  refreshPublicPages();

  // صفحات المدربين العامة مخزَّنة مؤقتًا (تتجدد كل ساعة). الصورة بقت
  // بتظهر فيها، فلازم تتجدد دلوقتي — وإلا المدرب يغيّر صورته ويشوفها في
  // لوحته بس، ويفضل الموقع العام على القديمة لحد ساعة.
  refreshPublicPages();

  return { ok: true };
}

/**
 * A publisher editing their own house's details.
 *
 * Saved directly rather than sent for review: this is a contracted publisher's
 * own name, description and logo, not public editorial content — unlike an
 * instructor's bio, which is a claim shown to parents choosing a teacher.
 */
export async function updateMyPublisherProfile(params: {
  publisherId: string;
  name: string;
  bio: string;
  logoUrl?: string;
}): Promise<ProfileResult> {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return fail('يجب تسجيل الدخول أولاً');
  }
  const name = params.name.trim();
  if (!name) return fail('اكتب اسم دار النشر', 'name');

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return fail('يجب تسجيل الدخول أولاً');

  // The publisher must be the caller's own. The page used to show
  // `publishers[0]` — the first publisher in the whole table — so a second
  // publisher would have been editing somebody else's record.
  const { data: owned } = await supabase
    .from('publishers')
    .select('id')
    .eq('id', params.publisherId)
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (!owned) return fail('غير مصرح لك بتعديل هذا الملف');

  const { data: saved, error } = await supabase
    .from('publishers')
    .update({
      name,
      bio: params.bio.trim(),
      logo_url: params.logoUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.publisherId)
    .select('id');

  // ⚠️ فحص الملكية فوق بيقرا، والكتابة بتمر على الصلاحيات تاني —
  //    والاتنين ممكن يختلفوا. صفر صفوف هنا معناها الحفظ ما تمّش
  //    (قاعدة «و»).
  if (!error && (!saved || saved.length === 0)) {
    return fail('الحفظ مروّحش للقاعدة — راجع الصلاحيات.');
  }

  if (error) {
    console.error('Error updating publisher profile', error);
    return fail('تعذّر حفظ بيانات دار النشر');
  }

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'publisher_profile_updated',
    entityType: 'Publisher',
    entityId: params.publisherId,
    metadata: { name },
  });

  revalidatePath('/dashboard/publisher/profile');
  revalidatePath('/dashboard/publisher');
  refreshPublicPages();
  return { ok: true };
}
