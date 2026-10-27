/**
 * طلب انضمام محتاج مننا حاجة ولا لأ؟ — طلب تامر (٢٧ أكتوبر).
 *
 * «يبقى ظاهر لنا فقط الحاجات اللي لسه لم يتم إنجازها، أو وصل فيها رد
 *  جديد، أو تأخر الرد عليها».
 *
 *   new      مفيش ولا رسالة مننا        → محتاج تصرّف
 *   replied  آخر رسالة من المتقدّم       → رد جديد، محتاج تصرّف
 *   waiting  آخر رسالة مننا، من قريب    → مستنيين المتقدّم (مابيظهرش في المهام)
 *   stale    آخر رسالة مننا، من بدري    → المتقدّم اتأخر، محتاج متابعة
 *   closed   اتقبل أو اترفض
 *
 * و`late` = إحنا اللي متأخرين في الرد (new/replied عدّى عليهم يومين).
 */

export type FollowUpKind = 'new' | 'replied' | 'waiting' | 'stale' | 'closed';

export const OUR_REPLY_DAYS = 2;
export const APPLICANT_REPLY_DAYS = 3;

export type FollowUp = {
  kind: FollowUpKind;
  needsAction: boolean;
  late: boolean;
  label: string;
  /** من إمتى الحالة دي (أيام). */
  days: number;
};

const DAY = 86_400_000;

export function joinFollowUp(
  req: { status: string; createdAt: string },
  last: { author: 'admin' | 'applicant'; createdAt: string } | null,
  now = Date.now(),
): FollowUp {
  if (req.status !== 'pending') {
    return { kind: 'closed', needsAction: false, late: false, label: req.status === 'approved' ? 'مقبول' : 'مرفوض', days: 0 };
  }
  const since = (iso: string) => Math.max(0, Math.floor((now - Date.parse(iso)) / DAY));

  if (!last) {
    const days = since(req.createdAt);
    const late = days >= OUR_REPLY_DAYS;
    return { kind: 'new', needsAction: true, late, label: late ? `جديد — من ${days} يوم من غير رد` : 'جديد', days };
  }
  const days = since(last.createdAt);
  if (last.author === 'applicant') {
    const late = days >= OUR_REPLY_DAYS;
    return { kind: 'replied', needsAction: true, late, label: late ? `رد جديد من ${days} يوم` : 'رد جديد', days };
  }
  if (days >= APPLICANT_REPLY_DAYS) {
    return { kind: 'stale', needsAction: true, late: false, label: `مارد علينا من ${days} يوم — تابع معاه`, days };
  }
  return { kind: 'waiting', needsAction: false, late: false, label: 'مستنيين رده', days };
}

/** آخر رسالة لكل طلب من قايمة رسايل مرتّبة بأي ترتيب. */
export function lastMessages(
  rows: { request_id: string; author: string; created_at: string }[],
): Map<string, { author: 'admin' | 'applicant'; createdAt: string }> {
  const out = new Map<string, { author: 'admin' | 'applicant'; createdAt: string }>();
  for (const r of rows) {
    const prev = out.get(r.request_id);
    if (!prev || Date.parse(r.created_at) > Date.parse(prev.createdAt)) {
      out.set(r.request_id, { author: r.author === 'admin' ? 'admin' : 'applicant', createdAt: r.created_at });
    }
  }
  return out;
}
