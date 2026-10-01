-- ============================================================
-- 140 — صندوق الرحلة: الشراء، التفعيل بعد الدفع، الشهور، والمزايا
-- ============================================================
--
-- ── المشكلة (ملف 137 + 139) ────────────────────────────────
--
--   • الخطط التلاتة **مايتشروش**: زرار «اشترك» بيحط رقم الخطة في
--     السلة كأنه منتج، ودالة الطلب مابتلاقيهوش ← «منتج غير موجود».
--   • مفيش أي كود بيسجّل اشتراك. صفر صفوف في `box_subscriptions`.
--   • 🔴 **أي عميل يقدر يعمل لنفسه اشتراك «نشط» من غير دفع**: صلاحية
--     «Users can create their own subscription» بتسمح بالإضافة،
--     والحالة الافتراضية `active`. مالهاش ضرر النهارده — بس أول ما
--     الخصم يتربط بالاشتراك (البند ⑤) تبقى ثغرة فلوس.
--
-- ── قرارات تامر ────────────────────────────────────────────
--
--   قصة مخصصة جديدة كل شهر · المدة كلها تتدفع مرة واحدة · الشحن =
--   سعر المنطقة × عدد الشهور · خصم على الإضافات + إضافة مجانية مع كل
--   صندوق · الأهداف: العميل يكتبها لكل شهر أو يسيبها للإدارة · مفيش
--   إضافات بفلوس مع الاشتراك نفسه.
--
-- ── اللي بيتعمل ────────────────────────────────────────────
--
--   ① الخطط: `addon_discount_percent` (0–90) + `free_addon_id`
--   ② الطلبات: `box_plan_id` + `box_details` — طلب الاشتراك طلب عادي
--      (نفس الدفع والإيصال والرقم المرجعي) **من غير بنود**
--   ③ `create_box_subscription_order` — السعر والشحن من القاعدة
--   ④ محفّز `activate_box_subscription`: أول ما طلب الاشتراك يبقى
--      «مدفوع» بيعمل الاشتراك + صف لكل شهر. **مايتنسيش**: مش خطوة في
--      الكود ممكن حد يفوّتها. ومرة واحدة بس لكل طلب (`order_id` فريد)
--   ⑤ `create_customer_order`: خصم المشترك على الإضافات
--   ⑥ `box_shipments`: شهور الاشتراك وحالة كل شحنة — للإدارة
--   ⑦ 🔴 شيل صلاحية إنشاء الاشتراك من العميل
--   ⑧ الحارس: `box_plan_id` و`box_details` مايتغيّروش بعد الإنشاء
--
-- ⚠️ **فحص الأمان في الأول** زي 138: الملف بيقف لو دالة الطلب مش نسخة
--    138 — عشان مانمسحش تعديلًا مش عارفينه.
-- ============================================================

BEGIN;

DO $check$
DECLARE v_src text;
BEGIN
  SELECT p.prosrc INTO v_src FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'create_customer_order'
     AND pg_get_function_identity_arguments(p.oid) = 'p_items jsonb, p_shipping jsonb';
  IF v_src IS NULL OR v_src NOT LIKE '%electronic_price%' THEN
    RAISE EXCEPTION 'وقفنا: دالة الطلب مش نسخة ملف 138 — شغّل 138 الأول';
  END IF;
  IF v_src LIKE '%box_subscriptions%' THEN
    RAISE EXCEPTION 'وقفنا: الملف ده اتشغّل قبل كده';
  END IF;
END
$check$;

-- ── ① الخطط ─────────────────────────────────────────────────
ALTER TABLE public.box_subscription_plans
  ADD COLUMN IF NOT EXISTS addon_discount_percent smallint NOT NULL DEFAULT 0;
ALTER TABLE public.box_subscription_plans DROP CONSTRAINT IF EXISTS box_plans_discount_check;
ALTER TABLE public.box_subscription_plans
  ADD CONSTRAINT box_plans_discount_check CHECK (addon_discount_percent BETWEEN 0 AND 90);
ALTER TABLE public.box_subscription_plans ADD COLUMN IF NOT EXISTS free_addon_id text;
COMMENT ON COLUMN public.box_subscription_plans.addon_discount_percent IS
  'خصم المشترك على الإضافات طول مدة الاشتراك (ملف 140).';
COMMENT ON COLUMN public.box_subscription_plans.free_addon_id IS
  'إضافة بتتحط مجانًا في كل صندوق (ملف 140).';

-- ── ② الطلبات ───────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS box_plan_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS box_details jsonb;
COMMENT ON COLUMN public.orders.box_plan_id IS 'طلب اشتراك صندوق الرحلة — رقم الخطة (ملف 140).';
COMMENT ON COLUMN public.orders.box_details IS
  'الخطة وقت الشراء + بيانات الطفل + هدف كل شهر (ملف 140).';

