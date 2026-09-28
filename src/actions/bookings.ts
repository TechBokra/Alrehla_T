
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAuditAction } from '@/lib/audit';
import { notifyAdmins, notifyUser } from '@/lib/notifications';
import { buildSessionSchedule } from '@/lib/session-schedule';
import type { WeeklySlot } from '@/types';
import { hasAdminPermission } from '@/lib/utils';
import { getCurrentUser } from '@/data/domains/auth';
import { getDependentGuardian } from '@/lib/auth-guard';
import { createSessionRoom, isDailyConfigured } from '@/lib/daily';
import { getSiteSettings } from '@/data/domains/content';

export type BookingResult =
  | { ok: true; subscriptionId: string; paymentReference: string }
  | { ok: false; error: string };

/**
 * حجز مسار الكتابة الإبداعية.
 *
 * اللي كان بيحصل قبل كده:
 *   • الواجهة بتبعت مبلغ (250 مكتوبة في الكود) والدالة بتتجاهله — ومفيش
 *     عمود مبلغ في الجدول أصلًا، فالإدارة بتأكد دفع بلا رقم.
 *   • رقم الباقة اللي بيتخزن كان **اسم** الباقة، لأن قايمة الباقات في
 *     المعالج كانت تلات أسماء مكتوبة في الكود.
 *   • أول جلسة بتتعمل تلقائيًا بتاريخ «بعد 3 أيام» مخترع، ولو فشلت
 *     بيتم تجاهل الفشل.
 *
 * دلوقتي: دالة في القاعدة بتتأكد إن الباقة موجودة ومفعّلة، وبتاخد
 * السعر منها، وبتتأكد إن المدرب مفعّل وإن المشارك يخص صاحب الحساب.
 * والجدولة بتحصل بعد تأكيد الدفع بتاريخ حقيقي.
 */
