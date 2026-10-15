/**
 * استوديو القصص — الثوابت والتسميات ومرآة الانتقالات.
 *
 * ⚠️ **الحارس الحقيقي محفّز `story_project_guard` في القاعدة**
 *    (ملف `20261016010000_story_studio_foundation.sql`). اللي هنا بيخدم الشاشة
 *    بس: يعرض الأزرار الصح ويكتب رسالة قبل ما الطلب يوصل للقاعدة. لو اتغيّر
 *    جدول الانتقالات في القاعدة لازم يتغيّر هنا — `studio.test.ts` بيمسك
 *    التناقض الداخلي، والقاعدة بترفض أي انتقال غلط على أي حال.
 *
 * ملف خفيف بلا تبعيات: الاستوديو كله تحت لوحة الإدارة، ومفيش منه بايت
 * بيوصل للموقع العام.
 */

export const STUDIO_STATUSES = [
  'brief',
  'text_draft',
  'text_review',
  'client_text_approval',
  'character',
  'scenes',
  'art_review',
  'layout',
  'qa',
  'ready',
  'delivered',
  'on_hold',
  'cancelled',
] as const;

export type StudioStatus = (typeof STUDIO_STATUSES)[number];

/** المراحل بترتيبها (من غير الإيقاف والإلغاء) — لشريط التقدّم. */
export const STUDIO_PIPELINE: readonly StudioStatus[] = [
  'brief',
  'text_draft',
  'text_review',
  'client_text_approval',
  'character',
  'scenes',
  'art_review',
  'layout',
  'qa',
  'ready',
  'delivered',
];

export const STATUS_LABELS: Record<StudioStatus, string> = {
  brief: 'الطلب',
  text_draft: 'كتابة النص',
  text_review: 'مراجعة النص',
  client_text_approval: 'موافقة العميل على النص',
  character: 'الشخصية',
  scenes: 'المشاهد',
  art_review: 'مراجعة الرسوم',
  layout: 'التركيب',
  qa: 'فحص الجودة',
  ready: 'جاهز للتسليم',
  delivered: 'تم التسليم',
  on_hold: 'موقوف مؤقتًا',
  cancelled: 'ملغي',
};

export type StudioTone = 'success' | 'warning' | 'danger' | 'pending' | 'info' | 'neutral';

export const STATUS_TONES: Record<StudioStatus, StudioTone> = {
  brief: 'pending',
  text_draft: 'info',
  text_review: 'warning',
  client_text_approval: 'warning',
  character: 'info',
  scenes: 'info',
  art_review: 'warning',
  layout: 'info',
  qa: 'warning',
  ready: 'success',
  delivered: 'success',
  on_hold: 'neutral',
  cancelled: 'danger',
};

export function isStudioStatus(v: unknown): v is StudioStatus {
  return typeof v === 'string' && (STUDIO_STATUSES as readonly string[]).includes(v);
}

export function statusLabel(v: string): string {
  return isStudioStatus(v) ? STATUS_LABELS[v] : v;
}

export function statusTone(v: string): StudioTone {
  return isStudioStatus(v) ? STATUS_TONES[v] : 'neutral';
}

/** مين صاحب المرحلة. */
export type StageOwner = 'editor' | 'art' | 'manager' | 'none';

export function stageOwner(status: StudioStatus): StageOwner {
  switch (status) {
    case 'brief':
    case 'text_draft':
    case 'text_review':
    case 'client_text_approval':
      return 'editor';
    case 'character':
    case 'scenes':
    case 'art_review':
    case 'layout':
      return 'art';
    case 'qa':
    case 'ready':
    case 'on_hold':
      return 'manager';
    default:
      return 'none';
  }
}

export const OWNER_LABELS: Record<StageOwner, string> = {
  editor: 'المحرّر',
  art: 'المشرف الفني',
  manager: 'مسؤول الإنتاج',
  none: '—',
};

/** مراحل منتهية — مفيهاش أي تعديل. */
export function isTerminal(status: StudioStatus): boolean {
  return status === 'delivered' || status === 'cancelled';
}

/**
 * الانتقالات المسموحة من كل حالة (مرآة لجدول المحفّز).
 * `on_hold` بيرجع للحالة المحفوظة في `held_from` بس — شوف `nextStatuses`.
 */
const BASE_TRANSITIONS: Record<Exclude<StudioStatus, 'on_hold' | 'delivered' | 'cancelled'>, StudioStatus[]> = {
  brief: ['text_draft', 'on_hold', 'cancelled'],
  text_draft: ['text_review', 'on_hold', 'cancelled'],
  text_review: ['client_text_approval', 'text_draft', 'on_hold', 'cancelled'],
  client_text_approval: ['character', 'text_draft', 'on_hold', 'cancelled'],
  character: ['scenes', 'text_draft', 'on_hold', 'cancelled'],
  scenes: ['art_review', 'text_draft', 'on_hold', 'cancelled'],
  art_review: ['layout', 'scenes', 'text_draft', 'on_hold', 'cancelled'],
  layout: ['qa', 'art_review', 'text_draft', 'on_hold', 'cancelled'],
  qa: ['ready', 'layout', 'text_draft', 'on_hold', 'cancelled'],
  ready: ['delivered', 'qa', 'text_draft', 'on_hold', 'cancelled'],
};

