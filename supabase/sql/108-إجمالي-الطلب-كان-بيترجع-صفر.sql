-- ============================================================
-- 108 — إجمالي الطلب كان بيترجع صفر
-- ============================================================
--
-- ── العطل، وهو تصادم بين حمايتين إحنا اللي بنيناهم ──────────
--
-- ملف 106: ستة طلبات بنودها ليها قيمة (500 · 500 · 500 · 500 ·
-- 21,000 · 21,200) **والإجمالي صفر**. وأربعة منهم `paid` أو
-- `delivered` — **بضاعة اتباعت واتسلّمت والمنصة سجّلت صفرًا**.
--
-- ملف 107: الدالة **نسخة واحدة**، وجسمها المنشور **فيه الحساب**.
-- يعني مش فخّ (س) ولا كود ناقص.
--
-- ── السبب ───────────────────────────────────────────────────
--
-- `create_customer_order` شغّالة على تلات خطوات:
--
--     ① INSERT INTO orders (… total_amount …) VALUES (… 0 …)
--     ② الدوران على البنود وتجميع `v_subtotal`
--     ③ UPDATE orders SET total_amount = v_subtotal + v_shipping
--
-- وعلى `orders` محفّز `guard_order_fields` (ملف 48) بيقول:
--
--     IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW;
--     …
--     NEW.total_amount := OLD.total_amount;
--     NEW.shipping_fee := OLD.shipping_fee;
--
-- ⚠️ **والدالة `SECURITY DEFINER` مش بتخلّي `auth.uid()` فاضية.**
--
--    `SECURITY DEFINER` بتغيّر **دور قاعدة البيانات**، مش بيانات
--    الجلسة. و`auth.uid()` بتقرا من `request.jwt.claims` — وهي
--    إعداد جلسة مالوش علاقة بالدور. فجوّه الدالة `auth.uid()`
--    **لسه بترجّع العميل**.
--
--    يعني الخطوة ③ بيمسكها المحفّظ ويقول «العميل ما بيلمسش الفلوس»
--    ويرجّع `total_amount` لقيمته القديمة — **صفر**. والـ`UPDATE`
--    **بتنجح**، ومفيش خطأ، ومفيش تحذير.
--
--    والدليل القاطع في ملف 107 قسم ٤: **الست طلبات رسوم شحنها صفر
--    كمان** — والمحفّظ بيرجّع `shipping_fee` في نفس السطر بالظبط.
--
-- ⚠️ **والحمايتان الاتنين صح.** المحفّظ لازم يمنع العميل من تعديل
--    المبلغ — دي ثغرة أغلقناها في ملف 41. والدالة لازم تحسب
--    الإجمالي. العطل إن الدالة بتحسبه **بتعديل بعد الإنشاء**،
--    فبتقع في حارسها هي.
--
-- ── الإصلاح ─────────────────────────────────────────────────
--
-- **الحساب بيتم كله قبل إنشاء الطلب، والإجمالي بيتكتب في الإدراج
-- نفسه — فمفيش `UPDATE` يقع في المحفّز أصلًا.**
--
--   ① دورة أولى على البنود: تسعير وتحقّق وتجميع، والنتيجة بتتخزّن
--      في `v_lines` (بلا أي كتابة في القاعدة)
--   ② حساب الشحن
--   ③ `INSERT INTO orders` **بالإجمالي النهائي**
--   ④ إدراج البنود من `v_lines`
--
-- ⚠️ **والتوقيع زي ما هو بالحرف** — `(p_items jsonb, p_shipping
--    jsonb DEFAULT NULL)` — عشان `CREATE OR REPLACE` **تستبدل** لا
--    تضيف نسخة تانية (قاعدة «س»، وهي اللي أوقعت حجز الباقات في
--    ملف 86).
--
-- ⚠️ **والقسم الثاني بيصلّح الطلبات الستة**: الإجمالي بيترجع من
--    بنودها هي — البنود هي الحقيقة، والعميل دفع على أساسها.
--    والتصحيح ده شغّال من محرر SQL لأن `auth.uid()` بتبقى فاضية
--    هناك فالمحفّظ بيعدّي.
-- ============================================================

