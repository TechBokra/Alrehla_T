/**
 * إعدادات «أقلام الرحلة» القابلة للضبط من لوحة الإدارة — **حساب نقي بلا شاشة**.
 *
 * مصدر الحقيقة في التشغيل: جدول `aqlam_config` (صف واحد). دوال القاعدة بتقراه
 * وقت التنفيذ (الحدود، التصنيفات، المراجعة…)، والموقع بيقراه بـ`getAqlamConfig`.
 *
 * ⚠️ **الافتراضي هنا مطابق لـ`aqlam_default_config()` في الـmigration بالحرف**،
 *    وحدود كل خانة (`min`/`max`) مطابقة لـ`aqlam_clean_config`. القاعدة هي
 *    الحارس: لو الاتنين اختلفوا، القاعدة بترفض الحفظ برسالة «خانة مش مظبوطة».
 *    لو غيّرت رقم هنا غيّره هناك (واختبار `config.test.ts` بيراجع التناسق الداخلي).
 *
 * سجل الخانات (`AQLAM_SECTIONS`) هو اللي بيرسم شاشة الإعدادات وهو اللي بيتحقق
 * من اللي اتبعت — فمفيش خانة في الشاشة من غير تحقق، ولا تحقق من غير خانة.
 */

import { AGE_BANDS, isAgeBandId, type AgeBandId } from '@/lib/age-bands';

// ── الأنواع ──────────────────────────────────────────────────────────────────

export type AqlamSortKey = 'new' | 'top' | 'old';
export const AQLAM_SORT_KEYS: readonly AqlamSortKey[] = ['new', 'top', 'old'];
export const AQLAM_SORT_LABELS: Record<AqlamSortKey, string> = {
  new: 'الأحدث',
  top: 'الأكتر تشجيعًا',
  old: 'الأقدم',
};

export function isAqlamSortKey(v: unknown): v is AqlamSortKey {
  return v === 'new' || v === 'top' || v === 'old';
}

/** أيقونات التصنيف المتاحة (الأسماء ثابتة في القاعدة، والرسم في الواجهة). */
export const AQLAM_CATEGORY_ICONS = [
  'book',
  'feather',
  'lightbulb',
  'newspaper',
  'clapperboard',
  'pen',
  'quote',
  'sparkles',
  'heart',
  'star',
  'globe',
  'music',
] as const;
export type AqlamCategoryIcon = (typeof AQLAM_CATEGORY_ICONS)[number];

export const AQLAM_ICON_LABELS: Record<AqlamCategoryIcon, string> = {
  book: 'كتاب',
  feather: 'ريشة',
  lightbulb: 'لمبة',
  newspaper: 'جريدة',
  clapperboard: 'كلاكيت',
  pen: 'قلم',
  quote: 'اقتباس',
  sparkles: 'لمعة',
  heart: 'قلب',
  star: 'نجمة',
  globe: 'كرة أرضية',
  music: 'موسيقى',
};

export function isAqlamCategoryIcon(v: unknown): v is AqlamCategoryIcon {
  return (AQLAM_CATEGORY_ICONS as readonly string[]).includes(String(v));
}

export type AqlamCategoryConfig = { key: string; label: string; icon: AqlamCategoryIcon; enabled: boolean };

export const AQLAM_REACTION_KEYS = ['heart', 'star', 'spark'] as const;
export type AqlamReactionKey = (typeof AQLAM_REACTION_KEYS)[number];
export type AqlamReactionConfig = { key: AqlamReactionKey; label: string; emoji: string; enabled: boolean };

export const AQLAM_REPORT_REASON_KEYS = ['contact_info', 'inappropriate', 'bullying', 'copied', 'other'] as const;
export type AqlamReportReasonKey = (typeof AQLAM_REPORT_REASON_KEYS)[number];
export type AqlamReportReasonConfig = { key: AqlamReportReasonKey; label: string; enabled: boolean };

export type AqlamReview12Plus = 'off' | 'first' | 'all';
export type AqlamBlockedAction = 'reject' | 'review';

export type AqlamLimits = {
  postsPerDay: number;
  commentsPerDay: number;
  reactionsPerDay: number;
  reportsPerDay: number;
  editsPerDay: number;
  guardianRequestsPerDay: number;
  titleMax: number;
  bodyMin: number;
  bodyMax: number;
  commentMax: number;
  bioMax: number;
  penNameMin: number;
  penNameMax: number;
  reportDetailsMax: number;
  guardianReasonMin: number;
  guardianReasonMax: number;
};

