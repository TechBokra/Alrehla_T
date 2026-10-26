-- ============================================================================
-- `delete_instructor` — معرّفاتها `text`، مش `uuid`
-- ============================================================================
-- العطل   : كل ضغطة على «حذف المدرب» بترجّع
--             42883: operator does not exist: text = uuid
--           والإدارة بتشوف «تعذّر حذف المدرب» من غير أي سبب. يعني الدالة
--           **ماشتغلتش ولا مرة** من يوم ما اتشحنت (20261015110000).
--
-- السبب   : كتبتها `p_instructor_id uuid`. والحقيقة إن **التسع أعمدة**
--           اللي بتقارن بيها `text`:
--
--             instructors.id                      text
--             sessions.instructor_id              text
--             session_reports.instructor_id       text
--             service_orders.instructor_id        text
--             service_providers.instructor_id     text
--             instructor_payouts.instructor_id    text
--             withdrawal_requests.instructor_id   text
--             dependent_requests.instructor_id    text
--             profile_update_requests.instructor_id text
--
--           فالمقارنة الأولى نفسها (`where id = p_instructor_id`) كانت
--           بترمي قبل ما الحارس يشتغل أصلًا.
--
-- ⚠️ **ودي تاني مرة في يومين.** نفس العائلة بالظبط ضربت الدفع امبارح
--    (`20261015170000_cw_gateway_text_ids`): `service_orders.id` و
--    `course_subscriptions.id` طلعوا `text` وأنا معرّف `p_id uuid`.
--    القاعدة دي **مخلوطة**: `orders.id` فعلًا `uuid` (و`cancel_my_order`
--    شغّالة بيه صح)، وأغلب الباقي `text`. فالافتراض ممنوع — النوع
--    **يتشاف** قبل ما أي دالة جديدة تتكتب.
--
-- الحل    : الدالة تتعاد بـ`p_instructor_id text`، وكل مقارنة بـ`::text`
--           على العمود. الكاست هنا مش تجميل: `instructors.user_id` و
--           `user_profiles.id` ممكن يكونوا نوعين مختلفين كمان، والمقارنة
--           كنص بتشتغل في الحالتين.
--
-- ⚠️ **لازم `drop` الأول.** `create or replace` بنوع مختلف **بتعمل دالة
--    تانية** جنب القديمة (تحميل زائد)، والنداء من PostgREST بنص بيبقى
--    غامض بين الاتنين فيفشل. فالقديمة بتتشال.
--
-- الأثر   : دالة واحدة. مفيش جدول بيتغيّر، ومفيش صلاحية بتتوسّع — نفس
--           `is_admin()` ونفس الحارس ونفس المنع عن `anon`.
--
-- ⚠️ **والحارس لسه بيرفض.** الإصلاح ده بيخلّي الدالة تشتغل، مش بيخلّي
--    الحذف يعدّي: مدرب عنده جلسة أو مستحق لسه مرفوض — بس دلوقتي
--    **بالسبب** («٣ جلسات، ١ مستحق») بدل رسالة صامتة.
--
-- التحقق  : آخر الملف — قراءة بس، بيقول كل مدرب ينفع يتحذف ولا لأ وليه.
--
-- الرجوع  : drop function public.delete_instructor(text);
-- ============================================================================

drop function if exists public.delete_instructor(uuid);
drop function if exists public.delete_instructor(text);

