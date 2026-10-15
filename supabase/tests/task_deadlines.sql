-- مهام الإدارة (٣) — اختبار المواعيد وسجل التطورات وكتالوج المراحل وفحص الإشعارات.
-- يتشغّل على قاعدة محلية أو staging بعد migrations: 14 + story_studio_foundation +
-- story_studio_tasks_backfill + task_deadlines_stage_catalog.
-- كل البيانات بتتراجع (ROLLBACK). مايتشغّلش على production.
--
-- التشغيل: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/task_deadlines.sql
-- النجاح: بيطبع «task_deadlines: OK».
BEGIN;

CREATE FUNCTION public.__t_try(q text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE q;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ':' || SQLERRM;
END
$f$;
GRANT EXECUTE ON FUNCTION public.__t_try(text) TO authenticated, anon;

DO $$
DECLARE
  v_boss     uuid := gen_random_uuid();   -- مدير نظام
  v_sup      uuid := gen_random_uuid();   -- مشرف (الدور الافتراضي: توزيع المهام)
  v_sup_off  uuid := gen_random_uuid();   -- مشرف موقوف (مايوصلوش إشعارات)
  v_acct     uuid := gen_random_uuid();   -- محاسب (من غير توزيع المهام)
  v_editor   uuid := gen_random_uuid();
  v_manager  uuid := gen_random_uuid();   -- مسؤول إنتاج القصص
  v_customer uuid := gen_random_uuid();
  v_role_acct uuid; v_role_edt uuid; v_role_mgr uuid;
  v_prod text := 'td-custom-' || substr(gen_random_uuid()::text, 1, 8);
  o1 uuid := gen_random_uuid(); o2 uuid := gen_random_uuid(); o3 uuid := gen_random_uuid();
  o_story uuid := gen_random_uuid(); i_story uuid := gen_random_uuid();
  t work_tasks; t2 work_tasks; t3 work_tasks; t4 work_tasks; t5 work_tasks;
  p_story uuid;
  n integer; r text; j jsonb; x timestamptz;
BEGIN
  SELECT id INTO v_role_acct FROM public.admin_roles WHERE name = 'محاسب';
  SELECT id INTO v_role_edt  FROM public.admin_roles WHERE name = 'محرر قصص';
  SELECT id INTO v_role_mgr  FROM public.admin_roles WHERE name = 'مسؤول إنتاج القصص';

  INSERT INTO public.user_profiles(id, full_name, role, admin_role_id, suspended_at) VALUES
    (v_boss,    'TD Boss',    'super_admin',        NULL,       NULL),
    (v_sup,     'TD Sup',     'general_supervisor', NULL,       NULL),
    (v_sup_off, 'TD Sup Off', 'general_supervisor', NULL,       now()),
    (v_acct,    'TD Acct',    'general_supervisor', v_role_acct, NULL),
    (v_editor,  'TD Editor',  'general_supervisor', v_role_edt, NULL),
    (v_manager, 'TD Manager', 'general_supervisor', v_role_mgr, NULL),
    (v_customer,'عميل',       'customer',           NULL,       NULL);

  -- ── ١) الكتالوج ─────────────────────────────────────────────────────────
  ASSERT (SELECT count(*) FROM public.task_steps WHERE line = 'studio') = 11, 'مراحل الاستوديو لازم ١١';
  ASSERT (SELECT count(*) FROM public.task_steps WHERE line = 'enha_lak' AND step IN ('payment','fulfilment','paid','preparing','shipped')) = 5,
    'مراحل «إنها لك» ناقصة';
  ASSERT (SELECT sla_hours FROM public.task_steps WHERE line = 'studio' AND step = 'on_hold') IS NULL,
    'الإيقاف لازم من غير مهلة';

  r := public.__t_try($q$INSERT INTO public.task_steps(line, step, label, owner_kind) VALUES ('studio', 'zz1', 'اسم', 'rule')$q$);
  ASSERT r LIKE '23514:%', 'مرحلة استوديو بمالك rule عدّت: ' || coalesce(r, 'نجح');
  r := public.__t_try($q$INSERT INTO public.task_steps(line, step, label, owner_kind) VALUES ('enha_lak', 'zz2', 'اسم', 'editor')$q$);
  ASSERT r LIKE '23514:%', 'مرحلة طلبات بمالك editor عدّت: ' || coalesce(r, 'نجح');
  r := public.__t_try($q$INSERT INTO public.task_steps(line, step, label, sla_hours) VALUES ('box', 'zz3', 'اسم', 0)$q$);
  ASSERT r LIKE '23514:%', 'مهلة صفر عدّت: ' || coalesce(r, 'نجح');
  r := public.__t_try($q$INSERT INTO public.task_steps(line, step, label) VALUES ('box', 'zz4', 'ا')$q$);
  ASSERT r LIKE '23514:%', 'اسم من حرف واحد عدّى: ' || coalesce(r, 'نجح');

  -- صلاحيات التعديل.
  PERFORM set_config('request.jwt.claim.sub', v_acct::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.task_steps SET sla_hours = 5 WHERE line = 'enha_lak' AND step = 'payment';
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  ASSERT n = 0, 'محاسب من غير توزيع المهام عدّل الكتالوج';

  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.task_steps SET sla_hours = 5 WHERE line = 'studio' AND step = 'qa';
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  ASSERT n = 0, 'محرر قصص عدّل الكتالوج';

  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.task_steps SET sla_hours = 6 WHERE line = 'studio' AND step = 'qa';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 1, 'مسؤول الإنتاج ماقدرش يعدّل مرحلة استوديو';
  UPDATE public.task_steps SET sla_hours = 6 WHERE line = 'enha_lak' AND step = 'paid';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'مسؤول الإنتاج عدّل مرحلة طلبات';
  r := public.__t_try($q$UPDATE public.task_steps SET line = 'box' WHERE line = 'studio' AND step = 'qa'$q$);
  ASSERT r LIKE '42501:%', 'تغيير مفتاح المرحلة عدّى: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT updated_by FROM public.task_steps WHERE line = 'studio' AND step = 'qa') = v_manager, 'updated_by مش متسجّل';
  UPDATE public.task_steps SET sla_hours = 24 WHERE line = 'studio' AND step = 'qa';

  PERFORM set_config('request.jwt.claim.sub', v_sup::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.task_steps SET sla_hours = 24 WHERE line = 'enha_lak' AND step = 'paid';
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  ASSERT n = 1, 'حامل توزيع المهام ماقدرش يعدّل الكتالوج';

  EXECUTE 'SET LOCAL ROLE anon';
  r := public.__t_try('SELECT count(*) FROM public.task_steps');
  EXECUTE 'RESET ROLE';
  ASSERT r LIKE '42501:%', 'الزائر قرأ الكتالوج: ' || coalesce(r, 'نجح');

  -- ── ٢) مسار طلب «إنها لك» كامل ──────────────────────────────────────────
  INSERT INTO public.orders(id, user_id, total_amount, status, payment_reference) VALUES (o1, v_customer, 100, 'pending', 'TD-1');
  UPDATE public.orders SET status = 'awaiting_verification' WHERE id = o1;
  SELECT * INTO t FROM public.work_tasks WHERE line = 'enha_lak' AND source_id = o1::text AND stage = 'payment';
  ASSERT t.status = 'open' AND t.step = 'payment', 'مهمة الدفع: ' || coalesce(t.step, 'null');
  ASSERT abs(extract(epoch FROM (t.due_at - t.step_changed_at)) - 24 * 3600) < 2, 'موعد مراجعة الدفع لازم ٢٤ ساعة';
  ASSERT t.priority = 'normal', 'الأولوية الافتراضية';
  ASSERT EXISTS (SELECT 1 FROM public.work_task_events WHERE task_id = t.id AND kind = 'created' AND to_value = 'payment'),
    'حدث الإنشاء ناقص';

  UPDATE public.orders SET status = 'paid' WHERE id = o1;
  SELECT * INTO t FROM public.work_tasks WHERE id = t.id;
  ASSERT t.status = 'done', 'مهمة الدفع ماتقفلتش';
  ASSERT EXISTS (SELECT 1 FROM public.work_task_events WHERE task_id = t.id AND kind = 'done' AND to_value = 'on_time'),
    'حدث الإنجاز في الميعاد ناقص';
  SELECT * INTO t2 FROM public.work_tasks WHERE line = 'enha_lak' AND source_id = o1::text AND stage = 'fulfilment';
  ASSERT t2.status = 'open' AND t2.step = 'paid', 'مرحلة التنفيذ: ' || coalesce(t2.step, 'null');
  ASSERT abs(extract(epoch FROM (t2.due_at - t2.step_changed_at)) - 24 * 3600) < 2, 'مهلة «بانتظار التجهيز» ٢٤ ساعة';

  -- (كل الاختبار في معاملة واحدة، فنرجّع وقت دخول المرحلة ساعة لورا عشان الفرق يبان.)
  UPDATE public.work_tasks SET step_changed_at = now() - interval '1 hour' WHERE id = t2.id;
  x := now() - interval '1 hour';
  UPDATE public.orders SET status = 'preparing' WHERE id = o1;
  SELECT * INTO t2 FROM public.work_tasks WHERE id = t2.id;
  ASSERT t2.step = 'preparing', 'المرحلة ماتحدّثتش على مهمة مفتوحة: ' || t2.step;
  ASSERT t2.step_changed_at > x, 'وقت دخول المرحلة ماتحدّثش';
  ASSERT abs(extract(epoch FROM (t2.due_at - t2.step_changed_at)) - 72 * 3600) < 2, 'مهلة «قيد التجهيز» ٧٢ ساعة';
  ASSERT EXISTS (SELECT 1 FROM public.work_task_events WHERE task_id = t2.id AND kind = 'step' AND from_value = 'paid' AND to_value = 'preparing'),
    'حدث تغيّر المرحلة ناقص';
  ASSERT NOT EXISTS (SELECT 1 FROM public.work_task_events WHERE task_id = t2.id AND kind = 'due'),
    'تغيّر الموعد مع المرحلة اتسجّل كتعديل يدوي';

  UPDATE public.orders SET status = 'shipped' WHERE id = o1;
  SELECT * INTO t2 FROM public.work_tasks WHERE id = t2.id;
  ASSERT t2.step = 'shipped' AND abs(extract(epoch FROM (t2.due_at - t2.step_changed_at)) - 120 * 3600) < 2, 'مهلة الشحن ١٢٠ ساعة';
  UPDATE public.orders SET status = 'delivered' WHERE id = o1;
  SELECT * INTO t2 FROM public.work_tasks WHERE id = t2.id;
  ASSERT t2.status = 'done' AND t2.done_at IS NOT NULL, 'التنفيذ ماتقفلش عند التسليم';
  ASSERT (SELECT count(*) FROM public.work_task_events WHERE task_id = t2.id) >= 4, 'سجل المسار ناقص';

  -- إيصال اترفض واترفع تاني ← نفس المهمة بتتفتح بموعد جديد.
  INSERT INTO public.orders(id, user_id, total_amount, status, payment_reference) VALUES (o2, v_customer, 100, 'pending', 'TD-2');
  UPDATE public.orders SET status = 'awaiting_verification' WHERE id = o2;
  UPDATE public.orders SET status = 'pending' WHERE id = o2;
  SELECT * INTO t3 FROM public.work_tasks WHERE line = 'enha_lak' AND source_id = o2::text AND stage = 'payment';
  ASSERT t3.status = 'done', 'مهمة الدفع المرفوض ماتقفلتش';
  UPDATE public.work_tasks SET soon_notified_at = now() - interval '1 day', overdue_notified_at = now() - interval '1 day',
         step_changed_at = now() - interval '2 days', due_at = now() - interval '1 day' WHERE id = t3.id;
  SELECT count(*) INTO n FROM public.work_task_events WHERE task_id = t3.id AND kind = 'due';
  UPDATE public.orders SET status = 'awaiting_verification' WHERE id = o2;
  SELECT * INTO t3 FROM public.work_tasks WHERE id = t3.id;
  ASSERT t3.status = 'open' AND t3.due_at > now() + interval '23 hours', 'الموعد ماتحسبش من جديد عند إعادة الفتح';
  ASSERT t3.soon_notified_at IS NULL AND t3.overdue_notified_at IS NULL, 'علامات الإشعار ماتصفّرتش';
  ASSERT EXISTS (SELECT 1 FROM public.work_task_events WHERE task_id = t3.id AND kind = 'reopened'), 'حدث إعادة الفتح ناقص';
  ASSERT (SELECT count(*) FROM public.work_task_events WHERE task_id = t3.id AND kind = 'due') = n, 'إعادة الفتح اتسجّلت كتعديل موعد يدوي';

  -- ── ٣) الحارس ───────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_acct::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format('UPDATE public.work_tasks SET due_at = now() + interval ''5 days'' WHERE id = %L', t3.id));
  ASSERT r LIKE '42501:%', 'محاسب غيّر الموعد: ' || coalesce(r, 'نجح');
  r := public.__t_try(format('UPDATE public.work_tasks SET priority = ''urgent'' WHERE id = %L', t3.id));
  ASSERT r LIKE '42501:%', 'محاسب غيّر الأولوية: ' || coalesce(r, 'نجح');
  r := public.__t_try(format('UPDATE public.work_tasks SET assignee_ids = ARRAY[%L]::uuid[] WHERE id = %L', v_acct, t3.id));
  ASSERT r LIKE '42501:%', 'محاسب غيّر المسؤول: ' || coalesce(r, 'نجح');
  r := public.__t_try(format('UPDATE public.work_tasks SET step = ''shipped'' WHERE id = %L', t3.id));
  ASSERT r LIKE '42501:%', 'مستخدم غيّر المرحلة: ' || coalesce(r, 'نجح');
  r := public.__t_try(format('UPDATE public.work_tasks SET overdue_notified_at = now() WHERE id = %L', t3.id));
  ASSERT r LIKE '42501:%', 'مستخدم لمس علامة الإشعار: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_sup::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.work_tasks SET due_at = now() + interval '5 days', priority = 'urgent', assignee_ids = ARRAY[v_acct] WHERE id = t3.id;
  EXECUTE 'RESET ROLE';
  SELECT * INTO t3 FROM public.work_tasks WHERE id = t3.id;
  ASSERT t3.priority = 'urgent' AND t3.assignee_ids = ARRAY[v_acct], 'حامل التوزيع ماقدرش يعدّل';
  ASSERT EXISTS (SELECT 1 FROM public.work_task_events WHERE task_id = t3.id AND kind = 'due' AND actor_id = v_sup), 'حدث تغيير الموعد ناقص';
  ASSERT EXISTS (SELECT 1 FROM public.work_task_events WHERE task_id = t3.id AND kind = 'priority' AND from_value = 'normal' AND to_value = 'urgent' AND actor_id = v_sup),
    'حدث الأولوية ناقص';
  ASSERT EXISTS (SELECT 1 FROM public.work_task_events WHERE task_id = t3.id AND kind = 'assigned' AND to_value = v_acct::text AND actor_id = v_sup),
    'حدث التسنيد ناقص';
  r := public.__t_try(format('UPDATE public.work_tasks SET priority = ''bogus'' WHERE id = %L', t3.id));
  ASSERT r LIKE '23514:%', 'أولوية مجهولة عدّت';

  -- «تم» بالإيد لأي إداري (زي completeWorkTask).
  PERFORM set_config('request.jwt.claim.sub', v_acct::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.work_tasks SET status = 'done', done_at = now(), done_by = v_acct WHERE id = t3.id AND status = 'open';
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  ASSERT n = 1, 'إداري ماقدرش يقفل مهمته';
  ASSERT EXISTS (SELECT 1 FROM public.work_task_events WHERE task_id = t3.id AND kind = 'done' AND actor_id = v_acct AND to_value = 'on_time'),
    'حدث الإنجاز بالإيد ناقص';
  -- مهمة خلصت بعد الموعد.
  UPDATE public.work_tasks SET status = 'open', done_at = NULL, done_by = NULL WHERE id = t3.id;
  UPDATE public.work_tasks SET due_at = now() - interval '1 hour' WHERE id = t3.id;
  UPDATE public.work_tasks SET status = 'done', done_at = now(), done_by = v_acct WHERE id = t3.id;
  ASSERT (SELECT to_value FROM public.work_task_events WHERE task_id = t3.id AND kind = 'done' ORDER BY id DESC LIMIT 1) = 'late',
    'إنجاز متأخر ماتسجّلش late';

  -- ── ٤) ملاحظات الإدارة ──────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_acct::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.work_task_events(task_id, kind, actor_id, note) VALUES (t3.id, 'note', v_acct, 'بانتظار رد العميل');
  r := public.__t_try(format($q$INSERT INTO public.work_task_events(task_id, kind, actor_id, note) VALUES (%L, 'note', %L, 'مزوّرة')$q$, t3.id, v_boss));
  ASSERT r LIKE '42501:%', 'ملاحظة باسم غيره عدّت: ' || coalesce(r, 'نجح');
  r := public.__t_try(format($q$INSERT INTO public.work_task_events(task_id, kind, actor_id, to_value) VALUES (%L, 'done', %L, 'on_time')$q$, t3.id, v_acct));
  ASSERT r LIKE '42501:%', 'إدراج حدث غير ملاحظة عدّى: ' || coalesce(r, 'نجح');
  r := public.__t_try(format($q$INSERT INTO public.work_task_events(task_id, kind, actor_id, note) VALUES (%L, 'note', %L, '   ')$q$, t3.id, v_acct));
  ASSERT r LIKE '42501:%', 'ملاحظة فاضية عدّت: ' || coalesce(r, 'نجح');
  r := public.__t_try(format($q$UPDATE public.work_task_events SET note = 'x' WHERE task_id = %L$q$, t3.id));
  ASSERT r LIKE '42501:%', 'تعديل سجل: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_customer::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.work_task_events;
  EXECUTE 'RESET ROLE';
  ASSERT n = 0, 'عميل قرا سجل المهام';

  -- ── ٥) فحص المواعيد ─────────────────────────────────────────────────────
  DELETE FROM public.notifications;
  -- فات الموعد (فيه مسؤول).
  INSERT INTO public.work_tasks(line, stage, source_id, title, link, assignee_ids)
    VALUES ('services', 'fulfilment', 's-over', 'خدمة متأخرة', '/x', ARRAY[v_acct]) RETURNING * INTO t4;
  UPDATE public.work_tasks SET step_changed_at = now() - interval '5 days', due_at = now() - interval '1 hour' WHERE id = t4.id;
  -- قرب الموعد (فيه مسؤول): نافذة ٢٤ ساعة، فاضل ٣.
  INSERT INTO public.work_tasks(line, stage, source_id, title, link, assignee_ids)
    VALUES ('services', 'fulfilment', 's-soon', 'خدمة قربت', '/x', ARRAY[v_acct]) RETURNING * INTO t5;
  UPDATE public.work_tasks SET step_changed_at = now() - interval '21 hours', due_at = now() + interval '3 hours' WHERE id = t5.id;
  -- نافذة قصيرة: ٢٥٪ منها أقل من ساعتين ← الحد الأدنى ساعتان (فاضل ساعة ونص).
  INSERT INTO public.work_tasks(line, stage, source_id, title, link, assignee_ids)
    VALUES ('services', 'fulfilment', 's-min', 'خدمة نافذة قصيرة', '/x', ARRAY[v_acct]);
  UPDATE public.work_tasks SET step_changed_at = now() - interval '1 hour', due_at = now() + interval '90 minutes' WHERE source_id = 's-min';
  -- لسه بعيد.
  INSERT INTO public.work_tasks(line, stage, source_id, title, link, assignee_ids)
    VALUES ('services', 'fulfilment', 's-far', 'خدمة بعيدة', '/x', ARRAY[v_acct]);
  UPDATE public.work_tasks SET step_changed_at = now() - interval '4 hours', due_at = now() + interval '20 hours' WHERE source_id = 's-far';
  -- قربت من غير مسؤول ← للمديرين.
  INSERT INTO public.work_tasks(line, stage, source_id, title, link)
    VALUES ('box', 'fulfilment', 'b-none', 'صندوق من غير مسؤول', '/x');
  UPDATE public.work_tasks SET step_changed_at = now() - interval '10 hours', due_at = now() + interval '1 hour' WHERE source_id = 'b-none';
  -- مقفولة وموعدها فات ← ولا إشعار.
  INSERT INTO public.work_tasks(line, stage, source_id, title, link, status, done_at)
    VALUES ('services', 'payment', 's-done', 'خدمة مقفولة', '/x', 'done', now());
  UPDATE public.work_tasks SET due_at = now() - interval '2 days' WHERE source_id = 's-done';

  j := public.work_tasks_deadline_sweep();
  ASSERT (j ->> 'overdue')::int = 1 AND (j ->> 'soon')::int = 3, 'نتيجة الفحص: ' || j::text;
  ASSERT (SELECT count(*) FROM public.notifications WHERE title = '⏰ قرب موعد: خدمة نافذة قصيرة') = 1,
    'الحد الأدنى ساعتين للتنبيه ماشتغلش';

  -- المتأخرة: المسؤول + المديرين (مدير النظام + حامل التوزيع)، مش الموقوف ولا المحاسب غير المسؤول.
  SELECT count(*) INTO n FROM public.notifications WHERE title = '⚠ فات موعد: خدمة متأخرة';
  ASSERT n = 3, 'إشعارات التأخر لازم ٣ (المسؤول + مدير النظام + المشرف): ' || n;
  ASSERT EXISTS (SELECT 1 FROM public.notifications WHERE title LIKE '⚠%' AND recipient_profile_id = v_acct::text), 'المسؤول ماوصلوش';
  ASSERT EXISTS (SELECT 1 FROM public.notifications WHERE title LIKE '⚠%' AND recipient_profile_id = v_boss::text), 'مدير النظام ماوصلوش';
  ASSERT EXISTS (SELECT 1 FROM public.notifications WHERE title LIKE '⚠%' AND recipient_profile_id = v_sup::text), 'المشرف ماوصلوش';
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE recipient_profile_id = v_sup_off::text), 'موقوف وصله إشعار';
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE recipient_profile_id IN (v_editor::text, v_customer::text)),
    'إشعار وصل لمن ليس مسؤولًا ولا مديرًا';
  ASSERT (SELECT link FROM public.notifications WHERE title LIKE '⚠%' LIMIT 1) = '/dashboard/admin/tasks/' || t4.id::text, 'رابط الإشعار';

  -- قرب الموعد: للمسؤول بس؛ ومن غير مسؤول للمديرين.
  ASSERT (SELECT count(*) FROM public.notifications WHERE title = '⏰ قرب موعد: خدمة قربت') = 1
     AND EXISTS (SELECT 1 FROM public.notifications WHERE title = '⏰ قرب موعد: خدمة قربت' AND recipient_profile_id = v_acct::text),
    'إشعار الاقتراب لازم للمسؤول بس';
  ASSERT (SELECT count(*) FROM public.notifications WHERE title = '⏰ قرب موعد: صندوق من غير مسؤول') = 2, 'من غير مسؤول لازم للمديرين';
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE title LIKE '%خدمة بعيدة%'), 'إشعار على مهمة بعيدة';
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE title LIKE '%خدمة مقفولة%'), 'إشعار على مهمة مقفولة';
  ASSERT NOT EXISTS (SELECT 1 FROM public.notifications WHERE title LIKE '⏰%' AND title LIKE '%متأخرة%'), 'المتأخرة اتبعتلها «قرب» كمان';

  -- مرة واحدة بس.
  SELECT count(*) INTO n FROM public.notifications;
  j := public.work_tasks_deadline_sweep();
  ASSERT (j ->> 'overdue')::int = 0 AND (j ->> 'soon')::int = 0, 'الفحص التاني كرّر: ' || j::text;
  ASSERT (SELECT count(*) FROM public.notifications) = n, 'إشعارات مكرّرة';
  ASSERT (SELECT count(*) FROM public.work_task_events WHERE task_id = t4.id AND kind = 'reminder_overdue') = 1, 'حدث التذكير مكرّر';

  -- القرب ثم الفوات: بعد ما الموعد يعدّي بتتبعت «فات» (مرحلة تانية).
  UPDATE public.work_tasks SET due_at = now() - interval '1 minute' WHERE id = t5.id;
  j := public.work_tasks_deadline_sweep();
  ASSERT (j ->> 'overdue')::int = 1, 'بعد القرب مابعتش «فات»: ' || j::text;
  -- تعديل الموعد بالإيد يصفّر العلامات فيتبعت تذكير جديد.
  UPDATE public.work_tasks SET due_at = now() + interval '30 days' WHERE id = t5.id;
  ASSERT (SELECT overdue_notified_at IS NULL AND soon_notified_at IS NULL FROM public.work_tasks WHERE id = t5.id),
    'علامات الإشعار ماتصفّرتش مع موعد جديد';

  -- الفحص من الشاشة: مقيّد.
  UPDATE public.work_task_sweeps SET last_run = 'epoch';
  PERFORM set_config('request.jwt.claim.sub', v_customer::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  ASSERT public.work_tasks_sweep_if_due() IS NULL, 'عميل شغّل الفحص';
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT last_run FROM public.work_task_sweeps) = 'epoch', 'عميل حدّث وقت الفحص';
  PERFORM set_config('request.jwt.claim.sub', v_boss::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  ASSERT public.work_tasks_sweep_if_due() IS NOT NULL, 'الفحص الأول من الشاشة ماشتغلش';
  ASSERT public.work_tasks_sweep_if_due() IS NULL, 'الفحص التاني خلال ١٠ دقايق اتنفّذ';
  r := public.__t_try('SELECT public.work_tasks_deadline_sweep()');
  ASSERT r LIKE '42501:%', 'الفحص المباشر متاح للمستخدم: ' || coalesce(r, 'نجح');
  r := public.__t_try('SELECT public.work_task_managers(''box'')');
  ASSERT r LIKE '42501:%', 'دالة المديرين متاحة للمستخدم: ' || coalesce(r, 'نجح');
  r := public.__t_try('SELECT public.task_due_for(''box'', ''paid'', ''fulfilment'', now())');
  ASSERT r LIKE '42501:%', 'حساب الموعد متاح للمستخدم: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  -- ── ٦) الاستوديو: المرحلة والموعد والصاحب من الكتالوج ─────────────────────
  INSERT INTO public.personalized_products(id, slug, name, category, price) VALUES (v_prod, v_prod, 'قصة', 'custom', 100);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  ALTER TABLE public.orders DISABLE TRIGGER validate_order_state_transition_trg;
  ALTER TABLE public.orders DISABLE TRIGGER guard_order_fields_trg;
  INSERT INTO public.orders(id, user_id, total_amount, status, payment_reference) VALUES (o_story, v_customer, 100, 'paid', 'TD-ST');
  INSERT INTO public.order_items(id, order_id, product_id, quantity, unit_price, customization_data)
    VALUES (i_story, o_story, v_prod, 1, 100, jsonb_build_object('childName', 'سلمى'));
  PERFORM public.story_backfill_core();
  SELECT id INTO p_story FROM public.story_projects WHERE order_item_id = i_story;
  SELECT * INTO t FROM public.work_tasks WHERE line = 'studio' AND source_id = p_story::text;
  ASSERT t.step = 'brief', 'مرحلة مهمة الاستوديو: ' || coalesce(t.step, 'null');
  ASSERT abs(extract(epoch FROM (t.due_at - t.step_changed_at)) - 24 * 3600) < 2, 'مهلة «الطلب» ٢٤ ساعة';

  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET editor_id = v_editor WHERE id = p_story;
  UPDATE public.story_projects SET status = 'text_draft' WHERE id = p_story;
  EXECUTE 'RESET ROLE';
  SELECT * INTO t FROM public.work_tasks WHERE id = t.id;
  ASSERT t.step = 'text_draft' AND t.assignee_ids = ARRAY[v_editor], 'نقل المشروع ماحدّثش المهمة';
  ASSERT abs(extract(epoch FROM (t.due_at - t.step_changed_at)) - 48 * 3600) < 2, 'مهلة «كتابة النص» ٤٨ ساعة';
  ASSERT EXISTS (SELECT 1 FROM public.work_task_events WHERE task_id = t.id AND kind = 'step' AND to_value = 'text_draft'), 'حدث مرحلة الاستوديو ناقص';

  -- الإيقاف: من غير موعد.
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET status = 'on_hold' WHERE id = p_story;
  EXECUTE 'RESET ROLE';
  SELECT * INTO t FROM public.work_tasks WHERE id = t.id;
  ASSERT t.step = 'on_hold' AND t.due_at IS NULL, 'الإيقاف لازم من غير موعد: ' || coalesce(t.due_at::text, 'null');
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET status = 'text_draft' WHERE id = p_story;
  EXECUTE 'RESET ROLE';
  SELECT * INTO t FROM public.work_tasks WHERE id = t.id;
  ASSERT t.step = 'text_draft' AND t.due_at > now() + interval '47 hours', 'الاستئناف ماحسبش موعد جديد';

  -- تعديل الكتالوج: الاسم والصاحب.
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.task_steps SET label = 'صياغة النص', owner_kind = 'manager' WHERE line = 'studio' AND step = 'text_draft';
  EXECUTE 'RESET ROLE';
  SELECT * INTO t FROM public.work_tasks WHERE id = t.id;
  ASSERT t.title LIKE '%صياغة النص', 'الاسم الجديد ماوصلش لعنوان المهمة: ' || t.title;
  ASSERT t.assignee_ids = ARRAY[v_manager], 'تغيير الصاحب ماوصلش للمهمة المفتوحة: ' || t.assignee_ids::text;
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.task_steps SET label = 'كتابة النص', owner_kind = 'editor' WHERE line = 'studio' AND step = 'text_draft';
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT assignee_ids FROM public.work_tasks WHERE id = t.id) = ARRAY[v_editor], 'رجوع الصاحب ماشتغلش';

  -- ── ٧) الأعطال ماتكسرش العمليات الأصلية ─────────────────────────────────
  ALTER TABLE public.task_steps RENAME TO task_steps_x;
  INSERT INTO public.orders(id, user_id, total_amount, status, payment_reference) VALUES (o3, v_customer, 100, 'pending', 'TD-3');
  UPDATE public.orders SET status = 'awaiting_verification' WHERE id = o3;
  ASSERT (SELECT status::text FROM public.orders WHERE id = o3) = 'awaiting_verification', 'عطل الكتالوج كسر حالة الطلب';
  SELECT * INTO t FROM public.work_tasks WHERE source_id = o3::text AND stage = 'payment';
  ASSERT t.id IS NOT NULL AND t.due_at IS NULL, 'المهمة لازم تتعمل من غير موعد لو الكتالوج واقع';
  ALTER TABLE public.task_steps_x RENAME TO task_steps;

  ALTER TABLE public.work_task_events RENAME TO work_task_events_x;
  UPDATE public.orders SET status = 'paid' WHERE id = o3;
  ASSERT (SELECT status::text FROM public.orders WHERE id = o3) = 'paid', 'عطل السجل كسر حالة الطلب';
  ASSERT (SELECT status FROM public.work_tasks WHERE id = t.id) = 'done', 'عطل السجل منع قفل المهمة';
  ALTER TABLE public.work_task_events_x RENAME TO work_task_events;

  -- ── ٨) النسخة القديمة من work_task_open اتشالت ──────────────────────────
  ASSERT (SELECT count(*) FROM pg_proc WHERE proname = 'work_task_open' AND pronamespace = 'public'::regnamespace) = 1,
    'work_task_open لازم نسخة واحدة';
  ASSERT (SELECT pronargs FROM pg_proc WHERE proname = 'work_task_open' AND pronamespace = 'public'::regnamespace) = 8, 'عدد البارامترات';

  RAISE NOTICE 'task_deadlines: OK';
END
$$;

ROLLBACK;
