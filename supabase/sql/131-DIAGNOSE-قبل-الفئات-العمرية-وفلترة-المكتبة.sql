-- ============================================================
-- 131 — تشخيص: قبل الفئات العمرية وفلترة المكتبة بدور النشر
-- ============================================================
--
-- ⚠️ **الملف ده مابيغيّرش حاجة. بيقرا وبيطبع.**
--
-- ── ليه اتكتب ───────────────────────────────────────────────
--
-- الطلب: المكتبة تبقى بشكل «أنت البطل هنا»، وفلترة كاملة بدور
-- النشر، وعرض يناسب الفئات العمرية. والفئة العمرية **مش موجودة
-- كعمود** على المنتجات (الموجود `age_group` على باقات الكتابة بس،
-- وبقيمتين «تحت ١٢» و«١٢+» — أوسع من إنها تنفع لكتب أطفال).
--
-- فقبل ما أكتب ملف تعديل، محتاج أعرف من القاعدة نفسها (لا من ملف
-- الأنواع — قاعدة «ج»):
--
--   ① أنواع أعمدة المنتجات والناشرين الحقيقية، وهل فيه عمود سنّ
--      اتضاف قبل كده باسم تاني
--   ② المحفّزات المربوطة فعلًا على جدول المنتجات (`pg_trigger` لا
--      `pg_proc` — قاعدة «ب»)
--   ③ سياسات القراءة على المنتجات والناشرين
--   ④ 🔴 **كام منتج مستخبي عن لوحة الإدارة دلوقتي** — انظر تحت
--   ⑤ دور النشر: حالتها، وهل هي تجريبية، وكام كتاب ليها
--   ⑥ بنود «تفاصيل المنتج» اللي فيها سنّ مكتوب نصًّا — عشان أملا
--      العمود الجديد منها بدل ما الفريق يكتبها من الأول
--
-- ── ④ بالتفصيل — وده الأهم ──────────────────────────────────
--
-- ملف 130 خلّى سياسة القراءة العامة:
--     USING ( review_status = 'approved' AND is_active )
-- وده صح للزائر. **لكن شاشة «المنتجات» في الإدارة، وشاشة «منتجاتي»
-- عند الناشر، وصفحة تعديله — التلاتة بيقروا بعميل الزائر** (مفيش
-- جلسة دخول). يعني أي منتج **موقوف أو مستني المراجعة أو مرفوض
-- بيختفي من التلات شاشات** — بلا أي خطأ (قاعدة «ك»).
--
-- والبند ④ بيعدّ المنتجات دي بالظبط: لو الرقم صفر، العطل موجود في
-- الكود بس لسه ما أذاش حد. لو أكبر من صفر، فيه منتجات الإدارة
-- مش شايفاها دلوقتي.
-- ============================================================

SELECT البند, التفاصيل, الحالة FROM (

  -- ══ ① الأعمدة وأنواعها ═════════════════════════════════
  SELECT
    ('① عمود: ' || c.table_name || '.' || c.column_name)::text AS البند,
    (c.data_type || CASE WHEN c.is_nullable = 'YES' THEN ' · يقبل فاضي' ELSE ' · إجباري' END
      || COALESCE(' · افتراضي: ' || c.column_default, ''))::text AS التفاصيل,
    CASE WHEN c.column_name ILIKE '%age%' THEN '⚠️ عمود سنّ موجود' ELSE '' END AS الحالة
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name IN ('personalized_products', 'publishers')

  UNION ALL

  -- ══ ② المحفّزات المربوطة فعلًا ══════════════════════════
  SELECT
    ('② محفّز: ' || t.tgname),
    ('بينادي: ' || p.proname || ' · ' || CASE WHEN t.tgenabled = 'D' THEN 'موقوف' ELSE 'شغّال' END),
    CASE WHEN p.proname = 'guard_product_review' THEN '✓ حارس المراجعة' ELSE '' END
  FROM pg_trigger t
  JOIN pg_class cl ON cl.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE n.nspname = 'public'
    AND cl.relname = 'personalized_products'
    AND NOT t.tgisinternal

  UNION ALL

  -- ══ ③ السياسات ═════════════════════════════════════════
  --    ⚠️ سياسة INSERT شرطها في with_check لا qual (قاعدة «ن»).
  SELECT
    ('③ سياسة: ' || pol.tablename || ' · ' || pol.policyname),
    (pol.cmd || ' · ' || array_to_string(pol.roles, ',')
      || ' · USING: ' || COALESCE(pol.qual, '—')
      || ' · CHECK: ' || COALESCE(pol.with_check, '—')),
    CASE WHEN pol.cmd = 'SELECT' AND btrim(lower(coalesce(pol.qual, ''))) IN ('true', '(true)')
         THEN '⚠️ قراءة مفتوحة' ELSE '' END
  FROM pg_policies pol
  WHERE pol.schemaname = 'public'
    AND pol.tablename IN ('personalized_products', 'publishers')

  UNION ALL

  -- ══ ④ 🔴 المنتجات اللي عميل الزائر مايشوفهاش ═════════════
  SELECT
    ('④ منتج مستخبي: ' || p.name),
    ('التصنيف: ' || p.category::text
      || ' · المراجعة: ' || p.review_status
      || ' · معروض: ' || CASE WHEN p.is_active THEN 'نعم' ELSE 'لا' END),
    '🔴 مش ظاهر في شاشة المنتجات بالإدارة ولا عند الناشر'
  FROM public.personalized_products p
  WHERE NOT (p.review_status = 'approved' AND p.is_active)

  UNION ALL

  SELECT
    '④ الخلاصة',
    ((SELECT count(*) FROM public.personalized_products)::text || ' منتج إجمالًا · '
      || (SELECT count(*) FROM public.personalized_products
           WHERE NOT (review_status = 'approved' AND is_active))::text
      || ' منهم مستخبي عن الشاشتين'),
    CASE WHEN EXISTS (SELECT 1 FROM public.personalized_products
                       WHERE NOT (review_status = 'approved' AND is_active))
         THEN '🔴 فيه منتجات الإدارة مش شايفاها'
         ELSE '✓ لسه ما أذاش حد' END

  UNION ALL

  -- ══ ⑤ دور النشر ════════════════════════════════════════
  SELECT
    ('⑤ ناشر: ' || pub.name),
    ('الحالة: ' || pub.status::text
      || ' · تجريبي: ' || CASE WHEN pub.is_sample THEN 'نعم' ELSE 'لا' END
      || ' · شعار: ' || CASE WHEN pub.logo_url IS NULL OR pub.logo_url = '' THEN 'مفيش' ELSE 'موجود' END
      || ' · كتبه المعروضة في المكتبة: '
      || (SELECT count(*) FROM public.personalized_products p
           WHERE p.publisher_id::text = pub.id::text
             AND p.category::text = 'library'
             AND p.review_status = 'approved' AND p.is_active)::text),
    CASE WHEN pub.is_sample THEN '⚠️ تجريبي' ELSE '' END
  FROM public.publishers pub

  UNION ALL

  -- ══ ⑥ سنّ مكتوب نصًّا في التفاصيل ══════════════════════
  SELECT
    ('⑥ ' || p.name),
    ('بند: «' || f.item || '»'),
    '⬅️ ممكن يتنقل لعمود السنّ'
  FROM public.personalized_products p
  CROSS JOIN LATERAL unnest(COALESCE(p.features, ARRAY[]::text[])) AS f(item)
  WHERE f.item ~ '(سن|سنة|سنين|سنوات|عمر|[0-9٠-٩]+ *[-–لـ]+ *[0-9٠-٩]+)'

) t ORDER BY البند;
