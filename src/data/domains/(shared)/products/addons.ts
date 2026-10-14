import { AddonProduct } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { mapAddonRow, addonWithWatermark } from '@/data/domains/(shared)/products/products-internal';
import { applyAddonPromotions } from '@/lib/promotions';
import { getLivePromotions } from '@/data/domains/(shared)/promotions/live';

export const getAddonProducts = async (
  options: { includeInactive?: boolean } = {},
): Promise<AddonProduct[]> => {
  // ⚡ المفعّل عام — عميل الزائر عشان «أنت البطل» تتخزّن. الإدارة بالجلسة.
  const supabase = options.includeInactive ? await createClient() : createPublicClient();

  const query = supabase
    .from('addon_products')
    // ⚠️ `*` مش قايمة أعمدة: `image_url` جاي من ملف 12 والمعرض من ملف 19،
    //    ولو الكود اتنشر قبل الملف، تسمية العمود كانت هترجّع خطأ وتخفي
    //    كل الإضافات.
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const { data, error } = options.includeInactive
    ? await query
    : await query.eq('is_active', true);

  if (error || !data) return [];

  const addons = data.map(mapAddonRow);
  // ⚠️ الإدارة محتاجة الصورة الأصلية (تراجعها وتبدّلها) — العلامة للعام بس.
  if (options.includeInactive) return addons;
  // السعر بعد العرض الساري (للعرض فقط) — الإدارة فوق بتشوف الأصل.
  const promotions = await getLivePromotions();
  const now = new Date();
  return Promise.all(addons.map((a) => addonWithWatermark(applyAddonPromotions(a, promotions, now))));
};