export type AqlamConfig = {
  limits: AqlamLimits;
  moderation: {
    reportsToAutoHide: number;
    removedRetentionDays: number;
    maxPinned: number;
    review12Plus: AqlamReview12Plus;
    reviewFirstN: number;
    reReviewEdits: boolean;
    blockedWordsAction: AqlamBlockedAction;
  };
  features: {
    publishing: boolean;
    comments: boolean;
    reactions: boolean;
    selfEdit: boolean;
    selfRemove: boolean;
    fullName: boolean;
    penName: boolean;
    googleIndexing: boolean;
    writerPages: boolean;
    share: boolean;
  };
  categories: AqlamCategoryConfig[];
  reactions: AqlamReactionConfig[];
  reportReasons: AqlamReportReasonConfig[];
  filters: {
    showCategory: boolean;
    showAge: boolean;
    showSort: boolean;
    defaultSort: AqlamSortKey;
    sorts: AqlamSortKey[];
    ageBands: AgeBandId[];
    pageSize: number;
  };
  featured: { enabled: boolean; title: string; respectFilters: boolean };
  texts: {
    heroTitle: string;
    heroSubtitle: string;
    emptyMessage: string;
    publishGuidelines: string;
    closedNotice: string;
  };
  admin: { pageSize: number };
};

// ── الافتراضي (= السلوك القديم بالظبط) ─────────────────────────────────────────

export const DEFAULT_AQLAM_CONFIG: AqlamConfig = {
  limits: {
    postsPerDay: 3,
    commentsPerDay: 20,
    reactionsPerDay: 200,
    reportsPerDay: 10,
    editsPerDay: 10,
    guardianRequestsPerDay: 3,
    titleMax: 120,
    bodyMin: 20,
    bodyMax: 20000,
    commentMax: 500,
    bioMax: 500,
    penNameMin: 2,
    penNameMax: 40,
    reportDetailsMax: 500,
    guardianReasonMin: 10,
    guardianReasonMax: 500,
  },
  moderation: {
    reportsToAutoHide: 5,
    removedRetentionDays: 7,
    maxPinned: 6,
    review12Plus: 'off',
    reviewFirstN: 1,
    reReviewEdits: false,
    blockedWordsAction: 'reject',
  },
  features: {
    publishing: true,
    comments: true,
    reactions: true,
    selfEdit: true,
    selfRemove: true,
    fullName: true,
    penName: true,
    googleIndexing: true,
    writerPages: true,
    share: true,
  },
  categories: [
    { key: 'story', label: 'قصة', icon: 'book', enabled: true },
    { key: 'poem', label: 'قصيدة', icon: 'feather', enabled: true },
    { key: 'reflection', label: 'خاطرة', icon: 'lightbulb', enabled: true },
    { key: 'article', label: 'مقال', icon: 'newspaper', enabled: true },
    { key: 'scene', label: 'مشهد', icon: 'clapperboard', enabled: true },
  ],
  reactions: [
    { key: 'heart', label: 'عجبني', emoji: '❤️', enabled: true },
    { key: 'star', label: 'مميّز', emoji: '⭐', enabled: true },
    { key: 'spark', label: 'ألهمني', emoji: '✨', enabled: true },
  ],
  reportReasons: [
    { key: 'contact_info', label: 'فيه بيانات تواصل', enabled: true },
    { key: 'inappropriate', label: 'محتوى غير مناسب', enabled: true },
    { key: 'bullying', label: 'تنمّر أو إساءة', enabled: true },
    { key: 'copied', label: 'منقول من غير صاحبه', enabled: true },
    { key: 'other', label: 'سبب آخر', enabled: true },
  ],
  filters: {
    showCategory: true,
    showAge: true,
    showSort: true,
    defaultSort: 'new',
    sorts: ['new', 'top'],
    ageBands: ['6-9', '10-12', '13-17', '18-20'],
    pageSize: 12,
  },
  featured: { enabled: true, title: 'مختارات الرحلة', respectFilters: true },
  texts: {
    heroTitle: 'أقلام الرحلة',
    heroSubtitle:
      'قصص وقصائد وخواطر كتبها صغار ويافعون. اقرا، وشجّع بملصق أو تعليق طيّب، وانشر نصك لما تحب.',
    emptyMessage: 'لسه مفيش نصوص منشورة. كن أول من ينشر.',
    publishGuidelines: '',
    closedNotice: 'النشر متوقف مؤقتًا. تقدر تقرأ وتشجّع زي العادة.',
  },
  admin: { pageSize: 20 },
};

