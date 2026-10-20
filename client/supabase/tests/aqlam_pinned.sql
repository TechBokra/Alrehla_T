-- أقلام الرحلة — اختبار تثبيت النصوص المميزة (ترتيب، حد ٦، فك تلقائي، العرض
-- العام للزوار). بيفترض إن `20261017220000_aqlam_pinned_posts.sql` متطبّقة.
-- كل البيانات بتتراجع (ROLLBACK).
--
-- التشغيل: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/aqlam_pinned.sql
-- النجاح: بيطبع «aqlam_pinned: OK».
BEGIN;

DO $$
DECLARE
  v_admin  uuid := gen_random_uuid();
  v_writer uuid := gen_random_uuid();
  v_user   uuid := gen_random_uuid();
  v_ids    uuid[] := ARRAY[]::uuid[];
  v_draft  uuid;
  v_id     uuid;
  r        jsonb;
  v_i      integer;
  v_role   text;
  v_text   text := 'كان يا ما كان في قرية صغيرة بنت اسمها نور وكانت بتحب الغيم';
BEGIN
  INSERT INTO public.user_profiles(id, full_name, role) VALUES
    (v_admin, 'Admin', 'super_admin'),
    (v_writer, 'كاتب', 'customer'),
    (v_user, 'مستخدم', 'customer');
  DELETE FROM public.site_settings WHERE key = 'general';
  INSERT INTO public.site_settings(key, value) VALUES ('general', jsonb_build_object('aqlamMode', 'public'));

  -- ٨ نصوص منشورة + مسودة غير منشورة
  FOR v_i IN 1..8 LOOP
    INSERT INTO public.aqlam_posts(writer_id, title, body, category, display_name, name_mode, age_group, age_band,
                                   status, published_at, consent_version)
    VALUES (v_writer, 'نص ' || v_i, v_text, 'story', 'كاتب', 'first_name', '12_plus', '13-17',
            'published', now() - make_interval(mins => v_i), 'v1')
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;
  INSERT INTO public.aqlam_posts(writer_id, title, body, category, display_name, name_mode, age_group, age_band,
                                 status, consent_version)
  VALUES (v_writer, 'مسودة', v_text, 'story', 'كاتب', 'first_name', '12_plus', '13-17', 'pending_review', 'v1')
  RETURNING id INTO v_draft;

  -- مستخدم عادي مايثبّتش
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_pin(v_ids[1], 'pin');
  ASSERT r->>'error' = 'forbidden', 'مستخدم عادي ثبّت: ' || r::text;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM public.aqlam_set_pin(v_ids[1], 'pin');
    ASSERT false, 'anon نفّذ aqlam_set_pin';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  -- الإدارة: تثبيت ٦ ثم السابع مرفوض
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  FOR v_i IN 1..6 LOOP
    r := public.aqlam_set_pin(v_ids[v_i], 'pin');
    ASSERT (r->>'ok')::boolean, 'تثبيت ' || v_i || ': ' || r::text;
  END LOOP;
  r := public.aqlam_set_pin(v_ids[7], 'pin');
  ASSERT r->>'error' = 'pin_limit', 'الحد ٦: ' || r::text;
  r := public.aqlam_set_pin(v_draft, 'pin');
  ASSERT r->>'error' = 'not_published', 'تثبيت غير منشور: ' || r::text;
  r := public.aqlam_set_pin(v_ids[1], 'pin');
  ASSERT (r->>'ok')::boolean AND (r->>'already')::boolean, 'تثبيت مكرر: ' || r::text;
  r := public.aqlam_set_pin(v_ids[8], 'sideways');
  ASSERT r->>'error' = 'invalid', 'عملية غلط: ' || r::text;
  r := public.aqlam_set_pin(v_ids[7], 'up');
  ASSERT r->>'error' = 'not_pinned', 'تحريك غير مثبّت: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT array_agg(featured_rank ORDER BY featured_rank) FROM public.aqlam_posts WHERE featured_at IS NOT NULL)
         = ARRAY[1,2,3,4,5,6], 'الترتيب لازم ١..٦';
  ASSERT (SELECT featured_rank FROM public.aqlam_posts WHERE id = v_ids[3]) = 3, 'ترتيب النص ٣';

  -- تحريك: النص ٣ لفوق، والنص ٦ لتحت (آخر واحد: مفيش تغيير)، والأول لفوق (مفيش تغيير)
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_pin(v_ids[3], 'up');
  ASSERT (r->>'ok')::boolean, 'up: ' || r::text;
  r := public.aqlam_set_pin(v_ids[6], 'down');
  ASSERT (r->>'ok')::boolean, 'down الأخير: ' || r::text;
  r := public.aqlam_set_pin(v_ids[1], 'up');
  ASSERT (r->>'ok')::boolean, 'up الأول: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT featured_rank FROM public.aqlam_posts WHERE id = v_ids[3]) = 2, 'النص ٣ لازم يبقى ٢';
  ASSERT (SELECT featured_rank FROM public.aqlam_posts WHERE id = v_ids[2]) = 3, 'النص ٢ لازم يبقى ٣';
  ASSERT (SELECT featured_rank FROM public.aqlam_posts WHERE id = v_ids[1]) = 1, 'الأول فضل أول';
  ASSERT (SELECT featured_rank FROM public.aqlam_posts WHERE id = v_ids[6]) = 6, 'الأخير فضل آخر';

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_pin(v_ids[3], 'down');   -- يرجع ٣
  ASSERT (r->>'ok')::boolean, 'down: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT featured_rank FROM public.aqlam_posts WHERE id = v_ids[3]) = 3, 'down ما رجّعش النص ٣';

  -- فك التثبيت بيرصّ الباقي
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_pin(v_ids[2], 'unpin');
  ASSERT (r->>'ok')::boolean, 'unpin: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT featured_at IS NULL AND featured_rank IS NULL FROM public.aqlam_posts WHERE id = v_ids[2]), 'ما اتفكّش';
  ASSERT (SELECT array_agg(featured_rank ORDER BY featured_rank) FROM public.aqlam_posts WHERE featured_at IS NOT NULL)
         = ARRAY[1,2,3,4,5], 'الترتيب بعد الفك لازم ١..٥';

  -- النص يتخبّى ← يتفك تثبيته لوحده؛ وبعد الاسترجاع مايرجعش مثبّت
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_moderate_post(v_ids[4], 'hide', 'تجريبي');
  ASSERT (r->>'ok')::boolean, 'إخفاء: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT featured_at IS NULL AND featured_rank IS NULL FROM public.aqlam_posts WHERE id = v_ids[4]),
    'النص المخفي فضل مثبّت';
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_moderate_post(v_ids[4], 'restore', NULL);
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT featured_at IS NULL FROM public.aqlam_posts WHERE id = v_ids[4]), 'الاسترجاع رجّع التثبيت';

  -- العرض العام بدور الزائر والمسجّل: عمود الترتيب ظاهر، والمثبّت بالترتيب
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', v_role);
    ASSERT (SELECT count(*) FROM public.aqlam_public_posts WHERE featured_at IS NOT NULL) = 4,
      v_role || ': عدد المثبّت في العرض العام';
    ASSERT (SELECT array_agg(id ORDER BY featured_rank) FROM public.aqlam_public_posts WHERE featured_at IS NOT NULL)
           = ARRAY[v_ids[1], v_ids[3], v_ids[5], v_ids[6]], v_role || ': ترتيب المثبّت';
    EXECUTE 'RESET ROLE';
  END LOOP;

  -- الإزالة بتفكّ التثبيت
  UPDATE public.aqlam_posts SET status = 'removed', removed_at = now() WHERE id = v_ids[5];
  ASSERT (SELECT featured_at IS NULL FROM public.aqlam_posts WHERE id = v_ids[5]), 'المشال فضل مثبّت';

  RAISE NOTICE 'aqlam_pinned: OK';
END $$;

ROLLBACK;
