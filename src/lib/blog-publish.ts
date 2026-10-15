/**
 * حالة نشر المقال: منشور / مجدول / مسودة.
 *
 * ── المشكلة اللي كانت موجودة ───────────────────────────────
 *
 * «المسودة» كانت مجرد مقال تاريخه **بعد سنة** من النهارده — وده كان الحل
 * الوحيد لإخفاء مقال. فلما نحتاج «جدولة» (تاريخ في المستقبل القريب)
 * بتتلخبط مع «المسودة». وكمان خانة «مقال منشور» كانت بتبدأ **مقفولة**
 * للمقال الجديد، فاللي ما يعلّمش عليها كان بيحفظ مسودة من غير ما يدري
 * ويفتكر إن المقال «مابيظهرش».
 *
 * دلوقتي: عمود `is_draft` للمسودة، و`published_at` للموعد. المقال بيظهر
 * للزوار لما `is_draft = false` **و** `published_at <= الآن` — والقاعدة
 * دي مفروضة في القاعدة (RLS) مش في الواجهة بس.
 */

export type PublishMode = 'published' | 'scheduled' | 'draft';

export const PUBLISH_MODE_LABELS: Record<PublishMode, string> = {
  published: 'منشور',
  scheduled: 'مجدول',
  draft: 'مسودة',
};

export function isPublishMode(value: unknown): value is PublishMode {
  return value === 'published' || value === 'scheduled' || value === 'draft';
}

/** حالة مقال محفوظ بالنسبة للوقت `now`. */
export function postStatus(
  post: { isDraft?: boolean | null; publishedAt: string },
  now: Date,
): PublishMode {
  if (post.isDraft) return 'draft';
  const t = Date.parse(post.publishedAt);
  return Number.isFinite(t) && t > now.getTime() ? 'scheduled' : 'published';
}

export type PublishDecision =
  | { ok: true; isDraft: boolean; publishedAt: string }
  | { ok: false; error: string; field: 'scheduledAt' };

export const SCHEDULE_REQUIRED = 'اختر تاريخ ووقت النشر';
export const SCHEDULE_IN_PAST = 'موعد النشر لازم يكون في المستقبل';

/**
 * يقرر `is_draft` و`published_at` اللي هتتحفظ.
 *
 * - **منشور**: لو المقال منشور فعلًا بنسيب تاريخه زي ما هو (تعديل مقال
 *   قديم ما يخلّيهوش «جديد»)، غير كده بيتنشر دلوقتي.
 * - **مجدول**: لازم موعد في المستقبل.
 * - **مسودة**: بنسيب التاريخ زي ما هو (مالوش أثر لحد ما تتنشر).
 */
export function resolvePublishing(input: {
  mode: PublishMode;
  /** الموعد بصيغة ISO (اتحوّل من توقيع القاهرة قبل كده) أو `null` لو فاضي/غلط. */
  scheduledAtIso: string | null;
  existing: { isDraft: boolean; publishedAt: string } | null;
  now: Date;
}): PublishDecision {
  const { mode, scheduledAtIso, existing, now } = input;
  const nowIso = now.toISOString();

  if (mode === 'draft') {
    return { ok: true, isDraft: true, publishedAt: existing?.publishedAt ?? nowIso };
  }

  if (mode === 'scheduled') {
    if (!scheduledAtIso) return { ok: false, error: SCHEDULE_REQUIRED, field: 'scheduledAt' };
    const t = Date.parse(scheduledAtIso);
    if (!Number.isFinite(t)) return { ok: false, error: SCHEDULE_REQUIRED, field: 'scheduledAt' };
    if (t <= now.getTime()) return { ok: false, error: SCHEDULE_IN_PAST, field: 'scheduledAt' };
    return { ok: true, isDraft: false, publishedAt: new Date(t).toISOString() };
  }

  if (existing && postStatus(existing, now) === 'published') {
    return { ok: true, isDraft: false, publishedAt: existing.publishedAt };
  }
  return { ok: true, isDraft: false, publishedAt: nowIso };
}