// ── سجل الخانات: بيرسم الشاشة وبيتحقق ──────────────────────────────────────────

type FieldBase = { path: string; label: string; hint?: string };
export type AqlamIntField = FieldBase & { kind: 'int'; min: number; max: number; unit?: string };
export type AqlamBoolField = FieldBase & { kind: 'bool' };
export type AqlamEnumField = FieldBase & { kind: 'enum'; options: { value: string; label: string }[] };
export type AqlamTextField = FieldBase & { kind: 'text'; minLen: number; maxLen: number; multiline?: boolean };
export type AqlamField = AqlamIntField | AqlamBoolField | AqlamEnumField | AqlamTextField;

export type AqlamSection = {
  id: string;
  title: string;
  description: string;
  fields: AqlamField[];
};

const int = (path: string, label: string, min: number, max: number, hint?: string, unit?: string): AqlamIntField => ({
  kind: 'int',
  path,
  label,
  min,
  max,
  hint,
  unit,
});
const bool = (path: string, label: string, hint?: string): AqlamBoolField => ({ kind: 'bool', path, label, hint });

export const AQLAM_SECTIONS: AqlamSection[] = [
  {
    id: 'features',
    title: 'التشغيل والصلاحيات',
    description:
      'مفاتيح تشغيل وإيقاف. القفل هنا بيتطبّق فورًا في القاعدة نفسها، فمفيش طريقة للالتفاف عليه من الموقع. وضع التشغيل العام (مقفول / تجريبي / عام) فوق.',
    fields: [
      bool('features.publishing', 'النشر مفتوح', 'لو اتقفل: محدش يقدر ينشر نصًا جديدًا. القراءة والتفاعل بيفضلوا شغالين.'),
      bool('features.comments', 'التعليقات مفتوحة', 'إيقاف عام للتعليقات الجديدة في كل النصوص.'),
      bool('features.reactions', 'الملصقات مفتوحة', 'إيقاف عام لإضافة ملصقات تشجيع جديدة (الشيل بيفضل متاح).'),
      bool('features.selfEdit', 'الكاتب يقدر يعدّل نصه'),
      bool('features.selfRemove', 'الكاتب يقدر يشيل نصه'),
      bool('features.fullName', 'السماح بعرض الاسم الكامل', 'للكتّاب ١٢+ بس. الأقل من ١٢ دايمًا بالاسم الأول.'),
      bool('features.penName', 'السماح بالاسم القلمي', 'للكتّاب ١٢+ بس.'),
      bool('features.googleIndexing', 'السماح بظهور النصوص في جوجل', 'لـ١٢+ وبموافقة الكاتب فقط. لو اتقفل: ولا نص بيتفهرس.'),
      bool('features.writerPages', 'صفحات الكتّاب العامة', 'لو اتقفلت: ما فيش صفحة عامة جديدة، والقديمة بتختفي.'),
      bool('features.share', 'زر المشاركة'),
    ],
  },
  {
    id: 'limits-daily',
    title: 'الحدود اليومية',
    description: 'كل حد بيتحسب لكل حساب خلال آخر ٢٤ ساعة. الوصول للحد بيرجّع للمستخدم رسالة «وصلت للحد اليومي».',
    fields: [
      int('limits.postsPerDay', 'نصوص جديدة', 1, 50, undefined, 'نص'),
      int('limits.editsPerDay', 'تعديلات على النصوص', 1, 100, undefined, 'تعديل'),
      int('limits.commentsPerDay', 'تعليقات', 1, 500, undefined, 'تعليق'),
      int('limits.reactionsPerDay', 'ملصقات تشجيع', 10, 5000, undefined, 'ملصق'),
      int('limits.reportsPerDay', 'بلاغات', 1, 200, undefined, 'بلاغ'),
      int('limits.guardianRequestsPerDay', 'طلبات ولي الأمر (لكل ابن)', 1, 20, undefined, 'طلب'),
    ],
  },
  {
    id: 'limits-content',
    title: 'حدود المحتوى',
    description: 'الأطوال بالحروف. الحدود دي بتتطبّق على النصوص الجديدة والتعديلات، والنصوص الموجودة ما بتتغيّرش.',
    fields: [
      int('limits.titleMax', 'أقصى طول للعنوان', 20, 300, undefined, 'حرف'),
      int('limits.bodyMin', 'أقل طول للنص', 1, 2000, undefined, 'حرف'),
      int('limits.bodyMax', 'أقصى طول للنص', 200, 100000, 'لازم يكون أكبر من الحد الأدنى.', 'حرف'),
      int('limits.commentMax', 'أقصى طول للتعليق', 20, 2000, undefined, 'حرف'),
      int('limits.bioMax', 'أقصى طول للنبذة', 50, 1000, undefined, 'حرف'),
      int('limits.penNameMin', 'أقل طول للاسم القلمي', 2, 10, undefined, 'حرف'),
      int('limits.penNameMax', 'أقصى طول للاسم القلمي', 10, 60, undefined, 'حرف'),
      int('limits.reportDetailsMax', 'أقصى طول لتفاصيل البلاغ', 50, 2000, undefined, 'حرف'),
      int('limits.guardianReasonMin', 'أقل طول لسبب طلب ولي الأمر', 3, 100, undefined, 'حرف'),
      int('limits.guardianReasonMax', 'أقصى طول لسبب طلب ولي الأمر', 50, 1000, undefined, 'حرف'),
    ],
  },
  {
    id: 'moderation',
    title: 'المراجعة والإشراف',
    description: 'متى النص يظهر فورًا ومتى يستنى مراجعتك، وإيه اللي بيتخبّى لوحده. نصوص الأقل من ١٢ دايمًا بتعدي على ولي الأمر ثم المراجعة.',
    fields: [
      {
        kind: 'enum',
        path: 'moderation.review12Plus',
        label: 'مراجعة نصوص ١٢+ قبل الظهور',
        hint: '«نصوص الكاتب الأولى» بتراجع أول نصوص كل كاتب جديد بس، وبعد كده بتظهر فورًا.',
        options: [
          { value: 'off', label: 'تظهر فورًا (من غير مراجعة)' },
          { value: 'first', label: 'مراجعة النصوص الأولى للكاتب' },
          { value: 'all', label: 'مراجعة كل النصوص' },
        ],
      },
      int('moderation.reviewFirstN', 'عدد النصوص الأولى اللي بتتراجع', 1, 20, 'بيشتغل مع «مراجعة النصوص الأولى للكاتب».', 'نص'),
      bool('moderation.reReviewEdits', 'إعادة المراجعة بعد تعديل نص منشور', 'نص ١٢+ معدّل بيتخبّى لحد ما تعتمد النسخة الجديدة.'),
      int('moderation.reportsToAutoHide', 'بلاغات الإخفاء التلقائي', 0, 50, 'عدد الحسابات المختلفة اللي بلاغها بيخفي النص لحد المراجعة. صفر = الإخفاء التلقائي مقفول.', 'حساب'),
      int('moderation.removedRetentionDays', 'مدة الاحتفاظ بالمُزال قبل المسح النهائي', 1, 365, 'بيتمسح مع تشجيعاته وبلاغاته وسجل تعديلاته.', 'يوم'),
      int('moderation.maxPinned', 'أقصى عدد للنصوص المثبّتة', 1, 12, 'لو قلّلته تحت عدد المثبّت حاليًا، القديم يفضل لحد ما تفك تثبيته.', 'نص'),
      {
        kind: 'enum',
        path: 'moderation.blockedWordsAction',
        label: 'لو النص فيه كلمة من الكلمات الممنوعة',
        hint: 'التعليقات والنبذة بيترفضوا دايمًا. القايمة نفسها تحت.',
        options: [
          { value: 'reject', label: 'رفض النص مع رسالة للكاتب' },
          { value: 'review', label: 'قبوله مع تحويله للمراجعة' },
        ],
      },
    ],
  },
  {
    id: 'filters',
    title: 'فلاتر الصفحة العامة',
    description: 'اللي الزائر بيشوفه فوق قائمة النصوص. الاختيارات (الأقدم/شرايح السن) تحت.',
    fields: [
      bool('filters.showCategory', 'إظهار فلتر النوع'),
      bool('filters.showAge', 'إظهار فلتر السن'),
      bool('filters.showSort', 'إظهار الترتيب'),
      {
        kind: 'enum',
        path: 'filters.defaultSort',
        label: 'الترتيب الافتراضي',
        hint: 'لازم يكون من الترتيبات المفعّلة تحت.',
        options: AQLAM_SORT_KEYS.map((k) => ({ value: k, label: AQLAM_SORT_LABELS[k] })),
      },
      int('filters.pageSize', 'عدد النصوص في الصفحة', 6, 48, undefined, 'نص'),
    ],
  },
  {
    id: 'featured',
    title: 'مختارات الرحلة',
    description: 'الشريط اللي بيعرض النصوص المثبّتة فوق القايمة في أول صفحة. التثبيت والترتيب من «كل النصوص».',
    fields: [
      bool('featured.enabled', 'إظهار الشريط'),
      { kind: 'text', path: 'featured.title', label: 'عنوان الشريط', minLen: 1, maxLen: 40 },
      bool('featured.respectFilters', 'يتفلتر مع القايمة', 'لو اتقفل: الشريط يعرض كل المختارات حتى لو الزائر فلتر بنوع أو سن.'),
    ],
  },
  {
    id: 'texts',
    title: 'النصوص والرسائل',
    description: 'الكلام اللي بيظهر للزوار والكتّاب. تقدر ترجّعه للافتراضي بزر «رجوع للافتراضي».',
    fields: [
      { kind: 'text', path: 'texts.heroTitle', label: 'عنوان الصفحة الرئيسية', minLen: 1, maxLen: 80 },
      { kind: 'text', path: 'texts.heroSubtitle', label: 'الوصف تحت العنوان', minLen: 1, maxLen: 240, multiline: true },
      { kind: 'text', path: 'texts.emptyMessage', label: 'رسالة «مفيش نصوص»', minLen: 1, maxLen: 160 },
      {
        kind: 'text',
        path: 'texts.publishGuidelines',
        label: 'إرشادات فوق نموذج النشر',
        hint: 'اختياري. اكتب كل نقطة في سطر. بتظهر للكاتب قبل ما ينشر.',
        minLen: 0,
        maxLen: 800,
        multiline: true,
      },
      { kind: 'text', path: 'texts.closedNotice', label: 'رسالة «النشر متوقف»', minLen: 1, maxLen: 240, multiline: true },
    ],
  },
  {
    id: 'admin',
    title: 'شاشة الإدارة',
    description: 'تفضيلات عرض لوحة الإدارة نفسها.',
    fields: [int('admin.pageSize', 'عدد النصوص في صفحة «كل النصوص»', 10, 100, undefined, 'نص')],
  },
];

