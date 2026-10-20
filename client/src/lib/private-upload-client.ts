import { getPrivateUploadTicket } from '@/actions/private-upload';
import { cloudinaryPost } from '@/lib/cloudinary';

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

/**
 * الصورة تنفع تترفع؟ `null` = تمام، وإلا رسالة الغلط.
 *
 * ⚠️ اختبار «إنها لك» (HS0L): الفحص ده كان بيحصل **وقت الرفع بس** — في
 *    آخر خطوة — فالعميل يختار ملف غلط في خطوة ٢ ويعرف في خطوة ٤.
 *    دلوقتي الخانة نفسها بتفحص أول ما الملف يتختار.
 */
export function photoFileProblem(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return 'نوع الملف غير مدعوم — استخدم صورة JPG أو PNG';
  if (file.size > MAX_BYTES) return 'حجم الصورة كبير — الحد الأقصى 10 ميجابايت';
  return null;
}

export async function uploadPrivatePhoto(
  file: File,
  kind: 'children' | 'covers' | 'receipts',
  onProgress?: (percent: number) => void,
): Promise<PrivatePhoto> {
  const problem = photoFileProblem(file);
  if (problem) throw new Error(problem);

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

  const data = (await cloudinaryPost(
    `https://api.cloudinary.com/v1_1/${t.cloudName}/image/upload`,
    body,
    onProgress,
  )) as { public_id?: string; format?: string };
  if (!data.public_id || !data.format) throw new Error('تعذّر رفع الصورة');
  return { publicId: data.public_id, format: data.format };
}
