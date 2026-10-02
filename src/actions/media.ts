'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { getMediaUsage } from '@/data/domains/media';
import {
  deleteAssets,
  FOLDER,
  isCloudinaryAdminConfigured,
  listFolderAssets,
} from '@/lib/cloudinary-admin';

export type LibraryImage = {
  publicId: string;
  url: string;
  width: number;
  height: number;
  createdAt: string;
};

export type LibraryResult =
  | { ok: true; images: LibraryImage[]; truncated: boolean }
  | { ok: false; error: string };

/**
 * صور المكتبة لزرار «من المكتبة» في خانات الصور — **عشان الصورة
 * اللي اترفعت قبل كده تتستعمل تاني من غير رفع جديد**.
 *
 * ⚠️ **للإدارة بصلاحية المحتوى بس**، نفس صلاحية شاشة المكتبة. الناشر
 *    والمدرب مايشوفوش صور غيرهم.
 *
 * ⚠️ **صور الأطفال الخاصة مش هنا أصلًا**: `listFolderAssets` بتقرا
 *    نوع `upload` بس، وصور الأطفال نوعها `authenticated`.
 */
export async function listLibraryImages(): Promise<LibraryResult> {
  try {
    await requireAdmin('canManageContent', 'غير مصرح لك بفتح مكتبة الصور');
  } catch {
    return { ok: false, error: 'غير مصرح لك بفتح مكتبة الصور' };
  }

  if (!isCloudinaryAdminConfigured()) {
    return { ok: false, error: 'إعدادات Cloudinary ناقصة على الخادم.' };
  }

  const listed = await listFolderAssets(1000);
  if (!listed.ok) return { ok: false, error: listed.error };

  const images = listed.data.assets
    .map(({ publicId, url, width, height, createdAt }) => ({
      publicId,
      url,
      width,
      height,
      createdAt,
    }))
    // الأحدث الأول — اللي اترفع قريب غالبًا هو اللي بيتدوّر عليه.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { ok: true, images, truncated: listed.data.truncated };
}

export type DeleteMediaResult =
  { ok: true; deleted: number; skipped: number } | { ok: false; error: string };

/** أقصى عدد في المرة — عشان ضغطة واحدة ما تمسحش المجلّد كله. */
const MAX_PER_CALL = 50;

/**
 * حذف صور من مخزن الموقع.
 *
 * ── تلات حوارس، والترتيب بينهم مقصود ────────────────────────
 *
 * **① الصلاحية.** `canManageContent` — نفس صلاحية رفع الصور.
 *
 * **② المجلّد.** `deleteAssets` بترفض أي رقم برّه `alrehla/`، وبترفض
 *    **الطلب كله** لا بتحذف اللي جوّه وتسيب اللي برّه. الحساب مشترك
 *    مع مشروع تاني، والغلطة هنا بتمسح شغل حد تاني.
 *
 * **③ وأهمهم: الاستخدام بيتفحص هنا من جديد.**
 *
 * ⚠️ **الشاشة بتبعت أرقامًا، والخادم مابيصدّقش إنها مهجورة.**
 *    بيعيد فحص القاعدة بنفسه، ولو لقى أي رقم منهم **مستخدَمًا
 *    دلوقتي**، بيرفض الطلب كله.
 *
 *    والسبب مش بُعد نظر — ده سيناريو عادي: الإدارة بتفتح الشاشة،
 *    وفي نفس الوقت حد بيرفع منتجًا بصورة كانت مهجورة من دقيقة.
 *    الصفحة في متصفحها بقت قديمة، وضغطة الحذف بتمسح صورة منتج
 *    اتنشر لسه. الفحص من جديد بيقفل الفجوة دي.
 *
 *    وده كمان بيخلّي الفحص القديم (قايمة الأعمدة) يشتغل مرتين:
 *    مرة للعرض ومرة قبل الحذف مباشرةً.
 */
export async function deleteUnusedMedia(
  publicIds: string[]
): Promise<DeleteMediaResult> {
  let user;
  try {
    user = await requireAdmin('canManageContent', 'غير مصرح لك بحذف الصور');
  } catch {
    return { ok: false, error: 'غير مصرح لك بحذف الصور' };
  }

  if (!isCloudinaryAdminConfigured()) {
    return { ok: false, error: 'إعدادات Cloudinary ناقصة على الخادم.' };
  }

  const ids = [
    ...new Set(publicIds.filter((id) => typeof id === 'string' && id.trim())),
  ];
  if (ids.length === 0) return { ok: false, error: 'مفيش صور متحدّدة.' };
  if (ids.length > MAX_PER_CALL) {
    return {
      ok: false,
      error: `أقصى عدد في المرة ${MAX_PER_CALL} صورة. حدّد أقل وكرّر.`,
    };
  }

  const outside = ids.filter((id) => !id.startsWith(`${FOLDER}/`));
  if (outside.length > 0) {
    return {
      ok: false,
      error: 'فيه صور برّه مجلّد المشروع — الطلب اترفض بالكامل.',
    };
  }

  // ── الفحص من جديد ────────────────────────────────────────
  const usage = await getMediaUsage();

  // ⚠️ نفس قفل الشاشة، هنا في الخادم: لو أكتر من نص صور المجلّد بلا
  //    رابط، الأرجح إن القاعدة فاضية أو ناقصة — مش إن الصور مهجورة.
  //    (بعد إعادة بناء القاعدة يوم 2 أكتوبر 2026 كل الصور بانت كده.)
  const listed = await listFolderAssets();
  if (!listed.ok) return { ok: false, error: listed.error };
  const all = listed.data.assets;
  const unusedCount = all.filter((a) => !usage.has(a.publicId)).length;
  if (all.length > 0 && unusedCount > all.length / 2) {
    return {
      ok: false,
      error:
        'الحذف مقفول: أكتر من نص صور المكتبة مش مستخدمة — الأرجح إن الصور لسه ما رجعتش لأماكنها في الموقع.',
    };
  }
  const stillUsed = ids.filter((id) => usage.has(id));

  if (stillUsed.length > 0) {
    console.error('Refused delete of used assets', stillUsed);
    return {
      ok: false,
      error: `فيه ${stillUsed.length} صورة بقت مستخدَمة في الموقع دلوقتي. حدّث الصفحة وراجع قبل ما تحذف — الطلب اترفض بالكامل.`,
    };
  }

  const result = await deleteAssets(ids);
  if (!result.ok) return { ok: false, error: result.error };

  // ⚠️ الحذف **بيتسجّل بأرقام الصور نفسها**، مش بعددها. ده الأثر
  //    الوحيد اللي هيفضل لو طلع إن صورة كانت مهمة.
  await logAuditAction({
    actorProfileId: user.id,
    actorName: user.fullName,
    action: 'حذف صور من المخزن',
    entityType: 'media',
    metadata: { count: result.data.deleted, publicIds: result.data.deleted },
  });

  revalidatePath('/dashboard/admin/media');

  return {
    ok: true,
    deleted: result.data.deleted.length,
    skipped: ids.length - result.data.deleted.length,
  };
}
