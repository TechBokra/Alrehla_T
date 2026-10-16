/**
 * قواعد النص في «أقلام الرحلة»: التصنيفات، الأسماء الظاهرة، الحدود، والتحقق
 * من اللي الكاتب بعته.
 *
 * ⚠️ **الحدود هنا مطابقة لحدود القاعدة بالحرف** (`aqlam_*` في الـmigration).
 *    القاعدة هي الحارس؛ هنا رسالة عربي واضحة تحت الخانة الغلط بدل رفض
 *    خام. لو غيّرت رقم هنا غيّره هناك.
 */

import { checkContactInfo, CONTACT_BLOCKED_MESSAGE } from './contact-filter';
import type { AqlamAgeGroup } from './age';

export const AQLAM_LIMITS = {
  titleMax: 120,
  bodyMin: 20,
  bodyMax: 20000,
  penNameMin: 2,
  penNameMax: 40,
  bioMax: 500,
  commentMax: 500,
  reportDetailsMax: 500,
  /** حدود يومية على الحساب — مفيش نظام حدود في المنصة، فبتتنفّذ في دوال القاعدة. */
  postsPerDay: 3,
  commentsPerDay: 20,
  reactionsPerDay: 200,
  reportsPerDay: 10,
} as const;

export const AQLAM_CATEGORIES = [
  { key: 'story', label: 'قصة' },
  { key: 'poem', label: 'قصيدة' },
  { key: 'reflection', label: 'خاطرة' },
  { key: 'article', label: 'مقال' },
  { key: 'scene', label: 'مشهد' },
] as const;

export type AqlamCategory = (typeof AQLAM_CATEGORIES)[number]['key'];

export function isAqlamCategory(v: unknown): v is AqlamCategory {
  return AQLAM_CATEGORIES.some((c) => c.key === v);
}

export function categoryLabel(key: string): string {
  return AQLAM_CATEGORIES.find((c) => c.key === key)?.label ?? '';
}

