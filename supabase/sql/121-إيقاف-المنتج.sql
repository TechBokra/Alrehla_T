-- ============================================================
-- 121 — مفتاح إيقاف للمنتج
-- ============================================================
--
-- ⚠️ **الملف ده بيعدّل.** اقرا الجزء ده قبل ما تشغّله.
--
-- ── العطل ───────────────────────────────────────────────────
--
-- `personalized_products` **مالوش عمود إيقاف**. المدرب عنده
-- `status`، والناشر عنده `status`، والإضافة عندها `is_active` —
-- **والمنتج لأ**.
--
-- يعني أي صف في الجدول **معروض للبيع دلوقتي**، ومفيش طريقة تخفيه
-- غير إنك تحذفه. والحذف بيضيّع أي بند طلب قديم مربوط بيه، فبيبقى
-- الاختيار بين «سيب الغلط ظاهر» و«امسح تاريخ الطلبات».
--
-- وتشخيص 119 أثبت إن المشكلة دي واقعة فعلًا:
--
--   • **«اعماق البحار» مرتين** — واحد بـ500 (مكتبة) وواحد بـ6000
--     (مخصص). نفس الاسم، فرق 5,500، ومسارين مختلفين
--   • **«قصة اعماق»** بـ500 ونفس التصنيف — اسم تالت قريب
--   • ومنتجان رابطهم `prod-1789588253939` و`prod-1789588225745` —
--     أرقام توليد تلقائي، ظاهرة للعميل في شريط العنوان
--
-- ── واللي بيتعمل هنا ────────────────────────────────────────
--
-- **① عمود `is_active` بقيمة افتراضية `true`.**
--
--    ⚠️ **الافتراضي `true` مقصود**: الملف ده مايغيّرش أي حاجة
--       ظاهرة لحد ما الإدارة تقرّر. الافتراضي `false` كان هيخفي
--       **كل** المنتجات لحظة التشغيل.
--
-- **② محفّز بيمنع شراء منتج موقوف.**
--
--    ⚠️ **المنع في القاعدة لا في `create_customer_order`.** الدالة
--       دي ١٥٠ سطرًا فيها كل حساب أسعار المتجر، وCREATE OR REPLACE
--       بتستبدل الجسم كله — يعني سطرين كانوا هيكلّفوا إعادة كتابة
--       ١٥٠ بإيدي في نفس الدالة اللي رجّعت ٦ طلبات بإجمالي صفر.
--
--    ⚠️ **والمحفّز بيشتغل حتى جوّه `SECURITY DEFINER`**: الدالة
--       بتتخطّى الصلاحيات ومابتتخطّاش المحفّزات. ده نفس اللي عملناه
--       في إيقاف الحساب (ملف 118).
--
--    ⚠️ **وهو على `order_items` لا على `orders`**: المنتج بيتحدّد
--       في البند، والطلب ممكن يبقى فيه منتج شغّال وواحد موقوف.
--       الحارس على الطلب كان هيعدّي الحالة دي.
--
-- ── اللي **مش** بيتعمل، وليه ────────────────────────────────
--
-- ⚠️ **مفيش صف بيتوقف هنا.** أي منتج نشيله من الشاشة قرار إداري
--    لا قرار ملف SQL. الملف بيدّي المفتاح؛ إنت اللي بتقفله.
--
-- ⚠️ **ومفيش حذف لأي تكرار.** «اعماق البحار» الاتنين بيفضلوا —
--    توقف اللي مش عايزه من الشاشة، وتاريخ الطلبات بيفضل سليم.
-- ============================================================

BEGIN;

-- ══ ١) العمود ══════════════════════════════════════════════
ALTER TABLE public.personalized_products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.personalized_products.is_active IS
  'معروض للبيع. false = مخفي من الموقع ومرفوض في الطلبات الجديدة، وبنود الطلبات القديمة بتفضل.';

-- ══ ٢) منع شراء المنتج الموقوف ════════════════════════════
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
     AND p.is_active = false;

  IF FOUND THEN
    RAISE EXCEPTION 'المنتج «%» مش متاح للطلب دلوقتي', v_name;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS block_inactive_product_trg ON public.order_items;
CREATE TRIGGER block_inactive_product_trg
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.block_inactive_product();

-- ⚠️ Supabase بيمنح `anon` تنفيذ أي دالة جديدة تلقائيًّا — ودي
--    المصيدة اللي ملف 82 اتعمل عشانها. المحفّز بيناديها بنفسه.
REVOKE EXECUTE ON FUNCTION public.block_inactive_product() FROM anon;

COMMIT;

-- ============================================================
-- استعلام التأكيد — واحد
-- ============================================================
SELECT البند, التفاصيل, الحالة FROM (

  SELECT
    'عمود is_active'::text AS البند,
    (c.data_type || '  ·  افتراضي: ' || COALESCE(c.column_default,'—'))::text AS التفاصيل,
    CASE WHEN c.column_default ILIKE '%true%'
         THEN '✅ اتضاف بافتراضي true — مفيش حاجة اتخفت'
         ELSE '🔴 افتراضي غير متوقّع — راجع' END AS الحالة
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.table_name='personalized_products'
    AND c.column_name='is_active'

  UNION ALL

  SELECT
    'محفّز منع الموقوف',
    t.tgrelid::regclass::text,
    '✅ مربوط'
  FROM pg_trigger t
  WHERE t.tgname='block_inactive_product_trg' AND NOT t.tgisinternal

  UNION ALL

  SELECT
    'منتجات معروضة دلوقتي',
    (SELECT count(*)::text FROM public.personalized_products WHERE is_active),
    'المفروض العدد الكامل — مفيش حاجة اتوقفت من الملف'

  UNION ALL

  SELECT
    'منتجات موقوفة',
    (SELECT count(*)::text FROM public.personalized_products WHERE NOT is_active),
    'المفروض صفر — الإيقاف قرارك من الشاشة'

  UNION ALL

  SELECT
    'نسخ block_inactive_product',
    (SELECT count(*)::text FROM pg_proc pr
      JOIN pg_namespace n ON n.oid=pr.pronamespace
     WHERE n.nspname='public' AND pr.proname='block_inactive_product'),
    CASE WHEN (SELECT count(*) FROM pg_proc pr
                JOIN pg_namespace n ON n.oid=pr.pronamespace
               WHERE n.nspname='public' AND pr.proname='block_inactive_product') = 1
         THEN '✅ واحدة' ELSE '🔴 أكتر من نسخة' END

) t ORDER BY البند;

-- ============================================================
-- التراجع — معلَّق عن قصد.
-- ============================================================
-- BEGIN;
--   DROP TRIGGER IF EXISTS block_inactive_product_trg ON public.order_items;
--   DROP FUNCTION IF EXISTS public.block_inactive_product();
--   -- ⚠️ العمود بيتساب: حذفه بيرجّع كل منتج موقوف للعرض فجأة.
--   --    شيله بإيدك لو إنت متأكد.
-- COMMIT;
