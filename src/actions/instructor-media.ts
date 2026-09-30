'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireInstructor, requireAdmin } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/audit';
import { notifyAdmins } from '@/lib/notifications';

/**
 * صور بروفايل المدرب — غلاف وأعمال، بموافقة الإدارة (ملف 127).
 *
 * ── قواعد مكتوبة في القاعدة لا هنا ──────────────────────────
 *
 * الملف ده **مش هو الحارس**. القاعدة هي اللي بتمنع:
 *   • المدرب يدرج صفًّا «معتمدًا» — `WITH CHECK (status='pending')`
 *   • المدرب يعتمد صورته — المحفّز بيرجّع `OLD.status`
 *   • **وتغيير الصورة بعد الاعتماد يرجّع الحالة `pending`** —
 *     الموافقة كانت على الصورة لا على الصفّ
 *
 * والتحقق هنا **للرسالة المفهومة** لا للحماية: لو اعتمدنا على
 * الشاشة وحدها، أي نداء API مباشر بيتخطّاها.
 *
 * ── وصفر `throw` ────────────────────────────────────────────
 *
 * ⚠️ Next بيمسح نصّ الاستثناء في الإنتاج (قاعدة «هـ»)، فالرمي
 *    بيوصل للمستخدم **صفحة خطأ عامة** وبيطلّعه برّه الشاشة اللي
 *    كان بيملاها. كل المخارج بترجّع `{ ok }`.
 */

const MAX_WORKS = 12;

const mediaInput = z.object({
  imageUrl: z
    .string({ required_error: 'ارفع صورة الأول' })
    .trim()
    .min(1, 'ارفع صورة الأول')
    // ⚠️ **الرابط لازم يكون من Cloudinary بتاعنا.** الخانة دي
    //    بتوصل للخادم كنصّ، وأي حد يقدر يبعت أي رابط — وساعتها
    //    الموقع بيعرض صورة من سيرفر تاني في صفحة عامة، بلا أي
    //    تحكّم فيها ولا في وقت اختفائها.
    .refine((u) => /^https:\/\/res\.cloudinary\.com\//.test(u), {
      message: 'الصورة لازم تترفع من الموقع نفسه',
    }),
  title: z.string().trim().max(120, 'العنوان طويل أوي').optional().or(z.literal('')),
  contribution: z
    .string()
    .trim()
    .max(80, 'وصف المشاركة طويل أوي')
    .optional()
    .or(z.literal('')),
});

export type MediaResult = { ok: true } | { ok: false; error: string };

/** رفع غلاف أو عمل — بيدخل **معلَّقًا** دايمًا. */
export async function submitInstructorMedia(formData: FormData): Promise<MediaResult> {
  let instructorId: string;
  let instructorName = 'مدرب';
  try {
    const guard = await requireInstructor();
    instructorId = guard.instructorId;
    instructorName = guard.user.fullName ?? 'مدرب';
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'غير مصرح' };
  }

  const kind = String(formData.get('kind') ?? '');
  if (kind !== 'cover' && kind !== 'work') {
    return { ok: false, error: 'نوع الصورة غير معروف' };
  }

  const parsed = mediaInput.safeParse({
    imageUrl: formData.get('imageUrl'),
    title: formData.get('title'),
    contribution: formData.get('contribution'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };
  }

  const supabase = await createClient();

  // ⚠️ **سقف على عدد الأعمال.** من غيره المعرض بيبقى شريطًا لا
  //    ينتهي في صفحة عامة، والمراجعة بتبقى عبئًا على الإدارة.
  //    والعدّ بيشمل المعلَّق: اللي رفع ١٢ مستنيين مايرفعش تلتاشر.
  if (kind === 'work') {
    const { count } = await supabase
      .from('instructor_media')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_id', instructorId)
      .eq('kind', 'work')
      .neq('status', 'rejected');

    if ((count ?? 0) >= MAX_WORKS) {
      return { ok: false, error: `الحد ${MAX_WORKS} أعمال — امسح واحدًا قبل ما تضيف` };
    }
  }

  const { data, error } = await supabase
    .from('instructor_media')
    .insert({
      instructor_id: instructorId,
      kind,
      image_url: parsed.data.imageUrl,
      title: parsed.data.title || null,
      contribution: parsed.data.contribution || null,
      status: 'pending',
    })
    // ⚠️ `.select()` عشان **نتأكد إن الصفّ اتكتب فعلًا**. الإدراج
    //    اللي بترفضه الصلاحيات بيرجع بلا خطأ وبصفر صفوف (قاعدة
    //    «ك»)، والشاشة كانت هتقول «اتبعت للمراجعة» ومفيش حاجة
    //    اتبعتت.
    .select('id')
    .maybeSingle();

  if (error || !data) {
    console.error('تعذّر حفظ صورة المدرب', error);
    return { ok: false, error: 'تعذّر حفظ الصورة — جرّب تاني' };
  }

  await notifyAdmins({
    event: 'instructor_profile',
    title: `صورة جديدة للمراجعة: ${instructorName}`,
    message: kind === 'cover' ? 'غلاف بروفايل جديد' : 'صورة عمل جديدة',
    link: '/dashboard/admin/instructors/media',
  });

  revalidatePath('/dashboard/instructor/settings');
  revalidatePath('/dashboard/admin/instructors/media');
  return { ok: true };
}

