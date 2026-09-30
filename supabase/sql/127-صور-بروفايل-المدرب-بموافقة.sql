-- ============================================================
-- 127 — غلاف البروفايل وصور الأعمال، بموافقة الإدارة
-- ============================================================
--
-- ⚠️ **الملف ده بيضيف جدولًا ويعدّل حارسًا. مابيحذفش أي عمود ولا
--    أي دالة.** اقرا «قرار التصميم» تحت قبل ما تشغّله.
--
-- ════════════════════════════════════════════════════════════
-- قرار التصميم — وليه مش الطريقة المباشرة
-- ════════════════════════════════════════════════════════════
--
-- الطريقة البديهية: عمود `cover_image_url` على `instructors`.
--
-- **وما عملتهاش.** السبب إن الصفحات العامة مابتقراش من الجدول،
-- بتنادي `public_instructors()` و`public_instructor(p_id)` —
-- وتشخيص 126 قال إن نوع إرجاعهما `TABLE(...)`. يعني إضافة عمود
-- للإرجاع **بتستلزم `DROP FUNCTION` قبل الإنشاء**.
--
-- ⚠️ **وأنا مش معايا كل صفات الدالتين.** تشخيص 126 طبع النصّ
--    والتوقيع ونوع الإرجاع — **وما طبعش `SECURITY DEFINER` ولا
--    `STABLE` ولا `search_path`**. ودي غلطة في تشخيصي أنا، مش
--    نقص في القاعدة.
--
--    ولو أعدت إنشاءهما بصفات مختلفة عن الأصل، **الزائر يقدر
--    يبطّل يشوف المدربين خالص** — وده على الإنتاج مباشرةً.
--
--    أقدر أستنتج إنهما `SECURITY DEFINER` (لأن الزائر مالوش
--    سياسة قراءة على `instructors` وبرضه الصفحات شغّالة عنده)،
--    **لكن الاستنتاج مش قياس**. والقاعدة عندنا إن القاعدة هي
--    مصدر الحقيقة — وأنا غلطت في ده تلات مرات قبل كده.
--
-- **فالصور كلها — الغلاف والأعمال — في جدول واحد جديد بسياسته
--   الخاصة، والصفحة بتقرا منه مباشرةً.** مافيش دالة بتتحذف،
--   ومافيش مخاطرة على مسار الزائر، **وآلية الموافقة بتبقى واحدة
--   للاتنين** بدل مسارين متوازيين يتناقضا بعدين.
--
-- ════════════════════════════════════════════════════════════
-- 🔴 والحارس بيتوسّع — لأن «الموافقة» دلوقتي مش حقيقية
-- ════════════════════════════════════════════════════════════
--
-- تشخيص 125 كشف:
--
--     Instructors can update their own profile
--     UPDATE · USING (auth.uid() = user_id) · CHECK: —
--
-- والحارس بيجمّد ستة أعمدة، **مش منهم `bio` ولا `display_name`
-- ولا `specialties` ولا `years_experience`**. يعني المدرب بيكتبهم
-- على الجدول مباشرةً، والشاشة بتقول «في انتظار الموافقة».
--
-- ⚠️ **وراجعت الكود كله قبل ما أجمّدهم:** مافيش ولا مسار بيخلّي
--    المدرب يكتب على `instructors` مباشرةً —
--    `submitInstructorProfileUpdate` بتكتب في
--    `profile_update_requests` وخلاص. والكتابة على الجدول كلها في
--    دوال إدارية (`approveProfileUpdateRequest` و
--    `updateInstructorProfileByAdmin`) وبتشتغل بجلسة إداري،
--    فالحارس بيعفيها من أول سطر.
--
--    **يعني التجميد مابيكسرش شاشة واحدة** — بيقفل طريقًا مفتوحًا
--    مافيش حاجة بتستعمله.
-- ============================================================

BEGIN;

