-- ═══════════════════════════════════════════════════════════════
-- منصة الرحلة — تحديثات قاعدة البيانات (٢٤ أكتوبر ٢٠٢٦)
-- ═══════════════════════════════════════════════════════════════
--
-- إزاي تشغّله:
--   Supabase ← مشروع الإنتاج (ruuejyignvuhouhoiiqi) ← SQL Editor
--   ← New query ← الصق الملف كله ← Run.
--
-- الملف كله **عملية واحدة** (begin … commit): لو أي جزء فشل، ولا حاجة
-- بتتطبّق والقاعدة بترجع زي ما كانت. ولو اتشغّل مرتين، المرة التانية
-- مابتغيّرش حاجة.
--
-- الترحيلات بالترتيب (كل واحد ملفه في client/supabase/migrations):
--   ١) 20261023230000_addon_delivery_format       نوع الإضافة: مطبوعة/إلكترونية/الاتنين
--   ٢) 20261023234500_fix_certification_admin_grant  الإدارة تحفظ «التدريب والاعتماد»
--   ٣) 20261024001500_reviews_one_per_booking     تقييم واحد لكل باقة
--   ٤) 20261024090000_package_booking_rules       باقات «قريبًا» + شرط السن
--   ٥) 20261024100000_session_incidents           بلاغات الجلسات
--
-- ⚠️ ملحوظة للمهندس محمد: الملفات دي بتلمس دالة واحدة موجودة بس
--    (create_customer_order، تعديل نصّي بيتأكد من النص الأصلي قبل ما
--    يغيّر، وبيوقف لو مالقاهوش). الباقي أعمدة/جداول/محفّزات جديدة.
--    مفيش حذف بيانات. اتجرّبت ٤ و٥ على قاعدة محلية، و١ اتأكدت نصوصه
--    على الإنتاج قبل التجميع. لو هتشغّلها على التجريبي
--    (nznfawbcgfwpftbiqima) الأول، نفس الملف.
-- ═══════════════════════════════════════════════════════════════

begin;


-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
-- 20261023230000_addon_delivery_format.sql
-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼

-- ═══════════════════════════════════════════════════════════════
-- الإضافات: مطبوعة / إلكترونية / الاتنين
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض
--   ملاحظة تامر (٢٣ أكتوبر): «الإضافات ليه شحن فقط؟ محتاج يبقى
--   متاح الـ٣ خيارات ويتم ضبطها من الإعدادات».
--
--   الإضافات كلها كانت مفترَضة ملموسة. القاعدة بتقول بالحرف:
--
--       IF v_product.category <> 'subscription'
--          AND (v_format <> 'electronic' OR v_addons_count > 0) THEN
--         v_needs_shipping := true;
--
--   يعني **أي** إضافة بتخلي الطلب محتاج شحن، حتى لو القصة نفسها
--   إلكترونية. وده كان صح وقت ما كل الإضافات كانت بوسترات وكوبايات.
--   بس «ملف تلوين PDF» أو «خلفية موبايل» إضافة من غير شحن — وماكانش
--   فيه طريقة نقول كده.
--
--   ودي كانت السبب المباشر لبلاغ «اخترت نسخة إلكترونية وبرضه وقف في
--   الطلب»: البوستر خلّى الطلب كله محتاج شحن.
--
-- اللي بيتضاف
--   `addon_products.delivery_format`:
--     'printed'    — بتتشحن لعنوان العميل (الافتراضي = السلوك الحالي)
--     'electronic' — ملف بيوصل على الإيميل، **من غير شحن**
--     'both'       — بتتشحن ومعاها نسخة إلكترونية (بتتشحن برضه)
--
--   وقاعدة الشحن بقت: الإضافة بتحتاج شحن لو نوعها **مش** 'electronic'.
--
-- الأثر
--   • عمود جديد بقيمة افتراضية `'printed'` — فكل إضافة موجودة
--     بتفضل زيّ ما هي بالظبط، والسلوك مابيتغيّرش لحد ما الإدارة
--     تغيّر نوع إضافة بإيدها.
--   • `create_customer_order` بتعدّ الإضافات اللي بتتشحن لوحدها
--     (`v_addons_ship`) بدل ما تعدّهم كلهم.
--   • لقطة الإضافة في الطلب بقى فيها `deliveryFormat` — عشان
--     الإدارة تعرف البند ده كان هيتشحن ولا لأ بعد شهور، حتى لو
--     نوع الإضافة اتغيّر بعدها.
--   • مفيش صف اتعدّل، ومفيش عمود اتشال، ومفيش صلاحية اتغيّرت.
--
-- ⚠️ الترتيب والتطبيق
--   مستقل. بس **مش متطبّق على الإنتاج** — تسليم م. محمد بيقول إن
--   أي ترحيل على الإنتاج محتاج موافقة صريحة، والإنتاج متأخّر عن
--   التجريبي (٤٦ مقابل ٧٣ ترحيل). شغّله على التجريبي الأول.
--
-- التحقق بعد التشغيل
--   1) العمود موجود وبالافتراضي الصح:
--        select column_default, is_nullable from information_schema.columns
--         where table_name='addon_products' and column_name='delivery_format';
--      ← 'printed'::text ، NO
--
--   2) كل الإضافات القديمة فضلت «مطبوعة»:
--        select delivery_format, count(*) from addon_products group by 1;
--      ← كلهم printed
--
--   3) الدالة بقت تفرّق:
--        select pg_get_functiondef(oid) ilike '%v_addons_ship%'
--          from pg_proc where proname='create_customer_order';
--      ← true
--
--   4) الطلبات القديمة ما اتأثرتش:
--        select count(*) from orders;  ← نفس الرقم قبل التشغيل
--
-- الرجوع للخلف
--   رجّع فقرة الشحن في الدالة لـ`v_addons_count > 0` وشغّل
--   CREATE OR REPLACE. العمود سيبه: وجوده مابيأثرش على حاجة،
--   وشيله بيضيّع اختيارات الإدارة.
-- ═══════════════════════════════════════════════════════════════

