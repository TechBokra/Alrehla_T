-- استوديو القصص — اختبار الأساس (الصلاحيات والأدوار والحرّاس والسياسات).
-- يتشغّل على قاعدة محلية أو staging فقط. كل البيانات التجريبية بتتراجع في الآخر
-- (ROLLBACK). مايتشغّلش على production.
--
-- التشغيل: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/story_studio_foundation.sql
-- النجاح: بيطبع «story_studio_foundation: OK» ويخلص من غير خطأ.
--
-- كل فحص بـ ASSERT برسالة بتقول إيه اللي اتكسر.
-- تبديل المستخدم: set_config('request.jwt.claim.sub', …) + SET LOCAL ROLE.
BEGIN;

-- بيجرّب جملة ويرجّع «كود:رسالة» لو فشلت، أو NULL لو نجحت. بصلاحية المستخدم
-- الحالي (مش security definer) فالسياسات والحرّاس بتتطبّق زي الإنتاج.
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
  v_super    uuid := gen_random_uuid();
  v_manager  uuid := gen_random_uuid();
  v_editor   uuid := gen_random_uuid();
  v_art      uuid := gen_random_uuid();
  v_default  uuid := gen_random_uuid();   -- إداري بالدور الافتراضي (من غير صلاحيات الاستوديو)
  v_customer uuid := gen_random_uuid();
  v_role_mgr uuid; v_role_edt uuid; v_role_art uuid; v_role_def uuid;
  v_order    uuid := gen_random_uuid();
  v_item     uuid := gen_random_uuid();
  v_item_lib uuid := gen_random_uuid();
  v_prod     text := 'st-custom-' || substr(gen_random_uuid()::text, 1, 8);
  v_prod_lib text := 'st-lib-'    || substr(gen_random_uuid()::text, 1, 8);
  v_proj     uuid;
  v_proj2    uuid;
  v_ver      uuid;
  v_page     uuid;
  r          text;
  n          integer;
  s          text;
  k          text;
