-- ============================================================
-- 08 — كل الإضافات بتتخصص، وبسعر واحد
-- ============================================================
--
-- ── قبل الملف ده ─────────────────────────────────────────────
--
-- ملف 07 خلّى الإضافة اللي «بتقبل التخصيص» تتخصص دايمًا. بس كان لسه
-- فيه إضافات «مابتقبلش التخصيص» بتتباع عادي، وكل إضافة ليها سعرين:
-- سعرها + «فرق التخصيص». فالعميل كان بيشوف في صفحة «أنت البطل هنا»
-- السعر من غير التخصيص (ملاحظة تامر).
--
-- ── بعده (قرار تامر: «التخصيص على الكل») ────────────────────
--
-- • **كل الإضافات بتتخصص** باسم الطفل وصورته — مفيش إضافة عادية.
--   والقاعدة بتمنع إضافة تتسجّل «مابتقبلش التخصيص» (قيد).
-- • **سعر واحد** للإضافة = السعر اللي العميل بيدفعه شامل التخصيص.
--   الإضافات الموجودة: السعر الجديد = سعرها + فرق تخصيصها القديم،
--   وفرق التخصيص بقى صفر. يعني **اللي العميل بيدفعه في الإضافة
--   المخصّصة مابيتغيّرش**.
--
-- ⚠️ **الإضافات اللي كانت «مابتقبلش التخصيص»** بقت بتتخصص بنفس سعرها
--    القديم. لو التخصيص بيكلّف أكتر، عدّل سعرها من «إضافات المنتجات».
--
-- ⚠️ الطلبات القديمة مابتتأثرش: سعر كل إضافة محفوظ جوّه الطلب نفسه.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 07. مرة واحدة في SQL Editor → Run. ولو اتشغّل تاني بيقف من أوله.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'addon_products_always_customized'
  ) THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF pg_get_functiondef('public.create_customer_order(jsonb, jsonb)'::regprocedure)
       NOT LIKE '%v_addon_custom := v_addon.supports_customization;%' THEN
    RAISE EXCEPTION 'شغّل ملف 07 الأول.';
  END IF;
END
$$;

-- قبل التعديل — عشان التأكيد تحت يقارن.
CREATE TEMP TABLE addon_prices_before AS
  SELECT id, name, price, customization_price, supports_customization
    FROM public.addon_products;

-- سعر واحد شامل التخصيص.
UPDATE public.addon_products
   SET price = price + CASE WHEN supports_customization THEN customization_price ELSE 0 END,
       customization_price = 0,
       supports_customization = true,
       updated_at = now();

ALTER TABLE public.addon_products
  ALTER COLUMN supports_customization SET DEFAULT true;

ALTER TABLE public.addon_products
  ADD CONSTRAINT addon_products_always_customized CHECK (supports_customization);

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- كل إضافة — سعرها قبل وبعد. اللي كانت بتقبل التخصيص سعرها
-- الجديد = القديم + فرق التخصيص.
SELECT b.name                                       AS "الإضافة",
       CASE WHEN b.supports_customization
            THEN b.price || ' + ' || b.customization_price
            ELSE b.price || ' (ماكانتش بتتخصص)' END AS "قبل",
       a.price                                      AS "السعر الجديد شامل التخصيص"
  FROM addon_prices_before b
  JOIN public.addon_products a ON a.id = b.id
 ORDER BY a.sort_order, a.name;

