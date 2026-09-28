/**
 * Cloudinary Admin API — **الخادم وحده**.
 *
 * ⚠️ **المفتاحان دول بيقدروا يحذفوا صور.** الملف ده مافيهوش
 *    `'use client'` ومحدّش بيستورده من مكوّن متصفح، والاسمين في
 *    Vercel **بلا `NEXT_PUBLIC_`** عن قصد — الأسماء دي بتتحط في
 *    كود المتصفح وأي زائر يقراها.
 *
 * ── الحارس الأهم في الملف: `FOLDER` ─────────────────────────
 *
 * ⚠️ **حساب Cloudinary ده مشترك بين أكتر من مشروع.** في قايمة
 *    المفاتيح فيه مفتاح اسمه `Onlyhelio` — يعني صور مشروع تاني
 *    على نفس المساحة.
 *
 *    ولو الشاشة سألت «إيه الصور اللي مالهاش رابط في قاعدة
 *    الرحلة؟»، صور المشروع التاني **كلها** هتبان مهجورة — لأنها
 *    فعلًا مالهاش رابط عندنا. وضغطة حذف مجموعة كانت هتمسح مشروعًا
 *    تانيًا بالكامل.
 *
 *    فكل نداء هنا **مقيَّد بمجلّد `alrehla/`**، وهو المجلّد اللي
 *    `uploadImage` بترفع فيه. القيد في الكود مش خيارًا في الشاشة:
 *    الشاشة **مش شايفة** حاجة برّه المجلّد، فمش ممكن تحذفها.
 */

const API = 'https://api.cloudinary.com/v1_1';

/** المجلّد الوحيد اللي الشاشة بتشوفه. زيّه زي اللي في `uploadImage`. */
export const FOLDER = 'alrehla';

export type CloudinaryResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function isCloudinaryAdminConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET &&
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  );
}

async function call<T>(path: string, init: RequestInit = {}): Promise<CloudinaryResult<T>> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud || !key || !secret) {
    return {
      ok: false,
      error:
        'إعدادات Cloudinary ناقصة على الخادم (CLOUDINARY_API_KEY و CLOUDINARY_API_SECRET).',
    };
  }

  try {
    const response = await fetch(`${API}/${cloud}${path}`, {
      ...init,
      headers: {
        // Admin API بيستخدم Basic auth بالمفتاح والسرّ.
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      console.error('Cloudinary admin error', path, response.status, body);
      const detail =
        typeof (body as { error?: { message?: string } }).error?.message === 'string'
          ? (body as { error: { message: string } }).error.message
          : '';
      if (response.status === 401) {
        return {
          ok: false,
          error: `Cloudinary رفض المفتاح (401)${detail ? `: «${detail}»` : ''}. راجع CLOUDINARY_API_KEY و CLOUDINARY_API_SECRET في Vercel، واتأكد إنك عملت Redeploy.`,
        };
      }
      return {
        ok: false,
        error: `Cloudinary رفض الطلب (${response.status})${detail ? `: «${detail}»` : ''}.`,
      };
    }

    return { ok: true, data: body as T };
  } catch (err) {
    console.error('Cloudinary admin unreachable', path, err);
    return { ok: false, error: 'مقدرناش نوصل لـCloudinary. جرّب تاني.' };
  }
}

export type CloudinaryAsset = {
  publicId: string;
  url: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
  createdAt: string;
};

type RawAsset = {
  public_id: string;
  secure_url: string;
  bytes: number;
  width: number;
  height: number;
  format: string;
  created_at: string;
};

/**
 * كل صور المجلّد.
 *
 * ⚠️ **بنقرا على صفحات لحد سقف.** الحساب ممكن يكون فيه آلاف
 *    الصور، وقراءة الكل في نداء واحد بتعلّق الشاشة وبتستهلك حصة
 *    الـAPI. بنقف عند الحد ونقول للإدارة إن فيه كمان.
 */
export async function listFolderAssets(
  maxAssets = 500,
): Promise<CloudinaryResult<{ assets: CloudinaryAsset[]; truncated: boolean }>> {
  const assets: CloudinaryAsset[] = [];
  let cursor: string | undefined;
  let truncated = false;

  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({
      type: 'upload',
      // ⚠️ القيد على المجلّد — مش فلترة بعد القراءة.
      prefix: `${FOLDER}/`,
      max_results: '100',
    });
    if (cursor) query.set('next_cursor', cursor);

    const result = await call<{ resources?: RawAsset[]; next_cursor?: string }>(
      `/resources/image?${query}`,
    );
    if (!result.ok) return result;

    for (const raw of result.data.resources ?? []) {
      assets.push({
        publicId: raw.public_id,
        url: raw.secure_url,
        bytes: raw.bytes ?? 0,
        width: raw.width ?? 0,
        height: raw.height ?? 0,
        format: raw.format ?? '',
        createdAt: raw.created_at ?? '',
      });
    }

    cursor = result.data.next_cursor;
    if (!cursor) break;
    if (assets.length >= maxAssets) {
      truncated = true;
      break;
    }
  }

  return { ok: true, data: { assets, truncated } };
}

