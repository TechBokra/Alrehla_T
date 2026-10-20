-- استوديو القصص — اختبار (٢): ربط مهام الإدارة + الاستيراد بأثر رجعي.
-- يتشغّل على قاعدة محلية أو staging بعد migration الأساس والـ migration التانية.
-- كل البيانات بتتراجع (ROLLBACK). مايتشغّلش على production.
--
-- التشغيل: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/story_studio_tasks_backfill.sql
-- النجاح: بيطبع «story_studio_tasks_backfill: OK».
BEGIN;

CREATE FUNCTION public.__t_try(q text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE q;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ':' || SQLERRM;
END
$f$;
GRANT EXECUTE ON FUNCTION public.__t_try(text) TO authenticated;

DO $$
DECLARE
  v_manager  uuid := gen_random_uuid();
  v_editor   uuid := gen_random_uuid();
  v_editor2  uuid := gen_random_uuid();   -- موقوف
  v_art      uuid := gen_random_uuid();
  v_default  uuid := gen_random_uuid();
  v_customer uuid := gen_random_uuid();
  v_role_mgr uuid; v_role_edt uuid; v_role_art uuid;
  v_prod     text := 'bf-custom-' || substr(gen_random_uuid()::text, 1, 8);
  v_prod_lib text := 'bf-lib-'    || substr(gen_random_uuid()::text, 1, 8);
  o_paid uuid := gen_random_uuid();  o_prep uuid := gen_random_uuid();  o_ship uuid := gen_random_uuid();
  o_deliv uuid := gen_random_uuid(); o_canc uuid := gen_random_uuid();  o_wait uuid := gen_random_uuid();
  o_lib uuid := gen_random_uuid();
  i_paid uuid := gen_random_uuid();  i_prep uuid := gen_random_uuid();  i_ship uuid := gen_random_uuid();
  i_deliv uuid := gen_random_uuid(); i_canc uuid := gen_random_uuid();  i_wait uuid := gen_random_uuid();
  i_lib uuid := gen_random_uuid();
  p_paid uuid; p_prep uuid; p_ship uuid;
  t work_tasks;
  n integer;
  r text;
  k text;
BEGIN
  SELECT id INTO v_role_mgr FROM public.admin_roles WHERE name = 'مسؤول إنتاج القصص';
  SELECT id INTO v_role_edt FROM public.admin_roles WHERE name = 'محرر قصص';
  SELECT id INTO v_role_art FROM public.admin_roles WHERE name = 'مشرف فني';

  INSERT INTO public.user_profiles(id, full_name, role, admin_role_id, suspended_at) VALUES
    (v_manager,  'BF Manager',   'general_supervisor', v_role_mgr, NULL),
    (v_editor,   'BF Editor',    'general_supervisor', v_role_edt, NULL),
    (v_editor2,  'BF Editor 2',  'general_supervisor', v_role_edt, now()),
    (v_art,      'BF Art',       'general_supervisor', v_role_art, NULL),
    (v_default,  'BF Default',   'general_supervisor', NULL,       NULL),
    (v_customer, 'عميل',         'customer',           NULL,       NULL);

  INSERT INTO public.personalized_products(id, slug, name, category, price)
    VALUES (v_prod, v_prod, 'قصة مخصصة', 'custom', 100), (v_prod_lib, v_prod_lib, 'مكتبة', 'library', 50);

  FOR k IN SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'public.orders'::regclass AND NOT tgisinternal
              AND tgname IN ('validate_order_state_transition_trg', 'guard_order_fields_trg') LOOP
    EXECUTE format('ALTER TABLE public.orders DISABLE TRIGGER %I', k);
  END LOOP;

  -- طلبات «موجودة» بحالات مختلفة (بتتعمل مباشرة = زي اللي اتدفع قبل الاستوديو).
  INSERT INTO public.orders(id, user_id, total_amount, status, payment_reference) VALUES
    (o_paid, v_customer, 100, 'paid', 'REF-PAID'), (o_prep, v_customer, 100, 'preparing', 'REF-PREP'),
    (o_ship, v_customer, 100, 'shipped', 'REF-SHIP'), (o_deliv, v_customer, 100, 'delivered', 'REF-DEL'),
    (o_canc, v_customer, 100, 'cancelled', 'REF-CAN'), (o_wait, v_customer, 100, 'awaiting_verification', 'REF-WAIT'),
    (o_lib, v_customer, 50, 'paid', 'REF-LIB');
  INSERT INTO public.order_items(id, order_id, product_id, quantity, unit_price, customization_data) VALUES
    (i_paid, o_paid, v_prod, 1, 100, jsonb_build_object('childName', 'ليلى', 'childPhoto', 'https://example.com/p.jpg')),
    (i_prep, o_prep, v_prod, 1, 100, jsonb_build_object('childName', 'عمر')),
    (i_ship, o_ship, v_prod, 1, 100, '{}'::jsonb),
    (i_deliv, o_deliv, v_prod, 1, 100, '{}'::jsonb),
    (i_canc, o_canc, v_prod, 1, 100, '{}'::jsonb),
    (i_wait, o_wait, v_prod, 1, 100, '{}'::jsonb),
    (i_lib, o_lib, v_prod_lib, 1, 50, '{}'::jsonb);

  -- مهمة «إنها لك — التنفيذ» الموجودة للطلب المدفوع: لازم تفضل زي ما هي.
  INSERT INTO public.work_tasks(line, stage, source_id, reference, title, link, assignee_ids)
    VALUES ('enha_lak', 'fulfilment', o_paid::text, 'REF-PAID', 'طلب «إنها لك» — التنفيذ',
            '/dashboard/admin/orders/' || o_paid::text, ARRAY[v_default]);

  -- ── ١) قيود خط المهام ───────────────────────────────────────────────────
  r := public.__t_try('INSERT INTO public.work_tasks(line, stage, source_id, title, link) VALUES (''bogus'', ''fulfilment'', ''x'', ''t'', ''/'')');
  ASSERT r LIKE '23514:%', 'خط مجهول عدّى: ' || coalesce(r, 'نجح');

  -- ── ٢) الاستيراد: العدّاد والصلاحيات ───────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  ASSERT public.story_backfill_pending() = 3,
    'العدّاد لازم 3 (مدفوع/بيتجهّز/اتشحن، مخصّص، من غير مشروع): ' || public.story_backfill_pending();
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_default::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  ASSERT public.story_backfill_pending() = 0, 'إداري من غير صلاحية الاستوديو شاف عدّاد';
  r := public.__t_try('SELECT public.story_backfill_projects()');
  ASSERT r LIKE '42501:%', 'إداري عادي نفّذ الاستيراد: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try('SELECT public.story_backfill_projects()');
  ASSERT r LIKE '42501:%', 'المحرر نفّذ الاستيراد (لمسؤول الإنتاج بس): ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  -- ── ٣) الاستيراد والاستوديو مقفول ──────────────────────────────────────────
  DELETE FROM public.site_settings WHERE key = 'general';
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  n := public.story_backfill_projects();
  EXECUTE 'RESET ROLE';
  ASSERT n = 3, 'الاستيراد لازم ينشئ 3 مشاريع: ' || n;
  ASSERT (SELECT count(*) FROM public.story_projects) = 3, 'عدد المشاريع غلط';
  ASSERT NOT EXISTS (SELECT 1 FROM public.story_projects WHERE order_item_id IN (i_deliv, i_canc, i_wait, i_lib)),
    'اتعمل مشروع لطلب اتسلّم/اتلغى/لسه ماتدفعش/مش مخصّص';
  SELECT id INTO p_paid FROM public.story_projects WHERE order_item_id = i_paid;
  SELECT id INTO p_prep FROM public.story_projects WHERE order_item_id = i_prep;
  SELECT id INTO p_ship FROM public.story_projects WHERE order_item_id = i_ship;
  ASSERT (SELECT brief ? 'childPhoto' FROM public.story_projects WHERE id = p_paid) IS FALSE,
    'صورة الطفل اتنسخت في الـ brief';

  -- تاني مرة: مفيش حاجة تتكرر.
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  ASSERT public.story_backfill_projects() = 0, 'الاستيراد التاني كرّر مشاريع';
  ASSERT public.story_backfill_pending() = 0, 'العدّاد مانزلش لصفر';
  EXECUTE 'RESET ROLE';

  -- ── ٤) مهام الإدارة بعد الاستيراد ──────────────────────────────────────────
  SELECT count(*) INTO n FROM public.work_tasks WHERE line = 'studio' AND status = 'open';
  ASSERT n = 3, 'لازم مهمة مفتوحة لكل مشروع: ' || n;
  SELECT * INTO t FROM public.work_tasks WHERE line = 'studio' AND source_id = p_paid::text;
  ASSERT t.stage = 'fulfilment', 'مرحلة المهمة غلط';
  ASSERT t.assignee_ids = ARRAY[v_manager], 'من غير توزيع المهمة لمسؤول الإنتاج (حامل الصلاحية)';
  ASSERT t.link = '/dashboard/admin/studio/' || p_paid::text, 'رابط المهمة غلط: ' || t.link;
  ASSERT t.title LIKE 'مشروع قصة ليلى%', 'عنوان المهمة غلط: ' || t.title;
  ASSERT t.reference = 'REF-PAID', 'مرجع المهمة لازم رقم الدفع';
  ASSERT (SELECT count(*) FROM public.notifications WHERE recipient_profile_id = v_manager::text) = 3,
    'مسؤول الإنتاج لازم يوصله إشعار لكل مهمة';

  -- مهمة «إنها لك» ماتلمستش.
  SELECT * INTO t FROM public.work_tasks WHERE line = 'enha_lak' AND source_id = o_paid::text;
  ASSERT t.title = 'طلب «إنها لك» — التنفيذ' AND t.assignee_ids = ARRAY[v_default] AND t.status = 'open',
    'مهمة «إنها لك» الموجودة اتغيّرت';
  ASSERT (SELECT count(*) FROM public.work_tasks WHERE line <> 'studio') = 1, 'اتضافت/اتحذفت مهام غير الاستوديو';

  -- ── ٥) تعيين المحرر ← المهمة تروح له، وإشعار له بس ────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET editor_id = v_editor, art_lead_id = v_art WHERE id = p_paid;
  UPDATE public.story_projects SET status = 'text_draft' WHERE id = p_paid;
  EXECUTE 'RESET ROLE';
  SELECT * INTO t FROM public.work_tasks WHERE line = 'studio' AND source_id = p_paid::text;
  ASSERT t.assignee_ids = ARRAY[v_editor], 'مرحلة النص لازم تروح للمحرر: ' || t.assignee_ids::text;
  ASSERT t.title LIKE '%كتابة النص', 'العنوان ماتحدّثش بالمرحلة: ' || t.title;
  ASSERT (SELECT count(*) FROM public.notifications WHERE recipient_profile_id = v_editor::text) = 1,
    'المحرر لازم يوصله إشعار واحد بس';
  -- تحريك المرحلة تاني والمسؤول نفسه ← مفيش إشعار مكرر.
  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET status = 'on_hold' WHERE id = p_paid AND false;  -- (لا شيء: الإيقاف لمسؤول الإنتاج)
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT count(*) FROM public.notifications WHERE recipient_profile_id = v_editor::text) = 1,
    'إشعار مكرر لنفس المسؤول';

  -- إيقاف مؤقت ← مسؤول الإنتاج، واستئناف ← المحرر.
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET status = 'on_hold' WHERE id = p_paid;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT assignee_ids FROM public.work_tasks WHERE line = 'studio' AND source_id = p_paid::text)
           = ARRAY[v_manager], 'الإيقاف لازم يرجّع المهمة لمسؤول الإنتاج';
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET status = 'text_draft' WHERE id = p_paid;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT assignee_ids FROM public.work_tasks WHERE line = 'studio' AND source_id = p_paid::text)
           = ARRAY[v_editor], 'الاستئناف لازم يرجّع المهمة للمحرر';

  -- ── ٦) مشروع من غير محرر ← مسؤول الإنتاج؛ محرر موقوف ← مسؤول الإنتاج ─────────
  ASSERT (SELECT assignee_ids FROM public.work_tasks WHERE line = 'studio' AND source_id = p_prep::text)
           = ARRAY[v_manager], 'من غير محرر لازم مسؤول الإنتاج';
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET editor_id = v_editor2 WHERE id = p_prep;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT assignee_ids FROM public.work_tasks WHERE line = 'studio' AND source_id = p_prep::text)
           = ARRAY[v_manager], 'محرر موقوف اتسند له مهمة';

  -- ── ٧) قاعدة «توزيع المهام» للاستوديو بتغلب الدور ───────────────────────────
  INSERT INTO public.assignment_rules(line, stage, profile_id) VALUES ('studio', 'fulfilment', v_default);
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET editor_id = NULL WHERE id = p_prep;   -- بيحرّك المزامنة
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT assignee_ids FROM public.work_tasks WHERE line = 'studio' AND source_id = p_prep::text)
           = ARRAY[v_default], 'قاعدة التوزيع ماتطبّقتش: ' ||
           (SELECT assignee_ids::text FROM public.work_tasks WHERE line = 'studio' AND source_id = p_prep::text);
  DELETE FROM public.assignment_rules WHERE line = 'studio';

  -- ── ٨) الطلب اتلغى والمشروع شغّال ← تحذير لمسؤول الإنتاج ───────────────────
  UPDATE public.orders SET status = 'cancelled' WHERE id = o_paid;
  ASSERT (SELECT order_closed_at FROM public.story_projects WHERE id = p_paid) IS NOT NULL, 'المشروع ماتعلّمش بإلغاء الطلب';
  SELECT * INTO t FROM public.work_tasks WHERE line = 'studio' AND source_id = p_paid::text;
  ASSERT t.title LIKE '⚠%', 'مفيش تحذير في العنوان: ' || t.title;
  ASSERT t.assignee_ids = ARRAY[v_manager], 'تحذير الإلغاء لازم يروح لمسؤول الإنتاج';
  ASSERT t.status = 'open', 'مهمة التحذير لازم تفضل مفتوحة';
  -- مهمة «إنها لك» ماتتأثرش من جهتنا (إغلاقها من محفّز الطلبات الأصلي).
  ASSERT (SELECT assignee_ids FROM public.work_tasks WHERE line = 'enha_lak' AND source_id = o_paid::text) = ARRAY[v_default],
    'مهمة «إنها لك» اتغيّر مسؤولها';
  UPDATE public.orders SET status = 'paid' WHERE id = o_paid;
  ASSERT (SELECT order_closed_at FROM public.story_projects WHERE id = p_paid) IS NULL, 'العلامة ماتشالتش';

  -- ── ٩) إلغاء/تسليم المشروع ← المهمة تتقفل ──────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET status = 'cancelled' WHERE id = p_ship;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT status FROM public.work_tasks WHERE line = 'studio' AND source_id = p_ship::text) = 'done',
    'إلغاء المشروع ماقفلش المهمة';

  -- ── ١٠) الدوال الداخلية مش متاحة للمستخدم ──────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format('SELECT public.story_sync_task(%L)', p_paid));
  ASSERT r LIKE '42501:%', 'المزامنة متاحة للمستخدم: ' || coalesce(r, 'نجح');
  r := public.__t_try('SELECT public.story_backfill_core()');
  ASSERT r LIKE '42501:%', 'الاستيراد الداخلي متاح للمستخدم: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  -- ── ١١) فشل المزامنة مايفشّلش أي عملية على المشروع ولا الطلب ──────────────
  ALTER TABLE public.work_tasks RENAME TO work_tasks_broken;
  -- (من غير SET ROLE: سياسات RLS بتقرا جدول المهام لتحديد الوصول، والمطلوب هنا اختبار
  --  محفّزات المزامنة نفسها لا سياسات القراءة. الهوية بتفضل من الـ claim للحرّاس.)
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  UPDATE public.story_projects SET due_at = now() + interval '3 days', editor_id = v_editor WHERE id = p_prep;
  UPDATE public.story_projects SET status = 'text_draft' WHERE id = p_prep;
  ASSERT (SELECT status FROM public.story_projects WHERE id = p_prep) = 'text_draft',
    'فشل المزامنة منع تحريك المشروع';
  ALTER TABLE public.work_tasks_broken RENAME TO work_tasks;
  -- (محفّز مهام الطلبات الأصلي ماله علاقة بالاستوديو، فبنكسر جدول المشاريع بس.)
  ALTER TABLE public.story_projects RENAME TO story_projects_broken;
  UPDATE public.orders SET status = 'cancelled' WHERE id = o_prep;
  ASSERT (SELECT status::text FROM public.orders WHERE id = o_prep) = 'cancelled', 'فشل المزامنة فشّل تغيير حالة الطلب';
  ALTER TABLE public.story_projects_broken RENAME TO story_projects;

  RAISE NOTICE 'story_studio_tasks_backfill: OK';
END
$$;

ROLLBACK;
