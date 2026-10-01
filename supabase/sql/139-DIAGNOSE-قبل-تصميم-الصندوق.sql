-- ============================================================
-- 139 — تشخيص قبل بناء «صندوق الرحلة»  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.** مفيش تعديل.
--
-- جداول الصندوق اتعملت من برّه ملفات المشروع (مفيش `CREATE TABLE`
-- ليها في أي ملف) — فقبل ما أكتب ملف البناء محتاج أعرف من القاعدة
-- نفسها: أنواع الأعمدة، الروابط بين الجداول، الصلاحيات، والمحفّزات.
-- لأن الغلط في أي واحدة منهم = ملف بيقع في نصّه أو حماية ناقصة.
-- ============================================================

SELECT القسم, البند, التفاصيل FROM (

  -- ١) أعمدة الجداول التلاتة
  SELECT 1 AS ت, '1. أعمدة' AS القسم,
    (c.table_name || '.' || c.column_name)::text AS البند,
    (CASE WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name ELSE c.data_type END || CASE WHEN c.is_nullable = 'NO' THEN ' · إلزامي' ELSE '' END
      || coalesce(' · افتراضي: ' || c.column_default, ''))::text AS التفاصيل,
    c.table_name::text AS ك1, c.ordinal_position::int AS ك2
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name IN ('box_subscription_plans', 'box_subscriptions', 'orders')

  UNION ALL
  -- ٢) الروابط (foreign keys) على الجداول دي + بنود الطلب
  SELECT 2, '2. روابط',
    conrelid::regclass::text || ' → ' || confrelid::regclass::text,
    pg_get_constraintdef(oid), conrelid::regclass::text, 0
  FROM pg_constraint
  WHERE contype = 'f'
    AND (conrelid::regclass::text IN ('box_subscription_plans','box_subscriptions','orders','order_items')
      OR confrelid::regclass::text IN ('box_subscription_plans','box_subscriptions'))

  UNION ALL
  -- ٣) القيود (check / unique)
  SELECT 3, '3. قيود',
    conrelid::regclass::text || ' · ' || conname,
    pg_get_constraintdef(oid), conrelid::regclass::text, 0
  FROM pg_constraint
  WHERE contype IN ('c','u') AND conrelid::regclass::text IN ('box_subscription_plans','box_subscriptions')

  UNION ALL
  -- ٤) الصلاحيات (RLS)
  SELECT 4, '4. صلاحيات',
    (tablename || ' · ' || policyname || ' · ' || cmd || ' · ' || array_to_string(roles, ','))::text,
    coalesce('USING ' || qual, '') || coalesce('  CHECK ' || with_check, ''), tablename::text, 0
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('box_subscription_plans','box_subscriptions')

  UNION ALL
  SELECT 4, '4. صلاحيات',
    (relname || ' · RLS مفعّل؟')::text,
    CASE WHEN relrowsecurity THEN 'أيوه' ELSE '🔴 لأ' END, relname::text, 0
  FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relname IN ('box_subscription_plans','box_subscriptions')

  UNION ALL
  -- ٥) المحفّزات على الطلبات والاشتراكات
  SELECT 5, '5. محفّزات',
    (event_object_table || ' · ' || trigger_name)::text,
    (action_timing || ' ' || string_agg(event_manipulation::text, '/') || ' → ' || action_statement)::text,
    event_object_table::text, 0
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
    AND event_object_table IN ('orders','order_items','box_subscriptions','box_subscription_plans')
  GROUP BY event_object_table, trigger_name, action_timing, action_statement

  UNION ALL
  -- ٦) قيم حالة الاشتراك
  SELECT 6, '6. حالات الاشتراك', t.typname::text,
    string_agg(e.enumlabel, ' · ' ORDER BY e.enumsortorder), '', 0
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typname IN ('sub_status_enum', 'order_status_enum', 'order_status')
  GROUP BY t.typname

  UNION ALL
  -- ٧) دوال بتلمس الاشتراكات أو تأكيد الدفع
  SELECT 7, '7. دوال',
    (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')::text,
    CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END, '', 0
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND (p.prosrc ILIKE '%box_subscription%' OR p.proname ILIKE '%confirm%payment%')

  UNION ALL
  -- ٨) الخطط نفسها
  SELECT 8, '8. الخطط', name::text,
    'رقم: ' || id::text || ' · ' || duration_months || ' شهر · ' || price_total || ' ج · نشطة: ' || is_active,
    '', sort_order
  FROM public.box_subscription_plans

) t ORDER BY ت, ك1, ك2, البند;
