-- ============================================================
-- 133 — تشخيص: نصيب الناشر بيتحسب وقت التسليم لا وقت الشراء
-- ============================================================
--
-- ⚠️ **الملف ده مابيغيّرش حاجة. بيقرا وبيطبع.**
--
-- ── المشكلة ────────────────────────────────────────────────
--
-- `record_order_publisher_earnings` (ملف 97) بتحسب مستحق الناشر لما
-- الإدارة تعلّم الطلب «مسلَّم»، كده:
--
--     sum(pp.publisher_cost * oi.quantity)   ← من صف المنتج **دلوقتي**
--
-- يعني النصيب **مش متثبّت لحظة الشراء** — عكس سعر العميل اللي بيتثبّت
-- في `order_items.unit_price`. وده بيخالف قاعدة معمارية سارية: «الأسعار
-- والمبالغ تُلتقط لحظة الشراء».
--
-- ── ليه ده مش نظري ─────────────────────────────────────────
--
-- الناشر **بيقدر يغيّر نصيبه** من شاشة «تعديل المنتج». التعديل بيرجّع
-- المنتج «للمراجعة» — **لكن الرقم الجديد بيتكتب في الصفّ فعلًا**، ولو
-- الإدارة رفضت، الصفّ بيفضل بالرقم الجديد (الرفض بيخبّي المنتج، مابيرجّعش
-- القيم القديمة). فالسيناريو:
--
--   ١. عميل يشتري كتاب نصيب ناشره ٤٠٠
--   ٢. قبل التسليم، الناشر يعدّل نصيبه لـ٩٠٠
--   ٣. الإدارة ترفض التعديل — المنتج مستخبي، **والـ٩٠٠ في الصفّ**
--   ٤. الإدارة تسلّم الطلب القديم ← **المستحق يتسجّل ٩٠٠**
--
-- ومن غير سوء نيّة كمان: الإدارة تغيّر معادلة التسعير أو تصحّح نصيب،
-- فكل الطلبات اللي لسه ماتسلّمتش **تتحسب بالرقم الجديد في صمت**.
--
-- ── اللي محتاج أعرفه قبل ما أكتب ملف التعديل ───────────────
--
--   ① أنواع أعمدة `order_items` الحقيقية (قاعدة «ج» — `id` و`order_id`
--      و`product_id` نصّ ولا معرّف فريد؟)
--   ② المحفّزات المربوطة فعلًا على `order_items` (`pg_trigger` — قاعدة «ب»)
--   ③ سياسات `order_items` — مين يقدر يعدّل صفّ بند؟ لو العميل يقدر،
--      العمود الجديد محتاج حارس
--   ④ عدد نسخ `record_order_publisher_earnings` (قاعدة «س»)
--   ⑤ 🔴 **الطلبات اللي فيها كتب ناشرين ولسه ماتسلّمتش** — دي اللي
--      هتتحسب بالطريقة الجديدة. والرقم هنا بيقول: هل نصيب المنتج
--      دلوقتي هو نفسه اللي كان وقت الشراء؟ (مقدرش أعرف القديم —
--      **ومش متسجّل في أي مكان، وده بالظبط العطل**)
--   ⑥ المستحقات المسجّلة لحد دلوقتي
-- ============================================================

