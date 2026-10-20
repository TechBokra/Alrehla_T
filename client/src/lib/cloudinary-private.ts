import 'server-only';
import { createHash } from 'node:crypto';

/**
 * صور الأطفال — **خاصة**، مش على رابط عام.
 *
 * ── المشكلة ────────────────────────────────────────────────
 *
 * صورة وش الطفل (معالج «أنت البطل هنا») وصورة الغلاف (تخصيص
 * المكتبة) كانت بتترفع بنفس طريقة صور المنتجات: **رابط عام دائم**.
 * أي حد يوصله الرابط يشوف الصورة للأبد، والرابط كان محفوظ في الطلب
 * وفي سلة المتصفح.
 *
 * ── الحل (قرار تامر: «صور وجوه الأطفال… موافق») ─────────────
 *
 *   ① الرفع **موقَّع من الخادم** بنوع `authenticated` — Cloudinary
 *      نفسه بيرفض يعرض الصورة من غير توقيع.
 *   ② الطلب بيحفظ **رقم الصورة بس** (`publicId` + الامتداد) — مفيش
 *      رابط يتسرّب من السلة أو من الطلب.
 *   ③ الإدارة بتشوف الصورة برابط **بينتهي بعد ساعة** بيتعمل ساعة فتح
 *      صفحة الطلب.
 *
 * ⚠️ **السرّ (`CLOUDINARY_API_SECRET`) مابيطلعش من الخادم أبدًا.** اللي
 *    بيروح للمتصفح هو **التوقيع** على باراميترات محددة — ولو العميل
 *    غيّر المجلّد أو النوع، Cloudinary بيرفض الرفع.
 */

import { parseReceiptRef } from '@/lib/receipt-ref';

export const PRIVATE_FOLDER = 'alrehla/private';
export const PRIVATE_TYPE = 'authenticated';
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,heic,heif';

/**
 * توقيع Cloudinary: الباراميترات مرتّبة أبجديًّا `key=value&…` + السرّ،
 * وبعدين SHA-1. (نفس `api_sign_request` في مكتبتهم.)
 *
 * ⚠️ القيم الفاضية بتتشال — زي مكتبتهم بالظبط، وإلا التوقيع مايطابقش.
 */
export function signParams(params: Record<string, string | number>, secret: string): string {
  const base = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(base + secret).digest('hex');
}

function credentials() {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) return null;
  return { cloud, key, secret };
}

export type PrivateUploadTicket = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  type: typeof PRIVATE_TYPE;
  allowedFormats: string;
};

/** تذكرة رفع واحدة — بتتحسب على الخادم، والمتصفح بيبعتها مع الملف. */
export function privateUploadTicket(
  subfolder: 'children' | 'covers' | 'receipts',
  now = Date.now(),
): PrivateUploadTicket | null {
  const c = credentials();
  if (!c) return null;
  const timestamp = Math.floor(now / 1000);
  const folder = `${PRIVATE_FOLDER}/${subfolder}`;
  const signature = signParams(
    { allowed_formats: ALLOWED_FORMATS, folder, timestamp, type: PRIVATE_TYPE },
    c.secret,
  );
  return {
    cloudName: c.cloud,
    apiKey: c.key,
    timestamp,
    signature,
    folder,
    type: PRIVATE_TYPE,
    allowedFormats: ALLOWED_FORMATS,
  };
}

/**
 * تذكرة رفع صورة **عامة** (صور المنتجات والموقع والصور الشخصية).
 *
 * نفس فكرة الخاصة: السيرفر بيوقّع على المجلّد، فالمتصفح مايقدرش يرفع
 * في مكان تاني، ومحدّش يقدر يرفع من غير ما ياخد تذكرة (يعني يكون داخل
 * ودوره مسموح له المجلّد — `lib/upload-folders`).
 *
 * `upload_preset` لسه موجود في التوقيع عشان إعدادات الـpreset (لو فيها
 * تحويلات أو حدود) تفضل شغالة زي ما هي. وده بيشتغل سواء الـpreset
 * «Unsigned» أو «Signed» — فلما نقلبه «Signed» في لوحة Cloudinary
 * الطريق القديم بس هو اللي بيتقفل.
 */
export const PUBLIC_UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'alreha';
const PUBLIC_FORMATS = 'jpg,jpeg,png,webp,heic,heif,svg';

export type PublicUploadTicket = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadPreset: string;
  allowedFormats: string;
};

