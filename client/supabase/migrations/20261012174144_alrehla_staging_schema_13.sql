-- ============================================================
-- 13 — أكواد الخصم · وسعر طلب الخدمة الإبداعية من القاعدة
-- ============================================================
--
-- ── ليه (قرار تامر، بدل فكرة PZZQ) ──────────────────────────
--
-- ١) **كود خصم** بيتعمل من لوحة الإدارة: نسبة (١–٩٠٪)، وتاريخ بداية
--    ونهاية (اختياريين)، وعدد استخدامات كلّي (اختياري)، ويشتغل على كل
--    المنصة أو على أقسام بعينها: «إنها لك» · صندوق الرحلة · باقات
--    «بداية الرحلة» · الخدمات الإبداعية.
--    • **مرة واحدة لكل عميل.**
--    • على المنتجات بس — **مش على الشحن**. ومع خصم مشترك الصندوق
--      بيتجمع: خصم المشترك على الإضافات الأول، والكود بعده.
--    • **المنصة هي اللي بتتحمّل الخصم**: نصيب الناشر وحصيلة المدرب
--      زي ما هما.
--    • الطلب اللي اتلغى (أو ماتدفعش واتلغى لوحده) بيرجّع الكود للعميل.
--    • الحساب كله **هنا في القاعدة** — الشاشة بتعرض بس.
--
-- ٢) 🔴 **ثغرة اتقفلت: سعر طلب الخدمة الإبداعية كان بيتحسب في كود
--    الموقع** وبعدين يتحفظ. أي حد فاهم تقنيًا كان يقدر يعمل طلب خدمة
--    بأي سعر (جنيه مثلًا) من غير ما يعدّي على الموقع. دلوقتي القاعدة
--    بتحسبه بنفسها من السعر المعتمد — زي طلبات «إنها لك» بالظبط.
--
-- ٣) 🔴 **وطلب الخدمة نفسه كان بيترفض** («تعذّر إنشاء الطلب»): رقمه
--    المرجعي بيتعمل بدالة مقفولة على حساب العميل. اتفتحتله (التفصيل تحت).
--
-- ٤) 🔴 **وحصيلة مقدّم الخدمة كانت بتضيع وقت الطلب**: الموقع بيبعتها،
--    وحارس الجدول بيمسحها (`instructor_earning := NULL`)، وعند الاكتمال
--    الحصيلة بتتحسب = **المبلغ اللي العميل دفعه كله** (شامل هامش المنصة).
--    دلوقتي بتتسجّل صح من أول الطلب: السعر المعتمد للمقدّم.
--    ⚠️ الطلبات القديمة مااتلمستش — آخر الملف بيعدّها لو فيه.
--
-- ⚠️ **مفيش مسح لأي بيانات.** جدولين جداد + عمودين في ٣ جداول
--    (`discount_code`, `discount_amount`) + تعديل دوال الطلب.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 12. في SQL Editor → Run. ولو اتشغّل تاني بيقف من أوله.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.discount_codes') IS NOT NULL THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF to_regclass('public.story_goals') IS NULL THEN
    RAISE EXCEPTION 'شغّل ملف 12 الأول.';
  END IF;
END
$$;

-- ── ١. الأكواد واستخداماتها ──────────────────────────────────