export function nextStatuses(status: StudioStatus, heldFrom: string | null): StudioStatus[] {
  if (status === 'delivered' || status === 'cancelled') return [];
  if (status === 'on_hold') return isStudioStatus(heldFrom) ? [heldFrom] : [];
  return BASE_TRANSITIONS[status];
}

/** تعديل النص بعد ما الرسم بدأ = تعديل نطاق (مسؤول الإنتاج بس). */
export function isScopeChange(from: StudioStatus, to: StudioStatus): boolean {
  return (
    to === 'text_draft' &&
    (['character', 'scenes', 'art_review', 'layout', 'qa', 'ready'] as StudioStatus[]).includes(from)
  );
}

/** الانتقال ده لمسؤول الإنتاج بس؟ (إيقاف/إلغاء/فحص نهائي/تسليم/تعديل نطاق) */
export function transitionNeedsManager(from: StudioStatus, to: StudioStatus): boolean {
  return (
    to === 'on_hold' ||
    to === 'cancelled' ||
    to === 'delivered' ||
    from === 'qa' ||
    from === 'ready' ||
    from === 'on_hold' ||
    isScopeChange(from, to)
  );
}

export type StudioActor = {
  id: string;
  canManage: boolean;
  canWork: boolean;
};

/** المستخدم ده يقدر يحرّك المشروع من حالته الحالية للحالة المطلوبة؟ */
export function canMove(
  actor: StudioActor,
  project: { status: StudioStatus; editorId: string | null; artLeadId: string | null },
  to: StudioStatus,
): boolean {
  if (isTerminal(project.status)) return false;
  if (actor.canManage) return true;
  if (!actor.canWork) return false;
  if (transitionNeedsManager(project.status, to)) return false;
  const owner = stageOwner(project.status);
  if (owner === 'editor') return project.editorId === actor.id;
  if (owner === 'art') return project.artLeadId === actor.id;
  return false;
}

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

// ── الشروط المسبقة (مرآة لمحفّز القاعدة — للعرض فقط) ───────────────────────

export type BlockerContext = {
  from: StudioStatus;
  faceMode: FaceMode;
  photoConsentAt: string | null;
  characterApprovedAt: string | null;
  sensitiveTopic: boolean;
  qaChecklist: Record<string, boolean>;
  versions: { status: string }[];
  pages: { status: string }[];
};

/**
 * إيه اللي ناقص عشان الانتقال لـ`to` يتقبل؟ فاضية = جاهز.
 * القاعدة هي اللي بترفض فعلًا؛ ده بس عشان الشاشة تقول السبب قبل الضغط.
 */
export function studioBlockers(to: StudioStatus, c: BlockerContext): string[] {
  const out: string[] = [];
  const hasVersion = c.versions.some((v) => v.status !== 'superseded');
  const editorApproved = c.versions.some((v) => v.status === 'editor_approved');
  const clientApproved = c.versions.some((v) => v.status === 'client_approved');

  if (to === 'text_review' && !hasVersion) out.push('اكتب نسخة من النص.');
  if (to === 'client_text_approval' && !editorApproved) out.push('اعتمد نسخة النص كمحرّر.');
  if (to === 'character') {
    if (c.from === 'client_text_approval' && !clientApproved) out.push('سجّل موافقة العميل على النص.');
    if (c.faceMode === 'real' && !c.photoConsentAt) out.push('سجّل موافقة ولي الأمر على استخدام الصورة (الوجه الحقيقي).');
  }
  if (to === 'scenes' && !c.characterApprovedAt) out.push('اعتمد مرجع الشخصية.');
  if (to === 'art_review') {
    if (c.pages.length === 0) out.push('أضف صفحات الكتاب.');
    else if (c.pages.some((p) => p.status === 'pending' || p.status === 'needs_redo')) {
      out.push('كل الصفحات لازم تتجهّز (نص ومشهد وصورة).');
    }
  }
  if (to === 'layout' && c.from === 'art_review') {
    if (c.pages.length === 0 || c.pages.some((p) => p.status !== 'approved')) out.push('كل الصفحات لازم تتعتمد.');
  }
  if (to === 'ready') {
    const missing = qaMissing(c.qaChecklist, c.sensitiveTopic);
    if (missing.length > 0) out.push(`قايمة فحص الجودة ناقصة (${missing.length}).`);
  }
  return out;
}
