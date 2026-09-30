-- ============================================================
-- 129 — تشخيص قبل «المنتج كله بموافقة الإدارة»
-- ============================================================
--
-- ⚠️ **الملف ده مابيغيّرش حاجة. بيقرا وبيطبع.**
--
-- ── اللي هيتعمل بعده، وتكلفته ───────────────────────────────
--
-- المطلوب: **المنتج كله — بصوره وتفاصيله — مايظهرش للعميل قبل
-- موافقة الإدارة.**
--
-- ⚠️ **وده بيغيّر سلوكًا قائمًا:** الناشر دلوقتي بيعدّل منتجه
--    فالتعديل بيظهر فورًا. بعد كده، أي تعديل منه — حتى تصحيح
--    غلطة إملائية — **بيوقف المنتج عن البيع لحد ما حد يراجع**.
--    ودي تكلفة حقيقية على الناشر وعلى الإدارة، ومتقبولة عن قصد
--    لأن البديل إن الموافقة تبقى على **الصفّ** لا على **اللي
--    فيه**: يرفع صورة سليمة، توافق، يبدّلها.
--
-- ── واللي محتاج أعرفه من القاعدة قبل ما أكتب ────────────────
--
--   ① **سياسات `personalized_products`** — مين بيكتب ومين بيقرا
--      دلوقتي؟ القاعدة عندنا: أي ملف صلاحيات على جدول قائم يبدأ
--      بـ`pg_policies` **قبل كتابة سطر**.
--
--   ② **فيه محفّز حارس على الجدول؟** لو فيه، العمود الجديد لازم
--      يتحط فيه؛ ولو مفيش، هيتعمل واحد — والفرق بيغيّر شكل
--      الملف كله.
--
--   ③ **الزائر بيقرا الجدول إزاي؟** بسياسة مباشرة ولا بدالة؟
--      الفلترة على «المعتمد» لازم تكون **في نفس المكان** اللي
--      الزائر بيمرّ منه، وإلا المنتج غير المعتمد يفضل ظاهرًا.
--
--   ④ **كام منتج موجود دلوقتي؟** الرقم ده هو اللي هيتعلّم
--      «معتمد» في ملف التعديل.
--
--      ⚠️ **ودي أخطر نقطة في العملية كلها:** لو العمود الجديد
--         افتراضيه `pending`، **كل منتج على الموقع بيختفي في نفس
--         اللحظة** — الكتالوج بيفضى والعميل بيشوف مكتبة فاضية.
--         القديم لازم يتعلّم «معتمد» **في نفس المعاملة** اللي
--         بتضيف العمود.
--
--   ⑤ **`is_active` موجود بالفعل** (ملف 121). لازم أعرف علاقته
--      بالجديد عشان مايبقاش فيه مفتاحان بيعملوا نفس الحاجة
--      ويتناقضوا.
-- ============================================================

SELECT البند, التفاصيل, ملاحظة FROM (

  -- ══ ① السياسات ════════════════════════════════════════
  SELECT
    ('سياسة: ' || p.policyname)::text AS البند,
    (p.cmd || '  ·  أدوار: ' || array_to_string(p.roles, ',')
      || '  ·  USING: ' || COALESCE(p.qual, '—')
      || '  ·  CHECK: ' || COALESCE(p.with_check, '—'))::text AS التفاصيل,
    '⬅️ مين بيقرا ومين بيكتب'::text AS ملاحظة
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'personalized_products'

  UNION ALL

  -- ══ ② المحفّزات ═══════════════════════════════════════
  SELECT
    ('محفّز: ' || t.tgname),
    (CASE WHEN (t.tgtype & 2) > 0 THEN 'BEFORE ' ELSE 'AFTER ' END
      || CASE WHEN (t.tgtype & 4) > 0 THEN 'INSERT ' ELSE '' END
      || CASE WHEN (t.tgtype & 16) > 0 THEN 'UPDATE ' ELSE '' END
      || CASE WHEN (t.tgtype & 8) > 0 THEN 'DELETE ' ELSE '' END
      || ' → ' || pr.proname),
    '⬅️ فيه حارس قائم ولا هنعمل واحد؟'
  FROM pg_trigger t
  JOIN pg_proc pr ON pr.oid = t.tgfoid
  WHERE t.tgrelid = 'public.personalized_products'::regclass
    AND NOT t.tgisinternal

  UNION ALL

  -- ══ ③ الزائر ══════════════════════════════════════════
  SELECT
    'الزائر يقرا الجدول؟',
    CASE WHEN has_table_privilege('anon','public.personalized_products','SELECT')
         THEN 'عنده صلاحية الجدول' ELSE 'لأ' END,
    '⬅️ الفلترة لازم تبقى في نفس مسار الزائر'

  UNION ALL

  -- ══ ④ الأعداد — ودي اللي هتتعلّم «معتمد» ══════════════
  SELECT
    'المنتجات الحالية',
    ('الكل: ' || (SELECT count(*)::text FROM public.personalized_products)
      || '  ·  مفعّل: ' || (SELECT count(*)::text FROM public.personalized_products WHERE is_active)
      || '  ·  ملك ناشر: ' || (SELECT count(*)::text FROM public.personalized_products WHERE owner_type = 'publisher')
      || '  ·  ملك المنصة: ' || (SELECT count(*)::text FROM public.personalized_products WHERE owner_type = 'platform')),
    '🔴 كل دول لازم يتعلّموا «معتمد» في نفس معاملة إضافة العمود'

  UNION ALL

  -- ══ ⑤ الأعمدة — وهل فيه حاجة شبه الموافقة موجودة ══════
  SELECT
    ('عمود: ' || c.column_name),
    (c.data_type || COALESCE(' · افتراضي: ' || c.column_default, '')),
    CASE WHEN c.column_name IN ('is_active','review_status','approved_at','status')
         THEN '⬅️ علاقته بالجديد لازم تتحدّد' ELSE '' END
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'personalized_products'

  UNION ALL

  -- ══ ⑥ جداول تانية بتقرا المنتجات ══════════════════════
  --    بنود الطلبات مثلًا. المنتج اللي بيخرج من الاعتماد
  --    **مالوش تأثير على طلب قديم** — والفحص ده بيأكّد إن مفيش
  --    حاجة بتعتمد على ظهوره.
  SELECT
    'جداول مرتبطة بالمنتجات',
    COALESCE((
      SELECT string_agg(DISTINCT tc.table_name, ', ')
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND ccu.table_name = 'personalized_products'
    ), 'مفيش'),
    '⬅️ الطلبات القديمة مالهاش دعوة بالاعتماد'

) t ORDER BY البند;
