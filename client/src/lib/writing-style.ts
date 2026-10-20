/**
 * أسلوب كتابة القصة المخصّصة («إنها لك»): فصحى / عربية مبسطة / لهجة بلد.
 *
 * المحفوظ في الطلب: `customization_data.writingStyle = { style, dialect? }`.
 * القاعدة (`create_customer_order`) هي اللي بترفض القيمة الغلط وبتختصرها —
 * ده الملف اللي بيوحّد العناوين والتحويل في الواجهة والإدارة بس.
 */

export const WRITING_STYLES = ['fusha', 'simple', 'dialect'] as const;
export type WritingStyle = (typeof WRITING_STYLES)[number];

export const DEFAULT_WRITING_STYLE: WritingStyle = 'simple';

export const WRITING_STYLE_LABELS: Record<WritingStyle, string> = {
  fusha: 'فصحى',
  simple: 'عربية مبسطة',
  dialect: 'لهجة',
};

export const WRITING_STYLE_HINTS: Record<WritingStyle, string> = {
  fusha: 'لغة عربية فصيحة سليمة، مناسبة لتعليم اللغة.',
  simple: 'عربية سهلة قريبة من الطفل، بلا تعقيد.',
  dialect: 'القصة تُكتب بلهجة بلدك كما يتحدث الأهل.',
};

export type WritingDialect = { code: string; nameAr: string };

/**
 * أسماء اللهجات المبذورة — احتياطي لعرض الطلبات القديمة لو الإدارة
 * عطّلت لهجة أو غيّرت اسمها (قايمة اللهجات الحيّة من جدول `writing_dialects`).
 */
const SEEDED_DIALECT_NAMES: Record<string, string> = {
  egyptian: 'اللهجة المصرية',
  gulf: 'اللهجة الخليجية',
  levantine: 'اللهجة الشامية',
  iraqi: 'اللهجة العراقية',
  maghrebi: 'اللهجة المغاربية',
  sudanese: 'اللهجة السودانية',
};

export type WritingStyleValue = { style: WritingStyle; dialect?: string };

export function isWritingStyle(v: unknown): v is WritingStyle {
  return typeof v === 'string' && (WRITING_STYLES as readonly string[]).includes(v);
}

/** الأساليب المتاحة للمنتج: `null`/فاضي = كلها. */
export function availableStyles(allowed: readonly string[] | null | undefined): WritingStyle[] {
  if (!allowed || allowed.length === 0) return [...WRITING_STYLES];
  const list = WRITING_STYLES.filter((s) => allowed.includes(s));
  return list.length > 0 ? list : [...WRITING_STYLES];
}

/**
 * قيمة النموذج ← ما يُرسل للطلب. `null` = ما يتبعتش (كود قديم / منتج مالوش أساليب).
 * اللهجة من غير اختيار لهجة = غير صالحة (`null`) عشان النموذج يوقّف العميل.
 */
export function buildWritingStyleValue(
  style: string | undefined,
  dialect: string | undefined,
  dialects: readonly WritingDialect[],
): WritingStyleValue | null {
  if (!isWritingStyle(style)) return null;
  if (style !== 'dialect') return { style };
  const code = (dialect ?? '').trim();
  if (!code || !dialects.some((d) => d.code === code)) return null;
  return { style, dialect: code };
}

/** رسالة خطأ لو الاختيار ناقص، وإلا `null`. */
export function writingStyleProblem(
  style: string | undefined,
  dialect: string | undefined,
  dialects: readonly WritingDialect[],
  allowed: readonly string[] | null | undefined,
): string | null {
  if (!isWritingStyle(style)) return 'اختار أسلوب الكتابة';
  if (!availableStyles(allowed).includes(style)) return 'أسلوب الكتابة ده مش متاح للقصة دي';
  if (style === 'dialect') {
    if (dialects.length === 0) return 'اللهجات غير متاحة الآن — اختار الفصحى أو العربية المبسطة';
    if (!buildWritingStyleValue(style, dialect, dialects)) return 'اختار اللهجة المطلوبة';
  }
  return null;
}

/** نص للعرض في المراجعة وصفحة الطلب. القيمة الغريبة بترجع `null` مش بتكسر الصفحة. */
export function describeWritingStyle(
  raw: unknown,
  dialects: readonly WritingDialect[] = [],
): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { style, dialect } = raw as Record<string, unknown>;
  if (!isWritingStyle(style)) return null;
  if (style !== 'dialect') return WRITING_STYLE_LABELS[style];
  const name =
    dialects.find((d) => d.code === dialect)?.nameAr ??
    (typeof dialect === 'string' ? SEEDED_DIALECT_NAMES[dialect] : undefined);
  if (name) return name;
  return typeof dialect === 'string' && dialect ? `${WRITING_STYLE_LABELS.dialect} (${dialect})` : WRITING_STYLE_LABELS.dialect;
}

/**
 * خانات الأساليب من نموذج المنتج ← قيمة العمود `writing_styles`.
 * الثلاثة (أو ترتيب مختلف) = `null` (بدون تقييد)، ولا واحد = خطأ، والغريب بيتتجاهل.
 */
export function parseWritingStylesInput(
  raw: readonly unknown[],
): { ok: true; styles: WritingStyle[] | null } | { ok: false; error: string } {
  const picked = WRITING_STYLES.filter((s) => raw.includes(s));
  if (picked.length === 0) return { ok: false, error: 'اختار أسلوب كتابة واحد على الأقل' };
  if (picked.length === WRITING_STYLES.length) return { ok: true, styles: null };
  return { ok: true, styles: picked };
}

export const DIALECT_CODE_PATTERN = /^[a-z_]{2,20}$/;
export const MAX_DIALECT_NAME = 60;

/** نفس قيود جدول `writing_dialects`، عشان الرسالة تبقى مفهومة بدل رفض القاعدة الخام. */
export function validateDialectInput(
  code: string,
  nameAr: string,
): { ok: true; code: string; nameAr: string } | { ok: false; error: string } {
  const c = (code ?? '').trim();
  const n = (nameAr ?? '').trim();
  if (!DIALECT_CODE_PATTERN.test(c)) {
    return { ok: false, error: 'الكود حروف إنجليزية صغيرة وشرطة سفلية فقط (٢ إلى ٢٠ حرفًا)' };
  }
  if (n.length === 0) return { ok: false, error: 'اكتب اسم اللهجة' };
  if (n.length > MAX_DIALECT_NAME) return { ok: false, error: `اسم اللهجة أطول من ${MAX_DIALECT_NAME} حرفًا` };
  return { ok: true, code: c, nameAr: n };
}
