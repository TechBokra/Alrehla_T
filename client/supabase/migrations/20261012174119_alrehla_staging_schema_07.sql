-- ============================================================
-- 07 — الإضافات بتتخصص دايمًا باسم الطفل وصورته
-- ============================================================
--
-- ── قبل الملف ده ─────────────────────────────────────────────
--
-- الإضافة اللي «بتقبل التخصيص» كان العميل بيختار لها «بتخصيص» (بسعر
-- زيادة) أو «بدون تخصيص». ودالة الطلب كانت بتصدّق اختيار الشاشة.
--
-- ── بعده (قرار تامر: «التخصيص مش اختياري لأنه هدف المشروع») ──
--
-- • أي إضافة بتقبل التخصيص **بتتخصص دايمًا**، بنفس اسم الطفل وصورته
--   اللي اتكتبوا للقصة أو الغلاف — مفيش خانات جديدة للعميل.
-- • سعرها = سعر الإضافة + سعر التخصيص، **والقاعدة هي اللي بتقرر** مش
--   الشاشة: حتى لو حد بعت طلب من برّه الموقع من غير تخصيص، بيتخصص
--   وبيتحسب.
-- • الإضافة اللي «مابتقبلش التخصيص» (من شاشة الإضافات) بتفضل إضافة
--   عادية بسعرها.
--
-- ⚠️ التغيير **سطر واحد** في دالة الطلب — الباقي نسخة حرفية من ملف 01
--    (ملف 140 في التاريخ القديم). الصلاحيات على الدالة مابتتغيّرش.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 06. مرة واحدة في SQL Editor → Run. وتشغيله تاني مابيضرّش.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.customization_fields') IS NULL THEN
    RAISE EXCEPTION 'شغّل ملف 06 الأول.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.create_customer_order(p_items jsonb, p_shipping jsonb DEFAULT NULL::jsonb)
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
  v_qty            integer;
  v_child          text;
  v_unit           numeric;
  v_addons_total   numeric;
  v_addons_count   integer;
  v_addons_snap    jsonb;
  v_customization  jsonb;
  v_format         text;
  v_base           numeric;
  v_subtotal       numeric := 0;
  v_shipping       numeric := 0;
  v_needs_shipping boolean := false;
  v_has_electronic boolean := false;
  v_email          text;
  -- ⭐ ملف 140: خصم المشترك على الإضافات (أعلى نسبة لو عنده أكتر من اشتراك)
  v_discount       integer := 0;
  v_lines          jsonb   := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول قبل الطلب';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'الطلب فاضي';
  END IF;

  -- ⭐ ملف 140: المشترك في صندوق الرحلة ليه خصم على الإضافات طول مدة
  --    اشتراكه. الاشتراك **مايتعملش غير بعد تأكيد الدفع** (محفّز
  --    `activate_box_subscription`) — فالعميل مايقدرش يدّي نفسه الخصم.
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

    SELECT p.id, p.price, p.category, p.electronic_price
      INTO v_product
      FROM personalized_products p
     WHERE p.id::text = v_item->>'product_id';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'منتج غير موجود: %', v_item->>'product_id';
    END IF;

    -- ⚠️ **القاعدة هي الحارس**، مش الشاشة: طلب إلكتروني لمنتج مكتبة
    --    أو لمنتج مالوش سعر إلكتروني بيترفض هنا مهما الواجهة بعتت.
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

        -- ⭐ ملف 07 (قرار تامر): **التخصيص مش اختياري.** أي إضافة بتقبل
        --    التخصيص بتتخصص باسم الطفل وصورته، وبتتسعّر بسعره — مهما
        --    الواجهة بعتت في `customized_addon_ids`. كان العميل بيختار
        --    «بتخصيص / بدون»، وأي تلاعب كان يخلّيه ياخدها من غير تخصيص.
        v_addon_custom := v_addon.supports_customization;

        v_addon_price := v_addon.price
          + CASE WHEN v_addon_custom THEN v_addon.customization_price ELSE 0 END;
        -- ⭐ ملف 140: الخصم بيتقرّب لجنيه — إجمالي الطلب عمود صحيح.
        IF v_discount > 0 THEN
          v_addon_price := round(v_addon_price * (100 - v_discount) / 100.0);
        END IF;

        v_addons_total := v_addons_total + v_addon_price;
        v_addons_count := v_addons_count + 1;
        v_addons_snap  := v_addons_snap || jsonb_build_object(
          'id',    v_addon.id,
          'name',  v_addon.name,
          'price', v_addon_price,
          'customized', v_addon_custom,
          'discount_percent', v_discount
        );
      END LOOP;
    END IF;

    -- الشحن: أي حاجة ملموسة — نسخة مطبوعة **أو إضافة** (قرار تامر:
    -- الإضافة مع الإلكتروني بتتشحن). والاشتراك زي ما كان.
    IF v_product.category <> 'subscription'
       AND (v_format <> 'electronic' OR v_addons_count > 0) THEN
      v_needs_shipping := true;
    END IF;

    v_base := CASE v_format
      WHEN 'printed'    THEN v_product.price
      WHEN 'electronic' THEN v_product.electronic_price
      ELSE v_product.price + v_product.electronic_price
    END;
    v_unit := v_base + v_addons_total;

    v_customization := coalesce(v_item->'customization_data', '{}'::jsonb)
                       || jsonb_build_object('addons', v_addons_snap);

    v_lines := v_lines || jsonb_build_object(
      'product_id',    v_product.id::text,
      'quantity',      v_qty,
      'unit_price',    v_unit,
      'format',        v_format,
      'customization', v_customization
    );

    v_subtotal := v_subtotal + (v_unit * v_qty);
  END LOOP;

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

    SELECT fee INTO v_shipping
      FROM shipping_rates
     WHERE is_active = true
       AND governorate = btrim(p_shipping->>'governorate')
       AND city        = btrim(p_shipping->>'city')
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'منطقة الشحن دي مش مسجّلة — تواصل معانا';
    END IF;
  END IF;

  -- ══ الطلب: بالإجمالي النهائي من أول لحظة (ملف 108) ═════
  -- ⚠️ العنوان بيتحفظ **بس لو فيه شحن** — طلب إلكتروني لوحده مالوش
  --    عنوان، وحفظ عنوان مالوش لازمة بيلخبط الإدارة («أشحن لمين؟»).
  INSERT INTO orders (
    user_id, total_amount, shipping_fee, status,
    recipient_name, recipient_phone, address_line, city, governorate, shipping_notes,
    delivery_email
  )
  VALUES (
    v_user, v_subtotal + v_shipping, v_shipping, 'pending',
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'recipientName',  '')), '') END,
    -- التليفون بيتحفظ دايمًا: الإدارة محتاجاه للتواصل حتى من غير شحن.
    NULLIF(btrim(coalesce(p_shipping->>'recipientPhone', '')), ''),
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'addressLine',    '')), '') END,
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'city',           '')), '') END,
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'governorate',    '')), '') END,
    NULLIF(btrim(coalesce(p_shipping->>'notes', '')), ''),
    CASE WHEN v_has_electronic THEN v_email END
  )
  RETURNING id INTO v_order_id;

  -- ══ البنود ═════════════════════════════════════════════
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines)
  LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, customization_data, format)
    VALUES (
      v_order_id,
      (v_line->>'product_id')::uuid,
      (v_line->>'quantity')::integer,
      (v_line->>'unit_price')::numeric,
      v_line->'customization',
      v_line->>'format'
    );
  END LOOP;

  RETURN v_order_id::text;
END
$function$
;

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- لازم يطلع ✓.
SELECT 'دالة الطلب: الإضافة بتتخصص دايمًا' AS "البند",
       CASE WHEN pg_get_functiondef('public.create_customer_order(jsonb, jsonb)'::regprocedure)
                 LIKE '%v_addon_custom := v_addon.supports_customization;%'
            THEN '✓' ELSE '✗' END AS "الحالة";
