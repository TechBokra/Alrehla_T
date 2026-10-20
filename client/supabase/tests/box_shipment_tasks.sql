-- مهام الشحنات الشهرية لصندوق الرحلة.
-- يتشغّل على قاعدة محلية أو staging بعد كل الـmigrations (لحد 20261016060000).
-- كل البيانات بتتراجع (ROLLBACK). مايتشغّلش على production.
--
-- التشغيل: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/box_shipment_tasks.sql
-- النجاح: بيطبع «box_shipment_tasks: OK».
BEGIN;

DO $$
DECLARE
  v_exec     uuid := gen_random_uuid();   -- مسؤول «التنفيذ» العام
  v_ship     uuid := gen_random_uuid();   -- مسؤول الشحنات الشهرية
  v_customer uuid := gen_random_uuid();
  v_plan     text := 'bx-plan-' || substr(gen_random_uuid()::text, 1, 8);
  v_order    uuid := gen_random_uuid();
  v_sub      uuid;
  v_s1       uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid;
  v_starts   timestamptz;
  n          integer;
  j          jsonb;
  t          work_tasks;
BEGIN
  INSERT INTO public.user_profiles(id, full_name, role, admin_role_id) VALUES
    (v_exec,     'Box Exec',  'general_supervisor', NULL),
    (v_ship,     'Box Ship',  'general_supervisor', NULL),
    (v_customer, 'عميل صندوق', 'customer', NULL);

  -- ── ١) الكتالوج والإعداد ───────────────────────────────────────────────
  ASSERT EXISTS (SELECT 1 FROM public.task_steps WHERE line = 'box' AND step = 'shipment'), 'مرحلة الشحنة مش في الكتالوج';
  ASSERT public.box_shipment_lead_days() = 7, 'الافتراضي ٧ أيام: ' || public.box_shipment_lead_days();
  INSERT INTO public.site_settings(key, value) VALUES ('general', '{"boxShipmentLeadDays": "abc"}')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  ASSERT public.box_shipment_lead_days() = 7, 'قيمة مش رقم ماترجعش للافتراضي';
  UPDATE public.site_settings SET value = '{"boxShipmentLeadDays": 0}' WHERE key = 'general';
  ASSERT public.box_shipment_lead_days() = 1, 'الحد الأدنى يوم';
  UPDATE public.site_settings SET value = '{"boxShipmentLeadDays": 999}' WHERE key = 'general';
  ASSERT public.box_shipment_lead_days() = 60, 'الحد الأقصى ٦٠';
  UPDATE public.site_settings SET value = '{"boxShipmentLeadDays": 7}' WHERE key = 'general';
  ASSERT public.box_shipment_lead_days() = 7;

  -- موعد الشهر: نهاية الشهر لو اليوم مش موجود.
  ASSERT public.box_shipment_due('2026-01-31 10:00+00', 2) = '2026-02-28 10:00+00', 'نهاية فبراير';
  ASSERT public.box_shipment_due('2026-01-15 10:00+00', 1) = '2026-01-15 10:00+00', 'الشهر الأول يوم التفعيل';
  ASSERT public.box_shipment_due('2026-01-15 10:00+00', 4) = '2026-04-15 10:00+00', 'الشهر الرابع';

  -- ── ٢) توزيع: مسؤول «التنفيذ» العام + مسؤول مختلف للشحنات ───────────────
  INSERT INTO public.assignment_rules(line, stage, profile_id) VALUES
    ('box', 'fulfilment', v_exec),
    ('box', 'shipment',   v_ship);

  -- ── ٣) تفعيل اشتراك ٦ شهور بالدفع (المحفّز الأصلي) ──────────────────────
  INSERT INTO public.box_subscription_plans(id, name, price_total, price_monthly, duration_months)
  VALUES (v_plan, 'صندوق ٦ شهور', 600, 100, 6);
  INSERT INTO public.orders(id, user_id, total_amount, status, payment_reference, box_plan_id, box_details, recipient_name)
  VALUES (v_order, v_customer, 600, 'pending', 'BX-1', v_plan,
          jsonb_build_object('plan', jsonb_build_object('name', 'صندوق ٦ شهور', 'months', 6),
                             'childName', 'ليلى', 'monthlyGoals', '[]'::jsonb),
          'عميل صندوق');
  UPDATE public.orders SET status = 'awaiting_verification' WHERE id = v_order;
  ASSERT EXISTS (SELECT 1 FROM public.work_tasks WHERE line = 'box' AND stage = 'payment' AND source_id = v_order::text AND status = 'open'),
    'مهمة مراجعة الدفع ماتفتحتش';
  UPDATE public.orders SET status = 'paid' WHERE id = v_order;

  SELECT id, starts_at INTO v_sub, v_starts FROM public.box_subscriptions WHERE order_id = v_order;
  ASSERT v_sub IS NOT NULL, 'الاشتراك ماتفعّلش';
  ASSERT (SELECT count(*) FROM public.box_shipments WHERE subscription_id = v_sub) = 6, 'ست شحنات';

  -- «التنفيذ» العام على الطلب ماتفتحش (بقت مهمة لكل شحنة).
  ASSERT NOT EXISTS (SELECT 1 FROM public.work_tasks WHERE line = 'box' AND stage = 'fulfilment' AND source_id = v_order::text),
    'مهمة تنفيذ عامة اتفتحت على طلب صندوق';

  -- الشهر الأول مستحق عند التفعيل ← مهمة، والباقي لسه بدري.
  SELECT id INTO v_s1 FROM public.box_shipments WHERE subscription_id = v_sub AND month_number = 1;
  SELECT id INTO v_s2 FROM public.box_shipments WHERE subscription_id = v_sub AND month_number = 2;
  SELECT id INTO v_s3 FROM public.box_shipments WHERE subscription_id = v_sub AND month_number = 3;
  SELECT id INTO v_s4 FROM public.box_shipments WHERE subscription_id = v_sub AND month_number = 4;
  SELECT * INTO t FROM public.work_tasks WHERE line = 'box' AND stage = 'fulfilment' AND source_id = v_s1::text;
  ASSERT t.id IS NOT NULL AND t.status = 'open', 'مهمة الشهر الأول ماتفتحتش';
  ASSERT t.step = 'shipment', 'المرحلة: ' || coalesce(t.step, '—');
  ASSERT t.assignee_ids = ARRAY[v_ship], 'مسؤول الشحنة: لازم قاعدة shipment مش التنفيذ العام';
  ASSERT t.due_at = public.box_shipment_due(v_starts, 1), 'موعد المهمة = موعد الشحنة';
  ASSERT t.title LIKE '%الشهر 1 من 6%', 'العنوان: ' || t.title;
  ASSERT t.title LIKE '%ليلى%', 'اسم الطفل مش في العنوان: ' || t.title;
  ASSERT t.link = '/dashboard/admin/subscriptions/box/' || v_sub::text, 'الرابط: ' || t.link;
  ASSERT (SELECT count(*) FROM public.notifications WHERE recipient_profile_id = v_ship::text AND title LIKE '%الشهر 1 من 6%') = 1,
    'إشعار مسؤول الشحنة';
  ASSERT NOT EXISTS (SELECT 1 FROM public.work_tasks WHERE source_id = v_s2::text), 'مهمة الشهر الثاني بدري';

  -- ── ٤) الفتح قبل الموعد بعدد الأيام المضبوط ───────────────────────────────
  -- الشهر الثاني موعده بعد ~شهر: بـ٧ أيام مايتفتحش، ببقى بعد رفع الأيام لـ٤٠.
  j := public.box_shipment_tasks_sync();
  ASSERT (j ->> 'opened')::int = 0, 'فتح مهام بدري: ' || j::text;
  UPDATE public.site_settings SET value = '{"boxShipmentLeadDays": 40}' WHERE key = 'general';
  j := public.box_shipment_tasks_sync();
  ASSERT (j ->> 'opened')::int = 1, 'مهمة الشهر الثاني بـ٤٠ يوم: ' || j::text;
  ASSERT EXISTS (SELECT 1 FROM public.work_tasks WHERE source_id = v_s2::text AND status = 'open'), 'الشهر الثاني';
  ASSERT NOT EXISTS (SELECT 1 FROM public.work_tasks WHERE source_id = v_s3::text), 'الشهر الثالث بدري';
  -- تشغيل تاني من غير جديد = ولا حاجة (مايكرّرش).
  j := public.box_shipment_tasks_sync();
  ASSERT (j ->> 'opened')::int = 0, 'كرّر الفتح: ' || j::text;
  ASSERT (SELECT count(*) FROM public.work_tasks WHERE line = 'box' AND step = 'shipment') = 2, 'عدد المهام';
  UPDATE public.site_settings SET value = '{"boxShipmentLeadDays": 7}' WHERE key = 'general';

  -- ── ٥) إغلاق وإعادة فتح مع حالة الشحنة ─────────────────────────────────
  UPDATE public.box_shipments SET status = 'shipped', shipped_at = now() WHERE id = v_s1;
  SELECT * INTO t FROM public.work_tasks WHERE source_id = v_s1::text;
  ASSERT t.status = 'done' AND t.done_at IS NOT NULL, 'الشحن ماقفلش المهمة';
  UPDATE public.box_shipments SET status = 'preparing' WHERE id = v_s1;
  SELECT * INTO t FROM public.work_tasks WHERE source_id = v_s1::text;
  ASSERT t.status = 'open', 'رجوع الشحنة للتجهيز ماعاودش فتح المهمة';
  ASSERT t.due_at = public.box_shipment_due(v_starts, 1), 'موعد المهمة بعد إعادة الفتح';
  UPDATE public.box_shipments SET status = 'delivered' WHERE id = v_s1;
  ASSERT (SELECT status FROM public.work_tasks WHERE source_id = v_s1::text) = 'done', 'التسليم';

  -- ── ٦) الاشتراك يتلغي ← كل مهامه تتقفل ────────────────────────────────
  ASSERT EXISTS (SELECT 1 FROM public.work_tasks WHERE source_id = v_s2::text AND status = 'open'), 'الشهر الثاني لسه مفتوح';
  UPDATE public.box_subscriptions SET status = 'cancelled' WHERE id = v_sub;
  ASSERT NOT EXISTS (SELECT 1 FROM public.work_tasks WHERE line = 'box' AND step = 'shipment' AND status = 'open'),
    'اشتراك ملغي وفيه مهام شحنات مفتوحة';
  -- ملغي: ولا مهام جديدة.
  UPDATE public.site_settings SET value = '{"boxShipmentLeadDays": 60}' WHERE key = 'general';
  j := public.box_shipment_tasks_sync();
  ASSERT (j ->> 'opened')::int = 0, 'فتح مهام لاشتراك ملغي: ' || j::text;

  -- ── ٧) مسار «الدفع» لسه شغّال، والتنفيذ العام على طلبات الإنها لك زي ما هو ─
  SELECT count(*) INTO n FROM public.work_tasks WHERE line = 'box' AND stage = 'payment' AND source_id = v_order::text;
  ASSERT n = 1, 'مهمة الدفع';
  ASSERT (SELECT status FROM public.work_tasks WHERE line = 'box' AND stage = 'payment' AND source_id = v_order::text) = 'done',
    'مهمة الدفع ماقفلتش بعد التأكيد';

  RAISE NOTICE 'box_shipment_tasks: OK';
END
$$;

ROLLBACK;