alter table public.addon_products
  add column if not exists delivery_format text not null default 'printed';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.addon_products'::regclass
       and conname  = 'addon_products_delivery_format_check'
  ) then
    alter table public.addon_products
      add constraint addon_products_delivery_format_check
      check (delivery_format in ('printed', 'electronic', 'both'));
  end if;
end $$;

comment on column public.addon_products.delivery_format is
  'مطبوعة (بتتشحن) / إلكترونية (على الإيميل، من غير شحن) / الاتنين (بتتشحن). الافتراضي printed عشان الإضافات الموجودة ماتتغيّرش.';

-- ── قاعدة الشحن في `create_customer_order` ─────────────────────
--
-- ⚠️ **ليه رقعة نصّية بدل ما نعيد كتابة الدالة؟**
--
--    الدالة دي كبيرة، والإنتاج متأخّر عن التجريبي بـ٢٧ ترحيل. لو
--    كتبت `CREATE OR REPLACE` بجسم كامل، هيبقى مبنيًا على النسخة
--    اللي أنا شايفها — وتشغيله على قاعدة فيها نسخة أحدث **بيرجّع
--    الدالة للوراء بالسكوت** ويضيّع تعديلات حد تاني.
--
--    الرقعة دي بتقرا الجسم الموجود **فعلًا** في القاعدة اللي
--    بتشتغل عليها، وبتبدّل الفقرة المقصودة وبس. فبتشتغل صح على
--    التجريبي والإنتاج مهما كان الفرق بينهم.
--
-- ⚠️ **وبتقف لو ماللقتش الفقرة.** الاستبدال الصامت أسوأ حاجة هنا:
--    الترحيل يعدّي، والطلب يفضل بيتحسب بالقاعدة القديمة، ومحدش
--    يعرف. فلو النص اتغيّر، الترحيل بيرمي ولازم حد يراجع بإيده.

do $$
declare
  v_src text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_customer_order'
     and pg_get_function_identity_arguments(p.oid) = 'p_items jsonb, p_shipping jsonb, p_discount_code text';

  if v_src is null then
    raise exception 'create_customer_order مش موجودة — راجع ترتيب الترحيلات';
  end if;

  v_old := '(v_format <> ''electronic'' OR v_addons_count > 0)';

  -- الإضافة الإلكترونية مابتتشحنش. الباقي (مطبوعة / الاتنين) بيتشحن.
  v_new := '(v_format <> ''electronic'' OR EXISTS ('
        || ' SELECT 1 FROM jsonb_array_elements_text('
        || '   CASE WHEN jsonb_typeof(v_item->''addon_ids'') = ''array'''
        || '        THEN v_item->''addon_ids'' ELSE ''[]''::jsonb END) AS t(aid)'
        || ' JOIN addon_products ap ON ap.id = t.aid'
        || ' WHERE coalesce(ap.delivery_format, ''printed'') <> ''electronic''))';

  if position(v_old in v_src) = 0 then
    -- اتعملت قبل كده؟ خلاص، مفيش حاجة تتعمل.
    if position('ap.delivery_format' in v_src) > 0 then
      raise notice 'قاعدة شحن الإضافات متطبّقة قبل كده — مفيش تغيير';
      return;
    end if;
    raise exception
      'ماللقتش فقرة شحن الإضافات في create_customer_order. النص اتغيّر — راجع الترحيل بإيدك قبل ما تشغّله.';
  end if;

  execute replace(v_src, v_old, v_new);
