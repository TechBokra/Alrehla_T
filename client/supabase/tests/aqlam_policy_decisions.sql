-- أقلام الرحلة — اختبار قرارات السياسة: حد البلاغات ٥، مسح المشال بعد ٧ أيام،
-- وطلب ولي الأمر لقفل التعليقات. بيفترض إن كل migrations أقلام الرحلة لحد
-- `20261017180000_aqlam_policy_decisions.sql` متطبّقة. كل البيانات بتتراجع (ROLLBACK).
--
-- التشغيل: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/aqlam_policy_decisions.sql
-- النجاح: بيطبع «aqlam_policy_decisions: OK».
BEGIN;

DO $$
DECLARE
  v_admin  uuid := gen_random_uuid();
  v_guard  uuid := gen_random_uuid();
  v_other_guard uuid := gen_random_uuid();
  v_teen   uuid := gen_random_uuid();
  v_writer uuid := gen_random_uuid();
  v_reader uuid := gen_random_uuid();
  v_reps   uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_text   text := 'كان يا ما كان في قرية صغيرة بنت اسمها نور وكانت بتحب الغيم';
  v_teen_child text := 'aq3-teen-' || substr(gen_random_uuid()::text, 1, 8);
  r        jsonb;
  v_post   uuid;
  v_post2  uuid;
  v_teen_post uuid;
  v_comment uuid;
  v_req    uuid;
  v_i      integer;
  v_role   text;
