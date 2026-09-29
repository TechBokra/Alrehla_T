-- ============================================================
-- 122 — تسعير المدرب في جدول خاص  (الخطوة الأولى من اثنتين)
-- ============================================================
--
-- ⚠️ **الملف ده بيعدّل — بس مابيحذفش حاجة، ومابيقفلش التسريب لسه.**
--    اقرا «الترتيب» تحت قبل ما تشغّله.
--
-- ── العطل ───────────────────────────────────────────────────
--
-- تشخيص 120 طبع سياسة القراءة على `instructors`:
--
--     SELECT — Signed-in users read instructors
--     الأدوار: authenticated  ·  USING: true
--
-- **`true` حرفيًّا.** أي حساب مسجَّل — وإنشاء الحساب مجاني ومفتوح —
-- يقرا الجدول كامل بكل أعمدته، ومنها التسعير الداخلي بين المنصة
-- والمدرب: `approved_price` و`requested_price` و
-- `monthly_hours_committed`.
--
-- ⚠️ **ودي مصيدة (ب) في أوضح صورها:** السياسة بتقول «مين يشوف
--    الصف» ومالهاش رأي في «أي أعمدة». الصف بيرجع كامل.
--
-- ⚠️ **والتسريب واقع في الكود كمان لا في القاعدة وبس:** صفحة جلسة
--    الطالب كانت بتنادي `select('*')` عشان تعرض **اسم المدرب وبس**،
--    فالأسعار كانت بتتبعت في حمولة صفحة الطالب. **ده اتصلّح في
--    الكود بالفعل**، وباقي التسريب على مستوى القاعدة.
--
-- ── ليه جدول جديد بدل تضييق السياسة ─────────────────────────
--
-- تضييق `USING (true)` لـ«الإدارة والمدرب نفسه» **بيكسر حاجة
-- حقيقية**: صفحة «طلباتي» بتاعة العميل بتقرا اسم المدرب بـ
-- `instructors(display_name)` متداخلة، ودي **بتمرّ على نفس سياسة
-- القراءة**. فالاسم بيفضى في صفحة العميل — **بلا أي رسالة خطأ**،
-- لأن الصفوف الممنوعة بترجع فاضية لا بخطأ (قاعدة «ك»).
--
-- ودي بالظبط «الدورة المنفصلة» اللي خلّت البند معلّقًا من شهر.
--
-- **فالأعمدة بتتنقل بدل ما الصف يتقفل:**
--
--   ① `instructors` تفضل مقروءة زي ما هي — **مافيهاش أسرار بعد
--      كده**، واسم المدرب يفضل شغّال في كل مكان
--   ② التسعير في جدول سياسته ضيّقة من أول يوم
--   ③ **واللي ينسى يتعامل معاها بيقع عند البناء لا في الإنتاج** —
--      العمود بيختفي من النوع فـTypeScript بيرفض، بدل ما الشاشة
--      تشتغل وتعرض «غير محدد» ومحدش يلاحظ
--
-- **والقاعدة المكتوبة عندنا بتقول ده:** الصلاحيات بتحمي **الصفوف**
-- لا الأعمدة — فالحل لتسريب **أعمدة** إنك تحطّها في صفّ تقدر
-- السياسة تحميه.
--
-- ── الترتيب: تلات خطوات، والتسريب بيتقفل في التالتة ─────────
--
--   **١. الملف ده (122)** — جدول جديد + نسخ البيانات + سياسة.
--        الأعمدة القديمة **بتفضل مكانها وبتفضل مقروءة**.
--   **٢. الكود** — يقرا ويكتب من الجدول الجديد، ويتنشر.
--   **٣. ملف 123** — الأعمدة القديمة بتتحذف. **التسريب بيتقفل هنا.**
--
-- ⚠️ **والترتيب ده مقصود** (نفس نمط 83 ← كود ← 84): لو الأعمدة
--    اتحذفت قبل ما الكود ينشر، شاشة المدرب في الإدارة بتقرا عمودًا
--    مش موجود.
--
-- ⚠️ **وعشان 123 يتكتب بأمان، الاستعلام تحت بيطبع نصّ
--    `guard_instructor_fields` كامل.** المحفّز ده ممكن يكون بيشاور
--    على الأعمدة التلاتة بالاسم — وpl/pgsql بيحلّ الأسماء **وقت
--    التنفيذ**، يعني حذف العمود مايكسرش الملف، بيكسر **أول تعديل
--    على أي مدرب بعد كده**. ما بقراش الدالة من ذاكرتي: القاعدة هي
--    مصدر الحقيقة.
-- ============================================================

BEGIN;

-- ══ ١) الجدول ══════════════════════════════════════════════
--
-- ⚠️ `instructors.id` نوعه `text` لا `uuid` (تشخيص 120) — المفتاح
--    الأجنبي لازم يطابقه، وإلا الإنشاء بيفشل.
CREATE TABLE IF NOT EXISTS public.instructor_pricing (
  instructor_id            text PRIMARY KEY
    REFERENCES public.instructors(id) ON DELETE CASCADE,
  approved_price           integer,
  requested_price          integer,
  monthly_hours_committed  integer,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.instructor_pricing IS
  'تسعير داخلي بين المنصة والمدرب. اتفصل عن instructors لأن السياسة هناك USING(true) لكل مسجَّل — والصلاحيات بتحمي الصفوف لا الأعمدة.';

-- ══ ٢) نسخ البيانات القائمة ════════════════════════════════
--
-- ⚠️ `ON CONFLICT DO NOTHING` عشان إعادة تشغيل الملف ما تمسحش
--    تعديلًا اتعمل بعد أول تشغيل.
INSERT INTO public.instructor_pricing (
  instructor_id, approved_price, requested_price, monthly_hours_committed
)
SELECT i.id, i.approved_price, i.requested_price, i.monthly_hours_committed
  FROM public.instructors i