end $$;

-- لقطة الإضافة في الطلب: نوعها وقت الطلب.
--
-- ⚠️ اللقطة مهمة لأن نوع الإضافة ممكن يتغيّر بعد شهور. من غيرها،
--    الإدارة بتفتح طلبًا قديم ومش عارفة البند ده كان بيتشحن ولا لأ.
do $$
declare
  v_src text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_customer_order'
     and pg_get_function_identity_arguments(p.oid) = 'p_items jsonb, p_shipping jsonb, p_discount_code text';

  v_old := '''discount_percent'', v_discount';
  v_new := '''discount_percent'', v_discount,'
        || ' ''deliveryFormat'', coalesce((select ap.delivery_format from addon_products ap where ap.id = v_addon.id), ''printed'')';

  if position('''deliveryFormat''' in v_src) > 0 then
    raise notice 'لقطة نوع الإضافة متطبّقة قبل كده — مفيش تغيير';
    return;
  end if;
  if position(v_old in v_src) = 0 then
    raise exception 'ماللقتش لقطة الإضافة في create_customer_order — راجع الترحيل بإيدك.';
  end if;

  execute replace(v_src, v_old, v_new);
end $$;


-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
-- 20261023234500_fix_certification_admin_grant.sql
-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼

-- ═══════════════════════════════════════════════════════════════
-- تصليح: الإدارة مش قادرة تحفظ «التدريب والاعتماد»
-- ═══════════════════════════════════════════════════════════════
--
-- البلاغ
--   «لوحة الإدارة ← إدارة المدرب ← تعذّر حفظ بيانات التدريب:
--    permission denied for table instructor_certifications»
--
-- ── السبب: ترحيل ١٧ أكتوبر، وهو غلطي ──────────────────────────
--
--   `20261017235000_certification_read_only_for_instructor.sql`
--   كان بيقفل ثغرة حقيقية: المدرب كان يقدر يكتب في صف شهادته
--   ويحطّ `exam_passed = true` لنفسه. وقفلتها بسطرين:
--
--       revoke insert, update, delete, truncate
--         on public.instructor_certifications from authenticated;
--
--   + صلاحية صفوف (`admins manage certifications`) بتسمح للإدارة
--   بكل حاجة، وللمدرب بالقراءة بس.
--
--   ⚠️ **والسطر التاني مابيشتغلش من غير الأول.**
--
--      صلاحيات الصفوف (RLS) بتتفحص **بعد** صلاحيات الجدول
--      (GRANT)، مش بدالها. والإدارة بتدخل بنفس دور
--      `authenticated` اللي المدرب داخل بيه — مفيش دور منفصل
--      للإدارة في Supabase، الفرق بيتحدّد بـ`is_admin()` جوّه
--      الصلاحية.
--
--      فلما سحبت INSERT/UPDATE من `authenticated`، سحبتها من
--      **الإدارة كمان**. الطلب بيترفض عند بوابة الجدول قبل ما
--      صلاحية الصفوف تتقرا أصلًا — وعشان كده الرسالة
--      «permission denied for table» مش «new row violates policy».
--
--      يعني شلت الطابق اللي الحارس واقف عليه.
--
-- ── التصليح ───────────────────────────────────────────────────
--
--   بنرجّع الصلاحية للدور، والحارس يفضل صلاحية الصفوف:
--
--     • GRANT بيفتح الباب لكل `authenticated`
--     • `admins manage certifications` (USING/WITH CHECK =
--       `is_admin()`) بتسمح للإدارة وبس
--     • المدرب معاه SELECT على صفّه وخلاص — فمحاولته يكتب
--       بتترفض بصلاحية الصفوف، مش بغياب الصلاحية
--
--   ⚠️ **والثغرة الأصلية بتفضل مقفولة.** ده مش رجوع عن ترحيل
--      ١٧ أكتوبر — صلاحياته هي اللي بتمنع المدرب، وهي موجودة.
--      الاختبار في التحقق رقم ٣ تحت بيثبت ده.
--
--   و`anon` بيفضل محروم تمامًا زيّ ما هو.
--
-- الأثر
--   • صلاحيات جدول واحد بترجع لدور `authenticated`.
--   • مفيش صف اتعدّل، ومفيش صلاحية صفوف اتغيّرت، ومفيش جدول اتلمس.
--
-- الترتيب
--   **بعد** `20261017235000_certification_read_only_for_instructor`.
--   لو اتشغّل قبله، الترحيل ده هيترجع عليه ويتلغي أثره.
--
-- التحقق بعد التشغيل
--   1) الصلاحيات رجعت:
--        select privilege_type from information_schema.role_table_grants
--         where table_name='instructor_certifications' and grantee='authenticated'
--         order by 1;
--      ← INSERT, REFERENCES, SELECT, TRIGGER, UPDATE
--
--   2) صلاحيات الصفوف زيّ ما هي (مش مفروض تتغيّر):
--        select policyname, cmd from pg_policies
--         where tablename='instructor_certifications' order by policyname;
--      ← admins manage certifications [ALL] · instructor reads own certification [SELECT]
--
--   3) ⚠️ **والأهم — المدرب لسه مش قادر يعتمد نفسه.** جرّبها من
--      حساب مدرب حقيقي (مش من لوحة SQL، لأن اللوحة بتشتغل بدور
--      `postgres` وبتتخطّى صلاحيات الصفوف):
--        update instructor_certifications set exam_passed = true
--         where instructor_id = '<رقم المدرب>';
--      ← 0 rows (صلاحية الصفوف رفضت) — **مش** رسالة permission denied
--
--   4) والإدارة بتحفظ من الشاشة عادي (ده البلاغ نفسه).
--
-- الرجوع للخلف
--   revoke insert, update, delete on public.instructor_certifications
--     from authenticated;
--   ⚠️ وده بيرجّع العطل ده نفسه — مافيش سبب تعمله.
-- ═══════════════════════════════════════════════════════════════

