import { z } from 'zod';

/**
 * فحص صورة المدرب (غلاف أو عمل) قبل ما تتكتب.
 *
 * ── العطل اللي الملف ده اتعمل عشانه ─────────────────────────
 *
 * 🔴 **رفع الغلاف كان بيرجّع «Invalid input» بالإنجليزي.** نموذج الغلاف
 *    مافيهوش خانتي «العنوان» و«المشاركة» (دول للأعمال بس)، فـ
 *    `formData.get('title')` بيرجّع `null` — والفحص كان بيقبل نص أو
 *    «مش موجود» أو فاضي، **مش `null`**. فـzod بيرفض برسالته الافتراضية
 *    («Invalid input»)، وهي اللي كانت بتظهر للمدرب. (ملاحظة فريق العمل.)
 *
 *    الحل: الخانة اللي مش في النموذج بتتقري كنص فاضي.
 *
 * ⚠️ الملف في `lib` مش جوّه الأكشن عشان يتختبر — ملفات `'use server'`
 *    مابتصدّرش غير دوال async.
 */

export const MAX_WORKS = 12;

const mediaInput = z.object({
  imageUrl: z
    .string({ required_error: 'ارفع صورة الأول' })
    .trim()
    .min(1, 'ارفع صورة الأول')
    // ⚠️ **الرابط لازم يكون من Cloudinary بتاعنا.** الخانة دي بتوصل
    //    للخادم كنصّ، وأي حد يقدر يبعت أي رابط — وساعتها الموقع بيعرض
    //    صورة من سيرفر تاني في صفحة عامة، بلا أي تحكّم فيها.
    .refine((u) => /^https:\/\/res\.cloudinary\.com\//.test(u), {
      message: 'الصورة لازم تترفع من الموقع نفسه',
    }),
  title: z.string().trim().max(120, 'العنوان طويل أوي'),
  contribution: z.string().trim().max(80, 'وصف المشاركة طويل أوي'),
});

/** الخانة الغايبة (`null`) أو الملف بدل النص = نص فاضي. */
const text = (v: FormDataEntryValue | null): string => (typeof v === 'string' ? v : '');

export function parseMediaInput(
  formData: FormData,
):
  | { ok: true; data: { imageUrl: string; title: string; contribution: string } }
  | { ok: false; error: string } {
  const parsed = mediaInput.safeParse({
    imageUrl: text(formData.get('imageUrl')),
    title: text(formData.get('title')),
    contribution: text(formData.get('contribution')),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' };
  }
  return { ok: true, data: parsed.data };
}
