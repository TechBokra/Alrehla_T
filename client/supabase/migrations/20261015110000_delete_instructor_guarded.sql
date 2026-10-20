-- ============================================================================
-- حذف مدرب — بحارس على السجل
-- ============================================================================
-- المشكلة : **مفيش طريقة تحذف مدرب خالص.** `src/actions/` فيها إنشاء
--           وتصفير كلمة مرور وتغيير حالة، ومفيش حذف. فحساب تجريبي زي
--           «مدرب3» بيفضل في القايمة للأبد، والإدارة مالهاش غير «إيقاف».
--
-- الخطر   : المفاتيح الأجنبية على `instructors` بتعمل الحذف لوحدها —
--           وبشكل **مدمّر**:
--             instructor_payouts    → CASCADE  (سجل مالي بيتمسح)
--             withdrawal_requests   → CASCADE  (طلبات سحب بتتمسح)
--             session_reports       → CASCADE  (تقارير جلسات بتتمسح)
--             sessions              → SET NULL (جلسات بتتوهّ بلا مدرب)
--             service_orders        → SET NULL (طلبات بتتوهّ بلا مدرب)
--             dependent_requests    → SET NULL
--           يعني `delete from instructors` على مدرب شغّال **بينجح**
--           وبيضيّع تاريخه وفلوسه في نفس اللحظة.
--
-- الحل    : الحذف بيعدّي **بس** لما المدرب مالوش ولا صف في أي من دول.
--           ومع كل رفض بترجع قايمة بالأسباب بالأرقام («٣ جلسات، ١
--           مستحق») — عشان الإداري يعرف ليه، ويستعمل «إيقاف» بدل الحذف.
--
--           واللي بيتمسح فعلًا وقتها = الصور والباقات والتسعير وصف
--           مقدّم الخدمة (كلهم CASCADE وكلهم فاضيين بحكم الحارس)،
--           زائد `profile_update_requests` بالإيد — **الجدول ده مالوش
--           مفتاح أجنبي على `instructors`**، فصفوفه كانت هتفضل
--           بتشاور على مدرب مش موجود.
--
-- الحساب  : **مابيتمسحش.** بيرجع دوره «عميل» بدل «مدرب». حذف الحساب
--           نفسه حاجة تانية (ممكن يكون نفس الشخص عميل وعنده طلبات) —
--           ده بيتعمل من «المستخدمين» بالأرشفة.
--
-- الأثر   : دالة واحدة جديدة. مفيش جدول بيتغيّر، ومفيش سياسة بتتوسّع:
--           `is_admin()` شرط، و`anon` ممنوع، والحارس بيمنع أي حذف
--           بيضيّع بيانات.
--
-- التحقق  : آخر الملف فيه استعلام **قراءة بس** بيقول كل مدرب ينفع
--           يتحذف ولا لأ، من غير ما يحذف حاجة. شغّله قبل وبعد.
--
-- الرجوع  : drop function public.delete_instructor(uuid);
-- ============================================================================

create or replace function public.delete_instructor(p_instructor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst     record;
  v_blockers text[] := '{}';
  v_n        bigint;
  v_role     text;
begin
  if auth.uid() is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'denied');
  end if;

  select id, display_name, user_id
    into v_inst
    from instructors
   where id = p_instructor_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- ── الحارس: أي سجل = مفيش حذف ──────────────────────────────
  select count(*) into v_n from sessions where instructor_id = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s جلسة', v_n); end if;

  select count(*) into v_n from session_reports where instructor_id = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s تقرير جلسة', v_n); end if;

  select count(*) into v_n from service_orders where instructor_id = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s طلب خدمة', v_n); end if;

  -- طلبات واصلة لصف «مقدّم الخدمة» بتاعه — الصف ده CASCADE، فالطلبات
  -- دي كانت هتتوهّ.
  select count(*) into v_n
    from service_orders
   where provider_id in (select id from service_providers where instructor_id = p_instructor_id);
  if v_n > 0 then v_blockers := v_blockers || format('%s طلب على حسابه كمقدّم خدمة', v_n); end if;

  select count(*) into v_n from instructor_payouts where instructor_id = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s مستحق مالي', v_n); end if;

  select count(*) into v_n from withdrawal_requests where instructor_id = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s طلب سحب', v_n); end if;

  select count(*) into v_n from dependent_requests where instructor_id = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s طلب متابعة', v_n); end if;

  if array_length(v_blockers, 1) > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'has_history',
      'blockers', to_jsonb(v_blockers)
    );
  end if;

  -- ── الحذف ──────────────────────────────────────────────────
  -- مالوش مفتاح أجنبي، فلازم بالإيد وقبل الصف الأصلي.
  delete from profile_update_requests where instructor_id = p_instructor_id;

  delete from instructors where id = p_instructor_id;

  -- ⚠️ **التأكد إن الصف اتمسح فعلًا.** سياسة أو trigger ممكن يرفض في
  --    صمت، والنجاح الكاذب أسوأ من الفشل: الإدارة تقول «اتمسح» والمدرب
  --    لسه في القايمة.
  if exists (select 1 from instructors where id = p_instructor_id) then
    return jsonb_build_object('ok', false, 'error', 'blocked');
  end if;

  -- ── الحساب بيرجع عميل، مش بيتمسح ───────────────────────────
  if v_inst.user_id is not null then
    update user_profiles
       set role = 'customer', updated_at = now()
     where id = v_inst.user_id
       and role = 'instructor';

    select role::text into v_role from user_profiles where id = v_inst.user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'name', v_inst.display_name,
    'userId', v_inst.user_id,
    -- لو الدور فضل «مدرب»، المدرب اتمسح بس الحساب محتاج تدخّل يدوي —
    -- والإدارة لازم تعرف بده.
    'accountRole', coalesce(v_role, 'none')
  );
end
$$;

revoke all on function public.delete_instructor(uuid) from public, anon;
grant execute on function public.delete_instructor(uuid) to authenticated;

comment on function public.delete_instructor(uuid) is
  'حذف مدرب مالوش أي سجل (جلسات، طلبات، مستحقات). بيرجّع ok=false مع قايمة الأسباب لو عنده سجل. الحساب بيرجع «عميل» ومابيتمسحش.';


-- ============================================================================
-- التحقق — قراءة بس، مابيحذف ولا صف
-- ============================================================================
-- شغّل ده بعد الدالة: بيقول كل مدرب ينفع يتحذف ولا لأ وليه.
--
--   select i.display_name,
--          case when (
--            (select count(*) from sessions            s where s.instructor_id = i.id)
--          + (select count(*) from session_reports     r where r.instructor_id = i.id)
--          + (select count(*) from service_orders      o where o.instructor_id = i.id)
--          + (select count(*) from instructor_payouts  y where y.instructor_id = i.id)
--          + (select count(*) from withdrawal_requests w where w.instructor_id = i.id)
--          + (select count(*) from dependent_requests  d where d.instructor_id = i.id)
--          ) = 0 then 'ينفع يتحذف' else 'عنده سجل — إيقاف بس' end as verdict
--     from instructors i
--    order by i.display_name;
-- ============================================================================
