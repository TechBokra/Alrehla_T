'use server';

import { requireUser } from '@/lib/auth-guard';
import { publicUploadTicket, type PublicUploadTicket } from '@/lib/cloudinary-private';
import { uploadFolderProblem } from '@/lib/upload-folders';

/**
 * تذكرة رفع صورة عامة (`lib/upload-folders` بيقول مين يرفع فين).
 *
 * ⚠️ بترجّع ولا بترمي (قاعدة «هـ»).
 */
export async function getUploadTicket(
  folder: string,
): Promise<{ ok: true; ticket: PublicUploadTicket } | { ok: false; error: string }> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'يجب تسجيل الدخول أولاً' };
  }
  const problem = uploadFolderProblem(folder, user.role);
  if (problem) return { ok: false, error: problem };

  const ticket = publicUploadTicket(folder);
  if (!ticket) {
    console.error('Upload ticket: CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET missing');
    return { ok: false, error: 'رفع الصور متوقف مؤقتًا — كلّمنا من صفحة الدعم.' };
  }
  return { ok: true, ticket };
}