grant insert, update, delete on public.instructor_certifications to authenticated;

comment on table public.instructor_certifications is
  'شهادة المدرب. الصلاحية على الجدول مفتوحة لـauthenticated عن قصد — الحارس صلاحية الصفوف (is_admin)، لأن الإدارة والمدرب بيدخلوا بنفس الدور. سحب الصلاحية من الدور بيقفل الشاشة على الإدارة كمان (عطل ٢٣ أكتوبر).';


-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
-- 20261024001500_reviews_one_per_booking.sql
-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼

-- ═══════════════════════════════════════════════════════════════
-- تقييم واحد لكل باقة
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض
--   ملاحظة الفريق (٢٤ أكتوبر): «اضبط آلية تقييم للمدرب بعد انتهاء
--   الباقة أو الخدمة وليس خلال أو قبل».
--
--   التقييم كان متاحًا من **طلب الخدمة** وبس، وشرط «بعد الاكتمال»
--   متحقّق هناك من الأول. والباقات ماكانش ليها طريق تقييم خالص:
--   عمود `reviews.booking_id` موجود من يوم ما الجدول اتعمل
--   و**مافيش حاجة بتكتب فيه**.
--
--   النتيجة في الأرقام: صفر تقييم في القاعدة كلها، وكل صفحة مدرب
--   بتقول «لا توجد تقييمات بعد».
--
-- اللي بيتضاف
--   فهرس فريد على `booking_id` — نفس اللي موجود على
--   `service_order_id` بالظبط (`reviews_service_order_unique`).
--
-- ⚠️ **ليه فهرس مش فحص في الكود؟**
--    الأكشن بيفحص «اتقيّمت قبل كده» عشان الشاشة ما تعرضش نموذجًا
--    هيترفض. بس الفحص-ثم-الكتابة فيه فجوة: ضغطتين في نفس اللحظة
--    بيعدّوا الفحص الاتنين. الفهرس هو اللي بيمنع فعلًا، والكود
--    بيترجم خطأه لرسالة عربية.
--
-- الأثر
--   • فهرس واحد جديد. مفيش عمود، ومفيش صف، ومفيش صلاحية.
--   • `concurrently` **مش** مستعملة عن قصد: الجدول فاضي (صفر صف)،
--     والفهرس العادي بيتعمل في جزء من الثانية. و`concurrently`
--     مابتشتغلش جوّه كتلة ترحيل.
--
-- الترتيب
--   مستقل.
--
-- التحقق بعد التشغيل
--   1) الفهرس موجود:
--        select indexdef from pg_indexes
--         where indexname = 'reviews_booking_unique';
--      ← CREATE UNIQUE INDEX … (booking_id) WHERE (booking_id IS NOT NULL)
--
--   2) التقييمات القديمة ما اتأثرتش:
--        select count(*) from reviews;   ← نفس الرقم قبل التشغيل
--
--   3) والتكرار بيترفض فعلًا (جرّبها على التجريبي):
--        insert into reviews (instructor_id, booking_id, rating) …  ← تمام
--        insert into reviews (instructor_id, booking_id, rating) …  ← duplicate key
--
-- ⚠️ لو الترحيل فشل برسالة `could not create unique index`، فده
--    معناه إن فيه تقييمين على نفس الباقة اتكتبوا قبل الفهرس.
--    شوفهم الأول، وقرّر أنهي واحد يفضل:
--      select booking_id, count(*) from reviews
--       where booking_id is not null group by 1 having count(*) > 1;
--    **مامسحش حاجة تلقائيًا** — التقييم رأي عميل، مش صف تقني.
--
-- الرجوع للخلف
--   drop index if exists public.reviews_booking_unique;
-- ═══════════════════════════════════════════════════════════════

