-- ============================================================
-- 113 — تشخيص: جرد كامل قبل مسح البيانات التجريبية  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.** مفيش سطر بيحذف ولا بيعدّل.
--
-- ── ليه جرد قبل قرار اتاخد خلاص ─────────────────────────────
--
-- إنت قلت إن الاشتراكات والجلسات والطلبات كلها تجريبية ومفيش مانع
-- من مسحها. القرار ده صح على الأغلب — **بس الحذف مالوش تراجع**،
-- والملف ده بيجاوب على تلات أسئلة قبل ما نضغط:
--
-- **① إيه اللي هيروح بالظبط؟** حذف اشتراك مش بيروح لوحده: الجلسات
--    والتقارير والمستحقات مربوطة بيه. والقسم ٣ بيطبع كل رابط
--    و**تصرّفه عند الحذف** (`CASCADE` يعني بيمشي وراه، و`RESTRICT`
--    يعني بيمنع الحذف أصلًا).
--
-- **② فيه فلوس في الأرقام دي؟** ملف 108 صلّح ستة طلبات كانت بصفر
--    ورجّع إيرادات بـ**69,080 ج.م**. لو الطلبات دي هتتمسح، الرقم
--    ده بيروح. مش مشكلة لو تجريبي — بس تشوفه قبل لا بعد.
--
-- **③ فيه حساب مش بتاعك جوّه؟** لو في حجز لحد من فريق العمل أو
--    عميل جرّب الموقع، ده بيتحذف كمان. القسم ٤ بيطبع أصحاب الصفوف.
--
-- ⚠️ **وفيه حاجتان الحذف من القاعدة مابيلمسهمش، ولازم تتعمل بإيدك:**
--
--    **الغرف عند Daily.** لو ضغطت «جهّز غرف الجلسات القادمة»، بقى
--    في غرف اسمها `alrehla-<رقم الجلسة>`. حذف الجلسة من القاعدة
--    **مابيحذفش الغرفة** — بتفضل عندهم لحد تاريخ انتهائها.
--
--    **صور الإيصالات على Cloudinary.** إيصالات التحويل مرفوعة هناك،
--    وحذف الطلب بيشيل الرابط بس. الصور دي هتبان في شاشة Cloudinary
--    اللي هنبنيها كـ«مالهاش رابط».
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ══ ١) الأعداد ════════════════════════════════════════
  SELECT '1. الأعداد'::text AS القسم, 'course_subscriptions'::text AS البند,
         (SELECT count(*)::text FROM public.course_subscriptions) AS التفاصيل,
         'اشتراكات الباقات'::text AS الحالة
  UNION ALL SELECT '1. الأعداد','sessions',
         (SELECT count(*)::text FROM public.sessions),'الجلسات'
  UNION ALL SELECT '1. الأعداد','session_reports',
         (SELECT count(*)::text FROM public.session_reports),'تقارير المدربين'
  UNION ALL SELECT '1. الأعداد','orders',
         (SELECT count(*)::text FROM public.orders),'طلبات المتجر'
  UNION ALL SELECT '1. الأعداد','order_items',
         (SELECT count(*)::text FROM public.order_items),'بنود الطلبات'
  UNION ALL SELECT '1. الأعداد','service_orders',
         (SELECT count(*)::text FROM public.service_orders),'طلبات الخدمات'
  UNION ALL SELECT '1. الأعداد','instructor_payouts',
         (SELECT count(*)::text FROM public.instructor_payouts),'مستحقات المدربين'
  UNION ALL SELECT '1. الأعداد','publisher_payouts',
         (SELECT count(*)::text FROM public.publisher_payouts),'مستحقات الناشرين'
  UNION ALL SELECT '1. الأعداد','withdrawal_requests',
         (SELECT count(*)::text FROM public.withdrawal_requests),'طلبات السحب'
  UNION ALL SELECT '1. الأعداد','dependent_requests',
         (SELECT count(*)::text FROM public.dependent_requests),'طلبات الأبناء'
  UNION ALL SELECT '1. الأعداد','reviews',
         (SELECT count(*)::text FROM public.reviews),'التقييمات'

  UNION ALL

  -- ══ ٢) الفلوس اللي في الأرقام دي ══════════════════════
  SELECT
    '2. الفلوس',
    'طلبات المتجر',
    ('الإجمالي: ' || COALESCE((SELECT sum(total_amount)::text FROM public.orders), '0')
      || ' ج.م  ·  منها مدفوعة/مسلَّمة: '
      || COALESCE((SELECT sum(total_amount)::text FROM public.orders
                    WHERE status IN ('paid','delivered','shipped','preparing')), '0')
      || ' ج.م')::text,
    '⚠️ الرقم ده بيروح مع الحذف'
  UNION ALL
  SELECT
    '2. الفلوس',
    'اشتراكات الباقات',
    ('الإجمالي: ' || COALESCE((SELECT sum(amount)::text FROM public.course_subscriptions), '0')
      || ' ج.م  ·  منها نشطة: '
      || COALESCE((SELECT sum(amount)::text FROM public.course_subscriptions
                    WHERE status = 'active'), '0') || ' ج.م')::text,
    '⚠️ بيروح مع الحذف'
  UNION ALL
  SELECT
    '2. الفلوس',
    'مستحقات مسجَّلة',
    ('للمدربين: ' || COALESCE((SELECT sum(amount)::text FROM public.instructor_payouts), '0')
      || ' ج.م  ·  للناشرين: '
      || COALESCE((SELECT sum(amount)::text FROM public.publisher_payouts), '0') || ' ج.م')::text,
    'لو فيها مدفوع فعلًا، سجلّه بيروح'

  UNION ALL

  -- ══ ٣) الروابط وتصرّفها عند الحذف ═════════════════════
  --
  -- ⚠️ **دي اللي بتقول إيه اللي هيمشي ورا إيه.**
  --    `CASCADE` = الصف التابع بيتحذف تلقائيًّا.
  --    `NO ACTION`/`RESTRICT` = الحذف **بيترفض** لحد ما التابع يتشال.
  --    `SET NULL` = الصف بيفضل والرابط بيتفضّى.
  SELECT
    '3. الروابط',
    (src.relname || '.' || a.attname || ' ← ' || tgt.relname)::text,
    ('عند الحذف: ' ||
      CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION — بيمنع الحذف'
        WHEN 'r' THEN 'RESTRICT — بيمنع الحذف'
        WHEN 'c' THEN '**CASCADE — بيتحذف معاه**'
        WHEN 'n' THEN 'SET NULL — الرابط بيتفضّى'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE con.confdeltype::text END)::text,
    CASE con.confdeltype
      WHEN 'c' THEN '⚠️ بيمشي ورا الأصل'
      WHEN 'a' THEN '🔴 هيوقف الحذف — لازم ترتيب'
      WHEN 'r' THEN '🔴 هيوقف الحذف — لازم ترتيب'
      ELSE '✓' END
  FROM pg_constraint con
  JOIN pg_class src ON src.oid = con.conrelid
  JOIN pg_class tgt ON tgt.oid = con.confrelid
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
  JOIN pg_namespace n ON n.oid = src.relnamespace
  WHERE con.contype = 'f' AND n.nspname = 'public'
    AND tgt.relname IN ('course_subscriptions','sessions','orders','service_orders')

  UNION ALL

  -- ══ ٤) مين أصحاب الصفوف دي ════════════════════════════
  --
  -- لو كلهم حساباتك وحسابات الفريق، الحذف مريح. ولو في حساب
  -- مش معروف، ده عميل جرّب الموقع فعلًا.
  SELECT
    '4. الأصحاب',
    COALESCE(up.full_name, '(حساب محذوف)')::text,
    ('اشتراكات: ' || count(DISTINCT cs.id)::text
      || '  ·  طلبات: ' || COALESCE((SELECT count(*)::text FROM public.orders o
                                       WHERE o.user_id = cs.user_id), '0'))::text,
    'راجع الاسم'
  FROM public.course_subscriptions cs
  LEFT JOIN public.user_profiles up ON up.id = cs.user_id
  GROUP BY up.full_name, cs.user_id

  UNION ALL

  -- ══ ٥) الغرف اللي هتفضل عند Daily ═════════════════════
  SELECT
    '5. غرف Daily',
    'جلسات ليها غرفة',
    ('العدد: ' || (SELECT count(*)::text FROM public.sessions WHERE room_name IS NOT NULL)
      || '  ·  أمثلة: '
      || COALESCE((SELECT string_agg(room_name, ' · ')
                     FROM (SELECT room_name FROM public.sessions
                            WHERE room_name IS NOT NULL LIMIT 3) x), '—'))::text,
    '⚠️ حذف الجلسة مابيحذفش الغرفة عند Daily'

  UNION ALL

  -- ══ ٦) صور الإيصالات اللي هتبقى مهجورة ════════════════
  SELECT
    '6. إيصالات مرفوعة',
    'روابط على Cloudinary',
    ('في الطلبات: ' || (SELECT count(*)::text FROM public.orders
                          WHERE COALESCE(payment_receipt_url,'') <> '')
      || '  ·  في الاشتراكات: ' || (SELECT count(*)::text FROM public.course_subscriptions
                                      WHERE COALESCE(payment_receipt_url,'') <> ''))::text,
    'هتبان «مالهاش رابط» في شاشة Cloudinary'

) t ORDER BY القسم, البند;

-- ============================================================
-- مفيش تراجع — الملف قراءة فقط.
-- ============================================================
