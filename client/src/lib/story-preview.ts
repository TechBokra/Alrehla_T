/**
 * معاينة النص وموافقة ولي الأمر — المنطق والأسماء.
 *
 * ── البند الأكبر في دراسة المقارنة ──────────────────────────
 *
 * ولي الأمر بيدفع ٨٥٠ جنيه وبعدها مش شايف حاجة لحد ما الكتاب
 * يوصل مطبوع. والمنافس بيوريه النص قبل الطباعة — ودي الحاجة
 * اللي بتخلّي الواحد يدفع وهو مطمّن.
 *
 * ── واللي لقيته وأنا بقرا الموديل ───────────────────────────
 *
 * ⚠️ **خط الإنتاج كان مستني موافقة العميل فعلًا — والعميل مش
 *    عارف.** مرحلة «موافقة العميل على النص» موجودة في
 *    `task_steps`، وبوابة `text_client_approved` بتمنع بدء
 *    الرسم من غيرها، و`story_versions` فيها `client_approved`
 *    و`client_decision_at`.
 *
 *    بس صلاحيات `story_versions` للقراءة كانت `story_studio_access()`
 *    وبس — فولي الأمر **ماعندهوش ولا صف**. والحارس كان بيقول
 *    «اعتماد النص للمحرّر أو مسؤول الإنتاج» — فهو **ممنوع
 *    يوافق على نصّه**.
 *
 *    يعني «موافقة العميل» كانت علامة الفريق بيحطّها بالنيابة.
 *    الملف ده ومعاه `20261018150000` بيحوّلوها لقرار بياخده هو.
 *
 * ⚠️ **ومفيش حالة طلب جديدة في القاعدة.** حالة «مستني موافقتك»
 *    بتتشتق من المشروع والنسخة (`previewState` تحت) مش من
 *    `orders.status` — عشان `order_status_enum` بيتفرّع عليه
 *    ويبهوك الدفع وتلات شاشات، وقيمة جديدة فيه بتسيب حالة خام
 *    إنجليزي في أي `switch` حد ينساه. واللي بيقفل الرسم هو
 *    البوابة في القاعدة، مش اسم الحالة.
 */

/** الحد الأقصى لملاحظة التعديل — نفس `left(..., 500)` في القاعدة. */
export const PREVIEW_NOTE_MAX = 500;

/** أقل من كده مش وصف لتعديل. */
export const PREVIEW_NOTE_MIN = 10;

export type PreviewRow = {
  projectId: string;
  orderItemId: string;
  productId: string;
  projectStatus: string;
  versionId: string;
  versionNo: number;
  body: string;
  versionStatus: string;
  sentAt: string;
  decisionAt: string | null;
  decisionNote: string | null;
  decidedByMe: boolean;
};

export type PreviewState =
  /** مستني قراره — ودي الحالة الوحيدة اللي فيها زرار. */
  | { kind: 'awaiting'; title: string; text: string }
  /** وافق. */
  | { kind: 'approved'; title: string; text: string }
  /** طلب تعديل، والفريق شغّال عليه. */
  | { kind: 'changes'; title: string; text: string }
  /** اتبعتت بس اتستبدلت بنسخة أحدث. */
  | { kind: 'superseded'; title: string; text: string };

/**
 * حالة المعاينة زي ما ولي الأمر يفهمها.
 *
 * ⚠️ **الحالة المجهولة بتترجّع `superseded` مش `awaiting`**: لو
 *    القاعدة فيها قيمة إحنا مانعرفهاش، أهون إننا مانعرضش زرار
 *    قرار من إننا نعرض زرار على حاجة إحنا مش فاهمينها.
 */
export function previewState(row: PreviewRow): PreviewState {
  switch (row.versionStatus) {
    case 'editor_approved':
      return {
        kind: 'awaiting',
        title: 'محتاجين موافقتك',
        text: 'اقرا النص وقول لنا: نكمّل كده ونبدأ الرسم، ولا فيه حاجة تتعدّل؟ الرسم مابيبدأش قبل موافقتك.',
      };
    case 'client_approved':
      return {
        kind: 'approved',
        title: 'وافقت على النص',
        text: 'الرسم بدأ. هنبعتلك تحديث أول ما الصفحات تجهز.',
      };
    case 'changes_requested':
      return {
        kind: 'changes',
        title: 'طلبت تعديل',
        text: 'ملاحظتك وصلت للمحرّر، وهو بيظبّط النص. هنبعتلك النسخة الجديدة تعاينها.',
      };
    default:
      return {
        kind: 'superseded',
        title: 'نسخة قديمة',
        text: 'فيه نسخة أحدث من النص — دوّر عليها فوق.',
      };
  }
}

/**
 * هل فيه معاينة واحدة على الأقل مستنية قراره؟
 *
 * بتستعملها قايمة الطلبات عشان تحطّ سطرًا عاليًا: الطلب بيقول
 * «قيد التجهيز» وهو في الحقيقة مستني **هو**.
 */
export function awaitingCount(rows: PreviewRow[]): number {
  return rows.filter((r) => r.versionStatus === 'editor_approved').length;
}

/**
 * أحدث نسخة لكل بند في الطلب.
 *
 * ⚠️ القاعدة بترجّع كل النسخ المبعوتة مرتّبة تنازليًا، وولي
 *    الأمر مايهمّوش يشوف تاريخ النسخ — يهمّه النسخة اللي قراره
 *    عليها. والقديمة بتفضل متاحة لو دوّر (مش بنحجبها، بس مش
 *    بنحطّها قصاده).
 */
export function latestPerItem(rows: PreviewRow[]): PreviewRow[] {
  const seen = new Set<string>();
  const out: PreviewRow[] = [];
  for (const r of rows) {
    if (seen.has(r.orderItemId)) continue;
    seen.add(r.orderItemId);
    out.push(r);
  }
  return out;
}

/** ملاحظة التعديل مقبولة؟ `null` = تمام. */
export function noteProblem(note: string): string | null {
  const t = note.trim();
  if (!t) return 'اكتب عايز نعدّل إيه — من غير كده المحرّر مش هيعرف يبدأ من فين.';
  if (t.length < PREVIEW_NOTE_MIN) {
    return 'الملاحظة قصيرة أوي — قول لنا بالظبط الحاجة اللي مش عاجبتك.';
  }
  if (t.length > PREVIEW_NOTE_MAX) {
    return `الملاحظة أطول من ${PREVIEW_NOTE_MAX.toLocaleString('ar-EG')} حرف — اختصرها شوية.`;
  }
  return null;
}

/** تقسيم النص لفقرات للعرض — النص بيتخزّن بأسطر جديدة. */
export function paragraphsOf(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
