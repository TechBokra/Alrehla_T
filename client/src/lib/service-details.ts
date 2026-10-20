/**
 * تفاصيل الخدمة الإبداعية (ملف 09) — فحص وتنضيف قبل الحفظ، وكلام العرض.
 *
 * ⚠️ نفس حدود القاعدة بالحرف (قيود ملف 09) — عشان الإداري ياخد رسالة
 *    عربي مفهومة بدل رفض القاعدة الخام.
 * ⚠️ الملف من غير React ولا قاعدة — عشان يتختبر.
 */

export const SERVICE_GALLERY_MAX = 8;
export const DELIVERABLES_MAX = 8;
export const LONG_DESCRIPTION_MAX = 5000;
export const REQUIREMENTS_MAX = 1500;
export const DELIVERY_DAYS_MAX = 90;
export const BRIEF_MAX = 3000;

const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\//;

export type ServiceDetailsInput = {
  coverImageUrl?: string;
  galleryImageUrls?: string[];
  longDescription?: string;
  /** سطر لكل نقطة — زي خانة «التفاصيل» في المنتجات. */
  deliverablesText?: string;
  requirements?: string;
  /** فاضي أو 0 = مش محددة. */
  deliveryDays?: number | null;
};

export type ServiceDetailsRow = {
  cover_image_url: string | null;
  gallery_image_urls: string[] | null;
  long_description: string | null;
  deliverables: string[] | null;
  requirements: string | null;
  delivery_days: number | null;
};

/**
 * ⚠️ **الصور لازم تكون من Cloudinary بتاعنا** — الخانة بتوصل للخادم كنصّ،
 *    وأي رابط تاني معناه صفحة عامة بتعرض صورة من سيرفر مش بتاعنا.
 */
export function cleanServiceDetails(
  input: ServiceDetailsInput,
): { ok: true; row: ServiceDetailsRow } | { ok: false; error: string } {
  const cover = (input.coverImageUrl ?? '').trim();
  if (cover && !CLOUDINARY.test(cover)) {
    return { ok: false, error: 'صورة الخدمة لازم تترفع من الموقع نفسه' };
  }

  const gallery = [
    ...new Set((input.galleryImageUrls ?? []).map((u) => u.trim()).filter(Boolean)),
  ];
  if (gallery.some((u) => !CLOUDINARY.test(u))) {
    return { ok: false, error: 'صور النماذج لازم تترفع من الموقع نفسه' };
  }
  if (gallery.length > SERVICE_GALLERY_MAX) {
    return { ok: false, error: `النماذج حدّها ${SERVICE_GALLERY_MAX} صور` };
  }

  const longDescription = (input.longDescription ?? '').trim();
  if (longDescription.length > LONG_DESCRIPTION_MAX) {
    return { ok: false, error: `«عن الخدمة» أطول من ${LONG_DESCRIPTION_MAX} حرف` };
  }

  const deliverables = [
    ...new Set(
      (input.deliverablesText ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ];
  if (deliverables.length > DELIVERABLES_MAX) {
    return { ok: false, error: `«هتاخد إيه» حدّها ${DELIVERABLES_MAX} نقط` };
  }
  if (deliverables.some((d) => d.length > 120)) {
    return { ok: false, error: 'نقطة في «هتاخد إيه» أطول من 120 حرف' };
  }

  const requirements = (input.requirements ?? '').trim();
  if (requirements.length > REQUIREMENTS_MAX) {
    return { ok: false, error: `«محتاجين منك إيه» أطول من ${REQUIREMENTS_MAX} حرف` };
  }

  const days = input.deliveryDays;
  let deliveryDays: number | null = null;
  if (days !== null && days !== undefined && days !== 0) {
    if (!Number.isInteger(days) || days < 1 || days > DELIVERY_DAYS_MAX) {
      return { ok: false, error: `مدة التسليم لازم تكون من 1 لـ ${DELIVERY_DAYS_MAX} يوم` };
    }
    deliveryDays = days;
  }

  return {
    ok: true,
    row: {
      cover_image_url: cover || null,
      gallery_image_urls: gallery.length ? gallery : null,
      long_description: longDescription || null,
      deliverables: deliverables.length ? deliverables : null,
      requirements: requirements || null,
      delivery_days: deliveryDays,
    },
  };
}

/** «خلال ٣ أيام» / «خلال يوم واحد» — للكارت وصفحة الخدمة. */
export function deliveryLabel(days: number | undefined | null): string | null {
  if (!days || days < 1) return null;
  if (days === 1) return 'التسليم خلال يوم واحد';
  if (days === 2) return 'التسليم خلال يومين';
  const n = days.toLocaleString('ar-EG');
  return days <= 10 ? `التسليم خلال ${n} أيام` : `التسليم خلال ${n} يوم`;
}

/** رسالة «تفاصيل طلبك» — أول رسالة في محادثة الطلب. `null` = العميل ماكتبش. */
export function briefMessage(brief: string | null | undefined): string | null {
  const text = (brief ?? '').trim();
  if (!text) return null;
  return `📝 تفاصيل الطلب من العميل:\n${text.slice(0, BRIEF_MAX)}`;
}
