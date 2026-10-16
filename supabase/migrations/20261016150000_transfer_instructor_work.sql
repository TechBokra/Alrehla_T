-- ============================================================================
-- نقل شغل مدرب لمدرب تاني
-- ============================================================================
-- الحاجة  : لما الإدارة توقف مدربًا أو تخفيه، شغله الجاري بيفضل معلّق
--           عليه: جلسات محجوزة لأهالي دافعين، ومهام مفتوحة، وطلبات
--           خدمة. ومفيش أي طريق في الموقع كله ينقل جلسة من مدرب لمدرب
--           — `updateSessionDetails` بتغيّر الرابط والموعد وبس.
--
--           فالإيقاف كان بيسيب العميل بلا مدرب، وهو دافع.
--
-- ── الحارس: إيه اللي **مايتنقلش** ───────────────────────────
--
-- ⚠️ **الجلسات المكتملة مابتتحركش.** مستحق المدرب بيتسجّل وقت كتابة
--    تقرير الجلسة (`record_session_earning`) بسعر **اللي كتبه**. فنقل
--    جلسة مكتملة معناه إن الفلوس اتسجّلت لواحد والجلسة بقت باسم
--    التاني — تاريخ مالي مكسور.
--
--    والجلسات الجاية (`pending`/`scheduled`/`confirmed`) نضيفة تمامًا:
--    مفيش مستحق اتسجّل لها لسه، والمدرب الجديد ياخدها بسعره هو.
--
-- ⚠️ **وطلب الخدمة اللي اتسجّل له مستحق مابيتنقلش** — بيترجع في
--    `blocked` عشان الإدارة تتصرّف فيه بإيدها. `instructor_earning`
--    متخزّن على الصف، ونقله بعد تسجيل المستحق بيخلّي الفلوس عند واحد
--    والشغل عند التاني. دي نفس فلسفة `delete_instructor`: **نرفض
--    بالسبب، مش ننفّذ ونسيب خراب**.
--
-- ⚠️ **والمنقول له لازم يكون `active`.** نقل الشغل لمدرب مخفي أو موقوف
--    بينقل المشكلة مش بيحلّها.
--
-- ── الأنواع (متشافت، مش متخمّنة) ────────────────────────────
--
--   instructors.id            text    | instructors.user_id  uuid
--   sessions.instructor_id    text
--   service_orders.instructor_id text
--   work_tasks.assignee_ids   uuid[]  ← **ملفات مستخدمين، لا مدربين**
--
-- عشان كده المهام بتتنقل بـ`user_id` لا بـ`instructor_id`.
--
-- الأثر   : دالة واحدة. مفيش جدول بيتغيّر هيكله، ومفيش صلاحية بتتوسّع
--           (`is_admin()` شرط، و`anon` ممنوع).
--
-- التحقق  : الدالة **بتعدّ بعد النقل** وبترجّع اللي فضل. والملف تحته
--           فيه تجربة جوّه معاملة بتتلغي.
--
-- الرجوع  : drop function public.transfer_instructor_work(text, text);
-- ============================================================================

