-- ============================================================
-- 136 — روابط المنتجات المقروءة + الرابط القديم بيحوّل للجديد
-- ============================================================
--
-- ── المشكلة ────────────────────────────────────────────────
--
-- منتجان على الإنتاج رابطهم `prod-1789588225745` و`prod-1789588253939`
-- (تشخيص 128) — رقم توليد تلقائي من قبل ما يتصلّح التوليد في
-- `saveProduct`. والرابط ده بيظهر للعميل في شريط العنوان، وفي نتايج
-- البحث، وفي أي رسالة واتساب.
--
-- ⚠️ **والتغيير المباشر بيكسر كل رابط اتبعت قبل كده** — الزائر يوصل
--    لـ«المنتج غير موجود» بلا سبب ظاهر. عشان كده التوليد الجديد كان
--    «للجديد وبس».
--
-- ── الحل ──────────────────────────────────────────────────
--
--   ① عمود `previous_slugs` — الروابط القديمة للمنتج
--   ② المنتجات اللي رابطها `prod-<رقم>` بتاخد رابطًا من اسمها — **نفس
--      قواعد `slugFromName` في الكود** (حروف وأرقام عربي ولاتيني،
--      والمسافات شرط) — والقديم بيتحفظ في ①
--   ③ الكود (`getProductBySlug`) لو مالقاش الرابط، بيدوّر في
--      `previous_slugs`، والصفحة **بتحوّل تحويلًا دائمًا** للرابط الجديد
--      — فمحركات البحث بتنقل الترتيب، والرابط القديم في واتساب بيشتغل
--
-- ⚠️ **لو الاسم الجديد متاخد**، بيتضاف `-2` أو `-3`… — مفيش منتجين
--    بنفس الرابط.
--
-- ⚠️ **الحارس `guard_product_review` مابيأثرش هنا**: الملف بيتشغّل من
--    محرر Supabase (`auth.uid()` فاضي) فبيعدّي من باب الإدارة،
--    و`review_status` بيفضل زي ما هو — المنتجين يفضلوا معروضين.
--
-- ⚠️ **ولو الناشر حاول يغيّر الرابط**: الحارس بيجمّد `slug` على غير
--    الإدارة (ملف 130). `previous_slugs` مش محتاج تجميد منفصل — مفيش
--    شاشة بتكتبه، وأي تعديل من الناشر بيرجّع المنتج للمراجعة أصلًا.
-- ============================================================

BEGIN;

ALTER TABLE public.personalized_products
  ADD COLUMN IF NOT EXISTS previous_slugs text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.personalized_products.previous_slugs IS
  'روابط قديمة للمنتج — الصفحة بتحوّل منها للرابط الحالي تحويلًا دائمًا (ملف 136).';

-- فهرس للبحث «هل الرابط ده قديم لمنتج؟» — `@>` على مصفوفة.
CREATE INDEX IF NOT EXISTS personalized_products_previous_slugs_idx
  ON public.personalized_products USING gin (previous_slugs);

DO $do$
DECLARE
  r      record;
  v_base text;
  v_slug text;
  v_n    integer;
BEGIN
  FOR r IN
    SELECT id, name, slug
      FROM public.personalized_products
     WHERE slug ~ '^prod-[0-9]+$'
  LOOP
    -- نفس `slugFromName`: مسافات/شرطة سفلية ← شرطة · غير الحروف والأرقام
    -- يتشال · شرط متكررة تتدمج · شرط الأطراف تتشال · ٦٠ حرف.
    v_base := lower(btrim(r.name));
    v_base := regexp_replace(v_base, '[[:space:]_]+', '-', 'g');
    v_base := regexp_replace(v_base, '[^[:alnum:]-]+', '', 'g');
    v_base := regexp_replace(v_base, '-{2,}', '-', 'g');
    v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
    v_base := left(v_base, 60);

    -- اسم كله رموز: سيبه زي ما هو بدل رابط فاضي.
    CONTINUE WHEN v_base = '';

    v_slug := v_base;
    v_n := 1;
    WHILE EXISTS (SELECT 1 FROM public.personalized_products
                   WHERE slug = v_slug AND id <> r.id) LOOP
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    END LOOP;

    UPDATE public.personalized_products
       SET previous_slugs = array_append(previous_slugs, r.slug),
           slug = v_slug
     WHERE id = r.id;
  END LOOP;
END
$do$;

COMMIT;

-- ══ التأكيد — استعلام واحد ═══════════════════════════════════
SELECT البند, النتيجة FROM (
  SELECT 1 AS ترتيب, 'عمود الروابط القديمة' AS البند,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = 'personalized_products'
                         AND column_name = 'previous_slugs')
         THEN '✓' ELSE '✗' END AS النتيجة
  UNION ALL
  SELECT 2, 'روابط `prod-رقم` الباقية',
    (SELECT count(*)::text || CASE WHEN count(*) = 0 THEN ' ✓' ELSE ' ⚠️' END
       FROM public.personalized_products WHERE slug ~ '^prod-[0-9]+$')
  UNION ALL
  SELECT 3, 'روابط مكرّرة',
    (SELECT CASE WHEN count(*) = 0 THEN '✓ مفيش' ELSE '✗ ' || count(*)::text END
       FROM (SELECT slug FROM public.personalized_products GROUP BY slug HAVING count(*) > 1) d)
  UNION ALL
  SELECT 4, 'المنتجات المعروضة للعميل',
    (SELECT (count(*) FILTER (WHERE review_status = 'approved' AND is_active))::text
            || ' من ' || (count(*))::text FROM public.personalized_products)
  UNION ALL
  SELECT 5 + row_number() OVER (ORDER BY name), 'اتغيّر: ' || name,
    previous_slugs[array_length(previous_slugs, 1)] || '  ←  ' || slug
  FROM public.personalized_products
  WHERE array_length(previous_slugs, 1) > 0
) t ORDER BY ترتيب;

-- ══ التراجع (معلَّق) ═════════════════════════════════════════
--
-- ⚠️ ارجع الكود الأول: الكود الجديد بيقرا `previous_slugs`، ولو العمود
--    اتشال وهو منشور، صفحة المنتج بتقع.
--
-- BEGIN;
-- UPDATE public.personalized_products
--    SET slug = previous_slugs[1]
--  WHERE array_length(previous_slugs, 1) > 0;
-- DROP INDEX IF EXISTS public.personalized_products_previous_slugs_idx;
-- ALTER TABLE public.personalized_products DROP COLUMN IF EXISTS previous_slugs;
-- COMMIT;
