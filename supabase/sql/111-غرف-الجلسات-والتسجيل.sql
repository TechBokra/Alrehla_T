-- ============================================================
-- 111 — غرف الجلسات والتسجيل وموافقة ولي الأمر
-- ============================================================
--
-- ⚠️ **الملف ده بيعدّل القاعدة.** بيضيف ٦ أعمدة وفهرس، وبيستبدل
--    دالة محفّز واحدة. **مفيش حذف، ومفيش تعديل على أي بيانات قائمة.**
--
-- ── اللي التشخيص (ملف 110) طلّعه ────────────────────────────
--
--   • مفيش ولا عمود من أعمدة الغرف موجود  ✓ صفحة بيضا
--   • مفيش عمود موافقة في الاشتراكات      ✓
--   • سياسة القراءة على الجلسات: «صاحبها أو المدرب المسنَد أو
--     الإدارة» — **الزائر مش داخل فيها**  ✓
--   • **60 جلسة، منها 58 قادمة، و«ليها رابط لقاء: صفر»**
--
-- ⚠️ الرقم الأخير ده مش تفصيلة: **٥٨ جلسة مجدولة ومدفوعة ومالهاش
--    رابط دخول**. اللصق اليدوي اللي كنا بنتكلم عنه ما حصلش ولا مرة.
--    وده بالظبط السبب اللي بنعمل التكامل عشانه.
--
-- ── والعطل اللي التشخيص كشفه، وهو سبب نصف الملف ده ──────────
--
-- المحفّز `guard_session_fields` (ملف 82) بيشتغل بطريقة **«امنع
-- المذكور»** لا «اسمح بالمذكور»:
--
--     NEW.id                     := OLD.id;
--     NEW.course_subscription_id := OLD.course_subscription_id;
--     NEW.instructor_id          := OLD.instructor_id;
--     NEW.session_number         := OLD.session_number;
--     NEW.created_at             := OLD.created_at;
--
-- ⚠️ **يعني أي عمود جديد بيبقى مفتوحًا للمدرب تلقائيًّا** — لأنه
--    مش مذكور في القايمة. والمدرب عنده سياسة `UPDATE` على جلساته.
--
--    ولو سِبنا الأعمدة الجديدة كده، المدرب كان يقدر:
--      • يغيّر `room_url` — فالطالب يروح لغرفة تانية
--      • يقدّم `recording_expires_at` — **فالتسجيل يتحذف قبل ميعاده**
--
--    والتاني ده بيلغي الغرض من التسجيل كله: التسجيل موجود عشان
--    نرجع له لو حصلت شكوى على المدرب. مدرب يقدر يحذف الدليل =
--    مفيش دليل.
--
-- ⚠️ **ودي نفس فئة العطل** اللي وقعنا فيها في `guard_order_fields`
--    (ملف 108): محفّز حماية اتكتب لأعمدة وقتها، والدنيا اتغيّرت
--    من تحته. الفرق إننا مسكناه المرة دي **قبل** ما يوقع.
--
-- ── ليه العمودان الأخيران ───────────────────────────────────
--
-- `recording_expires_at` **بيتحسب وقت الجلسة لا وقت الحذف.** لو
-- اتحسب لحظة الحذف من الإعدادات الحالية، تغيير المدة من شهر لأسبوع
-- كان هيحذف تسجيلات **وُعد أصحابها بشهر**. الوعد اللي اتقال لولي
-- الأمر وقت الحجز هو اللي بيحكم — فبيتخزّن مع الجلسة.
--
-- `recording_consent_at` لأن **الموافقة اللي مش متسجّلة مش موافقة**.
-- مربّع الاختيار في الشاشة بيمنع الحجز، لكن الفحص في المتصفح مش
-- دليل (قاعدة «ع»). من غير العمود ده، شكوى بعد شهور مالهاش رد.
-- ============================================================

BEGIN;

-- ── ١) أعمدة الغرفة والتسجيل على الجلسات ───────────────────
--
-- كلها `IF NOT EXISTS` وكلها بتقبل الفراغ: الـ60 جلسة القائمة
-- بتفضل زي ما هي بالظبط، بلا غرفة ولا تسجيل، لحد ما الكود يملاها.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS room_name             text,
  ADD COLUMN IF NOT EXISTS room_url              text,
  ADD COLUMN IF NOT EXISTS recording_id          text,
  ADD COLUMN IF NOT EXISTS recording_status      text,
  ADD COLUMN IF NOT EXISTS recording_expires_at  timestamptz;

