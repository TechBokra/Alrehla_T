-- ============================================================
-- 118 — إيقاف الحساب عن الشراء
-- ============================================================
--
-- ⚠️ **الملف ده بيعدّل.** اقرا الجزء ده كله قبل ما تشغّله.
--
-- ── القرار ──────────────────────────────────────────────────
--
-- «إيقاف الحساب» = **منع الشراء الجديد، لا منع الدخول**.
--
-- منع الدخول بيقفل على الأهل الجلسات اللي دفعوا تمنها ومعرض شغل
-- ابنهم — عقاب على خلاف إداري بيطول خدمة مدفوعة. الموقوف بيفضل
-- داخل حسابه وشايف كل حاجة؛ اللي بيتمنع الطلب الجديد.
--
-- ── واللي التشخيص 117 غيّره في الخطة ────────────────────────
--
-- كنت ناوي أحطّ الفحص **جوّه** `create_customer_order` و
-- `create_course_booking`. التشخيص طبع نصّهم — الأولى **١٥٠ سطرًا**
-- فيها كل حساب أسعار المتجر.
--
-- ⚠️ و`CREATE OR REPLACE` بتستبدل **الجسم كله**. يعني عشان أضيف
--    أربع سطور كنت هعيد كتابة ١٥٠ سطرًا بإيدي، وأي غلطة حرف في
--    حساب سعر أو إضافة بتعدّي من غير ما حد يلاحظ — وهي نفس الدالة
--    اللي رجّعت ٦ طلبات بإجمالي صفر قبل كده (ملف 108).
--
-- **فالفحص بقى محفّزًا على الجداول لا تعديلًا في الدوال.** وده أحسن
-- من ناحيتين مش واحدة:
--
--   ① **صفر خطر نسخ.** مفيش سطر قائم بيتلمس.
--   ② **بيمسك كل الطرق لا الاتنين دول.** أي مسار شراء جديد يتكتب
--      بكرة بيتحرس تلقائيًّا، ومحدّش محتاج يفتكر يضيف الفحص.
--
-- ⚠️ **والمحفّز بيشتغل حتى جوّه `SECURITY DEFINER`.** الدوال دي
--    بتكتب بصلاحية صاحبها وبتتخطّى الصلاحيات — **بس مابتتخطّاش
--    المحفّزات**. ودي نفس الخاصية اللي `guard_order_fields` قايم
--    عليها من الأساس.
--
-- ── واللي بيتعمل هنا ────────────────────────────────────────
--
-- **① عمودان على `user_profiles`:** `suspended_at` و
--    `suspension_reason`. فاضي = الحساب شغّال.
--
-- **② الحارس القديم بيتمدّ ليجمّدهم.**
--
--    ⚠️ **ده أهم سطر في الملف.** `user_profiles` عليه سياسة
--       «المستخدم يعدّل صفّه» (التشخيص أكّدها). فمن غير التجميد،
--       **الموقوف بيفكّ إيقاف نفسه بنداء واحد** من متصفحه —
--       مفتاح الموقع العام في الصفحة، ورقم حسابه هو اللي
--       `auth.uid()` بترجّعه.
--
--       ودي مصيدة (ب) بعينها: **الصلاحيات بتحمي الصفوف لا
--       الأعمدة.**
--
--    ⚠️ **والدالة بتتكتب من نصّها اللي التشخيص طبعه**، مش من
--       ذاكرتي ولا من ملف 41. القاعدة هي مصدر الحقيقة.
--
-- **③ ومحفّز بيمنع إيقاف حساب إداري.**
--
--    التشخيص قال: **مدير نظام واحد** ومشرفان عامّان. إيقاف
--    الإداري مالوش معنى (هو مش بيشتري)، وإيقاف الوحيد بالغلط
--    مشكلة مالهاش داعي. فبيترفض صراحةً.
--
-- **④ ومحفّزات المنع على تلات جداول:** `orders` ·
--    `course_subscriptions` · `service_orders`.
-- ============================================================

BEGIN;

-- ══ ١) العمودان ════════════════════════════════════════════
--
-- ⚠️ `timestamptz` لا `boolean` عن قصد: «موقوف من امتى» سؤال
--    هيتسأل أول ما يحصل خلاف، و`true` مابتجاوبش عليه.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS suspended_at      timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

COMMENT ON COLUMN public.user_profiles.suspended_at IS
  'موقوف عن الشراء الجديد من التاريخ ده. فاضي = شغّال. الدخول مابيتمنعش.';