BEGIN
  INSERT INTO public.user_profiles(id, full_name, role) VALUES
    (v_admin, 'Admin', 'super_admin'),
    (v_guard, 'ولي أمر', 'customer'),
    (v_other_guard, 'ولي أمر تاني', 'customer'),
    (v_teen, 'سلمى أحمد', 'student'),
    (v_writer, 'كاتب', 'customer'),
    (v_reader, 'قارئ', 'customer');
  FOR v_i IN 1..5 LOOP
    INSERT INTO public.user_profiles(id, full_name, role) VALUES (v_reps[v_i], 'مُبلّغ ' || v_i, 'customer');
  END LOOP;
  INSERT INTO public.child_profiles(id, user_profile_id, full_name, birth_date, account_profile_id) VALUES
    (v_teen_child, v_guard, 'سلمى أحمد', (current_date - interval '14 years')::date, v_teen::text);

  DELETE FROM public.site_settings WHERE key = 'general';
  INSERT INTO public.site_settings(key, value) VALUES ('general', jsonb_build_object('aqlamMode', 'public'));

  -- ── ١) البلاغات: الإخفاء التلقائي عند ٥ مش ٣ ──────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_writer::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('غيمة', v_text, 'story', 'pen_name', 'قمر الليل', false, true, NULL,
         (current_date - interval '30 years')::date, 'v1');
  ASSERT (r->>'ok')::boolean, 'نشر: ' || r::text;
  v_post := (r->>'id')::uuid;
  EXECUTE 'RESET ROLE';

  FOR v_i IN 1..4 LOOP
    PERFORM set_config('request.jwt.claim.sub', v_reps[v_i]::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    r := public.aqlam_report('post', v_post, 'inappropriate', NULL);
    ASSERT (r->>'ok')::boolean AND NOT (r->>'auto_hidden')::boolean, 'بلاغ ' || v_i || ': ' || r::text;
    EXECUTE 'RESET ROLE';
    ASSERT (SELECT status FROM public.aqlam_posts WHERE id = v_post) = 'published',
      'اتخبّى بعد ' || v_i || ' بلاغات بس';
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', v_reps[5]::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_report('post', v_post, 'bullying', NULL);
  EXECUTE 'RESET ROLE';
  ASSERT (r->>'ok')::boolean AND (r->>'auto_hidden')::boolean, 'البلاغ الخامس لازم يخفي: ' || r::text;
  ASSERT (SELECT status FROM public.aqlam_posts WHERE id = v_post) = 'hidden', 'النص ماتخبّاش بعد ٥';
  ASSERT (SELECT count(*) FROM public.notifications
           WHERE recipient_profile_id = v_admin::text AND message LIKE '%5 بلاغات%') = 1,
    'الإدارة ما اتبلّغتش بالإخفاء (٥ بلاغات)';

  -- ── ٢) مسح المشال بعد ٧ أيام ──────────────────────────────────────────────
  -- نصّين: واحد اتشال من ٨ أيام (يتمسح)، وواحد من ٣ أيام (يفضل).
  PERFORM set_config('request.jwt.claim.sub', v_writer::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('قمر', v_text, 'poem', 'pen_name', 'قمر الليل', false, true, NULL, NULL, 'v1');
  ASSERT (r->>'ok')::boolean, 'نشر ٢: ' || r::text;
  v_post2 := (r->>'id')::uuid;
  EXECUTE 'RESET ROLE';

  -- مشال بعد ما كان عليه تعليق وتشجيع وبلاغ ونسخة تعديل
  INSERT INTO public.aqlam_comments(post_id, author_id, author_display_name, body)
    VALUES (v_post2, v_reader, 'قارئ', 'جميل') RETURNING id INTO v_comment;
  INSERT INTO public.aqlam_reactions(post_id, user_id, kind) VALUES (v_post2, v_reader, 'heart');
  INSERT INTO public.aqlam_reports(reporter_id, target_type, target_id, reason) VALUES
    (v_reader, 'post', v_post2, 'other'), (v_reader, 'comment', v_comment, 'other');
  INSERT INTO public.aqlam_post_edits(post_id, writer_id, old_title, old_body) VALUES (v_post2, v_writer, 'قديم', v_text);

  PERFORM set_config('request.jwt.claim.sub', v_writer::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_remove_own_post(v_post2);
  EXECUTE 'RESET ROLE';
  ASSERT (r->>'ok')::boolean, 'شيل: ' || r::text;

  -- لسه جوّه المهلة: مايتمسحش
  r := public.aqlam_purge_removed(7);
  ASSERT (r->>'posts')::int = 0, 'اتمسح قبل ٧ أيام: ' || r::text;
  ASSERT EXISTS (SELECT 1 FROM public.aqlam_posts WHERE id = v_post2), 'النص المشال اتمسح بدري';

  UPDATE public.aqlam_posts SET removed_at = now() - interval '3 days' WHERE id = v_post2;
  r := public.aqlam_purge_removed(7);
  ASSERT (r->>'posts')::int = 0, 'اتمسح بعد ٣ أيام: ' || r::text;

  UPDATE public.aqlam_posts SET removed_at = now() - interval '8 days' WHERE id = v_post2;
  r := public.aqlam_purge_removed(7);
  ASSERT (r->>'posts')::int = 1 AND (r->>'comments')::int = 0, 'المسح: ' || r::text;
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_posts WHERE id = v_post2), 'النص ما اتمسحش';
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_comments WHERE post_id = v_post2), 'التعليق ما اتمسحش';
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_reactions WHERE post_id = v_post2), 'التشجيع ما اتمسحش';
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_post_edits WHERE post_id = v_post2), 'نسخة التعديل ما اتمسحتش';
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_reports WHERE target_id IN (v_post2, v_comment)), 'البلاغات ما اتمسحتش';
  -- المخفي (مش مشال) ما بيتمسحش أبدًا
  ASSERT EXISTS (SELECT 1 FROM public.aqlam_posts WHERE id = v_post AND status = 'hidden'), 'النص المخفي اتمسح';

  -- سجل العقوبات مابيتمسحش
  INSERT INTO public.aqlam_sanctions(user_id, kind, reason, created_by) VALUES (v_writer, 'warning', 'تجريبي', v_admin);

  -- تعليق اتشال لوحده: المُشغّل بيسجّل وقت الشيل وبيتمسح بعد ٧ أيام
  INSERT INTO public.aqlam_comments(post_id, author_id, author_display_name, body)
    VALUES (v_post, v_reader, 'قارئ', 'تعليق هيتشال') RETURNING id INTO v_comment;
  UPDATE public.aqlam_comments SET status = 'removed' WHERE id = v_comment;
  ASSERT (SELECT removed_at IS NOT NULL FROM public.aqlam_comments WHERE id = v_comment), 'وقت شيل التعليق ما اتسجّلش';
  r := public.aqlam_purge_removed(7);
  ASSERT (r->>'comments')::int = 0, 'تعليق اتمسح بدري: ' || r::text;
  UPDATE public.aqlam_comments SET removed_at = now() - interval '9 days' WHERE id = v_comment;
  r := public.aqlam_purge_removed(7);
  ASSERT (r->>'comments')::int = 1, 'تعليق مشال ما اتمسحش: ' || r::text;
  ASSERT EXISTS (SELECT 1 FROM public.aqlam_posts WHERE id = v_post), 'مسح التعليق مسح النص';
  ASSERT EXISTS (SELECT 1 FROM public.aqlam_sanctions WHERE user_id = v_writer), 'سجل العقوبات اتمسح';

  -- المسح مش متاح لأي مستخدم
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', v_role);
    BEGIN
      PERFORM public.aqlam_purge_removed(7);
      ASSERT false, v_role || ' نفّذ aqlam_purge_removed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
  END LOOP;

  -- ── ٣) ولي الأمر يطلب قفل التعليقات ───────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_teen::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('نص سلمى', v_text, 'story', 'first_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'published', 'نشر سلمى: ' || r::text;
  v_teen_post := (r->>'id')::uuid;
  EXECUTE 'RESET ROLE';

  -- قفل مباشر مش مسموح
  PERFORM set_config('request.jwt.claim.sub', v_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_guardian_settings(v_teen_child, true, false);
  ASSERT r->>'error' = 'needs_admin_request', 'قفل مباشر: ' || r::text;
  -- ولا بالكتابة المباشرة في الجدول
  BEGIN
    INSERT INTO public.aqlam_guardian_settings(child_id, guardian_id, comments_allowed)
      VALUES (v_teen_child, v_guard, false);
    ASSERT false, 'ولي الأمر كتب في جدول الإعدادات مباشرة';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- قفل النشر لسه مباشر
  r := public.aqlam_set_guardian_settings(v_teen_child, false, true);
  ASSERT (r->>'ok')::boolean, 'قفل النشر المباشر: ' || r::text;
  r := public.aqlam_set_guardian_settings(v_teen_child, true, true);
  ASSERT (r->>'ok')::boolean, 'فتح النشر: ' || r::text;

  -- الطلب: السبب إجباري، وولي أمر غريب مايطلبش
  r := public.aqlam_request_comments_lock(v_teen_child, 'قصير');
  ASSERT r->>'error' = 'reason_required', 'سبب قصير: ' || r::text;
  r := public.aqlam_request_comments_lock(v_teen_child, NULL);
  ASSERT r->>'error' = 'reason_required', 'من غير سبب: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_other_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_request_comments_lock(v_teen_child, 'سبب طويل كفاية للتجربة');
  ASSERT r->>'error' = 'forbidden', 'ولي أمر غريب: ' || r::text;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_request_comments_lock(v_teen_child, 'تعليقات من غرباء مضايقة لبنتي');
  ASSERT (r->>'ok')::boolean, 'طلب القفل: ' || r::text;
  v_req := (r->>'id')::uuid;
  r := public.aqlam_request_comments_lock(v_teen_child, 'سبب طويل كفاية للتجربة');
  ASSERT r->>'error' = 'already_pending', 'طلب تاني: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT count(*) FROM public.notifications
           WHERE recipient_profile_id = v_admin::text AND title = 'طلب قفل تعليقات في أقلام الرحلة') = 1,
    'الإدارة ما اتبلّغتش بالطلب';
  -- لسه مافيش قفل: التعليق شغال
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_add_comment(v_teen_post, 'نص حلو');
  ASSERT (r->>'ok')::boolean, 'تعليق قبل الموافقة: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- مستخدم عادي ما يقررش
  PERFORM set_config('request.jwt.claim.sub', v_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_decide_guardian_request(v_req, true, NULL);
  ASSERT r->>'error' = 'forbidden', 'ولي الأمر وافق على طلبه: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- الإدارة: الرفض محتاج ملاحظة
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_decide_guardian_request(v_req, false, NULL);
  ASSERT r->>'error' = 'note_required', 'رفض من غير ملاحظة: ' || r::text;
  r := public.aqlam_decide_guardian_request(v_req, false, 'التعليقات كلها من مدربين، مفيش غرباء.');
  ASSERT (r->>'ok')::boolean, 'رفض: ' || r::text;
  r := public.aqlam_decide_guardian_request(v_req, true, NULL);
  ASSERT r->>'error' = 'not_pending', 'قرار تاني: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT status = 'rejected' AND admin_note IS NOT NULL AND decided_by = v_admin
            FROM public.aqlam_guardian_requests WHERE id = v_req), 'حالة الرفض';
  ASSERT (SELECT count(*) FROM public.notifications
           WHERE recipient_profile_id = v_guard::text AND title = 'طلب قفل التعليقات اترفض'
             AND message LIKE '%مفيش غرباء%') = 1, 'ولي الأمر ما اتبلّغش بالرفض وسببه';
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_guardian_settings WHERE child_id = v_teen_child AND NOT comments_allowed),
    'الرفض قفل التعليقات';

  -- طلب جديد ← سحب
  PERFORM set_config('request.jwt.claim.sub', v_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_request_comments_lock(v_teen_child, 'تعليقات من غرباء مضايقة لبنتي');
  ASSERT (r->>'ok')::boolean, 'طلب جديد: ' || r::text;
  v_req := (r->>'id')::uuid;
  r := public.aqlam_cancel_guardian_request(v_req);
  ASSERT (r->>'ok')::boolean, 'سحب: ' || r::text;
  r := public.aqlam_cancel_guardian_request(v_req);
  ASSERT r->>'error' = 'not_found', 'سحب تاني: ' || r::text;
  -- ولي أمر غريب مايسحبش
  r := public.aqlam_request_comments_lock(v_teen_child, 'تعليقات من غرباء مضايقة لبنتي');
  v_req := (r->>'id')::uuid;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_other_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_cancel_guardian_request(v_req);
  ASSERT r->>'error' = 'not_found', 'غريب سحب طلب: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- موافقة الإدارة ← القفل بيتطبّق (استقبالًا) والنشر مابيتأثرش
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_decide_guardian_request(v_req, true, 'تمت الموافقة.');
  ASSERT (r->>'ok')::boolean, 'موافقة: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT NOT comments_allowed AND publishing_allowed FROM public.aqlam_guardian_settings
           WHERE child_id = v_teen_child), 'القفل ما اتطبّقش صح';
  ASSERT (SELECT count(*) FROM public.notifications
           WHERE recipient_profile_id = v_guard::text AND title LIKE 'اتقفلت التعليقات%') = 1,
    'ولي الأمر ما اتبلّغش بالموافقة';
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_add_comment(v_teen_post, 'نص حلو تاني');
  ASSERT r->>'error' = 'guardian_locked', 'التعليق بعد القفل: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- طلب تاني وهو مقفول ← already_locked، وفتح التعليقات فوري
  PERFORM set_config('request.jwt.claim.sub', v_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_request_comments_lock(v_teen_child, 'تعليقات من غرباء مضايقة لبنتي');
  ASSERT r->>'error' = 'already_locked', 'طلب وهو مقفول: ' || r::text;
  r := public.aqlam_set_guardian_settings(v_teen_child, true, true);
  ASSERT (r->>'ok')::boolean, 'فتح التعليقات: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT comments_allowed FROM public.aqlam_guardian_settings WHERE child_id = v_teen_child), 'ما اتفتحتش';

  -- الدوال مش متاحة للزوار
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM public.aqlam_request_comments_lock(v_teen_child, 'سبب طويل كفاية للتجربة');
    ASSERT false, 'anon نفّذ aqlam_request_comments_lock';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.aqlam_decide_guardian_request(v_req, true, NULL);
    ASSERT false, 'anon نفّذ aqlam_decide_guardian_request';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  RAISE NOTICE 'aqlam_policy_decisions: OK';
END $$;

ROLLBACK;
