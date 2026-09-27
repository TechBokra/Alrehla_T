-- ============================================================
-- 104 — المدرب يدير عروضه بصلاحياته هو
-- ============================================================
--
-- ── اللي التشخيص (ملف 103) أثبته — والنتيجة مفاجئة ──────────
--
-- تحديثات Google AI Studio حوّلت **خمس دوال** في
-- `instructor-services.ts` لمفتاح الخدمة، بتعليق بيقول إن السبب
-- «سياسة RLS». وطلع إن السياسات **كانت سامحة أصلًا**:
--
--     `provider_services` INSERT  →  «Providers propose their own
--        offerings»: `is_admin() OR sp.user_id = auth.uid()
--        OR i.user_id = auth.uid()`   ✅ المدرب مسموح له
--     `provider_services` UPDATE  →  نفس الشرط بالظبط  ✅
--     `provider_services` SELECT  →  نفس الشرط بالظبط  ✅
--     `service_providers` UPDATE  →  admin أو المالك أو المدرب  ✅
--     `service_providers` SELECT  →  صفّه هو  ✅
--
-- ⚠️ يعني **مفيش سبب لتخطّي الصلاحيات في أغلب الدوال** — الحماية
--    كانت هتعدّيهم زي ما هم. التخطّي شال شبكة الأمان مقابل لا شيء.
--
-- ── الفجوتان الحقيقيتان ─────────────────────────────────────
--
-- اتنين بس فعلًا مقفولين على المدرب:
--
--   ① `service_providers` **INSERT** → `is_admin()` وحده.
--      و`resolveProviderId` بتعمل صف مقدّم الخدمة للمدرب لما
--      مايكونش عنده. (دلوقتي كله عنده — التشخيص قال «مدربون بلا
--      صف: صفر» — فدي للمدربين الجداد.)
--
--   ② `provider_services` **DELETE** → `is_admin()` وحده.
--      و`withdrawMyOffer` بتسحب طلبًا لسه ما اتبتّ فيه.
--
-- الملف ده بيفتح الاتنين دول **بالقدر المطلوب بالظبط**، والكود
-- بيرجع لصلاحيات المستخدم — فالقاعدة ترجع تبقى الحارس.
--
-- ── ⚠️ الشرطان اللي بيمنعوا إساءة الاستعمال ────────────────
--
-- **① الحالة لازم تتبع حالة المدرب، لا اختياره.**
--
--    من غير الشرط ده المدرب كان يقدر يعمل صفّه بحالة `active` —
--    وسياسة القراءة العامة «Active providers are readable» بتعرض
--    النشط للعملاء. يعني **يحط نفسه في سوق الخدمات بلا أي اعتماد**.
--    والصلاحيات بتحمي الصفوف لا الأعمدة (قاعدة «ب»)، فالشرط لازم
--    يبقى في السياسة نفسها.
--
-- ⚠️ **بس «معلّق دايمًا» كان هيكسر الكود.** `resolveProviderId`
--    بتعمل الصف بحالة المدرب نفسه (`active` لو المدرب نشط) — ودي
--    قاعدة مكتوبة من ملف 30. فالسياسة بتسمح بـ`active` **بشرط إن
--    المدرب نفسه نشط**.
--
--    وده آمن لأن `instructors.status` **قرار إدارة**: بيتغيّر من
--    `setInstructorStatus` (بتتطلب إداري) ومحميّ بمحفّز
--    `guard_instructor_fields`. فالمدرب مايقدرش يرفّع نفسه، وكل
--    اللي بيحصل إن صفّ المقدّم بيعكس حالة معتمَدة أصلًا.
--
-- **② `status <> 'approved'` في حذف العرض.**
--
--    العرض المعتمد سعره اتفق عليه ومعروض للعملاء. لو المدرب قدر
--    يحذفه، كان يقدر يشيل ويضيف بسعر جديد — **ويتخطّى اعتماد
--    السعر كله**. والكود بيمنع ده، بس الكود مش الحارس.
-- ============================================================

BEGIN;

-- ── ① المدرب يعمل صف مقدّم الخدمة بتاعه ────────────────────

DROP POLICY IF EXISTS "Instructors create their own provider row"
  ON public.service_providers;

