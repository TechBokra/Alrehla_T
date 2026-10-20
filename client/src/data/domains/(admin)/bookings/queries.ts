import { createClient } from '@/lib/supabase/server';
import { getParticipantNames, participantKey } from '@/data/domains/(shared)/participants/queries';
import type { AdminCourseBooking } from '@/data/domains/(admin)/bookings/types';

/**
 * حجوزات الكتابة للإدارة.
 *
 * شاشة الحجوزات كانت مبنية على جدول **الجلسات**، وبتطابقها بطلبات
 * الخدمات بنفس الرقم («نفترض تطابق 1:1» زي ما كان مكتوب في الكود).
 * ولما وقفنا إنشاء الجلسة التلقائية بتاريخ مخترع، الحجز الجديد مكانش
 * هيظهر في أي شاشة.
 *
 * الحجز = صف في `course_subscriptions`. والجلسات بتتجدول بعد تأكيد الدفع.
 */
export async function getCourseBookingsForAdmin(): Promise<AdminCourseBooking[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('course_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) return [];

  const packageIds = [...new Set(data.map((r) => r.package_id).filter(Boolean))];
  const instructorIds = [
    ...new Set(data.map((r) => r.preferred_instructor_id).filter(Boolean)),
  ] as string[];

  const [{ data: packages }, { data: instructors }, { data: sessions }] = await Promise.all([
    supabase.from('creative_writing_packages').select('id, name').in('id', packageIds),
    instructorIds.length
      ? supabase.from('instructors').select('id, display_name').in('id', instructorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    supabase.from('sessions').select('id, course_subscription_id'),
  ]);

  const packageName = new Map((packages ?? []).map((p) => [p.id, p.name]));
  const instructorName = new Map((instructors ?? []).map((i) => [i.id, i.display_name]));

  // ⚠️ كان `await getParticipantName(...)` **جوّه اللفّة** — استعلامين
  //    متسلسلين لكل حجز. بقى استعلامين للكل.
  const names = await getParticipantNames(
    data.map((row) => ({ dependentId: row.child_id ?? undefined, independentId: row.user_id })),
  );

  const rows: AdminCourseBooking[] = [];
  for (const row of data) {
    rows.push({
      id: row.id,
      participantName:
        names.get(participantKey(row.child_id ?? undefined, row.user_id)) ??
        'مشارك غير معروف',
      packageName: packageName.get(row.package_id) ?? 'باقة محذوفة',
      amount: row.amount ?? null,
      status: row.status,
      paymentReference: row.payment_reference ?? null,
      paymentMethod: row.payment_method ?? null,
      paymentReceiptUrl: row.payment_receipt_url ?? null,
      preferredInstructorId: row.preferred_instructor_id ?? null,
      preferredInstructorName: row.preferred_instructor_id
        ? (instructorName.get(row.preferred_instructor_id) ?? null)
        : null,
      createdAt: row.created_at,
      startedAt: row.started_at ?? null,
      sessionsCount: (sessions ?? []).filter((x) => x.course_subscription_id === row.id).length,
      giftMessage: row.gift_message ?? null,
      recordingConsentAt: row.recording_consent_at ?? null,
    });
  }

  return rows;
}