export async function createCourseBooking(params: {
  packageId: string;
  instructorId?: string;
  participantType: 'self' | 'child';
  childId?: string;
  /**
   * الموعد الأسبوعي اللي العميل اختاره في المعالج.
   *
   * الدالة اللي في القاعدة (`create_course_booking`) مبتاخدهوش، فبيتكتب
   * على الصف بعد ما يتعمل. لو الكتابة فشلت مش بنلغي الحجز — الحجز
   * اتسجّل فعلًا، والإدارة تقدر تظبّط الميعاد من شاشة الحجوزات.
   */
  preferredSlot?: { day: string; time: string };
  /**
   * إهداء خاص يكتبه صاحب الحجز — بيظهر مع الحجز للإدارة والمدرب.
   *
   * ⚠️ بيتقصّ ويتقفل في القاعدة، مش هنا: الـRPC ممكن تتنادى من غير
   *    الشاشة دي، فالحد الأقصى لازم يبقى في `create_course_booking`.
   */
  giftMessage?: string;
  /**
   * موافقة ولي الأمر على تسجيل الجلسات.
   *
   * ⚠️ **بتتفحص على الخادم، مش في الشاشة بس.** مربّع الاختيار
   *    بيعطّل الزرّ، لكن الأكشن ده ممكن يتنادى من غير الشاشة دي
   *    خالص (قاعدة «ع»). فلو التسجيل شغّال ومفيش موافقة، الحجز
   *    **بيترفض هنا** — مش بيعدّي وبعدين نكتشف.
   */
  recordingConsent?: boolean;
}): Promise<BookingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'لازم تسجّل الدخول قبل الحجز' };

  // حساب الطفل التابع ممنوع من الحجز المباشر — يمر على ولي أمره.
  const dependent = await getDependentGuardian();
  if (dependent) {
    return { ok: false, error: 'الحجز محتاج موافقة ولي أمرك. كلّمه يعمله من حسابه.' };
  }

  // ── الموافقة شرط، والشرط بيتنفّذ هنا ──────────────────────
  const settings = await getSiteSettings();
  const consentRequired = settings.sessionRecording.enabled;

  if (consentRequired && params.recordingConsent !== true) {
    return {
      ok: false,
      error: 'لازم توافق على تسجيل الجلسات قبل إتمام الحجز.',
    };
  }

  const { data, error } = await supabase.rpc('create_course_booking', {
    p_package_id: params.packageId,
    p_instructor_id: params.instructorId || null,
    p_participant_type: params.participantType,
    p_child_id: params.childId || null,
    p_gift_message: params.giftMessage?.trim() || null,
  });

  if (error || !data) {
    console.error('Error creating booking:', error);
    return { ok: false, error: error?.message ?? 'تعذّر تسجيل الحجز' };
  }

  const subscriptionId = data as unknown as string;

  if (params.preferredSlot) {
    const { error: slotError } = await supabase
      .from('course_subscriptions')
      .update({ preferred_slot: params.preferredSlot })
      .eq('id', subscriptionId)
      .select('id');
    if (slotError) console.error('Error saving preferred slot', slotError);
  }

  // ── تسجيل الموافقة ─────────────────────────────────────────
  //
  // ⚠️ **بنقرا القيمة اللي نزلت فعلًا، مش بنعدّ الصفوف.**
  //
  //    `update … select('id')` بيرجّع صفًّا حتى لو محفّز حماية
  //    رجّع العمود لقيمته القديمة — وده اللي حصل بالظبط في
  //    `guard_order_fields` وخلّى ستة طلبات بإجمالي صفر وإحنا
  //    فاكرين إن الكتابة نجحت.
  //
  //    فبنطلب العمود نفسه: لو رجع فاضي، يبقى الكتابة **اترفضت
  //    في صمت** مهما كان عدد الصفوف.
  //
  // ⚠️ **والفشل هنا مابيلغيش الحجز** — الحجز اتسجّل في القاعدة
  //    خلاص والعميل هيدفع. بس الإدارة لازم تعرف، لأن حجز بلا
  //    موافقة مسجّلة معناه إننا مانقدرش نثبت إن ولي الأمر وافق.
  if (consentRequired) {
    const { data: consentRow, error: consentError } = await supabase
      .from('course_subscriptions')
      .update({ recording_consent_at: new Date().toISOString() })
      .eq('id', subscriptionId)
      .select('recording_consent_at')
      .maybeSingle();

    if (consentError || !consentRow?.recording_consent_at) {
      console.error('Recording consent not saved', subscriptionId, consentError);
      await notifyAdmins({
        event: 'payment_review',
        title: 'حجز بلا موافقة تسجيل مسجّلة',
        message: `الحجز ${subscriptionId} اتسجّل، لكن موافقة ولي الأمر على التسجيل ما اتكتبتش في القاعدة. راجعه قبل أول جلسة.`,
        link: `/dashboard/admin/bookings/${subscriptionId}`,
      });
    }
  }

  // الرقم المرجعي بيتولّد في القاعدة مع الحجز، والعميل بيكتبه في ملاحظة
  // التحويل.
  const { data: row } = await supabase
    .from('course_subscriptions')
    .select('payment_reference')
    .eq('id', subscriptionId)
    .maybeSingle();

  revalidatePath('/account/orders/creative-writing');
  revalidatePath('/dashboard/admin/bookings');
  return {
    ok: true,
    subscriptionId,
    paymentReference: row?.payment_reference ?? '',
  };
}