CREATE TABLE public.discount_codes (
  id          uuid        DEFAULT gen_random_uuid() NOT NULL,
  code        text        NOT NULL,
  percent     integer     NOT NULL,
  -- NULL = كل المنصة.
  lines       text[],
  starts_at   timestamptz,
  ends_at     timestamptz,
  -- NULL = من غير حد.
  max_uses    integer,
  is_active   boolean     DEFAULT true NOT NULL,
  note        text,
  created_by  uuid,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT discount_codes_pkey PRIMARY KEY (id),
  CONSTRAINT discount_codes_code_key UNIQUE (code),
  -- حروف إنجليزي كبيرة وأرقام و- و_ — عشان يتكتب ويتقري من غير لبس.
  CONSTRAINT discount_codes_code_format CHECK (code ~ '^[A-Z0-9_-]{3,30}$'),
  CONSTRAINT discount_codes_percent_range CHECK (percent BETWEEN 1 AND 90),
  CONSTRAINT discount_codes_lines_valid CHECK (
    lines IS NULL OR (
      cardinality(lines) BETWEEN 1 AND 4
      AND lines <@ ARRAY['enha_lak', 'box', 'courses', 'services']::text[]
    )
  ),
  CONSTRAINT discount_codes_dates CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT discount_codes_max_uses CHECK (max_uses IS NULL OR max_uses >= 1),
  CONSTRAINT discount_codes_note_length CHECK (note IS NULL OR char_length(note) <= 300)
);

-- الكود بيتخزّن بحروف كبيرة دايمًا، والقايمة الفاضية = «كل المنصة».
CREATE OR REPLACE FUNCTION public.discount_codes_normalize()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  IF NEW.lines IS NOT NULL AND cardinality(NEW.lines) = 0 THEN
    NEW.lines := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$function$;

CREATE TRIGGER discount_codes_normalize_trg
  BEFORE INSERT OR UPDATE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.discount_codes_normalize();

CREATE TABLE public.discount_code_uses (
  id               uuid        DEFAULT gen_random_uuid() NOT NULL,
  code_id          uuid        NOT NULL,
  user_id          uuid        NOT NULL,
  -- enha_lak · box · courses · services
  line             text        NOT NULL,
  -- رقم الطلب أو الحجز.
  source_id        text        NOT NULL,
  discount_amount  numeric     NOT NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT discount_code_uses_pkey PRIMARY KEY (id),
  CONSTRAINT discount_code_uses_code_fkey FOREIGN KEY (code_id) REFERENCES public.discount_codes(id) ON DELETE RESTRICT,
  -- ⭐ مرة واحدة لكل عميل — القيد هنا، مش في الكود بس.
  CONSTRAINT discount_code_uses_once UNIQUE (code_id, user_id),
  CONSTRAINT discount_code_uses_source UNIQUE (line, source_id)
);
CREATE INDEX discount_code_uses_code_idx ON public.discount_code_uses (code_id);

ALTER TABLE public.discount_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_uses ENABLE ROW LEVEL SECURITY;

-- ⚠️ **العميل مايقراش جدول الأكواد**: لو قدر، يشوف كل الأكواد الشغالة.
--    بيسأل عن كوده بس عن طريق `discount_code_check`.
CREATE POLICY "Admins manage discount codes" ON public.discount_codes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- الاستخدامات بتتكتب من دوال الطلب بس — الإدارة بتقرا.
CREATE POLICY "Admins read discount code uses" ON public.discount_code_uses
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.discount_codes, public.discount_code_uses FROM anon;
REVOKE TRUNCATE ON public.discount_codes, public.discount_code_uses FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT SELECT ON public.discount_code_uses TO authenticated;
GRANT ALL ON public.discount_codes, public.discount_code_uses TO service_role;

-- ── ٢. الخصم على كل نوع طلب ─────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN discount_code   text,
  ADD COLUMN discount_amount numeric DEFAULT 0 NOT NULL;
ALTER TABLE public.course_subscriptions
  ADD COLUMN discount_code   text,
  ADD COLUMN discount_amount numeric DEFAULT 0 NOT NULL;
ALTER TABLE public.service_orders
  ADD COLUMN discount_code   text,
  ADD COLUMN discount_amount numeric DEFAULT 0 NOT NULL;

-- ── ٣. فحص الكود واستخدامه ──────────────────────────────────