-- ══ ١) حالة الصورة ═════════════════════════════════════════
--
-- ⚠️ **`text` + `CHECK` لا نوع `enum` جديد** عن قصد: المشروع فيه
--    أنواع enum كتير، وإضافة قيمة لنوع enum بعدين عملية مزعجة
--    ومابتترجعش في معاملة واحدة في كل النسخ. الـ`CHECK` بيتعدّل
--    بسطر.
CREATE TABLE IF NOT EXISTS public.instructor_media (
  id             text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  instructor_id  text NOT NULL
                 REFERENCES public.instructors(id) ON DELETE CASCADE,

  -- `cover` = غلاف البروفايل · `work` = صورة إصدار أو عمل
  kind           text NOT NULL CHECK (kind IN ('cover','work')),

  image_url      text NOT NULL,
  title          text,
  -- دور المدرب في العمل: «تأليف» · «رسم» · «مشاركة»… نصّ حرّ عن
  -- قصد، الأدوار في النشر أكتر من إن تتحصر في قايمة.
  contribution   text,
  sort_order     integer NOT NULL DEFAULT 0,

  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  admin_feedback text,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.instructor_media IS
  'صور بروفايل المدرب (غلاف وأعمال) بموافقة الإدارة. اتعملت جدولًا مستقلًا بدل عمود على instructors عشان الصفحات العامة بتقرا من دوال TABLE(...) وتعديلها بيستلزم DROP — وصفاتها مش مقيسة (ملف 127).';

-- ⚠️ **غلاف واحد معتمد لكل مدرب.** من غير القيد دي، موافقتان على
--    غلافين بتسيب اتنين «معتمدين» والصفحة بتختار عشوائيًّا —
--    والإدارة تفتكر إنها غيّرت الغلاف وهو ما اتغيّرش.
--    والقيد **جزئي**: المعلَّقة والمرفوضة ممكن تبقى كتير عادي.
CREATE UNIQUE INDEX IF NOT EXISTS instructor_media_one_cover
  ON public.instructor_media (instructor_id)
  WHERE kind = 'cover' AND status = 'approved';

CREATE INDEX IF NOT EXISTS instructor_media_lookup
  ON public.instructor_media (instructor_id, kind, status, sort_order);

-- ══ ٢) الحارس: الحالة مش بتاعة المدرب ══════════════════════
--
-- ⚠️ **ودي أهم دالة في الملف.**
--
--    السياسة بتقدر تمنع المدرب من كتابة `status='approved'` عند
--    **الإدراج**. لكنها **مابتقدرش تمنع الحيلة دي:**
--
--      ① يرفع صورة عادية  →  الإدارة توافق (`approved`)
--      ② يعدّل نفس الصفّ ويحطّ `image_url` تاني
--      ③ الصفّ لسه `approved` — **والصورة الجديدة اتنشرت بلا
--         موافقة**
--
--    الموافقة كانت على **الصورة**، والصفّ هو اللي محمول عليه
--    الختم. فأي تغيير في الصورة أو العنوان **بيرجّع الحالة
--    `pending` تلقائيًّا**.
--
--    ودي مش تشدّد زيادة: هي الفرق بين «الإدارة وافقت على الصفّ»
--    و«الإدارة وافقت على اللي فيه».
CREATE OR REPLACE FUNCTION public.guard_instructor_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- فاضية = مفتاح الخدمة · والإداري مسموح له صراحةً.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- المدرب مايقررش الحالة ولا يكتب ملاحظات الإدارة.
  NEW.status         := OLD.status;
  NEW.admin_feedback := OLD.admin_feedback;
  NEW.instructor_id  := OLD.instructor_id;
  NEW.kind           := OLD.kind;

  -- ⚠️ **والصورة لو اتغيّرت، الختم بيسقط.**
  IF NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.contribution IS DISTINCT FROM OLD.contribution
  THEN
    NEW.status         := 'pending';
    NEW.admin_feedback := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS guard_instructor_media_update ON public.instructor_media;
CREATE TRIGGER guard_instructor_media_update
  BEFORE UPDATE ON public.instructor_media
  FOR EACH ROW EXECUTE FUNCTION public.guard_instructor_media();

