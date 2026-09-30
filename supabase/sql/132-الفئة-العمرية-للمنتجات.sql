-- ============================================================
-- 132 — الفئة العمرية للمنتجات
-- ============================================================
--
-- ── المشكلة ────────────────────────────────────────────────
--
-- المكتبة و«أنت البطل هنا» مافيهمش أي طريقة يعرف بيها الأب الكتاب
-- ده لسنّ كام. تشخيص 131 أكّد: **مفيش عمود سنّ على المنتجات**،
-- ومفيش سنّ مكتوب نصًّا في «تفاصيل المنتج» ينفع يتنقل.
--
-- ⚠️ وتشخيص 131 طبع «⚠️ عمود سنّ موجود» جنب `cover_image_url`
--    و`gallery_image_urls` — **ده إنذار كاذب من الاستعلام نفسه**:
--    كان بيدوّر على `%age%`، وكلمة `image` فيها `age`. مفيش عمود
--    سنّ. (نفس درس ١١: المسح الآلي بيدّي إنذارات كاذبة.)
--
-- ── ليه عمودين أرقام، لا قايمة فئات ─────────────────────────
--
-- الفئات المعتمدة هي حزم «بداية الرحلة» (٦–٩ · ١٠–١٢ · ١٣–١٧ ·
-- ١٨–٢٠). لكن الكتاب مش لازم يطابق حزمة بالظبط: كتاب «من ٨ لـ١١»
-- لازم يظهر في فلتر «٦–٩» وفي فلتر «١٠–١٢» الاتنين.
--
--   • لو خزّنّا **الفئة** (نص واحد)، الكتاب ده يتحط في واحدة ويختفي
--     من التانية.
--   • لو خزّنّا **السنّ من ولحد**، الفلتر بيحسب التداخل في الكود،
--     والفئات نفسها تتغيّر من الكود **بلا ملف قاعدة جديد**.
--
-- ⚠️ `max_age` فاضي = «فأكبر» (مثلًا «من ١٣ فأكبر»).
--    و`min_age` فاضي = مفيش سنّ مكتوب خالص، والمنتج بيظهر في «كل
--    الأعمار» بس — مابيظهرش لو العميل اختار فئة. **وده مقصود**:
--    عرض كتاب مالوش سنّ تحت «١٠–١٢» معناه إننا بنخمّن.
--
-- ── ما الذي يتغيّر فعليًا ───────────────────────────────────
--
--   ① عمودان جديدان `min_age` و`max_age` (أرقام صغيرة، يقبلوا فاضي)
--   ② ثلاث قيود: السنّ بين ٠ و٢٠ · «من» ≤ «لحد» · «لحد» مايتكتبش
--      من غير «من»
--   ③ **ولا صفّ بيتغيّر**: الإضافة بلا قيمة افتراضية، فالمنتجات
--      الخمسة بتفضل «معتمد» ومعروضة زي ما هي. (عكس ملف 130 — هناك
--      الافتراضي كان «في الانتظار» وكان هيفضّي الكتالوج.)
--
-- ⚠️ **الحارس مش محتاج تعديل.** `guard_product_review` (ملف 130)
--    بيرجّع المنتج «للمراجعة» عند **أي** تعديل من الناشر — مافيهوش
--    قايمة أعمدة عن قصد. يعني لو الناشر غيّر السنّ، المنتج بيقف عن
--    البيع لحد ما الإدارة تراجع، تلقائيًا.
--
-- ⚠️ **والسياسات مش محتاجة تعديل**: سياسات القراءة والكتابة على
--    الصفّ كله (ملف 130)، والعمود الجديد بيمشي معاها.
-- ============================================================

BEGIN;

ALTER TABLE public.personalized_products
  ADD COLUMN IF NOT EXISTS min_age smallint,
  ADD COLUMN IF NOT EXISTS max_age smallint;

-- ⚠️ `DROP ... IF EXISTS` قبل كل قيد عشان الملف يتعاد بأمان لو
--    اتقطع في النص.
ALTER TABLE public.personalized_products
  DROP CONSTRAINT IF EXISTS personalized_products_min_age_range;
