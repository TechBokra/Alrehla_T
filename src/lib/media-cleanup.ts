/**
 * المسح التلقائي للصور المتسابة (قرار تامر، 9 أكتوبر: «موافق»).
 *
 * ── الفكرة ──────────────────────────────────────────────────
 *
 * مهمة يومية (`api/cron/media-cleanup`) بتفحص الصور زي شاشة «مكتبة
 * الوسائط» بالظبط، و**بتمسح بس الصورة اللي فضلت متسابة المدة كلها**
 * (افتراضيًّا ٣٠ يوم) — مش الصورة اللي اترفعت من ٣٠ يوم.
 *
 * ⚠️ الفرق ده مهم: صورة منتج اترفعت من شهرين واتبدّلت **امبارح** لو
 *    اتحسبت بتاريخ رفعها كانت هتتمسح النهارده — ومفيش فرصة ترجّعها لو
 *    التبديل كان غلط. فبنسجّل **أول يوم شفناها فيه متسابة**
 *    (`site_settings` بمفتاح `media_orphans`)، ولو رجعت تتستخدم بتتشال من
 *    السجل والعدّاد بيتصفّر.
 *
 * ── الحراسات (زي الحذف من الشاشة وأكتر) ──────────────────────
 *
 *   • فحص الجداول ناقص ← مفيش مسح خالص.
 *   • أكتر من نص الصور متسابة ← مفيش مسح (محتاج مراجعة بإيد من الشاشة)،
 *     بس العدّاد بيشتغل عادي.
 *   • قايمة Cloudinary اتقطعت (صور أكتر من الحد) ← مفيش مسح.
 *   • بحد أقصى ٥٠ صورة في اليوم، والمسح بيتسجّل بأرقام الصور.
 */

export const MEDIA_ORPHANS_KEY = 'media_orphans';
export const DEFAULT_CLEANUP_DAYS = 30;
export const MIN_CLEANUP_DAYS = 7;
export const MAX_CLEANUP_DAYS = 365;
export const MAX_DELETE_PER_RUN = 50;

export type MediaCleanupSettings = { enabled: boolean; days: number };

export const DEFAULT_MEDIA_CLEANUP: MediaCleanupSettings = {
  enabled: true,
  days: DEFAULT_CLEANUP_DAYS,
};

/** المدة بين ٧ أيام وسنة. أي حاجة تانية = الافتراضي. */
export function normalizeCleanupDays(raw: unknown): number {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < MIN_CLEANUP_DAYS || n > MAX_CLEANUP_DAYS) return DEFAULT_CLEANUP_DAYS;
  return n;
}

export function normalizeMediaCleanup(raw: unknown): MediaCleanupSettings {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof MediaCleanupSettings, unknown>>;
  return {
    // مفيش قيمة محفوظة = شغّال (قرار تامر).
    enabled: v.enabled === undefined ? true : v.enabled === true,
    days: normalizeCleanupDays(v.days ?? DEFAULT_CLEANUP_DAYS),
  };
}

/** السجل: رقم الصورة ← أول يوم اتشافت فيه متسابة (ISO). */
export type OrphanLedger = Record<string, string>;

export function normalizeLedger(raw: unknown): OrphanLedger {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: OrphanLedger = {};
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof at === 'string' && !Number.isNaN(Date.parse(at))) out[id] = at;
  }
  return out;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * السجل الجديد + اللي يتمسح النهارده.
 *
 * - المتسابة الجديدة بتدخل السجل بتاريخ النهارده.
 * - اللي رجعت تتستخدم (أو اتمسحت من Cloudinary) بتخرج منه.
 * - اللي عدّى عليها `days` يوم في السجل = تتمسح (أقدم الأول، بالحد الأقصى).
 */
export function planCleanup(params: {
  orphanIds: string[];
  ledger: OrphanLedger;
  days: number;
  now?: Date;
  max?: number;
}): { ledger: OrphanLedger; due: string[] } {
  const now = params.now ?? new Date();
  const max = params.max ?? MAX_DELETE_PER_RUN;
  const ledger: OrphanLedger = {};
  for (const id of params.orphanIds) {
    ledger[id] = params.ledger[id] ?? now.toISOString();
  }
  const due = Object.entries(ledger)
    .filter(([, at]) => now.getTime() - Date.parse(at) >= params.days * DAY)
    .sort(([, a], [, b]) => Date.parse(a) - Date.parse(b))
    .slice(0, max)
    .map(([id]) => id);
  return { ledger, due };
}

/** يوم المسح المتوقّع لصورة في السجل (للعرض في الشاشة). */
export function autoDeleteDate(firstSeen: string | undefined, days: number): Date | null {
  if (!firstSeen) return null;
  const t = Date.parse(firstSeen);
  return Number.isNaN(t) ? null : new Date(t + days * DAY);
}
