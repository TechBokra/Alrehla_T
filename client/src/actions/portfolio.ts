'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { createAdminClient } from '@/lib/supabase/admin';
import { canManageWriterContent } from '@/lib/document-control';

/**
 * The student's writing portfolio: saving a draft, sending it for review, and
 * the instructor's feedback.
 *
 * All three used to edit an in-memory array, so a student could write for an
 * hour, see "تم الحفظ", and lose everything on the next restart. They now write
 * to `portfolio_documents`.
 */

/**
 * The document must belong to the signed-in student.
 *
 * ⚠️ بترجّع `{ ok: false, error }` بدل ما ترمي (قاعدة «هـ») — وكل نداء
 *    لازم يفحص `ok` ويرجع فورًا، وإلا الكتابة تعدّي من غير تحقق الملكية.
 */
async function requireOwnDocument(documentId: string): Promise<
  | {
      ok: true;
      user: Awaited<ReturnType<typeof getCurrentUser>>;
      document: { id: string; student_id: string; status: string };
    }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (user.role === 'visitor') {
    return { ok: false, error: 'يجب تسجيل الدخول أولاً' };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('portfolio_documents')
    .select('id, student_id, status')
    .eq('id', documentId)
    .maybeSingle();

  if (!data) return { ok: false, error: 'النص غير موجود' };
  if (data.student_id !== user.id) return { ok: false, error: 'غير مصرح لك بتعديل هذا النص' };
  return { ok: true, user, document: data };
}