CREATE POLICY "Instructors create their own provider row"
  ON public.service_providers
  FOR INSERT
  WITH CHECK (
    kind = 'instructor'
    AND EXISTS (
      SELECT 1 FROM public.instructors i
       WHERE i.id = service_providers.instructor_id
         AND i.user_id = auth.uid()
         -- ⚠️ الحالة بتتبع المدرب لا اختياره: «نشط» مسموحة فقط لو
         --    المدرب نفسه نشط — وده قرار إدارة محميّ بمحفّز.
         AND (
           service_providers.status = 'pending'
           OR (service_providers.status = 'active' AND i.status = 'active')
         )
    )
  );


-- ── ② المدرب يسحب عرضًا لسه ما اتبتّ فيه ───────────────────

DROP POLICY IF EXISTS "Providers withdraw their own pending offerings"
  ON public.provider_services;

CREATE POLICY "Providers withdraw their own pending offerings"
  ON public.provider_services
  FOR DELETE
  USING (
    -- المعتمد مايتحذفش: ده باب التفاف على اعتماد السعر.
    status <> 'approved'
    AND EXISTS (
      SELECT 1
        FROM public.service_providers sp
        LEFT JOIN public.instructors i ON i.id = sp.instructor_id
       WHERE sp.id = provider_services.provider_id
         AND (sp.user_id = auth.uid() OR i.user_id = auth.uid())
    )
  );

COMMIT;

-- ============================================================
-- استعلام التأكيد — واحد
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ١) السياستان الجديدتان
  SELECT
    '1. السياسات الجديدة'::text AS القسم,
    p.policyname::text            AS البند,
    (p.cmd || '  ·  ' || COALESCE(p.with_check, p.qual, '—'))::text AS التفاصيل,
    CASE
      WHEN p.policyname = 'Instructors create their own provider row'
       AND COALESCE(p.with_check, '') LIKE '%pending%' THEN '✓ الحالة مقيّدة بحالة المدرب'
      WHEN p.policyname = 'Providers withdraw their own pending offerings'
       AND COALESCE(p.qual, '') LIKE '%approved%' THEN '✓ المعتمد محميّ'
      ELSE '✗ راجع الشرط'
    END AS الحالة
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.policyname IN (
      'Instructors create their own provider row',
      'Providers withdraw their own pending offerings'
    )

  UNION ALL

  -- ٢) السياسات القديمة ما اتلمستش
  SELECT
    '2. السياسات القائمة',
    (p.tablename || ' · ' || p.policyname)::text,
    p.cmd::text,
    '✓ زي ما هي'
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('service_providers', 'provider_services')
    AND p.policyname NOT IN (
      'Instructors create their own provider row',
      'Providers withdraw their own pending offerings'
    )

  UNION ALL

  -- ٣) عدد السياسات على كل جدول
  SELECT
    '3. الخلاصة',
    t.tablename::text,
    ('RLS: ' || CASE WHEN t.rowsecurity THEN 'مفعّلة' ELSE 'متوقفة' END
      || '  ·  السياسات: '
      || (SELECT count(*)::text FROM pg_policies pp
           WHERE pp.schemaname='public' AND pp.tablename=t.tablename))::text,
    CASE WHEN t.rowsecurity THEN '✓' ELSE '🔴 متوقفة' END
  FROM pg_tables t
  WHERE t.schemaname='public'
    AND t.tablename IN ('service_providers', 'provider_services')

  UNION ALL

  -- ٤) الصفوف ما اتغيّرتش
  SELECT
    '4. الصفوف',
    'بلا تعديل',
    ('مقدّمو الخدمة: ' || (SELECT count(*)::text FROM public.service_providers)
      || '  ·  العروض: ' || (SELECT count(*)::text FROM public.provider_services)
      || '  ·  منها معتمدة: '
      || (SELECT count(*)::text FROM public.provider_services WHERE status='approved'))::text,
    '✓ الملف سياسات وبس'

) t ORDER BY القسم, البند;

-- ============================================================
-- التراجع
-- ============================================================
--
-- ⚠️ التراجع بيرجّع الفجوتين، والكود اللي هيتنشر بعده بيعتمد
--    عليهما — فالمدرب مش هيقدر يعمل صفّه ولا يسحب عرضه.
--
-- BEGIN;
-- DROP POLICY IF EXISTS "Instructors create their own provider row"
--   ON public.service_providers;
-- DROP POLICY IF EXISTS "Providers withdraw their own pending offerings"
--   ON public.provider_services;
-- COMMIT;
-- ============================================================