-- ── الاشتراكات ─────────────────────────────────────────────
ALTER TABLE public.box_subscriptions ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE public.box_subscriptions ADD COLUMN IF NOT EXISTS plan_id text;
ALTER TABLE public.box_subscriptions ADD COLUMN IF NOT EXISTS months integer;
ALTER TABLE public.box_subscriptions ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE public.box_subscriptions ADD COLUMN IF NOT EXISTS ends_at timestamptz;
ALTER TABLE public.box_subscriptions
  ADD COLUMN IF NOT EXISTS addon_discount_percent smallint NOT NULL DEFAULT 0;
ALTER TABLE public.box_subscriptions ADD COLUMN IF NOT EXISTS free_addon_name text;
ALTER TABLE public.box_subscriptions ADD COLUMN IF NOT EXISTS details jsonb;

ALTER TABLE public.box_subscriptions DROP CONSTRAINT IF EXISTS box_subscriptions_order_id_key;
ALTER TABLE public.box_subscriptions ADD CONSTRAINT box_subscriptions_order_id_key UNIQUE (order_id);
ALTER TABLE public.box_subscriptions DROP CONSTRAINT IF EXISTS box_subscriptions_order_id_fkey;
ALTER TABLE public.box_subscriptions
  ADD CONSTRAINT box_subscriptions_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;

-- ── ⑦ 🔴 العميل مايعملش اشتراك لنفسه ────────────────────────
DROP POLICY IF EXISTS "Users can create their own subscription" ON public.box_subscriptions;

-- ── ⑥ الشهور ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.box_shipments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id    uuid NOT NULL REFERENCES public.box_subscriptions(id) ON DELETE CASCADE,
  month_number       integer NOT NULL CHECK (month_number >= 1),
  goal               text,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'preparing', 'shipped', 'delivered')),
  tracking_reference text,
  shipped_at         timestamptz,
  delivered_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, month_number)
);
COMMENT ON TABLE public.box_shipments IS 'شحنة كل شهر في اشتراك صندوق الرحلة (ملف 140).';

ALTER TABLE public.box_shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage box shipments" ON public.box_shipments;
CREATE POLICY "Admins manage box shipments" ON public.box_shipments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Subscribers view their shipments" ON public.box_shipments;
CREATE POLICY "Subscribers view their shipments" ON public.box_shipments
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.box_subscriptions s
     WHERE s.id = box_shipments.subscription_id AND s.user_id = auth.uid()
  ));

-- ── ③ شراء الاشتراك ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_box_subscription_order(
  p_plan_id  text,
  p_details  jsonb,
  p_shipping jsonb
)
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
  v_goals    jsonb := '[]'::jsonb;
  v_goal     text;
  v_i        integer;
  v_details  jsonb;
  v_order_id uuid;
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

  v_child := NULLIF(p_details->>'childId', '');
  IF v_child IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM child_profiles c WHERE c.id::text = v_child AND c.user_profile_id = v_user
  ) THEN
    RAISE EXCEPTION 'ملف المشارك المرفق لا يخص صاحب الحساب';
  END IF;

  -- الشحن: سعر المنطقة × عدد الشهور (قرار تامر).
  IF coalesce(btrim(p_shipping->>'governorate'), '') = ''
     OR coalesce(btrim(p_shipping->>'city'), '') = '' THEN
    RAISE EXCEPTION 'عنوان الشحن مطلوب';
  END IF;
  SELECT fee INTO v_fee FROM shipping_rates
   WHERE is_active = true
     AND governorate = btrim(p_shipping->>'governorate')
     AND city        = btrim(p_shipping->>'city')
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'منطقة الشحن دي مش مسجّلة — تواصل معانا';
  END IF;
  v_shipping := v_fee * v_plan.duration_months;

  -- هدف كل شهر: اللي العميل كتبه، والفاضي = «تختاره الإدارة» (NULL).
  -- ⚠️ عدد الأهداف = عدد شهور الخطة **من القاعدة**، مش من الواجهة.
  FOR v_i IN 1..v_plan.duration_months LOOP
    v_goal := NULLIF(left(btrim(coalesce(p_details->'monthlyGoals'->>(v_i - 1), '')), 200), '');
    -- ⚠️ `jsonb_build_array` مش `to_jsonb`: `to_jsonb(NULL)` = NULL، و`|| NULL`
    --    بيمسح المصفوفة كلها — أول شهر فاضي كان بيضيّع أهداف الشهور كلها
    --    (اتمسك في التجربة المحلية).
    v_goals := v_goals || jsonb_build_array(v_goal);
  END LOOP;

  SELECT a.name INTO v_free FROM addon_products a WHERE a.id::text = v_plan.free_addon_id;

  -- ⚠️ بيانات الخطة **منسوخة** في الطلب: لو الإدارة غيّرت السعر أو
  --    الخصم بعدين، الطلب ده بيفضل بشروطه.
  v_details := (coalesce(p_details, '{}'::jsonb) - 'monthlyGoals' - 'addons')
    || jsonb_build_object(
         'monthlyGoals', v_goals,
         'plan', jsonb_build_object(
           'id', v_plan.id, 'name', v_plan.name, 'months', v_plan.duration_months,
           'price', v_plan.price_total, 'shippingPerMonth', v_fee,
           'addonDiscountPercent', v_plan.addon_discount_percent,
           'freeAddonName', v_free
         )
       );

  INSERT INTO orders (
    user_id, total_amount, shipping_fee, status,
    recipient_name, recipient_phone, address_line, city, governorate, shipping_notes,
    box_plan_id, box_details
  )
  VALUES (
    v_user, round(v_plan.price_total + v_shipping), v_shipping, 'pending',
    NULLIF(btrim(coalesce(p_shipping->>'recipientName',  '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'recipientPhone', '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'addressLine',    '')), ''),
    btrim(p_shipping->>'city'),
    btrim(p_shipping->>'governorate'),
    NULLIF(btrim(coalesce(p_shipping->>'notes', '')), ''),
    v_plan.id, v_details
  )
  RETURNING id INTO v_order_id;

  RETURN v_order_id::text;
