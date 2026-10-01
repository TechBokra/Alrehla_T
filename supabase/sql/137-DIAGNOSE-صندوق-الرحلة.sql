-- ============================================================
-- 137 — تشخيص: هل «صندوق الرحلة» يتشرى فعلًا؟  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.** مفيش تعديل ولا إنشاء.
--
-- ── اللي الكود بيقوله ──────────────────────────────────────
--
-- زرار «اشترك» في /enha-lak/subscription بيودّي لمعالج التخصيص،
-- والمعالج بيحط في السلة **رقم الخطة** (من `box_subscription_plans`)
-- على إنه رقم منتج.
--
-- ودالة الطلب `create_customer_order` بتدوّر على الرقم ده في
-- `personalized_products` **بس** — فلو مش موجود هناك:
--
--     «منتج غير موجود: <رقم الخطة>»
--
-- والعميل بيشوف «فيه صنف في سلّتك ما بقاش متاحًا» **بعد ما ملا
-- المعالج كله ورفع إيصال الدفع.**
--
-- ⚠️ **وحتى لو الطلب نجح**: مفيش أي كود بيكتب في `box_subscriptions`
--    — يعني الاشتراك مابيتسجّلش، ومفيش شحنة شهرية تتجدول.
--
-- الملف ده بيتأكد من القاعدة نفسها (القاعدة هي مصدر الحقيقة).
-- ============================================================

SELECT البند, النتيجة, المعنى FROM (

  SELECT 1 AS ترتيب,
    'خطط الصندوق المعروضة' AS البند,
    (SELECT count(*)::text FROM public.box_subscription_plans WHERE is_active) AS النتيجة,
    'الخطط اللي ليها زرار «اشترك»' AS المعنى

  UNION ALL
  -- السؤال الحاسم: رقم كل خطة موجود كمنتج؟
  SELECT 2,
    'خطط ليها منتج بنفس الرقم',
    (SELECT count(*)::text FROM public.box_subscription_plans b
      WHERE b.is_active
        AND EXISTS (SELECT 1 FROM public.personalized_products p WHERE p.id::text = b.id::text)),
    'لو صفر: الشراء بيترفض دايمًا بـ«منتج غير موجود»'

  UNION ALL
  SELECT 3,
    'منتجات تصنيفها اشتراك',
    (SELECT count(*)::text FROM public.personalized_products WHERE category = 'subscription'),
    'منتجات «subscription» في جدول المنتجات (لو موجودة)'

  UNION ALL
  SELECT 4,
    'طلبات فيها منتج اشتراك',
    (SELECT count(DISTINCT oi.order_id)::text
       FROM public.order_items oi
       JOIN public.personalized_products p ON p.id::text = oi.product_id::text
      WHERE p.category = 'subscription'),
    'هل حد اشترى اشتراك قبل كده؟'

  UNION ALL
  SELECT 5,
    'صفوف في جدول الاشتراكات',
    (SELECT count(*)::text FROM public.box_subscriptions),
    'لو صفر: مفيش اشتراك اتسجّل أبدًا'

  UNION ALL
  SELECT 6,
    'إضافات «إنها لك» النشطة',
    (SELECT count(*)::text FROM public.addon_products WHERE is_active),
    'للمقارنة — مزايا الاشتراك ممكن تبقى عليها'

  UNION ALL
  SELECT 10 + row_number() OVER (ORDER BY sort_order, duration_months),
    'خطة: ' || name,
    duration_months::text || ' شهر · ' || price_total::text || ' ج',
    CASE WHEN EXISTS (SELECT 1 FROM public.personalized_products p WHERE p.id::text = b.id::text)
         THEN '✓ ليها منتج' ELSE '✗ مالهاش منتج — الشراء بيترفض' END
  FROM public.box_subscription_plans b
  WHERE is_active

) t ORDER BY ترتيب;