BEGIN;

-- ── ١) الدالة: الحساب قبل الإنشاء ──────────────────────────

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
  v_addons_snap    jsonb;
  v_customization  jsonb;
  v_subtotal       numeric := 0;
  v_shipping       numeric := 0;
  v_needs_shipping boolean := false;
  -- البنود المحسوبة قبل ما نكتب حاجة في القاعدة.
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

    SELECT p.id, p.price, p.category
      INTO v_product
      FROM personalized_products p
     WHERE p.id::text = v_item->>'product_id';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'منتج غير موجود: %', v_item->>'product_id';
    END IF;

    IF v_product.category <> 'subscription' THEN
      v_needs_shipping := true;
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

        -- `jsonb_exists` مش المعامل `?` عن قصد: `?` بيتلخبط مع علامات
        -- الاستفهام اللي بعض عملاء SQL بيفسّروها كمعاملات استعلام.
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
        v_addons_snap  := v_addons_snap || jsonb_build_object(
          'id',    v_addon.id,
          'name',  v_addon.name,
          'price', v_addon_price,
          'customized', v_addon_custom
        );
      END LOOP;
    END IF;

    v_unit := v_product.price + v_addons_total;

    -- نسخة من الإضافات وقت الطلب: لو السعر اتغيّر بعدين، الطلب القديم
    -- بيفضل شايل اللي العميل دفعه فعلًا.
    v_customization := coalesce(v_item->'customization_data', '{}'::jsonb)
                       || jsonb_build_object('addons', v_addons_snap);

    -- ⚠️ **البند بيتخزّن هنا، مش بيتكتب في القاعدة.** الكتابة بعد
    --    ما الطلب يتعمل بإجماليه النهائي.
    v_lines := v_lines || jsonb_build_object(
      'product_id',   v_product.id::text,
      'quantity',     v_qty,
      'unit_price',   v_unit,
      'customization', v_customization
    );

    v_subtotal := v_subtotal + (v_unit * v_qty);
  END LOOP;

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

  -- ══ الطلب: بالإجمالي النهائي من أول لحظة ═══════════════
  --
  -- ⚠️ **ده كل الإصلاح.** كان بيتعمل بصفر وبيتحدّث بعدين،
  --    والتحديث بيقع في `guard_order_fields` اللي بيرجّع
  --    `total_amount` و`shipping_fee` لقيمهم القديمة (صفر).
  INSERT INTO orders (
    user_id, total_amount, shipping_fee, status,
    recipient_name, recipient_phone, address_line, city, governorate, shipping_notes
  )
  VALUES (
    v_user, v_subtotal + v_shipping, v_shipping, 'pending',
    NULLIF(btrim(coalesce(p_shipping->>'recipientName',  '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'recipientPhone', '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'addressLine',    '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'city',           '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'governorate',    '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'notes',          '')), '')
  )
  RETURNING id INTO v_order_id;

  -- ══ البنود ═════════════════════════════════════════════
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines)
  LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, customization_data)
    VALUES (
      v_order_id,
      (v_line->>'product_id')::uuid,
      (v_line->>'quantity')::integer,
      (v_line->>'unit_price')::numeric,
      v_line->'customization'
    );
  END LOOP;

  RETURN v_order_id::text;
END
$function$;

-- الصلاحيات زي ما كانت: المسجَّل بس (ملف 82 سحبها من الزائر).
REVOKE ALL ON FUNCTION public.create_customer_order(jsonb, jsonb)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb, jsonb)
  TO authenticated;


