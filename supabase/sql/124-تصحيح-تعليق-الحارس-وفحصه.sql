-- ============================================================
-- 124 — تصحيح تعليق الحارس، وفحصه بالطريقة الصح
-- ============================================================
--
-- ⚠️ **الملف ده بيصلّح غلطة في ملف 123 — في التعليق وفي الفحص،
--    مش في السلوك.**
--
-- ── إيه اللي حصل ────────────────────────────────────────────
--
-- تأكيد 123 رجّع:
--
--     الحارس لسه بيشاور على المحذوف؟ → أيوه
--     🔴 أول تعديل على مدرب هيقع — نادِني
--
-- **وده إنذار كاذب.** الفحص كان بيدوّر على **اسم العمود** في نصّ
-- الدالة:
--
--     pr.prosrc LIKE '%approved_price%'
--
-- وأنا كاتب جوّه الدالة تعليقًا بيقول «اتشال من هنا:
-- `approved_price` و…». **والتعليق جزء من `prosrc`** — فالفحص لقى
-- الاسم وقال إنه لسه مستعملًا.
--
-- ⚠️ **والغلطة في الفحص أخطر من الغلطة في التعليق**: فحص بيدّي
--    إنذارًا كاذبًا بيتعلّم الناس يتجاهلوه، وبعدين يدّي إنذارًا
--    حقيقيًّا فيتجاهلوه برضه.
--
-- ── واللي بيتعمل هنا حاجتان ─────────────────────────────────
--
-- **①** الدالة بتتكتب من جديد **بتعليق مافيهوش أسماء الأعمدة
--     حرفيًّا** — عشان أي فحص لاحق (منّي أو من غيري) ما يقعش في
--     نفس الإنذار الكاذب.
--
-- **②** الفحص بيدوّر على **الإسناد** `NEW.<عمود> :=` لا على الاسم
--     المجرّد. الإسناد هو اللي بيوقع، لا ذكر الاسم.
--
-- ⚠️ **ومفيش تغيير في السلوك.** المنطق حرفًا بحرف زيّ 123؛ اللي
--    بيتغيّر نصّ تعليق.
-- ============================================================

BEGIN;

-- ⚠️ التوقيع زيّ ما هو بالحرف — `CREATE OR REPLACE` بتوقيع مختلف
--    **بتضيف نسخة تانية ومابتستبدلش** (مصيدة «س»).
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
-- استعلام التأكيد — واحد، وبالطريقة الصح
-- ============================================================
SELECT البند, التفاصيل, الحالة FROM (

  -- ⚠️ **الفحص على الإسناد لا على الاسم.** `NEW.<عمود> :=` هو
  --    اللي بيقع عند التنفيذ؛ ذكر الاسم في تعليق مابيعملش حاجة.
  SELECT
    'الحارس بيسند لعمود محذوف؟'::text AS البند,
    CASE WHEN pr.prosrc ~ 'NEW\.(approved_price|requested_price|monthly_hours_committed)\s*:='
         THEN 'أيوه' ELSE 'لأ' END::text AS التفاصيل,
    CASE WHEN pr.prosrc ~ 'NEW\.(approved_price|requested_price|monthly_hours_committed)\s*:='
         THEN '🔴 أول تعديل على مدرب هيقع — نادِني'
         ELSE '✅ نضيف' END AS الحالة
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname='public' AND pr.prokind='f'
    AND pr.proname = 'guard_instructor_fields'

  UNION ALL

  -- وللعلم: الاسم لسه مذكور في نصّ الدالة أصلًا؟ المفروض لأ بعد
  -- الملف ده — عشان الفحوصات اللاحقة ما تقعش في نفس الإنذار.
  SELECT
    'اسم العمود مذكور في النصّ؟',
    CASE WHEN pr.prosrc LIKE '%approved_price%'
           OR pr.prosrc LIKE '%requested_price%'
           OR pr.prosrc LIKE '%monthly_hours_committed%'
         THEN 'أيوه' ELSE 'لأ' END,
    CASE WHEN pr.prosrc LIKE '%approved_price%'
           OR pr.prosrc LIKE '%requested_price%'
           OR pr.prosrc LIKE '%monthly_hours_committed%'
         THEN '⚠️ لسه مذكور — الفحوصات اللاحقة هتطلّع إنذارًا كاذبًا'
         ELSE '✅ مش مذكور' END
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname='public' AND pr.prokind='f'
    AND pr.proname = 'guard_instructor_fields'

  UNION ALL

  SELECT
    'نسخ guard_instructor_fields',
    (SELECT count(*)::text FROM pg_proc pr
      JOIN pg_namespace n ON n.oid=pr.pronamespace
     WHERE n.nspname='public' AND pr.proname='guard_instructor_fields'),
    CASE WHEN (SELECT count(*) FROM pg_proc pr
                JOIN pg_namespace n ON n.oid=pr.pronamespace
               WHERE n.nspname='public' AND pr.proname='guard_instructor_fields') = 1
         THEN '✅ واحدة' ELSE '🔴 أكتر من نسخة (مصيدة س)' END

  UNION ALL

  -- ══ ليه مفيش تجربة تعديل حقيقي هنا ═════════════════════
  --
  -- ⚠️ **كتبت تجربة تعديل فعلي على مدرب، وشِلتها — لأنها
  --    مستحيلة تفشل.**
  --
  --    أول سطرين في الحارس:
  --
  --        IF auth.uid() IS NULL OR public.is_admin() THEN
  --          RETURN NEW;
  --
  --    وإنت بتشغّل ده **كإداري**. يعني الحارس بيخرج من أول سطر
  --    **قبل ما يوصل لأي إسناد** — فالتجربة هتنجح حتى لو الأسطر
  --    المكسورة لسه مكانها.
  --
  --    واختبار مايقدرش يفشل أوحش من مفيش اختبار: بيدّي ثقة
  --    مالهاش أساس.
  --
  --    فالفحص النصّي فوق (على الإسناد لا على الاسم) هو الدليل
  --    المتاح. والمسار المكسور بيتنفّذ لمدرب بيعدّل ملفه بنفسه.
  SELECT
    'تجربة تعديل حقيقي',
    'مش ممكنة من حساب إداري',
    '⬅️ الحارس بيخرج من أول سطر للإداري — اقرا التعليق'

) t ORDER BY البند;
