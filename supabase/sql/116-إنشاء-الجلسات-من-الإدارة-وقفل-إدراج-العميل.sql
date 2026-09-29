-- ============================================================
-- 116 — إنشاء الجلسات من الإدارة · وقفل إدراج العميل
-- ============================================================
--
-- ⚠️ **الملف ده بيعدّل.** اقرا الجزء ده كله قبل ما تشغّله.
--
-- ── اللي التشخيص 115 كشفه ───────────────────────────────────
--
-- كنت متوقّع إن مفيش سياسة إدراج على `sessions`، فنحتاج دالة
-- `SECURITY DEFINER` جديدة. **والتشخيص قال العكس**: السياسة موجودة
-- وبتسمح للإدارة. فالبند المطلوب (الإدارة تعمل جلسة) **مش محتاج
-- ولا سطر SQL**.
--
-- 🔴 **لكن السياسة نفسها فيها فتحة مالهاش لزوم:**
--
--        WITH CHECK (
--          EXISTS (SELECT 1 FROM course_subscriptions
--                  WHERE id = sessions.course_subscription_id
--                    AND user_id = auth.uid())
--          OR is_admin()
--        )
--
--    الشقّ الأول معناه إن **صاحب الاشتراك يقدر يضيف جلسات لنفسه**.
--
--    مش ثغرة نظرية: مفتاح الموقع العام موجود في صفحة الموقع لأي
--    زائر، ورقم الاشتراك بيظهر للعميل في لوحته. يعني عميل اشترى
--    باقة ١٢ جلسة يقدر يكتب لنفسه ٥٠ جلسة بنداء واحد — **وكلها
--    هتبان في لوحة المدرب وفي التقويم كأنها مدفوعة**.
--
--    ⚠️ ودي نفس مصيدة (ب) اللي وقعنا فيها قبل كده: **الصلاحيات
--       بتحمي الصفوف لا الأعمدة**. السياسة بتتأكّد إن الصف تابع
--       للعميل، ومابتسألش «هو دفع تمن الجلسة دي؟».
--
--    ⚠️ **ومفيش ولا مسار في الموقع بيحتاج الشقّ ده.** الجلسات
--       بتتعمل من `confirmBookingPayment` — واللي بينفّذها **إداري**
--       (`canManageBookings`)، فـ`is_admin()` بتكفيه. فتحة مفتوحة
--       لمسار مش موجود.
--
-- ── واللي بيتعمل هنا ────────────────────────────────────────
--
-- **① السياسة بتضيق على `is_admin()` وبس.**
--
-- **② قيد تفرّد على (الاشتراك، رقم الجلسة).**
--
--    مفيش قيد دلوقتي — التشخيص طبع `sessions_pkey` و
--    `sessions_room_name_idx` وبس. يعني ولا حاجة بتمنع جلستين
--    بنفس الرقم في نفس الاشتراك.
--
--    والكود بيحسب الرقم بـ«أكبر رقم + ١»، وده **صح لكنه مش ذرّي**:
--    إداريان بيضيفوا في نفس اللحظة بيقروا نفس الرقم. القيد بيحوّل
--    الحالة دي من **رقمين متكررين في لوحة الطالب** إلى **خطأ نضيف
--    والكود بيعيد المحاولة**.
--
-- ⚠️ **والجدول فاضي دلوقتي** (تشخيص 115: صفر جلسات)، فالقيد
--    مابيصطدمش ببيانات قائمة. دي أرخص لحظة يتضاف فيها.
--
-- ── اللي **مش** بيتعمل هنا، وليه ────────────────────────────
--
-- ⚠️ **مفيش دالة جديدة.** القاعدة المكتوبة عندنا: الرفض يُقرأ قبل
--    ما يُتخطّى، والدالة `SECURITY DEFINER` حل لفجوة **قائمة**.
--    مفيش فجوة هنا — السياسة بتسمح للإدارة خلاص. الدالة كانت
--    هتبقى طبقة زيادة تخفي السياسة الحقيقية.
--
-- ⚠️ **ومحفّز `guard_session_fields` مابيتلمسش.** التشخيص طبع نصّه:
--    هو `BEFORE UPDATE` وحده، والإدارة ومفتاح الخدمة مستثنيان
--    صراحةً. يعني كتابة أعمدة الغرفة من كود الإدارة شغّالة زي ما هي.
-- ============================================================

BEGIN;

