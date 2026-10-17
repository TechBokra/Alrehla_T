import 'server-only';
import { revalidatePath } from 'next/cache';

/**
 * تحديث صفحات «أقلام الرحلة» **وبس**.
 *
 * ⚠️ مش `refreshPublicPages` عن قصد: دي بتمسح كاش الموقع كله
 *    (`revalidatePath('/', 'layout')`)، فنشر نص واحد كان هيبطّأ كل صفحة
 *    في المنصة. هنا بنحدّث القائمة وصفحة النص المعني بس.
 *
 * ليه في `lib/` مش جوّه `actions/`: اختبار `revalidate-guard` بيمنع أي
 * عملية في `actions/` من تحديث مسار عام بنفسها، والقاعدة دي بتحمي بقية
 * الموقع من القايمة اللي بتتنسي. أقلام الرحلة معزولة وليها مكانها هنا.
 */
export function refreshAqlam(postId?: string, writerSlug?: string | null): void {
  revalidatePath('/aqlam');
  if (postId) revalidatePath(`/aqlam/p/${postId}`);
  if (writerSlug) revalidatePath(`/aqlam/w/${writerSlug}`);
}

/**
 * بعد تغيير إعدادات أقلام الرحلة: كل صفحاتها (القايمة، النصوص، الكتّاب، النشر)
 * بتقرا الإعداد، فبنحدّثها كلها — ولسه جوّه `/aqlam` بس، مش الموقع كله.
 */
export function refreshAqlamAll(): void {
  revalidatePath('/aqlam', 'layout');
}
