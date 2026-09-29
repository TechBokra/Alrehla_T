-- ============================================================
-- 120 — تشخيص: قفل أسعار المدربين على المسجَّلين  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.** مفيش تعديل ولا سياسة بتتغيّر.
--
-- ── البند المعلَّق ──────────────────────────────────────────
--
-- ملف 84 قفل قراءة `instructors` على الزائر المجهول. اللي فضل
-- مكتوبًا في الدفتر من ساعتها:
--
--   «أي مستخدم **مسجَّل** ما زال يقرأ أسعار المدربين من الجدول.
--    إغلاقه يكسر `instructors(display_name)` المتداخلة في طلبات
--    الخدمة — دورة منفصلة.»
--
-- ── إيه اللي بيتسرّب بالظبط ─────────────────────────────────
--
-- الجدول فيه `approved_price` و`requested_price` و
-- `monthly_hours_committed` وغيرها — **تسعير داخلي بين المنصة
-- والمدرب**. أي حساب مسجَّل (وإنشاء الحساب مجاني ومفتوح) بيقرا
-- الصف كامل بنداء واحد بمفتاح الموقع العام.
--
-- ⚠️ **ودي مصيدة (ب) في أوضح صورها**: السياسة بتقول «مين يشوف
--    الصف»، وماعندهاش رأي في «أي أعمدة». الصف بيرجع كامل.
--
-- ⚠️ **والكود اتصلّح خلاص** — `PublicInstructor` بيشيل الحقول
--    السبعة، والصفحات العامة بتنادي دالتين `SECURITY DEFINER`
--    بقائمة أعمدة صريحة (ملف 83). يعني **الشاشة نضيفة والقاعدة
--    لأ**، والفرق بينهم نداء مباشر واحد.
--
-- ── واللي لازم نعرفه قبل ما نقفل ────────────────────────────
--
-- ⚠️ **① مين بيقرا الجدول بالاسم المتداخل؟**
--
--    Supabase بيعمل `instructors(display_name)` بجملة JOIN تحت،
--    و**بتمرّ على نفس سياسة القراءة**. فتضييق السياسة بيفضّي
--    الاسم في كل شاشة بتعمل كده — **بلا رسالة خطأ** (قاعدة «ك»).
--
--    ⚠️ **ودي هي اللي خلّت البند معلّقًا من الأول.** القسم ٢
--       بيطبع السياسة، والقسم ٤ بيعدّ الصفوف المرتبطة عشان نعرف
--       حجم اللي هيتأثّر.
--
-- ⚠️ **② `can_see_profile` بتعتمد على إيه؟**
--
--    ملف 82 ساب `instructor_teaches` و`can_see_profile` ممنوحة
--    للزائر **عن قصد**، لأنها بتتنادى جوّه سياسات RLS نفسها،
--    وسحبها بيحوّل «ترجع false» لـ«permission denied» فتسقط
--    صفحات عامة. القسم ٣ بيطبع نصّها عشان نبني على نفس النمط.
--
-- ⚠️ **③ الأعمدة الحسّاسة إيه بالظبط؟**
--
--    القسم ١ بيسردها من القاعدة لا من `PublicInstructor` — النوع
--    في الكود ممكن يكدب على القاعدة (قاعدة «ج»).
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ══ ١) أعمدة جدول المدربين ═════════════════════════════
  SELECT
    '1. أعمدة المدربين'::text AS القسم,
    c.column_name::text        AS البند,
    (c.data_type
      || CASE WHEN c.is_nullable = 'NO' THEN '  ·  مطلوب' ELSE '  ·  يقبل الفراغ' END)::text
      AS التفاصيل,
    CASE
      WHEN c.column_name IN (
        'approved_price','requested_price','monthly_hours_committed',
        'payout_details','contract_notes','internal_notes'
      ) THEN '🔴 تسعير/بيانات داخلية — مايوصلش لمستخدم عادي'
      WHEN c.column_name IN ('id','display_name','bio','specialties','status','avatar_url','user_id')
        THEN '✓ عام بطبيعته'
      ELSE '⬅️ قرّر: عام ولا داخلي'
    END AS الحالة
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'instructors'

  UNION ALL

  -- ══ ٢) سياسات المدربين ═════════════════════════════════
  SELECT
    '2. سياسات المدربين',
    (p.cmd || ' — ' || p.policyname)::text,
    ('الأدوار: ' || array_to_string(p.roles, ', ')
      || '  ·  USING: ' || COALESCE(p.qual, '—')
      || '  ·  WITH CHECK: ' || COALESCE(p.with_check, '—'))::text,
    CASE WHEN p.cmd = 'SELECT' THEN '⬅️ دي اللي بتسرّب الأعمدة' ELSE '—' END
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'instructors'

  UNION ALL

  -- ══ ٣) الدوال العامة الموجودة ══════════════════════════
  --
  -- بنبني على نفس النمط بدل ما نخترع واحدًا تانيًا — تلات طرق
  -- لنفس السؤال بتنتج تلات إجابات مختلفة بعد سنة.
  SELECT
    '3. الدوال المتعلقة',
    pr.proname::text,
    ((CASE WHEN pr.prosecdef THEN 'SECURITY DEFINER' ELSE 'INVOKER' END)
      || '  ·  بترجّع: ' || pg_get_function_result(pr.oid)
      || '  ·  ممنوحة لـanon: '
      || CASE WHEN has_function_privilege('anon', pr.oid, 'EXECUTE')
              THEN 'أيوه' ELSE 'لأ' END)::text,
    CASE WHEN pr.proname IN ('can_see_profile','instructor_teaches','owns_instructor')
         THEN '⚠️ بتتنادى جوّه سياسات — سحبها من anon بيسقّط صفحات'
         ELSE '—' END
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.prokind = 'f'
    AND (pr.proname ILIKE '%instructor%'
      OR pr.proname IN ('can_see_profile','owns_instructor'))

  UNION ALL

  -- ══ ٤) مين مرتبط بالمدربين ═════════════════════════════
  --
  -- ⚠️ ده مقياس الضرر لو السياسة اتضيّقت والاسم المتداخل فضي.
  --    الرقم الكبير معناه شاشات كتير هتقول «بلا مدرب» فجأة.
  SELECT
    '4. الارتباطات',
    x.label,
    x.detail,
    'للمراجعة'
  FROM (
    SELECT 'مدربون'::text AS label,
           ('إجمالي: ' || (SELECT count(*)::text FROM public.instructors)
             || '  ·  نشط: '
             || (SELECT count(*)::text FROM public.instructors WHERE status = 'active'))::text AS detail
    UNION ALL
    SELECT 'طلبات خدمات بمدرب',
           (SELECT count(*)::text FROM public.service_orders WHERE instructor_id IS NOT NULL)
    UNION ALL
    SELECT 'جلسات بمدرب',
           (SELECT count(*)::text FROM public.sessions WHERE instructor_id IS NOT NULL)
    UNION ALL
    SELECT 'اشتراكات بمدرب مفضّل',
           (SELECT count(*)::text FROM public.course_subscriptions
             WHERE preferred_instructor_id IS NOT NULL)
    UNION ALL
    SELECT 'عروض مقدّمي الخدمة',
           (SELECT count(*)::text FROM public.provider_services)
  ) x

  UNION ALL

  -- ══ ٥) فيه view عام على المدربين؟ ══════════════════════
  --
  -- لو فيه، يمكن يبقى هو الطريق الأنضف: الشاشات تقرا منه،
  -- والجدول نفسه يتقفل على الإدارة والمدرب.
  SELECT
    '5. views على المدربين',
    v.viewname::text,
    left(v.definition, 300)::text,
    '⬅️ ممكن يكون ده الطريق'
  FROM pg_views v
  WHERE v.schemaname = 'public' AND v.definition ILIKE '%instructors%'

) t ORDER BY القسم, البند;

-- ============================================================
-- مفيش تراجع — الملف قراءة فقط.
-- ============================================================