export const AQLAM_FIELDS: AqlamField[] = AQLAM_SECTIONS.flatMap((s) => s.fields);

// ── مسارات الخانات (قراءة/كتابة بدون تغيير الأصل) ───────────────────────────────

export function getAtPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** نسخة جديدة من الإعداد والخانة اتغيّرت. المسار دايمًا من مستويين (`group.key`). */
export function withValueAt(cfg: AqlamConfig, path: string, value: unknown): AqlamConfig {
  const [group, key] = path.split('.');
  const current = (cfg as unknown as Record<string, Record<string, unknown>>)[group];
  return { ...cfg, [group]: { ...current, [key]: value } } as AqlamConfig;
}

export function cloneConfig(cfg: AqlamConfig): AqlamConfig {
  return JSON.parse(JSON.stringify(cfg)) as AqlamConfig;
}

// ── التحقق من خانة واحدة (بيستعمله الحفظ) ──────────────────────────────────────

export type FieldParse = { ok: true; value: number | boolean | string } | { ok: false; error: string };

const arNum = (n: number) => n.toLocaleString('ar-EG');

/** قيمة خانة من نموذج HTML. الـ`bool` غياب الخانة = false (زي أي checkbox). */
export function parseFieldValue(field: AqlamField, raw: FormDataEntryValue | null): FieldParse {
  switch (field.kind) {
    case 'bool':
      return { ok: true, value: raw === 'on' || raw === 'true' };
    case 'int': {
      const text = typeof raw === 'string' ? raw.trim() : '';
      const n = Number(text);
      if (text === '' || !Number.isInteger(n) || n < field.min || n > field.max) {
        return { ok: false, error: `«${field.label}» لازم يكون رقمًا صحيحًا بين ${arNum(field.min)} و${arNum(field.max)}.` };
      }
      return { ok: true, value: n };
    }
    case 'enum': {
      const v = typeof raw === 'string' ? raw : '';
      if (!field.options.some((o) => o.value === v)) {
        return { ok: false, error: `اختار قيمة من القايمة في «${field.label}».` };
      }
      return { ok: true, value: v };
    }
    case 'text': {
      const v = (typeof raw === 'string' ? raw : '').replace(/\r\n?/g, '\n').trim();
      if (v.length < field.minLen || v.length > field.maxLen) {
        return {
          ok: false,
          error:
            field.minLen > 0
              ? `«${field.label}» بين ${arNum(field.minLen)} و${arNum(field.maxLen)} حرف.`
              : `«${field.label}» حتى ${arNum(field.maxLen)} حرف.`,
        };
      }
      return { ok: true, value: field.multiline ? v : v.replace(/\s*\n\s*/g, ' ') };
    }
  }
}

