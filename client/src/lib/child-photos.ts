/**
 * صور الأطفال في الطلبات المخصصة — **إيه اللي ينفع يتمسح، بلا قاعدة ولا شاشة**.
 *
 * ── المشكلة ─────────────────────────────────────────────────
 *
 * ولي الأمر بيرفع صورة ابنه عشان ترتسم في القصة. الصورة بتتخزّن في
 * مجلّد خاص على Cloudinary، ورقمها بيتحفظ جوّه بيانات عنصر الطلب.
 *
 * **ومافيش حاجة في المشروع كانت بتمسحها.** فيه مهمة يومية
 * (`api/cron/private-files`) بس بتمسح اللي **مسجّل في جدول
 * `private_files`** — وصور التخصيص دي مش مسجّلة فيه، فهي برّه
 * المهمة تمامًا. يعني صورة طفل بتفضل على السيرفر للأبد.
 *
 * ── الفخ اللي لازم ينتبه له ─────────────────────────────────
 *
 * ⚠️ **الصورة الواحدة ممكن تكون مربوطة بأكتر من عنصر طلب.** بالقياس
 *    على القاعدة وقت كتابة الملف: ٢٢ عنصر طلب و**١٣ صورة** بس —
 *    يعني ولي أمر بيعيد الطلب بنفس الصورة. فمسح الصورة بناءً على
 *    طلب واحد خلص **بيكسر طلبًا تاني لسه شغّال**.
 *
 *    القاعدة هنا: الصورة بتتمسح بس لو **كل** العناصر اللي بتشاور
 *    عليها خلصت مدتها.
 *
 * ⚠️ **والطلب اللي لسه بيتنفّذ مابيتلمسش.** الاستوديو محتاج الصورة
 *    عشان يرسم. فالمدة بتبدأ من **انتهاء** الطلب لا من رفع الصورة.
 */

/** الخانات اللي بتحمل صورًا في بيانات التخصيص. */
export const CHILD_PHOTO_FIELDS = ['childPhoto', 'secondPhoto', 'coverPhoto'] as const;
export type ChildPhotoField = (typeof CHILD_PHOTO_FIELDS)[number];

/**
 * المجلّدات اللي بنمسح منها — **وبس**.
 *
 * ⚠️ **`alrehla/private/receipts/` مش هنا، وممنوع يدخل.** المجلّد
 *    الخاص فيه تلاتة: `children/` (صور الأطفال) و`covers/` (صور
 *    الأغلفة) و`receipts/` (إيصالات الدفع). والإيصال **سجل مالي**
 *    بيتراجع في المحاسبة والمنازعات — مسحه بعد أسبوع كارثة حسابية.
 *
 * ⚠️ وعشان كده الشرط على **المجلّد الكامل** لا على `private/`
 *    وحدها: رقم إيصال وصل بالغلط لخانة صورة مابيعدّيش.
 */
export const CHILD_PHOTO_PREFIXES = [
  'alrehla/private/children/',
  'alrehla/private/covers/',
] as const;

export function isChildPhotoId(publicId: unknown): publicId is string {
  return (
    typeof publicId === 'string' &&
    !publicId.includes('..') &&
    CHILD_PHOTO_PREFIXES.some((p) => publicId.startsWith(p))
  );
}

export const DEFAULT_CHILD_PHOTO_RETENTION_DAYS = 7;
export const MIN_CHILD_PHOTO_RETENTION_DAYS = 1;
export const MAX_CHILD_PHOTO_RETENTION_DAYS = 90;

/** الطلب المتروك: رُفعت صورة ومااكتملش الدفع. */
export const ABANDONED_ORDER_DAYS = 30;

/** أقصى عدد صور في التشغيلة الواحدة — نفس أسلوب باقي المهام. */
export const MAX_PHOTO_DELETES_PER_RUN = 100;

export function normalizeChildPhotoDays(raw: unknown): number {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_CHILD_PHOTO_RETENTION_DAYS;
  if (n < MIN_CHILD_PHOTO_RETENTION_DAYS) return DEFAULT_CHILD_PHOTO_RETENTION_DAYS;
  if (n > MAX_CHILD_PHOTO_RETENTION_DAYS) return MAX_CHILD_PHOTO_RETENTION_DAYS;
  return n;
}

/**
 * حالات الطلب.
 *
 * ⚠️ **`paid` و`preparing` و`shipped` مش هنا عن قصد** — دي طلبات
 *    شغّالة، والصورة مطلوبة للرسم والطباعة.
 */
const FINISHED = new Set(['delivered', 'cancelled', 'refunded']);
const UNPAID = new Set(['pending', 'awaiting_verification', 'failed']);

