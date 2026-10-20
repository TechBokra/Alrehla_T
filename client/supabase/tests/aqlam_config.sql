-- أقلام الرحلة — اختبار لوحة الضبط (`aqlam_config`): الصلاحيات، التحقق من كل خانة،
-- وأثر كل إعداد على الدوال (حدود، تصنيفات، مراجعة، كلمات ممنوعة، تفاعلات، بلاغات،
-- تثبيت، مسح). بيفترض إن كل migrations أقلام الرحلة لحد
-- `20261018100000_aqlam_config.sql` متطبّقة. كل البيانات بتتراجع (ROLLBACK).
--
-- التشغيل: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/aqlam_config.sql
-- النجاح: بيطبع «aqlam_config: OK».
BEGIN;

-- تنفيذ جملة كمستخدم مسجّل (بيرجّع jsonb).
CREATE FUNCTION pg_temp.run(p_uid uuid, p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE p_sql INTO r;
  EXECUTE 'RESET ROLE';
  RETURN r;
END $f$;

CREATE FUNCTION pg_temp.save(p_admin uuid, p_cfg jsonb, p_priv jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
  RETURN pg_temp.run(p_admin, format('select public.aqlam_save_config(%L::jsonb, %L::jsonb)', p_cfg::text, p_priv::text));
END $f$;

-- حفظ لازم ينجح (بيوقف الاختبار برسالة واضحة لو اترفض).
CREATE FUNCTION pg_temp.cfg(p_admin uuid, p_cfg jsonb, p_priv jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE r jsonb;
BEGIN
  r := pg_temp.save(p_admin, p_cfg, p_priv);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'الحفظ اترفض: %', r::text; END IF;
END $f$;

CREATE FUNCTION pg_temp.pub(p_uid uuid, p_title text, p_body text, p_cat text, p_mode text, p_pen text,
                            p_idx boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
  RETURN pg_temp.run(p_uid, format(
    'select public.aqlam_publish_post(%L,%L,%L,%L,%L,%L::boolean,true,null,%L::date,%L)',
    p_title, p_body, p_cat, p_mode, p_pen, p_idx::text,
    (current_date - interval '30 years')::date::text, 'v1'));
END $f$;

DO $$
DECLARE
  v_admin  uuid := gen_random_uuid();
  v_w1     uuid := gen_random_uuid();
  v_w2     uuid := gen_random_uuid();
  v_reader uuid := gen_random_uuid();
  v_reps   uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_cfg    jsonb := public.aqlam_default_config();
  v_text   text := 'كان يا ما كان في قرية صغيرة بنت اسمها نور وكانت بتحب الغيم';
  r        jsonb;
  v_id     uuid;
  v_id2    uuid;
  v_id3    uuid;
  v_i      integer;
  v_bad    jsonb;
  v_field  text;
  v_cat    jsonb;
BEGIN
  INSERT INTO public.user_profiles(id, full_name, role) VALUES
    (v_admin, 'Admin', 'super_admin'),
    (v_w1, 'كاتب أول', 'customer'),
    (v_w2, 'كاتب تاني', 'customer'),
    (v_reader, 'قارئ', 'customer');
  FOR v_i IN 1..3 LOOP
    INSERT INTO public.user_profiles(id, full_name, role) VALUES (v_reps[v_i], 'مُبلّغ ' || v_i, 'customer');
  END LOOP;
  DELETE FROM public.site_settings WHERE key = 'general';
  INSERT INTO public.site_settings(key, value) VALUES ('general', jsonb_build_object('aqlamMode', 'public'));

  -- ── ١) الافتراضي والصلاحيات ─────────────────────────────────────────────
  ASSERT (SELECT value FROM public.aqlam_config WHERE id) = v_cfg, 'الصف الافتراضي مش هو الافتراضي';

  EXECUTE 'SET LOCAL ROLE anon';
  ASSERT (SELECT count(*) FROM public.aqlam_config) = 1, 'الزائر مش شايف الإعداد العام';
  BEGIN
    PERFORM private FROM public.aqlam_config;
    ASSERT false, 'الزائر قرا الكلمات الممنوعة';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.aqlam_config SET value = '{}'::jsonb;
    ASSERT false, 'الزائر عدّل الإعداد';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.aqlam_save_config('{}'::jsonb, NULL);
    ASSERT false, 'الزائر نفّذ aqlam_save_config';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  BEGIN
    PERFORM private FROM public.aqlam_config;
    ASSERT false, 'مستخدم قرا الكلمات الممنوعة';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.aqlam_default_config();
    ASSERT false, 'مستخدم نفّذ دالة الافتراضي';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  r := pg_temp.run(v_reader, 'select public.aqlam_save_config(''{}''::jsonb, null)');
  ASSERT r->>'error' = 'forbidden', 'مستخدم عادي حفظ: ' || r::text;
  r := pg_temp.run(v_reader, 'select public.aqlam_admin_config()');
  ASSERT r->>'error' = 'forbidden', 'مستخدم عادي قرا الإعداد الكامل: ' || r::text;
  r := pg_temp.run(v_admin, 'select public.aqlam_admin_config()');
  ASSERT (r->>'ok')::boolean AND r->'value' = v_cfg, 'الإدارة ما قرتش الإعداد: ' || r::text;

  -- ── ٢) التحقق من الخانات ────────────────────────────────────────────────
  FOR v_bad, v_field IN
    SELECT * FROM (VALUES
      (jsonb_set(v_cfg, '{limits,postsPerDay}', '0'),               'limits.postsPerDay'),
      (jsonb_set(v_cfg, '{limits,postsPerDay}', '51'),              'limits.postsPerDay'),
      (jsonb_set(v_cfg, '{limits,postsPerDay}', '2.5'),             'limits.postsPerDay'),
      (jsonb_set(v_cfg, '{limits,postsPerDay}', '"3"'),             'limits.postsPerDay'),
      (jsonb_set(jsonb_set(v_cfg, '{limits,bodyMin}', '500'), '{limits,bodyMax}', '400'), 'limits.bodyMin'),
      (jsonb_set(jsonb_set(v_cfg, '{limits,guardianReasonMin}', '100'), '{limits,guardianReasonMax}', '50'), 'limits.guardianReasonMin'),
      (jsonb_set(v_cfg, '{features,comments}', '"yes"'),            'features.comments'),
      (jsonb_set(v_cfg, '{moderation,review12Plus}', '"sometimes"'), 'moderation.review12Plus'),
      (jsonb_set(v_cfg, '{moderation,blockedWordsAction}', '"ban"'), 'moderation.blockedWordsAction'),
      (jsonb_set(v_cfg, '{filters,sorts}', '[]'),                   'filters.sorts'),
      (jsonb_set(v_cfg, '{filters,sorts}', '["new","new"]'),        'filters.sorts'),
      (jsonb_set(jsonb_set(v_cfg, '{filters,sorts}', '["new"]'), '{filters,defaultSort}', '"top"'), 'filters.defaultSort'),
      (jsonb_set(v_cfg, '{filters,ageBands}', '["1-2"]'),           'filters.ageBands'),
      (jsonb_set(v_cfg, '{filters,pageSize}', '5'),                 'filters.pageSize'),
      (jsonb_set(v_cfg, '{texts,heroTitle}', '""'),                 'texts.heroTitle'),
      (jsonb_set(v_cfg, '{featured,title}', to_jsonb(repeat('ع', 41))), 'featured.title'),
      (jsonb_set(v_cfg, '{categories}', '[]'),                      'categories'),
      (jsonb_set(v_cfg, '{categories}', '[{"key":"Bad Key","label":"س","icon":"pen","enabled":true}]'), 'categories.1'),
      (jsonb_set(v_cfg, '{categories}', '[{"key":"story","label":"قصة","icon":"nope","enabled":true}]'), 'categories.1'),
      (jsonb_set(v_cfg, '{categories}', '[{"key":"story","label":"قصة","icon":"pen","enabled":false}]'), 'categories'),
      (jsonb_set(v_cfg, '{categories}', '[{"key":"story","label":"قصة","icon":"pen","enabled":true},{"key":"story","label":"تاني","icon":"pen","enabled":true}]'), 'categories.2'),
      (jsonb_set(v_cfg, '{reactions}', '[{"key":"heart","label":"a","emoji":"x","enabled":true}]'), 'reactions'),
      (jsonb_set(v_cfg, '{reactions}', '[{"key":"heart","label":"a","emoji":"x","enabled":true},{"key":"star","label":"a","emoji":"x","enabled":true},{"key":"boom","label":"a","emoji":"x","enabled":true}]'), 'reactions.3'),
      (jsonb_set(v_cfg, '{reportReasons}', '[{"key":"contact_info","label":"أ","enabled":false},{"key":"inappropriate","label":"أ","enabled":false},{"key":"bullying","label":"أ","enabled":false},{"key":"copied","label":"أ","enabled":false},{"key":"other","label":"أ","enabled":false}]'), 'reportReasons')
    ) AS t(cfg, fld)
  LOOP
    r := pg_temp.save(v_admin, v_bad);
    ASSERT NOT (r->>'ok')::boolean AND r->>'error' = 'config_invalid' AND r->>'field' = v_field,
      'تحقق ' || v_field || ': ' || r::text;
  END LOOP;
  r := pg_temp.save(v_admin, v_cfg, jsonb_build_object('blockedWords', jsonb_build_array('ك')));
  ASSERT r->>'error' = 'config_invalid' AND r->>'field' = 'blockedWords', 'كلمة من حرف واحد اتقبلت: ' || r::text;
  ASSERT (SELECT value FROM public.aqlam_config WHERE id) = v_cfg, 'حفظ مرفوض غيّر الإعداد';

  -- الخانة الناقصة بتاخد الافتراضي، والزايدة بتتشال
  r := pg_temp.save(v_admin, '{"limits":{"postsPerDay":4},"junk":{"x":1}}'::jsonb);
  ASSERT (r->>'ok')::boolean, 'حفظ جزئي: ' || r::text;
  ASSERT (SELECT value #>> '{limits,postsPerDay}' FROM public.aqlam_config WHERE id) = '4', 'القيمة ما اتحفظتش';
  ASSERT (SELECT value #>> '{limits,commentsPerDay}' FROM public.aqlam_config WHERE id) = '20', 'الناقص ماخدش الافتراضي';
  ASSERT (SELECT value ? 'junk' FROM public.aqlam_config WHERE id) = false, 'مفتاح غريب اتحفظ';
  r := pg_temp.save(v_admin, v_cfg);
  ASSERT (r->>'ok')::boolean AND (SELECT value FROM public.aqlam_config WHERE id) = v_cfg, 'رجوع للافتراضي: ' || r::text;

  -- ── ٣) الحد اليومي للنشر ────────────────────────────────────────────────
  r := pg_temp.save(v_admin, jsonb_set(v_cfg, '{limits,postsPerDay}', '1'));
  ASSERT (r->>'ok')::boolean, 'حفظ ١: ' || r::text;
  r := pg_temp.pub(v_w1, 'غيمة', v_text, 'story', 'first_name', NULL);
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'published', 'النشر الأول: ' || r::text;
  v_id := (r->>'id')::uuid;
  r := pg_temp.pub(v_w1, 'غيمة ٢', v_text, 'story', 'first_name', NULL);
  ASSERT r->>'error' = 'rate_limited', 'الحد ١ ما اتطبّقش: ' || r::text;
  r := pg_temp.save(v_admin, jsonb_set(v_cfg, '{limits,postsPerDay}', '50'));
  ASSERT (r->>'ok')::boolean, 'حفظ ٥٠';
  v_cfg := jsonb_set(v_cfg, '{limits,postsPerDay}', '50');

  -- ── ٤) حدود المحتوى ─────────────────────────────────────────────────────
  r := pg_temp.save(v_admin, jsonb_set(jsonb_set(jsonb_set(v_cfg, '{limits,titleMax}', '20'),
                                                 '{limits,bodyMin}', '5'), '{limits,bodyMax}', '200'));
  ASSERT (r->>'ok')::boolean, 'حفظ حدود المحتوى: ' || r::text;
  r := pg_temp.pub(v_w1, repeat('ع', 21), v_text, 'story', 'first_name', NULL);
  ASSERT r->>'error' = 'invalid', 'عنوان ٢١ والحد ٢٠: ' || r::text;
  r := pg_temp.pub(v_w1, repeat('ع', 20), 'نص قصير', 'story', 'first_name', NULL);
  ASSERT (r->>'ok')::boolean, 'عنوان ٢٠ ونص ٧ حروف والحد الأدنى ٥: ' || r::text;
  r := pg_temp.pub(v_w1, 'طويل', repeat('ع', 201), 'story', 'first_name', NULL);
  ASSERT r->>'error' = 'invalid', 'نص ٢٠١ والحد ٢٠٠: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- ── ٥) إيقاف النشر ──────────────────────────────────────────────────────
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{features,publishing}', 'false'));
  r := pg_temp.pub(v_w1, 'مقفول', v_text, 'story', 'first_name', NULL);
  ASSERT r->>'error' = 'publishing_closed', 'النشر مقفول لكن عدّى: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- ── ٦) التصنيفات: إضافة، تعطيل، منع الحذف لو عليه نصوص ───────────────────
  v_cat := v_cfg -> 'categories' || '[{"key":"drama","label":"دراما","icon":"star","enabled":true}]'::jsonb;
  r := pg_temp.save(v_admin, jsonb_set(v_cfg, '{categories}', v_cat));
  ASSERT (r->>'ok')::boolean, 'إضافة تصنيف: ' || r::text;
  r := pg_temp.pub(v_w1, 'دراما', v_text, 'drama', 'first_name', NULL);
  ASSERT (r->>'ok')::boolean, 'النشر في تصنيف جديد: ' || r::text;
  r := pg_temp.pub(v_w1, 'مجهول', v_text, 'zzz', 'first_name', NULL);
  ASSERT r->>'error' = 'invalid', 'تصنيف مش موجود عدّى: ' || r::text;

  r := pg_temp.pub(v_w1, 'مشهد', v_text, 'scene', 'first_name', NULL);
  v_id2 := (r->>'id')::uuid;
  ASSERT (r->>'ok')::boolean, 'نشر مشهد';
  r := pg_temp.save(v_admin, jsonb_set(v_cfg, '{categories}', (
         SELECT jsonb_agg(c) FROM jsonb_array_elements(v_cat) c WHERE c->>'key' <> 'scene')));
  ASSERT r->>'error' = 'category_in_use', 'حذف تصنيف عليه نصوص: ' || r::text;

  r := pg_temp.save(v_admin, jsonb_set(v_cfg, '{categories}', (
         SELECT jsonb_agg(CASE WHEN c->>'key' = 'scene' THEN jsonb_set(c, '{enabled}', 'false') ELSE c END)
           FROM jsonb_array_elements(v_cat) c)));
  ASSERT (r->>'ok')::boolean, 'تعطيل تصنيف: ' || r::text;
  r := pg_temp.pub(v_w1, 'مشهد ٢', v_text, 'scene', 'first_name', NULL);
  ASSERT r->>'error' = 'category_disabled', 'تصنيف متعطّل عدّى: ' || r::text;
  -- النص القديم يتعدّل وهو على التصنيف المتعطّل، لكن مايتنقلش ليه.
  r := pg_temp.run(v_w1, format('select public.aqlam_update_post(%L,%L,%L,%L,false,true)',
         v_id2, 'مشهد معدّل', v_text, 'scene'));
  ASSERT (r->>'ok')::boolean, 'تعديل نص على تصنيف متعطّل: ' || r::text;
  r := pg_temp.run(v_w1, format('select public.aqlam_update_post(%L,%L,%L,%L,false,true)',
         v_id, 'غيمة', v_text, 'scene'));
  ASSERT r->>'error' = 'category_disabled', 'النقل لتصنيف متعطّل عدّى: ' || r::text;
  v_cfg := jsonb_set(v_cfg, '{categories}', v_cat);
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- ── ٧) طرق عرض الاسم ───────────────────────────────────────────────────
  PERFORM pg_temp.cfg(v_admin, jsonb_set(jsonb_set(v_cfg, '{features,fullName}', 'false'), '{features,penName}', 'false'));
  r := pg_temp.pub(v_w1, 'اسم كامل', v_text, 'story', 'full_name', NULL);
  ASSERT r->>'error' = 'name_mode_disabled', 'الاسم الكامل مقفول: ' || r::text;
  r := pg_temp.pub(v_w1, 'اسم قلمي', v_text, 'story', 'pen_name', 'قمر الليل');
  ASSERT r->>'error' = 'name_mode_disabled', 'الاسم القلمي مقفول: ' || r::text;
  r := pg_temp.pub(v_w1, 'اسم أول', v_text, 'story', 'first_name', NULL);
  ASSERT (r->>'ok')::boolean, 'الاسم الأول لازم يفضل: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- ── ٨) سياسة المراجعة لـ١٢+ ────────────────────────────────────────────
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{moderation,review12Plus}', '"all"'));
  r := pg_temp.pub(v_w1, 'للمراجعة', v_text, 'story', 'first_name', NULL);
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'pending_review', 'سياسة الكل: ' || r::text;
  ASSERT (SELECT count(*) FROM public.notifications
           WHERE recipient_profile_id = v_admin::text AND title = 'نص بانتظار مراجعتك في أقلام الرحلة') >= 1,
    'الإدارة ما اتبلّغتش بنص للمراجعة';

  PERFORM pg_temp.cfg(v_admin, jsonb_set(jsonb_set(v_cfg, '{moderation,review12Plus}', '"first"'),
                                       '{moderation,reviewFirstN}', '1'));
  r := pg_temp.pub(v_w2, 'أول نص', v_text, 'story', 'first_name', NULL);
  ASSERT r->>'status' = 'pending_review', 'أول نص لكاتب جديد لازم يتراجع: ' || r::text;
  v_id3 := (r->>'id')::uuid;
  r := pg_temp.run(v_admin, format('select public.aqlam_moderate_post(%L,%L,null)', v_id3, 'approve'));
  ASSERT (r->>'ok')::boolean, 'اعتماد: ' || r::text;
  r := pg_temp.pub(v_w2, 'تاني نص', v_text, 'story', 'first_name', NULL);
  ASSERT r->>'status' = 'published', 'بعد الاعتماد النص التاني لازم يظهر: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- إعادة المراجعة بعد التعديل
  r := pg_temp.pub(v_w2, 'للتعديل', v_text, 'story', 'first_name', NULL);
  v_id3 := (r->>'id')::uuid;
  r := pg_temp.run(v_w2, format('select public.aqlam_update_post(%L,%L,%L,%L,false,true)',
         v_id3, 'للتعديل ٢', v_text || ' وزيادة', 'story'));
  ASSERT r->>'status' = 'published', 'التعديل من غير سياسة لازم يفضل منشور: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{moderation,reReviewEdits}', 'true'));
  r := pg_temp.run(v_w2, format('select public.aqlam_update_post(%L,%L,%L,%L,false,true)',
         v_id3, 'للتعديل ٣', v_text || ' وزيادة كمان', 'story'));
  ASSERT r->>'status' = 'pending_review', 'التعديل مع إعادة المراجعة: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- ── ٩) الكلمات الممنوعة ────────────────────────────────────────────────
  r := pg_temp.save(v_admin, v_cfg, jsonb_build_object('blockedWords', jsonb_build_array('مَمنوعة', 'ممنوعه', 'سيئ')));
  ASSERT (r->>'ok')::boolean, 'حفظ الكلمات: ' || r::text;
  r := pg_temp.run(v_admin, 'select public.aqlam_admin_config()');
  -- «مَمنوعة» و«ممنوعه» مختلفتين (التاء المربوطة)، فالتلاتة ثابتين.
  ASSERT jsonb_array_length(r #> '{private,blockedWords}') = 3, 'الكلمات ما اتخزّنتش: ' || r::text;
  r := pg_temp.pub(v_w1, 'عادي', v_text || ' كلمة مُمْنُوعَة هنا', 'story', 'first_name', NULL);
  ASSERT r->>'error' = 'blocked_word', 'كلمة ممنوعة بتشكيل عدّت: ' || r::text;
  r := pg_temp.pub(v_w1, 'عادي', 'نص نضيف تمامًا وكله كلام طيب عن الغيم', 'story', 'first_name', NULL);
  ASSERT (r->>'ok')::boolean, 'نص نضيف اترفض: ' || r::text;
  v_id3 := (r->>'id')::uuid;

  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{moderation,blockedWordsAction}', '"review"'));
  r := pg_temp.pub(v_w1, 'للمراجعة بالكلمة', v_text || ' فيه كلمة سيئ جدًا', 'story', 'first_name', NULL);
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'pending_review', 'الكلمة مع سياسة المراجعة: ' || r::text;
  r := pg_temp.run(v_w1, format('select public.aqlam_update_post(%L,%L,%L,%L,false,true)',
         v_id3, 'عادي', v_text || ' وفيه كلمة سيئ', 'story'));
  ASSERT r->>'status' = 'pending_review', 'تعديل بكلمة ممنوعة لازم يرجع للمراجعة: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- التعليق والملف: بيترفضوا دايمًا
  r := pg_temp.pub(v_w2, 'للتعليق', 'نص نضيف تمامًا وكله كلام طيب عن القمر', 'story', 'first_name', NULL);
  v_id3 := (r->>'id')::uuid;
  r := pg_temp.run(v_reader, format('select public.aqlam_add_comment(%L,%L)', v_id3, 'كلام فيه سيئ'));
  ASSERT r->>'error' = 'blocked_word', 'تعليق بكلمة ممنوعة عدّى: ' || r::text;
  r := pg_temp.run(v_w2, 'select public.aqlam_set_writer_profile(null, ''نبذة فيها ممنوعه'', false)');
  ASSERT r->>'error' = 'blocked_word', 'نبذة بكلمة ممنوعة عدّت: ' || r::text;
  r := pg_temp.run(v_reader, format('select public.aqlam_add_comment(%L,%L)', v_id3, 'تعليق جميل'));
  ASSERT (r->>'ok')::boolean, 'تعليق سليم: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg, jsonb_build_object('blockedWords', '[]'::jsonb));
  r := pg_temp.run(v_reader, format('select public.aqlam_add_comment(%L,%L)', v_id3, 'تعليق فيه سيئ'));
  ASSERT (r->>'ok')::boolean, 'بعد مسح الكلمات التعليق لازم يعدّي: ' || r::text;

  -- ── ١٠) التعليقات والتفاعلات ────────────────────────────────────────────
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{features,comments}', 'false'));
  r := pg_temp.run(v_reader, format('select public.aqlam_add_comment(%L,%L)', v_id3, 'تعليق'));
  ASSERT r->>'error' = 'comments_off', 'التعليقات مقفولة عامةً: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, jsonb_set(jsonb_set(v_cfg, '{limits,commentMax}', '30'), '{limits,commentsPerDay}', '1'));
  r := pg_temp.run(v_reps[1], format('select public.aqlam_add_comment(%L,%L)', v_id3, repeat('ع', 31)));
  ASSERT r->>'error' = 'invalid', 'تعليق ٣١ والحد ٣٠: ' || r::text;
  r := pg_temp.run(v_reps[1], format('select public.aqlam_add_comment(%L,%L)', v_id3, 'تعليق أول'));
  ASSERT (r->>'ok')::boolean, 'تعليق أول: ' || r::text;
  r := pg_temp.run(v_reps[1], format('select public.aqlam_add_comment(%L,%L)', v_id3, 'تعليق تاني'));
  ASSERT r->>'error' = 'rate_limited', 'حد التعليقات ١: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{features,reactions}', 'false'));
  r := pg_temp.run(v_reader, format('select public.aqlam_set_reaction(%L,%L,true)', v_id3, 'heart'));
  ASSERT r->>'error' = 'reactions_off', 'التفاعلات مقفولة عامةً: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);
  r := pg_temp.run(v_reader, format('select public.aqlam_set_reaction(%L,%L,true)', v_id3, 'star'));
  ASSERT (r->>'ok')::boolean, 'ملصق نجمة: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{reactions}', (
         SELECT jsonb_agg(CASE WHEN x->>'key' = 'star' THEN jsonb_set(x, '{enabled}', 'false') ELSE x END)
           FROM jsonb_array_elements(v_cfg->'reactions') x)));
  r := pg_temp.run(v_reps[2], format('select public.aqlam_set_reaction(%L,%L,true)', v_id3, 'star'));
  ASSERT r->>'error' = 'reaction_disabled', 'ملصق متعطّل عدّى: ' || r::text;
  r := pg_temp.run(v_reps[2], format('select public.aqlam_set_reaction(%L,%L,true)', v_id3, 'heart'));
  ASSERT (r->>'ok')::boolean, 'ملصق قلب لازم يشتغل: ' || r::text;
  r := pg_temp.run(v_reader, format('select public.aqlam_set_reaction(%L,%L,false)', v_id3, 'star'));
  ASSERT (r->>'ok')::boolean, 'شيل ملصق متعطّل لازم يتسمح: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{limits,reactionsPerDay}', '10'));
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- ── ١١) تعديل الكاتب وشيله ─────────────────────────────────────────────
  PERFORM pg_temp.cfg(v_admin, jsonb_set(jsonb_set(v_cfg, '{features,selfEdit}', 'false'), '{features,selfRemove}', 'false'));
  r := pg_temp.run(v_w1, format('select public.aqlam_update_post(%L,%L,%L,%L,false,true)', v_id, 'جديد', v_text, 'story'));
  ASSERT r->>'error' = 'editing_closed', 'التعديل مقفول: ' || r::text;
  r := pg_temp.run(v_w1, format('select public.aqlam_remove_own_post(%L)', v_id));
  ASSERT r->>'error' = 'removal_closed', 'الشيل مقفول: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);
  r := pg_temp.run(v_w1, format('select public.aqlam_update_post(%L,%L,%L,%L,false,true)', v_id, 'غيمة جديدة', v_text, 'story'));
  ASSERT (r->>'ok')::boolean, 'التعديل بعد الفتح: ' || r::text;

  -- ── ١٢) الفهرسة في جوجل ────────────────────────────────────────────────
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{features,googleIndexing}', 'false'));
  r := pg_temp.pub(v_w1, 'فهرسة', v_text, 'story', 'first_name', NULL, true);
  ASSERT (r->>'ok')::boolean, 'نشر بإذن فهرسة: ' || r::text;
  ASSERT (SELECT allow_indexing FROM public.aqlam_posts WHERE id = (r->>'id')::uuid) = false,
    'الفهرسة مقفولة لكن النص اتفهرس';
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- ── ١٣) البلاغات: الحد والأسباب والحد اليومي ────────────────────────────
  r := pg_temp.pub(v_w2, 'للبلاغ', 'نص نضيف تمامًا وكله كلام طيب عن النجوم', 'story', 'first_name', NULL);
  v_id3 := (r->>'id')::uuid;
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{moderation,reportsToAutoHide}', '2'));
  r := pg_temp.run(v_reps[1], format('select public.aqlam_report(''post'',%L,''other'',null)', v_id3));
  ASSERT (r->>'ok')::boolean AND NOT (r->>'auto_hidden')::boolean, 'بلاغ ١ من ٢: ' || r::text;
  r := pg_temp.run(v_reps[2], format('select public.aqlam_report(''post'',%L,''other'',null)', v_id3));
  ASSERT (r->>'auto_hidden')::boolean, 'بلاغ ٢ لازم يخفي: ' || r::text;

  -- الحد صفر = مفيش إخفاء تلقائي
  r := pg_temp.pub(v_w2, 'للبلاغ ٢', 'نص نضيف تمامًا وكله كلام طيب عن البحر', 'story', 'first_name', NULL);
  v_id3 := (r->>'id')::uuid;
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{moderation,reportsToAutoHide}', '0'));
  FOR v_i IN 1..3 LOOP
    r := pg_temp.run(v_reps[v_i], format('select public.aqlam_report(''post'',%L,''other'',null)', v_id3));
    ASSERT (r->>'ok')::boolean AND NOT (r->>'auto_hidden')::boolean, 'بلاغ ' || v_i || ' والإخفاء مقفول: ' || r::text;
  END LOOP;
  ASSERT (SELECT status FROM public.aqlam_posts WHERE id = v_id3) = 'published', 'اتخبّى والحد صفر';

  -- سبب متعطّل وحد يومي
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{reportReasons}', (
         SELECT jsonb_agg(CASE WHEN x->>'key' = 'copied' THEN jsonb_set(x, '{enabled}', 'false') ELSE x END)
           FROM jsonb_array_elements(v_cfg->'reportReasons') x)));
  r := pg_temp.run(v_reader, format('select public.aqlam_report(''post'',%L,''copied'',null)', v_id3));
  ASSERT r->>'error' = 'invalid', 'سبب بلاغ متعطّل عدّى: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{limits,reportsPerDay}', '1'));
  r := pg_temp.run(v_reader, format('select public.aqlam_report(''post'',%L,''other'',null)', v_id3));
  ASSERT (r->>'ok')::boolean, 'بلاغ أول من القارئ: ' || r::text;
  r := pg_temp.run(v_reader, format('select public.aqlam_report(''post'',%L,''other'',null)', v_id));
  ASSERT r->>'error' = 'rate_limited', 'حد البلاغات ١: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- ── ١٤) حد المثبّت ─────────────────────────────────────────────────────
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{moderation,maxPinned}', '2'));
  FOR v_i IN 1..3 LOOP
    r := pg_temp.pub(v_w1, 'مثبّت ' || v_i, v_text, 'story', 'first_name', NULL);
    v_id3 := (r->>'id')::uuid;
    r := pg_temp.run(v_admin, format('select public.aqlam_set_pin(%L,''pin'')', v_id3));
    IF v_i <= 2 THEN ASSERT (r->>'ok')::boolean, 'تثبيت ' || v_i || ': ' || r::text;
    ELSE ASSERT r->>'error' = 'pin_limit', 'الحد ٢: ' || r::text; END IF;
  END LOOP;
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- ── ١٥) مسح المشال بمدة الإعداد ─────────────────────────────────────────
  r := pg_temp.pub(v_w1, 'هيتشال قديم', v_text, 'story', 'first_name', NULL);
  v_id2 := (r->>'id')::uuid;
  r := pg_temp.pub(v_w1, 'هيتشال جديد', v_text, 'story', 'first_name', NULL);
  v_id3 := (r->>'id')::uuid;
  UPDATE public.aqlam_posts SET status = 'removed', removed_at = now() - interval '3 days' WHERE id = v_id2;
  UPDATE public.aqlam_posts SET status = 'removed', removed_at = now() - interval '1 day' WHERE id = v_id3;
  r := public.aqlam_purge_removed();  -- الافتراضي ٧ أيام: مفيش حاجة تتمسح
  ASSERT (r->>'posts')::integer = 0, 'مسح بالافتراضي ٧ أيام: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, jsonb_set(v_cfg, '{moderation,removedRetentionDays}', '2'));
  r := public.aqlam_purge_removed();
  ASSERT (r->>'posts')::integer = 1, 'مسح بمدة الإعداد (يومين): ' || r::text;
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_posts WHERE id = v_id2), 'القديم ما اتمسحش';
  ASSERT EXISTS (SELECT 1 FROM public.aqlam_posts WHERE id = v_id3), 'الجديد اتمسح بدري';
  r := public.aqlam_purge_removed(1);  -- رقم صريح بيتغلّب على الإعداد
  ASSERT (r->>'posts')::integer = 0, 'مسح بيوم واحد: ' || r::text;
  PERFORM pg_temp.cfg(v_admin, v_cfg);

  -- ── ١٦) رجوع للافتراضي ─────────────────────────────────────────────────
  -- التصنيف المخصّص ماينفعش يتشال وعليه نص؛ بعد مسح النص بيرجع الافتراضي عادي.
  r := pg_temp.save(v_admin, public.aqlam_default_config());
  ASSERT r->>'error' = 'category_in_use', 'حفظ الافتراضي وعليه نصوص دراما: ' || r::text;
  DELETE FROM public.aqlam_posts WHERE category = 'drama';
  r := pg_temp.save(v_admin, public.aqlam_default_config());
  ASSERT (r->>'ok')::boolean, 'حفظ الافتراضي: ' || r::text;
  ASSERT (SELECT value FROM public.aqlam_config WHERE id) = public.aqlam_default_config(),
    'الإعداد النهائي مش الافتراضي';
  ASSERT (SELECT updated_by FROM public.aqlam_config WHERE id) = v_admin, 'updated_by ما اتسجّلش';

  RAISE NOTICE 'aqlam_config: OK';
END $$;

ROLLBACK;
