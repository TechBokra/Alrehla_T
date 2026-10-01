-- ============================================================
-- 135 — تشخيص: الدوال اللي الزائر المجهول يقدر ينفّذها فعلًا
-- ============================================================
--
-- ⚠️ **الملف ده مابيغيّرش حاجة. بيقرا وبيطبع.**
--
-- ── ليه اتكتب ───────────────────────────────────────────────
--
-- وأنا بجرّب ملف 134 على Postgres محلي، طلع إن السطر:
--
--     REVOKE EXECUTE ON FUNCTION f() FROM anon;
--
-- **مابيقفلش على الزائر**. Postgres بيدّي أي دالة جديدة صلاحية تنفيذ
-- لـ`public` (يعني «الكل») افتراضيًّا، و`anon` بياخدها بالوراثة. فلازم
-- `FROM public, anon` **معًا**.
--
-- وقواعد العمل (§3) بتقول الاتنين — لكن ملفَي 118 و121 كاتبين
-- `FROM anon` لوحدها. هناك الضرر صفر لأنها **دوال محفّزات** (Postgres
-- بيرفض نداءها مباشرة). **السؤال: هل نفس النمط على دوال عادية في
-- ملفات تانية؟** والملف ده بيجاوب من القاعدة نفسها، لا من قراءة
-- الملفات (القاعدة هي مصدر الحقيقة).
--
-- ── إزاي بيقرا ─────────────────────────────────────────────
--
-- السؤال الحاسم `has_function_privilege('anon', …)` — ده اللي Postgres
-- نفسه بيسأله ساعة النداء، **شامل الوراثة من `public`**. مش قراءة
-- لنصّ الصلاحيات (اللي بتغلّط في حالة الوراثة بالظبط — وده العطل).
--
-- ⚠️ **دوال المحفّزات مستبعدة** (قاعدة «ن»): مابتتناداش مباشرة،
--    ووجودها ضجيج يغرق النتايج.
--
-- ── التصنيف ────────────────────────────────────────────────
--
--   ✓ مستعملة في سياسة صلاحيات  — **لازم تفضل للزائر** (§2 في الدفتر):
--      سحبها بيحوّل «ترجع false» لخطأ `permission denied` وصفحات عامة
--      بتقع. (`is_admin`، `can_see_profile`، …)
--   🔴 `SECURITY DEFINER` ومش في سياسة — **بتتجاوز الصلاحيات**. دي اللي
--      تتراجع واحدة واحدة: هل الزائر محتاجها فعلًا؟
--   ⚠️ `SECURITY INVOKER` ومش في سياسة — بتشتغل بصلاحية الزائر نفسه،
--      فالصلاحيات بتحميها. خطرها أقل، بس مالهاش لزمة غالبًا
--
-- ⚠️ **و«مستعملة في سياسة» بالبحث عن `اسمها(` في نصّ السياسات** —
--    بحدّ كلمة من قدّام وقوس من ورا، فـ`is_admin` مابتطابقش
--    `is_admin_or_x(`. لكن ده بحث نصّي: أي «✓» على دالة `DEFINER`
--    بتكتب يتبصّ عليها بالعين. (درس ١١ و٢١.)
-- ============================================================

WITH fns AS (
  SELECT
    p.oid,
    p.proname                                         AS name,
    pg_get_function_identity_arguments(p.oid)         AS args,
    p.prosecdef                                       AS definer,
    p.provolatile                                     AS volatility,
    -- منين جات صلاحية الزائر: صريحة ولا بالوراثة من public؟
    CASE
      WHEN p.proacl IS NULL THEN 'افتراضي (public)'
      WHEN EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
       AND EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                    WHERE a.grantee = 'anon'::regrole AND a.privilege_type = 'EXECUTE')
        THEN 'صريحة + public'
      WHEN EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
        THEN '🔴 بالوراثة من public بس'
      ELSE 'صريحة لـ anon'
    END                                               AS source,
    EXISTS (
      SELECT 1 FROM pg_policies pol
       WHERE pol.schemaname = 'public'
         AND (coalesce(pol.qual, '') ~ ('\m' || p.proname || '\s*\(')
           OR coalesce(pol.with_check, '') ~ ('\m' || p.proname || '\s*\('))
    )                                                 AS in_policy
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND p.prorettype <> 'trigger'::regtype
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
)
SELECT البند, التفاصيل, الحالة FROM (

  -- ══ ١) كل دالة يقدر الزائر ينفّذها ══════════════════════
  SELECT
    CASE
      WHEN in_policy THEN '٣ ✓ '
      WHEN definer   THEN '١ 🔴 '
      ELSE                '٢ ⚠️ '
    END || name || '(' || args || ')'                 AS البند,
    (CASE WHEN definer THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END
      || ' · ' || CASE volatility WHEN 'v' THEN 'ممكن تكتب' ELSE 'قراءة بس' END
      || ' · الصلاحية: ' || source)                   AS التفاصيل,
    CASE
      WHEN in_policy THEN 'مستعملة في سياسة — تفضل'
      WHEN definer   THEN '🔴 راجعها: بتتجاوز الصلاحيات'
      ELSE                '⚠️ غالبًا مالهاش لزمة للزائر'
    END                                               AS الحالة
  FROM fns

  UNION ALL

  -- ══ ٢) الخلاصة ══════════════════════════════════════════
  SELECT
    '٠ الخلاصة',
    (count(*)::text || ' دالة الزائر يقدر ينفّذها · '
      || count(*) FILTER (WHERE in_policy)::text || ' في سياسات · '
      || count(*) FILTER (WHERE NOT in_policy AND definer)::text || ' DEFINER برّه السياسات · '
      || count(*) FILTER (WHERE NOT in_policy AND NOT definer)::text || ' INVOKER برّه السياسات · '
      || count(*) FILTER (WHERE source LIKE '🔴%')::text || ' بالوراثة من public بس'),
    CASE WHEN count(*) FILTER (WHERE NOT in_policy AND definer) = 0
         THEN '✓ مفيش DEFINER مكشوفة'
         ELSE '🔴 فيه ' || count(*) FILTER (WHERE NOT in_policy AND definer)::text || ' تتراجع' END
  FROM fns

) t ORDER BY البند;
