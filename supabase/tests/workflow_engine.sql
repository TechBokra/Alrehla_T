-- محرك سير العمل (مراحل الاستوديو بيانات + توزيع لكل مرحلة + وصول مشتق).
-- يتشغّل على قاعدة محلية أو staging فقط. كل البيانات بتتراجع (ROLLBACK).
-- مايتشغّلش على production.
--
-- التشغيل: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/workflow_engine.sql
-- النجاح: بيطبع «workflow_engine: OK».
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
  v_manager  uuid := gen_random_uuid();   -- مسؤول إنتاج القصص
  v_worker   uuid := gen_random_uuid();   -- مشرف بالدور الافتراضي (مالوش دور استوديو)
  v_orders   uuid := gen_random_uuid();   -- مدير طلبات (من غير استوديو)
  v_plain    uuid := gen_random_uuid();   -- محاسب: مالوش لا استوديو ولا توزيع
  v_customer uuid := gen_random_uuid();
  v_role_mgr uuid; v_role_acct uuid; v_role_ord uuid;
  v_order    uuid := gen_random_uuid();
  v_item     uuid := gen_random_uuid();
  v_prod     text := 'we-custom-' || substr(gen_random_uuid()::text, 1, 8);
  v_proj     uuid;
  v_ver      uuid;
  v_x        text;   -- مفتاح المرحلة المضافة
  r          text;
  n          integer;
  k          text;
  t          work_tasks;