COMMENT ON COLUMN public.sessions.room_name IS
  'اسم الغرفة عند Daily — المفتاح اللي بنطابق بيه الحضور والاستخدام على الجلسة';
COMMENT ON COLUMN public.sessions.recording_expires_at IS
  'موعد حذف التسجيل. بيتحسب وقت الجلسة من الإعدادات وقتها — لا وقت الحذف، عشان تغيير المدة ما يقصّرش وعدًا اتقال لولي أمر';

-- الفهرس عشان مطابقة بيانات Daily بالجلسة، ومفيش داعي يشمل الفاضي.
CREATE INDEX IF NOT EXISTS sessions_room_name_idx
  ON public.sessions (room_name)
  WHERE room_name IS NOT NULL;

-- ── ٢) موافقة ولي الأمر على التسجيل ────────────────────────
--
-- ⚠️ **بيقبل الفراغ عن قصد.** الاشتراكات السبعة القائمة اتعملت قبل
--    ما الموافقة تبقى مطلوبة، فمالهاش موافقة — وكتابة قيمة لها
--    دلوقتي معناها **اختراع موافقة ما حصلتش**. الفاضي هنا حقيقة:
--    «مفيش موافقة مسجّلة».

ALTER TABLE public.course_subscriptions
  ADD COLUMN IF NOT EXISTS recording_consent_at timestamptz;

COMMENT ON COLUMN public.course_subscriptions.recording_consent_at IS
  'وقت موافقة ولي الأمر على تسجيل الجلسات. فاضي = مفيش موافقة مسجّلة (حجوزات قبل تفعيل الميزة)';

-- ── ٣) الحارس يعرف الأعمدة الجديدة ─────────────────────────
--
-- ⚠️ **ده أهم جزء في الملف.** التوقيع زي ما هو بالحرف (بلا معاملات)
--    فـ`CREATE OR REPLACE` **بتستبدل** ومابتضيفش نسخة (قاعدة «س»).
--
-- والمنطق زي ما كان بالظبط، وزيادة عليه تجميد أعمدة الغرفة: الغرفة
-- والتسجيل بيتكتبوا من الخادم (`auth.uid()` فاضية هناك) أو من
-- الإدارة. المدرب بيفضل يعدّل الموعد والحالة ورابط اللقاء اليدوي.

CREATE OR REPLACE FUNCTION public.guard_session_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- `auth.uid() IS NULL` معناها إن التعديل جاي من الخادم بمفتاح الخدمة
  -- (إنشاء الغرفة، ومهمة حذف التسجيلات). والزائر المجهول بترفضه RLS
  -- قبل ما يوصل هنا أصلًا. والإدارة ليها حق التعديل الكامل.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- المدرب بيعدّل الموعد والحالة ورابط اللقاء وبس. الباقي بيترجّع
  -- لقيمته القديمة بصمت — مش بنرمي خطأ، عشان تعديل عادي فيه عمود
  -- محمي ما يفشلش كله.
  NEW.id                     := OLD.id;
  NEW.course_subscription_id := OLD.course_subscription_id;
  NEW.instructor_id          := OLD.instructor_id;
  NEW.session_number         := OLD.session_number;
  NEW.created_at             := OLD.created_at;

  -- ⚠️ **الجديد: الغرفة والتسجيل.**
  --
  --    من غير السطور دي، المدرب كان يقدر يغيّر رابط الغرفة فيودّي
  --    الطالب لمكان تاني، أو يقدّم موعد حذف التسجيل فيمسح الدليل
  --    اللي المفروض يتراجع لو حصلت عليه شكوى.
  NEW.room_name              := OLD.room_name;
  NEW.room_url               := OLD.room_url;
  NEW.recording_id           := OLD.recording_id;
  NEW.recording_status       := OLD.recording_status;
  NEW.recording_expires_at   := OLD.recording_expires_at;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_session_fields() FROM public, anon;

COMMIT;

-- ============================================================
-- تأكيد — استعلام واحد
-- ============================================================