export type PortfolioResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function writeDocument(
  documentId: string,
  title: string,
  content: string,
  status: 'draft' | 'submitted'
): Promise<PortfolioResult> {
  const supabase = await createClient();
  // العنوان كان بيتكتب في الشاشة ومبيتبعتش هنا خالص — فأي تعديل عليه
  // كان بيضيع عند الحفظ.
  const { data, error } = await supabase
    .from('portfolio_documents')
    .update({ title, content, status, updated_at: new Date().toISOString() })
    .eq('id', documentId)
    .select('id');

  if (error) {
    console.error('Error saving portfolio document', error);
    return { ok: false, error: `تعذّر حفظ النص: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'الحفظ مروّحش للقاعدة — صلاحيات الحساب مش سامحة بالتعديل.' };
  }

  revalidatePath('/dashboard/student/portfolio');
  revalidatePath(`/dashboard/student/portfolio/${documentId}`);
  revalidatePath('/account/writing');
  revalidatePath(`/account/writing/${documentId}`);
  return { ok: true, id: documentId };
}

/**
 * نص جديد.
 *
 * الشاشة كانت بتفتح عادي على `portfolio/new`، بس زرار الحفظ كان بيخرج
 * من غير ما يعمل حاجة لما ما يكونش فيه نص محفوظ قبل كده — الطالب يكتب
 * صفحة كاملة ويدوس حفظ ومفيش أي حاجة بتحصل، ولا رسالة خطأ.
 */
export async function createPortfolioDocument(params: {
  title: string;
  content: string;
  status: 'draft' | 'submitted';
}): Promise<PortfolioResult> {
  const user = await getCurrentUser();
  if (user.role === 'visitor') {
    return { ok: false, error: 'يجب تسجيل الدخول أولاً' };
  }

  const title = params.title.trim();
  if (!title) return { ok: false, error: 'اكتب عنوان للنص' };
  if (!params.content.trim()) return { ok: false, error: 'النص فاضي' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('portfolio_documents')
    .insert({
      student_id: user.id,
      title,
      content: params.content,
      status: params.status,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Error creating portfolio document', error);
    return { ok: false, error: `تعذّر إنشاء النص: ${error?.message ?? ''}` };
  }

  revalidatePath('/dashboard/student/portfolio');
  revalidatePath('/account/writing');
  return { ok: true, id: data.id };
}

export async function saveDocumentDraft(
  documentId: string,
  title: string,
  content: string
): Promise<PortfolioResult> {
  let own;
  try {
    own = await requireOwnDocument(documentId);
  } catch {
    return { ok: false, error: 'غير مصرح' };
  }
  if (!own.ok) return own;
  const { document } = own;
  if (document.status === 'reviewed') {
    return { ok: false, error: 'تمت مراجعة هذا النص ولا يمكن تعديله' };
  }
  return writeDocument(documentId, title, content, 'draft');
}

export async function submitDocumentForReview(
  documentId: string,
  title: string,
  content: string
): Promise<PortfolioResult> {
  let own;
  try {
    own = await requireOwnDocument(documentId);
  } catch {
    return { ok: false, error: 'غير مصرح' };
  }
  if (!own.ok) return own;
  const { document } = own;
  if (document.status === 'reviewed') {
    return { ok: false, error: 'تمت مراجعة هذا النص بالفعل' };
  }
  return writeDocument(documentId, title, content, 'submitted');
}

/**
 * ⚠️ بترجّع ولا بترمي (قاعدة «هـ») — المدرب كان بيشوف رسالة إنجليزي
 *    عامة بدل «النص ده مش لطالب من طلابك».
 */
export async function submitInstructorFeedback(
  documentId: string,
  feedback: string,
): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return { ok: false, error: 'يجب تسجيل الدخول أولاً' };
  }
  if (user.role !== 'instructor') {
    return { ok: false, error: 'غير مصرح لك بكتابة ملاحظات' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('portfolio_documents')
    .update({
      instructor_feedback: feedback,
      status: 'reviewed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .select('id, student_id')
    .maybeSingle();

  if (error) {
    console.error('Error saving instructor feedback', error);
    return { ok: false, error: 'تعذّر حفظ الملاحظات' };
  }

  // ⚠️ صفر صفوف هنا **مش** عطلًا في القاعدة — دي الصلاحيات بترفض
  //    بصمت (قاعدة «ك»). سياسة `Instructors grade their own students
  //    documents` شرطها `instructor_teaches(student_id)`، فالمدرب
  //    اللي بيحاول يعلّق على نص مش لطالبه بياخد صفر صفوف.
  //
  //    وكانت `.single()`، فالرفض ده كان بيطلع «تعذّر حفظ الملاحظات» —
  //    رسالة بتقول «في عطل عندنا» على حاجة هي **منع مقصود**. المدرب
  //    كان يفضل يجرّب تاني وتالت في حاجة مش هتنجح.
  if (!data) {
    return { ok: false, error: 'النص ده مش لطالب من طلابك، أو مش موجود.' };
  }

  revalidatePath(`/dashboard/instructor/students/${data.student_id}/portfolio/${documentId}`);
  revalidatePath('/dashboard/student/portfolio');
  revalidatePath(`/dashboard/student/portfolio/${documentId}`);
  return { ok: true };
}

/**
 * مسح نص من مساحة الكتابة (طلب تامر، 10 أكتوبر) — **أي حالة**: مسودة أو
 * مُرسل أو متراجع. النص بتاع صاحبه، وبيتمسح معاه ملفاته وملاحظات المدرب.
 *
 *   • صاحبه يمسحه.
 *   • ولي أمره يمسحه لو الطفل أصغر من ١٢ (`canManageWriterContent`).
 *
 * حذف المستند والاحتفاظ بطلبات تنظيف الملفات يتمان في معاملة واحدة
 * عبر trigger قاعدة البيانات؛ عامل التنظيف يحذف Cloudinary بعد ذلك.
 */
export async function deletePortfolioDocument(
  documentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (user.role === 'visitor') return { ok: false, error: 'يجب تسجيل الدخول أولاً' };

    const supabase = await createClient();
    // RLS: صاحبه وولي أمره ومدربه والإدارة بس بيشوفوه.
    const { data: doc, error: readError } = await supabase
      .from('portfolio_documents')
      .select('id, student_id')
      .eq('id', documentId)
      .maybeSingle();
    if (readError) return { ok: false, error: 'تعذّر التحقق من ملكية النص' };
    if (!doc) return { ok: false, error: 'النص غير موجود' };
    if (user.role === 'instructor' || !(await canManageWriterContent(user.id, doc.student_id))) {
      return { ok: false, error: 'مش مسموح لك تمسح النص ده' };
    }

    const admin = createAdminClient();
    // The BEFORE DELETE trigger queues attachment cleanup before the cascade.
    // If the document delete fails, PostgreSQL rolls both changes back.
    const { data: deleted, error } = await admin.rpc('delete_private_file_document', {
      p_actor_id: user.id,
      p_document_id: documentId,
    });
    if (error) {
      console.error('Error deleting portfolio document', error);
      return { ok: false, error: 'تعذّر مسح النص — جرّب تاني' };
    }
    if (deleted !== true) return { ok: false, error: 'النص غير موجود أو لم تعد تملك صلاحية مسحه' };

    revalidatePath('/dashboard/student/portfolio');
    revalidatePath('/account/writing');
    revalidatePath('/account/family', 'layout');
    return { ok: true };
  } catch {
    return { ok: false, error: 'تعذّر مسح النص — جرّب تاني' };
  }
}