BEGIN
  -- ── بيانات تجريبية (بصلاحية صاحب القاعدة) ─────────────────────────────────
  SELECT id INTO v_role_mgr FROM public.admin_roles WHERE name = 'مسؤول إنتاج القصص';
  SELECT id INTO v_role_edt FROM public.admin_roles WHERE name = 'محرر قصص';
  SELECT id INTO v_role_art FROM public.admin_roles WHERE name = 'مشرف فني';
  SELECT id INTO v_role_def FROM public.admin_roles WHERE is_default;
  ASSERT v_role_mgr IS NOT NULL AND v_role_edt IS NOT NULL AND v_role_art IS NOT NULL,
    'الأدوار الثلاثة مااتعملتش';

  ASSERT (SELECT permissions FROM public.admin_roles WHERE id = v_role_edt) = ARRAY['canWorkStudio'],
    'صلاحيات «محرر قصص» غلط';
  ASSERT (SELECT permissions FROM public.admin_roles WHERE id = v_role_mgr)
           @> ARRAY['canManageStudio', 'canWorkStudio'],
    'صلاحيات «مسؤول إنتاج القصص» غلط';

  INSERT INTO public.user_profiles(id, full_name, role, admin_role_id) VALUES
    (v_super,    'Studio Super',   'super_admin',        NULL),
    (v_manager,  'Studio Manager', 'general_supervisor', v_role_mgr),
    (v_editor,   'Studio Editor',  'general_supervisor', v_role_edt),
    (v_art,      'Studio Art',     'general_supervisor', v_role_art),
    (v_default,  'Default Admin',  'general_supervisor', NULL),
    (v_customer, 'عميل تجريبي',    'customer',           NULL);

  -- ── ١) قيد الصلاحيات ────────────────────────────────────────────────────
  r := public.__t_try('INSERT INTO public.admin_roles(name, permissions) VALUES (''x-role'', ARRAY[''canDoAnything''])');
  ASSERT r LIKE '23514:%', 'القيد قبل صلاحية مجهولة: ' || coalesce(r, 'نجحت');

  -- ── ٢) admin_has_permission ──────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_super::text, true);
  ASSERT public.admin_has_permission('canWorkStudio') AND public.admin_has_permission('canManageStudio'),
    'مدير النظام لازم ياخد كل الصلاحيات';
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  ASSERT public.admin_has_permission('canManageStudio'), 'مسؤول الإنتاج من غير canManageStudio';
  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  ASSERT public.admin_has_permission('canWorkStudio') AND NOT public.admin_has_permission('canManageStudio'),
    'المحرر لازم يشتغل ومايديرش';
  PERFORM set_config('request.jwt.claim.sub', v_default::text, true);
  ASSERT NOT public.admin_has_permission('canWorkStudio'),
    'الدور الافتراضي ماينفعش ياخد صلاحية الاستوديو تلقائيًا (' ||
    (SELECT array_to_string(permissions, ',') FROM public.admin_roles WHERE id = v_role_def) || ')';
  PERFORM set_config('request.jwt.claim.sub', v_customer::text, true);
  ASSERT NOT public.admin_has_permission('canWorkStudio'), 'عميل ماينفعش ياخد صلاحية';

  -- ── طلب فيه بند مخصّص وبند مكتبة (ملف الاختبار يعطّل حرّاس الطلب بس) ──────
  INSERT INTO public.personalized_products(id, slug, name, category, price)
    VALUES (v_prod, v_prod, 'قصة مخصصة تجريبية', 'custom', 100),
           (v_prod_lib, v_prod_lib, 'كتاب مكتبة تجريبي', 'library', 50);
  INSERT INTO public.orders(id, user_id, total_amount) VALUES (v_order, v_customer, 150);
  INSERT INTO public.order_items(id, order_id, product_id, quantity, unit_price, customization_data)
    VALUES (v_item, v_order, v_prod, 1, 100,
            jsonb_build_object('childName', 'ليلى', 'storyGoal', 'الشجاعة', 'childPhoto', 'https://example.com/p.jpg')),
           (v_item_lib, v_order, v_prod_lib, 1, 50, '{}'::jsonb);

  -- حرّاس الطلب الحالية مش موضوع الاختبار ده — بنعطّلها جوّه المعاملة بس.
  FOR k IN SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'public.orders'::regclass AND NOT tgisinternal
              AND tgname IN ('validate_order_state_transition_trg', 'guard_order_fields_trg') LOOP
    EXECUTE format('ALTER TABLE public.orders DISABLE TRIGGER %I', k);
  END LOOP;

  -- ── ٣) التشغيل مقفول: الدفع مابيعملش مشروع، والإنشاء اليدوي مرفوض ───────────
  DELETE FROM public.site_settings WHERE key = 'general';
  ASSERT public.story_mode() = 'off', 'الافتراضي لازم يكون مقفول';
  UPDATE public.orders SET status = 'paid' WHERE id = v_order;
  SELECT count(*) INTO n FROM public.story_projects;
  ASSERT n = 0, 'الاستوديو مقفول لكن اتعمل مشروع';
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format('SELECT public.story_start_project(%L)', v_item));
  ASSERT r LIKE '55000:%', 'الإنشاء اليدوي عدّى والاستوديو مقفول: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  -- ── ٤) الإنشاء التلقائي عند الدفع ────────────────────────────────────────
  INSERT INTO public.site_settings(key, value) VALUES ('general', jsonb_build_object('studioMode', 'on'));
  ASSERT public.story_mode() = 'on', 'التشغيل ماتقرأش';
  UPDATE public.orders SET status = 'pending' WHERE id = v_order;
  UPDATE public.orders SET status = 'paid' WHERE id = v_order;
  SELECT count(*) INTO n FROM public.story_projects WHERE order_id = v_order;
  ASSERT n = 1, 'لازم مشروع واحد بس (للبند المخصّص): ' || n;
  SELECT id INTO v_proj FROM public.story_projects WHERE order_item_id = v_item;
  ASSERT v_proj IS NOT NULL, 'مشروع البند المخصّص ماتعملش';
  ASSERT NOT EXISTS (SELECT 1 FROM public.story_projects WHERE order_item_id = v_item_lib),
    'بند المكتبة اتحوّل لمشروع';
  ASSERT (SELECT status FROM public.story_projects WHERE id = v_proj) = 'brief', 'البداية لازم brief';
  ASSERT (SELECT brief ->> 'childName' FROM public.story_projects WHERE id = v_proj) = 'ليلى',
    'الموجز ماخدش بيانات التخصيص';
  ASSERT NOT ((SELECT brief FROM public.story_projects WHERE id = v_proj) ? 'childPhoto'),
    'صورة الطفل اتنسخت في الموجز';
  -- مرتين من غير تكرار.
  UPDATE public.orders SET status = 'pending' WHERE id = v_order;
  UPDATE public.orders SET status = 'paid' WHERE id = v_order;
  SELECT count(*) INTO n FROM public.story_projects WHERE order_id = v_order;
  ASSERT n = 1, 'الدفع المتكرر عمل مشروع تاني';

  -- ── ٥) RLS: مين يشوف إيه ─────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_customer::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.story_projects;
  ASSERT n = 0, 'العميل شاف مشاريع';
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_default::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.story_projects;
  ASSERT n = 0, 'إداري من غير صلاحية الاستوديو شاف مشاريع';
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.story_projects;
  ASSERT n = 1, 'المحرر مابيشوفش المشروع';
  r := public.__t_try(format('INSERT INTO public.story_projects(order_item_id, order_id, product_id) VALUES (%L, %L, %L)',
                             v_item_lib, v_order, v_prod_lib));
  ASSERT r IS NOT NULL, 'المحرر عمل مشروع بإيده';
  EXECUTE 'RESET ROLE';

  -- التوزيع: مسؤول الإنتاج بس.
  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format('UPDATE public.story_projects SET editor_id = %L WHERE id = %L', v_editor, v_proj));
  ASSERT r LIKE '42501:%', 'المحرر وزّع المشروع على نفسه: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET editor_id = v_editor, art_lead_id = v_art, page_target = 12 WHERE id = v_proj;
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 1, 'مسؤول الإنتاج ماعرفش يوزّع';
  EXECUTE 'RESET ROLE';

  -- ── ٦) التكاليف: مسؤول الإنتاج بس ────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format('INSERT INTO public.story_cost_entries(project_id, kind, amount, created_by) VALUES (%L, ''tool'', 5, %L)', v_proj, v_editor));
  ASSERT r IS NOT NULL, 'المحرر سجّل تكلفة';
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.story_cost_entries(project_id, kind, amount, minutes, created_by)
    VALUES (v_proj, 'tool', 12.5, NULL, v_manager);
  r := public.__t_try(format('INSERT INTO public.story_cost_entries(project_id, kind, amount, created_by) VALUES (%L, ''tool'', 5, %L)', v_proj, v_editor));
  ASSERT r IS NOT NULL, 'تكلفة باسم شخص تاني عدّت';
  SELECT count(*) INTO n FROM public.story_cost_entries;
  ASSERT n = 1, 'مسؤول الإنتاج ماشافش التكلفة';
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.story_cost_entries;
  ASSERT n = 0, 'المحرر شاف التكاليف';
  EXECUTE 'RESET ROLE';

  -- ── ٧) مرحلة النص ────────────────────────────────────────────────────────
  -- المشرف الفني مش محرّر المشروع.
  PERFORM set_config('request.jwt.claim.sub', v_art::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''text_draft'' WHERE id = %L', v_proj));
  ASSERT r LIKE '42501:%', 'المشرف الفني حرّك مرحلة النص: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  -- نسخة النص مش مسموحة قبل مرحلة النص.
  r := public.__t_try(format('INSERT INTO public.story_versions(project_id, version_no, body) VALUES (%L, 1, ''x'')', v_proj));
  ASSERT r LIKE '23514:%', 'نسخة نص في مرحلة الموجز: ' || coalesce(r, 'نجح');
  -- قفز مراحل
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''character'' WHERE id = %L', v_proj));
  ASSERT r LIKE '23514:%', 'قفزة من الموجز للشخصية: ' || coalesce(r, 'نجح');
  UPDATE public.story_projects SET status = 'text_draft' WHERE id = v_proj;
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''text_review'' WHERE id = %L', v_proj));
  ASSERT r LIKE '23514:%', 'مراجعة من غير أي نسخة: ' || coalesce(r, 'نجح');
  INSERT INTO public.story_versions(project_id, version_no, body, source)
    VALUES (v_proj, 1, 'كان يا ما كان بنت اسمها ليلى كانت بتخاف من الضلمة', 'ai')
    RETURNING id INTO v_ver;
  UPDATE public.story_projects SET status = 'text_review' WHERE id = v_proj;
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''client_text_approval'' WHERE id = %L', v_proj));
  ASSERT r LIKE '23514:%', 'موافقة عميل من غير اعتماد محرّر: ' || coalesce(r, 'نجح');
  UPDATE public.story_versions SET status = 'editor_approved' WHERE id = v_ver;
  ASSERT (SELECT approved_by FROM public.story_versions WHERE id = v_ver) = v_editor, 'المعتمِد ماتسجّلش';
  r := public.__t_try(format('UPDATE public.story_versions SET body = ''تعديل'' WHERE id = %L', v_ver));
  ASSERT r LIKE '42501:%', 'تعديل نص معتمد: ' || coalesce(r, 'نجح');
  UPDATE public.story_projects SET status = 'client_text_approval' WHERE id = v_proj;
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''character'' WHERE id = %L', v_proj));
  ASSERT r LIKE '23514:%', 'رسم من غير موافقة العميل: ' || coalesce(r, 'نجح');
  r := public.__t_try(format('UPDATE public.story_versions SET status = ''client_approved'' WHERE id = %L', v_ver));
  ASSERT r LIKE '23514:%', 'موافقة عميل من غير تسجيل إزاي: ' || coalesce(r, 'نجح');
  UPDATE public.story_versions
     SET status = 'client_approved', client_decision_note = 'وافقت الأم على واتساب'
   WHERE id = v_ver;
  EXECUTE 'RESET ROLE';

  -- وجه حقيقي من غير موافقة الصورة.
  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET face_mode = 'real' WHERE id = v_proj;
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''character'' WHERE id = %L', v_proj));
  ASSERT r LIKE '23514:%', 'وجه حقيقي من غير موافقة ولي الأمر: ' || coalesce(r, 'نجح');
  UPDATE public.story_projects SET photo_consent_at = now(), photo_consent_note = 'موافقة مكتوبة' WHERE id = v_proj;
  ASSERT (SELECT photo_consent_by FROM public.story_projects WHERE id = v_proj) = v_editor, 'مين سجّل الموافقة';
  UPDATE public.story_projects SET status = 'character' WHERE id = v_proj;
  EXECUTE 'RESET ROLE';

  -- ── ٨) مرحلة الرسم (المشرف الفني) ────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''scenes'' WHERE id = %L', v_proj));
  ASSERT r LIKE '42501:%', 'المحرر حرّك مرحلة الرسم: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_art::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''scenes'' WHERE id = %L', v_proj));
  ASSERT r LIKE '23514:%', 'مشاهد من غير اعتماد الشخصية: ' || coalesce(r, 'نجح');
  UPDATE public.story_projects
     SET character_notes = 'بنت 8 سنين، شعر مجعد', character_approved_at = now()
   WHERE id = v_proj;
  UPDATE public.story_projects SET status = 'scenes' WHERE id = v_proj;
  INSERT INTO public.story_pages(project_id, page_no, page_text, scene_description)
    VALUES (v_proj, 1, 'ليلى في أوضتها', 'غرفة بنت صغيرة بالليل') RETURNING id INTO v_page;
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''art_review'' WHERE id = %L', v_proj));
  ASSERT r LIKE '23514:%', 'مراجعة رسوم وفيه صفحة منتظرة: ' || coalesce(r, 'نجح');
  UPDATE public.story_pages SET status = 'drafted', image_url = 'https://example.com/p1.png' WHERE id = v_page;
  r := public.__t_try(format('UPDATE public.story_pages SET image_url = ''http://insecure.example/p.png'' WHERE id = %L', v_page));
  ASSERT r LIKE '23514:%', 'رابط صورة غير آمن عدّى: ' || coalesce(r, 'نجح');
  UPDATE public.story_projects SET status = 'art_review' WHERE id = v_proj;
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''layout'' WHERE id = %L', v_proj));
  ASSERT r LIKE '23514:%', 'تركيب وفيه صفحة غير معتمدة: ' || coalesce(r, 'نجح');
  UPDATE public.story_pages SET status = 'approved' WHERE id = v_page;
  -- تعديل صفحة معتمدة بيرجّعها للمراجعة.
  UPDATE public.story_pages SET page_text = 'ليلى في أوضتها الواسعة' WHERE id = v_page;
  ASSERT (SELECT status FROM public.story_pages WHERE id = v_page) = 'drafted', 'تعديل صفحة معتمدة ماردّهاش للمراجعة';
  UPDATE public.story_pages SET status = 'approved' WHERE id = v_page;
  UPDATE public.story_projects SET status = 'layout' WHERE id = v_proj;
  UPDATE public.story_projects SET status = 'qa' WHERE id = v_proj;
  -- الفحص النهائي والتسليم مش للمشرف الفني.
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''ready'' WHERE id = %L', v_proj));
  ASSERT r LIKE '42501:%', 'المشرف الفني سلّم: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  -- ── ٩) فحص الجودة والتسليم (مسؤول الإنتاج) ───────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''ready'' WHERE id = %L', v_proj));
  ASSERT r LIKE '23514:%', 'تسليم بقايمة فحص فاضية: ' || coalesce(r, 'نجح');
  UPDATE public.story_projects
     SET qa_checklist = '{"story_engaging":true,"dialogue_age_fit":true,"art_matches_text":true,"hero_consistent":true,"arabic_text_ok":true,"print_ready":true}'::jsonb,
         sensitive_topic = true
   WHERE id = v_proj;
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''ready'' WHERE id = %L', v_proj));
  ASSERT r LIKE '23514:%', 'موضوع حساس من غير مراجعة متخصص: ' || coalesce(r, 'نجح');
  UPDATE public.story_projects
     SET qa_checklist = qa_checklist || '{"sensitive_review":true}'::jsonb
   WHERE id = v_proj;
  UPDATE public.story_projects SET status = 'ready' WHERE id = v_proj;
  ASSERT (SELECT qa_passed_by FROM public.story_projects WHERE id = v_proj) = v_manager, 'مين اجتاز الفحص';
  UPDATE public.story_projects SET status = 'delivered' WHERE id = v_proj;
  ASSERT (SELECT delivered_at FROM public.story_projects WHERE id = v_proj) IS NOT NULL, 'وقت التسليم';
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''qa'' WHERE id = %L', v_proj));
  ASSERT r LIKE '42501:%', 'مشروع منتهي اتحرّك: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  -- ── ١٠) تعديل نطاق بعد بدء الرسم + الإيقاف المؤقت (مشروع تاني) ───────────
  -- مشروع في مرحلة المشاهد وفيه صفحتين (بصلاحية صاحب القاعدة: الإنشاء مش من الشاشة).
  INSERT INTO public.story_projects(order_item_id, order_id, product_id, status, editor_id, art_lead_id,
                                    character_approved_at)
    SELECT v_item_lib, v_order, v_prod_lib, 'scenes', v_editor, v_art, now()
    RETURNING id INTO v_proj2;
  INSERT INTO public.story_pages(project_id, page_no, page_text, status, attempts) VALUES
    (v_proj2, 1, 'أ', 'drafted', 0),
    (v_proj2, 2, 'ب', 'drafted', 0);
  UPDATE public.story_pages SET status = 'approved' WHERE project_id = v_proj2 AND page_no = 1;

  PERFORM set_config('request.jwt.claim.sub', v_art::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''text_draft'' WHERE id = %L', v_proj2));
  ASSERT r LIKE '42501:%', 'المشرف الفني رجّع النص بعد الرسم: ' || coalesce(r, 'نجح');
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''on_hold'' WHERE id = %L', v_proj2));
  ASSERT r LIKE '42501:%', 'المشرف الفني أوقف المشروع: ' || coalesce(r, 'نجح');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', v_manager::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.story_projects SET status = 'on_hold' WHERE id = v_proj2;
  ASSERT (SELECT held_from FROM public.story_projects WHERE id = v_proj2) = 'scenes', 'الإيقاف ماحفظش المكان';
  r := public.__t_try(format('UPDATE public.story_projects SET status = ''layout'' WHERE id = %L', v_proj2));
  ASSERT r LIKE '23514:%', 'استئناف في مرحلة غير اللي اتوقف فيها: ' || coalesce(r, 'نجح');
  UPDATE public.story_projects SET status = 'scenes' WHERE id = v_proj2;
  ASSERT (SELECT held_from FROM public.story_projects WHERE id = v_proj2) IS NULL, 'held_from فضل بعد الاستئناف';
  -- تعديل نطاق: النص يرجع، والصفحات المجهّزة كلها للمراجعة (مش الكتاب كله من الصفر).
  UPDATE public.story_projects SET status = 'text_draft' WHERE id = v_proj2;
  SELECT count(*) INTO n FROM public.story_pages WHERE project_id = v_proj2 AND status = 'needs_redo';
  ASSERT n = 2, 'تعديل النطاق ماردّش كل الصفحات للمراجعة: ' || n;
  EXECUTE 'RESET ROLE';

  -- ── ١١) الإنشاء التلقائي مايفشّلش الدفع حتى لو الدالة اتكسرت ─────────────
  EXECUTE $q$
    CREATE OR REPLACE FUNCTION public.story_create_project_for_item(p_order_item uuid)
    RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
    BEGIN RAISE EXCEPTION 'boom'; END $f$ $q$;
  UPDATE public.orders SET status = 'pending' WHERE id = v_order;
  UPDATE public.orders SET status = 'paid' WHERE id = v_order;
  ASSERT (SELECT status::text FROM public.orders WHERE id = v_order) = 'paid',
    'خطأ في الإنشاء التلقائي فشّل الدفع';

  RAISE NOTICE 'story_studio_foundation: OK';
END
$$;

ROLLBACK;