/**
 * الكود ينفع للعميل ده على القسم ده؟ بيرجّع صف الكود أو بيرمي سبب الرفض.
 * `p_lock` = وقت الطلب الحقيقي: بيقفل صف الكود لحد آخر العملية، عشان
 * طلبين في نفس اللحظة مايعدّوش الحد.
 *
 * ⚠️ داخلية — الدوال اللي بتعمل الطلب بس هي اللي بتناديها.
 */
CREATE OR REPLACE FUNCTION public.discount_code_take(p_code text, p_user uuid, p_line text, p_lock boolean)
 RETURNS discount_codes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row  discount_codes;
  v_used integer;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول الأول';
  END IF;

  IF p_lock THEN
    SELECT * INTO v_row FROM discount_codes
     WHERE code = upper(btrim(coalesce(p_code, '')))
     FOR UPDATE;
  ELSE
    SELECT * INTO v_row FROM discount_codes
     WHERE code = upper(btrim(coalesce(p_code, '')));
  END IF;

  IF NOT FOUND OR NOT v_row.is_active THEN
    RAISE EXCEPTION 'كود الخصم ده مش صحيح أو متوقف';
  END IF;
  IF v_row.starts_at IS NOT NULL AND now() < v_row.starts_at THEN
    RAISE EXCEPTION 'كود الخصم ده لسه مابدأش';
  END IF;
  IF v_row.ends_at IS NOT NULL AND now() >= v_row.ends_at THEN
    RAISE EXCEPTION 'كود الخصم ده انتهى';
  END IF;
  IF v_row.lines IS NOT NULL AND NOT (p_line = ANY (v_row.lines)) THEN
    RAISE EXCEPTION 'كود الخصم ده مش على القسم ده';
  END IF;
  IF EXISTS (SELECT 1 FROM discount_code_uses u WHERE u.code_id = v_row.id AND u.user_id = p_user) THEN
    RAISE EXCEPTION 'استخدمت كود الخصم ده قبل كده';
  END IF;
  IF v_row.max_uses IS NOT NULL THEN
    SELECT count(*) INTO v_used FROM discount_code_uses u WHERE u.code_id = v_row.id;
    IF v_used >= v_row.max_uses THEN
      RAISE EXCEPTION 'كود الخصم ده خلص عدده';
    END IF;
  END IF;

  RETURN v_row;
END
$function$;

CREATE OR REPLACE FUNCTION public.discount_code_record(p_code_id uuid, p_user uuid, p_line text, p_source_id text, p_amount numeric)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO discount_code_uses (code_id, user_id, line, source_id, discount_amount)
  VALUES (p_code_id, p_user, p_line, p_source_id, coalesce(p_amount, 0));
$function$;