ALTER TABLE public.personalized_products
  ADD CONSTRAINT personalized_products_min_age_range
  CHECK (min_age IS NULL OR min_age BETWEEN 0 AND 20);

ALTER TABLE public.personalized_products
  DROP CONSTRAINT IF EXISTS personalized_products_max_age_range;
ALTER TABLE public.personalized_products
  ADD CONSTRAINT personalized_products_max_age_range
  CHECK (max_age IS NULL OR max_age BETWEEN 0 AND 20);

ALTER TABLE public.personalized_products
  DROP CONSTRAINT IF EXISTS personalized_products_age_order;
ALTER TABLE public.personalized_products
  ADD CONSTRAINT personalized_products_age_order
  CHECK (
    max_age IS NULL
    OR (min_age IS NOT NULL AND min_age <= max_age)
  );

COMMENT ON COLUMN public.personalized_products.min_age IS
  'أصغر سنّ مناسب. فاضي = مفيش سنّ مكتوب (يظهر في «كل الأعمار» بس). ملف 132.';
COMMENT ON COLUMN public.personalized_products.max_age IS
  'أكبر سنّ مناسب. فاضي مع min_age = «فأكبر». ملف 132.';

COMMIT;

-- ══ التأكيد — استعلام واحد ═══════════════════════════════════
SELECT البند, النتيجة FROM (
  SELECT 1 AS ترتيب,
    'عمود «من سن»' AS البند,
    COALESCE((SELECT '✓ ' || data_type FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'personalized_products'
                 AND column_name = 'min_age'), '✗ مش موجود') AS النتيجة
  UNION ALL
  SELECT 2, 'عمود «لحد سن»',
    COALESCE((SELECT '✓ ' || data_type FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'personalized_products'
                 AND column_name = 'max_age'), '✗ مش موجود')
  UNION ALL
  SELECT 3, 'القيود التلاتة',
    CASE WHEN (SELECT count(*) FROM pg_constraint
                WHERE conrelid = 'public.personalized_products'::regclass
                  AND conname IN ('personalized_products_min_age_range',
                                  'personalized_products_max_age_range',
                                  'personalized_products_age_order')) = 3
         THEN '✓ ٣ من ٣' ELSE '✗ ناقص' END
  UNION ALL
  SELECT 4, 'حارس المراجعة لسه مربوط',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                       WHERE tgrelid = 'public.personalized_products'::regclass
                         AND tgname = 'guard_product_review_biu' AND tgenabled <> 'D')
         THEN '✓' ELSE '✗' END
  UNION ALL
  -- ⚠️ ده السطر اللي بيأكّد إن الكتالوج ما اتفضّاش.
  SELECT 5, 'المنتجات المعروضة للعميل',
    (SELECT (count(*) FILTER (WHERE review_status = 'approved' AND is_active))::text
            || ' من ' || (count(*))::text
            || CASE WHEN count(*) FILTER (WHERE NOT (review_status = 'approved' AND is_active)) = 0
                    THEN ' ✓' ELSE ' ⚠️' END
       FROM public.personalized_products)
) t ORDER BY ترتيب;

-- ══ التراجع (معلَّق) ═════════════════════════════════════════
--
-- ⚠️ قبل التراجع: الكود الجديد بيكتب في العمودين. لو اتشالوا والكود
--    لسه منشور، **كل حفظ منتج هيترفض**. ارجع الكود الأول.
--
-- BEGIN;
-- ALTER TABLE public.personalized_products DROP CONSTRAINT IF EXISTS personalized_products_age_order;
-- ALTER TABLE public.personalized_products DROP CONSTRAINT IF EXISTS personalized_products_max_age_range;
-- ALTER TABLE public.personalized_products DROP CONSTRAINT IF EXISTS personalized_products_min_age_range;
-- ALTER TABLE public.personalized_products DROP COLUMN IF EXISTS max_age;
-- ALTER TABLE public.personalized_products DROP COLUMN IF EXISTS min_age;
-- COMMIT;
