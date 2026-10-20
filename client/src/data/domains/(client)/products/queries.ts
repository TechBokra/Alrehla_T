import { PersonalizedProduct } from '@/types';
import { getWatermarkLayer } from '@/lib/watermark';
import { watermarkedImageUrl } from '@/lib/cloudinary';
import { createPublicClient } from '@/lib/supabase/public';
import { mapProductRow } from '@/data/domains/(shared)/products/products-internal';
import { byDisplayOrder } from '@/data/domains/(shared)/products/queries';
import { decodeSlug } from '@/lib/utils';
import { applyProductPromotions } from '@/lib/promotions';
import { getLivePromotions } from '@/data/domains/(shared)/promotions/live';

/**
 * صور المنتج **بالعلامة المائية** للصفحات العامة (قرار تامر، 1 أكتوبر).
 *
 * ⚠️ **بتتحسب هنا على الخادم، قبل ما المنتج يتبعت للمتصفح** — فرابط
 *    الصورة الأصلية مابيوصلش لحمولة الصفحة خالص. لو اتحسبت في المكوّن،
 *    المنتج كان هيتبعت بالرابط الأصلي جوّه بيانات الصفحة، وأي حد يفتح
 *    المصدر ياخده نضيف.
 *
 * ⚠️ **واللوحات مابتمرّش من هنا** (`getManagedProducts`): الإدارة
 *    والناشر محتاجين الصورة الأصلية — يراجعوها ويبدّلوها.
 *
 * شكلها وتشغيلها من «الإعدادات العامة ← العلامة المائية».
 */
async function withWatermark(product: PersonalizedProduct): Promise<PersonalizedProduct> {
  const layer = await getWatermarkLayer();
  if (!layer) return product;
  return {
    ...product,
    coverImageUrl: watermarkedImageUrl(product.coverImageUrl, layer),
    galleryImageUrls: product.galleryImageUrls?.map((u) => watermarkedImageUrl(u, layer) ?? u),
  };
}

/**
 * منتجات المتجر — **للصفحات العامة وحدها**.
 *
 * بتقرا بعميل الزائر (عشان الصفحات تتخزّن)، فبترجّع المعتمد
 * المعروض بس — والفلترة دي **في سياسة القاعدة** (ملف 130)، مش هنا.
 *
 * ⚠️ **كان ليها خيار `includeInactive` واتشال.** من ملف 130 الخيار
 *    ماكانش بيعمل حاجة: سياسة الزائر بتشيل الموقوف قبل ما الطلب
 *    يوصل. واللوحات اللي كانت بتطلبه كانت فاكرة إنها شايفة كله —
 *    شوف `getManagedProducts` تحت. خيار بيوعد بحاجة مش بيعملها
 *    أوحش من غيابه، لأن اللي بعدنا هيستعمله.
 *
 * ⚠️ و`.eq('is_active', true)` باقي رغم إن السياسة بتعمله: لو
 *    السياسة اتوسّعت بعدين لأي سبب، الصفحات العامة تفضل آمنة.
 */
export const getPersonalizedProducts = async (): Promise<PersonalizedProduct[]> => {
  const supabase = createPublicClient();
  const query = supabase
    .from('personalized_products')
    .select('*')
    .eq('is_active', true)
    .eq('review_status', 'approved');
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching personalized products:', error);
    throw new Error('تعذّر تحميل المنتجات');
  }
  if (!data || data.length === 0) return [];

  const promotions = await getLivePromotions();
  const now = new Date();
  return Promise.all(
    data
      .map(mapProductRow)
      .sort(byDisplayOrder)
      .map((p) => withWatermark(applyProductPromotions(p, promotions, now))),
  );
};

/**
 * منتج واحد برابطه.
 *
 * ⚠️ **الموقوف بيرجّع `null`** — والصفحة بتطلع 404. البديل إنها
 *    تعرض المنتج مع منع الشراء، وده أوحش: العميل بيشوف السعر
 *    ويضغط ويترفض، وبيفتكر إن الموقع باظ.
 */
export const getProductBySlug = async (rawSlug: string): Promise<PersonalizedProduct | null> => {
  const slug = decodeSlug(rawSlug);
  const supabase = createPublicClient();
  const { data: current, error } = await supabase.from('personalized_products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  // ── رابط قديم؟ (ملف 136) ─────────────────────────────────
  //
  // الروابط اللي كانت `prod-<رقم>` اتغيّرت لأسماء مقروءة، والقديم
  // اتحفظ في `previous_slugs`. فلو الرابط مش لاقي منتج، بندوّر هنا —
  // والصفحة بتشوف إن `slug` الراجع غير المطلوب فبتحوّل تحويلًا دائمًا
  // (`productRedirectPath`). من غير ده، كل رابط اتبعت على واتساب قبل
  // التغيير كان هيوصل لـ«المنتج غير موجود».
  let data = current;
  if (!data && !error) {
    const { data: moved } = await supabase.from('personalized_products')
      .select('*')
      .contains('previous_slugs', [slug])
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    data = moved;
  }

  if (error || !data) return null;

  // ══ 🔴 هنا كان فيه شرط بيقتل نصّ الكتالوج ══════════════
  //
  // كان:
  //
  //     if (data.owner_type === 'platform') { return {...}; }
  //     return null;
  //
  // يعني **أي منتج ملك ناشر بيرجع «مش موجود»** — والتعليق اللي
  // كان فوقه بيعترف إنه بقايا من أيام البيانات الوهمية
  // («we'll keep the original logic for fallback»).
  //
  // ⚠️ **والمكتبة بطبيعتها إصدارات ناشرين.** يعني أول ما تربط
  //    كتابًا بناشر من لوحة الإدارة، صفحة تخصيصه بتموت بـ404 —
  //    والكتاب فاضل ظاهرًا في الشبكة وبزرّ «تخصيص الغلاف» شغّال
  //    شكلًا. العميل بيضغط فيلاقي «الصفحة غير موجودة».
  //
  // ⚠️ **والعطل كان صامتًا تمامًا**: الدالة بترجّع `null`، والصفحة
  //    بتقرا `null` على إنه «المنتج مش موجود» وتعمل `notFound()`.
  //    مافيش خطأ في أي سجلّ، ومافيش فرق بين «منتج اتحذف» و«منتج
  //    ملك ناشر».
  //
  // **ومالوش أي مبرّر**: كل الأعمدة اللي بتتقري موجودة في
  // النوعين، والصفحات اللي بتستعملها بتفلتر بالتصنيف لا بالملكية.
  // السعر بعد العرض الساري — للعرض فقط، والقاعدة بتحسب الحقيقي عند الطلب.
  return withWatermark(applyProductPromotions(mapProductRow(data), await getLivePromotions(), new Date()));
};