/** المدرب بيشيل صورته. */
export async function removeInstructorMedia(formData: FormData): Promise<MediaResult> {
  let instructorId: string;
  try {
    instructorId = (await requireInstructor()).instructorId;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'غير مصرح' };
  }

  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'الصورة غير محددة' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('instructor_media')
    .delete()
    // ⚠️ الشرط على المدرب **مكرّر مع السياسة عن قصد**: السياسة
    //    بتحمي، والشرط بيخلّي الحذف الخاطئ يرجع بصفر صفوف بدل ما
    //    يعتمد على طبقة واحدة.
    .eq('id', id)
    .eq('instructor_id', instructorId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('تعذّر حذف صورة المدرب', error);
    return { ok: false, error: 'تعذّر حذف الصورة' };
  }
  if (!data) return { ok: false, error: 'الصورة مش موجودة أو مش بتاعتك' };

  // ⚠️ **الصورة بتفضل على Cloudinary.** مافيش حذف تلقائي من هنا
  //    لأن نفس الرابط ممكن يكون مستعملًا في مكان تاني — التنظيف
  //    من شاشة الصور في الإدارة زي باقي الصور اليتيمة.
  revalidatePath('/dashboard/instructor/settings');
  return { ok: true };
}

/** الإدارة: اعتماد أو رفض. */
export async function reviewInstructorMedia(formData: FormData): Promise<MediaResult> {
  let actorName = 'إداري';
  let actorId: string | undefined;
  try {
    const admin = await requireAdmin('canManageInstructors');
    actorName = admin.fullName ?? 'إداري';
    actorId = admin.id;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'غير مصرح' };
  }

  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const feedback = String(formData.get('feedback') ?? '').trim();

  if (!id) return { ok: false, error: 'الصورة غير محددة' };
  if (decision !== 'approved' && decision !== 'rejected') {
    return { ok: false, error: 'القرار غير معروف' };
  }
  // ⚠️ الرفض بلا سبب بيسيب المدرب يرفع نفس الصورة تاني — ومحدش
  //    مستفيد.
  if (decision === 'rejected' && feedback.length < 3) {
    return { ok: false, error: 'اكتب سبب الرفض عشان المدرب يعرف يصلّح إيه' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('instructor_media')
    .update({
      status: decision,
      admin_feedback: decision === 'rejected' ? feedback : null,
    })
    .eq('id', id)
    // ⚠️ **المعلَّق وحده.** من غير الشرط ده، ضغطتان على «اعتماد»
    //    من تبويبين مفتوحين بتعدّي الاتنين، والتانية بتعيد اعتماد
    //    صورة المدرب غيّرها بعد الأولى.
    .eq('status', 'pending')
    .select('id, instructor_id, kind')
    .maybeSingle();

  if (error) {
    // ⚠️ القيد الفريد بيمنع غلافين معتمدين لنفس المدرب. الرسالة
    //    لازم تقول ده صراحةً بدل «حصل خطأ».
    if (error.code === '23505') {
      return {
        ok: false,
        error: 'فيه غلاف معتمد بالفعل — ارفض القديم أو اطلب من المدرب يمسحه',
      };
    }
    console.error('تعذّر مراجعة الصورة', error);
    return { ok: false, error: 'تعذّر حفظ القرار' };
  }
  if (!data) {
    return { ok: false, error: 'تم البتّ في الصورة دي من قبل — حدّث الصفحة' };
  }

  await logAuditAction({
    actorProfileId: actorId,
    actorName,
    action: decision === 'approved' ? 'instructor_media_approved' : 'instructor_media_rejected',
    entityType: 'instructor_media',
    entityId: id,
    metadata: { instructorId: data.instructor_id, kind: data.kind },
  });

  revalidatePath('/dashboard/admin/instructors/media');
  revalidatePath(`/creative-writing/instructors/${data.instructor_id}`);
  return { ok: true };
}