END
$function$;

REVOKE ALL ON FUNCTION public.create_box_subscription_order(text, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_box_subscription_order(text, jsonb, jsonb) TO authenticated;

-- ── ④ التفعيل بعد الدفع ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_box_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_months   integer;
  v_sub_id   uuid;
  v_plan     jsonb := NEW.box_details->'plan';
BEGIN
  v_months := greatest(1, coalesce((v_plan->>'months')::integer, 1));

  INSERT INTO box_subscriptions (
    user_id, customer_name, plan_name, status, next_shipment_date,
    order_id, plan_id, months, starts_at, ends_at,
    addon_discount_percent, free_addon_name, details
  )
  VALUES (
    NEW.user_id,
    coalesce(NEW.recipient_name, 'مشترك'),
    coalesce(v_plan->>'name', 'صندوق الرحلة'),
    'active', now(),
    NEW.id, NEW.box_plan_id, v_months, now(), now() + make_interval(months => v_months),
    coalesce((v_plan->>'addonDiscountPercent')::smallint, 0),
    v_plan->>'freeAddonName',
    NEW.box_details
  )
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO v_sub_id;

  -- اتفعّل قبل كده (الطلب رجع «مدفوع» تاني) = ولا حاجة.
  IF v_sub_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO box_shipments (subscription_id, month_number, goal)
  SELECT v_sub_id, g.n, NEW.box_details->'monthlyGoals'->>(g.n - 1)
    FROM generate_series(1, v_months) AS g(n);

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.activate_box_subscription() FROM public, anon;

DROP TRIGGER IF EXISTS activate_box_subscription_trg ON public.orders;
CREATE TRIGGER activate_box_subscription_trg
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' AND NEW.box_plan_id IS NOT NULL)
  EXECUTE FUNCTION public.activate_box_subscription();

-- ── ⑤ خصم المشترك في دالة الطلب ─────────────────────────────
CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_items    jsonb,
  p_shipping jsonb DEFAULT NULL
)
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

        v_addon_custom := coalesce(
          jsonb_exists(v_item->'customized_addon_ids', v_addon_id),
          false
        );

        IF v_addon_custom AND NOT v_addon.supports_customization THEN
          RAISE EXCEPTION 'الإضافة «%» مبتقبلش تخصيص', v_addon.name;
        END IF;

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
$function$;


REVOKE ALL ON FUNCTION public.create_customer_order(jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb, jsonb) TO authenticated;