-- ══ ٣) الصلاحيات ═══════════════════════════════════════════
ALTER TABLE public.instructor_media ENABLE ROW LEVEL SECURITY;

-- ⚠️ الشرط بـ`EXISTS` صريح لا بدالة مساعدة — نفس سبب ملف 122:
--    الدوال المساعدة ممنوحة للزائر لأسباب تانية، والاعتماد عليها
--    بيربط الجدول ده بقرار اتاخد لسبب مالوش علاقة.

-- (أ) المعتمَد بس هو العام — **وللزائر كمان**، دي صفحة عامة.
DROP POLICY IF EXISTS "Anyone reads approved media" ON public.instructor_media;
CREATE POLICY "Anyone reads approved media"
  ON public.instructor_media FOR SELECT
  TO anon, authenticated
  USING ( status = 'approved' );

-- (ب) المدرب يشوف بتاعه كله — عشان يتابع المعلَّق والمرفوض.
DROP POLICY IF EXISTS "Instructor reads own media" ON public.instructor_media;
CREATE POLICY "Instructor reads own media"
  ON public.instructor_media FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.instructors i
             WHERE i.id = instructor_media.instructor_id
               AND i.user_id = auth.uid())
  );

-- (ج) المدرب يضيف لنفسه — **معلَّقة إجباريًّا**.
--     ⚠️ الشرط `status='pending'` في `WITH CHECK` هو اللي بيمنعه
--        يدرج صفًّا معتمدًا من أول لحظة. الحارس فوق بيغطّي
--        التعديل، ودي بتغطّي الإدراج — **والاتنين لازمين**.
DROP POLICY IF EXISTS "Instructor adds own media" ON public.instructor_media;
CREATE POLICY "Instructor adds own media"
  ON public.instructor_media FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.instructors i
                 WHERE i.id = instructor_media.instructor_id
                   AND i.user_id = auth.uid())
  );

-- (د) المدرب يعدّل بتاعه — والحارس بيرجّع الحالة `pending`.
DROP POLICY IF EXISTS "Instructor edits own media" ON public.instructor_media;
CREATE POLICY "Instructor edits own media"
  ON public.instructor_media FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.instructors i
             WHERE i.id = instructor_media.instructor_id
               AND i.user_id = auth.uid())
  );

-- (هـ) المدرب يشيل بتاعه.
--      ⚠️ **الحذف هنا مسموح عن قصد** — ده محتواه هو، وشيله
--         مابيضرّش حد. وده مش بيخالف قاعدة «لا حذف نهائي من
--         واجهة الويب»: القاعدة دي عن بيانات المنصة (طلبات،
--         حسابات، جلسات)، مش عن صورة المدرب رفعها بنفسه.
--
--      ⚠️ **وبتسيب الصورة على Cloudinary يتيمة.** التنظيف بيتعمل
--         من شاشة الصور في الإدارة زي باقي الصور — مافيش حذف
--         تلقائي من هنا، لأن نفس الرابط ممكن يكون مستعملًا في
--         مكان تاني.
DROP POLICY IF EXISTS "Instructor removes own media" ON public.instructor_media;
CREATE POLICY "Instructor removes own media"
  ON public.instructor_media FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.instructors i
             WHERE i.id = instructor_media.instructor_id
               AND i.user_id = auth.uid())
  );

-- (و) الإدارة: كل حاجة.
DROP POLICY IF EXISTS "Admins manage media" ON public.instructor_media;
CREATE POLICY "Admins manage media"
  ON public.instructor_media FOR ALL
  TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- ⚠️ Supabase بيمنح `anon` صلاحيات واسعة على أي جدول جديد
--    تلقائيًّا (مصيدة ملف 82). بنسحب الكل، وبنرجّع **القراءة
--    وحدها** — لأن المعرض لازم يبان للزائر.
REVOKE ALL ON public.instructor_media FROM anon;
GRANT SELECT ON public.instructor_media TO anon;

