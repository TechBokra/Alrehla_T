/**
 * الملفات الخاصة (ملف 20) — ملفات طلبات الخدمات ومساحة الكتابة.
 *
 * الملف نفسه على Cloudinary **مخفي** (`authenticated`)، وجدول
 * `private_files` بيحفظ رقمه. اللي يقدر يقرا الصف (أطراف الطلب، أو
 * صاحب المستند وولي أمره ومدربه) بياخد رابط تحميل بيخلص بعد دقايق.
 *
 * ⚠️ الملف ده من غير React ولا قاعدة ولا أسرار — عشان يتختبر، ويتستعمل
 *    في المتصفح (فحص الملف قبل الرفع) وعلى الخادم (الفحص الحقيقي).
 */

export type FileKind = 'pdf' | 'word' | 'image';

export const FILE_KINDS: { kind: FileKind; label: string }[] = [
  { kind: 'pdf', label: 'PDF' },
  { kind: 'word', label: 'Word' },
  { kind: 'image', label: 'صور' },
];

/** حد Cloudinary على الخطة الحالية — ومحطوط قيد في القاعدة كمان. */
export const FILE_MAX_MB_LIMIT = 10;
/** حد مساحة الكتابة (مفيش إعداد لكل مستند). */
export const WORKSPACE_FILE_MAX_MB = 10;
/** عدد الملفات في الطلب الواحد / المستند الواحد. */
export const FILES_PER_ORDER_MAX = 20;
export const FILES_PER_DOCUMENT_MAX = 5;

export const DEFAULT_FILE_RETENTION_DAYS = 30;

const EXTENSIONS: Record<FileKind, string[]> = {
  pdf: ['pdf'],
  word: ['doc', 'docx'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
};

export function extensionOf(fileName: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(fileName.trim());
  return m ? m[1].toLowerCase() : '';
}

export function kindOfExtension(ext: string): FileKind | null {
  const e = ext.toLowerCase();
  for (const kind of Object.keys(EXTENSIONS) as FileKind[]) {
    if (EXTENSIONS[kind].includes(e)) return kind;
  }
  return null;
}

/** الامتدادات المسموحة لقايمة أنواع — لـ`accept` في خانة الملف ولتذكرة الرفع. */
export function extensionsFor(kinds: FileKind[]): string[] {
  return kinds.flatMap((k) => EXTENSIONS[k] ?? []);
}

export function acceptAttr(kinds: FileKind[]): string {
  return extensionsFor(kinds).map((e) => `.${e}`).join(',');
}

export function kindsLabel(kinds: FileKind[]): string {
  return FILE_KINDS.filter((k) => kinds.includes(k.kind)).map((k) => k.label).join(' أو ');
}

/** القيمة من القاعدة أو النموذج ← قايمة أنواع معروفة (الفاضي = الكل). */
export function normalizeKinds(value: unknown): FileKind[] {
  const known = FILE_KINDS.map((k) => k.kind);
  const list = Array.isArray(value) ? value.filter((v): v is FileKind => known.includes(v)) : [];
  return list.length ? [...new Set(list)] : known;
}

export function normalizeMaxMb(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return FILE_MAX_MB_LIMIT;
  return Math.min(n, FILE_MAX_MB_LIMIT);
}

export type FileRules = { kinds: FileKind[]; maxMb: number };

/** الملف ينفع يترفع؟ `null` = تمام، وإلا رسالة الغلط بالعربي. */
export function fileProblem(file: { name: string; size: number }, rules: FileRules): string | null {
  const kind = kindOfExtension(extensionOf(file.name));
  if (!kind || !rules.kinds.includes(kind)) {
    return `نوع الملف مش مسموح هنا — المسموح: ${kindsLabel(rules.kinds)}`;
  }
  if (file.size <= 0) return 'الملف فاضي';
  if (file.size > rules.maxMb * 1024 * 1024) {
    return `حجم الملف أكبر من ${rules.maxMb} ميجا`;
  }
  return null;
}

/**
 * الصور بتترفع «صورة» والباقي «ملف خام» على Cloudinary. الخام
 * مابيتعدّلش ولا بيتحوّل — بينزل زي ما اترفع بالظبط.
 */
export function resourceTypeFor(kind: FileKind): 'image' | 'raw' {
  return kind === 'image' ? 'image' : 'raw';
}

/** اسم ملف آمن للعرض — من غير مسارات ولا رموز تحكم، ولحد ٢٠٠ حرف. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (clean || 'ملف').slice(0, 200);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ميجا`;
  return `${Math.max(1, Math.round(bytes / 1024))} كيلو`;
}

export function normalizeRetentionDays(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_FILE_RETENTION_DAYS;
  return Math.min(365, Math.max(7, n));
}

/** جملة التنبيه اللي بتظهر قبل الرفع. */
export function retentionNotice(days: number, closedLabel: string): string {
  return `الملفات بتتمسح من السيرفر بعد ${days} يوم من ${closedLabel} — نزّل نسختك قبلها.`;
}

const DAY = 24 * 60 * 60 * 1000;

/** حالات الطلب اللي بتبدأ عندها مدة الحفظ. */
export const CLOSED_ORDER_STATUSES = ['completed', 'cancelled', 'refunded'] as const;

/**
 * الملف ده خلصت مدته؟
 *
 * المدة بتبدأ من **قفل الطلب** (أو مراجعة المستند)، ومن رفع الملف لو
 * اترفع بعد كده. الطلب اللي لسه شغال ملفاته مابتتمسحش.
 */
export function fileExpired(
  file: { createdAt: string },
  owner: { closed: boolean; closedAt?: string | null },
  days: number,
  now: Date,
): boolean {
  if (!owner.closed) return false;
  const created = Date.parse(file.createdAt);
  const closed = owner.closedAt ? Date.parse(owner.closedAt) : NaN;
  const start = Math.max(Number.isFinite(created) ? created : 0, Number.isFinite(closed) ? closed : 0);
  if (!start) return false;
  return now.getTime() - start > days * DAY;
}

/** تاريخ المسح المتوقّع (للعرض) — `null` لو الطلب لسه شغال. */
export function fileExpiryDate(
  file: { createdAt: string },
  owner: { closed: boolean; closedAt?: string | null },
  days: number,
): Date | null {
  if (!owner.closed) return null;
  const created = Date.parse(file.createdAt);
  const closed = owner.closedAt ? Date.parse(owner.closedAt) : NaN;
  const start = Math.max(Number.isFinite(created) ? created : 0, Number.isFinite(closed) ? closed : 0);
  return start ? new Date(start + days * DAY) : null;
}

/** مجلد ملفات الطلب/المستند على Cloudinary — التذكرة بتوقّع عليه. */
export function privateFilesFolder(owner: { orderId?: string; documentId?: string }): string {
  if (owner.orderId) return `alrehla/private/orders/${owner.orderId}`;
  return `alrehla/private/writing/${owner.documentId}`;
}
