-- ============================================================
-- 134 — نصيب الناشر يتثبّت وقت الشراء لا وقت التسليم
-- ============================================================
--
-- ── المشكلة ────────────────────────────────────────────────
--
-- `record_order_publisher_earnings` (ملف 97) كانت بتحسب مستحق الناشر
-- ساعة تعليم الطلب «مسلَّم»، من صف المنتج **ساعتها**:
--
--     sum(pp.publisher_cost * oi.quantity)
--
-- وسعر العميل بيتثبّت في `order_items.unit_price` لحظة الشراء — لكن
-- نصيب الناشر لأ. وده بيخالف قاعدة معمارية سارية: «الأسعار والمبالغ
-- تُلتقط لحظة الشراء».
--
-- ⚠️ **وليه ده مش نظري:** الناشر بيقدر يغيّر نصيبه من «تعديل المنتج».
--    التعديل بيرجّع المنتج للمراجعة (ملف 130) — **لكن الرقم الجديد
--    بيتكتب في الصفّ فعلًا، والرفض مابيرجّعش القديم**. فناشر يرفع
--    نصيبه بعد البيعة، والإدارة ترفض، والطلب القديم يتسلّم ← **يتسجّل
--    بالرقم المرفوض**. ومن غير سوء نيّة كمان: أي تصحيح إداري لنصيب
--    منتج كان بيسري على كل الطلبات اللي لسه ماتسلّمتش، في صمت.
--
-- ── تشخيص 133 ─────────────────────────────────────────────
--
--   • **مفيش ولا طلب في القاعدة** (حالات الطلبات: فاضية) — فالإصلاح
--     بيتعمل قبل أول بيعة، ومفيش بنود قديمة من غير رقم مثبّت
--   • `order_items.product_id` **نصّ**، و`order_id` **معرّف فريد**
--     (قاعدة «ج» — المقارنات تحت بـ`::text`)
--   • سياسات `order_items`: الإدارة (كله) · العميل **قراءة بس** — مفيش
--     طريق للعميل يعدّل بند. الحارس تحت طبقة تانية مش الأولى
--   • محفّز واحد مربوط: `block_inactive_product_trg`
--   • `record_order_publisher_earnings`: **نسخة واحدة** بـ`(text)`
--
-- ── ليه محفّز لا تعديل `create_customer_order` ──────────────
--
-- الدالة ١٥٠ سطرًا، و`CREATE OR REPLACE` بتستبدل الجسم كله — أي
-- سطر يتنسي فيها بيكسر الشراء. المحفّز بيشتغل على **كل** إدراج بند،
-- من أي مسار، حتى جوّه `SECURITY DEFINER` (نفس قرار ملف 118، درس ٢٢).
--
-- ── ما الذي يتغيّر فعليًا ───────────────────────────────────
--
--   ① عمودان على `order_items`: `publisher_id_snapshot` و
--      `publisher_cost_snapshot` — الناشر ونصيبه **لحظة الشراء**
--   ② محفّز `snapshot_publisher_share()`:
--        • عند الإدراج: **بيقرا من صف المنتج ويتجاهل أي قيمة جاية
--          مع الإدراج** (قاعدة «ف»)
--        • عند التعديل من غير الإدارة: **القيمة القديمة بترجع**
--          (قاعدة «ب» — السياسة بتحمي الصف لا العمود)
--   ③ `record_order_publisher_earnings` — **نفس التوقيع** `(text)`،
--      فـ`OR REPLACE` بتستبدل ولا بتضيف (قاعدة «س»). بتقرا الرقم
--      المثبّت بدل رقم المنتج الحالي
--   ④ 🔴 **إضافة اتكشفت وأنا بكتب الملف:** `block_inactive_product`
--      بقى يرفض كمان المنتج **اللي مش معتمد** — التفصيل تحت عند ④
--
-- ── ولو بند ناشر اتباع من غير نصيب مسجَّل ─────────────────
--
-- `publisher_cost_snapshot` بيتكتب فاضي. ساعة التسليم الدالة بتحاول
-- تملاه **من المنتج بشرط إن المنتج معتمد دلوقتي** — يعني الرقم اللي
-- الإدارة وافقت عليه، لا رقم ناشر مستني أو مرفوض. ولو لسه مفيش،
-- بيتعدّ «ناقص نصيب» زي قبل كده، والإدارة بتتبلّغ (`admin-orders.ts`)
-- — **ورسالتها بتفضل صحيحة**: «اظبط النصيب من شاشة المنتجات وبعدين
-- علّم الطلب «تم التسليم» تاني».
--
-- ── اتجرّب إزاي ─────────────────────────────────────────────
--
-- على قاعدة Postgres 16 محلية بنفس أنواع الأعمدة والسياسات ودالتَي 97
-- و121 كما هما، وبعدين الملف ده (مرتين — بيتعاد بأمان):
--   ✓ إدراج بقيمة مزوّرة (ناشر وهمي، نصيب ١) ← اتسجّل الناشر الحقيقي و٤٠٠
--   ✓ منتج «مستني» ← اترفض بنفس رسالة المنتج الموقوف
--   ✓ عميل يعدّل الرقم المثبّت ← رجع ٤٠٠
--   ✓ الناشر رفع نصيبه لـ٩٠٠ بعد البيعة ← **المستحق اتحسب بـ٤٠٠**
--     (وبالدالة القديمة بعد التراجع: نفس الطلب اتحسب ٢٠٥٠ بدل ١٠٥٠ —
--     ده العطل بالأرقام)
--   ✓ كتاب بلا نصيب + نصيب مستني ← «ناقص نصيب»، وبعد اعتماد الإدارة ← اتملى
--   ✓ النداء التاني مابيكرّرش · الإدارة تقدر تصحّح · خطوات التراجع شغّالة
-- ⚠️ **ما اتجرّبش على قاعدة الإنتاج** — مفيش طلبات فيها أصلًا.
-- ============================================================