-- ══ ٤) توسيع حارس المدرب ═══════════════════════════════════
--
-- ⚠️ **التوقيع زيّ ما هو بالحرف** — `CREATE OR REPLACE` بتوقيع
--    مختلف **بتضيف نسخة تانية ومابتستبدلش** (مصيدة «س»، واللي
--    أوقع الحجز على الإنتاج في ملف 86).
--
-- والجديد: أربعة أسطر بتجمّد `display_name` و`bio` و`specialties`
-- و`years_experience`. بعد كده الطريق الوحيد لتعديلهم هو
-- `profile_update_requests` — **وده اللي الشاشة بتعمله أصلًا**.
CREATE OR REPLACE FUNCTION public.guard_instructor_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- auth.uid() بتبقى فاضية في حالتين: طلب مجهول (وده بترفضه الصلاحيات
  -- قبل ما يوصل هنا)، أو مفتاح الخدمة اللي الإدارة بتستخدمه. والإداري
  -- مسموح له صراحة. غير كده: الأعمدة الإدارية بترجع زي ما كانت.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.user_id                    := OLD.user_id;
  NEW.status                     := OLD.status;
  NEW.training_passed            := OLD.training_passed;
  NEW.selected_pricing_option_id := OLD.selected_pricing_option_id;
  NEW.weekly_schedule            := OLD.weekly_schedule;
  NEW.is_sample                  := OLD.is_sample;

  -- ⚠️ الأربعة دول اتضافوا في ملف 127. كانوا مفتوحين للمدرب
  --    يكتبهم مباشرةً بينما الشاشة بتبعت طلب موافقة — يعني
  --    الموافقة كانت اختيارية لمن يعرف. الطريق الوحيد دلوقتي هو
  --    جدول الطلبات، وهو اللي الشاشة بتستعمله أصلًا.
  NEW.display_name               := OLD.display_name;
  NEW.bio                        := OLD.bio;
  NEW.specialties                := OLD.specialties;
  NEW.years_experience           := OLD.years_experience;

  -- ملاحظة: أعمدة التسعير اتنقلت لجدول `instructor_pricing`
  -- (ملف 122) واتشالت من هنا في ملف 123. الحماية بقت في سياسة
  -- الكتابة هناك — وهي أقوى من الحارس ده: الحارس بيرجّع القيمة
  -- القديمة في صمت، والسياسة بترفض الكتابة من أصلها.
  --
  -- والأسماء مش مكتوبة هنا عن قصد: أي فحص بيدوّر عليها في نصّ
  -- الدالة كان بيلاقيها في التعليق ويطلّع إنذارًا كاذبًا.

  RETURN NEW;
END
$function$;

COMMIT;

