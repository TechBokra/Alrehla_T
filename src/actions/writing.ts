'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { requireAdmin } from '@/lib/auth-guard';

/**
 * حفظ باقة كتابة إبداعية.
 *
 * تلات حاجات كانت غلط هنا:
 *
 *   1. **مفيش أي تحقق صلاحية.** الدالة كانت بتنادي `getCurrentUser`
 *      عشان السجل بس، وبعدين تكتب في القاعدة على طول. يعني أي حساب
 *      مسجّل دخول كان يقدر — نظريًا — يضيف باقة أو يغيّر سعر باقة
 *      قايمة. اللي كان ماسك الباب هو صلاحيات القاعدة لوحدها، وده
 *      مخالف لقاعدة المشروع: كل كتابة تمر على `lib/auth-guard.ts`.
 *
 *   2. **الـslug كان بيتولّد من جديد** لو الفورم ما بعتوش —
 *      `pkg-${Date.now()}`. أي تعديل من غير حقل الـslug المخفي كان
 *      بيدّي الباقة عنوان جديد ويكسر كل رابط قديم ليها.
 *
 *   3. **بلا أي تحقق من الأرقام.** حقل سعر فاضي بيدي `Number('')` =
 *      صفر، وحقل عدد جلسات فيه كلام بيدي NaN — وNaN بيوصل للقاعدة
 *      كـnull، فالباقة تبقى بلا عدد جلسات ومفيش جلسة بتتولّد بعد
 *      الدفع.
 *
 * وزيادة: `UPDATE` كان بلا فحص عدد الصفوف — رفض صامت من صلاحيات
 * القاعدة كان بيعدّي كأنه نجاح.
 */
export async function saveWritingPackage(formData: FormData) {
  const currentUser = await requireAdmin(
    'canManageCatalog',
    'غير مصرح لك بإدارة باقات الكتابة',
  );

  const supabase = await createClient();
  const id = (formData.get('id') as string) || '';
  const isNew = !id;

  const name = ((formData.get('name') as string) || '').trim();
  if (!name) throw new Error('اسم الباقة مطلوب');

  const ageGroup = formData.get('ageGroup') as 'under_12' | '12_plus';
  if (ageGroup !== 'under_12' && ageGroup !== '12_plus') {
    throw new Error('الفئة العمرية غير صحيحة');
  }

  // المسار مستقل عن الفئة العمرية: مسارين ممكن يكونوا لنفس السن.
  const track = ((formData.get('track') as string) || '').trim() || null;

  const price = Number(formData.get('price'));
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('السعر غير صحيح');
  }

  // عدد الجلسات هو اللي بيتولّد منه جدول الاشتراك بعد تأكيد الدفع.
  // صفر أو فاضي = اشتراك بلا جلسات، فبنرفضه هنا بدل ما نكتشفه بعدين.
  const sessionsCount = Number(formData.get('sessionsCount'));
  if (!Number.isInteger(sessionsCount) || sessionsCount <= 0) {
    throw new Error('عدد الجلسات لازم يكون رقم صحيح أكبر من صفر');
  }

  const durationText = ((formData.get('durationText') as string) || '').trim() || null;
  const sessionDuration = ((formData.get('sessionDuration') as string) || '').trim() || null;
  const targetAudience = ((formData.get('targetAudience') as string) || '').trim() || null;
  const prerequisiteNote = ((formData.get('prerequisiteNote') as string) || '').trim() || null;
  const prerequisitePackageId = ((formData.get('prerequisitePackageId') as string) || '') || null;
  const shortDescription = ((formData.get('shortDescription') as string) || '').trim() || null;
  const fullDescription = ((formData.get('fullDescription') as string) || '').trim() || null;
  const isActive = formData.get('isActive') === 'on';

  const submittedSlug = ((formData.get('slug') as string) || '').trim();

  const dbPayload = {
    name,
    age_group: ageGroup,
    track,
    price,
    duration_text: durationText,
    sessions_count: sessionsCount,
    session_duration: sessionDuration,
    target_audience: targetAudience,
    prerequisite_note: prerequisiteNote,
    prerequisite_package_id: prerequisitePackageId,
    short_description: shortDescription,
    full_description: fullDescription,
    is_active: isActive,
  };

  let savedId = id;

  if (isNew) {
    const { data, error } = await supabase
      .from('creative_writing_packages')
      .insert([{ ...dbPayload, slug: submittedSlug || `pkg-${Date.now()}` }])
      .select('id')
      .single();

    if (error || !data) {
      console.error('Error inserting package:', error);
      throw new Error(`تعذّر إنشاء الباقة: ${error?.message ?? ''}`);
    }
    savedId = data.id;
  } else {
    // الـslug بيتبعت مع التعديل بس ما بيتغيّرش لو الفورم ما بعتوش —
    // الباقة بتحتفظ بعنوانها.
    const updatePayload = submittedSlug
      ? { ...dbPayload, slug: submittedSlug }
      : dbPayload;

    const { data, error } = await supabase
      .from('creative_writing_packages')
      .update(updatePayload)
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('Error updating package:', error);
      throw new Error(`تعذّر حفظ الباقة: ${error.message}`);
    }
    if (!data || data.length === 0) {
      throw new Error('التعديل مروّحش للقاعدة — الباقة مش موجودة أو الصلاحيات مش سامحة.');
    }
  }

  await logAuditAction({
    actorProfileId: currentUser.id,
    actorName: currentUser.fullName,
    action: isNew ? 'writing_package_created' : 'writing_package_updated',
    entityType: 'WritingPackage',
    entityId: savedId,
    metadata: { name },
  });

  revalidatePath('/dashboard/admin/writing/packages');
  revalidatePath('/creative-writing/packages');
  revalidatePath('/creative-writing/packages/[slug]', 'page');
}
