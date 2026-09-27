-- ============================================================
-- 103 — تشخيص: صلاحيات عروض المدرب  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.** مفيش تعديل ولا إنشاء ولا سياسة بتتغيّر.
--
-- ── ليه الملف ده ────────────────────────────────────────────
--
-- تحديثات Google AI Studio حوّلت **خمس دوال بيناديها المدرب نفسه**
-- في `src/actions/instructor-services.ts` لمفتاح الخدمة:
--
--     const adminClient = isAdminApiConfigured()
--       ? createAdminClient()   // ← بيتخطّى **كل** الصلاحيات
--       : supabase;
--
-- والتعليق في الكود بيقول السبب صراحةً:
--
--     «إنشاء صف مقدّم الخدمة يتطلب صلاحيات الإدارة بسبب سياسة RLS»
--
-- يعني اصطدموا بسياسة **وتخطّوها** بدل ما يظبطوها.
--
-- ⚠️ **فحصت الخمسة واحدة واحدة: مفيش ثغرة مستغلَّة النهارده** — كلهم
--    بيشتقّوا `provider_id` من جلسة المدرب وبيفلتروا بيه.
--
--    بس المشروع ماشي على مبدأ مكتوب في `auth-guard.ts`: «الحارس
--    الحقيقي هو صلاحيات قاعدة البيانات… لأنها بتشتغل حتى لو حد
--    تجاهل الموقع». والدوال دي بقت **الكود فيها هو الحارس الوحيد** —
--    فأي تعديل مستقبلي ينسى `.eq` واحدة بيبقى ثغرة عبور بين
--    المدربين **بلا أي شبكة أمان تحتها**.
--
-- ── اللي محتاج أعرفه قبل ما أقترح إصلاحًا ───────────────────
--
-- القاعدة المكتوبة عندنا: **أي ملف صلاحيات على جدول قائم يبدأ
-- باستعلام `pg_policies` قبل كتابة سطر.** وده هو.
--
-- ⚠️ ومصيدة (ن): سياسة `INSERT` بتخزّن شرطها في `with_check` لا في
--    `qual` — فالقراءة الغلط بتوري السياسة فاضية وهي مش كده.
--
-- ⚠️ ومصيدة (أ): السياسات بتتجمع بـ**«أو»** — فسياسة واحدة واسعة
--    بتفتح الباب مهما كانت اللي جنبها ضيّقة.
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ══ ١) سياسات جدول مقدّمي الخدمة ═══════════════════════
  SELECT
    '1. service_providers'::text AS القسم,
    p.policyname::text            AS البند,
    (p.cmd || '  ·  الأدوار: ' || array_to_string(p.roles, ', ')
      || '  ·  USING: ' || COALESCE(p.qual, '—')
      || '  ·  WITH CHECK: ' || COALESCE(p.with_check, '—'))::text AS التفاصيل,
    CASE WHEN p.cmd IN ('INSERT', 'ALL') THEN '← ده اللي الكود بيتخطّاه'
         ELSE 'للمراجعة' END AS الحالة
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'service_providers'

  UNION ALL

  -- ══ ٢) سياسات جدول عروض الخدمات ════════════════════════
  SELECT
    '2. provider_services',
    p.policyname::text,
    (p.cmd || '  ·  الأدوار: ' || array_to_string(p.roles, ', ')
      || '  ·  USING: ' || COALESCE(p.qual, '—')
      || '  ·  WITH CHECK: ' || COALESCE(p.with_check, '—'))::text,
    CASE WHEN p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
         THEN '← الكتابة هنا بتتم بمفتاح الخدمة' ELSE 'للمراجعة' END
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'provider_services'

  UNION ALL

  -- ══ ٣) RLS مفعّلة على الجدولين؟ ════════════════════════
  SELECT
    '3. حماية الجداول',
    t.tablename::text,
    (CASE WHEN t.rowsecurity THEN 'RLS مفعّلة' ELSE 'RLS متوقفة' END
      || '  ·  عدد السياسات: '
      || (SELECT count(*)::text FROM pg_policies pp
           WHERE pp.schemaname = 'public' AND pp.tablename = t.tablename))::text,
    CASE WHEN t.rowsecurity THEN '✓ مفعّلة' ELSE '🔴 متوقفة' END
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN ('service_providers', 'provider_services')

  UNION ALL

  -- ══ ٤) هل في دالة بتقول «ده مقدّم الخدمة بتاعي»؟ ═══════
  --
  -- لو موجودة بنبني عليها زي ما بنينا على `instructor_teaches`
  -- و`guardian_of_student` — بدل ما نخترع تالتة.
  SELECT
    '4. دوال مساعدة',
    pr.proname::text,
    ((CASE WHEN pr.prosecdef THEN 'SECURITY DEFINER' ELSE 'INVOKER' END)
      || '  ·  المعاملات: ' || pg_get_function_arguments(pr.oid))::text,
    '✓ موجودة'
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND (pr.proname ILIKE '%provider%' OR pr.proname ILIKE '%instructor%')

  UNION ALL

  -- ══ ٥) الوضع الحالي بالأرقام ═══════════════════════════
  SELECT
    '5. الأرقام',
    x.label,
    x.detail,
    'للمراجعة'
  FROM (
    SELECT 'مقدّمو الخدمة'::text AS label,
           ('إجمالي: ' || (SELECT count(*)::text FROM public.service_providers)
             || '  ·  مربوطين بمدرب: '
             || (SELECT count(*)::text FROM public.service_providers
                  WHERE instructor_id IS NOT NULL))::text AS detail
    UNION ALL
    SELECT 'مدربون بلا صف مقدّم خدمة',
           (SELECT count(*)::text FROM public.instructors i
             WHERE NOT EXISTS (SELECT 1 FROM public.service_providers sp
                                WHERE sp.instructor_id::text = i.id::text))
    UNION ALL
    SELECT 'عروض الخدمات',
           ('إجمالي: ' || (SELECT count(*)::text FROM public.provider_services)
             || '  ·  معلّقة: '
             || (SELECT count(*)::text FROM public.provider_services
                  WHERE status = 'pending'))
  ) x

) t ORDER BY القسم, البند;

-- ============================================================
-- مفيش تراجع — الملف قراءة فقط.
-- ============================================================
