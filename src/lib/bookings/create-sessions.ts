import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { WeeklySlot } from '@/types';
import { buildSessionSchedule } from '@/lib/session-schedule';
import { createSessionRoom, isDailyConfigured } from '@/lib/daily';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';

/**
 * ⚠️ **اتنقلت من `actions/bookings.ts` ومالهاش علاقة بالمكان الجديد
 *    من ناحية المنطق — اتنقلت عشان حد تاني يقدر يناديها.**
 *
 *    تأكيد الدفع اليدوي في اللوحة هو اللي كان بيولّد الجلسات، والدالة
 *    كانت مخفية جوّه ملف `'use server'`. ولما بوابة الدفع اتربطت
 *    بالحجوزات، الويبهوك بقى محتاج **نفس** التوليد ده: من غيره العميل
 *    بيدفع بالبطاقة، والحجز بيبقى «نشط»، **ومايلاقيش ولا جلسة** في
 *    لوحته — ولا هو ولا المدرب.
 *
 *    وهي بتاخد عميل القاعدة كمعامل، فبتشتغل بحساب الإداري أو بمفتاح
 *    الخدمة من الويبهوك من غير فرق.
 */

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
export async function createSessionsForSubscription(
  supabase: SupabaseClient<Database>,
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