// ── القوايم: التصنيفات والتفاعلات وأسباب البلاغ ─────────────────────────────────

export const AQLAM_CATEGORY_KEY_RE = /^[a-z][a-z0-9_]{1,23}$/;
export const AQLAM_MAX_CATEGORIES = 12;

export type ListParse<T> = { ok: true; value: T } | { ok: false; error: string };

const oneLine = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function parseCategories(rows: { key: string; label: string; icon: string; enabled: boolean }[]): ListParse<AqlamCategoryConfig[]> {
  if (rows.length < 1 || rows.length > AQLAM_MAX_CATEGORIES) {
    return { ok: false, error: `عدد التصنيفات بين ١ و${arNum(AQLAM_MAX_CATEGORIES)}.` };
  }
  const seen = new Set<string>();
  const out: AqlamCategoryConfig[] = [];
  for (const r of rows) {
    const key = r.key.trim().toLowerCase();
    const label = oneLine(r.label);
    if (!AQLAM_CATEGORY_KEY_RE.test(key)) {
      return { ok: false, error: `الكود «${r.key}» لازم يبدأ بحرف إنجليزي صغير ويتكوّن من حروف وأرقام و_ (٢–٢٤ حرف).` };
    }
    if (seen.has(key)) return { ok: false, error: `الكود «${key}» مكرر.` };
    seen.add(key);
    if (label.length < 1 || label.length > 30) return { ok: false, error: `اسم التصنيف «${key}» بين ١ و٣٠ حرف.` };
    out.push({ key, label, icon: isAqlamCategoryIcon(r.icon) ? r.icon : 'pen', enabled: r.enabled });
  }
  if (!out.some((c) => c.enabled)) return { ok: false, error: 'لازم يفضل تصنيف واحد مفعّل على الأقل.' };
  return { ok: true, value: out };
}