export async function submitBookingPaymentProof(
  subscriptionId: string,
  payment: { method: 'instapay' | 'vodafone_cash'; receiptUrl: string },
) {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (user.role === 'visitor') {
    return { success: false, error: 'لازم تسجّل الدخول الأول' };
  }

  if (await getDependentGuardian()) {
    return { success: false, error: 'تأكيد الدفع بيتم من حساب ولي أمرك.' };
  }

  const { data: sub } = await supabase
    .from('course_subscriptions')
    .select('user_id')
    .eq('id', subscriptionId)
    .single();

  if (!sub || sub.user_id !== user.id) {
    return { success: false, error: 'الحجز ده مش على حسابك' };
  }
  
  // إثبات الدفع كان بيترمي هنا بالكامل: الحالة بتتغيّر ومفيش مرجع ولا
  // إيصال. دلوقتي وسيلة الدفع وصورة الإيصال بيتخزنوا، والرقم المرجعي
  // بتاعنا اتولّد مع الحجز.
  const { data: saved, error } = await supabase
    .from('course_subscriptions')
    .update({
      status: 'awaiting_verification',
      payment_method: payment.method,
      payment_receipt_url: payment.receiptUrl,
    })
    .eq('id', subscriptionId)
    .select('id');

  if (error) {
    console.error('Error submitting payment proof:', error);
    return { success: false, error: `تعذّر إرسال الإيصال: ${error.message}` };
  }
  // صفر صفوف = رفض صامت من صلاحيات القاعدة. من غير الفحص ده العميل
  // بيشوف «اتبعت» ويستنى مراجعة مش هتيجي، والإدارة مش شايفة أي إيصال.
  if (!saved || saved.length === 0) {
    return { success: false, error: 'الإيصال مروّحش للقاعدة — جرّب تاني أو كلّم الدعم.' };
  }

  await notifyAdmins({
    event: 'payment_review',
    title: 'إثبات دفع حجز بانتظار المراجعة',
    message: 'عميل رفع إيصال تحويل لحجز باقة كتابة.',
    link: `/dashboard/admin/bookings/${subscriptionId}`,
  });

  revalidatePath('/creative-writing/booking/confirm');
  revalidatePath('/account/orders/creative-writing');
  revalidatePath('/account/subscriptions/course');
  revalidatePath('/dashboard/admin/bookings');
  revalidatePath('/dashboard/instructor/sessions');
  revalidatePath('/dashboard/student/sessions');

  return { success: true };
}

/**
 * جلسات الاشتراك.
 *
 * العدد من الباقة، والمواعيد من جدول المدرب الأسبوعي — جلسة كل أسبوع.
 * الحالة `pending` عن قصد: الميعاد **اتحسب** مش اتفق عليه، والإدارة
 * بتثبّته من شاشة الحجوزات.
 *
 * بترجع صفر لو الاشتراك عنده جلسات خلاص — تأكيد مرتين ما ينفعش يعمل
 * الجلسات مرتين.
 */
async function createSessionsForSubscription(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    subscriptionId: string;
    packageId: string;
    instructorId: string | null;
    preferredSlot: WeeklySlot | null;
  }
): Promise<number> {
  const { data: existing } = await supabase
    .from('sessions')
    .select('id')
    .eq('course_subscription_id', params.subscriptionId)
    .limit(1);

  if (existing && existing.length > 0) return 0;

  const { data: pkg } = await supabase
    .from('creative_writing_packages')
    .select('sessions_count')
    .eq('id', params.packageId)
    .maybeSingle();

  const count = pkg?.sessions_count ?? 0;
  if (count <= 0) {
    console.error('Package has no sessions_count', params.packageId);
    return 0;
  }

  let weeklySchedule: WeeklySlot[] | null = null;
  if (params.instructorId) {
    const { data: instructor } = await supabase
      .from('instructors')
      .select('weekly_schedule')
      .eq('id', params.instructorId)
      .maybeSingle();
    weeklySchedule = (instructor?.weekly_schedule as WeeklySlot[] | null) ?? null;
  }

  // الموعد اللي العميل اختاره له الأولوية على أول ميعاد فاضي في جدول
  // المدرب. من غير ده العميل كان بيتجدول في ميعاد تاني خالص غير اللي
  // وافق عليه في ملخص الحجز.
  const dates = buildSessionSchedule({
    count,
    weeklySchedule,
    preferredSlot: params.preferredSlot,
  });

  const { data: inserted, error } = await supabase
    .from('sessions')
    .insert(
      dates.map((scheduledAt, index) => ({
        course_subscription_id: params.subscriptionId,
        instructor_id: params.instructorId,
        session_number: index + 1,
        scheduled_at: scheduledAt,
        // ⚠️ **كانت `'pending'` — والشاشة بتترجمها «بانتظار تثبيت
        //    الموعد».**
        //
        //    والجلسات دي بتتعمل **بعد** ما الإدارة تأكّد الدفع،
        //    ومواعيدها متولّدة من الموعد الأسبوعي اللي ولي الأمر
        //    اختاره. يعني الموعد **مثبَّت فعلًا** في اللحظة دي
        //    بالظبط — والشاشة بتقول لولي الأمر العكس على باقة
        //    دفع تمنها.
        //
        //    `'scheduled'` هي **القيمة الافتراضية للعمود في
        //    القاعدة** أصلًا (ملف 105 أكّدها) — الكود كان بيدوس
        //    فوقها بقيمة تانية.
        status: 'scheduled',
      }))
    )
    .select('id, scheduled_at');

  if (error) {
    // الفشل هنا مش بيلغي تأكيد الدفع — الفلوس وصلت فعلًا. بيتسجّل عشان
    // تعرف إن الاشتراك محتاج جدولة بالإيد.
    console.error('Error creating sessions for subscription', error);
    return 0;
  }

  // ── غرفة اللقاء لكل جلسة ────────────────────────────────────
  //
  // ⚠️ **الفشل هنا مابيلغيش الجلسات.** العميل دفع والجلسات اتجدولت؛
  //    غرفة ما اتعملتش مشكلة تتصلّح بزرّ «جهّز الغرف» في لوحة
  //    الإدارة، مش سبب يرجّع الحجز كله.
  //
  // ⚠️ **والنداء بيتعمل واحدة واحدة عن قصد.** إنشاء عشر غرف
  //    بالتوازي على حساب مجاني بيرجّع رفضًا بسبب كثرة الطلبات،
  //    والنتيجة نص الجلسات بلا غرف وسبب مالوش علاقة بالمنطق.
  if (inserted && inserted.length > 0 && isDailyConfigured()) {
    const settings = await getSiteSettings();

    for (const session of inserted) {
      const room = await createSessionRoom({
        sessionId: session.id,
        startsAt: new Date(session.scheduled_at),
        durationMinutes: 40,
        recordingEnabled: settings.sessionRecording.enabled,
      });
      if (!room.ok) {
        console.error('Room not created for session', session.id, room.error);
        continue;
      }

      // موعد حذف التسجيل بيتحسب **من الإعدادات وقت الجلسة**، لأن
      // ده الوعد اللي ولي الأمر شافه وقت الحجز. تغيير المدة بعدين
      // مالوش أثر رجعي على الجلسات دي.
      const expiresAt = settings.sessionRecording.enabled
        ? new Date(
            new Date(session.scheduled_at).getTime() +
              settings.sessionRecording.retentionDays * 24 * 60 * 60 * 1000,
          ).toISOString()
        : null;

      await supabase
        .from('sessions')
        .update({
          room_name: room.data.name,
          room_url: room.data.url,
          recording_expires_at: expiresAt,
          recording_status: settings.sessionRecording.enabled ? 'pending' : null,
        })
        .eq('id', session.id)
        .select('id');
    }
  }

  return inserted?.length ?? 0;
}

