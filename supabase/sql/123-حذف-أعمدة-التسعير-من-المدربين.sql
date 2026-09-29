-- ============================================================
-- 123 — حذف أعمدة التسعير من `instructors`  (الخطوة التانية)
-- ============================================================
--
-- ⚠️ **الملف ده بيحذف أعمدة. مايتشغّلش غير بالشرطين دول:**
--
--   ① **ملف 122 اتشغّل** ورجّع «✅ كل مدرب له صف» و«✅ مطابقة»
--   ② **الكود اتنشر** وبيقرا التسعير من `instructor_pricing`
--
--    لو الكود ما اتنشرش، شاشة المدرب في الإدارة بتقرا عمودًا مش
--    موجود. ولو 122 ما اتشغّلش، **الأسعار بتضيع خالص**.
--
-- ── وهنا بيتقفل التسريب ─────────────────────────────────────
--
-- سياسة `instructors` بتفضل `USING (true)` لكل مسجَّل — **وده بقى
-- مقبولًا**، لأن الجدول مابقاش فيه أسرار: الاسم والنبذة والتخصصات
-- والحالة كلها معروضة في صفحة عامة أصلًا.
--
-- ── 🔴 والمصيدة اللي الملف ده اتكتب عشانها ──────────────────
--
-- تأكيد 122 طبع نصّ `guard_instructor_fields`، وفيه:
--
--     NEW.approved_price          := OLD.approved_price;
--     NEW.requested_price         := OLD.requested_price;
--     NEW.monthly_hours_committed := OLD.monthly_hours_committed;
--
-- ⚠️ **وpl/pgsql بيحلّ أسماء الأعمدة وقت التنفيذ لا وقت الإنشاء.**
--
--    يعني لو حذفنا الأعمدة وسِبنا المحفّز: **`ALTER TABLE` هينجح
--    والملف هيعدّي نضيف** — وأول تعديل على أي مدرب بعد كده هيقع
--    بخطأ `record "old" has no field "approved_price"`.
--
--    العطل مش هيظهر دلوقتي؛ هيظهر أول ما إداري يوافق على طلب
--    تعديل — ووقتها محدّش هيربطه بملف SQL اتشغّل من أسبوع.
--
--    **فالمحفّز بيتصلّح الأول، وجوّه نفس المعاملة.**
--
-- ⚠️ **والنصّ تحت منقول من `pg_get_functiondef` بالحرف**، والجديد
--    فيه **حذف تلات سطور وبس**. والتوقيع زيّ ما هو: `CREATE OR
--    REPLACE` بتوقيع مختلف **بتضيف نسخة تانية ومابتستبدلش**
--    (مصيدة «س») — واللي حصل في ملف 86 وأوقع الحجز على الإنتاج.
-- ============================================================

BEGIN;

-- ══ ٠) فحص وقائي: فيه دالة تانية بتشاور على الأعمدة؟ ══════
--
-- ⚠️ **الفحص ده بيوقف الملف قبل الحذف لا بعده.** أي دالة تانية
--    بتشاور على عمود منهم هتقع بنفس الطريقة: بصمت دلوقتي، وبخطأ
--    غامض بعدين.
--
--    وبنقرا `prosrc` لا `pg_get_functiondef` — التانية **بترمي على
--    الدوال التجميعية** (وده اللي أوقع ملف 115).
DO $$
DECLARE
  v_hits text;
BEGIN
  SELECT string_agg(pr.proname, ', ')
    INTO v_hits
    FROM pg_proc pr
    JOIN pg_namespace n ON n.oid = pr.pronamespace
   WHERE n.nspname = 'public'
     AND pr.prokind = 'f'
     AND pr.proname <> 'guard_instructor_fields'
     AND (pr.prosrc LIKE '%approved_price%'
       OR pr.prosrc LIKE '%requested_price%'
       OR pr.prosrc LIKE '%monthly_hours_committed%');

  IF v_hits IS NOT NULL THEN
    -- ⚠️ ممكن تكون على `provider_services` (جدول تاني بنفس أسماء
    --    الأعمدة) — فالرسالة بتسمّيها عشان تتراجع بالعين لا
    --    تتجاهل.
    RAISE NOTICE '⚠️ دوال بتشاور على أسماء الأعمدة دي: %. راجعها — لو كلها على provider_services فمفيش مشكلة.', v_hits;
  END IF;
END
$$;

-- ══ ١) الحارس الأول — قبل الحذف ═══════════════════════════
--
-- منقول من `pg_get_functiondef` بالحرف، والتلات سطور المحذوفة
-- معلَّمة تحت.
CREATE OR REPLACE FUNCTION public.guard_instructor_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- auth.uid() بتبقى فاضية في حالتين: طلب مجهول (وده بترفضه الصلاحيات
  -- قبل ما يوصل هنا)، أو مفتاح الخدمة اللي الإدارة بتستخدمه. والإداري
  -- مسموح له صراحة. غير كده: الأعمدة الإدارية بترجع زي ما كانت.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.user_id                    := OLD.user_id;
  NEW.status                     := OLD.status;
  NEW.training_passed            := OLD.training_passed;
  NEW.selected_pricing_option_id := OLD.selected_pricing_option_id;
  NEW.weekly_schedule            := OLD.weekly_schedule;
  NEW.is_sample                  := OLD.is_sample;

  -- ⚠️ **اتشال من هنا: `approved_price` و`requested_price` و
  --    `monthly_hours_committed`.**
  --
  --    الأعمدة دي اتنقلت لـ`instructor_pricing` (ملف 122)، وسياسة
  --    الكتابة هناك **للإدارة وحدها** — يعني الحماية اللي كانت
  --    بتتعمل هنا بقت في السياسة نفسها، وهي أقوى: الحارس بيرجّع
  --    القيمة بصمت، والسياسة بترفض الكتابة من أصلها.

  RETURN NEW;
