import {
  deleteRecording,
  expiredRecordings,
  listRecordings,
  type DailyRecording,
} from '@/lib/daily';

export type PurgeResult = {
  /** عدد التسجيلات اللي اتقريت من Daily. */
  scanned: number;
  /** أرقام اللي اتحذفت فعلًا — **بأرقامها لا بعددها**. */
  deleted: string[];
  /** الغرف بتاعتهم، عشان السجل يبقى مقروء لإنسان. */
  rooms: string[];
  /** اللي Daily رفض حذفه. بيتحاول تاني بكرة. */
  failed: number;
};

/**
 * حذف التسجيلات اللي عدّت مدة الاحتفاظ.
 *
 * ── الوعد اللي الدالة دي بتنفّذه ────────────────────────────
 *
 * صفحة السياسات وشاشة الحجز بيقولوا لولي الأمر إن الجلسة بتتسجّل
 * وإن التسجيل بيتمسح بعد مدة. **الدالة دي هي «بيتمسح».** من غيرها
 * الجملة دي وعد مكسور، والتسجيل فيه ابنه بيفضل مخزَّنًا للأبد.
 *
 * ── الحوارس ─────────────────────────────────────────────────
 *
 * الحذف عند Daily **مالوش تراجع**، والدالة دي بتشتغل من مهمة يومية
 * **محدّش بيبصّ عليها**. فالاختيار كله في `expiredRecordings`،
 * واختباراته بتتأكّد من اللي **مابيتحذفش** أكتر من اللي بيتحذف:
 * برّه بادئة غرف الجلسات · بلا تاريخ · لسه بيتسجّل · مدة صفر.
 *
 * ⚠️ **والسقف هنا مش تحسينًا للسرعة.** تشغيل بيحذف مئات مرة واحدة
 *    هو نفسه شكل الكارثة لو الاختيار غلط. بنمشي بالتدريج والمهمة
 *    بتشتغل كل يوم.
 */
export async function purgeExpiredRecordings(params: {
  retentionDays: number;
  max?: number;
  now?: number;
}): Promise<{ ok: true; data: PurgeResult } | { ok: false; error: string }> {
  const { retentionDays, max = 50, now = Date.now() } = params;

  // ⚠️ مدة غير صالحة = **مانعملش حاجة**. القاطع اللي بيتحسب من صفر
  //    بيساوي «دلوقتي»، يعني كل التسجيلات تبقى منتهية في تشغيل واحد.
  if (!(retentionDays > 0)) {
    return { ok: false, error: 'مدة الاحتفاظ مش مضبوطة — مفيش حذف.' };
  }

  // بنقرا أوسع من السقف: اللي مابيتقريش مابيتحذفش، فيفضل مخزَّنًا
  // للأبد من غير ما حد يعرف.
  const listed = await listRecordings(500);
  if (!listed.ok) return { ok: false, error: listed.error };

  const due: DailyRecording[] = expiredRecordings(listed.data, retentionDays, now).slice(
    0,
    max,
  );

  const deleted: string[] = [];
  const rooms: string[] = [];
  let failed = 0;

  for (const recording of due) {
    const result = await deleteRecording(recording.id);
    if (result.ok) {
      deleted.push(recording.id);
      rooms.push(recording.roomName);
    } else {
      // فشل واحد مايوقفش الباقي — والمهمة بتشتغل تاني بكرة.
      console.error('Recording purge failed', recording.id, result.error);
      failed += 1;
    }
  }

  return { ok: true, data: { scanned: listed.data.length, deleted, rooms, failed } };
}
