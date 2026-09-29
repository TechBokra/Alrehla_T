-- ============================================================
-- 115 — تشخيص: قبل إنشاء الجلسات من الإدارة  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.** مفيش تعديل ولا إنشاء ولا سياسة بتتغيّر ولا صف
--    بيتلمس. شغّله كله وابعتلي الجدول.
--
-- ── ليه الملف ده قبل الكود ──────────────────────────────────
--
-- البند المطلوب: **الإدارة تقدر تعمل جلسة**. النهارده الجلسات
-- بتتولّد من حتة واحدة بس — تأكيد دفع حجز الباقة — يعني لو جلسة
-- اتلغت أو اتأجّلت أو محتاجة تعويض، **مفيش طريقة**.
--
-- ── واللي لازم نعرفه قبل أول سطر كود ────────────────────────
--
-- ⚠️ **① هل فيه سياسة INSERT على `sessions` أصلًا؟**
--
--    شكّي إن مفيش. الجلسات بتتعمل من `create_course_booking` وهي
--    `SECURITY DEFINER` — يعني بتكتب **بصلاحية صاحب الدالة**، فما
--    كانتش محتاجة سياسة إدراج لحد النهارده.
--
--    ولو ده صح، فأي `INSERT` من كود الإدارة بجلسة المستخدم
--    **هيترفض**. والرفض ده **مابيرجعش خطأ مفهوم** — بيرجع صفر
--    صفوف (قاعدة «ك»)، فالشاشة تقول «اتعملت» والجلسة مش موجودة.
--
--    القسم ١ بيطبع كل سياسة بشرطها كامل عشان نعرف بالظبط.
--
-- ⚠️ **② `guard_session_fields` بيجمّد إيه وعلى مين؟**
--
--    المحفّز ده اتضاف في ملف 82 وامتدّ في ملف 111 عشان يجمّد أعمدة
--    الغرفة والتسجيل. وإحنا داخلين نكتب في `sessions` من مكان
--    جديد — فلازم نقرا نصّه بالحرف، مش نفتكره.
--
--    ⚠️ **والقاعدة المكتوبة عندنا صريحة: القاعدة هي مصدر الحقيقة
--       لا ملفات المشروع.** وأنا غلطت في ده مرتين قبل كده
--       (دروس §10/9 و§10/13): حكمت على القاعدة من الكود وطلعت غلط.
--
--    القسم ٢ بيطبع **نصّ الدالة كامل**.
--
-- ⚠️ **③ رقم الجلسة — فيه قيد تفرّد؟**
--
--    لو فيه `UNIQUE (course_subscription_id, session_number)`،
--    فحساب الرقم الجديد بـ`COUNT(*) + 1` **بيتصادم** أول ما جلسة
--    تتلغي أو تتحذف: العدّ بيرجع رقم اتاخد قبل كده.
--
--    الصح `MAX + 1`. والقسم ٣ بيقول فيه قيد ولا لأ — والفرق بين
--    إدراج بينجح وإدراج بيرفض.
--
-- ⚠️ **④ الحالات المسموحة.**
--
--    ملف 114 ضاف `sessions_status_check`. الجلسة الجديدة لازم
--    تتولد بحالة **جوّه القيد**، وإلا الإدراج بيترفض.
--
-- ⚠️ **⑤ الجلسة الزيادة — السؤال اللي مش تقني.**
--
--    الجلسة لازم تبقى تابعة لاشتراك (`course_subscription_id`
--    مطلوب). والاشتراك اشترى عدد جلسات محدّد.
--
--    فإضافة جلسة لاشتراك استهلك عدده **بتدّي جلسة مجانية**. وده
--    ممكن يكون مقصودًا تمامًا (تعويض عن جلسة ضاعت)، ومش ممكن
--    يكون بالغلط. القسم ٥ بيقيس الفجوة دي على البيانات الحالية
--    عشان الشاشة تعرف تقول للإداري «دي جلسة زيادة» قبل ما يضغط.
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ══ ١) سياسات جدول الجلسات ═════════════════════════════
  --
  -- ⚠️ السياسات بتتجمّع بـ«أو» لا بـ«و»: سياسة واحدة واسعة بتفتح
  --    الباب مهما كانت اللي جنبها ضيّقة. فبنطبع الشرط كامل لكل
  --    واحدة، مش أسماءها.
  SELECT
    '1. سياسات الجلسات'::text AS القسم,
    (p.cmd || ' — ' || p.policyname)::text AS البند,
    ('الأدوار: ' || array_to_string(p.roles, ', ')
      || '  ·  USING: ' || COALESCE(p.qual, '—')
      || '  ·  WITH CHECK: ' || COALESCE(p.with_check, '—'))::text AS التفاصيل,
    CASE
      WHEN p.cmd IN ('INSERT','ALL') THEN '⬅️ دي اللي بتقرّر هل الإدارة تقدر تعمل جلسة'
      ELSE '—'
    END AS الحالة
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'sessions'

  UNION ALL

  -- ══ ١ب) فيه سياسة إدراج من أصله؟ ═══════════════════════
  --
  -- سطر واحد بيجاوب على السؤال ده بـ«أيوه/لأ» بدل ما نستنتجه من
  -- غياب صف في القسم اللي فوق — والغياب سهل ما يتلاحظش.
  SELECT
    '1ب. خلاصة الإدراج',
    'سياسة INSERT على sessions',
    (SELECT count(*)::text FROM pg_policies
      WHERE schemaname='public' AND tablename='sessions' AND cmd IN ('INSERT','ALL')),
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='sessions' AND cmd IN ('INSERT','ALL')
    ) THEN '✓ فيه — نقرا شرطها فوق'
      ELSE '🔴 مفيش — الإدراج من كود الإدارة هيترفض ويرجع فاضي لا خطأ'
    END

  UNION ALL

  -- ══ ٢) نصّ حارس الأعمدة بالحرف ═════════════════════════
  --
  -- ⚠️ بنقرا الدالة من القاعدة لا من ملف 82 أو 111. الملفات
  --    بتقول اللي اتبعت؛ القاعدة بتقول اللي شغّال.
  SELECT
    '2. حارس أعمدة الجلسات',
    pr.proname::text,
    pg_get_functiondef(pr.oid)::text,
    '⬅️ اقرا الأعمدة المجمَّدة ومين مستثنى'
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.proname = 'guard_session_fields'
    AND pr.prokind = 'f'

  UNION ALL

  -- ══ ٢ب) كل المحفّزات على الجدول ════════════════════════
  --
  -- ممكن يكون فيه محفّز تاني محدّش فاكره بيتدخّل في الإدراج.
  SELECT
    '2ب. محفّزات الجلسات',
    t.tgname::text,
    (CASE t.tgtype & 28
       WHEN 4 THEN 'INSERT' WHEN 8 THEN 'DELETE' WHEN 16 THEN 'UPDATE'
       ELSE 'أكتر من عملية' END
     || '  ·  ' || CASE WHEN (t.tgtype & 2) > 0 THEN 'BEFORE' ELSE 'AFTER' END
     || '  ·  الدالة: ' || pr.proname)::text,
    'للمراجعة'
  FROM pg_trigger t
  JOIN pg_proc pr ON pr.oid = t.tgfoid
  WHERE t.tgrelid = 'public.sessions'::regclass AND NOT t.tgisinternal

  UNION ALL

  -- ══ ٣) القيود والفهارس ═════════════════════════════════
  --
  -- ⚠️ ده اللي بيقرّر: COUNT+1 ولا MAX+1 لرقم الجلسة.
  SELECT
    '3. قيود الجلسات',
    con.conname::text,
    pg_get_constraintdef(con.oid)::text,
    CASE
      WHEN pg_get_constraintdef(con.oid) ILIKE '%UNIQUE%session_number%'
        THEN '⬅️ فيه تفرّد على الرقم — يبقى MAX+1 لا COUNT+1'
      WHEN con.conname = 'sessions_status_check'
        THEN '⬅️ الحالات المسموحة للجلسة الجديدة'
      ELSE '—'
    END
  FROM pg_constraint con
  WHERE con.conrelid = 'public.sessions'::regclass

  UNION ALL

  SELECT
    '3ب. فهارس الجلسات',
    i.indexname::text,
    i.indexdef::text,
    CASE WHEN i.indexdef ILIKE '%UNIQUE%' AND i.indexdef ILIKE '%session_number%'
         THEN '⬅️ تفرّد على الرقم' ELSE '—' END
  FROM pg_indexes i
  WHERE i.schemaname = 'public' AND i.tablename = 'sessions'

  UNION ALL

  -- ══ ٤) مين بيكتب في الجلسات دلوقتي ═════════════════════
  --
  -- لو الكاتب الوحيد دالة `SECURITY DEFINER`، فالطريق الصح لإنشاء
  -- جلسة من الإدارة هو **دالة زيّها** لا سياسة إدراج جديدة —
  -- ده النمط اللي المشروع ماشي عليه من ملف 70.
  -- ⚠️ **بنفتّش في `prosrc` لا بـ`pg_get_functiondef`.**
  --
  --    النسخة الأولى من الملف ده وقعت هنا بالظبط:
  --    `pg_get_functiondef` **بيرمي خطأ على الدوال التجميعية**
  --    (`"array_agg" is an aggregate function`) — ومخطِّط الاستعلام
  --    له إنه يقيس شرط الـILIKE **قبل** شرط المخطّط `public`، فوصل
  --    لدالة في `pg_catalog` ووقع.
  --
  --    `prosrc` عمود عادي في الجدول: بيترجّع بلا تنفيذ ولا خطأ.
  SELECT
    '4. الدوال اللي بتلمس الجلسات',
    pr.proname::text,
    ((CASE WHEN pr.prosecdef THEN 'SECURITY DEFINER' ELSE 'INVOKER' END)
      || '  ·  بترجّع: ' || pg_get_function_result(pr.oid)
      || '  ·  معاملات: ' || COALESCE(NULLIF(pg_get_function_arguments(pr.oid),''), 'بلا'))::text,
    CASE WHEN pr.prosecdef THEN '⬅️ بتكتب بصلاحية صاحبها لا صلاحية الداخل' ELSE '—' END
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.prokind = 'f'
    AND (pr.prosrc ILIKE '%insert into public.sessions%'
      OR pr.prosrc ILIKE '%insert into sessions%')

  UNION ALL

  -- ══ ٥) الجلسة الزيادة — الفجوة بالأرقام ════════════════
  --
  -- ⚠️ ده مش سؤال تقني. الاشتراك اشترى عددًا، وإضافة جلسة بعده
  --    بتدّي جلسة مجانية. ممكن يكون مقصودًا (تعويض)، ومستحيل
  --    يكون بالغلط. الشاشة لازم تقول الرقم ده قبل الضغطة.
  SELECT
    '5. الاشتراكات والجلسات',
    x.label,
    x.detail,
    x.state
  FROM (
    SELECT 'اشتراكات'::text AS label,
           ('إجمالي: ' || (SELECT count(*)::text FROM public.course_subscriptions)
             || '  ·  نشطة: '
             || (SELECT count(*)::text FROM public.course_subscriptions
                  WHERE status = 'active'))::text AS detail,
           'للمراجعة'::text AS state
    UNION ALL
    SELECT 'جلسات',
           ('إجمالي: ' || (SELECT count(*)::text FROM public.sessions)
             || '  ·  قادمة: '
             || (SELECT count(*)::text FROM public.sessions
                  WHERE scheduled_at > now()))::text,
           'المفروض أصفار بعد تنظيف 114'
    UNION ALL
    -- عدد الجلسات المتعاقَد عليه في كل باقة — ده الرقم اللي
    -- الشاشة هتقارن بيه.
    SELECT 'باقات وعدد جلساتها',
           COALESCE(string_agg(w.name || ': ' || COALESCE(w.sessions_count::text,'بلا عدد'),
                               '  ·  ' ORDER BY w.name), 'مفيش باقات'),
           CASE WHEN count(*) FILTER (WHERE w.sessions_count IS NULL) > 0
                THEN '⚠️ فيه باقة بلا عدد — مفيش سقف نقارن بيه'
                ELSE '✓ كل الباقات ليها عدد' END
    FROM public.creative_writing_packages w
  ) x

) t ORDER BY القسم, البند;

-- ============================================================
-- مفيش تراجع — الملف قراءة فقط.
-- ============================================================
