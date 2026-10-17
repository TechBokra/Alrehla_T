-- ════════════════════════════════════════════════════════════════════
-- اعتماد المدرب: يقراه، ومايكتبوش
-- ════════════════════════════════════════════════════════════════════
--
-- الغرض
-- ─────
-- جدول `instructor_certifications` هو **السجل اللي الإدارة بتقرر منه
-- تفعيل المدرب**: حضر التدريب؟ اجتاز الاختبار؟ بكام؟
--
-- وسياسته كانت `FOR ALL` بشرط «المدرب صاحب الصف أو إداري»، والصلاحيات
-- مفتوحة لـ`authenticated` على INSERT وUPDATE وDELETE. يعني:
--
--     **المدرب كان يقدر يكتب `exam_passed = true` على نفسه.**
--
-- مش بنداء من الشاشة — الشاشة مابتعملش كده — لكن بنداء مباشر على الـAPI
-- بتوكن دخوله العادي (قاعدة «ع»: أي حارس في الشاشة بيتخطّى).
--
-- ── هل كان بيخلّيه يظهر للعملاء؟ **لأ** ─────────────────────
--
-- الظهور شرطه `instructors.status = 'active'`، والعمود ده محميّ
-- بمحفّز `guard_instructor_fields` (بيرجّع `status` و`training_passed`
-- لأي حد مش إداري)، ودالة التفعيل بتقرا `training_passed` من القاعدة.
--
-- **لكن** الإدارة بتقرأ الاعتماد ده وبتفعّل على أساسه. يعني المدرب
-- كان يقدر يزوّر الورقة اللي الإدارة بتوافق بناءً عليها — وده بقى
-- أخطر دلوقتي لأن الشاشة الجديدة بتعرض السجل ده **للمدرب نفسه**
-- كأنه مرجع رسمي. سجل بيشوفه صاحبه لازم يكون صاحبه مش قادر يكتبه.
--
-- الأثر
-- ─────
-- • المدرب: **يقرا** صفّه زي ما كان (الشاشة الجديدة محتاجة ده).
-- • المدرب: مابقاش يكتب ولا يحذف — القاعدة بترفض من أصلها.
-- • الإداري: زي ما هو بالظبط، قراءة وكتابة.
-- • **مفيش أي بيانات بتتغيّر** — سياسات وصلاحيات بس.
--
-- الترتيب
-- ───────
-- مستقلة. بتحتاج `public.is_admin()` و`instructors` (موجودين).
--
-- التحقق بعد التشغيل
-- ─────────────────
--   -- بتوكن مدرب: SELECT بيرجّع صفّه، وUPDATE بيفشل أو صفر صفوف.
--   select policyname, cmd from pg_policies
--    where tablename = 'instructor_certifications';
--   -- المفروض: سياسة SELECT للمدرب والإداري، وسياسة ALL للإداري.
--
-- الرجوع
-- ──────
--   drop policy if exists "instructor reads own certification" on public.instructor_certifications;
--   drop policy if exists "admins manage certifications" on public.instructor_certifications;
--   create policy "Instructor views own certification, admin manages all"
--     on public.instructor_certifications for all
--     using (
--       (exists (select 1 from instructors
--                 where instructors.id = instructor_certifications.instructor_id
--                   and instructors.user_id = auth.uid()))
--       or is_admin()
--     );
--   grant insert, update, delete on public.instructor_certifications to authenticated;
-- ════════════════════════════════════════════════════════════════════

-- ⚠️ الصلاحية الخام أول حاجة: السياسة لوحدها مابتمنعش الكتابة لو
--    الـGRANT موجود والسياسة بتسمح. وشيل الـGRANT بيخلّي الرفض من
--    مستوى الجدول نفسه — أوضح في اللوج وأصعب في الخطأ.
revoke insert, update, delete, truncate on public.instructor_certifications from authenticated;
revoke insert, update, delete, truncate, select on public.instructor_certifications from anon;

-- السياسة القديمة الواحدة اتقسمت لاتنين: قراءة للمدرب، وكل حاجة للإداري.
drop policy if exists "Instructor views own certification, admin manages all" on public.instructor_certifications;

drop policy if exists "instructor reads own certification" on public.instructor_certifications;
create policy "instructor reads own certification" on public.instructor_certifications
  for select
  using (
    exists (
      select 1 from public.instructors
      where instructors.id = instructor_certifications.instructor_id
        and instructors.user_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists "admins manage certifications" on public.instructor_certifications;
create policy "admins manage certifications" on public.instructor_certifications
  for all
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.instructor_certifications is
  'تدريب المدرب واختباره — **الإدارة بتكتب، والمدرب بيقرا صفّه بس**. الظهور للعملاء شرطه instructors.status = active (محميّ بمحفّز).';