export async function confirmBookingPayment(subscriptionId: string) {
  // كان بيتحقق من الدور مباشرة — مختلف عن كل الإجراءات التانية اللي
  // بتمر على نظام الصلاحيات. يعني تعديل صلاحيات حساب ما كانش بيأثر هنا.
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) {
    return { success: false, error: 'غير مصرح لك بتأكيد الحجوزات' };
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from('course_subscriptions')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', subscriptionId)
    .select('id, user_id, child_id, package_id, preferred_instructor_id, preferred_slot')
    .maybeSingle();

  if (error || !updated) {
    console.error('Error confirming payment:', error);
    return { success: false, error: error?.message ?? 'الاشتراك مش موجود' };
  }

  // ---------- توليد الجلسات ----------
  //
  // ده الجزء اللي كان ناقص. التأكيد كان بيحوّل الاشتراك لـ«نشط» وخلاص،
  // ومفيش ولا جلسة بتتعمل — ولوحة الطالب ولوحة المدرب الاتنين بيقروا من
  // جدول الجلسات، فالاتنين كانوا بيفضلوا فاضيين بعد كل عملية شراء.
  const sessionsCreated = await createSessionsForSubscription(supabase, {
    subscriptionId: updated.id,
    packageId: updated.package_id,
    instructorId: updated.preferred_instructor_id ?? null,
    preferredSlot: (updated.preferred_slot as WeeklySlot | null) ?? null,
  });

  // ⚠️ الإشعار كان **جوّه** `if (sessionsCreated > 0)`. يعني لو الجدولة
  //    فشلت، العميل كان بيدفع ويتأكد دفعه **ومحدّش بيقوله حاجة خالص**:
  //    لا إشعار، ولا جلسات في لوحته. فلوس دخلت وسكوت تام.
  //
  //    الدفع اتأكد في الحالتين، فالعميل بيعرف في الحالتين — والنص
  //    بيتغيّر بدل ما يختفي.
  await notifyUser({
    event: 'session_update',
    recipientProfileId: updated.user_id,
    title: sessionsCreated > 0 ? 'اتأكد دفعك — جلساتك جاهزة' : 'اتأكد دفعك',
    message:
      sessionsCreated > 0
        ? `اتعمل ${sessionsCreated} جلسة بمواعيد مبدئية. هنتواصل معاك لتثبيتها.`
        : 'استلمنا دفعك وسجّلنا اشتراكك. المواعيد هنرتّبها ونتواصل معاك.',
    link: '/account/subscriptions/course',
  });

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName || 'Admin',
    action: 'booking_payment_confirmed',
    entityType: 'CourseSubscription',
    entityId: subscriptionId,
    metadata: { subscriptionId, sessionsCreated }
  });

  revalidatePath('/creative-writing/booking/confirm');
  revalidatePath('/account/orders/creative-writing');
  revalidatePath('/account/subscriptions/course');
  revalidatePath('/dashboard/admin/bookings');
  revalidatePath('/dashboard/instructor/sessions');
  revalidatePath('/dashboard/student/sessions');

  return { success: true, sessionsCreated };
}