export type OrderPhotoRow = {
  itemId: string;
  orderId: string;
  status: string;
  /** تواريخ الطلب — بنختار أنسبها للنهاية. */
  createdAt: string | null;
  updatedAt: string | null;
  deliveredAt: string | null;
  electronicSentAt: string | null;
  /** الخانة ← رقم الصورة على Cloudinary. */
  photos: Partial<Record<ChildPhotoField, string>>;
};

function time(value: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * تاريخ «خلاص الطلب» — واللي المدة بتتحسب منه.
 *
 * ⚠️ **بياخد الأحدث**: طلب اتسلّم إلكتروني ثم اتشحن ورق، التاريخ
 *    الأحدث هو اللي ولي الأمر شايفه نهاية فعلية.
 */
export function finishedAt(row: OrderPhotoRow): number | null {
  const candidates = [time(row.deliveredAt), time(row.electronicSentAt), time(row.updatedAt)];
  const known = candidates.filter((t): t is number => t !== null);
  return known.length ? Math.max(...known) : null;
}

export type EligibilityReason = 'finished' | 'abandoned' | null;

/**
 * العنصر ده خلصت مدته؟ وبأي سبب؟
 *
 * ⚠️ **التاريخ الناقص = مش مؤهّل.** طلب مالوش تاريخ معروف
 *    مابنمسحلوش حاجة: صورة بتفضل أهون من صورة بتتمسح بالغلط.
 */
export function itemEligibility(
  row: OrderPhotoRow,
  now: Date,
  retentionDays: number,
  abandonedDays: number = ABANDONED_ORDER_DAYS,
): EligibilityReason {
  const at = now.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (FINISHED.has(row.status)) {
    const done = finishedAt(row);
    if (done === null) return null;
    return at - done >= retentionDays * day ? 'finished' : null;
  }

  if (UNPAID.has(row.status)) {
    const created = time(row.createdAt);
    if (created === null) return null;
    return at - created >= abandonedDays * day ? 'abandoned' : null;
  }

  // شغّال (paid/preparing/shipped) — الصورة مطلوبة.
  return null;
}

export type SweepPlan = {
  /** أرقام الصور اللي ينفع تتمسح من Cloudinary. */
  publicIds: string[];
  /** العناصر اللي خاناتها هتتفضى، وسبب كل واحد. */
  items: { itemId: string; fields: ChildPhotoField[]; reason: Exclude<EligibilityReason, null> }[];
  /** صور اتأجّلت لأن طلبًا تانيًا لسه محتاجها (للتسجيل). */
  heldBack: string[];
};

/**
 * الخطة: إيه اللي يتمسح وإيه اللي يستنى.
 *
 * ⚠️ **بترجّع خطة، مابتمسحش.** الفصل ده هو اللي بيخلّي القرار
 *    قابلًا للاختبار من غير Cloudinary ولا قاعدة — والمسح الحقيقي
 *    بينفّذ الخطة وبس.
 */
export function planChildPhotoSweep(
  rows: OrderPhotoRow[],
  now: Date,
  retentionDays: number,
  options: { max?: number; abandonedDays?: number } = {},
): SweepPlan {
  const max = options.max ?? MAX_PHOTO_DELETES_PER_RUN;
  const abandonedDays = options.abandonedDays ?? ABANDONED_ORDER_DAYS;

  // رقم الصورة ← هل كل العناصر اللي بتشاور عليه مؤهّلة؟
  const blocked = new Set<string>();
  const eligibleIds = new Set<string>();
  const perItem: SweepPlan['items'] = [];

  for (const row of rows) {
    const reason = itemEligibility(row, now, retentionDays, abandonedDays);
    const ids = CHILD_PHOTO_FIELDS.map((f) => row.photos[f]).filter(isChildPhotoId);
    if (ids.length === 0) continue;

    if (reason === null) {
      // ⚠️ عنصر لسه محتاج صوره = قفل على الصور دي كلها.
      for (const id of ids) blocked.add(id);
      continue;
    }

    for (const id of ids) eligibleIds.add(id);
    perItem.push({
      itemId: row.itemId,
      fields: CHILD_PHOTO_FIELDS.filter((f) => isChildPhotoId(row.photos[f])),
      reason,
    });
  }

  const deletable: string[] = [];
  const heldBack: string[] = [];
  for (const id of eligibleIds) {
    if (blocked.has(id)) heldBack.push(id);
    else deletable.push(id);
  }

  // ⚠️ العناصر اللي **كل** صورها متأجّلة مابنفضّيهاش: لو فضّيناها
  //    والصورة لسه موجودة، الطلب يفقد الرابط والصورة تفضل على
  //    السيرفر — أسوأ الاحتمالين.
  const items = perItem.filter((it) =>
    it.fields.some((f) => {
      const row = rows.find((r) => r.itemId === it.itemId);
      const id = row?.photos[f];
      return typeof id === 'string' && deletable.includes(id);
    }),
  );

  return { publicIds: deletable.slice(0, max), items, heldBack };
}
