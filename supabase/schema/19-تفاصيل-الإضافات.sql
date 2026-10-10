-- ============================================================
-- 19 — صفحة تفاصيل لكل إضافة (10 أكتوبر 2026)
-- ============================================================
--
-- ── ليه (ملاحظة تامر) ────────────────────────────────────────
--
-- «الإضافات المفروض تتبع نفس أسلوب عرض المنتجات: صورة رئيسية وصور
--  فرعية وصفحة تفاصيل. اللي بيفرّقها بس إنها مابتتطلبش لوحدها.»
--
-- الإضافة كان ليها اسم ووصف قصير وسعر وصورة واحدة (ملف 12). الملف ده
-- بيضيف نفس خانات المنتج:
--
--   gallery_image_urls  صور فرعية (لحد ٨) — من Cloudinary بتاعنا بس
--   long_description    الوصف الكامل في صفحة التفاصيل
--   features            نقاط التفاصيل (لحد ١٠)
--
-- ⚠️ **مفيش مسح ولا تغيير لأي بيانات.** ٣ خانات جديدة فاضية وحدودها.
--    ودالة إنشاء الطلب ماتغيّرتش: الإضافة لسه مابتتطلبش لوحدها.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ما الكود يتنشر. في SQL Editor → Run. لو اتشغّل مرتين بيقول.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'addon_products'
                AND column_name = 'gallery_image_urls') THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'addon_products'
                    AND column_name = 'image_url') THEN
    RAISE EXCEPTION 'شغّل ملف 12 الأول.';
  END IF;
END
$$;

ALTER TABLE public.addon_products
  ADD COLUMN gallery_image_urls text[],
  ADD COLUMN long_description   text,
  ADD COLUMN features           text[];

-- كل رابط في القايمة من Cloudinary بتاعنا؟ (القيد مايقدرش يلفّ على
-- قايمة لوحده، فدالة صغيرة بتعمل كده.)
CREATE FUNCTION public.all_cloudinary_urls(p_urls text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT coalesce(bool_and(u ~ '^https://res\.cloudinary\.com/'), true)
    FROM unnest(p_urls) AS u;
$function$;

-- نفس الحدود اللي في الشاشة — عشان أي نداء مباشر مايعدّيش قيمة غريبة.
ALTER TABLE public.addon_products
  ADD CONSTRAINT addon_products_gallery_max
    CHECK (gallery_image_urls IS NULL OR cardinality(gallery_image_urls) <= 8),
  -- صور Cloudinary بتاعنا بس — نفس حارس الصورة الرئيسية (ملف 12).
  ADD CONSTRAINT addon_products_gallery_cloudinary
    CHECK (gallery_image_urls IS NULL OR public.all_cloudinary_urls(gallery_image_urls)),
  ADD CONSTRAINT addon_products_features_max
    CHECK (features IS NULL OR cardinality(features) <= 10),
  ADD CONSTRAINT addon_products_long_description_length
    CHECK (long_description IS NULL OR char_length(long_description) <= 5000);

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- لازم يطلع ٣ سطور.
SELECT column_name AS "الخانة الجديدة", data_type AS "النوع"
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'addon_products'
   AND column_name IN ('gallery_image_urls', 'long_description', 'features')
 ORDER BY ordinal_position;
