-- أقلام الرحلة — اختبار الدفعة التانية (تعديل النص، ملف الكاتب، رفع العقوبة،
-- بحث الإدارة). بيفترض إن `20261015200000_aqlam_foundation.sql` و
-- `20261016120000_aqlam_profile_edit.sql` متطبّقين. كل البيانات بتتراجع (ROLLBACK).
--
-- التشغيل: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/aqlam_profile_edit.sql
-- النجاح: بيطبع «aqlam_profile_edit: OK».
BEGIN;

DO $$
DECLARE
  v_admin  uuid := gen_random_uuid();
  v_guard  uuid := gen_random_uuid();
  v_teen   uuid := gen_random_uuid();   -- ابن 14 سنة
  v_kid    uuid := gen_random_uuid();   -- ابن 8 سنين
  v_adult  uuid := gen_random_uuid();
  v_other  uuid := gen_random_uuid();
  v_text   text := 'كان يا ما كان في قرية صغيرة بنت اسمها نور وكانت بتحب الغيم';
  v_text2  text := 'وفي يوم من الأيام طلعت نور على السطح وبصّت للغيم وحكت له حكايتها';
  v_teen_child text := 'aq2-teen-' || substr(gen_random_uuid()::text, 1, 8);
  v_kid_child  text := 'aq2-kid-'  || substr(gen_random_uuid()::text, 1, 8);
  r        jsonb;
  v_post   uuid;
  v_post2  uuid;
  v_kid_post uuid;
  v_slug   text;
  v_sanc   uuid;
  v_count  integer;
  v_status text;
  v_cols   text;