/** الملصقات: مفاتيح ثابتة، والعرض (إيموجي/نص) في الواجهة. */
export const AQLAM_REACTIONS = [
  { key: 'heart', label: 'عجبني' },
  { key: 'star', label: 'مميّز' },
  { key: 'spark', label: 'ألهمني' },
] as const;

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
export function allowedNameModes(group: AqlamAgeGroup): readonly NameMode[] {
  return group === 'under_12' ? ['first_name'] : ['first_name', 'full_name', 'pen_name'];
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
): ValidationResult<PublishInput> {
  const title = String(raw.title ?? '').replace(/\s+/g, ' ').trim();
  if (title.length === 0) return { ok: false, error: 'اكتب عنوانًا للنص', field: 'title' };
  if (title.length > AQLAM_LIMITS.titleMax) {
    return { ok: false, error: `العنوان أطول من ${AQLAM_LIMITS.titleMax} حرف`, field: 'title' };
  }

  const body = cleanBody(String(raw.body ?? ''));
  if (body.length < AQLAM_LIMITS.bodyMin) {
    return { ok: false, error: `النص قصير جدًا — ${AQLAM_LIMITS.bodyMin} حرف على الأقل`, field: 'body' };
  }
  if (body.length > AQLAM_LIMITS.bodyMax) {
    return { ok: false, error: `النص أطول من ${AQLAM_LIMITS.bodyMax} حرف`, field: 'body' };
  }

  if (!isAqlamCategory(raw.category)) {
    return { ok: false, error: 'اختار تصنيف النص', field: 'category' };
  }

  const nameMode = raw.nameMode;
  if (!isNameMode(nameMode) || !allowedNameModes(group).includes(nameMode)) {
    return { ok: false, error: 'طريقة عرض الاسم دي مش متاحة', field: 'nameMode' };
  }

  let penName: string | null = null;
  if (nameMode === 'pen_name') {
    penName = String(raw.penName ?? '').replace(/\s+/g, ' ').trim();
    if (penName.length < AQLAM_LIMITS.penNameMin || penName.length > AQLAM_LIMITS.penNameMax) {
      return {
        ok: false,
        error: `الاسم القلمي بين ${AQLAM_LIMITS.penNameMin} و${AQLAM_LIMITS.penNameMax} حرف`,
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
      allowIndexing: group === '12_plus' && raw.allowIndexing === true,
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
): ValidationResult<EditInput> {
  const title = String(raw.title ?? '').replace(/\s+/g, ' ').trim();
  if (title.length === 0) return { ok: false, error: 'اكتب عنوانًا للنص', field: 'title' };
  if (title.length > AQLAM_LIMITS.titleMax) {
    return { ok: false, error: `العنوان أطول من ${AQLAM_LIMITS.titleMax} حرف`, field: 'title' };
  }
  const body = cleanBody(String(raw.body ?? ''));
  if (body.length < AQLAM_LIMITS.bodyMin) {
    return { ok: false, error: `النص قصير جدًا — ${AQLAM_LIMITS.bodyMin} حرف على الأقل`, field: 'body' };
  }
  if (body.length > AQLAM_LIMITS.bodyMax) {
    return { ok: false, error: `النص أطول من ${AQLAM_LIMITS.bodyMax} حرف`, field: 'body' };
  }
  if (!isAqlamCategory(raw.category)) {
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
      allowIndexing: group === '12_plus' && raw.allowIndexing === true,
      commentsEnabled: raw.commentsEnabled !== false,
    },
  };
}

export type WriterProfileInput = { penName: string | null; bio: string | null; isPublic: boolean };

/** ملف الكاتب: اسم قلم (اختياري، ٢–٤٠)، نبذة (حتى ٥٠٠)، وخيار الصفحة العامة. */
export function validateWriterProfileInput(raw: Record<string, unknown>): ValidationResult<WriterProfileInput> {
  const penRaw = String(raw.penName ?? '').replace(/\s+/g, ' ').trim();
  const penName = penRaw === '' ? null : penRaw;
  if (penName && (penName.length < AQLAM_LIMITS.penNameMin || penName.length > AQLAM_LIMITS.penNameMax)) {
    return {
      ok: false,
      error: `الاسم القلمي بين ${AQLAM_LIMITS.penNameMin} و${AQLAM_LIMITS.penNameMax} حرف`,
      field: 'penName',
    };
  }
  const bioRaw = cleanBody(String(raw.bio ?? ''));
  const bio = bioRaw === '' ? null : bioRaw;
  if (bio && bio.length > AQLAM_LIMITS.bioMax) {
    return { ok: false, error: `النبذة أطول من ${AQLAM_LIMITS.bioMax} حرف`, field: 'bio' };
  }
  for (const [field, text] of [['penName', penName], ['bio', bio]] as const) {
    if (text && !checkContactInfo(text).ok) return { ok: false, error: CONTACT_BLOCKED_MESSAGE, field };
  }
  return { ok: true, value: { penName, bio, isPublic: raw.isPublic === true } };
}

export function validateCommentBody(raw: unknown): ValidationResult<string> {
  const body = cleanBody(String(raw ?? ''));
  if (body.length === 0) return { ok: false, error: 'اكتب تعليقك الأول', field: 'body' };
  if (body.length > AQLAM_LIMITS.commentMax) {
    return { ok: false, error: `التعليق أطول من ${AQLAM_LIMITS.commentMax} حرف`, field: 'body' };
  }
  if (!checkContactInfo(body).ok) {
    return { ok: false, error: CONTACT_BLOCKED_MESSAGE, field: 'body' };
  }
  return { ok: true, value: body };
}

export const REPORT_REASONS = [
  { key: 'contact_info', label: 'فيه بيانات تواصل' },
  { key: 'inappropriate', label: 'محتوى غير مناسب' },
  { key: 'bullying', label: 'تنمّر أو إساءة' },
  { key: 'copied', label: 'منقول من غير صاحبه' },
  { key: 'other', label: 'سبب آخر' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['key'];

export function isReportReason(v: unknown): v is ReportReason {
  return REPORT_REASONS.some((r) => r.key === v);
}
