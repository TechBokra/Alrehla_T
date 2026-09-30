-- ============================================================
-- 125 — تشخيص قبل صور بروفايل المدرب (غلاف + أعمال)
-- ============================================================
--
-- ⚠️ **الملف ده مابيغيّرش حاجة خالص.** بيقرا وبيطبع.
--
-- ── ليه تشخيص قبل ما أكتب سطر واحد ─────────────────────────
--
-- القاعدة عندنا: **Supabase هي مصدر الحقيقة، لا ملفات المشروع**.
-- وأنا غلطت في ده تلات مرات قبل كده — آخرها لما قريت اسم عمود في
-- `supabase.ts` وما شفتش هو على أنهي جدول، فوقع ملف 119.
--
-- ── والمحتاج معرفته بالظبط ──────────────────────────────────
--
--   ① **أعمدة `instructors` الحالية** — هل فيه عمود غلاف أصلًا؟
--      وإيه نوع `id`؟ (نعرف إنه `text` من ملف 120، بس نتأكد
--      تاني — المفتاح الأجنبي بيفشل لو النوع مختلف)
--
--   ② **سياسات `instructors`** — مين بيكتب عليها دلوقتي؟ لو
--      المدرب بيكتب مباشرةً، الغلاف ممكن يتحط معاها. ولو
--      الكتابة للإدارة وحدها، يبقى الغلاف محتاج مسارًا تانيًا.
--
--   ③ **`guard_instructor_fields`** — الحارس بيجمّد أنهي أعمدة؟
--      أي عمود جديد **مش مجمَّد** معناه المدرب يقدر يكتبه بنفسه.
--      ودي مش مشكلة للغلاف، لكنها لازم تبقى **قرارًا مكتوبًا**
--      لا نتيجة غفلة.
--
--   ④ **`profile_update_requests`** — المدرب بيعدّل ببعت طلب
--      والإدارة توافق. فالسؤال: الصور تمشي في نفس المسار ولا
--      تنشر على طول؟ الاستعلام بيطبع شكل الطلب عشان نعرف هل
--      يقدر يشيل صورة أصلًا.
--
--   ⑤ **جدول أعمال موجود بالفعل؟** ممكن يكون فيه حاجة شبهها
--      اتعملت قبل كده ونسيناها — إنشاء جدول تاني بنفس الغرض
--      أوحش من مفيش.
-- ============================================================

SELECT البند, التفاصيل, ملاحظة FROM (

  -- ══ ① أعمدة instructors ═══════════════════════════════
  SELECT
    ('عمود: ' || c.column_name)::text AS البند,
    (c.data_type || COALESCE(' · افتراضي: ' || c.column_default, '')
      || ' · ' || CASE WHEN c.is_nullable='YES' THEN 'يقبل الفراغ' ELSE 'إجباري' END)::text AS التفاصيل,
    '⬅️ أعمدة الجدول الحالية'::text AS ملاحظة
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='instructors'

  UNION ALL

  -- ══ ② سياسات instructors ══════════════════════════════
  --
  -- ⚠️ القاعدة عندنا: **أي ملف صلاحيات على جدول قائم يبدأ
  --    باستعلام `pg_policies` قبل كتابة سطر.**
  SELECT
    ('سياسة: ' || p.policyname),
    (p.cmd || '  ·  أدوار: ' || array_to_string(p.roles, ',')
      || '  ·  USING: ' || COALESCE(p.qual,'—')
      || '  ·  CHECK: ' || COALESCE(p.with_check,'—')),
    '⬅️ مين بيكتب على instructors'
  FROM pg_policies p
  WHERE p.schemaname='public' AND p.tablename='instructors'

  UNION ALL

  -- ══ ③ الحارس — أنهي أعمدة مجمَّدة ═════════════════════
  --
  -- ⚠️ بنقرا `prosrc` لا `pg_get_functiondef`: التانية **بترمي
  --    على الدوال التجميعية** وده اللي أوقع ملف 115.
  SELECT
    'نصّ guard_instructor_fields',
    pr.prosrc,
    '⬅️ أي عمود مش مذكور هنا = المدرب يكتبه بنفسه'
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid=pr.pronamespace
  WHERE n.nspname='public' AND pr.prokind='f'
    AND pr.proname='guard_instructor_fields'

  UNION ALL

  -- ══ ④ مسار طلب التعديل ════════════════════════════════
  SELECT
    ('طلبات التعديل: ' || c.column_name),
    c.data_type,
    '⬅️ هل يقدر يحمل صورة؟'
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='profile_update_requests'

  UNION ALL

  -- ══ ⑤ جدول أعمال موجود قبل كده؟ ═══════════════════════
  --
  -- ⚠️ إنشاء جدول تاني بنفس الغرض أوحش من مفيش: الشاشة بتقرا من
  --    واحد والإدارة بتكتب في التاني، ومحدش بيلاحظ.
  SELECT
    'جداول فيها اسم يوحي بأعمال/صور',
    COALESCE((
      SELECT string_agg(t.table_name, ', ' ORDER BY t.table_name)
        FROM information_schema.tables t
       WHERE t.table_schema='public'
         AND (t.table_name ILIKE '%work%' OR t.table_name ILIKE '%portfolio%'
           OR t.table_name ILIKE '%gallery%' OR t.table_name ILIKE '%publication%'
           OR t.table_name ILIKE '%instructor%')
    ), 'مفيش'),
    '⬅️ لو فيه حاجة جاهزة نستعملها بدل ما نعمل جديدًا'

  UNION ALL

  -- ══ ⑥ الأعمدة اللي فيها روابط صور دلوقتي ══════════════
  --    عشان الجديد يمشي على نفس النمط لا ينفرد بشكل تاني.
  SELECT
    'أعمدة روابط الصور في المشروع',
    COALESCE((
      SELECT string_agg(c.table_name || '.' || c.column_name, ', ' ORDER BY c.table_name)
        FROM information_schema.columns c
       WHERE c.table_schema='public'
         AND (c.column_name ILIKE '%image%url%' OR c.column_name ILIKE '%avatar%'
           OR c.column_name ILIKE '%cover%' OR c.column_name ILIKE '%photo%')
    ), 'مفيش'),
    '⬅️ النمط المتّبع في المشروع'

) t ORDER BY البند;