BEGIN;

-- ══ ① العمودان ═════════════════════════════════════════════
--
-- ⚠️ `publisher_id_snapshot` نصّ زي `personalized_products.publisher_id`
--    (تشخيص 131). ومن غير مفتاح أجنبي عن قصد: البند سجلّ تاريخي —
--    لو الناشر اتشال يومًا، البيعة القديمة ماتتمسحش ولا تتمنع.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS publisher_id_snapshot text,
  ADD COLUMN IF NOT EXISTS publisher_cost_snapshot integer;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_publisher_cost_snapshot_positive;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_publisher_cost_snapshot_positive
  CHECK (publisher_cost_snapshot IS NULL OR publisher_cost_snapshot > 0);

COMMENT ON COLUMN public.order_items.publisher_id_snapshot IS
  'الناشر صاحب المنتج لحظة الشراء — بيكتبه محفّز snapshot_publisher_share (ملف 134).';
COMMENT ON COLUMN public.order_items.publisher_cost_snapshot IS
  'نصيب الناشر من النسخة لحظة الشراء. المستحق بيتحسب منه لا من صف المنتج (ملف 134).';

-- ══ ② المحفّز ══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.snapshot_publisher_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_publisher text;
  v_cost      integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- ⚠️ **دايمًا من صف المنتج، حتى لو الإدراج جاي بقيمة.** اللي
    --    بيدرج البند (دالة الطلب أو الإدارة) مايقرّرش نصيب الناشر.
    --
    -- ⚠️ وبصلاحية صاحب الدالة: لو قرا بصلاحية المشتري وسياسة القراءة
    --    اتضيّقت يومًا، الصفّ هيرجع **فاضي لا خطأ** (قاعدة «ك»)
    --    والنصيب يتسجّل فاضي في صمت.
    SELECT p.publisher_id::text, p.publisher_cost
      INTO v_publisher, v_cost
      FROM public.personalized_products p
     WHERE p.id::text = NEW.product_id::text
       AND p.publisher_id IS NOT NULL;

    -- منتج المنصة (أو إضافة مش في جدول المنتجات): مفيش صفّ، فالمتغيّران
    -- فاضيين — والقيمة الجاية مع الإدراج **بتتمسح** بيهم.
    NEW.publisher_id_snapshot := v_publisher;

    -- صفر أو سالب = مفيش نصيب مسجَّل، مش «نصيب صفر».
    NEW.publisher_cost_snapshot := CASE WHEN v_cost > 0 THEN v_cost ELSE NULL END;

    RETURN NEW;
  END IF;

  -- ══ تعديل ══
  -- فاضية = مفتاح الخدمة · والإدارة بتقدر تصحّح رقمًا اتسجّل غلط.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.publisher_id_snapshot   := OLD.publisher_id_snapshot;
  NEW.publisher_cost_snapshot := OLD.publisher_cost_snapshot;
  RETURN NEW;