create unique index if not exists reviews_booking_unique
  on public.reviews (booking_id)
  where booking_id is not null;

comment on index public.reviews_booking_unique is
  'تقييم واحد لكل باقة — نظير reviews_service_order_unique. الحارس الحقيقي ضد الضغطتين المتزامنتين؛ فحص الكود للعرض.';


-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
-- 20261024090000_package_booking_rules.sql
-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼

-- ═══════════════════════════════════════════════════════════════
-- قواعد حجز باقات «بداية الرحلة»: «قريبًا» + السن المناسب
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — قرارات تامر (٢٤ أكتوبر):
--
--   ٩)  باقات التخصص تفضل **ظاهرة** وقت الإطلاق، بس الحجز مقفول
--       («قريبًا») مع زرار «بلّغني لما تفتح». والإدارة بتفتحها من
--       شاشة الباقة.
--
--   ١٠) الطفل مايتسجّلش في باقة مش لسنّه (أقل من ١٢ / ١٢ فأكثر)،
--       **إلا** باستثناء من الإدارة على ملف الطفل نفسه.
--
-- ── اللي بيتضاف ──────────────────────────────────────────────
--
--   ١) `creative_writing_packages.booking_open` (افتراضي true)
--      ⚠️ **وباقات التخصص بتتقفل هنا** (`track = 'specialization'`)
--         — ده تنفيذ القرار، مش أثر جانبي. الفتح من شاشة الباقة.
--
--   ٢) `child_profiles.age_group_override` — استثناء الإدارة.
--      NULL = السن من تاريخ الميلاد. ولي الأمر **مايقدرش** يكتبه
--      (محفّز `guard_child_age_override`) — وإلا الاستثناء يبقى
--      زرار في إيد أي حد.
--
--   ٣) `child_age_group(birth, override)` — حساب الفئة، بتوقيت القاهرة.
--
--   ٤) محفّز `guard_course_booking_rules` قبل إضافة أي اشتراك:
--        • الباقة مقفولة → «هتفتح قريبًا»
--        • طفل بلا تاريخ ميلاد ولا استثناء → «سجّل تاريخ الميلاد»
--        • الفئة مش مطابقة → رسالة بتقول السن والباقة المناسبة
--      ⚠️ **الإدارة مستثناة** (`is_admin()`) — حجز يدوي من اللوحة
--         لحالة خاصة مايتمنعش.
--      ⚠️ **محفّز مش تعديل في `create_course_booking`** عن قصد: كده
--         أي طريق بيكتب اشتراك (الدالة، أو موافقة ولي الأمر على طلب
--         ابنه، أو أي حاجة تتضاف بعدين) بيعدّي على نفس الحارس، ومفيش
--         نص دالة بيتلمس — فالتجريبي والإنتاج مايختلفوش.
--      ⚠️ حجز `self` (صاحب الحساب نفسه) مابيتفحصش سنّه: مفيش تاريخ
--         ميلاد على حسابات البالغين.
--
--   ٥) `package_interest` — «بلّغني لما تفتح»: صف لكل (باقة، مستخدم).
--
-- الأثر
--   • عمودين جداد بقيم افتراضية آمنة، وجدول جديد، ودالة، ومحفّزين.
--   • الصف الوحيد اللي بيتغيّر: باقات التخصص booking_open = false.
--   • الاشتراكات الموجودة **مابتتلمسش** (المحفّز على INSERT بس).
--
-- الترتيب
--   مستقل. الكود بيشتغل قبله وبعده (العمود الناقص = «مفتوحة»).
--
-- التحقق بعد التشغيل
--   1) select name, track, booking_open from creative_writing_packages order by track;
--      ← specialization = false، الباقي true
--   2) select public.child_age_group(current_date - interval '8 years', null);   ← under_12
--      select public.child_age_group(current_date - interval '13 years', null);  ← 12_plus
--      select public.child_age_group(current_date - interval '8 years', '12_plus'); ← 12_plus
--   3) من حساب ولي أمر (مش لوحة SQL):
--        update child_profiles set age_group_override = '12_plus' where id = '<طفله>';
--      ← خطأ «الاستثناء ده من الإدارة بس»
--   4) حجز طفل عنده ٨ سنين في باقة 12_plus من الموقع ← رسالة السن.
--
-- الرجوع للخلف
--   drop trigger if exists guard_course_booking_rules on public.course_subscriptions;
--   drop trigger if exists guard_child_age_override on public.child_profiles;
--   drop function if exists public.guard_course_booking_rules();
--   drop function if exists public.guard_child_age_override();
--   drop function if exists public.child_age_group(date, text);
--   drop table if exists public.package_interest;
--   alter table public.child_profiles drop column if exists age_group_override;
--   alter table public.creative_writing_packages drop column if exists booking_open;
-- ═══════════════════════════════════════════════════════════════

