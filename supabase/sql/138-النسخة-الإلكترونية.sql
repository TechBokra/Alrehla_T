-- ============================================================
-- 138 — النسخة الإلكترونية لقصص «أنت البطل هنا»
-- ============================================================
--
-- ── قرارات تامر ────────────────────────────────────────────
--
--   • الإلكتروني لـ«أنت البطل هنا» **وحدها** — مش المكتبة
--   • بتتبعت للعميل **بالإيميل** — يدوي من الإدارة دلوقتي
--   • ينفع مطبوع + إلكتروني في نفس الطلب
--   • إلكتروني لوحده = **من غير شحن** — إلا لو فيه إضافات (حاجات
--     ملموسة) فبتتشحن
--
-- ── اللي بيتعمل ────────────────────────────────────────────
--
--   ① `order_items.format`: `printed` · `electronic` · `both`
--      (الافتراضي `printed` — كل البنود القديمة مطبوعة فعلًا)
--   ② `orders.delivery_email` — الإيميل اللي العميل هيستلم عليه
--      `orders.electronic_sent_at` — الإدارة بتسجّل إنها بعتت
--   ③ `create_customer_order` — **نفس التوقيع بالحرف** (قاعدة «س»):
--        • الإلكتروني مسموح لـ`category = 'custom'` و`electronic_price > 0`
--          **بس** — القاعدة بترفض، مش الشاشة
--        • السعر: مطبوع = `price` · إلكتروني = `electronic_price` ·
--          الاتنين = المجموع · + الإضافات زي ما هي
--        • الإلكتروني والاتنين **كمية واحدة**: ملف واحد مالوش
--          «نسختين»، والعميل اللي عايز نسختين مطبوعين يطلبهم مطبوع
--        • الشحن مطلوب لو فيه مطبوع **أو إضافة** في الطلب
--        • فيه إلكتروني ← الإيميل إلزامي ويتحفظ مع الطلب
--   ④ `guard_order_fields` (ملف 48): `electronic_sent_at` **للإدارة
--      وحدها** — الحارس بيقفل الخانات اللي بالاسم بس، فأي عمود جديد
--      بيبقى مفتوح للعميل لو ماتضافش (درس 42 بشكل تاني).
--      و`delivery_email` مفتوح **عن قصد** زي عنوان الشحن: العميل يصحّح
--      إيميله قبل الإرسال.
--
-- ⚠️ **فحص الأمان في الأول**: الملف بيتأكد إن الدالة اللي على القاعدة
--    هي نسخة ملف 108 قبل ما يستبدلها. لو حد عدّلها من برّه الملفات،
--    الملف بيقف ومابيغيّرش حاجة — عشان مانمسحش تعديلًا مش عارفينه.
-- ============================================================

BEGIN;

DO $check$
DECLARE
  v_src text;
BEGIN
  SELECT p.prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_customer_order'
     AND pg_get_function_identity_arguments(p.oid) = 'p_items jsonb, p_shipping jsonb';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'وقفنا: create_customer_order(jsonb, jsonb) مش موجودة بالتوقيع المتوقّع';
  END IF;
  IF v_src NOT LIKE '%v_needs_shipping%' OR v_src NOT LIKE '%v_lines%'
     OR v_src NOT LIKE '%customized_addon_ids%' THEN
    RAISE EXCEPTION 'وقفنا: الدالة على القاعدة مش نسخة ملف 108 — ابعت الرسالة دي';
  END IF;
  IF v_src LIKE '%electronic_price%' THEN
    RAISE EXCEPTION 'وقفنا: الدالة فيها النسخة الإلكترونية أصلًا — الملف اتشغّل قبل كده؟';
  END IF;
END
$check$;

-- ── ① و② الأعمدة ────────────────────────────────────────────

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'printed';
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_format_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_format_check CHECK (format IN ('printed', 'electronic', 'both'));
COMMENT ON COLUMN public.order_items.format IS
  'مطبوع / إلكتروني / الاتنين — الإلكتروني لـ«أنت البطل هنا» وحدها (ملف 138).';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_email text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS electronic_sent_at timestamptz;