/**
 * تعيين مدرب لاشتراك وجلساته.
 *
 * محتاجة ليه: لو العميل ما اختارش مدرب في المعالج، الجلسات بتتعمل بلا
 * مدرب — ولوحة المدرب بتقرا الجلسات المربوطة بيه، فمحدش بيشوف الحجز.
 * وما كانش فيه أي طريقة في اللوحة تربط مدرب بعد كده.
 *
 * بتعدّل الاشتراك وجلساته مع بعض: تعيين على الاشتراك لوحده مش بيوصّل
 * الحجز للمدرب.
 */
export async function assignBookingInstructor(params: {
  subscriptionId: string;
  instructorId: string;
}): Promise<{ ok: true; sessions: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageBookings')) {
    return { ok: false, error: 'غير مصرح لك بتعديل الحجوزات' };
  }

  const supabase = await createClient();

  const { data: instructor } = await supabase
    .from('instructors')
    .select('id, display_name, user_id, status')
    .eq('id', params.instructorId)
    .maybeSingle();

  if (!instructor) return { ok: false, error: 'المدرب مش موجود' };
  if (instructor.status !== 'active') {
    return { ok: false, error: 'المدرب مش مفعّل' };
  }

  const { data: subRows, error: subError } = await supabase
    .from('course_subscriptions')
    .update({ preferred_instructor_id: params.instructorId })
    .eq('id', params.subscriptionId)
    .select('id');

  if (subError) {
    console.error('Error assigning instructor to subscription', subError);
    return { ok: false, error: `تعذّر التعيين: ${subError.message}` };
  }
  if (!subRows || subRows.length === 0) {
    return { ok: false, error: 'الاشتراك مش موجود — التعيين مروّحش للقاعدة.' };
  }

  // الجلسات اللي لسه ما تمّتش بس — الجلسة اللي خلصت بتفضل منسوبة لمدربها.
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .update({ instructor_id: params.instructorId })
    .eq('course_subscription_id', params.subscriptionId)
    .neq('status', 'completed')
    .select('id');

  if (sessionsError) {
    console.error('Error assigning instructor to sessions', sessionsError);
    return { ok: false, error: `الاشتراك اتعدّل بس الجلسات لأ: ${sessionsError.message}` };
  }

  await notifyUser({
    event: 'session_update',
    recipientProfileId: instructor.user_id,
    title: 'اتربطت بحجز جديد',
    message: `اتعيّنت مدرب على ${sessions?.length ?? 0} جلسة.`,
    link: '/dashboard/instructor/sessions',
  });

  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName || 'Admin',
    action: 'booking_instructor_assigned',
    entityType: 'CourseSubscription',
    entityId: params.subscriptionId,
    metadata: { instructorId: params.instructorId, sessions: sessions?.length ?? 0 },
  });

  revalidatePath(`/dashboard/admin/bookings/${params.subscriptionId}`);
  revalidatePath('/dashboard/instructor/sessions');
  return { ok: true, sessions: sessions?.length ?? 0 };
}
