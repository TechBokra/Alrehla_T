/**
 * قواعد النص في «أقلام الرحلة»: التصنيفات، الأسماء الظاهرة، الحدود، والتحقق
 * من اللي الكاتب بعته.
 *
 * ⚠️ **الحدود الفعلية بتيجي من إعدادات الإدارة** (`aqlam_config`، انظر `config.ts`).
 *    القاعدة هي الحارس؛ هنا رسالة عربي واضحة تحت الخانة الغلط بدل رفض خام.
 *    كل دالة تحقق بتاخد الإعداد كمعامل اختياري، والافتراضي = القيم القديمة
 *    (`DEFAULT_AQLAM_CONFIG`) — فاللي مش بيمرّر إعداد بيشتغل زي الأول.
 */

import { checkContactInfo, CONTACT_BLOCKED_MESSAGE } from './contact-filter';
import type { AqlamAgeGroup } from './age';
import { DEFAULT_AQLAM_CONFIG, enabledCategories, type AqlamConfig } from './config';

/**
 * القيم الافتراضية (السلوك القديم) — للاختبارات والاستعمال اللي مالوش إعداد.
 * الاستعمال الحي بيقرا `AqlamConfig` من `getAqlamConfig`.
 */
export const AQLAM_LIMITS = {
  ...DEFAULT_AQLAM_CONFIG.limits,
  reportsToAutoHide: DEFAULT_AQLAM_CONFIG.moderation.reportsToAutoHide,
  maxPinned: DEFAULT_AQLAM_CONFIG.moderation.maxPinned,
  /** ملاحظة الإدارة لولي الأمر (ثابتة). */
  adminNoteMax: 500,
};

/** المدة الافتراضية لمسح المشال (الفعلية من الإعداد: `moderation.removedRetentionDays`). */
export const AQLAM_REMOVED_RETENTION_DAYS = DEFAULT_AQLAM_CONFIG.moderation.removedRetentionDays;

/** التصنيفات الافتراضية. الفعلية من الإعداد (`cfg.categories`) — ممكن تتعدّل وتتزوّد. */
export const AQLAM_CATEGORIES = DEFAULT_AQLAM_CONFIG.categories;

/** مفتاح تصنيف: نص. صلاحيته (موجود/مفعّل) بتتحدد من قايمة الإعداد. */
export type AqlamCategory = string;

export function isAqlamCategory(
  v: unknown,
  categories: readonly { key: string }[] = DEFAULT_AQLAM_CONFIG.categories,
): v is AqlamCategory {
  return typeof v === 'string' && categories.some((c) => c.key === v);
}

export function categoryLabel(
  key: string,
  categories: readonly { key: string; label: string }[] = DEFAULT_AQLAM_CONFIG.categories,
): string {
  return categories.find((c) => c.key === key)?.label ?? '';
}

/** الملصقات: مفاتيح ثابتة (heart/star/spark)، والاسم والرمز والتفعيل من الإعداد. */
export const AQLAM_REACTIONS = DEFAULT_AQLAM_CONFIG.reactions;

export type AqlamReaction = (typeof AQLAM_REACTIONS)[number]['key'];

export function isAqlamReaction(v: unknown): v is AqlamReaction {
  return AQLAM_REACTIONS.some((r) => r.key === v);
}

export type NameMode = 'first_name' | 'full_name' | 'pen_name';

/**
 * الاسم الظاهر حسب الفئة:
 *  • أقل من ١٢ → الاسم الأول فقط (قرار الحماية).
 *  • ١٢+ → الاسم الأول أو الكامل أو اسم قلمي (قرار «خفّف القيود»).
 */
export function allowedNameModes(
  group: AqlamAgeGroup,
  features: Pick<AqlamConfig['features'], 'fullName' | 'penName'> = DEFAULT_AQLAM_CONFIG.features,
): readonly NameMode[] {
  if (group === 'under_12') return ['first_name'];
  const modes: NameMode[] = ['first_name'];
  if (features.fullName) modes.push('full_name');
  if (features.penName) modes.push('pen_name');
  return modes;
}

export const NAME_MODE_LABELS: Record<NameMode, string> = {
  first_name: 'اسمي الأول',
  full_name: 'اسمي الكامل',
  pen_name: 'اسم قلمي',
};