export function parseReactions(rows: { key: string; label: string; emoji: string; enabled: boolean }[]): ListParse<AqlamReactionConfig[]> {
  const out: AqlamReactionConfig[] = [];
  for (const k of AQLAM_REACTION_KEYS) {
    const r = rows.find((x) => x.key === k);
    if (!r) return { ok: false, error: 'التفاعلات الثلاثة لازم تكون موجودة.' };
    const label = oneLine(r.label);
    const emoji = oneLine(r.emoji);
    if (label.length < 1 || label.length > 20) return { ok: false, error: 'اسم الملصق بين ١ و٢٠ حرف.' };
    if (emoji.length < 1 || [...emoji].length > 8) return { ok: false, error: 'رمز الملصق بين ١ و٨ رموز.' };
    out.push({ key: k, label, emoji, enabled: r.enabled });
  }
  return { ok: true, value: out };
}

export function parseReportReasons(rows: { key: string; label: string; enabled: boolean }[]): ListParse<AqlamReportReasonConfig[]> {
  const out: AqlamReportReasonConfig[] = [];
  for (const k of AQLAM_REPORT_REASON_KEYS) {
    const r = rows.find((x) => x.key === k);
    if (!r) return { ok: false, error: 'أسباب البلاغ الخمسة لازم تكون موجودة.' };
    const label = oneLine(r.label);
    if (label.length < 1 || label.length > 40) return { ok: false, error: 'اسم سبب البلاغ بين ١ و٤٠ حرف.' };
    out.push({ key: k, label, enabled: r.enabled });
  }
  if (!out.some((r) => r.enabled)) return { ok: false, error: 'لازم يفضل سبب بلاغ واحد مفعّل على الأقل.' };
  return { ok: true, value: out };
}

