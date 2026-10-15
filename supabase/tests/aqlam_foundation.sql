-- أقلام الرحلة — اختبار الأساس (الجداول والسياسات والدوال).
-- يتشغّل على قاعدة محلية أو staging فقط. كل البيانات التجريبية بتتراجع في الآخر
-- (ROLLBACK). مايتشغّلش على production.
--
-- التشغيل: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/aqlam_foundation.sql
-- النجاح: بيطبع «aqlam_foundation: OK» ويخلص من غير خطأ.
--
-- كل فحص بـ ASSERT برسالة بتقول إيه اللي اتكسر.
-- تبديل المستخدم: set_config('request.jwt.claim.sub', …) + SET LOCAL ROLE.
BEGIN;

DO $$
DECLARE
  v_admin   uuid := gen_random_uuid();
  v_guard   uuid := gen_random_uuid();   -- ولي أمر
  v_teen    uuid := gen_random_uuid();   -- حساب ابن عنده 14 سنة
  v_kid     uuid := gen_random_uuid();   -- حساب ابن عنده 8 سنين
  v_adult   uuid := gen_random_uuid();   -- حساب مستقل
  v_teacher uuid := gen_random_uuid();   -- مدرب
  v_reader  uuid := gen_random_uuid();
  v_r2      uuid := gen_random_uuid();
  v_r3      uuid := gen_random_uuid();
  v_other   uuid := gen_random_uuid();   -- ولي أمر تاني
  v_busy    uuid := gen_random_uuid();   -- لاختبار حد النشر اليومي
  v_doc     uuid := gen_random_uuid();
  v_alien   uuid := gen_random_uuid();   -- مستند حد تاني
  v_teen_child text := 'aq-teen-' || substr(gen_random_uuid()::text, 1, 8);
  v_kid_child  text := 'aq-kid-'  || substr(gen_random_uuid()::text, 1, 8);
  v_text    text := 'كان يا ما كان في قرية صغيرة بنت اسمها نور وكانت بتحب الغيم';
  r         jsonb;
  v_post    uuid;
  v_kid_post uuid;
  v_teen_post uuid;
  v_cmt     uuid;
  n         integer;
  v_cols    text;