-- ── ⑧ الحارس ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_order_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- الاستثناء الوحيد: العميل يقول «حوّلت» ويسيب وسيلة الدفع والإيصال.
  IF OLD.status = 'pending'
     AND NEW.status = 'awaiting_verification' THEN
    NULL;
  ELSE
    NEW.status              := OLD.status;
    NEW.payment_method      := OLD.payment_method;
    NEW.payment_receipt_url := OLD.payment_receipt_url;
  END IF;

  -- الفلوس والملكية والرقم المرجعي: العميل ما بيلمسهمش أبدًا.
  NEW.id                    := OLD.id;
  NEW.user_id               := OLD.user_id;
  NEW.total_amount          := OLD.total_amount;
  NEW.shipping_fee          := OLD.shipping_fee;
  NEW.created_at            := OLD.created_at;
  NEW.payment_reference     := OLD.payment_reference;
  NEW.transaction_reference := OLD.transaction_reference;

  -- التنفيذ والشحن: الإدارة وحدها.
  NEW.shipped_at         := OLD.shipped_at;
  NEW.delivered_at       := OLD.delivered_at;
  NEW.tracking_reference := OLD.tracking_reference;
  NEW.admin_notes        := OLD.admin_notes;
  NEW.electronic_sent_at := OLD.electronic_sent_at;   -- ملف 138
  -- ⭐ ملف 140: طلب الاشتراك مايتحوّلش لطلب عادي ولا العكس، وتفاصيله
  --    (الخطة، الشهور، الأهداف) بتتقفل بالسعر اللي اتحسب عليها.
  NEW.box_plan_id        := OLD.box_plan_id;
  NEW.box_details        := OLD.box_details;

  -- عنوان الشحن وإيميل الاستلام مفتوحين عن قصد: العميل يصحّحهم قبل التنفيذ.

  RETURN NEW;
END
$function$;

COMMIT;

-- ══ التأكيد — استعلام واحد ═══════════════════════════════════
SELECT البند, النتيجة FROM (
  SELECT 1 AS ت, 'خانات الخطط (الخصم + الإضافة المجانية)' AS البند,
    CASE WHEN (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
                AND table_name='box_subscription_plans'
                AND column_name IN ('addon_discount_percent','free_addon_id')) = 2
         THEN '✓' ELSE '✗' END AS النتيجة
  UNION ALL
  SELECT 2, 'جدول شهور الاشتراك',
    CASE WHEN to_regclass('public.box_shipments') IS NOT NULL THEN '✓' ELSE '✗' END
  UNION ALL
  SELECT 3, '🔴 العميل مايقدرش يعمل اشتراك لنفسه',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename='box_subscriptions' AND cmd='INSERT'
                       AND coalesce(with_check,'') NOT ILIKE '%is_admin%')
         THEN '✗ لسه فيه صلاحية' ELSE '✓' END
  UNION ALL
  SELECT 4, 'دالة شراء الاشتراك · مقفولة على الزائر',
    CASE WHEN to_regprocedure('public.create_box_subscription_order(text,jsonb,jsonb)') IS NULL THEN '✗ مش موجودة'
         WHEN has_function_privilege('anon','public.create_box_subscription_order(text,jsonb,jsonb)','EXECUTE')
         THEN '✗ مفتوحة للزائر' ELSE '✓' END
  UNION ALL
  SELECT 5, 'محفّز التفعيل بعد الدفع',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='activate_box_subscription_trg')
         THEN '✓' ELSE '✗' END
  UNION ALL
  SELECT 6, 'دالة الطلب: نسخة واحدة وبتعرف خصم المشترك',
    (SELECT count(*)::text || CASE WHEN count(*) = 1 AND bool_and(prosrc LIKE '%v_discount%')
                                   THEN ' ✓' ELSE ' ✗' END
       FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='create_customer_order')
  UNION ALL
  SELECT 7, 'الحارس بيقفل تفاصيل الاشتراك',
    CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname='guard_order_fields' LIMIT 1) LIKE '%box_details%'
         THEN '✓' ELSE '✗' END
  UNION ALL
  SELECT 10 + row_number() OVER (ORDER BY sort_order), 'خطة: ' || name,
    duration_months || ' شهر · ' || price_total || ' ج · خصم ' || addon_discount_percent || '% · '
      || CASE WHEN free_addon_id IS NULL THEN 'من غير إضافة مجانية' ELSE 'فيها إضافة مجانية' END
  FROM public.box_subscription_plans WHERE is_active
) t ORDER BY ت;

-- ══ التراجع (معلَّق) ═════════════════════════════════════════
-- ⚠️ ارجع الكود الأول. وبعدين: شغّل 138 كله (بيرجّع دالة الطلب والحارس)، و:
-- DROP TRIGGER IF EXISTS activate_box_subscription_trg ON public.orders;
-- DROP FUNCTION IF EXISTS public.activate_box_subscription();
-- DROP FUNCTION IF EXISTS public.create_box_subscription_order(text, jsonb, jsonb);
-- DROP TABLE IF EXISTS public.box_shipments;
-- (الأعمدة الجديدة ممكن تفضل — مابتأثرش على حاجة لوحدها)
-- ⚠️ ومش هنرجّع صلاحية «العميل يعمل اشتراك لنفسه» — دي كانت ثغرة.