SELECT البند, التفاصيل, الحالة FROM (

  -- ══ ① أعمدة order_items ═════════════════════════════════
  SELECT
    ('① عمود: order_items.' || c.column_name)::text AS البند,
    (c.data_type || CASE WHEN c.is_nullable = 'YES' THEN ' · يقبل فاضي' ELSE ' · إجباري' END
      || COALESCE(' · افتراضي: ' || c.column_default, ''))::text AS التفاصيل,
    CASE WHEN c.column_name ILIKE '%publisher%' THEN '⚠️ عمود ناشر موجود' ELSE '' END AS الحالة
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'order_items'

  UNION ALL

  -- ══ ② المحفّزات المربوطة على order_items ══════════════════
  SELECT
    ('② محفّز: ' || t.tgname),
    ('بينادي: ' || p.proname || ' · ' || CASE WHEN t.tgenabled = 'D' THEN 'موقوف' ELSE 'شغّال' END),
    ''
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid = 'public.order_items'::regclass
    AND NOT t.tgisinternal

  UNION ALL

  SELECT '② محفّزات order_items', 'العدد',
    (SELECT count(*)::text FROM pg_trigger
      WHERE tgrelid = 'public.order_items'::regclass AND NOT tgisinternal)

  UNION ALL

  -- ══ ③ سياسات order_items ════════════════════════════════
  --    ⚠️ INSERT شرطه في with_check لا qual (قاعدة «ن»).
  SELECT
    ('③ سياسة: ' || pol.policyname),
    (pol.cmd || ' · ' || array_to_string(pol.roles, ',')
      || ' · USING: ' || COALESCE(pol.qual, '—')
      || ' · CHECK: ' || COALESCE(pol.with_check, '—')),
    CASE WHEN pol.cmd IN ('UPDATE', 'ALL') THEN '⚠️ فيه تعديل' ELSE '' END
  FROM pg_policies pol
  WHERE pol.schemaname = 'public' AND pol.tablename = 'order_items'

  UNION ALL

  -- ══ ④ نسخ الدالة ═════════════════════════════════════════
  SELECT
    '④ record_order_publisher_earnings',
    ('عدد النسخ: ' || count(*)::text || ' · الباراميترات: '
      || COALESCE(string_agg(pg_get_function_identity_arguments(p.oid), ' / '), '—')),
    CASE WHEN count(*) = 1 THEN '✓ نسخة واحدة' ELSE '⚠️ ' || count(*)::text || ' نسخ' END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'record_order_publisher_earnings'

  UNION ALL

  -- ══ ⑤ 🔴 طلبات فيها كتب ناشرين ولسه ماتسلّمتش ══════════════
  SELECT
    ('⑤ طلب: ' || o.id::text),
    ('الحالة: ' || o.status::text
      || ' · الكتاب: ' || pp.name
      || ' · الكمية: ' || oi.quantity::text
      || ' · سعر العميل وقت الشراء: ' || oi.unit_price::text
      || ' · نصيب الناشر دلوقتي: ' || COALESCE(pp.publisher_cost::text, '🔴 مفيش')
      || ' · حالة المنتج: ' || pp.review_status),
    '⬅️ هيتحسب بالرقم اللي في الصفّ ساعة التسليم'
  FROM public.order_items oi
  JOIN public.orders o ON o.id::text = oi.order_id::text
  JOIN public.personalized_products pp ON pp.id::text = oi.product_id::text
  WHERE pp.publisher_id IS NOT NULL
    AND o.status::text NOT IN ('delivered', 'cancelled')

  UNION ALL

  SELECT
    '⑤ الخلاصة',
    ((SELECT count(DISTINCT o.id)::text
        FROM public.order_items oi
        JOIN public.orders o ON o.id::text = oi.order_id::text
        JOIN public.personalized_products pp ON pp.id::text = oi.product_id::text
       WHERE pp.publisher_id IS NOT NULL
         AND o.status::text NOT IN ('delivered', 'cancelled'))
      || ' طلب فيه كتب ناشرين لسه ماتسلّمش · '
      || (SELECT count(DISTINCT o.id)::text
            FROM public.order_items oi
            JOIN public.orders o ON o.id::text = oi.order_id::text
            JOIN public.personalized_products pp ON pp.id::text = oi.product_id::text
           WHERE pp.publisher_id IS NOT NULL AND o.status::text = 'delivered')
      || ' طلب اتسلّم'),
    ''

  UNION ALL

  -- ══ ⑥ المستحقات المسجّلة ═════════════════════════════════
  SELECT
    '⑥ مستحقات الناشرين المسجّلة',
    (count(*)::text || ' صفّ · إجمالي ' || COALESCE(sum(amount), 0)::text
      || ' · منها من طلبات: ' || count(*) FILTER (WHERE source_type = 'order')::text),
    ''
  FROM public.publisher_payouts

  UNION ALL

  -- وحالات الطلب الموجودة فعلًا — عشان الشرط في ⑤ مايبقاش تخمين.
  SELECT
    '⑦ حالات الطلبات الموجودة',
    string_agg(DISTINCT o.status::text, ' · '),
    ''
  FROM public.orders o

) t ORDER BY البند;