SELECT القسم, البند, التفاصيل, الحالة FROM (

  -- ١) الأعمدة الجديدة
  SELECT
    '1. الأعمدة'::text AS القسم,
    (c.table_name || '.' || c.column_name)::text AS البند,
    (c.data_type || CASE WHEN c.is_nullable='YES' THEN '  ·  يقبل الفراغ' ELSE '  ·  مطلوب' END)::text
      AS التفاصيل,
    '✓ اتضاف'::text AS الحالة
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND (
      (c.table_name = 'sessions' AND c.column_name IN
        ('room_name','room_url','recording_id','recording_status','recording_expires_at'))
      OR (c.table_name = 'course_subscriptions' AND c.column_name = 'recording_consent_at')
    )

  UNION ALL

  -- ٢) الحارس بيجمّد الأعمدة الجديدة فعلًا؟
  SELECT
    '2. الحارس',
    'guard_session_fields',
    ('نسخ الدالة: ' || count(*)::text
      || '  ·  بيجمّد room_url: '
      || CASE WHEN bool_or(pg_get_functiondef(pr.oid) ILIKE '%NEW.room_url%:=%OLD.room_url%')
              THEN 'أيوه' ELSE '**لأ**' END
      || '  ·  بيجمّد recording_expires_at: '
      || CASE WHEN bool_or(pg_get_functiondef(pr.oid) ILIKE '%NEW.recording_expires_at%:=%OLD.recording_expires_at%')
              THEN 'أيوه' ELSE '**لأ**' END)::text,
    CASE
      WHEN count(*) <> 1 THEN '🔴 أكتر من نسخة — فخّ (س)'
      WHEN bool_or(pg_get_functiondef(pr.oid) ILIKE '%NEW.recording_expires_at%:=%OLD.recording_expires_at%')
        THEN '✓ الحارس محدَّث'
      ELSE '🔴 الحارس لسه القديم'
    END
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public' AND pr.proname = 'guard_session_fields'

  UNION ALL

  -- ٣) البيانات القائمة ما اتلمستش
  SELECT
    '3. البيانات',
    'من غير تغيير',
    ('الجلسات: ' || (SELECT count(*)::text FROM public.sessions)
      || '  ·  ليها غرفة: '
      || (SELECT count(*)::text FROM public.sessions WHERE room_name IS NOT NULL)
      || '  ·  الاشتراكات: ' || (SELECT count(*)::text FROM public.course_subscriptions)
      || '  ·  بموافقة مسجّلة: '
      || (SELECT count(*)::text FROM public.course_subscriptions
           WHERE recording_consent_at IS NOT NULL))::text,
    'المفروض: صفر غرف وصفر موافقات — الكود هو اللي بيملاهم'

  UNION ALL

  -- ٤) الفهرس
  SELECT
    '4. الفهرس',
    'sessions_room_name_idx',
    COALESCE((SELECT indexdef FROM pg_indexes
               WHERE schemaname='public' AND indexname='sessions_room_name_idx'), 'مش موجود')::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes
                       WHERE schemaname='public' AND indexname='sessions_room_name_idx')
         THEN '✓ موجود' ELSE '✗ ناقص' END

) t ORDER BY القسم, البند;

-- ============================================================
-- التراجع — لو لزم
-- ============================================================
--
-- ⚠️ حذف الأعمدة بيحذف اللي فيها. لو الكود اشتغل وكتب غرف
--    وتسجيلات، التراجع معناه فقدان أرقام التسجيلات عند Daily —
--    والتسجيلات نفسها بتفضل عندهم بلا أي طريق يوصّلها لجلسة.
--
-- BEGIN;
--
-- -- الحارس يرجع لنسخته القديمة (من غير أسطر الغرفة والتسجيل)
-- -- انسخها من ملف 82 السطور 144–169.
--
-- ALTER TABLE public.sessions
--   DROP COLUMN IF EXISTS room_name,
--   DROP COLUMN IF EXISTS room_url,
--   DROP COLUMN IF EXISTS recording_id,
--   DROP COLUMN IF EXISTS recording_status,
--   DROP COLUMN IF EXISTS recording_expires_at;
--
-- ALTER TABLE public.course_subscriptions
--   DROP COLUMN IF EXISTS recording_consent_at;
--
-- DROP INDEX IF EXISTS public.sessions_room_name_idx;
--
-- COMMIT;
-- ============================================================
