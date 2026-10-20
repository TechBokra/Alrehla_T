-- ============================================================
-- 14 — توزيع الطلبات على المسؤولين («مهامي»)
-- ============================================================
--
-- ── ليه (طلب تامر) ──────────────────────────────────────────
--
-- «آلية لتوجيه الطلبات بشكل تلقائي لمستخدم إداري ذو صلاحية معينة،
-- بحيث يظهر له في الإشعارات وفي صفحته المطلوب منه». واختياراته:
--   • مسؤول لكل نوع: «إنها لك» · صندوق الرحلة · حجوزات «بداية الرحلة»
--     · الخدمات الإبداعية.
--   • على مرحلتين:
--       ١) مراجعة الدفع — أول ما العميل يرفع الإيصال.
--       ٢) التنفيذ     — أول ما الدفع يتأكد (تجهيز/شحن/جدولة/متابعة).
--
-- ── إزاي بيشتغل ─────────────────────────────────────────────
--
-- `assignment_rules` = مين مسؤول عن إيه (من «الإعدادات ← توزيع الطلبات»).
-- `work_tasks`       = المهام نفسها. **بتتعمل لوحدها هنا في القاعدة** مع
--                      تغيير حالة الطلب — مش من الموقع — فمفيش طلب
--                      بيعدّي من غير مهمة مهما كان اتغيّر منين.
--
--   الحالة بقت «بانتظار تأكيد الدفع» ← مهمة «مراجعة الدفع» + إشعار للمسؤولين
--   الدفع اتأكد (مدفوع / الحجز اتفعّل) ← مهمة الدفع بتتقفل، ومهمة «التنفيذ» تتفتح
--   اتسلّم / اكتمل / اتلغى            ← مهمة التنفيذ بتتقفل لوحدها
--
-- والمسؤول (أو أي إداري) يقدر يقفل المهمة بإيده («تم»)، ويغيّر المسؤول.
-- لو مفيش مسؤول متحدد لنوع، المهمة بتتعمل «من غير مسؤول» وبتظهر لكل
-- الإدارة في «المهام المفتوحة».
--
-- ⚠️ **مفيش مسح لأي بيانات.** جدولين جداد + محفّزات بعد تغيير الحالة.
--    والملف بيعمل مهام للطلبات المفتوحة دلوقتي (من غير إشعارات).
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 13. في SQL Editor → Run. ولو اتشغّل تاني بيقف من أوله.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.work_tasks') IS NOT NULL THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF to_regclass('public.discount_codes') IS NULL THEN
    RAISE EXCEPTION 'شغّل ملف 13 الأول.';
  END IF;
END
$$;

-- ── ١. مين مسؤول عن إيه ─────────────────────────────────────

CREATE TABLE public.assignment_rules (
  line        text        NOT NULL,
  stage       text        NOT NULL,
  profile_id  uuid        NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT assignment_rules_pkey PRIMARY KEY (line, stage, profile_id),
  CONSTRAINT assignment_rules_line CHECK (line IN ('enha_lak', 'box', 'courses', 'services')),
  CONSTRAINT assignment_rules_stage CHECK (stage IN ('payment', 'fulfilment')),
  CONSTRAINT assignment_rules_profile_fkey FOREIGN KEY (profile_id)
    REFERENCES public.user_profiles(id) ON DELETE CASCADE
);

-- ── ٢. المهام ───────────────────────────────────────────────

CREATE TABLE public.work_tasks (
  id            uuid        DEFAULT gen_random_uuid() NOT NULL,
  line          text        NOT NULL,
  stage         text        NOT NULL,
  -- رقم الطلب / الحجز / طلب الخدمة.
  source_id     text        NOT NULL,
  reference     text,
  title         text        NOT NULL,
  link          text        NOT NULL,
  -- ⚠️ **منسوخة وقت المهمة** — تغيير الإعدادات بعدين مايغيّرش مهام قديمة.
  assignee_ids  uuid[]      DEFAULT '{}'::uuid[] NOT NULL,
  status        text        DEFAULT 'open' NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  done_at       timestamptz,
  done_by       uuid,
  CONSTRAINT work_tasks_pkey PRIMARY KEY (id),
  -- مهمة واحدة لكل مرحلة في كل طلب.
  CONSTRAINT work_tasks_one_per_stage UNIQUE (line, source_id, stage),
  CONSTRAINT work_tasks_line CHECK (line IN ('enha_lak', 'box', 'courses', 'services')),
  CONSTRAINT work_tasks_stage CHECK (stage IN ('payment', 'fulfilment')),
  CONSTRAINT work_tasks_status CHECK (status IN ('open', 'done'))
);
CREATE INDEX work_tasks_open_idx ON public.work_tasks (status, created_at DESC);
CREATE INDEX work_tasks_assignees_idx ON public.work_tasks USING gin (assignee_ids);

ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_tasks       ENABLE ROW LEVEL SECURITY;