create function public.delete_instructor(p_instructor_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text;
  v_user     text;
  v_blockers text[] := '{}';
  v_n        bigint;
  v_role     text;
begin
  if auth.uid() is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'denied');
  end if;

  select display_name, user_id::text
    into v_name, v_user
    from instructors
   where id::text = p_instructor_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- ── الحارس: أي سجل = مفيش حذف ──────────────────────────────
  -- المفاتيح الأجنبية بتمسح لوحدها وبشكل مدمّر: المستحقات وطلبات
  -- السحب وتقارير الجلسات CASCADE، والجلسات وطلبات الخدمة SET NULL.
  select count(*) into v_n from sessions where instructor_id::text = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s جلسة', v_n); end if;

  select count(*) into v_n from session_reports where instructor_id::text = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s تقرير جلسة', v_n); end if;

  select count(*) into v_n from service_orders where instructor_id::text = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s طلب خدمة', v_n); end if;

  -- طلبات واصلة لصف «مقدّم الخدمة» بتاعه — الصف ده CASCADE، فالطلبات
  -- دي كانت هتتوهّ.
  select count(*) into v_n
    from service_orders
   where provider_id::text in (
     select id::text from service_providers where instructor_id::text = p_instructor_id
   );
  if v_n > 0 then v_blockers := v_blockers || format('%s طلب على حسابه كمقدّم خدمة', v_n); end if;

  select count(*) into v_n from instructor_payouts where instructor_id::text = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s مستحق مالي', v_n); end if;

  select count(*) into v_n from withdrawal_requests where instructor_id::text = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s طلب سحب', v_n); end if;

  select count(*) into v_n from dependent_requests where instructor_id::text = p_instructor_id;
  if v_n > 0 then v_blockers := v_blockers || format('%s طلب متابعة', v_n); end if;

  if array_length(v_blockers, 1) > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'has_history',
      'blockers', to_jsonb(v_blockers)
    );
  end if;

  -- ── الحذف ──────────────────────────────────────────────────
  -- مالوش مفتاح أجنبي على `instructors`، فلازم بالإيد وقبل الصف الأصلي.
  delete from profile_update_requests where instructor_id::text = p_instructor_id;

  delete from instructors where id::text = p_instructor_id;

  -- ⚠️ **التأكد إن الصف اتمسح فعلًا.** سياسة أو trigger ممكن يرفض في
  --    صمت، والنجاح الكاذب أسوأ من الفشل: الإدارة تقول «اتمسح» والمدرب
  --    لسه في القايمة.
  if exists (select 1 from instructors where id::text = p_instructor_id) then
    return jsonb_build_object('ok', false, 'error', 'blocked');
  end if;

  -- ── الحساب بيرجع عميل، مش بيتمسح ───────────────────────────
  if v_user is not null then
    update user_profiles
       set role = 'customer', updated_at = now()
     where id::text = v_user
       and role = 'instructor';

    select role::text into v_role from user_profiles where id::text = v_user;
  end if;

  return jsonb_build_object(
    'ok', true,
    'name', v_name,
    'userId', v_user,
    -- لو الدور فضل «مدرب»، المدرب اتمسح بس الحساب محتاج تدخّل يدوي —
    -- والإدارة لازم تعرف بده.
    'accountRole', coalesce(v_role, 'none')
  );
end
$$;

revoke all on function public.delete_instructor(text) from public, anon;
grant execute on function public.delete_instructor(text) to authenticated;

comment on function public.delete_instructor(text) is
  'حذف مدرب مالوش أي سجل (جلسات، طلبات، مستحقات). بيرجّع ok=false مع قايمة الأسباب لو عنده سجل. الحساب بيرجع «عميل» ومابيتمسحش. المعرّف text — كل أعمدة instructor_id في القاعدة text.';


-- ============================================================================
-- التحقق (١) — الدالة بقت بنوع واحد صح
-- ============================================================================
--   select p.oid::regprocedure as "الدالة"
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'delete_instructor';
--
-- المتوقع: **سطر واحد بس** — `delete_instructor(text)`.
-- لو ظهر سطرين، النداء هيفشل بالغموض — شيل اللي بـuuid.

-- ============================================================================
-- التحقق (٢) — مين ينفع يتحذف؟ قراءة بس، مابيحذف ولا صف
-- ============================================================================
--   select i.display_name as "المدرب",
--          case when (
--            (select count(*) from sessions            s where s.instructor_id::text = i.id::text)
--          + (select count(*) from session_reports     r where r.instructor_id::text = i.id::text)
--          + (select count(*) from service_orders      o where o.instructor_id::text = i.id::text)
--          + (select count(*) from instructor_payouts  y where y.instructor_id::text = i.id::text)
--          + (select count(*) from withdrawal_requests w where w.instructor_id::text = i.id::text)
--          + (select count(*) from dependent_requests  d where d.instructor_id::text = i.id::text)
--          ) = 0 then '✅ ينفع يتحذف' else '⚠️ عنده سجل — إيقاف بس' end as "الحكم"
--     from instructors i
--    order by i.display_name;
-- ============================================================================
