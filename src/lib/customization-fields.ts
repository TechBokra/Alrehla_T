/**
 * خانات التخصيص اللي الإدارة بتتحكم فيها (ملف 06 — ملاحظة فريق العمل ٧).
 *
 * ── قرار تامر ───────────────────────────────────────────────
 *
 *   • **واحدة لكل المنتجات**: القصة المخصصة، تخصيص غلاف المكتبة، صندوق الرحلة
 *   • **نص قصير** بس
 *   • **خانات الأساس ثابتة** ومش هنا: اسم الطفل، تاريخ الميلاد، صورته —
 *     ومعاهم خانات القصة الحالية (الهدف، وصف البطل، الإهداء، العائلة)
 *
 * ── ليه الإجابة بتتحفظ ومعاها اسم الخانة ────────────────────
 *
 * الطلب بيتحفظ فيه `[{ id, label, value }]` مش `{ id: value }`. لو الإدارة
 * غيّرت اسم خانة أو مسحتها بعد الطلب، الطلب القديم بيفضل مقروء بالسؤال
 * اللي العميل جاوب عليه فعلًا — مش برقم مالوش معنى.
 *
 * ⚠️ الملف ده من غير React ولا قاعدة — عشان يتختبر، ويتستعمل في الشاشة
 *    واللوحة بنفس القواعد.
 */

export type CustomizationField = {
  id: string;
  label: string;
  placeholder?: string;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
};

/** إجابة محفوظة في الطلب — `customizationData.extraFields`. */
export type ExtraFieldAnswer = { id: string; label: string; value: string };

export const LABEL_MAX = 80;
export const PLACEHOLDER_MAX = 120;
export const ANSWER_MAX = 150;
/** سقف عدد الخانات — خطوة التخصيص مش استمارة حكومية. */
export const FIELDS_MAX = 15;

/**
 * اسم الخانة في النموذج.
 *
 * ⚠️ **بادئة `f_` مش زينة**: react-hook-form بيقرا المسار `extraFields.123`
 *    كـ«العنصر رقم 123 في مصفوفة» — فرقم بيبدأ بأرقام كان ممكن يحوّل
 *    الكائن لمصفوفة طولها مية وتلاتة وعشرين.
 */
export function answerKey(fieldId: string): string {
  return `f_${fieldId}`;
}

/** فحص خانة قبل الحفظ من اللوحة — نفس قيود القاعدة برسالة عربي. */
export function validateFieldInput(input: {
  label: unknown;
  placeholder?: unknown;
}): { ok: true; label: string; placeholder: string | null } | { ok: false; error: string } {
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  if (!label) return { ok: false, error: 'اكتب اسم الخانة زي ما هيظهر للعميل' };
  if (label.length > LABEL_MAX) return { ok: false, error: `اسم الخانة أطول من ${LABEL_MAX} حرف` };
  const placeholder = typeof input.placeholder === 'string' ? input.placeholder.trim() : '';
  if (placeholder.length > PLACEHOLDER_MAX) {
    return { ok: false, error: `المثال أطول من ${PLACEHOLDER_MAX} حرف` };
  }
  return { ok: true, label, placeholder: placeholder || null };
}

type Answers = Record<string, unknown> | undefined | null;

function answerOf(answers: Answers, fieldId: string): string {
  const v = answers?.[answerKey(fieldId)];
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * أول خانة إلزامية فاضية (أو إجابة طويلة) — رسالة جاهزة، أو `null`.
 *
 * ⚠️ الفحص ده في الشاشة وبس، زي خانات القصة الإلزامية اللي قبله: دالة
 *    الطلب في القاعدة بتحفظ بيانات التخصيص زي ما هي.
 */
export function checkExtraAnswers(fields: CustomizationField[], answers: Answers): string | null {
  for (const f of fields) {
    const value = answerOf(answers, f.id);
    if (f.isRequired && !value) return `${f.label}: الخانة دي مطلوبة`;
    if (value.length > ANSWER_MAX) return `${f.label}: أطول من ${ANSWER_MAX} حرف`;
  }
  return null;
}

/** الإجابات اللي هتتحفظ في الطلب — المتملّي بس، بالترتيب، ومعاه اسم الخانة. */
export function snapshotAnswers(fields: CustomizationField[], answers: Answers): ExtraFieldAnswer[] {
  return fields
    .map((f) => ({ id: f.id, label: f.label, value: answerOf(answers, f.id).slice(0, ANSWER_MAX) }))
    .filter((a) => a.value);
}

/** قراءة الإجابات من طلب محفوظ — أي شكل غريب بيتشال بدل ما يكسر الصفحة. */
export function readExtraAnswers(raw: unknown): { label: string; value: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { label: string; value: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { label, value } = item as Record<string, unknown>;
    if (typeof label !== 'string' || typeof value !== 'string') continue;
    if (!label.trim() || !value.trim()) continue;
    out.push({ label: label.trim(), value: value.trim() });
  }
  return out;
}

/** ترتيب جديد بعد سهم ↑ أو ↓ — `null` لو مفيش حركة (أول القايمة أو آخرها). */
export function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] | null {
  const target = index + direction;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return null;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
