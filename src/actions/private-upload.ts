'use server';

import { requireNotDependent } from '@/lib/auth-guard';
import { privateUploadTicket, type PrivateUploadTicket } from '@/lib/cloudinary-private';

/**
 * تذكرة رفع صورة طفل خاصة (`@/lib/cloudinary-private`).
 *
 * ⚠️ **لازم يكون داخل** — زي الشراء نفسه (`resolveWizardChild`).
 *    من غير الشرط ده، أي زائر يقدر ياخد تذاكر ويملا الحساب صورًا.
 *
 * ⚠️ بترجّع ولا بترمي (قاعدة «هـ»): Next بيمسح نصّ الاستثناء في
 *    الإنتاج، والعميل كان هيشوف رسالة إنجليزي مبهمة وهو في آخر خطوة.
 */
export async function getPrivateUploadTicket(
  kind: 'children' | 'covers',
): Promise<{ ok: true; ticket: PrivateUploadTicket } | { ok: false; error: string }> {
  try {
    await requireNotDependent('الشراء');
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'يجب تسجيل الدخول أولاً' };
  }
  if (kind !== 'children' && kind !== 'covers') {
    return { ok: false, error: 'نوع الصورة غير معروف' };
  }
  const ticket = privateUploadTicket(kind);
  if (!ticket) {
    console.error('Private upload: CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET missing');
    return { ok: false, error: 'رفع الصور متوقف مؤقتًا — كلّمنا من صفحة الدعم.' };
  }
  return { ok: true, ticket };
}