-- ============================================================
-- استعلام التأكيد — واحد
-- ============================================================
SELECT البند, التفاصيل, الحالة FROM (

  SELECT
    'جدول instructor_media'::text AS البند,
    (SELECT count(*)::text FROM information_schema.columns
      WHERE table_schema='public' AND table_name='instructor_media')::text AS التفاصيل,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
                       WHERE table_schema='public' AND table_name='instructor_media')
         THEN '✅ اتعمل (عدد الأعمدة)' ELSE '🔴 مش موجود' END AS الحالة

  UNION ALL

  SELECT 'سياسة: ' || p.policyname,
         p.cmd || '  ·  ' || COALESCE(p.qual, p.with_check, '—'),
         '✅ اتعملت'
  FROM pg_policies p
  WHERE p.schemaname='public' AND p.tablename='instructor_media'

  UNION ALL

  SELECT 'الزائر يقرا المعتمَد؟',
         CASE WHEN has_table_privilege('anon','public.instructor_media','SELECT')
              THEN 'أيوه' ELSE 'لأ' END,
         CASE WHEN has_table_privilege('anon','public.instructor_media','SELECT')
              THEN '✅ لازم — دي صفحة عامة' ELSE '🔴 المعرض هيبان فاضيًا للزائر' END

  UNION ALL

  SELECT 'الزائر يكتب؟',
         CASE WHEN has_table_privilege('anon','public.instructor_media','INSERT')
               OR has_table_privilege('anon','public.instructor_media','UPDATE')
              THEN 'أيوه' ELSE 'لأ' END,
         CASE WHEN has_table_privilege('anon','public.instructor_media','INSERT')
               OR has_table_privilege('anon','public.instructor_media','UPDATE')
              THEN '🔴 اسحبها' ELSE '✅ مسحوبة' END

  UNION ALL

  -- ⚠️ الفحص على **الإسناد** لا على الاسم — درس ملف 124: ذكر
  --    الاسم في تعليق بيطلّع إنذارًا كاذبًا.
  SELECT 'الحارس بيجمّد النبذة والاسم؟',
         CASE WHEN pr.prosrc ~ 'NEW\.(bio|display_name|specialties|years_experience)\s*:='
              THEN 'أيوه' ELSE 'لأ' END,
         CASE WHEN pr.prosrc ~ 'NEW\.bio\s*:=' AND pr.prosrc ~ 'NEW\.display_name\s*:='
               AND pr.prosrc ~ 'NEW\.specialties\s*:=' AND pr.prosrc ~ 'NEW\.years_experience\s*:='
              THEN '✅ الأربعة مجمَّدين — الموافقة بقت إجبارية'
              ELSE '🔴 ناقص — الموافقة لسه اختيارية' END
  FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace
  WHERE n.nspname='public' AND pr.prokind='f' AND pr.proname='guard_instructor_fields'

  UNION ALL

  SELECT 'نسخ guard_instructor_fields',
         (SELECT count(*)::text FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace
           WHERE n.nspname='public' AND pr.proname='guard_instructor_fields'),
         CASE WHEN (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace
                     WHERE n.nspname='public' AND pr.proname='guard_instructor_fields') = 1
              THEN '✅ واحدة' ELSE '🔴 أكتر من نسخة (مصيدة س)' END

  UNION ALL

  SELECT 'محفّز الصور شغّال؟',
         COALESCE((SELECT tgname FROM pg_trigger
                    WHERE tgrelid='public.instructor_media'::regclass
                      AND NOT tgisinternal LIMIT 1), 'مفيش'),
         CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                            WHERE tgrelid='public.instructor_media'::regclass AND NOT tgisinternal)
              THEN '✅ موجود' ELSE '🔴 تغيير الصورة مش هيرجّع الحالة pending' END

  UNION ALL

  SELECT 'قيد الغلاف الواحد',
         COALESCE((SELECT indexname FROM pg_indexes
                    WHERE schemaname='public' AND tablename='instructor_media'
                      AND indexname='instructor_media_one_cover'), 'مفيش'),
         CASE WHEN EXISTS (SELECT 1 FROM pg_indexes
                            WHERE schemaname='public' AND tablename='instructor_media'
                              AND indexname='instructor_media_one_cover')
              THEN '✅ غلاف معتمد واحد لكل مدرب' ELSE '🔴 ممكن غلافان' END

) t ORDER BY البند;

-- ============================================================
-- التراجع — معلَّق عن قصد.
--
-- ⚠️ حذف الجدول **بيضيّع الصور المرفوعة** (الروابط، مش الملفات —
--    دي بتفضل على Cloudinary). والحارس بيرجع لنسخته القديمة.
-- ============================================================
-- BEGIN;
--   DROP TABLE IF EXISTS public.instructor_media;
--   DROP FUNCTION IF EXISTS public.guard_instructor_media();
--   -- والحارس القديم بأربعة أسطر أقل:
--   CREATE OR REPLACE FUNCTION public.guard_instructor_fields()
--    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
--   AS $function$
--   BEGIN
--     IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;
--     NEW.user_id                    := OLD.user_id;
--     NEW.status                     := OLD.status;
--     NEW.training_passed            := OLD.training_passed;
--     NEW.selected_pricing_option_id := OLD.selected_pricing_option_id;
--     NEW.weekly_schedule            := OLD.weekly_schedule;
--     NEW.is_sample                  := OLD.is_sample;
--     RETURN NEW;
--   END
--   $function$;
-- COMMIT;