create or replace function public.transfer_instructor_work(p_from text, p_to text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_uid   uuid;
  v_to_uid     uuid;
  v_to_status  text;
  v_from_name  text;
  v_to_name    text;
  v_sessions   integer := 0;
  v_tasks      integer := 0;
  v_orders     integer := 0;
  v_blocked    jsonb;
  v_left       integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'denied');
  end if;

  if p_from is null or p_to is null or p_from = p_to then
    return jsonb_build_object('ok', false, 'error', 'same_instructor');
  end if;

  select user_id, display_name into v_from_uid, v_from_name
    from instructors where id::text = p_from;
  if v_from_uid is null then
    return jsonb_build_object('ok', false, 'error', 'from_not_found');
  end if;

  select user_id, display_name, status::text into v_to_uid, v_to_name, v_to_status
    from instructors where id::text = p_to;
  if v_to_uid is null then
    return jsonb_build_object('ok', false, 'error', 'to_not_found');
  end if;

  if v_to_status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'to_not_active', 'status', v_to_status);
  end if;

  -- ── ① الجلسات الجاية ──────────────────────────────────────
  update sessions
     set instructor_id = p_to,
         updated_at    = now()
   where instructor_id::text = p_from
     and status in ('pending', 'scheduled', 'confirmed');
  get diagnostics v_sessions = row_count;

  -- ── ② المهام المفتوحة ─────────────────────────────────────
  -- ⚠️ `array_replace` لوحدها بتكرّر المنقول له لو كان مسنودًا للمهمة
  --    أصلًا — فالتوزيع يبقى فيه نفس الشخص مرتين. التفكيك والتجميع
  --    بـ`distinct` بيمنع ده.
  update work_tasks
     set assignee_ids = (
           select array_agg(distinct x)
             from unnest(array_replace(assignee_ids, v_from_uid, v_to_uid)) x
         )
   where status = 'open'
     and v_from_uid = any(assignee_ids);
  get diagnostics v_tasks = row_count;

  -- ── ③ طلبات الخدمة اللي لسه مالهاش مستحق ──────────────────
  update service_orders o
     set instructor_id = p_to,
         updated_at    = now()
   where o.instructor_id::text = p_from
     and o.status::text in ('pending', 'awaiting_verification', 'paid', 'in_progress')
     and not exists (
       select 1 from instructor_payouts y
        where y.source_type = 'service_order'
          and y.source_id::text = o.id::text
     );
  get diagnostics v_orders = row_count;

  -- ── اللي اترفض، بالسبب ────────────────────────────────────
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'status', o.status::text)), '[]'::jsonb)
    into v_blocked
    from service_orders o
   where o.instructor_id::text = p_from
     and o.status::text in ('pending', 'awaiting_verification', 'paid', 'in_progress')
     and exists (
       select 1 from instructor_payouts y
        where y.source_type = 'service_order'
          and y.source_id::text = o.id::text
     );

  -- ── التحقق: فعلًا فضي؟ ────────────────────────────────────
  --
  -- ⚠️ **بنعدّ بعد النقل، مش بنفترض.** سياسة أو محفّز ممكن يرفض في
  --    صمت، والإدارة تقول «اتنقل» والأهالي يفضلوا على مدرب موقوف.
  select count(*) into v_left
    from sessions
   where instructor_id::text = p_from
     and status in ('pending', 'scheduled', 'confirmed');

  return jsonb_build_object(
    'ok', true,
    'fromName',          v_from_name,
    'toName',            v_to_name,
    'toUserId',          v_to_uid,
    'fromUserId',        v_from_uid,
    'sessions',          v_sessions,
    'tasks',             v_tasks,
    'serviceOrders',     v_orders,
    'blockedOrders',     v_blocked,
    -- أكبر من صفر = فيه جلسات مانتقلتش. الشاشة بتقولها صريح.
    'sessionsRemaining', v_left
  );
end
$$;

revoke all on function public.transfer_instructor_work(text, text) from public, anon;
grant execute on function public.transfer_instructor_work(text, text) to authenticated;

comment on function public.transfer_instructor_work(text, text) is
  'بينقل الجلسات الجاية والمهام المفتوحة وطلبات الخدمة اللي لسه مالهاش مستحق من مدرب لمدرب active. المكتمل وأي طلب اتسجّل له مستحق مابيتحركش.';


-- ============================================================================
-- تجربة — جوّه معاملة بتتلغي، مفيش صف بيتغيّر
-- ============================================================================
--   begin;
--   do $probe$
--   declare v_from text; v_to text; r jsonb;
--   begin
--     select id into v_from from instructors
--      where exists (select 1 from sessions s
--                     where s.instructor_id::text = instructors.id::text
--                       and s.status in ('pending','scheduled','confirmed'))
--      limit 1;
--     select id into v_to from instructors
--      where status::text = 'active' and id::text <> coalesce(v_from,'') limit 1;
--
--     if v_from is null then raise exception 'RESULT: مفيش مدرب عنده جلسات جاية'; end if;
--     if v_to   is null then raise exception 'RESULT: مفيش مدرب active تاني ننقل له'; end if;
--
--     r := public.transfer_instructor_work(v_from, v_to);
--     raise exception 'RESULT: %', r;
--   end $probe$;
--   rollback;
--
-- المتوقع: `ok: true` و`sessionsRemaining: 0`.
-- ============================================================================
