-- ============================================================================
-- قائمة المتدربين: المدفوع والمعتمد بس
-- ============================================================================
-- الملاحظة  : (من فريق العمل، ١٦ أكتوبر)
--             ١) نفس الباقة لنفس المشارك بتتكرر عدة مرات في ملف المدرب.
--             ٢) «رحلة الشرارة الأولى» لـSuha Saleh **ماتدفعتش ولا الإدارة
--                وافقت عليها** — فازاي ظاهرة للمدرب؟
--
-- السبب    : `instructor_students` **مافيهاش ولا فلتر على الحالة**، وبتربط
--            المدرب بالاشتراك بشرطين، أولهم:
--
--                i.id = cs.preferred_instructor_id
--
--            و`preferred_instructor_id` ده **اختيار ولي الأمر في المعالج
--            قبل ما يدفع** — رغبة، مش تكليف. فأول ما حد يبدأ حجز ويختار
--            مدربًا، المدرب بيشوف الطالب في قايمته على طول: الحجز لسه
--            `pending`، مفيش فلوس اتدفعت، والإدارة ماشافتهوش.
--
--            ودي كمان **سبب التكرار**: الدالة بترجّع صفًّا لكل اشتراك،
--            فكل محاولة حجز ناقصة أو متروكة بتفضل صفًّا دايمًا في
--            القايمة. (أربع محاولات تجريبية = أربع صفوف لنفس الشخص.)
--
-- الأثر    : المدرب بيشوف الاشتراكات `active` و`completed` بس — يعني
--            اللي الدفع فيها اتأكد والإدارة فعّلتها. و`pending`
--            و`awaiting_verification` و`cancelled` مابقوش يظهروا.
--
--            ⚠️ **ومفيش بيانات بتتمسح**: الاشتراكات زيّ ما هي، وبتفضل
--               ظاهرة للإدارة وللعميل. اللي اتغيّر إن المدرب مابقاش
--               يشوفها قبل أوانها.
--
--            ⚠️ **وشرط «المدرب المفضّل» فاضل** — بس للمدفوع. ده بيخلّي
--               المدرب يشوف طالبه الجديد حتى لو الجلسات لسه ما اتولّدتش،
--               وهي الحالة اللي العمود ده أصلًا موجود عشانها.
--
-- مش متأثر : `instructor_teaches` (اللي صلاحيات القاعدة بتعتمد عليها
--            لمستندات الطالب ومعرض أعماله) **مابتتلمسش**: هي بتطلب وجود
--            **جلسة فعلية** مسندة للمدرب، والجلسات مابتتعملش غير بعد
--            تأكيد الدفع. فمفيش تسريب من ناحيتها أصلًا.
--
-- التحقق   : آخر الملف — قراءة بس، بيعدّ اللي كان بيظهر غلط.
--
-- الرجوع   : شيل سطر الـ`WHERE` من الدالة.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.instructor_students()
 RETURNS TABLE(subscription_id text, user_ref text, child_ref text, documents_ref text, participant_name text, package_name text, sessions_total integer, sessions_completed integer, subscription_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    cs.id::text,
    cs.user_id::text,
    ch.id::text,
    COALESCE(
      NULLIF(btrim(coalesce(ch.account_profile_id, '')), ''),
      cs.user_id::text
    ),
    COALESCE(ch.full_name, up.full_name, 'مشارك غير معروف'),
    COALESCE(p.name, 'باقة محذوفة'),
    -- عدد جلسات الباقة هو المرجع. لو لسه ما اتولّدتش، التقدم بيبقى
    -- «0 / 12» بدل ما الطالب يختفي من القايمة.
    COALESCE(p.sessions_count, count(s.id))::integer,
    count(s.id) FILTER (WHERE s.status = 'completed')::integer,
    cs.status::text
  FROM course_subscriptions cs
  JOIN instructors i
    ON i.user_id = auth.uid()
   AND (
        i.id = cs.preferred_instructor_id
        OR EXISTS (
          SELECT 1 FROM sessions s2
          WHERE s2.course_subscription_id = cs.id
            AND s2.instructor_id = i.id
        )
       )
  LEFT JOIN sessions s
    ON s.course_subscription_id = cs.id
   AND s.instructor_id = i.id
  LEFT JOIN child_profiles ch           ON ch.id = cs.child_id
  LEFT JOIN user_profiles up            ON up.id = cs.user_id
  LEFT JOIN creative_writing_packages p ON p.id = cs.package_id
  -- ⚠️ **السطر ده هو الإصلاح كله.**
  --
  --    من غيره، «المدرب المفضّل» وحده بيكفي عشان الطالب يظهر — وهو
  --    اختيار بيحصل في المعالج **قبل الدفع**. فحجز اتبدأ واتساب
  --    بيفضل في قايمة المدرب للأبد.
  --
  --    `active` = الدفع اتأكد والإدارة فعّلت، و`completed` = خلص.
  --    وغير دول (`pending`, `awaiting_verification`, `cancelled`)
  --    مالهمش مكان عند المدرب.
  WHERE cs.status::text IN ('active', 'completed')
  GROUP BY cs.id, cs.user_id, cs.status, ch.id, ch.full_name,
           ch.account_profile_id, up.full_name, p.name, p.sessions_count;
$function$;

REVOKE ALL ON FUNCTION public.instructor_students FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.instructor_students TO authenticated;


-- ============================================================================
-- التحقق — قراءة بس
-- ============================================================================
-- إيه اللي كان بيظهر للمدربين غلط، وإيه اللي هيفضل:
--
--   select cs.status,
--          count(*) as "عدد الاشتراكات",
--          count(*) filter (where cs.preferred_instructor_id is not null)
--            as "منها بمدرب مفضّل",
--          case when cs.status in ('active','completed')
--               then 'بيظهر للمدرب ✅' else 'مابقاش يظهر' end as "بعد الإصلاح"
--     from course_subscriptions cs
--    group by cs.status
--    order by cs.status;
--
-- والتكرار الحقيقي الباقي (نفس المشارك + نفس الباقة، أكتر من اشتراك
-- مدفوع) — لو ظهر حاجة هنا يبقى محتاج مراجعة إدارية مش إصلاح كود:
--
--   select cs.user_id, cs.child_id, cs.package_id, count(*)
--     from course_subscriptions cs
--    where cs.status in ('active','completed')
--    group by cs.user_id, cs.child_id, cs.package_id
--   having count(*) > 1;
-- ============================================================================
