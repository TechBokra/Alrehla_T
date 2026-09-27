-- ============================================================
-- 106 — تشخيص: ستة طلبات متجر بمبلغ صفر  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.**
--
-- ── اللي ملف 105 طلّعه ──────────────────────────────────────
--
--   حجوزات الباقات: 7، **بصفر: صفر** ✓
--   طلبات الخدمات:  0                ✓
--   **طلبات المتجر: 8، منها 6 بمبلغ صفر** 🔴
--
-- يعني العطل في مسار «إنها لك» وحده، مش في الفلوس كلها.
--
-- ── الاحتمالات التلاتة ──────────────────────────────────────
--
-- **① الطلب مالوش بنود أصلًا.** السلة اتبعتت فاضية، والدالة حسبت
--    صفرًا على لا شيء. الطلب بيبان في شاشة المراجعة كأنه حقيقي.
--
-- **② البنود موجودة وسعر الوحدة فيها صفر.** يعني المنتج اتقري
--    بسعر صفر وقت الطلب — أو اتبعت من المتصفح (قاعدة «ف»).
--
-- **③ بيانات تجريبية قديمة** من قبل ما الدالة تتظبط.
--
-- والفرق بينهم **بيغيّر الإصلاح تمامًا**: ① قيد على القاعدة،
-- ② عطل في الحساب، ③ تنظيف صفوف وبس.
--
-- القسم ١ بيفصل بينهم: كل طلب بصفر، وعدد بنوده، ومجموع أسعارها.
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ══ ١) الطلبات الستة واحدًا واحدًا ═════════════════════
  SELECT
    '1. طلبات الصفر'::text AS القسم,
    o.id::text              AS البند,
    ('اتعمل: ' || to_char(o.created_at, 'YYYY-MM-DD HH24:MI')
      || '  ·  الحالة: ' || o.status::text
      || '  ·  الإجمالي: ' || COALESCE(o.total_amount::text, 'NULL')
      || '  ·  الشحن: ' || COALESCE(o.shipping_fee::text, '0')
      || '  ·  بنود: ' || (SELECT count(*)::text FROM order_items oi WHERE oi.order_id = o.id)
      || '  ·  مجموع البنود: '
      || COALESCE((SELECT sum(oi.unit_price * oi.quantity)::text
                     FROM order_items oi WHERE oi.order_id = o.id), '—'))::text
      AS التفاصيل,
    CASE
      WHEN (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) = 0
        THEN '🔴 ① طلب بلا بنود'
      WHEN COALESCE((SELECT sum(oi.unit_price * oi.quantity)
                       FROM order_items oi WHERE oi.order_id = o.id), 0) = 0
        THEN '🔴 ② بنود بسعر صفر'
      ELSE '⚠️ بنوده ليها قيمة والإجمالي صفر — عطل في الحساب'
    END AS الحالة
  FROM public.orders o
  WHERE COALESCE(o.total_amount, 0) = 0

  UNION ALL

  -- ══ ٢) الطلبان السليمان — للمقارنة ═════════════════════
  SELECT
    '2. للمقارنة',
    o.id::text,
    ('اتعمل: ' || to_char(o.created_at, 'YYYY-MM-DD HH24:MI')
      || '  ·  الحالة: ' || o.status::text
      || '  ·  الإجمالي: ' || o.total_amount::text
      || '  ·  بنود: ' || (SELECT count(*)::text FROM order_items oi WHERE oi.order_id = o.id))::text,
    '✓ طلب بقيمة'
  FROM public.orders o
  WHERE COALESCE(o.total_amount, 0) > 0

  UNION ALL

  -- ══ ٣) بنود بسعر صفر عبر كل الطلبات ═══════════════════
  SELECT
    '3. البنود',
    'order_items',
    ('إجمالي البنود: ' || (SELECT count(*)::text FROM public.order_items)
      || '  ·  بسعر وحدة صفر: '
      || (SELECT count(*)::text FROM public.order_items WHERE COALESCE(unit_price,0) = 0)
      || '  ·  بكمية صفر: '
      || (SELECT count(*)::text FROM public.order_items WHERE COALESCE(quantity,0) = 0))::text,
    CASE WHEN (SELECT count(*) FROM public.order_items WHERE COALESCE(unit_price,0) = 0) > 0
         THEN '🔴 فيه بنود بصفر' ELSE '✓ كل بند ليه سعر' END

  UNION ALL

  -- ══ ٤) هل في قيد بيمنع الصفر؟ ═════════════════════════
  --
  -- `withdrawal_requests` عليه `CHECK (amount > 0)`. الطلبات مالهاش
  -- قيد مشابه — والقسم ده بيأكّد.
  SELECT
    '4. القيود',
    COALESCE(con.conname, '(مفيش قيد على المبلغ)')::text,
    COALESCE(pg_get_constraintdef(con.oid), 'أي مبلغ بيعدّي، بما فيه الصفر')::text,
    CASE WHEN con.conname IS NULL THEN '⚠️ مفيش حارس' ELSE '✓ موجود' END
  FROM (SELECT 1) one
  LEFT JOIN pg_constraint con
    ON con.conrelid = 'public.orders'::regclass
   AND con.contype = 'c'
   AND pg_get_constraintdef(con.oid) ILIKE '%total_amount%'

) t ORDER BY القسم, البند;

-- ============================================================
-- مفيش تراجع — الملف قراءة فقط.
-- ============================================================