ON CONFLICT (instructor_id) DO NOTHING;

-- ══ ٣) الصلاحيات ═══════════════════════════════════════════
ALTER TABLE public.instructor_pricing ENABLE ROW LEVEL SECURITY;

-- ⚠️ **الشرط مكتوب بـ`EXISTS` صريح لا بدالة مساعدة.** الدوال
--    المساعدة (`owns_instructor`) ممنوحة للزائر عن قصد لأنها
--    بتتنادى جوّه سياسات تانية — والاعتماد عليها هنا بيربط جدول
--    الأسرار بقرار اتاخد لسبب تاني. والشكل ده هو نفسه المستعمل في
--    سياسات `sessions`.
DROP POLICY IF EXISTS "Admins and the instructor read pricing" ON public.instructor_pricing;
CREATE POLICY "Admins and the instructor read pricing"
  ON public.instructor_pricing
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.instructors i
       WHERE i.id = instructor_pricing.instructor_id
         AND i.user_id = auth.uid()
    )
  );

-- ⚠️ **الكتابة للإدارة وحدها.** المدرب **يقترح** سعرًا ولا يعتمده —
--    ولو فتحنا له الكتابة هنا، كان يقدر يكتب `approved_price`
--    بنفسه. ودي نفس مصيدة رفع الصلاحيات اللي اتقفلت في ملف 41:
--    الصف بتاعه، والعمود مش بتاعه.
DROP POLICY IF EXISTS "Admins write pricing" ON public.instructor_pricing;
CREATE POLICY "Admins write pricing"
  ON public.instructor_pricing
  FOR ALL
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- ⚠️ Supabase بيمنح `anon` صلاحيات واسعة على أي جدول جديد
--    تلقائيًّا — ودي المصيدة اللي ملف 82 اتعمل عشانها. الجدول ده
--    **مايتقريش من الزائر خالص**.
REVOKE ALL ON public.instructor_pricing FROM anon;

COMMIT;

-- ============================================================
-- استعلام التأكيد — واحد
-- ============================================================
SELECT البند, التفاصيل, الحالة FROM (

  SELECT
    'صفوف التسعير المنسوخة'::text AS البند,
    ((SELECT count(*)::text FROM public.instructor_pricing)
      || ' من ' || (SELECT count(*)::text FROM public.instructors))::text AS التفاصيل,
    CASE WHEN (SELECT count(*) FROM public.instructor_pricing)
            = (SELECT count(*) FROM public.instructors)
         THEN '✅ كل مدرب له صف' ELSE '🔴 ناقص — ماتشغّلش 123' END AS الحالة

  UNION ALL

  -- ⚠️ الفحص ده بيتأكّد إن **القيم** اتنسخت مش الصفوف وبس. صف
  --    موجود بقيم فاضية بيعدّي على العدّ فوق ويضيّع الأسعار في 123.
  SELECT
    'قيم مختلفة عن الأصل',
    (SELECT count(*)::text
       FROM public.instructors i
       JOIN public.instructor_pricing p ON p.instructor_id = i.id
      WHERE i.approved_price IS DISTINCT FROM p.approved_price
         OR i.requested_price IS DISTINCT FROM p.requested_price
         OR i.monthly_hours_committed IS DISTINCT FROM p.monthly_hours_committed),
    CASE WHEN (SELECT count(*)
                 FROM public.instructors i
                 JOIN public.instructor_pricing p ON p.instructor_id = i.id
                WHERE i.approved_price IS DISTINCT FROM p.approved_price
                   OR i.requested_price IS DISTINCT FROM p.requested_price
                   OR i.monthly_hours_committed IS DISTINCT FROM p.monthly_hours_committed) = 0
         THEN '✅ مطابقة' ELSE '🔴 فيه فرق — راجع قبل 123' END

  UNION ALL

  SELECT
    ('سياسة: ' || p.policyname)::text,
    (p.cmd || '  ·  ' || COALESCE(p.qual, p.with_check, '—'))::text,
    '✅ اتعملت'
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = 'instructor_pricing'

  UNION ALL

  SELECT
    'الزائر يقرا الجدول؟',
    CASE WHEN has_table_privilege('anon', 'public.instructor_pricing', 'SELECT')
         THEN 'أيوه' ELSE 'لأ' END,
    CASE WHEN has_table_privilege('anon', 'public.instructor_pricing', 'SELECT')
         THEN '🔴 اسحبها' ELSE '✅ مسحوبة' END

  UNION ALL

  -- ⚠️ **ده اللي محتاجه عشان أكتب 123 بأمان.**
  --    pl/pgsql بيحلّ أسماء الأعمدة **وقت التنفيذ**: حذف عمود
  --    بيشاور عليه المحفّز مايكسرش ملف الحذف — بيكسر **أول تعديل
  --    على أي مدرب بعد كده**.
  SELECT
    'نصّ guard_instructor_fields',
    pg_get_functiondef(pr.oid)::text,
    '⬅️ ابعتهولي قبل 123'
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.prokind = 'f'
    AND pr.proname = 'guard_instructor_fields'

) t ORDER BY البند;

-- ============================================================
-- التراجع — معلَّق عن قصد.
-- ============================================================
-- BEGIN;
--   -- ⚠️ آمن تمامًا ما دام 123 ما اتشغّلش: الأعمدة الأصلية لسه
--   --    مكانها وفيها البيانات.
--   DROP TABLE IF EXISTS public.instructor_pricing;
-- COMMIT;