/**
 * حذف صور بأرقامها.
 *
 * ⚠️ **بيرفض أي رقم برّه المجلّد.** الفحص هنا مش في الشاشة، لأن
 *    اللي بيوصل للأكشن ممكن ما يكونش جاي من الشاشة (قاعدة «ع»).
 *    رقم واحد غلط بيوقّف الطلب كله — مش بنحذف البعض ونسيب البعض.
 */
export async function deleteAssets(
  publicIds: string[],
): Promise<CloudinaryResult<{ deleted: string[] }>> {
  const outside = publicIds.filter((id) => !id.startsWith(`${FOLDER}/`));
  if (outside.length > 0) {
    console.error('Refused delete outside folder', outside);
    return {
      ok: false,
      error: 'فيه صور برّه مجلّد المشروع — الطلب اترفض بالكامل.',
    };
  }
  if (publicIds.length === 0) return { ok: true, data: { deleted: [] } };

  const result = await call<{ deleted?: Record<string, string> }>('/resources/image/upload', {
    method: 'DELETE',
    body: JSON.stringify({ public_ids: publicIds }),
  });
  if (!result.ok) return result;

  const deleted = Object.entries(result.data.deleted ?? {})
    .filter(([, state]) => state === 'deleted')
    .map(([id]) => id);

  return { ok: true, data: { deleted } };
}

/**
 * استخراج رقم الصورة من رابطها.
 *
 * روابط المشروع شكلها:
 *   https://res.cloudinary.com/<cloud>/image/upload/<تحويلات>/v123/alrehla/site/x.jpg
 *
 * ⚠️ **والتحويلات مش ثابتة**: نفس الصورة ليها روابط كتير بمقاسات
 *    وقصّات مختلفة (`slotImageUrlAt` بتعمل واحدة لكل مقاس شاشة).
 *    فالمطابقة بالرابط الكامل **بتفشل**، ولازم تكون بالرقم اللي
 *    بعد `/v<رقم>/` وقبل الامتداد.
 */
export function publicIdFromUrl(url: string | null | undefined): string | null {
  if (!url || !url.includes('res.cloudinary.com')) return null;
  const match = url.match(/\/upload\/(?:[^/]+\/)*?v\d+\/(.+?)(?:\.[a-z0-9]+)?$/i);
  if (match?.[1]) return match[1];
  // رابط بلا رقم نسخة — الجزء اللي بعد `upload/` مباشرةً.
  const plain = url.match(/\/upload\/(?:[^/]+\/)*?([^/]+\/[^/]+?)(?:\.[a-z0-9]+)?$/i);
  return plain?.[1] ?? null;
}
