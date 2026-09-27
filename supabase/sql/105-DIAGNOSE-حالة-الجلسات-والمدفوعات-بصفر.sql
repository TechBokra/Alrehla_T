-- ============================================================
-- 105 — تشخيص: حالة الجلسات، ومدفوعات بصفر  (قراءة فقط)
-- ============================================================
--
-- ✅ **قراءة فقط.** مفيش تعديل ولا إنشاء ولا سياسة بتتغيّر.
--
-- ── بلاغات فريق العمل، والسبب المشترك ───────────────────────
--
-- تلات بلاغات مختلفة الشكل، وطلع **سببهم واحد**:
--
--   ① «الجلسة فضلت (قادمة) مع إن معادها فات»
--   ② «تقرير الجلسة ما ظهرش لولي الأمر ولا الطالب»
--   ③ «مواعيد باقة مدفوعة ومؤكَّدة بتظهر: بانتظار تثبيت الموعد»
--
-- ⚠️ **مفيش سطر واحد في المشروع كله بيكتب `sessions.status`.**
--
--    فحصت الكود: `admin-sessions.ts` بتعدّل الموعد ورابط اللقاء،
--    و`bookings.ts` بتعدّل `instructor_id` — **ومحدّش بيلمس
--    `status`**. فالجلسة بتتعمل بحالة افتراضية وبتفضل عليها للأبد.
--
--    ودي **نفس فئة العطل** بتاعة `instructors.status` اللي قفلناها
--    امبارح: عمود حالة مفيش طريق يغيّره، وكل الشاشات بتقراه.
--
-- ودي النتيجة على كل بلاغ:
--
--   ① الحالة عمرها ما بقت `completed`، فالشاشة بتقول «قادمة».
--   ② `/dashboard/student` بتجيب التقرير لآخر جلسة **مكتملة**
--      (`lastCompleted`) — ومفيش ولا واحدة مكتملة أبدًا، فالطالب
--      **مايشوفش تقريرًا خالص**.
--   ③ شاشة ولي الأمر بتترجم `pending` لـ«بانتظار تثبيت الموعد» —
--      وهي الحالة الافتراضية اللي الجلسة اتولدت بيها.
--
-- **والتقرير نفسه بيتحفظ فعلًا** في `session_reports` — الإدارة
-- تقدر تشوفه لو فتحت صفحة الجلسة بعينها. اللي ناقص: قايمة تجمعهم،
-- وإشعار، وتغيير الحالة.
--
-- ── اللي الاستعلام ده بيحدّده ───────────────────────────────
--
-- القسم ١ بيقول **القيمة الافتراضية للعمود** والقيم الموجودة فعلًا،
-- عشان الإصلاح يشتغل على الحقيقة لا على توقّعي.
--
-- ⚠️ ومهم: `sessions.status` **نصّي لا نوع معرَّف** — يعني مفيش
--    قائمة قيم محروسة، وأي نص بيعدّي. القسم ٢ بيطبع اللي اتخزّن.
--
-- ── والبلاغ الرابع: «مدفوعات بقيمة صفر» ─────────────────────
--
-- القسم ٤ بيعدّ الصفوف بمبلغ صفر في التلات مسارات، عشان نعرف
-- **مين** فيهم وإذا كانت بيانات تجريبية ولا عطل في الحساب.
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ══ ١) عمود الحالة: نوعه وافتراضيه ═════════════════════
  SELECT
    '1. عمود الحالة'::text AS القسم,
    c.column_name::text     AS البند,
    (c.data_type
      || '  ·  افتراضي: ' || COALESCE(c.column_default, '(مفيش)')
      || CASE WHEN c.is_nullable = 'NO' THEN '  ·  مطلوب' ELSE '' END)::text
      AS التفاصيل,
    CASE WHEN c.data_type = 'text'
         THEN '⚠️ نصّي — مفيش قائمة قيم محروسة'
         ELSE '✓ نوع معرَّف' END AS الحالة
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'sessions'
    AND c.column_name IN ('status', 'scheduled_at', 'instructor_id')

  UNION ALL

  -- ══ ٢) القيم الموجودة فعلًا، ومعاها الفايت معاده ════════
  SELECT
    '2. حالات الجلسات',
    s.status::text,
    ('عدد: ' || count(*)::text
      || '  ·  منها معادها فات: '
      || count(*) FILTER (WHERE s.scheduled_at < now())::text
      || '  ·  منها ليها تقرير: '
      || count(*) FILTER (
           WHERE EXISTS (SELECT 1 FROM session_reports r WHERE r.session_id = s.id)
         )::text)::text,
    CASE
      WHEN s.status = 'completed' THEN '✓ مكتملة'
      WHEN count(*) FILTER (WHERE s.scheduled_at < now()) > 0
        THEN '🔴 فيه جلسات فات معادها وحالتها ما اتغيّرتش'
      ELSE '— للمراجعة'
    END
  FROM public.sessions s
  GROUP BY s.status

  UNION ALL

  -- ══ ٣) التقارير: اتحفظت فعلًا؟ ═════════════════════════
  SELECT
    '3. التقارير',
    'session_reports',
    ('إجمالي: ' || (SELECT count(*)::text FROM public.session_reports)
      || '  ·  حضور: '
      || (SELECT count(*)::text FROM public.session_reports WHERE attendance = 'present')
      || '  ·  غياب: '
      || (SELECT count(*)::text FROM public.session_reports WHERE attendance = 'absent')
      || '  ·  فيها نص مكتوب: '
      || (SELECT count(*)::text FROM public.session_reports
           WHERE report IS NOT NULL AND btrim(report) <> ''))::text,
    CASE WHEN (SELECT count(*) FROM public.session_reports) > 0
         THEN '✓ التقارير بتتحفظ — المشكلة في العرض'
         ELSE '⚠️ مفيش تقارير محفوظة' END

  UNION ALL

  -- ══ ٤) مدفوعات بصفر ════════════════════════════════════
  SELECT
    '4. مدفوعات بصفر',
    x.label,
    x.detail,
    CASE WHEN x.zeros > 0 THEN '🔴 فيه صفوف بصفر' ELSE '✓ مفيش' END
  FROM (
    SELECT 'حجوزات الباقات'::text AS label,
           (SELECT count(*) FROM public.course_subscriptions WHERE COALESCE(amount,0) = 0) AS zeros,
           ('إجمالي: ' || (SELECT count(*)::text FROM public.course_subscriptions)
             || '  ·  بمبلغ صفر: '
             || (SELECT count(*)::text FROM public.course_subscriptions WHERE COALESCE(amount,0) = 0)
             || '  ·  منها مدفوعة: '
             || (SELECT count(*)::text FROM public.course_subscriptions
                  WHERE COALESCE(amount,0) = 0 AND status <> 'pending'))::text AS detail
    UNION ALL
    SELECT 'طلبات المتجر',
           (SELECT count(*) FROM public.orders WHERE COALESCE(total_amount,0) = 0),
           ('إجمالي: ' || (SELECT count(*)::text FROM public.orders)
             || '  ·  بمبلغ صفر: '
             || (SELECT count(*)::text FROM public.orders WHERE COALESCE(total_amount,0) = 0))
    UNION ALL
    SELECT 'طلبات الخدمات',
           (SELECT count(*) FROM public.service_orders WHERE COALESCE(amount,0) = 0),
           ('إجمالي: ' || (SELECT count(*)::text FROM public.service_orders)
             || '  ·  بمبلغ صفر: '
             || (SELECT count(*)::text FROM public.service_orders WHERE COALESCE(amount,0) = 0))
  ) x

  UNION ALL

  -- ══ ٥) الحجوزات بصفر: مين وإمتى ════════════════════════
  --
  -- عشان نعرف: بيانات تجريبية قديمة ولا عطل في الحساب دلوقتي.
  SELECT
    '5. تفاصيل حجوزات الصفر',
    COALESCE(cs.id, '—')::text,
    ('المبلغ: ' || COALESCE(cs.amount::text, 'NULL')
      || '  ·  الحالة: ' || COALESCE(cs.status, '—')
      || '  ·  اتعمل: ' || to_char(cs.created_at, 'YYYY-MM-DD')
      || '  ·  الباقة: ' || COALESCE(p.name, '(محذوفة)'))::text,
    'للمراجعة'
  FROM public.course_subscriptions cs
  LEFT JOIN public.creative_writing_packages p ON p.id = cs.package_id
  WHERE COALESCE(cs.amount, 0) = 0

) t ORDER BY القسم, البند;

-- ============================================================
-- مفيش تراجع — الملف قراءة فقط.
-- ============================================================