/** الكلمات الممنوعة: سطر لكل كلمة، من غير تكرار، وكل كلمة ٢–٤٠ حرف (حتى ٣٠٠ كلمة). */
export function parseBlockedWords(raw: string): ListParse<string[]> {
  const words: string[] = [];
  const seen = new Set<string>();
  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const w = oneLine(line);
    if (!w) continue;
    if ([...w].length < 2 || [...w].length > 40) return { ok: false, error: `الكلمة «${w}» لازم تكون بين ٢ و٤٠ حرف.` };
    if (seen.has(w.toLowerCase())) continue;
    seen.add(w.toLowerCase());
    words.push(w);
  }
  if (words.length > 300) return { ok: false, error: 'الحد الأقصى ٣٠٠ كلمة.' };
  return { ok: true, value: words };
}

/** ترابط خانات الحدود (نفس فحوصات القاعدة، برسالة عربي). null = سليم. */
export function validateConfigRelations(cfg: AqlamConfig): string | null {
  const l = cfg.limits;
  if (l.bodyMin >= l.bodyMax) return 'أقل طول للنص لازم يكون أصغر من أقصى طول.';
  if (l.penNameMin > l.penNameMax) return 'أقل طول للاسم القلمي لازم يكون أقل من أو يساوي الأقصى.';
  if (l.guardianReasonMin > l.guardianReasonMax) return 'أقل طول لسبب ولي الأمر لازم يكون أقل من أو يساوي الأقصى.';
  if (!cfg.filters.sorts.includes(cfg.filters.defaultSort)) return 'الترتيب الافتراضي لازم يكون من الترتيبات المفعّلة.';
  return null;
}

// ── قراءة الإعداد المخزّن (متسامحة: أي خانة ناقصة أو غلط ← الافتراضي) ───────────────

function pickInt(v: unknown, d: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : d;
}
function pickBool(v: unknown, d: boolean): boolean {
  return typeof v === 'boolean' ? v : d;
}
function pickText(v: unknown, d: string, minLen: number, maxLen: number): string {
  if (typeof v !== 'string') return d;
  const t = v.trim();
  return t.length >= minLen && t.length <= maxLen ? t : d;
}

function normalizeScalars(raw: unknown): AqlamConfig {
  const base = cloneConfig(DEFAULT_AQLAM_CONFIG);
  let cfg = base;
  for (const f of AQLAM_FIELDS) {
    const dv = getAtPath(DEFAULT_AQLAM_CONFIG, f.path);
    const rv = getAtPath(raw, f.path);
    let value: unknown;
    switch (f.kind) {
      case 'int':
        value = pickInt(rv, dv as number, f.min, f.max);
        break;
      case 'bool':
        value = pickBool(rv, dv as boolean);
        break;
      case 'enum':
        value = typeof rv === 'string' && f.options.some((o) => o.value === rv) ? rv : dv;
        break;
      case 'text':
        value = pickText(rv, dv as string, f.minLen, f.maxLen);
        break;
    }
    cfg = withValueAt(cfg, f.path, value);
  }
  return cfg;
}