-- ── ١) الباقة مفتوحة للحجز؟ ──────────────────────────────────
-- ⚠️ القفل المبدئي لباقات التخصص بيحصل **مرة واحدة بس، لما العمود
--    يتعمل**. لو الترحيل اتشغّل تاني بعد ما الإدارة فتحت باقة، مايرجعش
--    يقفلها.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'creative_writing_packages'
       and column_name = 'booking_open'
  ) then
    alter table public.creative_writing_packages
      add column booking_open boolean not null default true;
    update public.creative_writing_packages
       set booking_open = false
     where track = 'specialization';
  end if;
end $$;

comment on column public.creative_writing_packages.booking_open is
  'false = الباقة ظاهرة بس الحجز «قريبًا» (قرار ٢٤ أكتوبر). مختلف عن is_active اللي بيخفيها خالص.';

-- ── ٢) استثناء السن ─────────────────────────────────────────
alter table public.child_profiles
  add column if not exists age_group_override text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'child_profiles_age_group_override_check'
  ) then
    alter table public.child_profiles
      add constraint child_profiles_age_group_override_check
      check (age_group_override is null or age_group_override in ('under_12', '12_plus'));
  end if;
end $$;

comment on column public.child_profiles.age_group_override is
  'استثناء من الإدارة: الطفل يتعامل كأنه في الفئة دي بغض النظر عن تاريخ ميلاده. ولي الأمر مايقدرش يكتبه.';

create or replace function public.guard_child_age_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.age_group_override is distinct from
     (case when tg_op = 'UPDATE' then old.age_group_override else null end)
     and not public.is_admin()
     -- لوحة SQL والمهام الداخلية (من غير مستخدم) مسموح لها.
     and auth.uid() is not null
  then
    raise exception 'الاستثناء ده من الإدارة بس.';
  end if;
  return new;
end $$;

drop trigger if exists guard_child_age_override on public.child_profiles;
create trigger guard_child_age_override
  before insert or update of age_group_override on public.child_profiles
  for each row execute function public.guard_child_age_override();

-- ── ٣) فئة الطفل ────────────────────────────────────────────
create or replace function public.child_age_group(p_birth date, p_override text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_override in ('under_12', '12_plus') then p_override
    when p_birth is null then null
    when extract(year from age((now() at time zone 'Africa/Cairo')::date, p_birth)) < 12
      then 'under_12'
    else '12_plus'
  end
$$;

-- ── ٤) الحارس ───────────────────────────────────────────────
create or replace function public.guard_course_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg   record;
  v_child record;
  v_group text;
