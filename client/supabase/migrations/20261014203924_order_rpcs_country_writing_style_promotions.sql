-- ============================================================================
-- (٣/٣) دوال الطلب: الدولة والتوصيل + أسلوب الكتابة + الأسعار الفعلية (العروض)
-- ============================================================================
-- الغرض   : create_customer_order و create_box_subscription_order هما الحارس
--           الحقيقي للأسعار والشحن؛ هذه الـmigration تضيف إليهما:
--             ١) الدولة (p_shipping->>'country'، الافتراضي EG) وفحص التوصيل عبر
--                shipping_quote، وفحص electronic_enabled للنسخ الإلكترونية.
--             ٢) التحقق من أسلوب الكتابة (customization_data.writingStyle) واختصاره
--                إلى {style, dialect?} — اختياري في القاعدة حتى ينتشر الكود الجديد.
--             ٣) الأسعار الفعلية بعد العروض (effective_price) مع لقطة السعر الأصلي.
-- التوافق : التوقيعات كما هي. الكود المنشور حاليًا لا يرسل country فيُعامَل كمصر،
--           ولا عروض مسجّلة بعد، فسلوكه لا يتغير.
-- الاعتماد: يتطلب migration الدول وmigration الأسلوب/العروض قبله.
-- الرجوع  : أعد تعريف الدالتين من 20261013180656 أو من نسخة production السابقة
--           (موجودة في Git history لهذا الملف: سطور ما قبل التعديل في PR).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_items jsonb, p_shipping jsonb DEFAULT NULL::jsonb, p_discount_code text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user           uuid    := auth.uid();
  v_order_id       uuid;
  v_item           jsonb;
  v_line           jsonb;
  v_product        record;
  v_addon          record;
  v_addon_id       text;
  v_addon_custom   boolean;
  v_addon_price    numeric;
  v_addon_list     numeric;
  v_qty            integer;
  v_child          text;
  v_unit           numeric;
  v_list_unit      numeric;
  v_addons_total   numeric;
  v_addons_list    numeric;
  v_addons_count   integer;
  v_addons_snap    jsonb;
  v_customization  jsonb;
  v_format         text;
  v_base           numeric;
  v_base_list      numeric;
  v_eff_printed    numeric;
  v_eff_elec       numeric;
  v_subtotal       numeric := 0;
  v_shipping       numeric := 0;
  v_needs_shipping boolean := false;
  v_has_electronic boolean := false;
  v_email          text;
  v_discount       integer := 0;
  v_lines          jsonb   := '[]'::jsonb;
  v_code           discount_codes;
  v_code_off       integer := 0;
  -- الدولة والتوصيل
  v_country        text;
  v_crow           record;
  v_q              record;
  -- أسلوب الكتابة
  v_ws             jsonb;
  v_ws_style       text;
  v_ws_dialect     text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول قبل الطلب';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'الطلب فاضي';
  END IF;

  -- الدولة: الغائبة = مصر (الكود القديم ما بيبعتهاش).
  v_country := upper(btrim(coalesce(NULLIF(btrim(coalesce(p_shipping->>'country', '')), ''), 'EG')));
  SELECT * INTO v_crow FROM countries WHERE code = v_country AND is_listed;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الدولة غير مدعومة';
  END IF;

  -- ⭐ ملف 140: خصم المشترك على الإضافات طول مدة اشتراكه.
  SELECT coalesce(max(s.addon_discount_percent), 0)
    INTO v_discount
    FROM box_subscriptions s
   WHERE s.user_id = v_user
     AND s.status = 'active'
     AND s.ends_at > now();

  -- ══ الدورة الأولى: تسعير وتحقّق، بلا أي كتابة ═══════════
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer, 1));

    v_format := coalesce(NULLIF(btrim(v_item->>'format'), ''), 'printed');
    IF v_format NOT IN ('printed', 'electronic', 'both') THEN
      RAISE EXCEPTION 'نوع النسخة غير معروف: %', v_format;
    END IF;

    SELECT p.id, p.price, p.category, p.electronic_price, p.writing_styles
      INTO v_product
      FROM personalized_products p
     WHERE p.id::text = v_item->>'product_id';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'منتج غير موجود: %', v_item->>'product_id';
    END IF;

    IF v_format <> 'printed' THEN
      IF v_product.category <> 'custom'
         OR coalesce(v_product.electronic_price, 0) <= 0 THEN
        RAISE EXCEPTION 'النسخة الإلكترونية مش متاحة للمنتج ده';
      END IF;
      v_has_electronic := true;
      v_qty := 1;
    END IF;

    v_child := NULLIF(v_item->'customization_data'->>'childId', '');
    IF v_child IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM child_profiles c
         WHERE c.id::text = v_child AND c.user_profile_id = v_user
      ) THEN
        RAISE EXCEPTION 'ملف المشارك المرفق لا يخص صاحب الحساب';
      END IF;
    END IF;

    -- الإضافات: أرقامها بس هي اللي بتيجي من الواجهة، والسعر من الجدول.
    v_addons_total := 0;
    v_addons_list  := 0;
    v_addons_count := 0;
    v_addons_snap  := '[]'::jsonb;

    IF jsonb_typeof(v_item->'addon_ids') = 'array' THEN
      FOR v_addon_id IN
        SELECT jsonb_array_elements_text(v_item->'addon_ids')
      LOOP
        SELECT a.id, a.name, a.price,
               a.supports_customization, a.customization_price
          INTO v_addon
          FROM addon_products a
         WHERE a.id = v_addon_id AND a.is_active = true;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'إضافة غير متاحة: %', v_addon_id;
        END IF;

        -- ⭐ ملف 07 (قرار تامر): التخصيص مش اختياري.
        v_addon_custom := v_addon.supports_customization;

        v_addon_list  := v_addon.price
          + CASE WHEN v_addon_custom THEN v_addon.customization_price ELSE 0 END;
        -- العرض على سعر الإضافة نفسه (مش سعر التخصيص).
        v_addon_price := public.effective_price('addon', v_addon.id::text, v_addon.price)
          + CASE WHEN v_addon_custom THEN v_addon.customization_price ELSE 0 END;
        -- ⭐ ملف 140: خصم المشترك بيتقرّب لجنيه — إجمالي الطلب عمود صحيح.
        IF v_discount > 0 THEN
          v_addon_price := round(v_addon_price * (100 - v_discount) / 100.0);
          v_addon_list  := round(v_addon_list  * (100 - v_discount) / 100.0);
        END IF;

        v_addons_total := v_addons_total + v_addon_price;
        v_addons_list  := v_addons_list  + v_addon_list;
        v_addons_count := v_addons_count + 1;
        v_addons_snap  := v_addons_snap || jsonb_build_object(
          'id',    v_addon.id,
          'name',  v_addon.name,
          'price', v_addon_price,
          'listPrice', v_addon_list,
          'customized', v_addon_custom,
          'discount_percent', v_discount
        );
      END LOOP;
    END IF;

    -- الشحن: أي حاجة ملموسة — نسخة مطبوعة **أو إضافة**.
    IF v_product.category <> 'subscription'
       AND (v_format <> 'electronic' OR v_addons_count > 0) THEN
      v_needs_shipping := true;
    END IF;

    -- سعر القصة بعد العرض (لو فيه عرض ساري) + سعرها الأصلي للقطة.
    v_eff_printed := public.effective_price('product_printed', v_product.id::text, v_product.price);
    v_eff_elec    := CASE WHEN coalesce(v_product.electronic_price, 0) > 0
                          THEN public.effective_price('product_electronic', v_product.id::text, v_product.electronic_price)
                          ELSE 0 END;
    v_base := CASE v_format
      WHEN 'printed'    THEN v_eff_printed
      WHEN 'electronic' THEN v_eff_elec
      ELSE v_eff_printed + v_eff_elec
    END;
    v_base_list := CASE v_format
      WHEN 'printed'    THEN v_product.price
      WHEN 'electronic' THEN v_product.electronic_price
      ELSE v_product.price + v_product.electronic_price
    END;
    v_unit      := v_base      + v_addons_total;
    v_list_unit := v_base_list + v_addons_list;

    -- أسلوب الكتابة: للقصص المخصصة فقط. اختياري في القاعدة (الكود القديم ما بيبعتهوش)،
    -- لكن لو اتبعت لازم يكون صالحًا ومتاحًا للمنتج، وبيتخزّن مختصرًا.
    v_customization := coalesce(v_item->'customization_data', '{}'::jsonb) - 'writingStyle';
    v_ws := v_item->'customization_data'->'writingStyle';
    IF v_product.category = 'custom' AND v_ws IS NOT NULL AND jsonb_typeof(v_ws) <> 'null' THEN
      IF jsonb_typeof(v_ws) <> 'object' THEN
        RAISE EXCEPTION 'أسلوب الكتابة غير صالح';
      END IF;
      v_ws_style := v_ws->>'style';
      IF v_ws_style IS NULL OR v_ws_style NOT IN ('fusha', 'simple', 'dialect') THEN
        RAISE EXCEPTION 'أسلوب الكتابة غير صالح';
      END IF;
      IF v_product.writing_styles IS NOT NULL
         AND NOT (v_ws_style = ANY (v_product.writing_styles)) THEN
        RAISE EXCEPTION 'أسلوب الكتابة ده مش متاح للقصة دي';
      END IF;
      IF v_ws_style = 'dialect' THEN
        v_ws_dialect := v_ws->>'dialect';
        IF v_ws_dialect IS NULL OR NOT EXISTS (
          SELECT 1 FROM writing_dialects d WHERE d.code = v_ws_dialect AND d.is_active
        ) THEN
          RAISE EXCEPTION 'اختار اللهجة المطلوبة';
        END IF;
        v_ws := jsonb_build_object('style', v_ws_style, 'dialect', v_ws_dialect);
      ELSE
        v_ws := jsonb_build_object('style', v_ws_style);
      END IF;
      v_customization := v_customization || jsonb_build_object('writingStyle', v_ws);
    END IF;

    v_customization := v_customization || jsonb_build_object('addons', v_addons_snap);

    v_lines := v_lines || jsonb_build_object(
      'product_id',      v_product.id::text,
      'quantity',        v_qty,
      'unit_price',      v_unit,
      'list_unit_price', v_list_unit,
      'format',          v_format,
      'customization',   v_customization
    );

    v_subtotal := v_subtotal + (v_unit * v_qty);
  END LOOP;

  -- ══ النسخة الإلكترونية حسب الدولة ═══════════════════════
  IF v_has_electronic AND NOT v_crow.electronic_enabled THEN
    RAISE EXCEPTION 'النسخة الإلكترونية مش متاحة في بلدك دلوقتي';
  END IF;

  -- ══ إيميل الاستلام ═════════════════════════════════════
  IF v_has_electronic THEN
    v_email := lower(btrim(coalesce(p_shipping->>'deliveryEmail', '')));
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 254 THEN
      RAISE EXCEPTION 'اكتب الإيميل اللي هتستلم عليه النسخة الإلكترونية';
    END IF;
  END IF;

  -- ══ الشحن ══════════════════════════════════════════════
  IF v_needs_shipping THEN
    IF coalesce(btrim(p_shipping->>'governorate'), '') = ''
       OR coalesce(btrim(p_shipping->>'city'), '') = '' THEN
      RAISE EXCEPTION 'عنوان الشحن مطلوب';
    END IF;

    SELECT * INTO v_q FROM public.shipping_quote(
      v_country, p_shipping->>'governorate', p_shipping->>'city');
    IF NOT v_q.available THEN
      RAISE EXCEPTION '%', v_q.message;
    END IF;
    v_shipping := v_q.fee;
  END IF;

  -- ══ كود الخصم (ملف 13) ════════════════════════════════
  -- على المنتجات والإضافات (بعد العرض وخصم المشترك) — مش على الشحن.
  IF NULLIF(btrim(coalesce(p_discount_code, '')), '') IS NOT NULL THEN
    v_code     := public.discount_code_take(p_discount_code, v_user, 'enha_lak', true);
    v_code_off := round(v_subtotal * v_code.percent / 100.0);
  END IF;

  -- ══ الطلب: بالإجمالي النهائي من أول لحظة (ملف 108) ═════
  INSERT INTO orders (
    user_id, total_amount, shipping_fee, status,
    recipient_name, recipient_phone, address_line, city, governorate, shipping_notes,
    delivery_email, discount_code, discount_amount, country_code
  )
  VALUES (
    v_user, round(v_subtotal - v_code_off + v_shipping), v_shipping, 'pending',
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'recipientName',  '')), '') END,
    NULLIF(btrim(coalesce(p_shipping->>'recipientPhone', '')), ''),
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'addressLine',    '')), '') END,
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'city',           '')), '') END,
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'governorate',    '')), '') END,
    NULLIF(btrim(coalesce(p_shipping->>'notes', '')), ''),
    CASE WHEN v_has_electronic THEN v_email END,
    v_code.code, v_code_off, v_country
  )
  RETURNING id INTO v_order_id;

  IF v_code.id IS NOT NULL THEN
    PERFORM public.discount_code_record(v_code.id, v_user, 'enha_lak', v_order_id::text, v_code_off);
  END IF;

  -- ══ البنود ═════════════════════════════════════════════
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines)
  LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, customization_data, format, list_price_snapshot)
    VALUES (
      v_order_id,
      (v_line->>'product_id')::uuid,
      (v_line->>'quantity')::integer,
      (v_line->>'unit_price')::numeric,
      v_line->'customization',
      v_line->>'format',
      round((v_line->>'list_unit_price')::numeric)::integer
    );
  END LOOP;

  RETURN v_order_id::text;
