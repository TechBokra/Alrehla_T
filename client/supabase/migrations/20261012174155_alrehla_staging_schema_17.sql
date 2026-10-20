-- ============================================================
-- 17 — ملاحظات فريق «بداية الرحلة» (10 أكتوبر 2026)
-- ============================================================
--
-- ── اللي بيصلّحه (بالترتيب) ──────────────────────────────────
--
-- ١) «ملف الطالب: المدرب مش شايف اللي الطالب كتبه في مساحة العمل»
--    المدرب بيظهر له الطالب في «طلابي» لو هو المدرب المختار في الحجز
--    (`preferred_instructor_id`)، بس صلاحية قراية المستندات كانت بتطلب
--    إن يكون فيه **جلسة** متسجّلة باسمه. يعني قبل ما الإدارة تولّد
--    الجلسات، الطالب ظاهر والمستندات فاضية. دلوقتي الشرطين واحد.
--
-- ٢) «تقرير الجلسة بيظهر للإدارة بس»
--    ولي الأمر والطالب المستقل كانوا مسموح لهم يقروا التقرير، بس
--    **حساب دخول الطفل** لأ (`account_profile_id`). الكود هيعرض التقرير
--    في صفحاتهم، والملف ده بيسمح للطفل يقراه.
--
-- ٣) «الجلسات اللي اتنفّذت مش ظاهرة في مستحقات المدرب»
--    المستحقات كانت بتتسجّل للخدمات الإبداعية بس. من دلوقتي (قرار
--    تامر، 10 أكتوبر):
--      • تقرير جلسة بـ«حاضر» = مستحق للمدرب بحصيلة الجلسة المعتمدة له.
--      • «غائب» = مفيش مستحق. ولو التقرير اتعدّل من «حاضر» لـ«غائب»
--        والمستحق لسه ماتصرفش، بيتشال.
--      • المدرب بنظام الراتب الشهري مالوش مستحق بالجلسة.
--      • مدرب مالوش حصيلة معتمدة = مفيش مستحق (مش بنخترع رقم).
--      • **من دلوقتي بس** — الجلسات القديمة مابتتحسبش.
--
-- ⚠️ **مفيش مسح لأي بيانات.** دالتين بيتعدّلوا، سياسة واحدة بتتبدّل،
--    فهرس ومحفّز جداد.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 16، وبعد ما الكود يتنشر. في SQL Editor → Run.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'session_report_earning_trg') THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF to_regclass('public.session_change_requests') IS NULL THEN
    RAISE EXCEPTION 'شغّل ملف 16 الأول.';
  END IF;
END
$$;

-- ── ١) المدرب المختار يشوف مستندات طالبه ─────────────────────
CREATE OR REPLACE FUNCTION public.instructor_teaches(p_student text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM course_subscriptions cs
    JOIN instructors i         ON i.user_id = auth.uid()
    LEFT JOIN child_profiles c ON c.id = cs.child_id
    WHERE (
            i.id = cs.preferred_instructor_id
            OR EXISTS (
              SELECT 1 FROM sessions s
               WHERE s.course_subscription_id = cs.id
                 AND s.instructor_id = i.id
            )
          )
      AND (
            cs.user_id::text           = p_student
         OR c.user_profile_id::text   = p_student
         OR NULLIF(btrim(coalesce(c.account_profile_id, '')), '') = p_student
          )
  );
$function$;

-- ── ٢) حساب الطفل يقرا تقرير جلسته ───────────────────────────
DROP POLICY IF EXISTS "Participants read their session report" ON public.session_reports;
CREATE POLICY "Participants read their session report" ON public.session_reports
  AS PERMISSIVE FOR SELECT TO public
  USING (EXISTS (
    SELECT 1
      FROM sessions s
      JOIN course_subscriptions cs ON cs.id = s.course_subscription_id
      LEFT JOIN child_profiles c   ON c.id = cs.child_id
     WHERE s.id = session_reports.session_id
       AND (
             cs.user_id = auth.uid()
          OR c.user_profile_id = auth.uid()
          OR NULLIF(btrim(coalesce(c.account_profile_id, '')), '') = auth.uid()::text
           )
  ));

-- ── ٣) مستحق المدرب عن الجلسة ────────────────────────────────
-- مستحق واحد لكل جلسة، مهما اتحفظ التقرير كام مرة.
CREATE UNIQUE INDEX instructor_payouts_session_unique
  ON public.instructor_payouts (source_id)
  WHERE source_type = 'session';

CREATE FUNCTION public.record_session_earning()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session record;
  v_model   work_model_enum;
  v_price   integer;
BEGIN
  -- «غائب» (أول مرة أو بعد تعديل): مفيش مستحق، واللي لسه ماتصرفش بيتشال.
  IF NEW.attendance <> 'present' THEN
    DELETE FROM instructor_payouts
     WHERE source_type = 'session'
       AND source_id = NEW.session_id
       AND status = 'pending';
    RETURN NEW;
  END IF;

  SELECT s.id, s.instructor_id, s.session_number, s.scheduled_at, p.name AS package_name
    INTO v_session
    FROM sessions s
    JOIN course_subscriptions cs ON cs.id = s.course_subscription_id
    LEFT JOIN creative_writing_packages p ON p.id = cs.package_id
   WHERE s.id = NEW.session_id;

  IF NOT FOUND OR v_session.instructor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT i.work_model INTO v_model FROM instructors i WHERE i.id = v_session.instructor_id;
  IF v_model IS DISTINCT FROM 'per_session' THEN
    RETURN NEW;
  END IF;

  SELECT ip.approved_price INTO v_price
    FROM instructor_pricing ip
   WHERE ip.instructor_id = v_session.instructor_id;
  IF v_price IS NULL OR v_price <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO instructor_payouts (
    instructor_id, period, amount, status, source_type, source_id, description
  )
  VALUES (
    v_session.instructor_id,
    to_char(v_session.scheduled_at AT TIME ZONE 'Africa/Cairo', 'YYYY-MM'),
    v_price,
    'pending',
    'session',
    v_session.id,
    'جلسة ' || v_session.session_number || COALESCE(' — ' || v_session.package_name, '')
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.record_session_earning FROM public, anon, authenticated, service_role;

CREATE TRIGGER session_report_earning_trg
  AFTER INSERT OR UPDATE OF attendance ON public.session_reports
  FOR EACH ROW EXECUTE FUNCTION public.record_session_earning();

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
SELECT 'المدرب المختار يشوف المستندات' AS "البند",
       CASE WHEN pg_get_functiondef('public.instructor_teaches(text)'::regprocedure) LIKE '%preferred_instructor_id%'
            THEN '✓' ELSE '✗' END AS "الحالة"
UNION ALL
SELECT 'حساب الطفل يقرا التقرير',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants read their session report'
                          AND qual LIKE '%account_profile_id%') THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'مستحق المدرب عن الجلسة',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'session_report_earning_trg') THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'للمعلومة: مدربين بالجلسة من غير حصيلة معتمدة (مش هيتسجّل لهم مستحق)',
       (SELECT count(*)::text FROM instructors i
          LEFT JOIN instructor_pricing ip ON ip.instructor_id = i.id
         WHERE i.status = 'active' AND i.work_model = 'per_session'
           AND COALESCE(ip.approved_price, 0) <= 0);