REVOKE ALL ON FUNCTION public.discount_code_take(text, uuid, text, boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.discount_code_record(uuid, uuid, text, text, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discount_code_take(text, uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.discount_code_record(uuid, uuid, text, text, numeric) TO service_role;

/**
 * للشاشة: العميل كتب كود — ينفع؟ بيرجّع النسبة أو سبب الرفض.
 * ⚠️ **للعرض بس** — الخصم الحقيقي بيتحسب تاني وقت الطلب.
 */
CREATE OR REPLACE FUNCTION public.discount_code_check(p_code text, p_line text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row discount_codes;
BEGIN
  IF p_line NOT IN ('enha_lak', 'box', 'courses', 'services') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'قسم غير معروف');
  END IF;
  v_row := public.discount_code_take(p_code, auth.uid(), p_line, false);
  RETURN jsonb_build_object('ok', true, 'code', v_row.code, 'percent', v_row.percent);
EXCEPTION WHEN raise_exception THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END
$function$;

REVOKE ALL ON FUNCTION public.discount_code_check(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.discount_code_check(text, text) TO authenticated, service_role;

-- ── ٤. الكود بيرجع لو الطلب اتلغى ───────────────────────────

CREATE OR REPLACE FUNCTION public.discount_code_release()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.discount_code IS NOT NULL THEN
      DELETE FROM discount_code_uses WHERE line = TG_ARGV[0] AND source_id = OLD.id::text;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.discount_code IS NOT NULL
     AND NEW.status::text IN ('cancelled', 'failed')
     AND OLD.status::text NOT IN ('cancelled', 'failed') THEN
    DELETE FROM discount_code_uses WHERE line = TG_ARGV[0] AND source_id = NEW.id::text;
  END IF;
  RETURN NEW;
END
$function$;

-- ⚠️ طلب «إنها لك» وطلب الصندوق في نفس الجدول (`orders`)، فالقسم
--    بيتحدد من `box_plan_id` — محفّزين بشرط.
CREATE TRIGGER discount_release_orders_trg
  AFTER UPDATE OF status OR DELETE ON public.orders
  FOR EACH ROW WHEN (OLD.box_plan_id IS NULL)
  EXECUTE FUNCTION public.discount_code_release('enha_lak');
CREATE TRIGGER discount_release_box_trg
  AFTER UPDATE OF status OR DELETE ON public.orders
  FOR EACH ROW WHEN (OLD.box_plan_id IS NOT NULL)
  EXECUTE FUNCTION public.discount_code_release('box');
CREATE TRIGGER discount_release_courses_trg
  AFTER UPDATE OF status OR DELETE ON public.course_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.discount_code_release('courses');
CREATE TRIGGER discount_release_services_trg
  AFTER UPDATE OF status OR DELETE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.discount_code_release('services');

-- ── ٥. العميل مايلمسش الخصم بعد الطلب ──────────────────────

CREATE OR REPLACE FUNCTION public.guard_discount_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  NEW.discount_code   := OLD.discount_code;
  NEW.discount_amount := OLD.discount_amount;
  RETURN NEW;
END
$function$;

CREATE TRIGGER guard_discount_fields_trg BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_discount_fields();
CREATE TRIGGER guard_discount_fields_trg BEFORE UPDATE ON public.course_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_discount_fields();
CREATE TRIGGER guard_discount_fields_trg BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_discount_fields();

-- ── ٦. دوال الطلب — بكود الخصم ──────────────────────────────
--
-- ⚠️ لازم `DROP` الأول: إضافة خانة جديدة بتعمل **نسخة تانية** من الدالة
--    جنب القديمة، والموقع ساعتها مايعرفش ينادي أنهي واحدة.

DROP FUNCTION public.create_customer_order(jsonb, jsonb);
DROP FUNCTION public.create_box_subscription_order(text, jsonb, jsonb);
DROP FUNCTION public.create_course_booking(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_customer_order(p_items jsonb, p_shipping jsonb DEFAULT NULL::jsonb, p_discount_code text DEFAULT NULL::text)
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
  -- ⭐ ملف 13: كود الخصم
  v_code           discount_codes;
  v_code_off       integer := 0;
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

  -- ══ كود الخصم (ملف 13) ════════════════════════════════
  -- على المنتجات والإضافات (بعد خصم المشترك) — مش على الشحن.
  IF NULLIF(btrim(coalesce(p_discount_code, '')), '') IS NOT NULL THEN
    v_code     := public.discount_code_take(p_discount_code, v_user, 'enha_lak', true);
    v_code_off := round(v_subtotal * v_code.percent / 100.0);
  END IF;

  -- ══ الطلب: بالإجمالي النهائي من أول لحظة (ملف 108) ═════
  -- ⚠️ العنوان بيتحفظ **بس لو فيه شحن** — طلب إلكتروني لوحده مالوش
  --    عنوان، وحفظ عنوان مالوش لازمة بيلخبط الإدارة («أشحن لمين؟»).
  INSERT INTO orders (
    user_id, total_amount, shipping_fee, status,
    recipient_name, recipient_phone, address_line, city, governorate, shipping_notes,
    delivery_email, discount_code, discount_amount
  )
  VALUES (
    v_user, round(v_subtotal - v_code_off + v_shipping), v_shipping, 'pending',
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'recipientName',  '')), '') END,
    -- التليفون بيتحفظ دايمًا: الإدارة محتاجاه للتواصل حتى من غير شحن.
    NULLIF(btrim(coalesce(p_shipping->>'recipientPhone', '')), ''),
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'addressLine',    '')), '') END,
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'city',           '')), '') END,
    CASE WHEN v_needs_shipping THEN NULLIF(btrim(coalesce(p_shipping->>'governorate',    '')), '') END,
    NULLIF(btrim(coalesce(p_shipping->>'notes', '')), ''),
    CASE WHEN v_has_electronic THEN v_email END,
    v_code.code, v_code_off
  )
  RETURNING id INTO v_order_id;

  IF v_code.id IS NOT NULL THEN
    PERFORM public.discount_code_record(v_code.id, v_user, 'enha_lak', v_order_id::text, v_code_off);
  END IF;

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