END
$function$;


CREATE OR REPLACE FUNCTION public.create_box_subscription_order(
  p_plan_id text, p_details jsonb, p_shipping jsonb, p_discount_code text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user     uuid := auth.uid();
  v_plan     record;
  v_free     text;
  v_child    text;
  v_fee      numeric;
  v_shipping numeric;
  v_price    numeric;
  v_goals    jsonb := '[]'::jsonb;
  v_goal     text;
  v_i        integer;
  v_details  jsonb;
  v_order_id uuid;
  v_code     discount_codes;
  v_code_off integer := 0;
  v_country  text;
  v_q        record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول قبل الاشتراك';
  END IF;

  SELECT id, name, price_total, duration_months, addon_discount_percent, free_addon_id
    INTO v_plan
    FROM box_subscription_plans
   WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الخطة دي مش متاحة';
  END IF;
  IF coalesce(v_plan.duration_months, 0) < 1 OR coalesce(v_plan.price_total, 0) <= 0 THEN
    RAISE EXCEPTION 'الخطة دي ناقصة بياناتها — تواصل معانا';
  END IF;

  -- سعر الخطة بعد العرض (لو فيه عرض ساري).
  v_price := public.effective_price('box_plan', v_plan.id::text, v_plan.price_total);

  v_child := NULLIF(p_details->>'childId', '');
  IF v_child IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM child_profiles c WHERE c.id::text = v_child AND c.user_profile_id = v_user
  ) THEN
    RAISE EXCEPTION 'ملف المشارك المرفق لا يخص صاحب الحساب';
  END IF;

  -- الصندوق مادي دايمًا: الدولة لازم تكون مفتوحة للتوصيل (قرار الأدمن).
  v_country := upper(btrim(coalesce(NULLIF(btrim(coalesce(p_shipping->>'country', '')), ''), 'EG')));

  IF coalesce(btrim(p_shipping->>'governorate'), '') = ''
     OR coalesce(btrim(p_shipping->>'city'), '') = '' THEN
    RAISE EXCEPTION 'عنوان الشحن مطلوب';
  END IF;
  SELECT * INTO v_q FROM public.shipping_quote(
    v_country, p_shipping->>'governorate', p_shipping->>'city');
  IF NOT v_q.available THEN
    RAISE EXCEPTION '%', v_q.message;
  END IF;
  v_fee      := v_q.fee;
  v_shipping := v_fee * v_plan.duration_months;

  FOR v_i IN 1..v_plan.duration_months LOOP
    v_goal := NULLIF(left(btrim(coalesce(p_details->'monthlyGoals'->>(v_i - 1), '')), 200), '');
    -- ⚠️ `jsonb_build_array` مش `to_jsonb`: `|| NULL` بيمسح المصفوفة كلها.
    v_goals := v_goals || jsonb_build_array(v_goal);
  END LOOP;

  SELECT a.name INTO v_free FROM addon_products a WHERE a.id::text = v_plan.free_addon_id;

  -- ⚠️ بيانات الخطة **منسوخة** في الطلب: لو الإدارة غيّرت السعر أو الخصم بعدين،
  --    الطلب ده بيفضل بشروطه.
  v_details := (coalesce(p_details, '{}'::jsonb) - 'monthlyGoals' - 'addons')
    || jsonb_build_object(
         'monthlyGoals', v_goals,
         'plan', jsonb_build_object(
           'id', v_plan.id, 'name', v_plan.name, 'months', v_plan.duration_months,
           'price', v_price, 'listPrice', v_plan.price_total, 'shippingPerMonth', v_fee,
           'addonDiscountPercent', v_plan.addon_discount_percent,
           'freeAddonName', v_free
         )
       );

  IF NULLIF(btrim(coalesce(p_discount_code, '')), '') IS NOT NULL THEN
    v_code     := public.discount_code_take(p_discount_code, v_user, 'box', true);
    v_code_off := round(v_price * v_code.percent / 100.0);
  END IF;

  INSERT INTO orders (
    user_id, total_amount, shipping_fee, status,
    recipient_name, recipient_phone, address_line, city, governorate, shipping_notes,
    box_plan_id, box_details, discount_code, discount_amount, country_code
  )
  VALUES (
    v_user, round(v_price - v_code_off + v_shipping), v_shipping, 'pending',
    NULLIF(btrim(coalesce(p_shipping->>'recipientName',  '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'recipientPhone', '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'addressLine',    '')), ''),
    btrim(p_shipping->>'city'),
    btrim(p_shipping->>'governorate'),
    NULLIF(btrim(coalesce(p_shipping->>'notes', '')), ''),
    v_plan.id, v_details, v_code.code, v_code_off, v_country
  )
  RETURNING id INTO v_order_id;

  IF v_code.id IS NOT NULL THEN
    PERFORM public.discount_code_record(v_code.id, v_user, 'box', v_order_id::text, v_code_off);
  END IF;

  RETURN v_order_id::text;
END
$function$;
