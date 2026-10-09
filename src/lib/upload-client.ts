import { getUploadTicket } from '@/actions/upload-ticket';
import { cloudinaryPost } from '@/lib/cloudinary';

/**
 * رفع صورة عامة من المتصفح لـCloudinary — بتذكرة موقّعة من السيرفر.
 *
 * كان الرفع بـ«مفتاح عام» (preset من غير توقيع) أي حد يقدر يستخدمه من
 * برّه الموقع. دلوقتي السيرفر بيدّي تذكرة لمجلّد واحد، بس للي داخل
 * ودوره مسموح له المجلّد ده (`lib/upload-folders`).
 */

export type UploadedImage = {
  url: string;
  publicId: string;
};

const MAX_BYTES = 10 * 1024 * 1024;
// SVG مسموح للشعارات: التحويلات على Cloudinary بتحوّله لصورة نقطية عند
// العرض، فمفيش أي كود جواه بيتنفّذ في متصفح الزائر.
const ALLOWED = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/svg+xml',
];

export async function uploadImage(
  file: File,
  folder: string,
  onProgress?: (percent: number) => void,
): Promise<UploadedImage> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('نوع الملف غير مدعوم — استخدم صورة JPG أو PNG');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('حجم الصورة كبير — الحد الأقصى 10 ميجابايت');
  }

  const result = await getUploadTicket(folder);
  if (!result.ok) throw new Error(result.error);
  const t = result.ticket;

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', t.apiKey);
  body.append('timestamp', String(t.timestamp));
  body.append('signature', t.signature);
  body.append('folder', t.folder);
  body.append('upload_preset', t.uploadPreset);
  body.append('allowed_formats', t.allowedFormats);

  const data = (await cloudinaryPost(
    `https://api.cloudinary.com/v1_1/${t.cloudName}/image/upload`,
    body,
    onProgress,
  )) as { secure_url?: string; public_id?: string };
  if (!data.secure_url) throw new Error('تعذّر رفع الصورة');

  return { url: data.secure_url, publicId: data.public_id ?? '' };
}