export function normalizeAqlamConfig(raw: unknown): AqlamConfig {
  let cfg = normalizeScalars(raw);
  const r = (raw ?? {}) as Record<string, unknown>;

  // ترابط الحدود: لو القيمتين متعارضتين نرجع للافتراضي بدل ما نكسر الفحوصات.
  if (cfg.limits.bodyMin >= cfg.limits.bodyMax) {
    cfg = { ...cfg, limits: { ...cfg.limits, bodyMin: DEFAULT_AQLAM_CONFIG.limits.bodyMin, bodyMax: DEFAULT_AQLAM_CONFIG.limits.bodyMax } };
  }
  if (cfg.limits.penNameMin > cfg.limits.penNameMax) {
    cfg = { ...cfg, limits: { ...cfg.limits, penNameMin: DEFAULT_AQLAM_CONFIG.limits.penNameMin, penNameMax: DEFAULT_AQLAM_CONFIG.limits.penNameMax } };
  }
  if (cfg.limits.guardianReasonMin > cfg.limits.guardianReasonMax) {
    cfg = {
      ...cfg,
      limits: {
        ...cfg.limits,
        guardianReasonMin: DEFAULT_AQLAM_CONFIG.limits.guardianReasonMin,
        guardianReasonMax: DEFAULT_AQLAM_CONFIG.limits.guardianReasonMax,
      },
    };
  }

  const cats = Array.isArray(r.categories)
    ? parseCategories(
        (r.categories as Record<string, unknown>[]).map((c) => ({
          key: String(c?.key ?? ''),
          label: String(c?.label ?? ''),
          icon: String(c?.icon ?? 'pen'),
          enabled: c?.enabled !== false,
        })),
      )
    : null;
  const reactions = Array.isArray(r.reactions)
    ? parseReactions(
        (r.reactions as Record<string, unknown>[]).map((c) => ({
          key: String(c?.key ?? ''),
          label: String(c?.label ?? ''),
          emoji: String(c?.emoji ?? ''),
          enabled: c?.enabled !== false,
        })),
      )
    : null;
  const reasons = Array.isArray(r.reportReasons)
    ? parseReportReasons(
        (r.reportReasons as Record<string, unknown>[]).map((c) => ({
          key: String(c?.key ?? ''),
          label: String(c?.label ?? ''),
          enabled: c?.enabled !== false,
        })),
      )
    : null;

  const f = (r.filters ?? {}) as Record<string, unknown>;
  const sorts = Array.isArray(f.sorts)
    ? Array.from(new Set((f.sorts as unknown[]).filter(isAqlamSortKey)))
    : DEFAULT_AQLAM_CONFIG.filters.sorts;
  const safeSorts = sorts.length > 0 ? sorts : DEFAULT_AQLAM_CONFIG.filters.sorts;
  const ageBands = Array.isArray(f.ageBands)
    ? Array.from(new Set((f.ageBands as unknown[]).filter(isAgeBandId)))
    : DEFAULT_AQLAM_CONFIG.filters.ageBands;

  return {
    ...cfg,
    categories: cats && cats.ok ? cats.value : cloneConfig(DEFAULT_AQLAM_CONFIG).categories,
    reactions: reactions && reactions.ok ? reactions.value : cloneConfig(DEFAULT_AQLAM_CONFIG).reactions,
    reportReasons: reasons && reasons.ok ? reasons.value : cloneConfig(DEFAULT_AQLAM_CONFIG).reportReasons,
    filters: {
      ...cfg.filters,
      sorts: safeSorts,
      defaultSort: safeSorts.includes(cfg.filters.defaultSort) ? cfg.filters.defaultSort : safeSorts[0],
      ageBands,
    },
  };
}

// ── مساعدات القراءة في الواجهة ────────────────────────────────────────────────

export function enabledCategories(cfg: AqlamConfig): AqlamCategoryConfig[] {
  return cfg.categories.filter((c) => c.enabled);
}

/** تصنيف بمفتاحه (حتى لو متعطّل — النصوص القديمة بتفضل بتسميتها). */
export function categoryMeta(cfg: AqlamConfig, key: string): AqlamCategoryConfig | null {
  return cfg.categories.find((c) => c.key === key) ?? null;
}

export function enabledReactions(cfg: AqlamConfig): AqlamReactionConfig[] {
  return cfg.features.reactions ? cfg.reactions.filter((r) => r.enabled) : [];
}

export function enabledReportReasons(cfg: AqlamConfig): AqlamReportReasonConfig[] {
  return cfg.reportReasons.filter((r) => r.enabled);
}

/** شرايح السن المعروضة في الفلتر بترتيبها الطبيعي. */
export function visibleAgeBands(cfg: AqlamConfig) {
  return AGE_BANDS.filter((b) => cfg.filters.ageBands.includes(b.id));
}

/** الترتيبات المعروضة بترتيب ثابت (الأحدث، الأكتر تشجيعًا، الأقدم). */
export function visibleSorts(cfg: AqlamConfig): AqlamSortKey[] {
  return AQLAM_SORT_KEYS.filter((k) => cfg.filters.sorts.includes(k));
}

/** الترتيب المطلوب من الرابط لو مسموح، وإلا الافتراضي. */
export function resolveSort(cfg: AqlamConfig, raw: unknown): AqlamSortKey {
  return isAqlamSortKey(raw) && cfg.filters.sorts.includes(raw) ? raw : cfg.filters.defaultSort;
}
