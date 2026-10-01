import { getPrivateUploadTicket } from '@/actions/private-upload';

/**
 * رفع صورة طفل **خاصة** من المتصفح (التفاصيل في `@/lib/cloudinary-private`).
 *
 * الفرق عن `uploadImage`: الصورة مابترجعش برابط. بترجع **رقمها** بس،
 * والطلب بيحفظ الرقم — والإدارة وحدها بتفتحها برابط مؤقت.
 */

export type PrivatePhoto = { publicId: string; format: string };

const MAX_BYTES = 10 * 1024 * 1024;
// ⚠️ مفيش SVG هنا (عكس `uploadImage`): دي صورة وش طفل، مش شعار.
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function uploadPrivatePhoto(
  file: File,
  kind: 'children' | 'covers',
): Promise<PrivatePhoto> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('نوع الملف غير مدعوم — استخدم صورة JPG أو PNG');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('حجم الصورة كبير — الحد الأقصى 10 ميجابايت');
  }

  const result = await getPrivateUploadTicket(kind);
  if (!result.ok) throw new Error(result.error);
  const t = result.ticket;

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', t.apiKey);
  body.append('timestamp', String(t.timestamp));
  body.append('signature', t.signature);
  body.append('folder', t.folder);
  body.append('type', t.type);
  body.append('allowed_formats', t.allowedFormats);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${t.cloudName}/image/upload`, {
    method: 'POST',
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Private upload failed', response.status, detail);
    throw new Error('تعذّر رفع الصورة، برجاء المحاولة مرة أخرى');
  }

  const data = (await response.json()) as { public_id?: string; format?: string };
  if (!data.public_id || !data.format) throw new Error('تعذّر رفع الصورة');
  return { publicId: data.public_id, format: data.format };
}