export function isNameMode(v: unknown): v is NameMode {
  return v === 'first_name' || v === 'full_name' || v === 'pen_name';
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/** الاسم اللي يتعرض فعلًا. فاضي = مفيش اسم صالح (والواجهة ترفض النشر). */
export function displayNameFor(params: {
  mode: NameMode;
  fullName: string;
  penName?: string | null;
}): string {
  switch (params.mode) {
    case 'first_name':
      return firstNameOf(params.fullName);
    case 'full_name':
      return params.fullName.trim().replace(/\s+/g, ' ');
    case 'pen_name':
      return (params.penName ?? '').trim().replace(/\s+/g, ' ');
  }
}

export type PublishInput = {
  title: string;
  body: string;
  category: AqlamCategory;
  nameMode: NameMode;
  penName: string | null;
  allowIndexing: boolean;
  commentsEnabled: boolean;
  /** مستند مساحة الكتابة اللي النسخة اتاخدت منه (للإشارة فقط، مفيش ربط). */
  sourceDocumentId: string | null;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** تنظيف نص الكتابة: توحيد أسطر الويندوز وقصّ الأطراف، من غير لمس الشكل الداخلي. */
export function cleanBody(raw: string): string {
  return raw.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim();
}

/**
 * التحقق من نموذج النشر.
 *
 * ⚠️ `allowIndexing` للـ١٢+ بس: أقل من ١٢ ما بيظهرش في جوجل أبدًا، حتى لو
 *    الخانة اتبعتت `true` من طلب مباشر.
 */
export function validatePublishInput(
  raw: Record<string, unknown>,
  group: AqlamAgeGroup,
  cfg: AqlamConfig = DEFAULT_AQLAM_CONFIG,
): ValidationResult<PublishInput> {
  const L = cfg.limits;
  const title = String(raw.title ?? '').replace(/\s+/g, ' ').trim();
  if (title.length === 0) return { ok: false, error: 'اكتب عنوانًا للنص', field: 'title' };
  if (title.length > L.titleMax) {
    return { ok: false, error: `العنوان أطول من ${L.titleMax} حرف`, field: 'title' };
  }

  const body = cleanBody(String(raw.body ?? ''));
  if (body.length < L.bodyMin) {
    return { ok: false, error: `النص قصير جدًا — ${L.bodyMin} حرف على الأقل`, field: 'body' };
  }
  if (body.length > L.bodyMax) {
    return { ok: false, error: `النص أطول من ${L.bodyMax} حرف`, field: 'body' };
  }

  // التصنيف لازم يكون من المفعّلين دلوقتي (القاعدة بتتأكد برضه).
  if (!isAqlamCategory(raw.category, enabledCategories(cfg))) {
    return { ok: false, error: 'اختار تصنيف النص', field: 'category' };
  }

  const nameMode = raw.nameMode;
  if (!isNameMode(nameMode) || !allowedNameModes(group, cfg.features).includes(nameMode)) {
    return { ok: false, error: 'طريقة عرض الاسم دي مش متاحة', field: 'nameMode' };
  }

  let penName: string | null = null;
  if (nameMode === 'pen_name') {
    penName = String(raw.penName ?? '').replace(/\s+/g, ' ').trim();
    if (penName.length < L.penNameMin || penName.length > L.penNameMax) {
      return {
        ok: false,
        error: `الاسم القلمي بين ${L.penNameMin} و${L.penNameMax} حرف`,
        field: 'penName',
      };
    }
  }

  // بيانات التواصل: العنوان والنص والاسم القلمي كلهم.
  for (const [field, text] of [['title', title], ['body', body], ['penName', penName ?? '']] as const) {
    if (text && !checkContactInfo(text).ok) {
      return { ok: false, error: CONTACT_BLOCKED_MESSAGE, field };
    }
  }

  const sourceDocumentId =
    typeof raw.sourceDocumentId === 'string' && UUID_RE.test(raw.sourceDocumentId)
      ? raw.sourceDocumentId
      : null;

  return {
    ok: true,
    value: {
      title,
      body,
      category: raw.category,
      nameMode,
      penName,
      allowIndexing: group === '12_plus' && raw.allowIndexing === true && cfg.features.googleIndexing,
      commentsEnabled: raw.commentsEnabled !== false,
      sourceDocumentId,
    },
  };
}

export type EditInput = {
  title: string;
  body: string;
  category: AqlamCategory;
  allowIndexing: boolean;
  commentsEnabled: boolean;
};

/**
 * التحقق من تعديل نص. الاسم الظاهر مش بيتعدّل (لو عايز اسم تاني: شيل وانشر
 * من جديد)، فمفيش حقل اسم هنا. `allowIndexing` للـ١٢+ بس زي النشر.
 */
export function validateEditInput(
  raw: Record<string, unknown>,
  group: AqlamAgeGroup,
  cfg: AqlamConfig = DEFAULT_AQLAM_CONFIG,
): ValidationResult<EditInput> {
  const L = cfg.limits;
  const title = String(raw.title ?? '').replace(/\s+/g, ' ').trim();
  if (title.length === 0) return { ok: false, error: 'اكتب عنوانًا للنص', field: 'title' };
  if (title.length > L.titleMax) {
    return { ok: false, error: `العنوان أطول من ${L.titleMax} حرف`, field: 'title' };
  }
  const body = cleanBody(String(raw.body ?? ''));
  if (body.length < L.bodyMin) {
    return { ok: false, error: `النص قصير جدًا — ${L.bodyMin} حرف على الأقل`, field: 'body' };
  }
  if (body.length > L.bodyMax) {
    return { ok: false, error: `النص أطول من ${L.bodyMax} حرف`, field: 'body' };
  }
  // التعديل بيقبل أي تصنيف معروف (حتى المتعطّل: النص القديم بيفضل عليه)؛ القاعدة بتمنع النقل ليه.
  if (!isAqlamCategory(raw.category, cfg.categories)) {
    return { ok: false, error: 'اختار تصنيف النص', field: 'category' };
  }
  for (const [field, text] of [['title', title], ['body', body]] as const) {
    if (!checkContactInfo(text).ok) return { ok: false, error: CONTACT_BLOCKED_MESSAGE, field };
  }
  return {
    ok: true,
    value: {
      title,
      body,
      category: raw.category,
      allowIndexing: group === '12_plus' && raw.allowIndexing === true && cfg.features.googleIndexing,
      commentsEnabled: raw.commentsEnabled !== false,
    },
  };
}

export type WriterProfileInput = { penName: string | null; bio: string | null; isPublic: boolean };

/** ملف الكاتب: اسم قلم (اختياري، ٢–٤٠)، نبذة (حتى ٥٠٠)، وخيار الصفحة العامة. */
export function validateWriterProfileInput(
  raw: Record<string, unknown>,
  cfg: AqlamConfig = DEFAULT_AQLAM_CONFIG,
): ValidationResult<WriterProfileInput> {
  const L = cfg.limits;
  const penRaw = String(raw.penName ?? '').replace(/\s+/g, ' ').trim();
  const penName = penRaw === '' ? null : penRaw;
  if (penName && (penName.length < L.penNameMin || penName.length > L.penNameMax)) {
    return {
      ok: false,
      error: `الاسم القلمي بين ${L.penNameMin} و${L.penNameMax} حرف`,
      field: 'penName',
    };
  }
  const bioRaw = cleanBody(String(raw.bio ?? ''));
  const bio = bioRaw === '' ? null : bioRaw;
  if (bio && bio.length > L.bioMax) {
    return { ok: false, error: `النبذة أطول من ${L.bioMax} حرف`, field: 'bio' };
  }
  for (const [field, text] of [['penName', penName], ['bio', bio]] as const) {
    if (text && !checkContactInfo(text).ok) return { ok: false, error: CONTACT_BLOCKED_MESSAGE, field };
  }
  return { ok: true, value: { penName, bio, isPublic: raw.isPublic === true } };
}

export function validateCommentBody(raw: unknown, cfg: AqlamConfig = DEFAULT_AQLAM_CONFIG): ValidationResult<string> {
  const body = cleanBody(String(raw ?? ''));
  if (body.length === 0) return { ok: false, error: 'اكتب تعليقك الأول', field: 'body' };
  if (body.length > cfg.limits.commentMax) {
    return { ok: false, error: `التعليق أطول من ${cfg.limits.commentMax} حرف`, field: 'body' };
  }
  if (!checkContactInfo(body).ok) {
    return { ok: false, error: CONTACT_BLOCKED_MESSAGE, field: 'body' };
  }
  return { ok: true, value: body };
}

/** أسباب البلاغ: خمسة مفاتيح ثابتة، والاسم والتفعيل من الإعداد (`cfg.reportReasons`). */
export const REPORT_REASONS = DEFAULT_AQLAM_CONFIG.reportReasons;

export type ReportReason = (typeof REPORT_REASONS)[number]['key'];

export function isReportReason(v: unknown): v is ReportReason {
  return REPORT_REASONS.some((r) => r.key === v);
}


/** سبب طلب ولي الأمر لقفل التعليقات: مسافات متكررة بتتضغط، والطول بين الحدّين. */
export function validateGuardianReason(
  raw: unknown,
  cfg: AqlamConfig = DEFAULT_AQLAM_CONFIG,
): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (reason.length < cfg.limits.guardianReasonMin) {
    return { ok: false, error: `اكتب السبب (${cfg.limits.guardianReasonMin} حروف على الأقل) علشان الإدارة تقدر تراجع الطلب.` };
  }
  if (reason.length > cfg.limits.guardianReasonMax) {
    return { ok: false, error: `السبب أطول من ${cfg.limits.guardianReasonMax} حرف.` };
  }
  return { ok: true, reason };
}
