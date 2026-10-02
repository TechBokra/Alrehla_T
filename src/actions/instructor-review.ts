'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { approveProfileUpdateRequest, rejectProfileUpdateRequest } from '@/actions/instructors';
import { reviewInstructorMedia } from '@/actions/instructor-media';

/**
 * أكشنز صفحة «مراجعة ملفات المدربين» — المكان الواحد اللي بيتراجع فيه
 * ملف المدرب وصوره.
 *
 * الدوال الأصلية (`approveProfileUpdateRequest` …) بترمي عند الخطأ،
 * والصفحة دي نماذج خادم (`ActionForm`) محتاجة نتيجة `{ ok }` — فده
 * غلاف رفيع حواليها مش منطق جديد. الحماية والتسجيل والإشعار كلهم في
 * الأصلية زي ما هم.
 */
export type ReviewResult = { ok: true } | { ok: false; error: string };

const REVIEW_PATH = '/dashboard/admin/instructors/review';

/** اعتماد أو رفض طلب تعديل ملف واحد. */
export async function reviewProfileRequest(formData: FormData): Promise<ReviewResult> {
  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const feedback = String(formData.get('feedback') ?? '').trim();
  if (!id) return { ok: false, error: 'الطلب غير محدد' };

  try {
    if (decision === 'approved') {
      await approveProfileUpdateRequest(id);
    } else if (decision === 'rejected') {
      // الرفض بلا سبب بيسيب المدرب يبعت نفس الحاجة تاني.
      if (feedback.length < 3) {
        return { ok: false, error: 'اكتب سبب الرفض عشان المدرب يعرف يصلّح إيه' };
      }
      await rejectProfileUpdateRequest(id, feedback);
    } else {
      return { ok: false, error: 'القرار غير معروف' };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'تعذّر حفظ القرار' };
  }

  revalidatePath(REVIEW_PATH);
  return { ok: true };
}

/**
 * «اعتماد كل اللي مستني» لمدرب واحد: طلبات ملفه وصوره مع بعض.
 *
 * ⚠️ **كل عنصر بيتعتمد لوحده بنفس الدالة الأصلية** — مفيش طريق مختصر
 *    بيعدّي على الحماية. ولو عنصر فشل (مثلًا غلافين معتمدين)، الباقي
 *    بيكمّل والرسالة بتقول اللي ماتعتمدش.
 */
export async function approveAllForInstructor(formData: FormData): Promise<ReviewResult> {
  try {
    await requireAdmin('canManageInstructors', 'غير مصرح لك بمراجعة المدربين');
  } catch {
    return { ok: false, error: 'غير مصرح لك بمراجعة المدربين' };
  }

  const instructorId = String(formData.get('instructorId') ?? '');
  if (!instructorId) return { ok: false, error: 'المدرب غير محدد' };

  const supabase = await createClient();
  const [{ data: requests }, { data: media }] = await Promise.all([
    supabase
      .from('profile_update_requests')
      .select('id')
      .eq('instructor_id', instructorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('instructor_media')
      .select('id')
      .eq('instructor_id', instructorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);

  const failures: string[] = [];

  // الطلبات بالترتيب: لو طلبين لنفس الخانة، الأحدث هو اللي بيفضل.
  for (const r of requests ?? []) {
    try {
      await approveProfileUpdateRequest(r.id);
    } catch (err) {
      failures.push(err instanceof Error ? err.message : 'طلب تعديل ماتعتمدش');
    }
  }

  for (const m of media ?? []) {
    const fd = new FormData();
    fd.set('id', m.id);
    fd.set('decision', 'approved');
    const result = await reviewInstructorMedia(fd);
    if (!result.ok) failures.push(result.error);
  }

  revalidatePath(REVIEW_PATH);

  if (failures.length > 0) {
    return {
      ok: false,
      error: `اتعتمد الباقي، بس ${failures.length} ماتعتمدش: ${[...new Set(failures)].join(' — ')}`,
    };
  }
  return { ok: true };
}