-- ══ ٢) الحارس بيجمّد العمودين الجديدين ════════════════════
--
-- ⚠️ **النصّ ده منقول من `pg_get_functiondef` في تشخيص 117**،
--    والجديد فيه سطران بس: تجميد `suspended_at` و
--    `suspension_reason`.
--
-- ⚠️ والتوقيع زيّ ما هو بالحرف (بلا معاملات، بترجّع `trigger`) —
--    `CREATE OR REPLACE` بتوقيع مختلف **بتضيف نسخة تانية
--    ومابتستبدلش** (مصيدة «س»)، والمحفّز يفضل شايل القديمة.
CREATE OR REPLACE FUNCTION public.guard_user_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- auth.uid() فاضي = التعديل جاي من السيرفر (service role)، مش من متصفح.
  -- والمستخدم المجهول متمنوع أصلًا بالـ RLS قبل ما يوصل هنا.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.role        := OLD.role;
  NEW.permissions := OLD.permissions;

  -- ⚠️ **الجديد: الإيقاف.**
  --
  --    من غير السطرين دول، الموقوف بيفكّ إيقاف نفسه بنداء واحد من
  --    متصفحه — سياسة «المستخدم يعدّل صفّه» بتسمح بالصف، والصلاحيات
  --    مابتحرسش الأعمدة (قاعدة «ب»).
  NEW.suspended_at      := OLD.suspended_at;
  NEW.suspension_reason := OLD.suspension_reason;

  RETURN NEW;
END
$function$;

-- ══ ٣) ممنوع إيقاف حساب إداري ═════════════════════════════
--
-- ⚠️ الإداري مش بيشتري أصلًا، فالإيقاف عليه بلا معنى — والتشخيص
--    قال إن **مدير النظام واحد**. إيقافه بالغلط مشكلة مالهاش داعي،
--    والشرط هنا بيمنعها من أصلها.
CREATE OR REPLACE FUNCTION public.guard_suspension_target()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.suspended_at IS NOT NULL
     AND NEW.role IN ('super_admin', 'general_supervisor')
  THEN
    RAISE EXCEPTION 'مينفعش توقف حساب إداري';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS guard_suspension_target_trg ON public.user_profiles;
CREATE TRIGGER guard_suspension_target_trg
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_suspension_target();

-- ══ ٤) المنع نفسه ══════════════════════════════════════════
--
-- ⚠️ **دالة واحدة لتلات جداول، وبتقرا اسم عمود المالك من
--    المعامل.** ده أنضف من تلات دوال بنفس الجسم — واللي بيصلّح
--    واحدة بعد سنة مش هيفتكر التانيتين.
CREATE OR REPLACE FUNCTION public.block_suspended_purchase()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
BEGIN
  -- اسم عمود المالك بيتبعت وقت ربط المحفّز: orders.user_id،
  -- course_subscriptions.user_id، service_orders.buyer_profile_id.
  EXECUTE format('SELECT ($1).%I', TG_ARGV[0]) INTO v_owner USING NEW;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  -- ⚠️ بيقرا بصلاحية صاحب الدالة: المشتري **مش** بيقدر يقرا صفّ
  --    حد تاني، وحتى صفّه هو ممكن ما يتقريش لو السياسة اتغيّرت.
  --    والصفوف الممنوعة بترجع فاضية لا بخطأ (قاعدة «ك») — يعني
  --    الفحص كان هيعدّي دايمًا.
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE id = v_owner AND suspended_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'الحساب ده موقوف عن الشراء. تواصل مع الإدارة.';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS block_suspended_purchase_trg ON public.orders;
CREATE TRIGGER block_suspended_purchase_trg
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_purchase('user_id');

DROP TRIGGER IF EXISTS block_suspended_purchase_trg ON public.course_subscriptions;
CREATE TRIGGER block_suspended_purchase_trg
  BEFORE INSERT ON public.course_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_purchase('user_id');

DROP TRIGGER IF EXISTS block_suspended_purchase_trg ON public.service_orders;
CREATE TRIGGER block_suspended_purchase_trg
  BEFORE INSERT ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_purchase('buyer_profile_id');

-- ⚠️ **والدالة مسحوبة من الزائر صراحةً.** Supabase بيمنح `anon`
--    تنفيذ أي دالة جديدة تلقائيًّا — ودي المصيدة اللي ملف 82
--    اتعمل عشانها. المحفّز بيناديها بنفسه، فمحدّش محتاج يناديها.
REVOKE EXECUTE ON FUNCTION public.block_suspended_purchase() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_suspension_target()  FROM anon;

COMMIT;

