-- ============================================================
-- 15 — صورة المدرب الشخصية بتعدّي على المراجعة
-- ============================================================
--
-- ── ليه (قرار تامر) ─────────────────────────────────────────
--
-- كل حاجة المدرب بيرفعها (الغلاف، صور الأعمال، النبذة…) بتستنى الإدارة
-- تعتمدها قبل ما تظهر للأهالي — **ماعدا الصورة الشخصية**: كانت متخزّنة
-- في حساب المستخدم نفسه (`user_profiles.avatar_url`)، فالمدرب المفعّل لو
-- غيّرها كانت بتظهر على الموقع فورًا من غير ما حد يشوفها.
--
-- ── إزاي بيشتغل ─────────────────────────────────────────────
--
-- • المدرب المفعّل (أو الموقوف) لما يغيّر صورته، الصورة الجديدة بتروح
--   في نفس «طلب تعديل الملف» اللي النبذة بتروح فيه، والقديمة بتفضل
--   ظاهرة لحد ما الإدارة تعتمد (ده من الموقع).
-- • الملف ده **بيقفل الطريق المباشر من القاعدة**: لو حد حاول يغيّر صورة
--   مدرب مفعّل من حسابه هو (من غير الموقع)، القاعدة بترفض برسالة واضحة.
--   الإدارة والسيرفر بيعدّوا عادي (هما اللي بيطبّقوا الصورة بعد الاعتماد).
-- • المدرب الجديد اللي لسه ماتفعّلش بيحط صورته عادي — مش ظاهر للأهالي
--   أصلًا، والإدارة بتشوف الصورة وهي بتراجع ملفه الأول.
--
-- ⚠️ **مفيش جداول جديدة ولا مسح لأي بيانات** — حارس واحد (محفّز) بس.
--
-- ── التشغيل ──────────────────────────────────────────────────
--
-- بعد ملف 14. في SQL Editor → Run. ولو اتشغّل تاني بيقف من أوله.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_instructor_avatar_trg') THEN
    RAISE EXCEPTION 'الملف ده اتشغّل قبل كده — مفيش حاجة محتاجة تتعمل.';
  END IF;
  IF to_regclass('public.work_tasks') IS NULL THEN
    RAISE EXCEPTION 'شغّل ملف 14 الأول.';
  END IF;
END
$$;

CREATE FUNCTION public.guard_instructor_avatar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.avatar_url IS NOT DISTINCT FROM OLD.avatar_url THEN
    RETURN NEW;
  END IF;

  -- auth.uid() فاضي = السيرفر (service role). والإدارة هي اللي بتطبّق
  -- الصورة بعد ما تعتمدها.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.instructors i
     WHERE i.user_id = NEW.id
       AND i.status IN ('active', 'suspended')
  ) THEN
    RAISE EXCEPTION 'صورة المدرب بتتغيّر بعد مراجعة الإدارة — ابعتها من «ملفي وصوري».'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.guard_instructor_avatar FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_instructor_avatar TO public;

CREATE TRIGGER guard_instructor_avatar_trg
  BEFORE UPDATE OF avatar_url ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_instructor_avatar();

COMMIT;

-- ── التأكيد ──────────────────────────────────────────────────
SELECT 'حارس صورة المدرب' AS "البند",
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_instructor_avatar_trg')
            THEN '✓' ELSE '✗' END AS "الحالة"
UNION ALL
SELECT 'للمعلومة: مدربين مفعّلين صورتهم هتتراجع من دلوقتي',
       (SELECT count(*)::text FROM public.instructors WHERE status IN ('active', 'suspended'));
