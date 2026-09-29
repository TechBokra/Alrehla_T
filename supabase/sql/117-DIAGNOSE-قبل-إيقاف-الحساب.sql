-- ============================================================
-- 117 — تشخيص: قبل إيقاف الحساب  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.** مفيش تعديل ولا سياسة بتتغيّر ولا صف بيتلمس.
--
-- ── القرار المتاخد ──────────────────────────────────────────
--
-- «إيقاف الحساب» عندنا معناه **منع الشراء لا منع الدخول**.
--
-- والسبب إن منع الدخول بيقفل على الأهل **الجلسات اللي دفعوا
-- تمنها** ومعرض شغل ابنهم — يعني عقاب على خلاف إداري بيطول خدمة
-- مدفوعة. الإيقاف بيمنع الشراء الجديد وبس.
--
-- ── واللي لازم نعرفه قبل أول سطر ────────────────────────────
--
-- ⚠️ **① المستخدم بيعدّل صفّه بنفسه.**
--
--    `user_profiles` عليه سياسة «المستخدم يعدّل صفه» — ودي القاعدة
--    اللي خلّت رفع الصلاحيات ممكنًا زمان، واللي المحفّز
--    `guard_user_profile_fields` اتعمل عشانها.
--
--    فلو ضفنا عمود إيقاف وما حطّيناهوش في المحفّز، **المستخدم
--    الموقوف بيفكّ إيقاف نفسه بنداء واحد** من متصفحه. مفتاح
--    الموقع العام في الصفحة، ورقم حسابه هو اللي `auth.uid()`
--    بترجّعه.
--
--    ⚠️ ودي نفس مصيدة (ب): **الصلاحيات بتحمي الصفوف لا الأعمدة.**
--
--    القسم ٢ بيطبع **نصّ المحفّز كامل** عشان نمدّه لا نكتبه من أول
--    وجديد. والقاعدة المكتوبة عندنا: القاعدة هي مصدر الحقيقة لا
--    ملفات المشروع.
--
-- ⚠️ **② فين بالظبط بيتمنع الشراء؟**
--
--    مسارين بيخلقوا التزامًا ماليًّا:
--      • `create_customer_order`   — طلبات المتجر
--      • `create_course_booking`   — حجز الباقات
--
--    الاتنين `SECURITY DEFINER`، يعني الفحص جوّاهم **مش ممكن
--    يتخطّى** — عكس الفحص في الكود اللي بيتعدّى بنداء مباشر
--    للقاعدة (قاعدة «ع»).
--
--    القسم ٣ بيطبع **توقيعهم بالحرف**.
--
--    ⚠️ **وده مش تفصيلة**: `CREATE OR REPLACE` بتوقيع مختلف
--       **بتضيف نسخة تانية ومابتستبدلش** (مصيدة «س»)، والنداء
--       بيبقى ملتبسًا. ده بالظبط اللي أوقع حجز الباقات على
--       الإنتاج في ملف 86 واتصلح في 87. فالتوقيع لازم يتنسخ حرفًا
--       بحرف.
--
-- ⚠️ **③ فيه عمود موجود أصلًا؟**
--
--    القسم ١ بيطبع أعمدة `user_profiles` كلها. لو فيه حاجة اسمها
--    `is_active` أو `status` هناك، بنستعملها بدل ما نضيف عمود
--    تاني بنفس المعنى — وحقلين بيوصفوا نفس الحاجة بينتجوا شاشتين
--    متناقضتين (درس §10/14).
--
-- ⚠️ **④ مين اللي ممكن يتوقف؟**
--
--    القسم ٥ بيعدّ الحسابات بأدوارها. لو الإيقاف اتطبّق على
--    **إداري** بالغلط، مين يفكّه؟ الإجابة بتحدّد شرط في ملف 118.
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ══ ١) أعمدة ملف المستخدم ══════════════════════════════
  SELECT
    '1. أعمدة user_profiles'::text AS القسم,
    c.column_name::text             AS البند,
    (c.data_type
      || CASE WHEN c.is_nullable = 'NO' THEN '  ·  مطلوب' ELSE '  ·  يقبل الفراغ' END
      || '  ·  افتراضي: ' || COALESCE(c.column_default, '—'))::text AS التفاصيل,
    CASE
      WHEN c.column_name IN ('is_active','status','suspended_at','disabled_at')
        THEN '⬅️ ممكن يكون ده مكان الإيقاف — نستعمله بدل ما نضيف تاني'
      ELSE '—'
    END AS الحالة
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'user_profiles'

  UNION ALL

  -- ══ ٢) نصّ حارس أعمدة الملف ════════════════════════════
  --
  -- ⚠️ **ده أهم قسم في الملف.** العمود الجديد لازم يتضاف للمحفّز
  --    ده، وإلا الموقوف بيفكّ إيقاف نفسه من متصفحه.
  SELECT
    '2. حارس أعمدة الملف',
    pr.proname::text,
    pg_get_functiondef(pr.oid)::text,
    '⬅️ العمود الجديد لازم يتجمّد هنا'
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.prokind = 'f'
    AND pr.proname = 'guard_user_profile_fields'

  UNION ALL

  -- ══ ٢ب) سياسات الملف ═══════════════════════════════════
  --
  -- عشان نتأكّد إن المستخدم فعلًا بيعدّل صفّه — وإن الافتراض اللي
  -- القسم ٢ مبني عليه صح.
  SELECT
    '2ب. سياسات user_profiles',
    (p.cmd || ' — ' || p.policyname)::text,
    ('USING: ' || COALESCE(p.qual, '—')
      || '  ·  WITH CHECK: ' || COALESCE(p.with_check, '—'))::text,
    CASE WHEN p.cmd IN ('UPDATE','ALL') THEN '⬅️ دي اللي بتخلّي الحارس لازم' ELSE '—' END
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'user_profiles'

  UNION ALL

  -- ══ ٣) توقيع دالتي الشراء ══════════════════════════════
  --
  -- ⚠️ **ينسخ حرفًا بحرف في ملف 118.** `CREATE OR REPLACE` بتوقيع
  --    مختلف بتضيف نسخة تانية ومابتستبدلش (مصيدة «س») — وده اللي
  --    أوقع حجز الباقات على الإنتاج في ملف 86.
  SELECT
    '3. دوال الشراء',
    pr.proname::text,
    ('المعاملات: ' || pg_get_function_arguments(pr.oid)
      || '  ·  بترجّع: ' || pg_get_function_result(pr.oid)
      || '  ·  ' || CASE WHEN pr.prosecdef THEN 'SECURITY DEFINER' ELSE 'INVOKER' END)::text,
    '⬅️ التوقيع ده بالحرف'
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.prokind = 'f'
    AND pr.proname IN ('create_customer_order', 'create_course_booking')

  UNION ALL

  -- ══ ٣ب) ونصّهم الكامل ══════════════════════════════════
  --
  -- عشان الفحص الجديد يتحطّ في **أول** الدالة، قبل أي كتابة —
  -- فحص بعد الإدراج معناه طلب اتعمل ثم اتلغى.
  SELECT
    '3ب. نصّ دوال الشراء',
    pr.proname::text,
    pg_get_functiondef(pr.oid)::text,
    '⬅️ الفحص بيتحطّ في أولها'
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.prokind = 'f'
    AND pr.proname IN ('create_customer_order', 'create_course_booking')

  UNION ALL

  -- ══ ٤) عدد النسخ من كل دالة ════════════════════════════
  --
  -- ⚠️ لو رقم أكبر من ١، يبقى فيه نسخة قديمة عايشة جنب الجديدة
  --    (مصيدة «س» حصلت قبل كده فعلًا). لازم تتشال قبل أي تعديل.
  SELECT
    '4. نسخ الدوال',
    x.fname,
    x.cnt::text,
    CASE WHEN x.cnt > 1 THEN '🔴 أكتر من نسخة — النداء ملتبس' ELSE '✓ نسخة واحدة' END
  FROM (
    SELECT pr.proname::text AS fname, count(*) AS cnt
    FROM pg_proc pr
    JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public'
      AND pr.proname IN ('create_customer_order', 'create_course_booking')
    GROUP BY pr.proname
  ) x

  UNION ALL

  -- ══ ٥) الحسابات بأدوارها ═══════════════════════════════
  --
  -- ⚠️ لو إداري اتوقف بالغلط، مين يفكّه؟ الإجابة بتحدّد شرطًا في
  --    ملف 118: الإيقاف على غير الإداريين، أو لمدير النظام وحده.
  SELECT
    '5. الحسابات',
    up.role::text,
    count(*)::text,
    CASE WHEN up.role IN ('super_admin','general_supervisor')
         THEN '⬅️ دول اللي السؤال عليهم' ELSE '—' END
  FROM public.user_profiles up
  GROUP BY up.role

) t ORDER BY القسم, البند;

-- ============================================================
-- مفيش تراجع — الملف قراءة فقط.
-- ============================================================