END
$function$;

-- ⚠️ الاسم بيبدأ بـ`snapshot_` عن قصد: محفّزات `BEFORE` بتشتغل بترتيب
--    الاسم، فـ`block_inactive_product_trg` بيشتغل الأول — المنتج
--    الموقوف بيترفض قبل ما نقرا نصيبه.
DROP TRIGGER IF EXISTS snapshot_publisher_share_trg ON public.order_items;
CREATE TRIGGER snapshot_publisher_share_trg
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_publisher_share();

-- ⚠️ Supabase بيمنح `anon` تنفيذ أي دالة جديدة تلقائيًّا، و
--    `REVOKE FROM public` مابيشيلوش (§3 في قواعد العمل) — **والعكس
--    كمان**: `FROM anon` لوحدها مابتشيلش المنح العام لـ`public` اللي
--    `anon` واخده بالوراثة. اتمسكت بتجربة الملف على قاعدة محلية:
--    سطر ملفَي 118 و121 (`FROM anon` بس) خلّى الزائر لسه يقدر.
--    فالاتنين. والمحفّز شغّال بعدها — المتصفح مابيحتاجش صلاحية
--    تنفيذ على دالة المحفّز، ده اتجرّب كمان.
REVOKE EXECUTE ON FUNCTION public.snapshot_publisher_share() FROM public, anon;

-- ══ ③ دالة المستحق — بتقرا الرقم المثبّت ═══════════════════
--
-- ⚠️ **نفس التوقيع بالظبط** `(p_order_id text)` — تشخيص 133: نسخة
--    واحدة. فـ`OR REPLACE` بتستبدل الجسم ولا بتضيف نسخة (قاعدة «س»).
--    والنداء في `admin-orders.ts` مابيتغيّرش.
CREATE OR REPLACE FUNCTION public.record_order_publisher_earnings(p_order_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user      uuid := auth.uid();
  v_order     record;
  v_row       record;
  v_inserted  integer := 0;
  v_recorded  integer := 0;
  v_total     integer := 0;
  v_missing   integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'لازم تسجّل الدخول';
  END IF;

  -- الإدارة وحدها: هي اللي بتعلّم الطلب «مسلَّم» أصلًا.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'الإجراء ده للإدارة';
  END IF;

  SELECT o.id, o.status INTO v_order
    FROM orders o
   WHERE o.id::text = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب مش موجود';
  END IF;

  -- ⚠️ الدالة **مبتغيّرش حالة الطلب** — الإقفال شغل الكود اللي
  --    بيناديها، وخلط الاتنين بيخلّي إعادة النداء خطرة.
  IF v_order.status <> 'delivered' THEN
    RETURN jsonb_build_object(
      'recorded', false, 'reason', 'not_delivered', 'status', v_order.status
    );
  END IF;

  -- ── البند اللي اتباع من غير نصيب مسجَّل ─────────────────
  --
  -- بيتملى من المنتج **بشرط إنه معتمد دلوقتي** — يعني رقم وافقت
  -- عليه الإدارة. رقم ناشر مستني أو مرفوض **مابيتاخدش**: ده بالظبط
  -- الطريق اللي الملف ده بيقفله.
  --
  -- ⚠️ والتعديل ده بيعدّي من الحارس لأن النادي إداري (`is_admin()`
  --    اتفحص فوق).
  UPDATE order_items oi
     SET publisher_cost_snapshot = pp.publisher_cost
    FROM personalized_products pp
   WHERE oi.order_id::text = p_order_id
     AND oi.publisher_id_snapshot IS NOT NULL
     AND oi.publisher_cost_snapshot IS NULL
     AND pp.id::text = oi.product_id::text
     AND pp.publisher_id::text = oi.publisher_id_snapshot
     AND pp.review_status = 'approved'
     AND pp.publisher_cost IS NOT NULL
     AND pp.publisher_cost > 0;

  -- صفّ لكل ناشر في الطلب. **المبلغ من البند المثبّت لا من المنتج.**
  --
  -- ⚠️ `LEFT JOIN` على المنتج: الاسم بس هو اللي جاي منه (لوصف
  --    المستحق). لو المنتج اتشال يومًا، المستحق مايضيعش.
  FOR v_row IN
    SELECT oi.publisher_id_snapshot                                        AS publisher_id,
           sum(oi.publisher_cost_snapshot * oi.quantity)::integer          AS amount,
           count(*)                                                        AS lines,
           count(*) FILTER (WHERE oi.publisher_cost_snapshot IS NULL)      AS no_cost,
           string_agg(DISTINCT pp.name, '، ')                              AS titles
      FROM order_items oi
      LEFT JOIN personalized_products pp ON pp.id::text = oi.product_id::text
     WHERE oi.order_id::text = p_order_id
       AND oi.publisher_id_snapshot IS NOT NULL
     GROUP BY oi.publisher_id_snapshot
  LOOP
    -- منتج بلا نصيب مسجَّل: **مش بنسجّل صفرًا**. الصفر بيبان مستحقًّا
    -- تمّ حسابه، والحقيقة إن الرقم ناقص.
    IF v_row.no_cost > 0 OR v_row.amount IS NULL OR v_row.amount <= 0 THEN
      v_missing := v_missing + 1;
      CONTINUE;
    END IF;

    INSERT INTO publisher_payouts (
      publisher_id, period, amount, status, source_type, source_id, description
    )
    VALUES (
      v_row.publisher_id,
      to_char(now(), 'YYYY-MM'),
      v_row.amount,
      'pending',
      'order',
      v_order.id::text,
      COALESCE(v_row.titles, 'منتجات')
    )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted > 0 THEN
      v_recorded := v_recorded + 1;
      v_total := v_total + v_row.amount;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'recorded',  v_recorded > 0,
    'publishers', v_recorded,
    'amount',    v_total,
    'missing_cost', v_missing,
    'reason',    CASE
                   WHEN v_recorded > 0 THEN 'inserted'
                   WHEN v_missing > 0  THEN 'missing_cost'
                   ELSE 'nothing_to_record'
                 END
  );