CREATE OR REPLACE FUNCTION public.create_box_subscription_order(p_plan_id text, p_details jsonb, p_shipping jsonb, p_discount_code text DEFAULT NULL::text)
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
  -- ⭐ ملف 13: كود الخصم — على سعر الخطة، مش على الشحن.
  v_code     discount_codes;
  v_code_off integer := 0;
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

  IF NULLIF(btrim(coalesce(p_discount_code, '')), '') IS NOT NULL THEN
    v_code     := public.discount_code_take(p_discount_code, v_user, 'box', true);
    v_code_off := round(v_plan.price_total * v_code.percent / 100.0);
  END IF;

  INSERT INTO orders (
    user_id, total_amount, shipping_fee, status,
    recipient_name, recipient_phone, address_line, city, governorate, shipping_notes,
    box_plan_id, box_details, discount_code, discount_amount
  )
  VALUES (
    v_user, round(v_plan.price_total - v_code_off + v_shipping), v_shipping, 'pending',
    NULLIF(btrim(coalesce(p_shipping->>'recipientName',  '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'recipientPhone', '')), ''),
    NULLIF(btrim(coalesce(p_shipping->>'addressLine',    '')), ''),
    btrim(p_shipping->>'city'),
    btrim(p_shipping->>'governorate'),
    NULLIF(btrim(coalesce(p_shipping->>'notes', '')), ''),
    v_plan.id, v_details, v_code.code, v_code_off
  )
  RETURNING id INTO v_order_id;

  IF v_code.id IS NOT NULL THEN
    PERFORM public.discount_code_record(v_code.id, v_user, 'box', v_order_id::text, v_code_off);
  END IF;

  RETURN v_order_id::text;
END
$function$
;

CREATE OR REPLACE FUNCTION public.create_course_booking(p_package_id text, p_instructor_id text DEFAULT NULL::text, p_participant_type text DEFAULT 'self'::text, p_child_id text DEFAULT NULL::text, p_gift_message text DEFAULT NULL::text, p_discount_code text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user    uuid := auth.uid();
  v_price   numeric;
  v_child   text := NULLIF(btrim(coalesce(p_child_id, '')), '');
  v_instr   text := NULLIF(btrim(coalesce(p_instructor_id, '')), '');
  -- القصّ في القاعدة مش في المتصفح: الـRPC ممكن تتنادى من غير الشاشة.
  v_gift    text := NULLIF(btrim(coalesce(p_gift_message, '')), '');
  v_id      text;
  -- ⭐ ملف 13: كود الخصم
  v_code     discount_codes;
  v_code_off integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول قبل الحجز';
  END IF;

  -- الباقة لازم تكون موجودة ومفعّلة — مش أي نص جاي في الرابط.
  SELECT price INTO v_price
    FROM creative_writing_packages
   WHERE id = p_package_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الباقة دي مش متاحة';
  END IF;

  -- المدرب اختياري، وبيتقبل بس لو موجود ومفعّل.
  IF v_instr IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM instructors
       WHERE id = v_instr AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'المدرب المختار مش متاح';
    END IF;
  END IF;

  IF p_participant_type = 'child' THEN
    IF v_child IS NULL THEN
      RAISE EXCEPTION 'اختار المشارك الأول';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM child_profiles c
       WHERE c.id = v_child AND c.user_profile_id = v_user
    ) THEN
      RAISE EXCEPTION 'ملف المشارك المرفق لا يخص صاحب الحساب';
    END IF;
  ELSE
    v_child := NULL;
  END IF;

  IF v_gift IS NOT NULL THEN
    v_gift := left(v_gift, 500);
  END IF;

  IF NULLIF(btrim(coalesce(p_discount_code, '')), '') IS NOT NULL THEN
    v_code     := public.discount_code_take(p_discount_code, v_user, 'courses', true);
    v_code_off := round(v_price * v_code.percent / 100.0);
  END IF;

  INSERT INTO course_subscriptions (
    package_id, user_id, participant_type, child_id,
    status, amount, preferred_instructor_id, gift_message,
    discount_code, discount_amount
  )
  VALUES (
    p_package_id, v_user, p_participant_type, v_child,
    'pending', v_price - v_code_off, v_instr, v_gift,
    v_code.code, v_code_off
  )
  RETURNING id INTO v_id;

  IF v_code.id IS NOT NULL THEN
    PERFORM public.discount_code_record(v_code.id, v_user, 'courses', v_id, v_code_off);
  END IF;

  RETURN v_id;
END
$function$
;

REVOKE ALL ON FUNCTION public.create_customer_order(jsonb, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order(jsonb, jsonb, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_box_subscription_order(text, jsonb, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_box_subscription_order(text, jsonb, jsonb, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_course_booking(text, text, text, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_course_booking(text, text, text, text, text, text) TO authenticated, service_role;

-- ── ٧. طلب الخدمة الإبداعية: السعر من القاعدة ───────────────
--
-- العميل لسه بيعمل الطلب من الموقع زي ما هو، بس **المبلغ والحصيلة
-- والمدرب بيتحسبوا هنا** ويتكتبوا فوق أي حاجة جاية من برّه.
-- المعادلة نفسها اللي في الموقع (`calculateFinalSessionPrice`):
--   المنصة بتقدّمها   ← سعر العميل = السعر المعتمد، ومفيش حصيلة.
--   مدرب أو مستقل    ← الحصيلة = السعر المعتمد،
--                       وسعر العميل = الحصيلة × المضاعِف + الرسوم الثابتة.

CREATE OR REPLACE FUNCTION public.price_service_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prov     record;
  v_price    numeric;
  v_mult     numeric;
  v_fee      numeric;
  v_amount   numeric;
  v_earning  numeric;
  v_code     discount_codes;
  v_code_off integer := 0;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.standalone_service_id IS NULL THEN
    RAISE EXCEPTION 'الخدمة غير موجودة';
  END IF;

  -- من غير مقدّم = المنصة نفسها (نفس اللي الموقع بيعمله).
  IF NEW.provider_id IS NULL THEN
    SELECT sp.id INTO NEW.provider_id FROM service_providers sp
     WHERE sp.kind = 'platform' AND sp.status = 'active' LIMIT 1;
  END IF;

  SELECT sp.id, sp.kind, sp.status, sp.instructor_id INTO v_prov
    FROM service_providers sp WHERE sp.id = NEW.provider_id;
  IF NOT FOUND OR v_prov.status <> 'active' THEN
    RAISE EXCEPTION 'مقدّم الخدمة غير متاح حالياً';
  END IF;

  SELECT ps.approved_price INTO v_price
    FROM provider_services ps
   WHERE ps.provider_id = NEW.provider_id
     AND ps.service_id  = NEW.standalone_service_id
     AND ps.status = 'approved' AND ps.is_active;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'مقدّم الخدمة لا يقدم هذه الخدمة حالياً';
  END IF;

  IF v_prov.kind = 'platform' THEN
    v_amount  := v_price;
    v_earning := NULL;
  ELSE
    v_earning := v_price;
    SELECT platform_multiplier, fixed_admin_fee INTO v_mult, v_fee
      FROM pricing_formula_settings WHERE id = 'default';
    v_amount := CASE WHEN v_mult IS NULL THEN v_price ELSE v_price * v_mult + v_fee END;
  END IF;

  IF NULLIF(btrim(coalesce(NEW.discount_code, '')), '') IS NOT NULL THEN
    v_code     := public.discount_code_take(NEW.discount_code, auth.uid(), 'services', true);
    v_code_off := round(v_amount * v_code.percent / 100.0);
    PERFORM public.discount_code_record(v_code.id, auth.uid(), 'services', NEW.id, v_code_off);
  END IF;

  NEW.instructor_id      := v_prov.instructor_id;
  NEW.instructor_earning := v_earning;
  NEW.amount             := v_amount - v_code_off;
  NEW.discount_code      := v_code.code;
  NEW.discount_amount    := v_code_off;
  RETURN NEW;
END
$function$;

-- 🔴 **طلب الخدمة كان بيقع من أصله**: رقمه المرجعي بيتعمل بدالة
--    (`next_payment_reference`) مقفولة على الخادم بس، والطلب ده بيتعمل
--    بحساب العميل نفسه — فالقاعدة بترفض («permission denied»)، والعميل
--    بيشوف «تعذّر إنشاء الطلب». (طلبات «إنها لك» والحجوزات مااتأثرتش:
--    بتتعمل من جوه دالة بصلاحية القاعدة.) الدالة بتدّي رقم جديد بس —
--    مابتقراش ولا بتغيّر أي بيانات.
GRANT EXECUTE ON FUNCTION public.next_payment_reference() TO authenticated;

-- ⚠️ الاسم بيبدأ بـ`z_` عن قصد: محفّزات «قبل» بتشتغل بترتيب الأسماء،
--    واللي ده لازم يشتغل **بعد** `guard_service_order_fields_trg` (اللي
--    بيمسح الحصيلة) — وإلا الحصيلة اللي بنحسبها هنا تتمسح وراه.
CREATE TRIGGER z_price_service_order_trg
  BEFORE INSERT ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.price_service_order();

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
-- لازم كل السطور ✓ (السطر الأخير للمعلومة بس).
SELECT 'جدول أكواد الخصم' AS "البند",
       CASE WHEN to_regclass('public.discount_codes') IS NOT NULL THEN '✓' ELSE '✗' END AS "الحالة"
UNION ALL
SELECT 'دالة طلب «إنها لك» بالكود',
       CASE WHEN to_regprocedure('public.create_customer_order(jsonb, jsonb, text)') IS NOT NULL THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'دالة طلب الصندوق بالكود',
       CASE WHEN to_regprocedure('public.create_box_subscription_order(text, jsonb, jsonb, text)') IS NOT NULL THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'دالة حجز الباقة بالكود',
       CASE WHEN to_regprocedure('public.create_course_booking(text, text, text, text, text, text)') IS NOT NULL THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'سعر الخدمة من القاعدة',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'z_price_service_order_trg') THEN '✓' ELSE '✗' END
UNION ALL
SELECT 'للمعلومة: طلبات خدمات قديمة لمدرب/مستقل من غير حصيلة متسجّلة',
       (SELECT count(*)::text FROM public.service_orders o
          JOIN public.service_providers sp ON sp.id = o.provider_id
         WHERE sp.kind <> 'platform' AND o.instructor_earning IS NULL
           AND o.status NOT IN ('cancelled', 'refunded'));
