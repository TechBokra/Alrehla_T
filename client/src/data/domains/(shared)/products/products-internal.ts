import { PersonalizedProduct, AddonProduct } from '@/types';
import { getWatermarkLayer } from '@/lib/watermark';
import { watermarkedImageUrl } from '@/lib/cloudinary';

/**
 * صفّ المنتج من القاعدة ← شكل الكود. **مكان واحد للتلات دوال.**
 *
 * ⚠️ كانت التحويلة مكتوبة تلات مرات (القايمة، المنتج الواحد،
 *    المراجعة)، وكل عمود جديد لازم يتضاف في التلاتة. ملف 130 أضاف
 *    عمودين فاتضافوا في التلاتة — **صدفة لا ضمان**. وعمود السنّ (ملف
 *    132) كان هيبقى الرابع: يتضاف في القايمة وينسى صفحة المنتج،
 *    فالكارت يقول «٦–٩» والصفحة ماتقولش حاجة.
 */
export function mapProductRow(p: any): PersonalizedProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.price,
    electronicPrice: p.electronic_price || undefined,
    shortDescription: p.short_description ?? '',
    coverImageUrl: p.cover_image_url || undefined,
    publisherId: p.publisher_id || undefined,
    ownerType: p.owner_type,
    publisherCost: p.publisher_cost ?? undefined,
    features: p.features || undefined,
    longDescription: p.long_description || undefined,
    galleryImageUrls: p.gallery_image_urls || undefined,
    // ⚠️ `??` لا `||`: السنّ صفر رقم حقيقي، و`||` كانت هتقراه «مفيش».
    minAge: p.min_age ?? undefined,
    maxAge: p.max_age ?? undefined,
    writingStyles: Array.isArray(p.writing_styles) && p.writing_styles.length > 0 ? p.writing_styles : undefined,
    // ⚠️ العمود في القاعدة `text` بـ`CHECK` (قرار ملف 130: الـenum
    //    صعب التعديل)، فالتحويل هنا بيضيّقه للنوع اللي الشاشات
    //    بتتعامل معاه. وأي قيمة غريبة بتتقري «في الانتظار» — الأأمن:
    //    المنتج يفضل مستخبي لحد ما حد يبصّ.
    reviewStatus: (['pending', 'approved', 'rejected'] as const).includes(p.review_status)
      ? p.review_status
      : 'pending',
    reviewNote: p.review_note || undefined,
    isActive: p.is_active ?? true,
    createdAt: p.created_at ?? undefined,
    sortOrder: typeof p.sort_order === 'number' ? p.sort_order : 0,
    // ملف 16: المسودة = نفس الصف بقيم الناشر الجديدة فوقه.
    pendingDraft:
      p.pending_changes && typeof p.pending_changes === 'object'
        ? mapProductRow({ ...p, ...p.pending_changes, pending_changes: null })
        : undefined,
  };
}

/**
 * Add-on products have no table in the database yet — the shape and business
 * rules still need deciding. Until then a customer must never be offered one:
 * they would be selecting, and paying for, something that does not exist.
 * الإضافات المتاحة مع المنتجات المخصّصة.
 *
 * كانت بترجّع قايمة فاضية دايمًا في الإنتاج، وقبلها كانت تلات إضافات
 * بأسعار مكتوبة في كود المتصفح مالهاش جدول. دلوقتي من `addon_products`.
 */
/** صفّ الإضافة من القاعدة ← شكل الكود. مكان واحد للقايمة والإضافة الواحدة. */
export function mapAddonRow(a: any): AddonProduct {
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    description: a.description ?? undefined,
    price: a.price,
    isActive: a.is_active,
    sortOrder: a.sort_order,
    supportsCustomization: a.supports_customization ?? false,
    customizationPrice: a.customization_price ?? 0,
    // ⚠️ **الافتراضي «مطبوعة» عن قصد** — قبل ترحيل ٢٣ أكتوبر العمود
    //    مش موجود، والإضافات كلها كانت بتتشحن. الافتراض الآمن هو
    //    السلوك القديم: نطلب الشحن. العكس (نفترض إلكترونية) كان
    //    هيخلّي طلبًا فيه بوستر يعدّي من غير عنوان.
    deliveryFormat:
      a.delivery_format === 'electronic' || a.delivery_format === 'both'
        ? a.delivery_format
        : 'printed',
    imageUrl: a.image_url || undefined,
    // ملف 19 — قبله الخانات دي مش موجودة فبتيجي `undefined`.
    galleryImageUrls: a.gallery_image_urls?.length ? a.gallery_image_urls : undefined,
    longDescription: a.long_description || undefined,
    features: a.features?.length ? a.features : undefined,
  };
}

/** صور الإضافة بالعلامة المائية للصفحات العامة — نفس قاعدة صور المنتج. */
export async function addonWithWatermark(addon: AddonProduct): Promise<AddonProduct> {
  const layer = await getWatermarkLayer();
  if (!layer) return addon;
  return {
    ...addon,
    imageUrl: watermarkedImageUrl(addon.imageUrl, layer),
    galleryImageUrls: addon.galleryImageUrls?.map((u) => watermarkedImageUrl(u, layer) ?? u),
  };
}