BEGIN
  INSERT INTO public.user_profiles(id, full_name, role) VALUES
    (v_admin, 'Admin',          'super_admin'),
    (v_guard, 'ولي أمر',        'customer'),
    (v_teen,  'سلمى أحمد',      'student'),
    (v_kid,   'يوسف أحمد',      'student'),
    (v_adult, 'منى الكاتبة',    'customer'),
    (v_other, 'حد تاني',        'customer');
  INSERT INTO auth.users(id, email) VALUES
    (v_adult, 'mona@example.test'), (v_teen, 'salma@example.test');
  INSERT INTO public.child_profiles(id, user_profile_id, full_name, birth_date, account_profile_id) VALUES
    (v_teen_child, v_guard, 'سلمى أحمد', (current_date - interval '14 years')::date, v_teen::text),
    (v_kid_child,  v_guard, 'يوسف أحمد', (current_date - interval '8 years')::date,  v_kid::text);

  DELETE FROM public.site_settings WHERE key = 'general';
  INSERT INTO public.site_settings(key, value) VALUES ('general', jsonb_build_object('aqlamMode', 'public'));

  -- ── ١) تعديل نص منشور ١٢+ ────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('غيمة', v_text, 'story', 'pen_name', 'قمر الليل', true, true, NULL,
         (current_date - interval '30 years')::date, 'v1');
  ASSERT (r->>'ok')::boolean, 'نشر الأساس فشل: ' || r::text;
  v_post := (r->>'id')::uuid;

  r := public.aqlam_update_post(v_post, 'غيمة صغيرة', v_text2, 'poem', false, false);
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'published' AND NOT (r->>'back_to_approval')::boolean,
    'تعديل منشور ١٢+ لازم يفضل منشور: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT edited_at IS NOT NULL AND title = 'غيمة صغيرة' AND body = v_text2 AND category = 'poem'
                 AND NOT allow_indexing AND NOT comments_enabled
            FROM public.aqlam_posts WHERE id = v_post), 'التعديل ما اتسجّلش صح';
  ASSERT (SELECT count(*) FROM public.aqlam_post_edits WHERE post_id = v_post AND old_body = v_text) = 1,
    'النسخة القديمة ما اتحفظتش';
  ASSERT (SELECT edited_at IS NOT NULL FROM public.aqlam_public_posts WHERE id = v_post),
    'العرض العام مابيطلّعش edited_at';

  -- تغيير إعدادات من غير تغيير النص = مش «عُدّل»
  UPDATE public.aqlam_posts SET edited_at = NULL WHERE id = v_post;
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_update_post(v_post, 'غيمة صغيرة', v_text2, 'poem', true, true);
  ASSERT (r->>'ok')::boolean AND NOT (r->>'changed')::boolean, 'إعدادات بس لازم changed=false: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT edited_at IS NULL AND allow_indexing FROM public.aqlam_posts WHERE id = v_post),
    'تغيير إعدادات علّم النص «عُدّل»';

  -- بيانات تواصل / أطوال / ملكية
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_update_post(v_post, 'عنوان', v_text || ' كلموني 01012345678', 'story', false, true);
  ASSERT r->>'error' = 'contact_info', 'رقم تليفون عدّى في التعديل: ' || r::text;
  r := public.aqlam_update_post(v_post, '', v_text, 'story', false, true);
  ASSERT r->>'error' = 'invalid', 'عنوان فاضي عدّى: ' || r::text;
  r := public.aqlam_update_post(v_post, 'عنوان', 'قصير', 'story', false, true);
  ASSERT r->>'error' = 'invalid', 'نص قصير عدّى: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_update_post(v_post, 'سرقة', v_text, 'story', false, true);
  ASSERT r->>'error' = 'not_found', 'حد تاني عدّل نص مش بتاعه: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- مخفي ما ينفعش يتعدّل
  UPDATE public.aqlam_posts SET status = 'hidden' WHERE id = v_post;
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_update_post(v_post, 'غيمة', v_text, 'story', false, true);
  ASSERT r->>'error' = 'not_editable', 'نص مخفي اتعدّل: ' || r::text;
  EXECUTE 'RESET ROLE';
  UPDATE public.aqlam_posts SET status = 'published' WHERE id = v_post;

  -- حد التعديل اليومي (10)
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  FOR i IN 1..12 LOOP
    r := public.aqlam_update_post(v_post, 'غيمة ' || i, v_text || ' ' || i, 'story', false, true);
    EXIT WHEN NOT (r->>'ok')::boolean;
  END LOOP;
  ASSERT r->>'error' = 'rate_limited', 'حد التعديل اليومي مش شغال: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- ── ٢) نص طفل أقل من ١٢ ──────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_kid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('حكاية', v_text, 'story', 'first_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'pending_guardian', 'نص الطفل: ' || r::text;
  v_kid_post := (r->>'id')::uuid;
  -- تعديل وهو بانتظار ولي الأمر: يفضل بانتظاره
  r := public.aqlam_update_post(v_kid_post, 'حكاية جديدة', v_text2, 'story', true, true);
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'pending_guardian' AND NOT (r->>'back_to_approval')::boolean,
    'تعديل نص طفل بانتظار ولي الأمر: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT NOT allow_indexing FROM public.aqlam_posts WHERE id = v_kid_post), 'نص طفل اتفتح لجوجل';
  ASSERT (SELECT edited_at IS NULL FROM public.aqlam_posts WHERE id = v_kid_post),
    'نص ما اتنشرش اتعلّم «عُدّل»';

  -- ولي الأمر يوافق + الإدارة تنشر، بعدين الطفل يعدّل = يرجع لولي الأمر
  PERFORM set_config('request.jwt.claim.sub', v_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_guardian_decide(v_kid_post, true);
  ASSERT (r->>'ok')::boolean, 'موافقة ولي الأمر: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_moderate_post(v_kid_post, 'approve');
  ASSERT (r->>'ok')::boolean, 'موافقة الإدارة: ' || r::text;
  EXECUTE 'RESET ROLE';

  DELETE FROM public.notifications WHERE recipient_profile_id = v_guard::text;
  PERFORM set_config('request.jwt.claim.sub', v_kid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_update_post(v_kid_post, 'حكاية معدّلة', v_text, 'story', false, true);
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'pending_guardian' AND (r->>'back_to_approval')::boolean,
    'تعديل منشور طفل لازم يرجع لولي الأمر: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_public_posts WHERE id = v_kid_post),
    'نص طفل معدّل لسه ظاهر للعامة';
  ASSERT (SELECT guardian_approved_at IS NULL FROM public.aqlam_posts WHERE id = v_kid_post),
    'موافقة ولي الأمر القديمة فضلت سارية';
  ASSERT (SELECT count(*) FROM public.notifications
           WHERE recipient_profile_id = v_guard::text AND link = '/account/family/aqlam') >= 1,
    'ولي الأمر ما اتبلّغش بالتعديل';

  -- قفل ولي الأمر يمنع التعديل
  INSERT INTO public.aqlam_guardian_settings(child_id, guardian_id, publishing_allowed)
  VALUES (v_kid_child, v_guard, false);
  PERFORM set_config('request.jwt.claim.sub', v_kid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_update_post(v_kid_post, 'حكاية', v_text2, 'story', false, true);
  ASSERT r->>'error' = 'guardian_locked', 'القفل ما منعش التعديل: ' || r::text;
  EXECUTE 'RESET ROLE';
  DELETE FROM public.aqlam_guardian_settings WHERE child_id = v_kid_child;

  -- مرفوض: يتقدّم تاني
  UPDATE public.aqlam_posts SET status = 'rejected' WHERE id = v_kid_post;
  PERFORM set_config('request.jwt.claim.sub', v_kid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_update_post(v_kid_post, 'حكاية مصحّحة', v_text2, 'story', false, true);
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'pending_guardian', 'مرفوض (طفل) يتقدّم لولي الأمر: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- ── ٣) ملف الكاتب والصفحة العامة (اختيارية) ───────────────────────────────
  -- الافتراضي: مفيش رابط ولا صفحة
  ASSERT (SELECT writer_slug IS NULL FROM public.aqlam_public_posts WHERE id = v_post),
    'رابط كاتب ظهر من غير موافقته';
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_public_writers), 'صفحة كاتب ظهرت من غير موافقته';

  PERFORM set_config('request.jwt.claim.sub', v_kid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_writer_profile('قلم صغير', 'نبذة', true);
  ASSERT r->>'error' = 'too_young', 'أقل من ١٢ فعّل صفحة عامة: ' || r::text;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_writer_profile('قمر الليل', 'بحب الغيم وأكتب عنه. كلموني 01012345678', true);
  ASSERT r->>'error' = 'contact_info', 'بيانات تواصل في النبذة عدّت: ' || r::text;
  r := public.aqlam_set_writer_profile('ق', 'نبذة', true);
  ASSERT r->>'error' = 'invalid', 'اسم قلم قصير عدّى: ' || r::text;
  r := public.aqlam_set_writer_profile('قمر الليل', 'بحب الغيم وأكتب عنه.', true);
  ASSERT (r->>'ok')::boolean AND length(r->>'slug') = 12, 'تفعيل الصفحة: ' || r::text;
  v_slug := r->>'slug';
  EXECUTE 'RESET ROLE';

  ASSERT (SELECT writer_slug = v_slug FROM public.aqlam_public_posts WHERE id = v_post), 'رابط الكاتب مش في العرض';
  ASSERT (SELECT count(*) FROM public.aqlam_public_writers WHERE slug = v_slug AND name = 'قمر الليل') = 1,
    'صفحة الكاتب مش ظاهرة';
  SELECT string_agg(column_name, ',') INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name IN ('aqlam_public_writers', 'aqlam_public_posts');
  ASSERT v_cols !~ '(user_id|writer_id|birth_date)', 'عمود حساس في العرض العام: ' || v_cols;

  -- نص تاني باسمه الحقيقي ما يتربطش بصفحة اسم القلم
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('نص باسمي', v_text2, 'story', 'full_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT (r->>'ok')::boolean, 'نشر باسم حقيقي: ' || r::text;
  v_post2 := (r->>'id')::uuid;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT writer_slug IS NULL FROM public.aqlam_public_posts WHERE id = v_post2),
    'نص باسم حقيقي اتربط بصفحة اسم القلم';
  ASSERT (SELECT posts_count = 1 FROM public.aqlam_public_writers WHERE slug = v_slug),
    'صفحة اسم القلم عدّت نص باسم تاني';

  -- الرابط ثابت بعد القفل والفتح
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_writer_profile('قمر الليل', 'بحب الغيم وأكتب عنه.', false);
  ASSERT (r->>'ok')::boolean, 'قفل الصفحة: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_public_writers WHERE slug = v_slug), 'الصفحة فضلت ظاهرة بعد القفل';
  ASSERT (SELECT writer_slug IS NULL FROM public.aqlam_public_posts WHERE id = v_post), 'الرابط فضل في النص بعد القفل';
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_writer_profile('قمر الليل', 'بحب الغيم وأكتب عنه.', true);
  ASSERT r->>'slug' = v_slug, 'الرابط اتغيّر بعد القفل والفتح';
  EXECUTE 'RESET ROLE';

  -- ابن ١٤ سنة (حساب ابن) يقدر
  PERFORM set_config('request.jwt.claim.sub', v_teen::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_writer_profile(NULL, NULL, true);
  ASSERT r->>'error' = 'pen_name_required', 'صفحة من غير اسم قلم: ' || r::text;
  r := public.aqlam_set_writer_profile('سلمى', NULL, true);
  ASSERT (r->>'ok')::boolean, 'ابن ١٤ سنة مايقدرش يفتح صفحته: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- الموقوف مابيظهرش
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_sanction_user(v_adult, 'suspension_7d', 'مخالفة تجريبية');
  ASSERT (r->>'ok')::boolean, 'توقيف: ' || r::text;
  v_sanc := (r->>'id')::uuid;
  EXECUTE 'RESET ROLE';
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_public_writers WHERE slug = v_slug), 'كاتب موقوف صفحته ظاهرة';
  ASSERT (SELECT writer_slug IS NULL FROM public.aqlam_public_posts WHERE id = v_post), 'كاتب موقوف رابطه ظاهر';
  ASSERT (SELECT count(*) FROM public.notifications
           WHERE recipient_profile_id = v_adult::text AND message = 'مخالفة تجريبية') = 1,
    'الموقوف ما اتبلّغش';

  -- موقوف: ما يعدّلش ولا يغيّر ملفه
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_update_post(v_post, 'عنوان', v_text, 'story', false, true);
  ASSERT r->>'error' = 'suspended', 'موقوف عدّل: ' || r::text;
  r := public.aqlam_set_writer_profile('قمر', NULL, false);
  ASSERT r->>'error' = 'suspended', 'موقوف غيّر ملفه: ' || r::text;
  r := public.aqlam_lift_sanction(v_sanc);
  ASSERT r->>'error' = 'forbidden', 'مستخدم عادي رفع عقوبة: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- ── ٤) رفع العقوبة ───────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_lift_sanction(v_sanc);
  ASSERT (r->>'ok')::boolean, 'رفع العقوبة: ' || r::text;
  r := public.aqlam_lift_sanction(v_sanc);
  ASSERT r->>'error' = 'not_found', 'رفع عقوبة مرفوعة مرتين: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT NOT public.aqlam_is_suspended(v_adult), 'العقوبة المرفوعة لسه موقّفة';
  ASSERT EXISTS (SELECT 1 FROM public.aqlam_public_writers WHERE slug = v_slug), 'الصفحة ما رجعتش بعد الرفع';

  -- ── ٥) بحث الإدارة ───────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_admin_find_users('mona@example');
  ASSERT (r->>'ok')::boolean AND jsonb_array_length(r->'users') = 1
     AND r->'users'->0->>'id' = v_adult::text AND r->'users'->0->>'email' = 'mona@example.test',
    'بحث بالإيميل: ' || r::text;
  r := public.aqlam_admin_find_users('منى');
  ASSERT jsonb_array_length(r->'users') = 1, 'بحث بالاسم: ' || r::text;
  r := public.aqlam_admin_find_users(v_adult::text);
  ASSERT jsonb_array_length(r->'users') = 1, 'بحث برقم الحساب: ' || r::text;
  r := public.aqlam_admin_find_users('%');
  ASSERT r->>'error' = 'invalid', 'علامة % لازم ما تجيبش الكل: ' || r::text;
  r := public.aqlam_admin_find_users('zzz-مفيش');
  ASSERT jsonb_array_length(r->'users') = 0, 'بحث من غير نتيجة: ' || r::text;
  r := public.aqlam_admin_find_users(NULL, ARRAY[v_adult, v_teen]);
  ASSERT jsonb_array_length(r->'users') = 2, 'أسماء بالأرقام: ' || r::text;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_admin_find_users('mona');
  ASSERT r->>'error' = 'forbidden', 'مستخدم عادي بحث في الحسابات: ' || r::text;
  BEGIN
    PERFORM 1 FROM public.aqlam_post_edits LIMIT 1;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    ASSERT v_count = 0, 'مستخدم عادي شاف نسخ التعديل';
  END;
  EXECUTE 'RESET ROLE';

  -- زائر مجهول: مفيش تنفيذ للدوال الجديدة
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM public.aqlam_update_post(v_post, 'x', v_text, 'story', false, true);
    ASSERT false, 'anon نفّذ aqlam_update_post';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.aqlam_admin_find_users('mona');
    ASSERT false, 'anon نفّذ aqlam_admin_find_users';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  RAISE NOTICE 'aqlam_profile_edit: OK';
END $$;

ROLLBACK;