export function publicUploadTicket(folder: string, now = Date.now()): PublicUploadTicket | null {
  const c = credentials();
  if (!c) return null;
  const timestamp = Math.floor(now / 1000);
  const signature = signParams(
    { allowed_formats: PUBLIC_FORMATS, folder, timestamp, upload_preset: PUBLIC_UPLOAD_PRESET },
    c.secret,
  );
  return {
    cloudName: c.cloud,
    apiKey: c.key,
    timestamp,
    signature,
    folder,
    uploadPreset: PUBLIC_UPLOAD_PRESET,
    allowedFormats: PUBLIC_FORMATS,
  };
}

/**
 * رابط مؤقت لصورة خاصة — **بينتهي** (افتراضيًّا بعد ساعة).
 *
 * ⚠️ مش رابط العرض الموقَّع العادي (`s--…--`): ده **مابينتهيش**، ولو
 *    اتنسخ من صفحة الإدارة يفضل شغّال للأبد. ده من `download` في
 *    Cloudinary، وفيه `expires_at`.
 *
 * `attachment` = الملف بينزل بدل ما يتفتح (زرار «تحميل للطباعة»).
 */
export function privateImageUrl(
  photo: { publicId: string; format: string },
  options: { attachment?: boolean; ttlSeconds?: number; now?: number } = {},
): string | null {
  const c = credentials();
  if (!c) return null;
  const timestamp = Math.floor((options.now ?? Date.now()) / 1000);
  const params: Record<string, string | number> = {
    expires_at: timestamp + (options.ttlSeconds ?? 3600),
    format: photo.format,
    public_id: photo.publicId,
    timestamp,
    type: PRIVATE_TYPE,
  };
  if (options.attachment) params.attachment = 'true';
  const signature = signParams(params, c.secret);
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    api_key: c.key,
    signature,
  });
  return `https://api.cloudinary.com/v1_1/${c.cloud}/image/download?${query}`;
}

/**
 * رابط عرض الإيصال للإدارة (`lib/receipt-ref`): الخاص برابط مؤقت،
 * والقديم (رابط عام) زي ما هو.
 */
export function receiptViewUrl(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const photo = parseReceiptRef(ref);
  if (photo) return privateImageUrl(photo);
  return ref;
}

/* ================================================================
 * الملفات الخاصة (ملف 20) — PDF وWord وصور في الطلبات ومساحة الكتابة
 * ================================================================ */

export type PrivateFileTicket = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  type: typeof PRIVATE_TYPE;
  allowedFormats: string;
  resourceType: 'image' | 'raw';
};

/**
 * تذكرة رفع ملف خاص في مجلد الطلب أو المستند.
 *
 * التوقيع بيشمل المجلد والأنواع، فالمتصفح مايقدرش يرفع في مكان تاني
 * ولا نوع تاني. **الحجم مابيتوقّعش** (Cloudinary مالوش باراميتر ليه) —
 * الخادم بيفحصه بعد الرفع من Cloudinary نفسه، ويمسح الملف لو أكبر.
 */
export function privateFileTicket(
  folder: string,
  resourceType: 'image' | 'raw',
  extensions: string[],
  now = Date.now(),
): PrivateFileTicket | null {
  const c = credentials();
  if (!c) return null;
  const timestamp = Math.floor(now / 1000);
  const allowedFormats = extensions.join(',');
  const signature = signParams(
    { allowed_formats: allowedFormats, folder, timestamp, type: PRIVATE_TYPE },
    c.secret,
  );
  return {
    cloudName: c.cloud,
    apiKey: c.key,
    timestamp,
    signature,
    folder,
    type: PRIVATE_TYPE,
    allowedFormats,
    resourceType,
  };
}

/**
 * رابط تحميل مؤقت لملف خاص (افتراضيًّا ١٠ دقايق) — بينزل باسم الملف.
 *
 * ⚠️ رقم الملف الخام فيه الامتداد نفسه (`…/abc.pdf`)، فمابنبعتش `format`.
 */
export function privateFileUrl(
  file: { publicId: string; resourceType: 'image' | 'raw'; format?: string | null },
  options: { ttlSeconds?: number; now?: number } = {},
): string | null {
  const c = credentials();
  if (!c) return null;
  const timestamp = Math.floor((options.now ?? Date.now()) / 1000);
  const params: Record<string, string | number> = {
    attachment: 'true',
    expires_at: timestamp + (options.ttlSeconds ?? 600),
    public_id: file.publicId,
    timestamp,
    type: PRIVATE_TYPE,
  };
  if (file.resourceType === 'image' && file.format) params.format = file.format;
  const signature = signParams(params, c.secret);
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    api_key: c.key,
    signature,
  });
  return `https://api.cloudinary.com/v1_1/${c.cloud}/${file.resourceType}/download?${query}`;
}