-- ── ٢) تصحيح الطلبات الستة ─────────────────────────────────
--
-- ⚠️ **الإجمالي بيترجع من بنود الطلب نفسه** — هي الحقيقة، والعميل
--    دفع على أساسها. ورسوم الشحن بتفضل زي ما هي (صفر) لأن مفيش
--    مصدر نعرف منه كانت كام وقت الطلب.
--
-- ⚠️ **الشرط `total_amount = 0` مهم**: من غيره التصحيح ده يدوس على
--    الطلبين السليمين كمان.

UPDATE orders o
   SET total_amount = COALESCE(
         (SELECT sum(oi.unit_price * oi.quantity)
            FROM order_items oi WHERE oi.order_id = o.id), 0
       ) + COALESCE(o.shipping_fee, 0),
       updated_at = now()
 WHERE COALESCE(o.total_amount, 0) = 0
   AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id);

COMMIT;

-- ============================================================
-- استعلام التأكيد — واحد
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ١) نسخة واحدة بنفس التوقيع (قاعدة «س»)
  SELECT
    '1. الدالة'::text AS القسم,
    (pr.proname || '(' || pg_get_function_arguments(pr.oid) || ')')::text AS البند,
    ('نسخ: ' || count(*) OVER (PARTITION BY pr.proname)::text
      || '  ·  بتحدّث الإجمالي بعد الإنشاء: '
      || CASE WHEN pg_get_functiondef(pr.oid) ILIKE '%SET total_amount%'
              THEN '**أيوه — الإصلاح ما اشتغلش**' ELSE 'لأ' END)::text AS التفاصيل,
    CASE WHEN count(*) OVER (PARTITION BY pr.proname) = 1
          AND pg_get_functiondef(pr.oid) NOT ILIKE '%SET total_amount%'
         THEN '✓ نسخة واحدة بلا تحديث لاحق'
         ELSE '✗ راجع' END AS الحالة
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public' AND pr.proname = 'create_customer_order'

  UNION ALL

  -- ٢) الطلبات بعد التصحيح
  SELECT
    '2. الطلبات',
    o.id::text,
    ('الحالة: ' || o.status::text
      || '  ·  الإجمالي: ' || COALESCE(o.total_amount::text, 'NULL')
      || '  ·  مجموع البنود: '
      || COALESCE((SELECT sum(oi.unit_price * oi.quantity)::text
                     FROM order_items oi WHERE oi.order_id = o.id), '—'))::text,
    CASE WHEN COALESCE(o.total_amount,0) =
              COALESCE((SELECT sum(oi.unit_price * oi.quantity)
                          FROM order_items oi WHERE oi.order_id = o.id), 0)
                 + COALESCE(o.shipping_fee, 0)
         THEN '✓ متطابق' ELSE '⚠️ فرق' END
  FROM public.orders o

  UNION ALL

  -- ٣) الخلاصة
  SELECT
    '3. الخلاصة',
    'طلبات بصفر',
    ('لسه بصفر: ' || (SELECT count(*)::text FROM public.orders
                        WHERE COALESCE(total_amount,0) = 0)
      || '  ·  إجمالي الطلبات: ' || (SELECT count(*)::text FROM public.orders)
      || '  ·  مجموع الإيرادات: '
      || (SELECT COALESCE(sum(total_amount),0)::text FROM public.orders))::text,
    CASE WHEN (SELECT count(*) FROM public.orders
                WHERE COALESCE(total_amount,0) = 0
                  AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = orders.id)) = 0
         THEN '✓ مفيش طلب ببنود وإجمالي صفر' ELSE '✗ لسه فيه' END

) t ORDER BY القسم, البند;

-- ============================================================
-- التراجع
-- ============================================================
--
-- ⚠️ التراجع بيرجّع العطل: الطلبات هتتسجّل بصفر تاني.
-- ⚠️ وتصحيح الإجماليات **مالوش تراجع** — القيم القديمة كانت صفرًا،
--    والصح هو اللي اتكتب.
--
-- -- رجّع قسم الدالة من ملف 85 زي ما هو.
-- ============================================================
