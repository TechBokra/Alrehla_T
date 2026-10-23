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