-- الإدارة بس — الكتابة في المهام بتيجي من المحفّزات (بصلاحية القاعدة)
-- أو من الإداري نفسه («تم» / تغيير المسؤول).
CREATE POLICY "Admins manage assignment rules" ON public.assignment_rules
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins read work tasks" ON public.work_tasks
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admins update work tasks" ON public.work_tasks
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.assignment_rules, public.work_tasks FROM anon;
REVOKE TRUNCATE ON public.assignment_rules, public.work_tasks FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.assignment_rules TO authenticated;
GRANT SELECT, UPDATE ON public.work_tasks TO authenticated;
GRANT ALL ON public.assignment_rules, public.work_tasks TO service_role;

-- ── ٣. فتح وقفل المهام ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.work_task_open(
  p_line text, p_stage text, p_source text, p_reference text, p_title text, p_link text, p_notify boolean
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assignees uuid[];
  v_existing  work_tasks;
  v_who       uuid;
BEGIN
  -- المسؤولين اللي لسه إداريين بس (اللي اتشالت صلاحيته مايوصلوش مهام).
  SELECT coalesce(array_agg(r.profile_id ORDER BY r.created_at), '{}'::uuid[])
    INTO v_assignees
    FROM assignment_rules r
    JOIN user_profiles u ON u.id = r.profile_id
   WHERE r.line = p_line AND r.stage = p_stage
     AND u.role IN ('super_admin', 'general_supervisor');

  SELECT * INTO v_existing FROM work_tasks
   WHERE line = p_line AND source_id = p_source AND stage = p_stage;

  IF FOUND THEN
    -- رجعت للمرحلة دي تاني (مثلًا الإيصال اترفض واترفع تاني) — نفس المهمة.
    IF v_existing.status = 'open' THEN
      RETURN;
    END IF;
    UPDATE work_tasks SET status = 'open', done_at = NULL, done_by = NULL
     WHERE id = v_existing.id;
    v_assignees := v_existing.assignee_ids;
  ELSE
    INSERT INTO work_tasks (line, stage, source_id, reference, title, link, assignee_ids)
    VALUES (p_line, p_stage, p_source, p_reference, p_title, p_link, v_assignees);
  END IF;

  IF p_notify THEN
    FOREACH v_who IN ARRAY v_assignees LOOP
      INSERT INTO notifications (recipient_profile_id, title, message, link)
      VALUES (
        v_who::text,
        p_title,
        'مسند ليك' || CASE WHEN p_reference IS NOT NULL THEN ' — ' || p_reference ELSE '' END
          || '. تلاقيه في «مهامي».',
        p_link
      );
    END LOOP;
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.work_task_close(p_line text, p_stage text, p_source text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE work_tasks
     SET status = 'done', done_at = now(), done_by = auth.uid()
   WHERE line = p_line AND stage = p_stage AND source_id = p_source AND status = 'open';
$function$;

REVOKE ALL ON FUNCTION public.work_task_open(text, text, text, text, text, text, boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.work_task_close(text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.work_task_open(text, text, text, text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.work_task_close(text, text, text) TO service_role;

/**
 * المحفّز: بعد ما حالة الطلب/الحجز/طلب الخدمة تتغيّر.
 * `TG_ARGV[0]` = الجدول بالاسم اللي بنحتاجه (orders · courses · services).
 */
CREATE OR REPLACE FUNCTION public.work_tasks_on_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_kind    text := TG_ARGV[0];
  v_line    text;
  v_label   text;
  v_link    text;
  v_status  text := NEW.status::text;
  v_paid    boolean;
  v_closed  boolean;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF v_kind = 'orders' THEN
    v_line  := CASE WHEN NEW.box_plan_id IS NULL THEN 'enha_lak' ELSE 'box' END;
    v_label := CASE WHEN v_line = 'box' THEN 'اشتراك صندوق الرحلة' ELSE 'طلب «إنها لك»' END;
    v_link  := '/dashboard/admin/orders/' || NEW.id::text;
    v_paid  := v_status IN ('paid', 'preparing', 'shipped', 'delivered');
    v_closed := v_status IN ('delivered', 'cancelled', 'refunded', 'failed');
  ELSIF v_kind = 'courses' THEN
    v_line  := 'courses';
    v_label := 'حجز باقة «بداية الرحلة»';
    v_link  := '/dashboard/admin/bookings/' || NEW.id::text;
    v_paid  := v_status IN ('active', 'completed');
    v_closed := v_status IN ('completed', 'cancelled');
  ELSE
    v_line  := 'services';
    v_label := 'طلب خدمة إبداعية';
    v_link  := '/dashboard/admin/orders/services/' || NEW.id::text;
    v_paid  := v_status IN ('paid', 'in_progress', 'delivered', 'completed');
    v_closed := v_status IN ('completed', 'cancelled', 'refunded');
  END IF;

  -- ١) الإيصال وصل ← مراجعة الدفع.
  IF v_status = 'awaiting_verification' THEN
    PERFORM public.work_task_open(v_line, 'payment', NEW.id::text, NEW.payment_reference,
      v_label || ' — مراجعة الدفع', v_link, true);
  ELSE
    -- خرج من «بانتظار التأكيد» لأي حالة (اتأكد، اترفض، اتلغى) ← مهمة الدفع خلصت.
    PERFORM public.work_task_close(v_line, 'payment', NEW.id::text);
  END IF;

  -- ٢) الدفع اتأكد ← التنفيذ (لحد ما يتسلّم/يكتمل/يتلغى).
  IF v_closed THEN
    PERFORM public.work_task_close(v_line, 'fulfilment', NEW.id::text);
  ELSIF v_paid THEN
    PERFORM public.work_task_open(v_line, 'fulfilment', NEW.id::text, NEW.payment_reference,
      v_label || ' — التنفيذ', v_link, true);
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER work_tasks_orders_trg
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.work_tasks_on_status('orders');
CREATE TRIGGER work_tasks_courses_trg
  AFTER UPDATE OF status ON public.course_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.work_tasks_on_status('courses');
CREATE TRIGGER work_tasks_services_trg
  AFTER UPDATE OF status ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.work_tasks_on_status('services');

-- ── ٤. المفتوح دلوقتي ← مهام (من غير إشعارات) ───────────────
-- (من غير مسؤولين: الإعدادات لسه فاضية — بتظهر في «المهام المفتوحة».)

INSERT INTO public.work_tasks (line, stage, source_id, reference, title, link)
SELECT CASE WHEN o.box_plan_id IS NULL THEN 'enha_lak' ELSE 'box' END,
       CASE WHEN o.status = 'awaiting_verification' THEN 'payment' ELSE 'fulfilment' END,
       o.id::text, o.payment_reference,
       CASE WHEN o.box_plan_id IS NULL THEN 'طلب «إنها لك»' ELSE 'اشتراك صندوق الرحلة' END
         || CASE WHEN o.status = 'awaiting_verification' THEN ' — مراجعة الدفع' ELSE ' — التنفيذ' END,
       '/dashboard/admin/orders/' || o.id::text
  FROM public.orders o
 WHERE o.status IN ('awaiting_verification', 'paid', 'preparing', 'shipped');

INSERT INTO public.work_tasks (line, stage, source_id, reference, title, link)
SELECT 'courses',
       CASE WHEN c.status = 'awaiting_verification' THEN 'payment' ELSE 'fulfilment' END,
       c.id, c.payment_reference,
       'حجز باقة «بداية الرحلة»'
         || CASE WHEN c.status = 'awaiting_verification' THEN ' — مراجعة الدفع' ELSE ' — التنفيذ' END,
       '/dashboard/admin/bookings/' || c.id
  FROM public.course_subscriptions c
 WHERE c.status IN ('awaiting_verification', 'active');

INSERT INTO public.work_tasks (line, stage, source_id, reference, title, link)
SELECT 'services',
       CASE WHEN s.status = 'awaiting_verification' THEN 'payment' ELSE 'fulfilment' END,
       s.id, s.payment_reference,
       'طلب خدمة إبداعية'
         || CASE WHEN s.status = 'awaiting_verification' THEN ' — مراجعة الدفع' ELSE ' — التنفيذ' END,
       '/dashboard/admin/orders/services/' || s.id
  FROM public.service_orders s
 WHERE s.status IN ('awaiting_verification', 'paid', 'in_progress', 'delivered');

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
SELECT 'جدول المسؤولين' AS "البند",
       CASE WHEN to_regclass('public.assignment_rules') IS NOT NULL THEN '✓' ELSE '✗' END AS "الحالة"
UNION ALL
SELECT 'جدول المهام',
       CASE WHEN to_regclass('public.work_tasks') IS NOT NULL THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'المحفّزات على الطلبات والحجوزات والخدمات',
       CASE WHEN (SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'work_tasks_%_trg') = 3 THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'للمعلومة: مهام مفتوحة اتعملت للطلبات الحالية',
       (SELECT count(*)::text FROM public.work_tasks);