END
$function$;

-- ══ ٢) والحذف بعده ════════════════════════════════════════
--
-- ⚠️ **بلا `CASCADE` عن قصد.** لو فيه `view` بيقرا عمودًا منهم،
--    الحذف **بيفشل** والمعاملة بترجع — وده اللي إحنا عايزينه.
--    `CASCADE` كانت هتحذف الـview معاه في صمت.
ALTER TABLE public.instructors DROP COLUMN approved_price;
ALTER TABLE public.instructors DROP COLUMN requested_price;
ALTER TABLE public.instructors DROP COLUMN monthly_hours_committed;

COMMIT;

-- ============================================================
-- استعلام التأكيد — واحد
-- ============================================================
SELECT البند, التفاصيل, الحالة FROM (

  SELECT
    'أعمدة التسعير في instructors'::text AS البند,
    COALESCE(
      (SELECT string_agg(c.column_name, ', ')
         FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'instructors'
          AND c.column_name IN ('approved_price','requested_price','monthly_hours_committed')),
      'مفيش')::text AS التفاصيل,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
       WHERE c.table_schema='public' AND c.table_name='instructors'
         AND c.column_name IN ('approved_price','requested_price','monthly_hours_committed')
    ) THEN '✅ اتحذفت — التسريب اتقفل' ELSE '🔴 لسه موجودة' END AS الحالة

  UNION ALL

  -- ⚠️ **أهم سطر في التأكيد.** لو الحارس لسه بيشاور على عمود
  --    محذوف، **أول تعديل على أي مدرب هيقع** — والملف ده عدّى
  --    نضيف.
  SELECT
    'الحارس لسه بيشاور على المحذوف؟',
    CASE WHEN pr.prosrc LIKE '%approved_price%'
           OR pr.prosrc LIKE '%requested_price%'
           OR pr.prosrc LIKE '%monthly_hours_committed%'
         THEN 'أيوه' ELSE 'لأ' END,
    CASE WHEN pr.prosrc LIKE '%approved_price%'
           OR pr.prosrc LIKE '%requested_price%'
           OR pr.prosrc LIKE '%monthly_hours_committed%'
         THEN '🔴 أول تعديل على مدرب هيقع — نادِني'
         ELSE '✅ نضيف' END
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname='public' AND pr.prokind='f'
    AND pr.proname = 'guard_instructor_fields'

  UNION ALL

  SELECT
    'نسخ guard_instructor_fields',
    (SELECT count(*)::text FROM pg_proc pr
      JOIN pg_namespace n ON n.oid=pr.pronamespace
     WHERE n.nspname='public' AND pr.proname='guard_instructor_fields'),
    CASE WHEN (SELECT count(*) FROM pg_proc pr
                JOIN pg_namespace n ON n.oid=pr.pronamespace
               WHERE n.nspname='public' AND pr.proname='guard_instructor_fields') = 1
         THEN '✅ واحدة' ELSE '🔴 أكتر من نسخة (مصيدة س)' END

  UNION ALL

  SELECT
    'الأسعار محفوظة',
    (SELECT count(*)::text FROM public.instructor_pricing
      WHERE approved_price IS NOT NULL OR requested_price IS NOT NULL
         OR monthly_hours_committed IS NOT NULL),
    'صفوف فيها أرقام فعلية'

) t ORDER BY البند;

-- ============================================================
-- التراجع — معلَّق عن قصد.
--
-- ⚠️ **والتراجع هنا مش مجاني**: الأعمدة بترجع فاضية، والبيانات
--    بترجع من `instructor_pricing`. لو الجدول ده اتحذف قبلها،
--    الأسعار **ضاعت**.
-- ============================================================
-- BEGIN;
--   ALTER TABLE public.instructors
--     ADD COLUMN approved_price          integer,
--     ADD COLUMN requested_price         integer,
--     ADD COLUMN monthly_hours_committed integer;
--
--   UPDATE public.instructors i
--      SET approved_price          = p.approved_price,
--          requested_price         = p.requested_price,
--          monthly_hours_committed = p.monthly_hours_committed
--     FROM public.instructor_pricing p
--    WHERE p.instructor_id = i.id;
--
--   -- والحارس يرجع بسطوره التلاتة:
--   CREATE OR REPLACE FUNCTION public.guard_instructor_fields()
--    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
--   AS $function$
--   BEGIN
--     IF auth.uid() IS NULL OR public.is_admin() THEN
--       RETURN NEW;
--     END IF;
--     NEW.user_id                    := OLD.user_id;
--     NEW.status                     := OLD.status;
--     NEW.training_passed            := OLD.training_passed;
--     NEW.approved_price             := OLD.approved_price;
--     NEW.requested_price            := OLD.requested_price;
--     NEW.selected_pricing_option_id := OLD.selected_pricing_option_id;
--     NEW.weekly_schedule            := OLD.weekly_schedule;
--     NEW.monthly_hours_committed    := OLD.monthly_hours_committed;
--     NEW.is_sample                  := OLD.is_sample;
--     RETURN NEW;
--   END
--   $function$;
-- COMMIT;
