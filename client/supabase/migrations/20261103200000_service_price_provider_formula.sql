-- =====================================================================
-- 20261103200000 — سعر الخدمة من مقدّم (مدرب/مستقل) بمعادلة المقدّمين
-- =====================================================================
--
-- الغرض:
--   المحفّز `price_service_order` (اللي بيحدّد المبلغ الحقيقي اللي
--   العميل بيدفعه) كان بيحسب بمعادلة **الجلسات** (`default`: ×1.35 + 100)،
--   والموقع بيعرض بمعادلة **مقدّمي الخدمات** (`provider-default`).
--   النتيجة: مدرب سعره 350 → الموقع يقول رقم، والطلب يتسجّل بـ 573.
--   بعد الملف ده الاتنين بيحسبوا بمعادلة المقدّمين من صفحة إعدادات
--   التسعير، ولو صفّها مش موجود بيرجع لمعادلة الجلسات زي الأول.
--
-- الأثر:
--   طلبات الخدمات الجديدة من مدرب أو مستقل بس. طلبات المنصة نفسها
--   (سعر الكارت) مش بتتأثر. الطلبات القديمة مش بتتغيّر.
--
-- الترتيب: بعد 20261103090000. مفيش اعتماد على حاجة تانية.
--
-- التحقق بعد التشغيل:
--   SELECT position('provider_formula_v1' in pg_get_functiondef('public.price_service_order'::regproc)) > 0;
--   → true
--
-- الرجوع: شغّل نفس الاستبدال بالعكس (WHERE id = 'default')، أو
--   ببساطة خلّي معادلة المقدّمين في صفحة الإعدادات = معادلة الجلسات.
-- =====================================================================

DO $mig$
DECLARE
  v_def text := pg_get_functiondef('public.price_service_order'::regproc);
  v_new text;
BEGIN
  IF position('provider_formula_v1' in v_def) > 0 THEN
    RAISE NOTICE 'price_service_order: already patched';
    RETURN;
  END IF;

  v_new := regexp_replace(
    v_def,
    $re$SELECT platform_multiplier, fixed_admin_fee INTO v_mult, v_fee\s+FROM pricing_formula_settings WHERE id = 'default';$re$,
    $rep$SELECT platform_multiplier, fixed_admin_fee INTO v_mult, v_fee
      FROM pricing_formula_settings
     WHERE id IN ('provider-default', 'default')
     ORDER BY (id = 'provider-default') DESC
     LIMIT 1; -- provider_formula_v1: معادلة المقدّمين، والجلسات احتياطي$rep$
  );

  IF v_new = v_def THEN
    RAISE EXCEPTION 'price_service_order: النص المتوقَّع مش موجود — مفيش تغيير اتعمل';
  END IF;

  EXECUTE v_new;
END
$mig$;
