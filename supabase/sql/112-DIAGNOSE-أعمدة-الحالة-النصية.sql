-- ============================================================
-- 112 — تشخيص: أعمدة الحالة النصّية قبل تحويلها لأنواع  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.** مفيش سطر بيكتب ولا بيحذف.
--
-- ── ليه الملف ده قبل أي تحويل ───────────────────────────────
--
-- تحويل عمود من `text` لنوع معرَّف (`ENUM`) بيخلّي القاعدة **ترفض**
-- أي قيمة بره القايمة — وده الغرض. بس نفس السبب بيخلّيه خطرًا:
--
-- **① لو في صف بقيمة مش في القايمة، التحويل بيقع** — والجدول كله
--    بيفضل زي ما هو. مش كارثة، لكن لازم نعرف القيم الموجودة فعلًا
--    **قبل** ما نكتب القايمة، لا نخمّنها من الكود.
--
--    ⚠️ **وده مش افتراض نظري.** ملف 105 لقى إن **الستين جلسة كلها
--       `pending`** والافتراضي في القاعدة `scheduled`. لو كتبنا
--       القايمة من الكود، كنا هنسيب `pending` بره ويقع التحويل.
--
-- **② لو في `VIEW` بيقرا العمود، Postgres بيرفض التغيير** ويقول
--    «cannot alter type of a column used by a view».
--
-- **③ والأخطر: نوع موجود بالفعل باسم قريب.** المشروع كان فيه
--    `order_status` بخمس قيم و`order_status_enum` المستخدم فعلًا
--    بتسع — واختيار الاسم الغلط كان بينتج كودًا بيتعامل مع حالات
--    أقل مما الموقع بيستخدمه، وبيعدّي المراجعة لأن الاسم يبدو صح.
--    القسم ٤ بيطبع الأنواع الموجودة وقيمها عشان ما نكرّرش الفخّ.
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ══ ١) الأعمدة النصّية المرشَّحة ═══════════════════════
  SELECT
    '1. الأعمدة'::text AS القسم,
    (c.table_name || '.' || c.column_name)::text AS البند,
    (c.data_type
      || CASE WHEN c.is_nullable = 'YES' THEN '  ·  يقبل الفراغ' ELSE '  ·  مطلوب' END
      || COALESCE('  ·  افتراضي: ' || c.column_default, '  ·  بلا افتراضي'))::text
      AS التفاصيل,
    'مرشَّح للتحويل'::text AS الحالة
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
   AND t.table_type = 'BASE TABLE'
  WHERE c.table_schema = 'public'
    AND c.data_type IN ('text', 'character varying')
    AND (c.column_name = 'status' OR c.column_name LIKE '%_status')

  UNION ALL

  -- ══ ٢) القيم الموجودة فعلًا في كل عمود ═════════════════
  --
  -- ⚠️ **دي أهم نتيجة في الملف.** القايمة اللي هنكتبها في النوع
  --    لازم تشمل كل قيمة هنا، وإلا التحويل بيقع.
  --
  -- ⚠️ **والاستعلامات مكتوبة صريحة لكل جدول عن قصد.** قراءة عمود
  --    باسم متغيّر محتاجة SQL ديناميكي — ودي حاجة مالهاش مكان في
  --    ملف تشخيص المفروض إنه **قراءة فقط ومقروء بالعين**.

  SELECT '2. القيم', 'sessions.status',
         COALESCE((SELECT string_agg(v || ' (' || n || ')', '  ·  ' ORDER BY n DESC)
                     FROM (SELECT status AS v, count(*) AS n FROM public.sessions GROUP BY status) s),
                  '(فاضي)')::text,
         'للمراجعة'
  UNION ALL
  SELECT '2. القيم', 'course_subscriptions.status',
         COALESCE((SELECT string_agg(v || ' (' || n || ')', '  ·  ' ORDER BY n DESC)
                     FROM (SELECT status AS v, count(*) AS n FROM public.course_subscriptions GROUP BY status) s),
                  '(فاضي)')::text,
         'للمراجعة'
  UNION ALL
  SELECT '2. القيم', 'withdrawal_requests.status',
         COALESCE((SELECT string_agg(v || ' (' || n || ')', '  ·  ' ORDER BY n DESC)
                     FROM (SELECT status AS v, count(*) AS n FROM public.withdrawal_requests GROUP BY status) s),
                  '(فاضي)')::text,
         'للمراجعة'
  UNION ALL
  SELECT '2. القيم', 'instructor_services.status',
         COALESCE((SELECT string_agg(v || ' (' || n || ')', '  ·  ' ORDER BY n DESC)
                     FROM (SELECT status AS v, count(*) AS n FROM public.instructor_services GROUP BY status) s),
                  '(فاضي)')::text,
         'للمراجعة'
  UNION ALL
  SELECT '2. القيم', 'provider_services.status',
         COALESCE((SELECT string_agg(v || ' (' || n || ')', '  ·  ' ORDER BY n DESC)
                     FROM (SELECT status AS v, count(*) AS n FROM public.provider_services GROUP BY status) s),
                  '(فاضي)')::text,
         'للمراجعة'
  UNION ALL
  SELECT '2. القيم', 'dependent_requests.status',
         COALESCE((SELECT string_agg(v || ' (' || n || ')', '  ·  ' ORDER BY n DESC)
                     FROM (SELECT status AS v, count(*) AS n FROM public.dependent_requests GROUP BY status) s),
                  '(فاضي)')::text,
         'للمراجعة'
  UNION ALL
  SELECT '2. القيم', 'account_deletion_requests.status',
         COALESCE((SELECT string_agg(v || ' (' || n || ')', '  ·  ' ORDER BY n DESC)
                     FROM (SELECT status AS v, count(*) AS n FROM public.account_deletion_requests GROUP BY status) s),
                  '(فاضي)')::text,
         'للمراجعة'

  UNION ALL

  -- ══ ٣) في `VIEW` بيقرا عمود منهم؟ ══════════════════════
  --
  -- Postgres بيرفض تغيير نوع عمود بيستخدمه view.
  SELECT
    '3. الـviews',
    (dependent_ns.nspname || '.' || dependent_view.relname)::text,
    ('بيعتمد على: ' || source_table.relname)::text,
    '⚠️ لازم يتشال ويترجع حوالين التحويل'
  FROM pg_depend
  JOIN pg_rewrite      ON pg_depend.objid = pg_rewrite.oid
  JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
  JOIN pg_class AS source_table   ON pg_depend.refobjid = source_table.oid
  JOIN pg_namespace dependent_ns  ON dependent_ns.oid = dependent_view.relnamespace
  JOIN pg_namespace source_ns     ON source_ns.oid = source_table.relnamespace
  WHERE source_ns.nspname = 'public'
    AND dependent_view.relkind = 'v'
    AND source_table.relname IN (
      'sessions','course_subscriptions','withdrawal_requests',
      'instructor_services','provider_services','dependent_requests',
      'account_deletion_requests'
    )

  UNION ALL

  -- ══ ٤) الأنواع الموجودة أصلًا وقيمها ═══════════════════
  --
  -- ⚠️ **قبل ما نعمل نوعًا جديدًا، نشوف اللي موجود.** المشروع وقع
  --    قبل كده في `order_status` مقابل `order_status_enum`.
  SELECT
    '4. الأنواع الموجودة',
    t.typname::text,
    string_agg(e.enumlabel, '  ·  ' ORDER BY e.enumsortorder)::text,
    'موجود — نستخدمه بدل ما نعمل واحد جديد'
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.typname

  UNION ALL

  -- ══ ٥) قيود CHECK على الأعمدة دي ═══════════════════════
  --
  -- القيد الموجود بيقول لنا القايمة اللي كان مفروض تتطبّق.
  SELECT
    '5. القيود',
    (rel.relname || ' · ' || con.conname)::text,
    left(pg_get_constraintdef(con.oid), 160)::text,
    'مقارنة بالقايمة الحقيقية'
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%'

) t ORDER BY القسم, البند;

-- ============================================================
-- مفيش تراجع — الملف قراءة فقط.
-- ============================================================