-- ══ ١) قفل الإدراج على الإدارة ═════════════════════════════
--
-- ⚠️ **الحذف قبل الإنشاء، والاتنين جوّه معاملة واحدة.** لو الملف
--    وقع في النص، المعاملة بترجع والسياسة القديمة بتفضل مكانها —
--    أوحش من دي إن الجدول يفضل لحظة **بلا أي سياسة إدراج**،
--    فتأكيد أي دفع يفشل.
--
-- ⚠️ و`DROP` بلا `CASCADE` عن قصد: الأمان في إن الحذف يفشل لا إنه
--    يجرف حاجة معتمدة عليه.
DROP POLICY IF EXISTS "Create sessions for own subscription or admin" ON public.sessions;

CREATE POLICY "Only admins can create sessions"
  ON public.sessions
  FOR INSERT
  WITH CHECK ( public.is_admin() );

-- ══ ٢) رقم الجلسة مايتكرّرش في الاشتراك الواحد ═════════════
--
-- ⚠️ لو الاستعلام ده وقع بـ«duplicate key»، يبقى فيه بيانات قديمة
--    فيها تكرار فعلًا — **وقتها أوقف ونادِني**، ماتحذفش حاجة.
--    (تشخيص 115 قال الجدول فاضي، فالمفروض يعدّي.)
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_subscription_number_key
  UNIQUE (course_subscription_id, session_number);

COMMIT;

-- ============================================================
-- استعلام التأكيد — واحد
-- ============================================================
SELECT البند, التفاصيل, الحالة FROM (

  SELECT
    ('سياسة إدراج: ' || p.policyname)::text AS البند,
    COALESCE(p.with_check, '—')::text        AS التفاصيل,
    CASE
      WHEN p.with_check ILIKE '%course_subscriptions%'
        THEN '🔴 لسه فيها شقّ العميل — الملف ما اشتغلش صح'
      WHEN p.with_check ILIKE '%is_admin%'
        THEN '✅ الإدارة وحدها'
      ELSE '⚠️ شرط غير متوقّع — راجعه'
    END AS الحالة
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename  = 'sessions'
    AND p.cmd        = 'INSERT'

  UNION ALL

  SELECT
    'قيد تفرّد رقم الجلسة',
    COALESCE(
      (SELECT pg_get_constraintdef(c.oid)
         FROM pg_constraint c
        WHERE c.conrelid = 'public.sessions'::regclass
          AND c.conname  = 'sessions_subscription_number_key'),
      'مش موجود'),
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = 'public.sessions'::regclass
         AND c.conname  = 'sessions_subscription_number_key'
    ) THEN '✅ اتضاف' ELSE '🔴 ما اتضافش' END

  UNION ALL

  -- ⚠️ **الفحص ده مش زخرفة.** لو عدد سياسات الإدراج بقى **صفر**،
  --    تأكيد أي دفع هيفشل — الجلسات مش هتتعمل، والاشتراك هينشط
  --    فاضي. ودي بالظبط الحالة اللي أصلحناها في §8أ/١.
  SELECT
    'عدد سياسات الإدراج',
    (SELECT count(*)::text FROM pg_policies
      WHERE schemaname='public' AND tablename='sessions' AND cmd IN ('INSERT','ALL')),
    CASE WHEN (SELECT count(*) FROM pg_policies
                WHERE schemaname='public' AND tablename='sessions'
                  AND cmd IN ('INSERT','ALL')) = 1
         THEN '✅ واحدة' ELSE '🔴 راجع — مش المفروض' END

  UNION ALL

  SELECT
    'جلسات في الجدول',
    (SELECT count(*)::text FROM public.sessions),
    'للعلم'

) t ORDER BY البند;

-- ============================================================
-- التراجع — معلَّق عن قصد. شغّله يدويًّا لو احتجت.
-- ============================================================
-- BEGIN;
--   ALTER TABLE public.sessions
--     DROP CONSTRAINT IF EXISTS sessions_subscription_number_key;
--
--   DROP POLICY IF EXISTS "Only admins can create sessions" ON public.sessions;
--
--   -- ⚠️ ده بيرجّع **الفتحة** اللي الملف ده قفلها: العميل هيقدر
--   --    يضيف جلسات لاشتراكه تاني. ماترجّعهاش إلا لو ثبت إن فيه
--   --    مسار حقيقي محتاجها.
--   CREATE POLICY "Create sessions for own subscription or admin"
--     ON public.sessions
--     FOR INSERT
--     WITH CHECK (
--       EXISTS (
--         SELECT 1 FROM public.course_subscriptions
--          WHERE course_subscriptions.id = sessions.course_subscription_id
--            AND course_subscriptions.user_id = auth.uid()
--       ) OR public.is_admin()
--     );
-- COMMIT;