BEGIN
  -- ── بيانات تجريبية (بصلاحية صاحب القاعدة) ─────────────────────────────────
  INSERT INTO public.user_profiles(id, full_name, role) VALUES
    (v_admin,   'Aqlam Admin',            'super_admin'),
    (v_guard,   'ولي أمر تجريبي',         'customer'),
    (v_teen,    'سلمى أحمد',              'student'),
    (v_kid,     'يوسف أحمد',              'student'),
    (v_adult,   'منى الكاتبة سالم',       'customer'),
    (v_teacher, 'مدرب تجريبي',            'instructor'),
    (v_reader,  'قارئ أول',               'customer'),
    (v_r2,      'قارئ تاني',              'customer'),
    (v_r3,      'قارئ تالت',              'customer'),
    (v_other,   'ولي أمر تاني',           'customer'),
    (v_busy,    'كاتب نشيط',              'customer');

  INSERT INTO public.child_profiles(id, user_profile_id, full_name, birth_date, account_profile_id) VALUES
    (v_teen_child, v_guard, 'سلمى أحمد', (current_date - interval '14 years')::date, v_teen::text),
    (v_kid_child,  v_guard, 'يوسف أحمد', (current_date - interval '8 years')::date,  v_kid::text);

  INSERT INTO public.instructors(id, user_id, display_name, bio, specialties, years_experience, status, work_model)
  VALUES ('aq-i-' || substr(v_teacher::text, 1, 8), v_teacher, 'أ. مدرب الكتابة', 'x', ARRAY['writing'], 1, 'active', 'per_session');

  INSERT INTO public.portfolio_documents(id, student_id, title, content) VALUES
    (v_doc,   v_adult, 'مستندي', 'محتوى'),
    (v_alien, v_other, 'مستند غيري', 'محتوى');

  -- ── ١) التشغيل مقفول = كل حاجة مرفوضة ───────────────────────────────────
  DELETE FROM public.site_settings WHERE key = 'general';
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('عنوان', v_text, 'story', 'first_name', NULL, false, true, NULL,
         (current_date - interval '30 years')::date, 'v1');
  ASSERT r->>'error' = 'disabled', 'العلم مقفول لكن النشر عدّى: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- ── ٢) تجريبي: قايمة مسموحة ──────────────────────────────────────────────
  INSERT INTO public.site_settings(key, value) VALUES ('general',
    jsonb_build_object('aqlamMode', 'pilot', 'aqlamAllowlist', jsonb_build_array(v_adult::text)));
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('عنوان', v_text, 'story', 'first_name', NULL, false, true, NULL,
         (current_date - interval '30 years')::date, 'v1');
  ASSERT r->>'error' = 'disabled', 'حساب برّه القايمة المسموحة نشر في التجريبي: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- ── ٣) حساب مستقل: تاريخ الميلاد مرة واحدة ─────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('عنوان', v_text, 'story', 'first_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT r->>'error' = 'birthdate_required', 'أول نشر من غير تاريخ ميلاد عدّى: ' || r::text;
  r := public.aqlam_publish_post('عنوان', v_text, 'story', 'first_name', NULL, false, true, NULL,
         (current_date - interval '10 years')::date, 'v1');
  ASSERT r->>'error' = 'too_young', 'حساب مستقل أقل من 12 نشر: ' || r::text;
  r := public.aqlam_publish_post('عنوان', v_text, 'story', 'first_name', NULL, false, true, NULL,
         (current_date + interval '1 day')::date, 'v1');
  ASSERT r->>'error' = 'invalid_birthdate', 'تاريخ ميلاد في المستقبل عدّى: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT NOT EXISTS (SELECT 1 FROM public.aqlam_writer_profiles WHERE user_id = v_adult),
    'تاريخ ميلاد مرفوض اتسجّل';

  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  -- مستند حد تاني ما ينفعش يبقى مصدر
  r := public.aqlam_publish_post('عنوان', v_text, 'story', 'first_name', NULL, false, true, v_alien,
         (current_date - interval '30 years')::date, 'v1');
  ASSERT r->>'error' = 'invalid_source', 'مستند حد تاني اتقبل كمصدر: ' || r::text;
  -- نشر ناجح، بالاسم القلمي وبإذن جوجل
  r := public.aqlam_publish_post('غيمة صغيرة', v_text, 'story', 'pen_name', 'قمر  الليل', true, true, v_doc,
         (current_date - interval '30 years')::date, 'v1');
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'published' AND r->>'age_group' = '12_plus',
    'نشر ١٢+ مباشر فشل: ' || r::text;
  v_post := (r->>'id')::uuid;
  -- التاني من غير تاريخ ميلاد (اتسجّل خلاص)
  r := public.aqlam_publish_post('نص تاني', v_text, 'poem', 'full_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT (r->>'ok')::boolean, 'النشر التاني طلب تاريخ ميلاد تاني: ' || r::text;
  EXECUTE 'RESET ROLE';

  ASSERT (SELECT display_name FROM public.aqlam_posts WHERE id = v_post) = 'قمر الليل', 'الاسم القلمي ما اتنضّفش';
  ASSERT (SELECT allow_indexing FROM public.aqlam_posts WHERE id = v_post), 'إذن جوجل ١٢+ ما اتسجّلش';
  ASSERT (SELECT age_band FROM public.aqlam_posts WHERE id = v_post) IS NULL, 'عمر 30 المفروض خارج فئات العرض';

  -- تاريخ الميلاد مايتغيّرش بعد التسجيل
  BEGIN
    UPDATE public.aqlam_writer_profiles SET birth_date = (current_date - interval '40 years')::date
     WHERE user_id = v_adult;
    ASSERT false, 'تاريخ الميلاد اتغيّر بعد التسجيل';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- ── ٤) بيانات التواصل ────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('كلمني 01012345678', v_text, 'story', 'first_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT r->>'error' = 'contact_info', 'رقم تليفون في العنوان عدّى: ' || r::text;
  r := public.aqlam_publish_post('عنوان', v_text || ' ahmed@example.com', 'story', 'first_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT r->>'error' = 'contact_info', 'بريد في النص عدّى: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- ── ٥) حد النشر اليومي: ٣ ───────────────────────────────────────────────
  UPDATE public.site_settings SET value = jsonb_build_object('aqlamMode', 'public') WHERE key = 'general';
  PERFORM set_config('request.jwt.claim.sub', v_busy::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  FOR i IN 1..3 LOOP
    r := public.aqlam_publish_post('نص ' || i, v_text, 'story', 'first_name', NULL, false, true, NULL,
           (current_date - interval '20 years')::date, 'v1');
    ASSERT (r->>'ok')::boolean, 'النشر رقم ' || i || ' فشل: ' || r::text;
  END LOOP;
  r := public.aqlam_publish_post('نص 4', v_text, 'story', 'first_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT r->>'error' = 'rate_limited', 'النص الرابع في اليوم عدّى: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- ── ٦) ابن أقل من ١٢: ولي الأمر ثم الإدارة ──────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_kid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('حكاية يوسف', v_text, 'story', 'full_name', NULL, true, true, NULL, NULL, 'v1');
  ASSERT r->>'error' = 'invalid_name', 'طفل أقل من 12 استخدم الاسم الكامل: ' || r::text;
  r := public.aqlam_publish_post('حكاية يوسف', v_text, 'story', 'first_name', NULL, true, true, NULL, NULL, 'v1');
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'pending_guardian' AND r->>'age_group' = 'under_12',
    'نص طفل أقل من 12 مش بانتظار ولي الأمر: ' || r::text;
  v_kid_post := (r->>'id')::uuid;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT display_name FROM public.aqlam_posts WHERE id = v_kid_post) = 'يوسف', 'الاسم الأول بس لأقل من 12';
  ASSERT NOT (SELECT allow_indexing FROM public.aqlam_posts WHERE id = v_kid_post), 'نص أقل من 12 اتسمح له بجوجل';
  ASSERT (SELECT age_band FROM public.aqlam_posts WHERE id = v_kid_post) = '6-9', 'فئة عرض الطفل غلط';
  ASSERT EXISTS (SELECT 1 FROM public.notifications
                  WHERE recipient_profile_id = v_guard::text AND link = '/account/family/aqlam'),
    'ولي الأمر ما وصلوش إشعار بالنص';

  -- مش ظاهر للعامة قبل الموافقة
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.aqlam_public_posts WHERE id = v_kid_post;
  ASSERT n = 0, 'نص بانتظار ولي الأمر ظاهر للزوار';
  EXECUTE 'RESET ROLE';

  -- ولي أمر تاني مايقدرش يوافق
  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_guardian_decide(v_kid_post, true);
  ASSERT r->>'error' = 'forbidden', 'ولي أمر غريب وافق على نص: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- ولي الأمر الحقيقي يشوف النص ويوافق
  PERFORM set_config('request.jwt.claim.sub', v_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.aqlam_posts WHERE id = v_kid_post;
  ASSERT n = 1, 'ولي الأمر ما شافش نص ابنه';
  r := public.aqlam_guardian_decide(v_kid_post, true);
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'pending_review', 'موافقة ولي الأمر فشلت: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT EXISTS (SELECT 1 FROM public.notifications
                  WHERE recipient_profile_id = v_admin::text AND link = '/dashboard/admin/aqlam'),
    'الإدارة ما وصلهاش إشعار بنص بانتظار المراجعة';

  -- لسه مش ظاهر: ينتظر الإدارة
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.aqlam_public_posts WHERE id = v_kid_post;
  ASSERT n = 0, 'نص بانتظار الإدارة ظاهر للزوار';
  EXECUTE 'RESET ROLE';

  -- مراجعة: غير الإدارة ممنوعة
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_moderate_post(v_kid_post, 'approve', NULL);
  ASSERT r->>'error' = 'forbidden', 'قارئ عادي راجع نص: ' || r::text;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_moderate_post(v_kid_post, 'approve', NULL);
  ASSERT (r->>'ok')::boolean, 'اعتماد الإدارة فشل: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT EXISTS (SELECT 1 FROM public.notifications
                  WHERE recipient_profile_id = v_kid::text AND title LIKE 'نصك اتنشر%'),
    'الكاتب ما وصلوش إشعار بالاعتماد';

  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.aqlam_public_posts WHERE id = v_kid_post;
  ASSERT n = 1, 'نص معتمد مش ظاهر للزوار';
  EXECUTE 'RESET ROLE';
  -- المقتطف في القوائم محدود
  ASSERT (SELECT max(char_length(excerpt)) FROM public.aqlam_public_posts) <= 280, 'المقتطف أطول من 280';

  -- ── ٧) ابن ١٢+ ينشر مباشرة، وولي الأمر يقدر يقفل ────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_teen::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('خاطرة سلمى', v_text, 'reflection', 'full_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT (r->>'ok')::boolean AND r->>'status' = 'published' AND r->>'age_group' = '12_plus',
    'ابن 14 سنة ما نشرش مباشرة: ' || r::text;
  v_teen_post := (r->>'id')::uuid;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT age_band FROM public.aqlam_posts WHERE id = v_teen_post) = '13-17', 'فئة ابن 14 غلط';

  PERFORM set_config('request.jwt.claim.sub', v_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_guardian_settings(v_teen_child, false, true);
  ASSERT (r->>'ok')::boolean, 'ولي الأمر ما قدرش يقفل النشر: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_guardian_settings(v_teen_child, true, true);
  ASSERT r->>'error' = 'forbidden', 'ولي أمر غريب غيّر قفل طفل مش بتاعه: ' || r::text;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_teen::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('خاطرة تانية', v_text, 'reflection', 'first_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT r->>'error' = 'guardian_locked', 'قفل ولي الأمر ما منعش النشر: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- ── ٨) الملصقات ──────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_reaction(v_post, 'heart', true);
  ASSERT (r->>'ok')::boolean AND (r->>'reaction_count')::int = 1, 'ملصق أول: ' || r::text;
  r := public.aqlam_set_reaction(v_post, 'heart', true);
  ASSERT (r->>'reaction_count')::int = 1, 'نفس الملصق مرتين اتعدّ مرتين: ' || r::text;
  r := public.aqlam_set_reaction(v_post, 'star', true);
  ASSERT (r->>'reaction_count')::int = 2, 'نوع تاني من نفس الحساب: ' || r::text;
  r := public.aqlam_set_reaction(v_post, 'heart', false);
  ASSERT (r->>'reaction_count')::int = 1, 'شيل الملصق: ' || r::text;
  r := public.aqlam_set_reaction(v_post, 'poop', true);
  ASSERT r->>'error' = 'invalid', 'نوع ملصق غريب اتقبل: ' || r::text;
  -- كتابة مباشرة على الجدول ممنوعة
  BEGIN
    INSERT INTO public.aqlam_reactions(post_id, user_id, kind) VALUES (v_post, v_reader, 'spark');
    ASSERT false, 'إدخال مباشر في جدول الملصقات عدّى';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  -- ── ٩) التعليقات ─────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_add_comment(v_kid_post, 'جميل جدًا يا يوسف');
  ASSERT r->>'error' = 'comments_restricted', 'قارئ عادي علّق على نص أقل من 12: ' || r::text;
  r := public.aqlam_add_comment(v_post, 'كلموني 01012345678');
  ASSERT r->>'error' = 'contact_info', 'تعليق فيه رقم عدّى: ' || r::text;
  r := public.aqlam_add_comment(v_post, 'عجبتني صورة الغيم جدًا');
  ASSERT (r->>'ok')::boolean, 'تعليق على نص ١٢+ فشل: ' || r::text;
  v_cmt := (r->>'id')::uuid;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT comment_count FROM public.aqlam_posts WHERE id = v_post) = 1, 'عدّاد التعليقات';
  ASSERT (SELECT author_display_name FROM public.aqlam_comments WHERE id = v_cmt) = 'قارئ', 'تعليق القارئ لازم باسمه الأول بس';

  -- المدرب يعلّق على نص أقل من 12، وبيتعلّم
  PERFORM set_config('request.jwt.claim.sub', v_teacher::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_add_comment(v_kid_post, 'أحسنت يا يوسف، استمر');
  ASSERT (r->>'ok')::boolean, 'المدرب ما قدرش يعلّق على نص طفل: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT is_instructor FROM public.aqlam_comments WHERE id = (r->>'id')::uuid), 'تعليق المدرب مش معلّم';

  -- حساب أقل من 12 مايعلّقش
  PERFORM set_config('request.jwt.claim.sub', v_kid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_add_comment(v_post, 'تعليق من طفل');
  ASSERT r->>'error' = 'too_young', 'حساب 8 سنين علّق: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- قفل التعليقات على الابن
  PERFORM set_config('request.jwt.claim.sub', v_guard::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_guardian_settings(v_teen_child, true, false);
  ASSERT (r->>'ok')::boolean, 'قفل التعليقات: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_add_comment(v_teen_post, 'نص جميل');
  ASSERT r->>'error' = 'guardian_locked', 'قفل التعليقات ما منعش: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- ── ١٠) البلاغات: ٣ حسابات = إخفاء تلقائي ───────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_report('post', v_post, 'inappropriate', NULL);
  ASSERT (r->>'ok')::boolean AND NOT (r->>'auto_hidden')::boolean, 'بلاغ أول: ' || r::text;
  r := public.aqlam_report('post', v_post, 'inappropriate', NULL);
  ASSERT (r->>'already')::boolean, 'نفس البلاغ مرتين: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_r2::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_report('post', v_post, 'bullying', NULL);
  ASSERT NOT (r->>'auto_hidden')::boolean, 'إخفاء بعد بلاغين: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_r3::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_report('post', v_post, 'other', 'تفاصيل');
  ASSERT (r->>'auto_hidden')::boolean, 'ما اتخباش بعد 3 بلاغات: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT status FROM public.aqlam_posts WHERE id = v_post) = 'hidden', 'حالة النص بعد البلاغات';

  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.aqlam_public_posts WHERE id = v_post;
  ASSERT n = 0, 'نص مخفي ظاهر للزوار';
  SELECT count(*) INTO n FROM public.aqlam_public_comments WHERE post_id = v_post;
  ASSERT n = 0, 'تعليقات نص مخفي ظاهرة للزوار';
  EXECUTE 'RESET ROLE';

  -- الإدارة ترجّعه، وتخفي تعليق
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_moderate_post(v_post, 'restore', NULL);
  ASSERT (r->>'ok')::boolean, 'استرجاع النص: ' || r::text;
  r := public.aqlam_moderate_comment(v_cmt, 'hide');
  ASSERT (r->>'ok')::boolean, 'إخفاء التعليق: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT (SELECT comment_count FROM public.aqlam_posts WHERE id = v_post) = 0, 'عدّاد التعليقات بعد الإخفاء';

  -- ── ١١) القراءة العامة: بلا writer_id ─────────────────────────────────────
  SELECT string_agg(column_name, ',') INTO v_cols
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'aqlam_public_posts';
  ASSERT v_cols NOT LIKE '%writer_id%' AND v_cols NOT LIKE '%birth%' AND v_cols NOT LIKE '%guardian%',
    'الـview العامة فيها بيانات حساب: ' || v_cols;

  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM 1 FROM public.aqlam_posts LIMIT 1;
    ASSERT false, 'الزائر قرا جدول النصوص مباشرة';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  -- قارئ مسجّل مايشوفش نصوص غيره من الجدول (بيشوفها من الـview)
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.aqlam_posts;
  ASSERT n = 0, 'قارئ مسجّل شاف ' || n || ' نص من الجدول';
  SELECT count(*) INTO n FROM public.aqlam_public_posts;
  ASSERT n >= 2, 'القارئ ما شافش النصوص المنشورة من الـview';
  EXECUTE 'RESET ROLE';

  -- ── حالة الحساب لصفحة النشر ──────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_kid::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_my_status();
  ASSERT r->>'age_group' = 'under_12' AND (r->>'is_child')::boolean AND NOT (r->>'needs_birthdate')::boolean,
    'حالة حساب الطفل: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_my_status();
  ASSERT (r->>'needs_birthdate')::boolean AND r->>'age_group' IS NULL AND r->>'enabled' = 'true',
    'حالة حساب مستقل جديد: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_teen::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_my_status();
  -- (ولي الأمر رجّع النشر مفتوح وقفل التعليقات بس قبل كده)
  ASSERT NOT (r->>'publishing_locked')::boolean, 'حالة ابن 14: ' || r::text;
  EXECUTE 'RESET ROLE';

  -- إيقاف نوع «aqlam» من شاشة الإشعارات = مفيش إشعار جديد
  INSERT INTO public.site_settings(key, value) VALUES ('notifications', jsonb_build_object('disabled', jsonb_build_array('aqlam')));
  SELECT count(*) INTO n FROM public.notifications;
  PERFORM public.aqlam_notify(v_guard::text, 'تجربة', 'x', '/aqlam');
  ASSERT (SELECT count(*) FROM public.notifications) = n, 'إشعار اتبعت والنوع موقوف';
  DELETE FROM public.site_settings WHERE key = 'notifications';
  PERFORM public.aqlam_notify(v_guard::text, 'تجربة', 'x', '/aqlam');
  ASSERT (SELECT count(*) FROM public.notifications) = n + 1, 'إشعار ماتبعتش والنوع شغّال';

  -- ── ١٢) «شيل» + الحذف مالوش علاقة بالمستند الأصلي ───────────────────────
  DELETE FROM public.portfolio_documents WHERE id = v_doc;   -- مسح المستند الأصلي
  ASSERT (SELECT status FROM public.aqlam_posts WHERE id = v_post) = 'published',
    'مسح المستند الأصلي أثّر على المنشور';

  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_remove_own_post(v_post);
  ASSERT r->>'error' = 'not_found', 'قارئ شال نص غيره: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_remove_own_post(v_post);
  ASSERT (r->>'ok')::boolean, 'الكاتب ما قدرش يشيل نصه: ' || r::text;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.aqlam_public_posts WHERE id = v_post;
  ASSERT n = 0, 'نص اتشال لسه ظاهر';
  EXECUTE 'RESET ROLE';

  -- ── ١٣) العقوبات ─────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_sanction_user(v_adult, 'permanent', 'تجربة');
  ASSERT r->>'error' = 'forbidden', 'قارئ وقّع عقوبة: ' || r::text;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_sanction_user(v_adult, 'warning', 'تنبيه');
  ASSERT (r->>'ok')::boolean, 'تنبيه: ' || r::text;
  EXECUTE 'RESET ROLE';
  ASSERT NOT public.aqlam_is_suspended(v_adult), 'التنبيه وقّف الحساب';
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_sanction_user(v_adult, 'suspension_7d', 'إيقاف');
  EXECUTE 'RESET ROLE';
  ASSERT public.aqlam_is_suspended(v_adult), 'الإيقاف ما اشتغلش';
  PERFORM set_config('request.jwt.claim.sub', v_adult::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_publish_post('بعد الإيقاف', v_text, 'story', 'first_name', NULL, false, true, NULL, NULL, 'v1');
  ASSERT r->>'error' = 'suspended', 'حساب موقوف نشر: ' || r::text;
  EXECUTE 'RESET ROLE';
  UPDATE public.aqlam_sanctions SET expires_at = now() - interval '1 minute' WHERE user_id = v_adult AND kind = 'suspension_7d';
  ASSERT NOT public.aqlam_is_suspended(v_adult), 'إيقاف منتهي لسه شغّال';

  -- ── ١٤) الإيقاف الطارئ: العلم يقفل حتى الإدارة والقراءة ─────────────────
  UPDATE public.site_settings SET value = jsonb_build_object('aqlamMode', 'off') WHERE key = 'general';
  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO n FROM public.aqlam_public_posts;
  ASSERT n = 0, 'القراءة العامة شغالة والعلم مقفول';
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.aqlam_set_reaction(v_teen_post, 'heart', true);
  ASSERT r->>'error' = 'disabled', 'تفاعل والعلم مقفول: ' || r::text;
  -- لكن الإدارة تقدر تراجع وهو مقفول
  r := public.aqlam_moderate_post(v_teen_post, 'hide', 'تجربة');
  ASSERT (r->>'ok')::boolean, 'الإدارة ما قدرتش تراجع والعلم مقفول: ' || r::text;
  EXECUTE 'RESET ROLE';
  UPDATE public.site_settings SET value = jsonb_build_object('aqlamMode', 'public') WHERE key = 'general';

  -- ── ١٥) فلتر بيانات التواصل في القاعدة ───────────────────────────────────
  ASSERT public.aqlam_contains_contact('01012345678'), 'رقم متصل';
  ASSERT public.aqlam_contains_contact('٠١٠١٢٣٤٥٦٧٨'), 'أرقام هندية';
  ASSERT public.aqlam_contains_contact('٠١٠ ١٢٣ ٤٥٦ ٧٨'), 'أرقام مفصولة';
  ASSERT public.aqlam_contains_contact('010-1234-5678'), 'أرقام بشرط';
  ASSERT public.aqlam_contains_contact('a@b.com'), 'بريد';
  ASSERT public.aqlam_contains_contact('ahmed (at) example dot com'), 'بريد مموّه';
  ASSERT public.aqlam_contains_contact('https://example.com'), 'رابط';
  ASSERT public.aqlam_contains_contact('mysite.com'), 'دومين';
  ASSERT public.aqlam_contains_contact('تابعوني @sara_writes'), 'اسم حساب';
  ASSERT NOT public.aqlam_contains_contact('بين 2024 و 2025 و 2026'), 'سنين اتحسبت تليفون';
  ASSERT NOT public.aqlam_contains_contact('٢٠٢٤ ٢٠٢٥ ٢٠٢٦'), 'سنين هندية اتحسبت تليفون';
  ASSERT NOT public.aqlam_contains_contact('كان عندي 10 قطط و3 كلاب'), 'أرقام صغيرة اتحجبت';
  ASSERT NOT public.aqlam_contains_contact(v_text), 'نص أدبي عادي اتحجب';
  ASSERT NOT public.aqlam_contains_contact('وصلت البيت.وبعدين نمت'), 'نقطة بين جملتين اتحسبت دومين';

  -- ── ١٦) السن ─────────────────────────────────────────────────────────────
  ASSERT public.aqlam_age_on('2014-10-15', '2026-10-15') = 12, 'يوم الميلاد';
  ASSERT public.aqlam_age_on('2014-10-16', '2026-10-15') = 11, 'قبل يوم الميلاد';
  ASSERT public.aqlam_age_of(v_kid) < 12 AND public.aqlam_age_of(v_teen) >= 12, 'سن حسابات الأبناء';
  ASSERT public.aqlam_age_of(v_reader) IS NULL, 'سن مجهول لازم null';
  ASSERT public.aqlam_age_band(9) = '6-9' AND public.aqlam_age_band(10) = '10-12'
     AND public.aqlam_age_band(13) = '13-17' AND public.aqlam_age_band(18) = '18-20'
     AND public.aqlam_age_band(5) IS NULL AND public.aqlam_age_band(21) IS NULL, 'فئات العرض';

  RAISE NOTICE 'aqlam_foundation: OK';
END $$;

ROLLBACK;