-- ============================================================
-- استعلام التأكيد — واحد
-- ============================================================
SELECT البند, التفاصيل, الحالة FROM (

  SELECT
    ('عمود: ' || c.column_name)::text AS البند,
    (c.data_type || '  ·  ' ||
      CASE WHEN c.is_nullable = 'YES' THEN 'يقبل الفراغ' ELSE 'مطلوب' END)::text AS التفاصيل,
    '✅ اتضاف'::text AS الحالة
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'user_profiles'
    AND c.column_name IN ('suspended_at', 'suspension_reason')

  UNION ALL

  -- ⚠️ الفحص ده هو اللي بيفرّق بين «الإيقاف شغّال» و«الموقوف
  --    بيفكّ إيقاف نفسه». لو رجع 🔴، **مايتعملش إيقاف لحد ما
  --    يتصلّح**.
  SELECT
    'الحارس بيجمّد الإيقاف؟',
    CASE WHEN pg_get_functiondef(pr.oid) ILIKE '%NEW.suspended_at      := OLD.suspended_at%'
              OR pg_get_functiondef(pr.oid) ILIKE '%NEW.suspended_at%:=%OLD.suspended_at%'
         THEN 'أيوه' ELSE 'لأ' END,
    CASE WHEN pg_get_functiondef(pr.oid) ILIKE '%suspended_at%'
         THEN '✅ الموقوف مايقدرش يفكّ إيقاف نفسه'
         ELSE '🔴 الحارس ما اتمدّش — ماتوقفش حد' END
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public' AND pr.prokind = 'f'
    AND pr.proname = 'guard_user_profile_fields'

  UNION ALL

  SELECT
    ('محفّز منع الشراء: ' || t.tgrelid::regclass::text),
    ('الوسيط: ' || COALESCE(encode(t.tgargs, 'escape'), '—')),
    '✅ مربوط'
  FROM pg_trigger t
  WHERE t.tgname = 'block_suspended_purchase_trg' AND NOT t.tgisinternal

  UNION ALL

  -- المفروض تلاتة بالظبط. أقل من كده يعني فيه مسار شراء بلا حارس.
  SELECT
    'عدد جداول الشراء المحروسة',
    (SELECT count(*)::text FROM pg_trigger
      WHERE tgname = 'block_suspended_purchase_trg' AND NOT tgisinternal),
    CASE WHEN (SELECT count(*) FROM pg_trigger
                WHERE tgname = 'block_suspended_purchase_trg' AND NOT tgisinternal) = 3
         THEN '✅ تلاتة' ELSE '🔴 ناقص — فيه مسار شراء بلا حارس' END

  UNION ALL

  SELECT
    'حسابات موقوفة دلوقتي',
    (SELECT count(*)::text FROM public.user_profiles WHERE suspended_at IS NOT NULL),
    'المفروض صفر'

  UNION ALL

  -- ⚠️ نسخة واحدة من كل دالة. أكتر من كده = مصيدة «س» حصلت.
  SELECT
    ('نسخ الدالة: ' || pr.proname),
    count(*)::text,
    CASE WHEN count(*) = 1 THEN '✅ واحدة' ELSE '🔴 أكتر من نسخة — النداء ملتبس' END
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.proname IN ('guard_user_profile_fields','block_suspended_purchase','guard_suspension_target')
  GROUP BY pr.proname

) t ORDER BY البند;

-- ============================================================
-- التراجع — معلَّق عن قصد. شغّله يدويًّا لو احتجت.
-- ============================================================
-- BEGIN;
--   DROP TRIGGER IF EXISTS block_suspended_purchase_trg ON public.orders;
--   DROP TRIGGER IF EXISTS block_suspended_purchase_trg ON public.course_subscriptions;
--   DROP TRIGGER IF EXISTS block_suspended_purchase_trg ON public.service_orders;
--   DROP TRIGGER IF EXISTS guard_suspension_target_trg  ON public.user_profiles;
--
--   DROP FUNCTION IF EXISTS public.block_suspended_purchase();
--   DROP FUNCTION IF EXISTS public.guard_suspension_target();
--
--   -- ⚠️ العمودان بيتسابوا: حذفهم بيضيّع سجلّ مين كان موقوف وليه.
--   --    شيلهم بإيدك لو إنت متأكد إنك مش محتاج السجل ده.
--
--   -- والحارس بيرجع لنسخته اللي قبل الملف ده:
--   CREATE OR REPLACE FUNCTION public.guard_user_profile_fields()
--    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
--   AS $function$
--   BEGIN
--     IF auth.uid() IS NULL OR public.is_admin() THEN
--       RETURN NEW;
--     END IF;
--     NEW.role        := OLD.role;
--     NEW.permissions := OLD.permissions;
--     RETURN NEW;
--   END
--   $function$;
-- COMMIT;
