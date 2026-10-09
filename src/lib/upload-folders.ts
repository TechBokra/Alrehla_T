import type { UserRole } from '@/types';

/**
 * مين يرفع صور عامة في أنهي مجلّد على Cloudinary.
 *
 * ── ليه ─────────────────────────────────────────────────────
 *
 * الرفع كان بـ«مفتاح عام» (`alreha`، upload preset من غير توقيع):
 * اسمه مكتوب في كود المتصفح، فأي حد يعرفه يقدر يرفع على حسابنا من
 * برّه الموقع، في أي مجلّد، من غير ما يكون داخل أصلًا.
 *
 * دلوقتي كل رفعة محتاجة **تذكرة من السيرفر** (`actions/upload-ticket`)،
 * والتذكرة بتتعمل بس لو الدور ده مسموح له المجلّد ده. والتوقيع بيشمل
 * المجلّد نفسه، فلو المتصفح غيّره بعد ما خد التذكرة Cloudinary بيرفض.
 *
 * ⚠️ مجلّد جديد = سطر هنا، وإلا الرفع فيه هيترفض برسالة واضحة.
 */

type Who = 'admin' | 'publisher' | 'instructor' | 'anyone';

const ADMIN_ROLES: UserRole[] = ['super_admin', 'general_supervisor'];

export const UPLOAD_FOLDERS: Record<string, Who[]> = {
  // محتوى الموقع — الإدارة بس.
  'alrehla/site': ['admin'],
  'alrehla/blog': ['admin'],
  'alrehla/box-plans': ['admin'],
  'alrehla/addons': ['admin'],
  'alrehla/services': ['admin'],
  // المنتجات — الإدارة والناشرين (منتج الناشر بيعدّي على المراجعة).
  'alrehla/products': ['admin', 'publisher'],
  'alrehla/products/gallery': ['admin', 'publisher'],
  // ملف المدرب — بيعدّي على مراجعة الإدارة قبل ما يظهر.
  'alrehla/instructors/covers': ['admin', 'instructor'],
  'alrehla/instructors/works': ['admin', 'instructor'],
  // الصور الشخصية — أي حد داخل بحسابه.
  'alrehla/avatars': ['anyone'],
  'alrehla/children': ['anyone'],
  'alrehla/publishers': ['admin', 'publisher'],
};

/** `null` = مسموح، وإلا رسالة الرفض. */
export function uploadFolderProblem(folder: string, role: UserRole): string | null {
  const allowed = UPLOAD_FOLDERS[folder];
  if (!allowed) return 'مكان رفع الصورة مش معروف — حدّث الصفحة وجرّب تاني.';
  if (role === 'visitor') return 'يجب تسجيل الدخول أولاً';
  const ok = allowed.some((who) =>
    who === 'anyone' ||
    (who === 'admin' && ADMIN_ROLES.includes(role)) ||
    who === role,
  );
  return ok ? null : 'مش مسموح لحسابك يرفع صور هنا.';
}
