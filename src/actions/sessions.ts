'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireInstructor } from '@/lib/auth-guard';
import { notifyUser, notifyAdmins } from '@/lib/notifications';

export type SessionReportResult =
  | { ok: true; sessionClosed: boolean }
  | { ok: false; error: string };

/**
 * حضور الطالب وتقرير المدرب عن الجلسة.
 *
 * الشاشة كانت بتقول «تم حفظ الحضور والتقرير، وتم إرسال نسخة للإدارة
 * وللطالب في لوحة التحكم الخاصة به» وهي **مش بتعمل حاجة**: مفيش أكشن
 * ولا جدول.
 *
 * ── بلاغ فريق العمل (27 سبتمبر) ─────────────────────────────
 *
 * «المدرب أرسل تقريرًا وجاءت رسالة نجاح، لكن:
 *   • الجلسة فضلت (قادمة) مع إن معادها فات
 *   • التقرير ما ظهرش لا للإدارة ولا لولي الأمر ولا للطالب»
 *
 * ⚠️ **والتقرير كان بيتحفظ فعلًا.** التشخيص (ملف 105) لقى صفّين في
 *    `session_reports` بنص مكتوب. اللي كان ناقص تلاتة:
 *
 *    **① الجلسة ما بتتقفلش.** مفيش سطر في المشروع كله كان بيكتب
 *       `sessions.status` — فبتفضل على حالتها الأولى للأبد.
 *
 *    **② الطالب مايقدرش يشوفه.** `/dashboard/student` بتجيب تقرير
 *       آخر جلسة **مكتملة** — ومفيش ولا واحدة مكتملة أبدًا. يعني
 *       الشاشة سليمة والبيانات موجودة، والرابط بينهم مقطوع بحالة
 *       ما اتغيّرتش.
 *
 *    **③ محدّش بيتبلّغ.** لا إدارة ولا ولي أمر.
 *
 * ⚠️ **ودي نفس فئة العطل** اللي قفلناها في `instructors.status`:
 *    عمود حالة مفيش طريق يغيّره، وكل الشاشات بتقراه.
 */
export async function saveSessionReport(params: {
  sessionId: string;
  attendance: 'present' | 'absent';
  report: string;
}): Promise<SessionReportResult> {
  const { sessionId, attendance, report } = params;

  const { instructorId, user } = await requireInstructor();

  const supabase = await createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('id, instructor_id, status, session_number, course_subscription_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return { ok: false, error: 'الجلسة غير موجودة' };
  if (session.instructor_id !== instructorId) {
    return { ok: false, error: 'هذه الجلسة ليست مسنَدة إليك' };
  }

  // ── ① التقرير ─────────────────────────────────────────────
  const { data: saved, error } = await supabase
    .from('session_reports')
    .upsert(
      {
        session_id: sessionId,
        instructor_id: instructorId,
        attendance,
        report: report.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' },
    )
    .select('session_id');

  if (error) {
    console.error('Error saving session report', error);
    return { ok: false, error: 'تعذّر حفظ التقرير' };
  }
  // قاعدة «و»: الكتابة على صفر صفوف بتنجح.
  if (!saved || saved.length === 0) {
    return { ok: false, error: 'التقرير مروّحش للقاعدة — جرّب تاني.' };
  }

  // ── ② قفل الجلسة ──────────────────────────────────────────
  //
  // ⚠️ **الترتيب مقصود: التقرير الأول، الحالة بعدين.** لو اتعكس
  //    وفشل حفظ التقرير، تبقى جلسة «مكتملة» بلا تقرير — ومحدّش
  //    هيعرف إنها ناقصة لأنها خرجت من قايمة «القادمة».
  //
  // ⚠️ **والشرط `status <> 'completed'`** بيخلّي تعديل تقرير جلسة
  //    مقفولة ما يرجّعهاش ولا يكرّر الإشعار.
  const { data: closed } = await supabase
    .from('sessions')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .neq('status', 'completed')
    .select('id');

  const sessionClosed = Boolean(closed && closed.length > 0);

  // ── ③ مين لازم يعرف ──────────────────────────────────────
  //
  // بيتبعت مرة واحدة — عند الإقفال لا مع كل تعديل للتقرير.
  if (sessionClosed) {
    const { data: subscription } = await supabase
      .from('course_subscriptions')
      .select('user_id')
      .eq('id', session.course_subscription_id)
      .maybeSingle();

    const attendanceText = attendance === 'present' ? 'حضر' : 'لم يحضر';

    if (subscription?.user_id) {
      await notifyUser({
        event: 'session_update',
        recipientProfileId: subscription.user_id,
        title: `تقرير الجلسة ${session.session_number}`,
        message: `${attendanceText} · ${user.fullName || 'المدرب'} كتب تقريرًا عن الجلسة.`,
        link: '/account/bookings',
      });
    }

    // ⚠️ الغياب مش زي الحضور: ده بند تشغيلي محتاج متابعة إدارة —
    //    جلسة مدفوعة راحت والطالب ماحضرش.
    if (attendance === 'absent') {
      await notifyAdmins({
        event: 'session_update',
        title: 'غياب في جلسة',
        message: `الطالب لم يحضر الجلسة ${session.session_number} مع ${user.fullName || 'المدرب'}.`,
        link: `/dashboard/admin/sessions/${sessionId}`,
      });
    }
  }

  revalidatePath(`/dashboard/instructor/sessions/${sessionId}`);
  revalidatePath('/dashboard/instructor/sessions');
  revalidatePath(`/dashboard/admin/sessions/${sessionId}`);
  revalidatePath('/dashboard/admin/sessions');
  revalidatePath('/dashboard/student');
  revalidatePath('/account/bookings');

  return { ok: true, sessionClosed };
}
