/**
 * مراجعة ولي الأمر لصورة البطل — قرار تامر (٢٥ أكتوبر).
 *
 * «المراجعة بتكون للصورة فقط — التأخير في الاعتماد بيأخّر ميعاد
 *  التسليم».
 *
 * ── إزاي بتمشي ─────────────────────────────────────────────
 *
 *   ١. الفريق بيجهّز صورة البطل في مرحلة «الشخصية» ويبعتها
 *      (`story_image_send`) — صف في `story_image_reviews`.
 *   ٢. ولي الأمر بيشوفها في «طلباتي» ويوافق أو يطلب تعديل.
 *   ٣. موافقته = اعتماد مرجع الشخصية → المشاهد بتبدأ.
 *   ٤. **الوقت من الإرسال للقرار بيتضاف على ميعاد التسليم** —
 *      `waitDays` تحت، و`expectedReadyDate` في `delivery-days`.
 *
 * ⚠️ النص مابقاش بيتراجع من العميل. دوال معاينة النص القديمة لسه
 *    في القاعدة، بس الموقع مابيناديهاش.
 */

export const IMAGE_NOTE_MIN = 5;
export const IMAGE_NOTE_MAX = 500;

export type ImageReviewStatus = 'pending' | 'approved' | 'changes_requested';

export type ImageReviewRow = {
  projectId: string;
  orderItemId: string;
  productId: string;
  reviewId: string;
  imageUrl: string;
  staffNote: string | null;
  status: string;
  sentAt: string;
  decidedAt: string | null;
  clientNote: string | null;
  /** المرجع اتعتمد (من العميل أو الفريق). */
  characterApproved: boolean;
};

export type ImageReviewState =
  | { kind: 'awaiting'; title: string; text: string }
  | { kind: 'approved'; title: string; text: string }
  | { kind: 'changes'; title: string; text: string }
  | { kind: 'closed'; title: string; text: string };

/**
 * ⚠️ الحالة المجهولة = `closed` (من غير زرار): أهون من زرار على
 *    حاجة مش فاهمينها.
 */
export function imageReviewState(row: ImageReviewRow): ImageReviewState {
  if (row.status === 'pending' && !row.characterApproved) {
    return {
      kind: 'awaiting',
      title: 'محتاجين موافقتك',
      text: 'دي صورة البطل اللي هنرسم بيها القصة كلها. وافق عليها أو قول لنا نعدّل إيه — الرسم مابيبدأش قبل موافقتك.',
    };
  }
  if (row.status === 'approved' || (row.status === 'pending' && row.characterApproved)) {
    return {
      kind: 'approved',
      title: 'الصورة اتعتمدت',
      text: 'بدأنا نرسم صفحات القصة بالشكل ده.',
    };
  }
  if (row.status === 'changes_requested') {
    return {
      kind: 'changes',
      title: 'طلبت تعديل',
      text: 'ملاحظتك وصلت للرسّام، وهنبعتلك الصورة بعد التعديل.',
    };
  }
  return { kind: 'closed', title: 'صورة قديمة', text: 'فيه صورة أحدث — دوّر عليها فوق.' };
}

/** أحدث صورة لكل بند — القاعدة بترجّعهم من الأحدث للأقدم. */
export function latestImagePerItem(rows: ImageReviewRow[]): ImageReviewRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.orderItemId)) return false;
    seen.add(r.orderItemId);
    return true;
  });
}

export function awaitingImageCount(rows: ImageReviewRow[]): number {
  return latestImagePerItem(rows).filter((r) => imageReviewState(r).kind === 'awaiting').length;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * أيام انتظار قرار العميل على كل الصور — بتتضاف على ميعاد التسليم.
 *
 * ⚠️ **يوم بيتحسب لما يعدّي يوم كامل** (تقريب لتحت): قرار في نفس
 *    اليوم مابيأخرش الميعاد. وصورة لسه مستنية بتتحسب لحد دلوقتي.
 */
export function waitDays(rows: Pick<ImageReviewRow, 'sentAt' | 'decidedAt' | 'status'>[], now = new Date()): number {
  let ms = 0;
  for (const r of rows) {
    if (r.status === 'withdrawn') continue;
    const start = Date.parse(r.sentAt);
    const end = r.decidedAt ? Date.parse(r.decidedAt) : now.getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) ms += end - start;
  }
  return Math.floor(ms / DAY_MS);
}

/** ملاحظة طلب التعديل مقبولة؟ `null` = تمام. */
export function imageNoteProblem(note: string): string | null {
  const t = note.trim();
  if (!t) return 'اكتب عايز نعدّل إيه في الصورة.';
  if (t.length < IMAGE_NOTE_MIN) return 'الملاحظة قصيرة أوي — قول لنا بالظبط إيه اللي يتغيّر.';
  if (t.length > IMAGE_NOTE_MAX) {
    return `الملاحظة أطول من ${IMAGE_NOTE_MAX.toLocaleString('ar-EG')} حرف — اختصرها شوية.`;
  }
  return null;
}