begin
  if public.is_admin() then
    return new;
  end if;

  select name, age_group, booking_open
    into v_pkg
    from creative_writing_packages
   where id = new.package_id;

  if not found then
    return new; -- الـFK والدالة بيتعاملوا مع الباقة الغلط
  end if;

  if v_pkg.booking_open is false then
    raise exception 'باقة «%» هتفتح للحجز قريبًا. تقدر تضغط «بلّغني لما تفتح» من صفحتها.', v_pkg.name;
  end if;

  if new.child_id is null then
    return new;
  end if;

  select full_name, birth_date, age_group_override
    into v_child
    from child_profiles
   where id = new.child_id;

  if not found then
    return new;
  end if;

  v_group := public.child_age_group(v_child.birth_date, v_child.age_group_override);

  if v_group is null then
    raise exception 'سجّل تاريخ ميلاد % من «عائلتي» الأول، عشان نتأكد إن الباقة مناسبة لسنّه.', v_child.full_name;
  end if;

  if v_group <> v_pkg.age_group then
    raise exception '%',
      case when v_pkg.age_group = 'under_12'
        then format('باقة «%s» لأقل من ١٢ سنة، و%s سنّه ١٢ أو أكتر. اختار باقة من مسار اليافعين، أو كلّمنا لو محتاج استثناء.', v_pkg.name, v_child.full_name)
        else format('باقة «%s» لـ١٢ سنة فأكثر، و%s سنّه أقل من ١٢. اختار باقة من مسار التأسيس، أو كلّمنا لو محتاج استثناء.', v_pkg.name, v_child.full_name)
      end;
  end if;

  return new;
end $$;

drop trigger if exists guard_course_booking_rules on public.course_subscriptions;
create trigger guard_course_booking_rules
  before insert on public.course_subscriptions
  for each row execute function public.guard_course_booking_rules();

-- ── ٥) «بلّغني لما تفتح» ────────────────────────────────────
create table if not exists public.package_interest (
  id          uuid primary key default gen_random_uuid(),
  package_id  text not null references public.creative_writing_packages(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  notified_at timestamptz,
  unique (package_id, user_id)
);

comment on table public.package_interest is
  'مين طلب يتبلّغ لما باقة «قريبًا» تفتح. notified_at بيتملى لما الإدارة تبعت الإشعار.';

alter table public.package_interest enable row level security;

drop policy if exists "own interest insert" on public.package_interest;
create policy "own interest insert" on public.package_interest
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "own interest read" on public.package_interest;
create policy "own interest read" on public.package_interest
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "own interest delete" on public.package_interest;
create policy "own interest delete" on public.package_interest
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins update interest" on public.package_interest;
create policy "admins update interest" on public.package_interest
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.package_interest to authenticated;


-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
-- 20261024100000_session_incidents.sql
-- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼

-- ═══════════════════════════════════════════════════════════════
-- بلاغات الجلسات والتصعيد
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — قرار تامر (٢٤ أكتوبر، بند ١١):
--   «زرار بلاغ + تنبيه فوري». زرار «بلّغ عن مشكلة» للمدرب (في صفحة
--   الجلسة) وللطالب وولي الأمر. درجتين: عادي، وعاجل لو فيه خطر على
--   الطفل. والإدارة عندها صفحة بالبلاغات: مين ماسكه، الحالة، القرار.
--
--   قبل كده مكانش فيه أي طريق — مدرب شاف علامة خطر على طفل، أو طالب
--   اتضايق من مدرب، كان لازم يدوّر على رقم تليفون.
--
-- ── اللي بيتضاف ──────────────────────────────────────────────
--
--   جدول `session_incidents`:
--     • `severity`  normal | urgent
--     • `category`  child_safety | conduct | session_control | technical | other
--     • `status`    open → in_progress → resolved
--     • `assigned_to` الإداري الماسك، و`resolution` القرار
--
--   ⚠️ **صاحب البلاغ بيقدر يقرا صفّه كله** (صلاحيات الصفوف مابتفرّقش
--      بين الأعمدة). الشاشة بتعرض له الحالة و`resolution` بس —
--      `admin_note` للإدارة. فاللي يتكتب في `admin_note` يتكتب على
--      أساس إنه ممكن يتقري.
--
--   ⚠️ **البلاغ مابيتمسحش ولا بيتعدّل من صاحبه.** ده سجل حماية طفل؛
--      الإدارة بس بتغيّر حالته. ومفيش صلاحية DELETE لحد.
--
--   ⚠️ **التأكد إن المُبلّغ طرف في الجلسة بيحصل في الأكشن** بجلسة
--      المستخدم (صلاحيات `sessions` بتوري الأطراف بس). هنا الشرط
--      الأدنى: البلاغ باسم صاحبه.
--
-- الأثر
--   جدول جديد + فهرسين + صلاحيات. مفيش حاجة موجودة بتتلمس.
--
-- الترتيب
--   مستقل. الكود بيرجّع «لسه بيتجهّز» لو الجدول مش موجود.
--
-- التحقق بعد التشغيل
--   1) select count(*) from session_incidents;   ← 0
--   2) من حساب مدرب: بلاغ من صفحة جلسة ← صف + إشعار للإدارة
--   3) من نفس الحساب:
--        update session_incidents set status = 'resolved';  ← 0 rows
--        delete from session_incidents;                     ← permission denied
--
-- الرجوع للخلف
--   drop table if exists public.session_incidents;
--   ⚠️ ده بيمسح البلاغات — صدّرها الأول لو فيه بلاغات حقيقية.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.session_incidents (
  id                     uuid primary key default gen_random_uuid(),
  session_id             text references public.sessions(id) on delete set null,
  course_subscription_id text references public.course_subscriptions(id) on delete set null,
  reporter_profile_id    uuid not null default auth.uid(),
  reporter_role          text not null check (reporter_role in ('instructor', 'guardian', 'student')),
  severity               text not null default 'normal' check (severity in ('normal', 'urgent')),
  category               text not null check (category in ('child_safety', 'conduct', 'session_control', 'technical', 'other')),
  description            text not null check (char_length(btrim(description)) between 10 and 4000),
  status                 text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  assigned_to            uuid,
  admin_note             text,
  resolution             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  resolved_at            timestamptz
);

