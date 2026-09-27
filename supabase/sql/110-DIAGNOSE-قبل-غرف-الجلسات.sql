-- ============================================================
-- 110 — تشخيص: قبل ما نبني غرف الجلسات  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.** مفيش سطر بيكتب ولا بيحذف.
--
-- ── ليه الملف ده ────────────────────────────────────────────
--
-- التكامل مع Daily محتاج القاعدة تحفظ حاجات مالهاش مكان دلوقتي:
-- اسم الغرفة، ورقم التسجيل، وتاريخ حذفه، وموافقة ولي الأمر.
--
-- وقبل ما أكتب سطر `ALTER TABLE` واحد، لازم أعرف من القاعدة نفسها:
-- الأعمدة الموجودة فعلًا، والسياسات اللي هتتأثر، وهل فيه بيانات
-- قديمة هتتكسر.
--
-- ⚠️ **وقعت في الفخّ ده مرتين في الجلسة دي** — حكمت على القاعدة من
--    ملفات المشروع ولقيتها مختلفة. فالملف ده بيسأل الأول.
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ══ ١) أعمدة `sessions` الموجودة ═══════════════════════
  --
  -- الخطة بتضيف: room_name · room_url · recording_id ·
  -- recording_status · recording_expires_at
  SELECT
    '1. أعمدة الجلسات'::text AS القسم,
    c.column_name::text      AS البند,
    (c.data_type
      || CASE WHEN c.is_nullable = 'YES' THEN '  ·  يقبل الفراغ' ELSE '  ·  **مطلوب**' END
      || COALESCE('  ·  افتراضي: ' || c.column_default, ''))::text AS التفاصيل,
    CASE WHEN c.column_name IN
      ('room_name','room_url','recording_id','recording_status','recording_expires_at')
      THEN '⚠️ العمود ده موجود خلاص — مانضيفوش'
      ELSE '✓ قائم' END AS الحالة
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'sessions'

  UNION ALL

  -- ══ ٢) موافقة ولي الأمر — فيه مكان لها؟ ════════════════
  SELECT
    '2. الاشتراكات',
    c.column_name::text,
    (c.data_type || CASE WHEN c.is_nullable='YES' THEN '  ·  يقبل الفراغ' ELSE '  ·  مطلوب' END)::text,
    CASE WHEN c.column_name LIKE '%consent%'
      THEN '⚠️ موجود خلاص'
      ELSE '✓ قائم' END
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'course_subscriptions'

  UNION ALL

  -- ══ ٣) سياسات `sessions` — مين بيقرا ومين بيكتب ════════
  --
  -- ⚠️ **الأهم في الملف ده.** الأعمدة الجديدة فيها **رابط دخول
  --    غرفة** — أي حد يقراه يقدر يدخل جلسة طفل. وصلاحيات Postgres
  --    بتحمي **الصفوف لا الأعمدة** (قاعدة «ب»)، يعني أي سياسة
  --    قراءة قايمة على `sessions` هتشمل الأعمدة الجديدة تلقائيًّا.
  SELECT
    '3. سياسات الجلسات',
    (p.policyname || '  ·  ' || p.cmd)::text,
    ('للأدوار: ' || array_to_string(p.roles, ', ')
      || '  ·  الشرط: ' || COALESCE(left(p.qual, 120), '—'))::text,
    CASE
      WHEN 'anon' = ANY(p.roles) THEN '🔴 الزائر بيقرا — خطر على رابط الغرفة'
      WHEN p.cmd = 'SELECT' THEN '⚠️ هتشمل الأعمدة الجديدة'
      ELSE '✓ للمراجعة'
    END
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'sessions'

  UNION ALL

  -- ══ ٤) محفّزات على الجلسات ═════════════════════════════
  --
  -- فيه حارس على الجلسات من ملف 82. لو بيجمّد أعمدة، هيمنع
  -- كتابة اسم الغرفة زي ما `guard_order_fields` صفّر الإجمالي.
  SELECT
    '4. المحفّزات',
    tg.tgname::text,
    (CASE tg.tgtype::integer & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END
      || '  ·  الدالة: ' || pr.proname
      || '  ·  بيجمّد أعمدة: '
      || CASE WHEN pg_get_functiondef(pr.oid) ILIKE '%:= OLD.%' THEN '**أيوه**' ELSE 'لأ' END)::text,
    CASE WHEN pg_get_functiondef(pr.oid) ILIKE '%:= OLD.%'
      THEN '⚠️ افحصه — ممكن يمنع كتابة الغرفة' ELSE '✓' END
  FROM pg_trigger tg
  JOIN pg_proc pr ON pr.oid = tg.tgfoid
  WHERE tg.tgrelid = 'public.sessions'::regclass AND NOT tg.tgisinternal

  UNION ALL

  -- ══ ٥) الوضع الحالي للبيانات ═══════════════════════════
  SELECT
    '5. البيانات',
    'الجلسات',
    ('العدد: ' || (SELECT count(*)::text FROM public.sessions)
      || '  ·  ليها رابط لقاء: '
      || (SELECT count(*)::text FROM public.sessions WHERE COALESCE(meeting_url,'') <> '')
      || '  ·  قادمة: '
      || (SELECT count(*)::text FROM public.sessions
           WHERE scheduled_at > now() AND status NOT IN ('completed','cancelled')))::text,
    'للمراجعة'

  UNION ALL

  SELECT
    '5. البيانات',
    'الاشتراكات',
    ('العدد: ' || (SELECT count(*)::text FROM public.course_subscriptions)
      || '  ·  نشطة: '
      || (SELECT count(*)::text FROM public.course_subscriptions WHERE status = 'active'))::text,
    'للمراجعة'

  UNION ALL

  -- ══ ٦) صلاحيات الإدارة الموجودة ════════════════════════
  --
  -- «الإدارة تدخل أي جلسة شغّالة» محتاجة صلاحية. فيه واحدة
  -- مناسبة خلاص ولا محتاجين واحدة جديدة؟
  SELECT
    '6. الصلاحيات',
    'permissions المستخدمة',
    (SELECT string_agg(DISTINCT perm, ' · ')
       FROM public.user_profiles up,
            LATERAL unnest(COALESCE(up.permissions, ARRAY[]::text[])) AS perm)::text,
    'لاختيار صلاحية الدخول للغرف'

) t ORDER BY القسم, البند;

-- ============================================================
-- مفيش تراجع — الملف قراءة فقط.
-- ============================================================
