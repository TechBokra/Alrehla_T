-- ============================================================
-- 12 — أهداف التخصيص من اللوحة · خانات لمنتجات بعينها · صورة لكل إضافة
-- ============================================================
--
-- ── ليه (ملاحظات فريق العمل، والخطة اتوافق عليها) ───────────
--
-- ١) **أهداف التخصيص** («الشجاعة»، «الثقة بالنفس»…) كانت مكتوبة في الكود
--    — أربعة ثابتين لكل المنتجات. بقت جدول (`story_goals`) الإدارة بتضيف
--    فيه وتوقف وترتّب، وكل هدف يظهر في **كل المنتجات** أو **منتجات بعينها**
--    (وصندوق الرحلة كاختيار). الأربعة الحاليين بيتنقلوا زي ما هما.
--    و«هدف آخر — أكتبه بنفسي» فاضل في الشاشة.
--
-- ٢) **خانات التخصيص** (ملف 06) كانت بتظهر في كل المنتجات. بقى ليها نفس
--    الاختيار: كل المنتجات، أو منتجات بعينها. الخانات الحالية بتفضل على
--    «كل المنتجات».
--
-- ٣) **صورة لكل إضافة** (دفتر التلوين، كتيّب الأذكار…) — اختيارية، بتظهر
--    للعميل في خطوة الإضافات.
--
-- ── «يظهر فين» (`applies_to`) ───────────────────────────────
--
--   فاضي (NULL)            = كل المنتجات + الصندوق
--   {'<رقم منتج>', 'box'}   = المنتجات دي بس، و'box' = صندوق الرحلة
--
-- ⚠️ **مفيش مسح لأي بيانات.** إضافة أعمدة وجدول جديد.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 11. في SQL Editor → Run. ولو اتشغّل تاني بيقف من أوله.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.story_goals') IS NOT NULL THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF to_regclass('public.customization_fields') IS NULL THEN
    RAISE EXCEPTION 'شغّل ملف 06 الأول.';
  END IF;
END
$$;

-- ── «يظهر فين» سليم؟ ───────────────────────────────────────
-- كل عنصر: رقم منتج موجود، أو 'box'. ومفيش قايمة فاضية (فاضي = NULL).
CREATE OR REPLACE FUNCTION public.valid_applies_to(p text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- SECURITY DEFINER: المنتج الموقوف أو المستني لازم يتشاف هنا كمان.
  SELECT p IS NULL
      OR (cardinality(p) BETWEEN 1 AND 100
          AND NOT EXISTS (
            SELECT 1 FROM unnest(p) AS x
             WHERE x <> 'box'
               AND NOT EXISTS (SELECT 1 FROM personalized_products pp WHERE pp.id = x)
          ))
$function$;

-- ── ١. أهداف التخصيص ─────────────────────────────────────────

CREATE TABLE public.story_goals (
  id          uuid        DEFAULT gen_random_uuid() NOT NULL,
  label       text        NOT NULL,
  applies_to  text[],
  is_active   boolean     DEFAULT true NOT NULL,
  sort_order  integer     DEFAULT 0    NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT story_goals_pkey PRIMARY KEY (id),
  CONSTRAINT story_goals_label_length CHECK (char_length(btrim(label)) BETWEEN 2 AND 120)
);
CREATE INDEX story_goals_order_idx ON public.story_goals (sort_order, created_at);

-- ⚠️ بمحفّز مش CHECK: الـCHECK مايقدرش يقرا جدول تاني (المنتجات).
CREATE OR REPLACE FUNCTION public.guard_applies_to()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.applies_to IS NOT NULL AND cardinality(NEW.applies_to) = 0 THEN
    NEW.applies_to := NULL;
  END IF;
  IF NOT public.valid_applies_to(NEW.applies_to) THEN
    RAISE EXCEPTION 'فيه منتج مختار مش موجود — حدّث الصفحة واختار تاني.';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER story_goals_applies_to_trg
  BEFORE INSERT OR UPDATE ON public.story_goals
  FOR EACH ROW EXECUTE FUNCTION public.guard_applies_to();

ALTER TABLE public.story_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active story goals are public" ON public.story_goals
  AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (is_active OR public.is_admin());

CREATE POLICY "Admins manage story goals" ON public.story_goals
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.story_goals FROM anon;
REVOKE TRUNCATE ON public.story_goals FROM authenticated;
GRANT SELECT ON public.story_goals TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.story_goals TO authenticated;
GRANT ALL ON public.story_goals TO service_role;

-- الأربعة اللي كانوا في الكود — بنفس الكلام اللي العميل كان بيشوفه.
INSERT INTO public.story_goals (label, sort_order) VALUES
  ('الشجاعة والتغلب على الخوف', 1),
  ('بناء الثقة بالنفس', 2),
  ('تعلم حل المشكلات', 3),
  ('التعاون مع الآخرين', 4);

-- ── ٢. خانات التخصيص لمنتجات بعينها ─────────────────────────

ALTER TABLE public.customization_fields ADD COLUMN applies_to text[];

CREATE TRIGGER customization_fields_applies_to_trg
  BEFORE INSERT OR UPDATE ON public.customization_fields
  FOR EACH ROW EXECUTE FUNCTION public.guard_applies_to();

-- ── ٣. صورة لكل إضافة ────────────────────────────────────────

ALTER TABLE public.addon_products
  ADD COLUMN image_url text,
  -- صورة من Cloudinary بتاعنا بس — نفس حارس صور المنتجات.
  ADD CONSTRAINT addon_products_image_url_cloudinary
    CHECK (image_url IS NULL OR image_url ~ '^https://res\.cloudinary\.com/');

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- لازم يطلع ٣ سطور كلها ✓.
SELECT 'أهداف التخصيص' AS "البند",
       CASE WHEN (SELECT count(*) FROM public.story_goals) = 4 THEN '✓' ELSE '✗' END AS "الحالة"
UNION ALL
SELECT 'خانات لمنتجات بعينها',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'customization_fields' AND column_name = 'applies_to')
            THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'صورة الإضافة',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'addon_products' AND column_name = 'image_url')
            THEN '✓' ELSE '✗' END;
