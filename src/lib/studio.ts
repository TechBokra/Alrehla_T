/**
 * استوديو القصص — الثوابت والتسميات (من غير سير العمل).
 *
 * المراحل والانتقالات والشروط بقت **بيانات** في القاعدة (`task_steps` و`task_edges`)،
 * ومرآتها وحساباتها في `studio-flow.ts`. الحارس الحقيقي محفّز `story_project_guard`.
 *
 * ملف خفيف بلا تبعيات: الاستوديو كله تحت لوحة الإدارة، ومفيش منه بايت
 * بيوصل للموقع العام.
 */

export type StudioTone = 'success' | 'warning' | 'danger' | 'pending' | 'info' | 'neutral';

// ── فحص الجودة ─────────────────────────────────────────────────────────────

export const QA_ITEMS = [
  { key: 'story_engaging', label: 'القصة ممتعة وبتشدّ الطفل' },
  { key: 'dialogue_age_fit', label: 'الحوار والمفردات مناسبة للعمر' },
  { key: 'art_matches_text', label: 'الرسم مطابق للنص' },
  { key: 'hero_consistent', label: 'شكل البطل ثابت في كل الصفحات' },
  { key: 'arabic_text_ok', label: 'النص العربي سليم (إملاء وتشكيل وتنسيق)' },
  { key: 'print_ready', label: 'الملف جاهز للطباعة' },
] as const;

export const QA_SENSITIVE_ITEM = {
  key: 'sensitive_review',
  label: 'مراجعة متخصص للموضوع الحساس',
} as const;

export type QaKey = (typeof QA_ITEMS)[number]['key'] | typeof QA_SENSITIVE_ITEM.key;

/** البنود المطلوبة لمشروع (البند الحسّاس بيتضاف لو الموضوع حسّاس). */
export function qaItemsFor(sensitive: boolean): { key: QaKey; label: string }[] {
  return sensitive ? [...QA_ITEMS, QA_SENSITIVE_ITEM] : [...QA_ITEMS];
}

export function qaMissing(checklist: unknown, sensitive: boolean): QaKey[] {
  const c = (checklist && typeof checklist === 'object' ? checklist : {}) as Record<string, unknown>;
  return qaItemsFor(sensitive)
    .filter((i) => c[i.key] !== true)
    .map((i) => i.key);
}

// ── تسميات ثانوية ──────────────────────────────────────────────────────────

export const FACE_MODE_LABELS = {
  cartoon: 'كرتوني مستوحى (بدون صورة حقيقية)',
  real: 'وجه حقيقي (يحتاج موافقة ولي الأمر)',
} as const;

export type FaceMode = keyof typeof FACE_MODE_LABELS;

export const PAGE_STATUS_LABELS = {
  pending: 'منتظرة',
  drafted: 'مجهّزة',
  approved: 'معتمدة',
  needs_redo: 'تحتاج إعادة',
} as const;

export type PageStatus = keyof typeof PAGE_STATUS_LABELS;

export const PAGE_STATUS_TONES: Record<PageStatus, StudioTone> = {
  pending: 'pending',
  drafted: 'info',
  approved: 'success',
  needs_redo: 'danger',
};

export const VERSION_STATUS_LABELS = {
  draft: 'مسودة',
  editor_approved: 'معتمدة من المحرّر',
  client_approved: 'معتمدة من العميل',
  changes_requested: 'مطلوب تعديل',
  superseded: 'مستبدلة',
} as const;

export type VersionStatus = keyof typeof VERSION_STATUS_LABELS;

export const VERSION_STATUS_TONES: Record<VersionStatus, StudioTone> = {
  draft: 'pending',
  editor_approved: 'info',
  client_approved: 'success',
  changes_requested: 'warning',
  superseded: 'neutral',
};

export const VERSION_SOURCE_LABELS = { ai: 'مسودة ذكاء اصطناعي (راجعها المحرّر)', editor: 'كتبها المحرّر' } as const;

export const COST_KIND_LABELS = {
  tool: 'أدوات وتوليد',
  human: 'وقت بشري',
  print: 'طباعة',
  shipping: 'شحن',
  other: 'أخرى',
} as const;

export type CostKind = keyof typeof COST_KIND_LABELS;

export const COST_KINDS = Object.keys(COST_KIND_LABELS) as CostKind[];

export const PAGE_TARGET_MIN = 4;
export const PAGE_TARGET_MAX = 64;
export const MAX_PAGE_NO = 99;

// ── تحقّقات ────────────────────────────────────────────────────────────────

/** رابط https بلا مسافات وأقصاه 500 حرف — نفس شرط القاعدة. */
export function isHttpsUrl(v: string): boolean {
  return v.length <= 500 && /^https:\/\/[^\s]+$/.test(v);
}

export function isUuid(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

/**
 * ترجمة أخطاء القاعدة لرسالة للمستخدم. رسائل المحفّزات عربي أصلًا فبنرجّعها
 * زي ما هي؛ أخطاء الصلاحيات والقيود بتتحوّل لعبارة مفهومة.
 */
export function studioErrorMessage(err: { code?: string | null; message?: string | null } | null | undefined): string {
  if (!err) return 'حصل خطأ غير متوقع. جرّب تاني.';
  const msg = err.message ?? '';
  const hasArabic = /[؀-ۿ]/.test(msg);
  if (hasArabic) return msg;
  switch (err.code) {
    case '42501':
      return 'مالكش صلاحية للعملية دي.';
    case '23514':
      return 'البيانات مش مقبولة — راجع الحقول.';
    case '23505':
      return 'العنصر ده موجود بالفعل.';
    case '55000':
      return 'الاستوديو مقفول — شغّله من إعدادات الاستوديو.';
    default:
      return 'تعذّر تنفيذ العملية.';
  }
}
