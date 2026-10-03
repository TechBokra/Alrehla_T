-- ============================================================
-- 09 — تفاصيل الخدمات الإبداعية (صورة، نماذج، وصف كامل…)
-- ============================================================
--
-- ── قبل الملف ده ─────────────────────────────────────────────
--
-- الخدمة الإبداعية كان ليها اسم وسعر وسطر وصف وتصنيف — وبس. فصفحة
-- الخدمات كانت كروت نص، ومفيش صفحة تفاصيل حقيقية للخدمة (ملاحظة تامر:
-- «أضعف جزء في الموقع»).
--
-- ── بعده (خطة اتوافق عليها) ─────────────────────────────────
--
-- خانات جديدة في `standalone_services` — **إضافة بس، مفيش تغيير ولا مسح**:
--
--   cover_image_url     صورة الخدمة (الكارت وأول صفحة التفاصيل)
--   gallery_image_urls  نماذج من شغل قبل كده (لحد ٨)
--   long_description    «عن الخدمة» — الوصف الكامل
--   deliverables        «هتاخد إيه» — نقط
--   requirements        «محتاجين منك إيه» — بيظهر كمان وقت الطلب
--   delivery_days       مدة التسليم بالأيام (١–٩٠)
--
-- كلهم اختياريين: الخدمات الموجودة بتفضل شغالة زي ما هي لحد ما الإدارة
-- تملاهم من «الخدمات الإبداعية» في اللوحة.
--
-- ⚠️ «تفاصيل طلبك» اللي العميل بيكتبها وقت الطلب **مش محتاجة خانة**:
--    بتتحفظ كأول رسالة في محادثة الطلب الموجودة.
--
-- الصلاحيات مابتتغيّرش: الكل بيقرا، والإدارة بس بتكتب (سياسات ملف 01).
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 08. مرة واحدة في SQL Editor → Run. ولو اتشغّل تاني بيقف من أوله.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'standalone_services'
       AND column_name = 'delivery_days'
  ) THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'addon_products_always_customized'
  ) THEN
    RAISE EXCEPTION 'شغّل ملف 08 الأول.';
  END IF;
END
$$;

ALTER TABLE public.standalone_services
  ADD COLUMN cover_image_url    text,
  ADD COLUMN gallery_image_urls text[],
  ADD COLUMN long_description   text,
  ADD COLUMN deliverables       text[],
  ADD COLUMN requirements       text,
  ADD COLUMN delivery_days      smallint;

-- نفس الحدود اللي في الشاشة — عشان أي نداء مباشر مايعدّيش قيمة غريبة.
ALTER TABLE public.standalone_services
  ADD CONSTRAINT standalone_services_delivery_days_range
    CHECK (delivery_days IS NULL OR delivery_days BETWEEN 1 AND 90),
  ADD CONSTRAINT standalone_services_gallery_max
    CHECK (gallery_image_urls IS NULL OR cardinality(gallery_image_urls) <= 8),
  ADD CONSTRAINT standalone_services_deliverables_max
    CHECK (deliverables IS NULL OR cardinality(deliverables) <= 8),
  ADD CONSTRAINT standalone_services_long_description_length
    CHECK (long_description IS NULL OR char_length(long_description) <= 5000),
  ADD CONSTRAINT standalone_services_requirements_length
    CHECK (requirements IS NULL OR char_length(requirements) <= 1500);

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- لازم يطلع ٦ سطور.
SELECT column_name AS "الخانة الجديدة", data_type AS "النوع"
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'standalone_services'
   AND column_name IN ('cover_image_url', 'gallery_image_urls', 'long_description',
                       'deliverables', 'requirements', 'delivery_days')
 ORDER BY ordinal_position;