COMMENT ON COLUMN public.orders.delivery_email IS
  'إيميل استلام النسخة الإلكترونية — العميل يقدر يصحّحه (ملف 138).';
COMMENT ON COLUMN public.orders.electronic_sent_at IS
  'وقت إرسال النسخة الإلكترونية — الإدارة وحدها (ملف 138).';

-- ── ③ الدالة ────────────────────────────────────────────────

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
  v_lines          jsonb   := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول قبل الطلب';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'الطلب فاضي';
  END IF;

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

        v_addons_total := v_addons_total + v_addon_price;
        v_addons_count := v_addons_count + 1;
        v_addons_snap  := v_addons_snap || jsonb_build_object(
          'id',    v_addon.id,
          'name',  v_addon.name,
          'price', v_addon_price,
          'customized', v_addon_custom
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

-- ── ④ الحارس — نسخة ملف 48 + سطر واحد ──────────────────────

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
  NEW.electronic_sent_at := OLD.electronic_sent_at;   -- ⭐ ملف 138

  -- عنوان الشحن وإيميل الاستلام مفتوحين عن قصد: العميل يصحّحهم قبل التنفيذ.

  RETURN NEW;
END
$function$;

COMMIT;

-- ══ التأكيد — استعلام واحد ═══════════════════════════════════
SELECT البند, النتيجة FROM (
  SELECT 1 AS ترتيب, 'عمود نوع النسخة في البنود' AS البند,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='order_items' AND column_name='format')
         THEN '✓' ELSE '✗' END AS النتيجة
  UNION ALL
  SELECT 2, 'إيميل الاستلام + وقت الإرسال في الطلبات',
    CASE WHEN (SELECT count(*) FROM information_schema.columns
                WHERE table_schema='public' AND table_name='orders'
                  AND column_name IN ('delivery_email','electronic_sent_at')) = 2
         THEN '✓' ELSE '✗' END
  UNION ALL
  SELECT 3, 'نسخ دالة الطلب (لازم 1)',
    (SELECT count(*)::text || CASE WHEN count(*) = 1 THEN ' ✓' ELSE ' ✗' END
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='create_customer_order')
  UNION ALL
  SELECT 4, 'الدالة بتعرف الإلكتروني',
    CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname='create_customer_order' LIMIT 1)
              LIKE '%electronic_price%' THEN '✓' ELSE '✗' END
  UNION ALL
  SELECT 5, 'الزائر مايقدرش ينادي دالة الطلب',
    CASE WHEN has_function_privilege('anon', 'public.create_customer_order(jsonb, jsonb)', 'EXECUTE')
         THEN '✗ مفتوحة للزائر' ELSE '✓' END
  UNION ALL
  SELECT 6, 'الحارس بيقفل وقت الإرسال',
    CASE WHEN (SELECT prosrc FROM pg_proc WHERE proname='guard_order_fields' LIMIT 1)
              LIKE '%electronic_sent_at%' THEN '✓' ELSE '✗' END
  UNION ALL
  SELECT 7, 'البنود القديمة كلها «مطبوع»',
    (SELECT count(*)::text || ' بند' FROM public.order_items WHERE format = 'printed')
  UNION ALL
  SELECT 8, 'منتجات «أنت البطل» ليها سعر إلكتروني',
    (SELECT count(*) FILTER (WHERE coalesce(electronic_price,0) > 0)::text || ' من '
            || count(*)::text FROM public.personalized_products WHERE category = 'custom')
) t ORDER BY ترتيب;

-- ══ التراجع (معلَّق) ═════════════════════════════════════════
-- ⚠️ ارجع الكود الأول. وبعدين شغّل ملف 108 كله (بيرجّع الدالة)،
--    وملف 48 جزء الحارس، وبعدها:
-- ALTER TABLE public.order_items DROP COLUMN IF EXISTS format;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_email;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS electronic_sent_at;