BEGIN
  SELECT id INTO v_role_mgr FROM public.admin_roles WHERE name = 'مسؤول إنتاج القصص';
  SELECT id INTO v_role_acct FROM public.admin_roles WHERE name = 'محاسب';
  INSERT INTO public.admin_roles(name, permissions) VALUES ('eng-orders', ARRAY['canManageOrders']) RETURNING id INTO v_role_ord;
  INSERT INTO public.user_profiles(id, full_name, role, admin_role_id) VALUES
    (v_manager,  'Eng Manager', 'general_supervisor', v_role_mgr),
    (v_worker,   'Eng Worker',  'general_supervisor', NULL),
    (v_orders,   'Eng Orders',  'general_supervisor', v_role_ord),
    (v_plain,    'Eng Plain',   'general_supervisor', v_role_acct),
    (v_customer, 'عميل تجريبي', 'customer',           NULL);

  -- ── ١) التسلسل الأصلي من البيانات ─────────────────────────────────────────
  ASSERT public.task_next_step('studio', 'brief') = 'text_draft', 'brief ← text_draft';
  ASSERT public.task_next_step('studio', 'text_draft') = 'text_review', 'text_draft ← text_review';
  ASSERT public.task_next_step('studio', 'ready') = 'delivered', 'ready ← delivered';
  ASSERT public.task_next_step('studio', 'delivered') IS NULL, 'التسليم نهاية';
  ASSERT public.task_next_step('studio', 'on_hold') IS NULL, 'الإيقاف مالوش «التالي»';
  ASSERT (SELECT count(*) FROM public.task_edges WHERE line = 'studio') = 12, 'الانتقالات الأصلية ١٢';
  ASSERT (SELECT allowed FROM public.story_transition_rule('qa', 'layout', NULL)), 'qa ← layout (مدير)';
  ASSERT (SELECT who FROM public.story_transition_rule('qa', 'layout', NULL)) = 'manager', 'qa ← layout بمدير';
  ASSERT NOT (SELECT allowed FROM public.story_transition_rule('brief', 'layout', NULL)), 'قفز غير مسموح';
  ASSERT NOT (SELECT allowed FROM public.story_transition_rule('delivered', 'ready', NULL)), 'ما بعد التسليم';
  ASSERT (SELECT allowed FROM public.story_transition_rule('on_hold', 'layout', 'layout')), 'استئناف لنفس المرحلة';
  ASSERT NOT (SELECT allowed FROM public.story_transition_rule('on_hold', 'scenes', 'layout')), 'استئناف لمرحلة تانية';

  -- ── ٢) مرحلة جديدة / حذف / ترتيب (بصلاحية) ─────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_plain::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try($q$SELECT public.studio_stage_create('مراجعة قانونية', 'text_review')$q$);
  ASSERT r LIKE '42501:%', 'مشرف عادي أضاف مرحلة: ' || coalesce(r, 'نجح');
  r := public.__t_try($q$SELECT public.studio_stage_delete('qa')$q$);
  ASSERT r LIKE '42501:%', 'مشرف عادي حذف مرحلة';
  r := public.__t_try($q$INSERT INTO public.task_edges(from_step, to_step) VALUES ('brief', 'qa')$q$);
  ASSERT r IS NOT NULL, 'كتابة مباشرة على الانتقالات عدّت';
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_x := public.studio_stage_create('مراجعة قانونية', 'text_review', 'مراجعة العقد والحقوق', 24, 'editor');
  EXECUTE 'RESET ROLE';
  ASSERT v_x LIKE 'x\_%', 'مفتاح المرحلة الجديدة: ' || coalesce(v_x, '—');
  ASSERT public.task_next_step('studio', 'text_review') = v_x, 'المرحلة الجديدة بعد text_review';
  ASSERT public.task_next_step('studio', v_x) = 'client_text_approval', 'بعدها client_text_approval';
  ASSERT (SELECT builtin FROM public.task_steps WHERE line = 'studio' AND step = v_x) = false, 'المضافة مش أصلية';
  ASSERT (SELECT array_agg(step ORDER BY sort_order) FROM public.task_steps
           WHERE line = 'studio' AND kind IN ('start', 'stage'))[1:5] = ARRAY['brief', 'text_draft', 'text_review', v_x, 'client_text_approval'],
    'ترتيب المراحل بعد الإضافة';

  r := public.__t_try(format($q$SELECT public.studio_stage_create('x', %L)$q$, 'text_review'));
  -- (المدير ماعندوش جلسة هنا → سوبر يوزر بدون uid، فالصلاحية ما بتعدّيش)
  ASSERT r IS NOT NULL, 'اسم من حرف واحد عدّى';

  -- تحريك: المرحلة الجديدة تتقدّم خطوة قبل text_review.
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.studio_stage_move(v_x, -1);
  EXECUTE 'RESET ROLE';
  ASSERT public.task_next_step('studio', 'text_draft') = v_x, 'التحريك لفوق ماحصلش';
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.studio_stage_move(v_x, 1);
  r := public.__t_try($q$SELECT public.studio_stage_move('brief', 1)$q$);
  ASSERT r LIKE '23514:%', 'تحريك مرحلة البداية عدّى';
  r := public.__t_try($q$SELECT public.studio_stage_delete('delivered')$q$);
  ASSERT r LIKE '23514:%', 'حذف مرحلة نظامية عدّى';
  EXECUTE 'RESET ROLE';
  ASSERT public.task_next_step('studio', 'text_review') = v_x, 'التحريك لتحت ماحصلش';

  -- ── ٣) التوزيع لكل مرحلة + الوصول المشتق ──────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_worker::text, true);
  ASSERT NOT public.admin_has_permission('canWorkStudio'), 'تهيئة';
  ASSERT NOT public.story_studio_access(), 'وصول قبل أي توزيع';
  INSERT INTO public.assignment_rules(line, stage, profile_id) VALUES ('studio', 'text_draft', v_worker);
  ASSERT public.story_studio_access(), 'الوصول ماتشتقش من التوزيع';
  PERFORM set_config('request.jwt.claim.sub', v_plain::text, true);
  ASSERT NOT public.story_studio_access(), 'مشرف مالوش توزيع وصل';
  r := public.__t_try($q$INSERT INTO public.assignment_rules(line, stage, profile_id) VALUES ('studio', 'nope', gen_random_uuid())$q$);
  ASSERT r IS NOT NULL, 'مرحلة مجهولة في التوزيع عدّت';
  r := public.__t_try(format($q$INSERT INTO public.assignment_rules(line, stage, profile_id) VALUES ('enha_lak', 'text_draft', %L)$q$, v_plain));
  ASSERT r LIKE '23514:%', 'مرحلة استوديو على خط تاني عدّت: ' || coalesce(r, 'نجح');
  -- مراحل الطلب الدقيقة تتوزّع.
  INSERT INTO public.assignment_rules(line, stage, profile_id) VALUES ('enha_lak', 'shipped', v_plain);

  -- ── ٤) مشروع حقيقي يمشي بالمحرك ───────────────────────────────────────────
  INSERT INTO public.personalized_products(id, slug, name, category, price)
    VALUES (v_prod, v_prod, 'قصة مخصصة تجريبية', 'custom', 100);
  INSERT INTO public.orders(id, user_id, total_amount) VALUES (v_order, v_customer, 100);
  INSERT INTO public.order_items(id, order_id, product_id, quantity, unit_price, customization_data)
    VALUES (v_item, v_order, v_prod, 1, 100, jsonb_build_object('childName', 'سلمى'));
  DELETE FROM public.site_settings WHERE key = 'general';
  INSERT INTO public.site_settings(key, value) VALUES ('general', jsonb_build_object('studioMode', 'on'));
  UPDATE public.orders SET status = 'paid' WHERE id = v_order;
  SELECT id INTO v_proj FROM public.story_projects WHERE order_item_id = v_item;
  ASSERT v_proj IS NOT NULL AND (SELECT status FROM public.story_projects WHERE id = v_proj) = 'brief',
    'المشروع ماتعملش من مرحلة البداية';

  -- brief ← text_draft: مرحلة brief مالهاش توزيع → مدير، والعامل مش مسؤول عنها.
  PERFORM set_config('request.jwt.claim.sub', v_worker::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format($q$UPDATE public.story_projects SET status = 'text_draft' WHERE id = %L$q$, v_proj));
  EXECUTE 'RESET ROLE';
  ASSERT r LIKE '42501:%', 'عامل مش مسؤول المرحلة حرّك المشروع: ' || coalesce(r, 'نجح');

  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET status = 'text_draft' WHERE id = v_proj;
  EXECUTE 'RESET ROLE';
  SELECT * INTO t FROM public.work_tasks WHERE line = 'studio' AND source_id = v_proj::text;
  ASSERT t.assignee_ids = ARRAY[v_worker], 'المهمة لازم تروح لمسؤول مرحلة text_draft: ' || coalesce(t.assignee_ids::text, '—');
  ASSERT t.step = 'text_draft', 'خطوة المهمة';

  -- المسند له يكتب نسخة ويحرّك للمراجعة من غير ما يتعيّن محرر على المشروع.
  PERFORM set_config('request.jwt.claim.sub', v_worker::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.story_versions(project_id, version_no, body) VALUES (v_proj, 1, 'كان يا ما كان…')
    RETURNING id INTO v_ver;
  UPDATE public.story_projects SET status = 'text_review' WHERE id = v_proj;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT status FROM public.story_projects WHERE id = v_proj) = 'text_review', 'العامل ماعرفش يحرّك';

  -- text_review ← المرحلة الجديدة: العامل مابقاش صاحب (المرحلة بتاعة مدير الإنتاج لأن مالهاش توزيع).
  SELECT * INTO t FROM public.work_tasks WHERE line = 'studio' AND source_id = v_proj::text;
  ASSERT NOT (v_worker = ANY (t.assignee_ids)), 'العامل فضل مسند عليه بعد ما المرحلة اتغيّرت';
  PERFORM set_config('request.jwt.claim.sub', v_worker::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format($q$UPDATE public.story_projects SET status = %L WHERE id = %L$q$, v_x, v_proj));
  EXECUTE 'RESET ROLE';
  ASSERT r LIKE '42501:%', 'عامل بعد خروجه من مرحلته حرّك المشروع: ' || coalesce(r, 'نجح');

  -- وزّع المرحلة الجديدة وطبّق على المهام المفتوحة.
  INSERT INTO public.assignment_rules(line, stage, profile_id) VALUES ('studio', v_x, v_worker);
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET status = v_x WHERE id = v_proj;
  EXECUTE 'RESET ROLE';
  SELECT * INTO t FROM public.work_tasks WHERE line = 'studio' AND source_id = v_proj::text;
  ASSERT t.assignee_ids = ARRAY[v_worker] AND t.step = v_x, 'المهمة ماروحتش لمسؤول المرحلة الجديدة';
  ASSERT t.title LIKE '%مراجعة قانونية%', 'عنوان المهمة من اسم المرحلة: ' || t.title;

  -- بوابات: غير معتمد من المحرر لسه ← client_text_approval ممنوعة.
  PERFORM set_config('request.jwt.claim.sub', v_worker::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format($q$UPDATE public.story_projects SET status = 'client_text_approval' WHERE id = %L$q$, v_proj));
  ASSERT r LIKE '23514:%', 'تخطّى شرط اعتماد المحرر: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  -- شرط جديد على المرحلة الجديدة نفسها: لازم نص معتمد.
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.studio_stage_flow(v_x, true, ARRAY['text'], ARRAY['text_editor_approved'], 'owner');
  r := public.__t_try(format($q$SELECT public.studio_stage_flow(%L, true, ARRAY['bogus'], ARRAY[]::text[], 'owner')$q$, v_x));
  ASSERT r LIKE '23514:%', 'قدرة مجهولة عدّت';
  r := public.__t_try(format($q$SELECT public.studio_stage_flow(%L, true, ARRAY[]::text[], ARRAY['bogus'], 'owner')$q$, v_x));
  ASSERT r LIKE '23514:%', 'شرط مجهول عدّ';
  EXECUTE 'RESET ROLE';

  -- مرحلة فيها مشروع ماتتحذفش ولا تتعطّل.
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format($q$SELECT public.studio_stage_delete(%L)$q$, v_x));
  ASSERT r LIKE '23514:%', 'حذف مرحلة فيها مشروع';
  r := public.__t_try(format($q$SELECT public.studio_stage_flow(%L, false, ARRAY[]::text[], ARRAY[]::text[], 'owner')$q$, v_x));
  ASSERT r LIKE '23514:%', 'تعطيل مرحلة فيها مشروع';
  EXECUTE 'RESET ROLE';

  -- الاعتماد ثم النقل للأمام (الشرط اتحقق).
  PERFORM set_config('request.jwt.claim.sub', v_worker::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_versions SET status = 'editor_approved' WHERE id = v_ver;
  UPDATE public.story_projects SET status = 'client_text_approval' WHERE id = v_proj;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT status FROM public.story_projects WHERE id = v_proj) = 'client_text_approval', 'النقل بعد استيفاء الشرط';

  -- ── ٥) الانتقالات الاستثنائية تتحرّر من البيانات ───────────────────────────
  -- client_text_approval ← المرحلة الجديدة (رجوع بمدير)
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format($q$UPDATE public.story_projects SET status = %L WHERE id = %L$q$, v_x, v_proj));
  ASSERT r LIKE '23514:%', 'رجوع غير معرّف عدّى';
  PERFORM public.studio_edges_set('client_text_approval', jsonb_build_array(
    jsonb_build_object('to', 'text_draft', 'who', 'owner'),
    jsonb_build_object('to', v_x, 'who', 'manager', 'skipGates', true)
  ));
  r := public.__t_try($q$SELECT public.studio_edges_set('client_text_approval', '[{"to":"nowhere"}]'::jsonb)$q$);
  ASSERT r LIKE '23514:%', 'هدف مجهول عدّى';
  -- (الفشل ماأثرش على القايمة: الدالة في معاملة جملة واحدة)
  SELECT count(*) INTO n FROM public.task_edges WHERE line = 'studio' AND from_step = 'client_text_approval';
  ASSERT n = 2, 'فشل التحرير مسح الانتقالات: ' || n;
  PERFORM public.studio_edges_set('client_text_approval', jsonb_build_array(
    jsonb_build_object('to', 'text_draft', 'who', 'owner'),
    jsonb_build_object('to', v_x, 'who', 'manager', 'skipGates', true)
  ));
  UPDATE public.story_projects SET status = v_x WHERE id = v_proj;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT status FROM public.story_projects WHERE id = v_proj) = v_x, 'الانتقال المضاف ماشتغلش';

  -- ── ٦) تعطيل مرحلة بيتخطّاها «للأمام» ─────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET status = 'client_text_approval' WHERE id = v_proj;  -- للأمام (الشرط متحقق)
  EXECUTE 'RESET ROLE';
  -- المشروع بره المرحلة الجديدة فينفع تتعطّل.
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.studio_stage_flow(v_x, false, ARRAY['text'], ARRAY[]::text[], 'owner');
  EXECUTE 'RESET ROLE';
  ASSERT public.task_next_step('studio', 'text_review') = 'client_text_approval', 'التعطيل ماتخطّاش المرحلة';
  ASSERT NOT (SELECT allowed FROM public.story_transition_rule('text_review', v_x, NULL)), 'مرحلة معطّلة هدف';
  -- حذفها دلوقتي مسموح (مفيش مشاريع)، والتوزيع بتاعها بيتشال معاها.
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.studio_stage_delete(v_x);
  EXECUTE 'RESET ROLE';
  ASSERT NOT EXISTS (SELECT 1 FROM public.task_steps WHERE line = 'studio' AND step = v_x), 'المرحلة لسه موجودة';
  ASSERT NOT EXISTS (SELECT 1 FROM public.assignment_rules WHERE line = 'studio' AND stage = v_x), 'توزيعها فضل';
  ASSERT NOT EXISTS (SELECT 1 FROM public.task_edges WHERE line = 'studio' AND (from_step = v_x OR to_step = v_x)),
    'انتقالاتها فضلت';
  ASSERT public.task_next_step('studio', 'text_review') = 'client_text_approval', 'التسلسل بعد الحذف';

  -- ── ٧) حالة مجهولة على المشروع ترفضها القاعدة ──────────────────────────────
  r := public.__t_try(format($q$UPDATE public.story_projects SET status = 'bogus' WHERE id = %L$q$, v_proj));
  ASSERT r IS NOT NULL, 'حالة مجهولة عدّت';

  -- ── ٨) تطبيق قاعدة التوزيع على المهام المفتوحة ─────────────────────────────
  DELETE FROM public.assignment_rules WHERE line = 'studio' AND stage = 'client_text_approval';
  INSERT INTO public.assignment_rules(line, stage, profile_id) VALUES ('studio', 'client_text_approval', v_plain);
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  n := public.task_rule_apply('studio', 'client_text_approval');
  EXECUTE 'RESET ROLE';
  ASSERT n = 1, 'عدد المهام المتغيّرة: ' || n;
  ASSERT (SELECT assignee_ids FROM public.work_tasks WHERE line = 'studio' AND source_id = v_proj::text) = ARRAY[v_plain],
    'التطبيق ماغيّرش المسؤول';
  PERFORM set_config('request.jwt.claim.sub', v_plain::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try($q$SELECT public.task_rule_apply('studio', 'client_text_approval')$q$);
  EXECUTE 'RESET ROLE';
  ASSERT r LIKE '42501:%', 'التطبيق من غير صلاحية عدّى';

  -- ── ٩) استثناء المشروع يغلب قاعدة المرحلة ─────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET editor_id = v_worker WHERE id = v_proj;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT assignee_ids FROM public.work_tasks WHERE line = 'studio' AND source_id = v_proj::text) = ARRAY[v_worker],
    'المحرر المعيّن على المشروع لازم يغلب قاعدة المرحلة';

  -- ── ١٠) رحلة الطلب: مدير الطلبات يشوف الحالة من غير ما يشوف المشروع نفسه ──
  PERFORM set_config('request.jwt.claim.sub', v_orders::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.story_projects;
  ASSERT n = 0, 'مدير الطلبات شاف جدول المشاريع مباشرة';
  SELECT count(*) INTO n FROM public.order_studio_projects(v_order);
  ASSERT n = 1, 'مدير الطلبات ماشافش حالة المشروع في رحلة الطلب: ' || n;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_customer::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.order_studio_projects(v_order);
  ASSERT n = 0, 'عميل شاف مشاريع الاستوديو في رحلة الطلب';
  EXECUTE 'RESET ROLE';

  -- ── ١١) إنشاء مشروع جديد يبدأ من مرحلة «start» ────────────────────────────
  ASSERT (SELECT step FROM public.task_steps WHERE line = 'studio' AND kind = 'start') = 'brief', 'مرحلة البداية';

  RAISE NOTICE 'workflow_engine: OK';
END
$$;

ROLLBACK;