comment on table public.session_incidents is
  'بلاغات الجلسات (قرار ٢٤ أكتوبر، بند ١١). سجل حماية طفل: مابيتمسحش، وصاحبه مابيعدّلوش.';

create index if not exists session_incidents_open_idx
  on public.session_incidents (severity, created_at desc)
  where status <> 'resolved';
create index if not exists session_incidents_reporter_idx
  on public.session_incidents (reporter_profile_id, created_at desc);

alter table public.session_incidents enable row level security;

drop policy if exists "reporters file incidents" on public.session_incidents;
create policy "reporters file incidents" on public.session_incidents
  for insert to authenticated
  with check (
    reporter_profile_id = auth.uid()
    and status = 'open'
    and assigned_to is null
    and admin_note is null
    and resolution is null
  );

drop policy if exists "reporters and admins read incidents" on public.session_incidents;
create policy "reporters and admins read incidents" on public.session_incidents
  for select to authenticated
  using (reporter_profile_id = auth.uid() or public.is_admin());

drop policy if exists "admins handle incidents" on public.session_incidents;
create policy "admins handle incidents" on public.session_incidents
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ⚠️ مفيش DELETE لحد عن قصد.
grant select, insert, update on public.session_incidents to authenticated;
revoke delete, truncate on public.session_incidents from authenticated, anon;


commit;

-- ═══════════════════════════════════════════════════════════════
-- التحقق — النتيجة المتوقعة: كل الخانات true، و grants فيها INSERT و UPDATE
-- ═══════════════════════════════════════════════════════════════
select
  exists (select 1 from information_schema.columns
           where table_name = 'addon_products' and column_name = 'delivery_format')         as "١ نوع الإضافة",
  (select position('ap.delivery_format' in pg_get_functiondef(p.oid)) > 0
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_customer_order')                    as "١ قاعدة الشحن",
  (select string_agg(privilege_type, ',' order by privilege_type)
     from information_schema.role_table_grants
    where table_name = 'instructor_certifications' and grantee = 'authenticated')           as "٢ grants",
  exists (select 1 from pg_indexes where indexname = 'reviews_booking_unique')              as "٣ فهرس التقييم",
  exists (select 1 from information_schema.columns
           where table_name = 'creative_writing_packages' and column_name = 'booking_open') as "٤ قريبًا",
  exists (select 1 from pg_trigger where tgname = 'guard_course_booking_rules')             as "٤ حارس السن",
  to_regclass('public.session_incidents') is not null                                       as "٥ البلاغات";

-- والباقات اللي اتقفلت («قريبًا»):
select name, track, booking_open from public.creative_writing_packages order by track, name;
