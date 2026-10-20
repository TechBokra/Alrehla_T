import { InstructorStudent } from '@/types';
import { createClient } from '@/lib/supabase/server';

/**
 * طلاب المدرب الحالي.
 *
 * كانت بترجّع تلات طلاب مخترعين لكل مدرب في المنصة: أسماء وتقدّم مالهمش
 * وجود في قاعدة البيانات.
 *
 * التعريف الحقيقي لـ«طالبي»: صاحب اشتراك ليه جلسة مسندة ليّا. ودي نفس
 * العلاقة اللي صلاحيات القاعدة بتستخدمها (دالة `instructor_teaches`)،
 * عشان اللي الشاشة بتعرضه يبقى هو نفسه اللي الصلاحيات بتسمح بيه.
 *
 * ملاحظة: لو المشارك طفل، النصوص مربوطة بحساب ولي الأمر — فالرقم
 * المستخدم هو رقم الحساب، والاسم المعروض هو اسم المشارك.
 */
/**
 * طلاب المدرب.
 *
 * ── ليه بقت دالة في القاعدة ─────────────────────────────────
 *
 * كانت بتقرا `course_subscriptions` مباشرةً — وصلاحيات القاعدة **مش
 * سامحة للمدرب** بقراءة الجدول ده (سياستين بس: الإدارة، وصاحب
 * الحساب). فالاستعلام كان بيرجع فاضي دايمًا والقايمة تفضل فاضية،
 * مهما كان عنده طلاب.
 *
 * والحل مش سياسة قراءة: الصلاحيات بتحمي الصفوف لا الأعمدة، فالسياسة
 * كانت هتدّي المدرب الصف كله — وفيه صورة إيصال التحويل البنكي لولي
 * الأمر والمبلغ. الدالة بترجّع الاسم والباقة والتقدم وبس.
 */
export const getInstructorStudents = async (): Promise<InstructorStudent[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('instructor_students');

  if (error || !data) {
    if (error) console.error('Error loading instructor students', error);
    return [];
  }

  return data.map((row) => ({
    // المعرّف ده هو اللي روابط «الملف» بتستخدمه، فلازم يبقى نفسه في
    // اللوحة الرئيسية وفي القايمة — كانوا مختلفين قبل كده.
    id: row.user_ref,
    // ⚠️ الرقم اللي المستندات بتتسأل بيه — مش `user_ref`. شوف ملف 89.
    documentsRef: row.documents_ref,
    name: row.participant_name,
    packageName: row.package_name,
    sessionsCompleted: row.sessions_completed,
    totalSessions: row.sessions_total,
  }));
};