END
$function$;

COMMENT ON FUNCTION public.record_order_publisher_earnings(text) IS
  'بتسجّل مستحق كل ناشر في طلب مسلَّم. المبلغ = النصيب المثبّت في البند لحظة الشراء × الكمية (ملف 134، وقبله 97).';

-- نفس منح ملف 97 — مكرّر عن قصد (§3: تُطبَّق على كل دالة).
REVOKE ALL ON FUNCTION public.record_order_publisher_earnings(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_order_publisher_earnings(text) TO authenticated;

-- ══ ④ 🔴 المنتج اللي مش معتمد مايتطلبش ═══════════════════════
--
-- ⚠️ **اتكشفت وأنا بكتب الملف.** ملف 130 وعد إن المنتج «يوقف عن البيع
--    لحد المراجعة». والوعد كان منفَّذ **بالإخفاء بس**: السياسة بتخبّيه
--    عن الزائر. لكن `create_customer_order` بـ`SECURITY DEFINER`
--    **مابتعدّيش على السياسة**، ومحفّز الحظر (ملف 121) كان بيفحص
--    `is_active` وحده.
--
--    والسيناريو مش نظري: العميل يحط الكتاب في السلة (السلة في المتصفح)
--    ← الناشر يعدّل ← المنتج «مستني» ← العميل يكمّل الدفع ← **طلب على
--    محتوى وسعر ما اتراجعوش**. (درس ٢٤: الوعد المكتوب في السياسة يحتاج
--    آلية تنفّذه.)
--
-- ⚠️ **نفس التوقيع** `()` ونفس الرسالة للعميل — التغيير سطر واحد في
--    الشرط.
CREATE OR REPLACE FUNCTION public.block_inactive_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  -- ⚠️ بيقرا بصلاحية صاحب الدالة. لو قرا بصلاحية المشتري وسياسة
  --    القراءة اتضيّقت يومًا، الصف بيرجع **فاضي لا خطأ** (قاعدة
  --    «ك») — والفحص بيعدّي دايمًا وهو شكله شغّال.
  SELECT p.name INTO v_name
    FROM public.personalized_products p
   WHERE p.id = NEW.product_id
     AND (p.is_active = false OR p.review_status <> 'approved');

  IF FOUND THEN
    RAISE EXCEPTION 'المنتج «%» مش متاح للطلب دلوقتي', v_name;
  END IF;

  RETURN NEW;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.block_inactive_product() FROM public, anon;

COMMIT;

-- ══ التأكيد — استعلام واحد ═══════════════════════════════════
SELECT البند, النتيجة FROM (
  SELECT 1 AS ترتيب, 'العمودان الجديدان على بنود الطلب' AS البند,
    CASE WHEN (SELECT count(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'order_items'
                  AND column_name IN ('publisher_id_snapshot', 'publisher_cost_snapshot')) = 2
         THEN '✓ ٢ من ٢' ELSE '✗ ناقص' END AS النتيجة
  UNION ALL
  SELECT 2, 'قيد «النصيب أكبر من صفر»',
    CASE WHEN EXISTS (SELECT 1 FROM pg_constraint
                       WHERE conrelid = 'public.order_items'::regclass
                         AND conname = 'order_items_publisher_cost_snapshot_positive')
         THEN '✓' ELSE '✗' END
  UNION ALL
  SELECT 3, 'محفّز تثبيت النصيب مربوط وشغّال',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                       WHERE tgrelid = 'public.order_items'::regclass
                         AND tgname = 'snapshot_publisher_share_trg' AND tgenabled <> 'D')
         THEN '✓' ELSE '✗' END
  UNION ALL
  SELECT 4, 'محفّز حظر المنتج لسه مربوط',
    CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                       WHERE tgrelid = 'public.order_items'::regclass
                         AND tgname = 'block_inactive_product_trg' AND tgenabled <> 'D')
         THEN '✓' ELSE '✗' END
  UNION ALL
  SELECT 5, 'الحظر بقى يشمل «مش معتمد»',
    CASE WHEN (SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'block_inactive_product')
              LIKE '%review_status <> ''approved''%'
         THEN '✓' ELSE '✗' END
  UNION ALL
  -- ⚠️ عدّ النسخ لا وجود الاسم (قاعدة «س»، درس في §5 من قواعد العمل).
  SELECT 6, 'دالة المستحق: نسخة واحدة وبتقرا الرقم المثبّت',
    (SELECT CASE WHEN count(*) = 1
                  AND bool_and(prosrc LIKE '%publisher_cost_snapshot * oi.quantity%')
                 THEN '✓ نسخة واحدة'
                 ELSE '✗ ' || count(*)::text || ' نسخ أو الجسم قديم' END
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'record_order_publisher_earnings')
  UNION ALL
  SELECT 7, 'الزائر مايقدرش ينادي دالة المستحق',
    CASE WHEN has_function_privilege('anon', 'public.record_order_publisher_earnings(text)', 'EXECUTE')
         THEN '✗ الزائر يقدر' ELSE '✓' END
  UNION ALL
  SELECT 8, 'الزائر مايقدرش ينادي دوال المحفّزين',
    CASE WHEN has_function_privilege('anon', 'public.snapshot_publisher_share()', 'EXECUTE')
           OR has_function_privilege('anon', 'public.block_inactive_product()', 'EXECUTE')
         THEN '✗ الزائر يقدر' ELSE '✓' END
) t ORDER BY ترتيب;

-- ══ التراجع (معلَّق) ═════════════════════════════════════════
--
-- ⚠️ **الترتيب مهم — درس ٢٥:** pl/pgsql بيحلّ أسماء الأعمدة وقت
--    التنفيذ. لو العمودان اتشالوا والدالة الجديدة لسه مكانها، الملف
--    هيمرّ نظيفًا **وأول تسليم طلب يقع**. فالدوال ترجع الأول:
--
--   ١. شغّل تعريف `record_order_publisher_earnings` من ملف 97 (القسم ٣)
--   ٢. شغّل تعريف `block_inactive_product` من ملف 121
--   ٣. وبعدين:
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS snapshot_publisher_share_trg ON public.order_items;
-- DROP FUNCTION IF EXISTS public.snapshot_publisher_share();
-- ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_publisher_cost_snapshot_positive;
-- ALTER TABLE public.order_items DROP COLUMN IF EXISTS publisher_cost_snapshot;
-- ALTER TABLE public.order_items DROP COLUMN IF EXISTS publisher_id_snapshot;
-- COMMIT;
