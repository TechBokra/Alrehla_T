import type { PrivatePhoto } from '@/lib/private-upload-client';

/**
 * صورة مرفوعة قبل كده (وضع تعديل بند في السلة) مقابل ملف جديد.
 *
 * ── المشكلة ────────────────────────────────────────────────
 *
 * خانة الصورة في المعالج بتحمل `File` اتختار من الجهاز. لما العميل
 * يرجع يعدّل بند في السلة، صورته **مرفوعة بالفعل** على Cloudinary
 * ومحفوظة كـ`{ publicId, format }`. من غير التفرقة دي كان المعالج
 * يطلب منه يرفعها تاني — وهي موجودة.
 *
 * فبنحط الصورة المحفوظة نفسها في الخانة: التحقق في المخطط بيعدّيها
 * (بيطلب قيمة موجودة وخلاص)، والرفع بيتخطّاها، والعرض بيقول «محفوظة».
 */
export function isSavedPhoto(value: unknown): value is PrivatePhoto {
  if (!value || typeof value !== 'object') return false;
  // ⚠️ `File` كائن كمان، فالتفرقة بوجود `publicId` مش بالنوع.
  const photo = value as Record<string, unknown>;
  return typeof photo.publicId === 'string' && photo.publicId !== '';
}
