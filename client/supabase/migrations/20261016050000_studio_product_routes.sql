-- ============================================================================
-- تسلسل مراحل الاستوديو لكل نوع منتج.
--
-- كل منتج «قصة مخصّصة» ممكن يبقى له تسلسله: مرحلة من الكتالوج تبقى «إلزامية» أو «اختيارية»
-- أو «غير مستخدمة» للمنتج ده، وممكن يلغي شروط دخول بعينها (مثلًا منتج من غير موافقة العميل).
-- الكتالوج العام (task_steps) هو الأصل؛ المنتج اللي مالوش تخصيص بيمشي على العام زي ما هو.
--
-- 1) studio_product_routes: التخصيصات (الكتابة من الدوال بصلاحية بس).
-- 2) task_effective_steps(line, product): الكتالوج بعد تطبيق تخصيص المنتج.
-- 3) task_next_step / task_skip_target / story_transition_rule بقوا بيقبلوا المنتج (اختياري).
-- 4) story_project_guard بيطبّق شروط المنتج وتسلسله (مشروع المنتج ده بس).
-- 5) studio_route_set / studio_route_reset (بصلاحية canManageStudio).
--
-- آمن لإعادة التشغيل. مابيغيّرش أي مشروع موجود ولا الكتالوج العام. المشروع مايتحرّكش
-- لمرحلة «غير مستخدمة» لمنتجه، والمرحلة اللي فيها مشاريع من منتج ماتتقفلش للمنتج ده.
--
-- الاختبار: supabase/tests/workflow_engine.sql (قسم ١٣).
-- الرجوع (يدويًا): أعِد تعريف الدوال الأربعة من 20261016040000؛ drop table studio_product_routes؛
--   drop function task_effective_steps, studio_route_set, studio_route_reset.
-- ============================================================================

-- ── ١) التخصيصات ────────────────────────────────────────────────────────────

create table if not exists public.studio_product_routes (
  product_id text   not null,
  line       text   not null default 'studio',
  step       text   not null,
  -- required: إلزامية · optional: اختيارية (تتخطّى) · off: غير مستخدمة للمنتج ده
  state      text   not null default 'required',
  -- شروط دخول بتتلغي للمنتج ده في المرحلة دي.
  gates_off  text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint studio_product_routes_pkey primary key (product_id, step),
  constraint studio_product_routes_line check (line = 'studio'),
  constraint studio_product_routes_state check (state in ('required', 'optional', 'off')),
  constraint studio_product_routes_gates check (gates_off <@ array[
    'has_text', 'text_editor_approved', 'text_client_approved', 'photo_consent',
    'character_approved', 'pages_ready', 'pages_approved', 'qa_complete']::text[]),
  constraint studio_product_routes_product_fkey foreign key (product_id)
    references public.personalized_products (id) on delete cascade,
  constraint studio_product_routes_step_fkey foreign key (line, step)
    references public.task_steps (line, step) on delete cascade on update cascade
);

alter table public.studio_product_routes enable row level security;

drop policy if exists "Admins read studio product routes" on public.studio_product_routes;
create policy "Admins read studio product routes" on public.studio_product_routes
  as permissive for select to authenticated
  using (public.is_admin());

revoke all on public.studio_product_routes from anon;
revoke all on public.studio_product_routes from authenticated;
grant select on public.studio_product_routes to authenticated;
grant all on public.studio_product_routes to service_role;


-- ── ٢) الكتالوج الفعلي لمنتج ────────────────────────────────────────────────

create or replace function public.task_effective_steps(p_line text, p_product text default null)
returns table (
  step text, sort_order integer, kind text, active boolean, optional boolean,
  gates text[], advance_by text
)
language sql stable security definer set search_path = public as $$
  select s.step, s.sort_order, s.kind,
         s.active and (s.kind <> 'stage' or coalesce(o.state, 'required') <> 'off'),
         case o.state
           when 'optional' then s.kind = 'stage'
           when 'required' then false
           else s.optional
         end,
         coalesce(
           (select array_agg(g order by ord)
              from unnest(s.gates) with ordinality as u(g, ord)
             where o.gates_off is null or not (g = any (o.gates_off))),
           '{}'::text[]),
         s.advance_by
    from task_steps s
    left join studio_product_routes o
      on p_line = 'studio' and o.product_id = p_product and o.step = s.step
   where s.line = p_line
$$;

revoke all on function public.task_effective_steps(text, text) from public, anon;
grant execute on function public.task_effective_steps(text, text) to authenticated, service_role;


-- ── ٣) دوال القواعد بتقبل المنتج ────────────────────────────────────────────

drop function if exists public.task_next_step(text, text);
create or replace function public.task_next_step(p_line text, p_step text, p_product text default null)
returns text
language sql stable security definer set search_path = public as $$
  select n.step
    from task_effective_steps(p_line, p_product) c
    join task_effective_steps(p_line, p_product) n on true
   where c.step = p_step
     and c.kind in ('start', 'stage')
     and n.active and n.kind in ('stage', 'done')
     and n.sort_order > c.sort_order
   order by n.sort_order, n.step
   limit 1
$$;

revoke all on function public.task_next_step(text, text, text) from public, anon;
grant execute on function public.task_next_step(text, text, text) to authenticated, service_role;

drop function if exists public.task_skip_target(text, text, text);
create or replace function public.task_skip_target(
  p_line text, p_from text, p_to text, p_product text default null
)
returns boolean
language sql stable security definer set search_path = public as $$
  with e as (select * from task_effective_steps(p_line, p_product))
  select exists (
    select 1
      from e c
      join e t on true
     where c.step = p_from and c.kind in ('start', 'stage')
       and t.step = p_to and t.active and t.kind in ('stage', 'done')
       and t.sort_order > c.sort_order
       and exists (
         select 1 from e m
          where m.active and m.kind = 'stage'
            and m.sort_order > c.sort_order and m.sort_order < t.sort_order)
       and not exists (
         select 1 from e m
          where m.active and m.kind = 'stage' and not m.optional
            and m.sort_order > c.sort_order and m.sort_order < t.sort_order)
  )
$$;

revoke all on function public.task_skip_target(text, text, text, text) from public, anon;
grant execute on function public.task_skip_target(text, text, text, text) to authenticated, service_role;

drop function if exists public.story_transition_rule(text, text, text);
create or replace function public.story_transition_rule(
  p_from text, p_to text, p_held_from text, p_product text default null,
  out allowed boolean, out who text, out skip_gates boolean,
  out pages_redo boolean, out reset_qa boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  f task_steps;
  t task_steps;
  e task_edges;
  v_t_active boolean;
  v_f_advance text;
begin
  allowed := false; who := 'owner'; skip_gates := false; pages_redo := false; reset_qa := false;

  select * into f from task_steps where line = 'studio' and step = p_from;
  select * into t from task_steps where line = 'studio' and step = p_to;
  select x.active into v_t_active from task_effective_steps('studio', p_product) x where x.step = p_to;
  if f.step is null or t.step is null or not coalesce(v_t_active, false) then
    return;
  end if;
  if f.kind in ('done', 'cancel') then
    return;
  end if;
  v_f_advance := f.advance_by;

  if f.kind = 'hold' then
    -- الاستئناف لنفس المرحلة اللي اتوقف فيها بس.
    if p_to = p_held_from and t.kind in ('start', 'stage') then
      allowed := true; who := 'manager';
    end if;
    return;
  end if;

  if t.kind in ('hold', 'cancel') then
    allowed := true; who := 'manager';
    return;
  end if;

  if public.task_next_step('studio', p_from, p_product) = p_to then
    allowed := true; who := v_f_advance;
    return;
  end if;

  select * into e from task_edges where line = 'studio' and from_step = p_from and to_step = p_to;
  if found then
    allowed := true; who := e.who; skip_gates := e.skip_gates;
    pages_redo := e.pages_redo; reset_qa := e.reset_qa;
    return;
  end if;

  -- تخطّي مراحل اختيارية (أو غير مستخدمة للمنتج): شروط المرحلة الهدف بتتطبّق.
  if public.task_skip_target('studio', p_from, p_to, p_product) then
    allowed := true; who := v_f_advance;
  end if;
end;
$$;

revoke all on function public.story_transition_rule(text, text, text, text) from public, anon;
grant execute on function public.story_transition_rule(text, text, text, text) to authenticated, service_role;


-- ── ٤) الحارس بيطبّق تسلسل المنتج ───────────────────────────────────────────

create or replace function public.story_project_guard()
returns trigger
language plpgsql
set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_manage  boolean;
  v_to      task_steps;
  v_gates   text[];
  r         record;
  g         text;
  msg       text;
begin
  v_manage := v_uid is null or public.admin_has_permission('canManageStudio');

  -- الهوية والتوزيع والموعد لمسؤول الإنتاج بس.
  if new.order_item_id is distinct from old.order_item_id
     or new.order_id is distinct from old.order_id
     or new.product_id is distinct from old.product_id then
    raise exception 'ربط المشروع بالطلب مايتغيّرش' using errcode = '42501';
  end if;
  if not v_manage and (
       new.editor_id is distinct from old.editor_id
    or new.art_lead_id is distinct from old.art_lead_id
    or new.due_at is distinct from old.due_at
  ) then
    raise exception 'التوزيع والموعد لمسؤول الإنتاج فقط' using errcode = '42501';
  end if;

  new.updated_at := now();

  -- موافقة الصورة: بتتسجّل وقتها ومين سجّلها.
  if new.photo_consent_at is not null and old.photo_consent_at is null then
    new.photo_consent_by := coalesce(new.photo_consent_by, v_uid);
  end if;
  if new.character_approved_at is not null and old.character_approved_at is null then
    new.character_approved_by := coalesce(new.character_approved_by, v_uid);
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- ── انتقال حالة ────────────────────────────────────────────────────────
  if exists (select 1 from task_steps
              where line = 'studio' and step = old.status and kind in ('done', 'cancel')) then
    raise exception 'المشروع منتهي (%) — مايتعدّلش', old.status using errcode = '42501';
  end if;

  select * into r from public.story_transition_rule(old.status, new.status, old.held_from, old.product_id);
  if not r.allowed then
    raise exception 'انتقال غير مسموح: % ← %', old.status, new.status using errcode = '23514';
  end if;

  -- مين ينفّذ: مسؤول الإنتاج دايمًا، وصاحب المرحلة لو الانتقال متاح له.
  if not v_manage then
    if r.who = 'manager' then
      if r.pages_redo then
        raise exception 'تعديل النص بعد بدء الرسم لمسؤول الإنتاج فقط' using errcode = '42501';
      end if;
      raise exception 'الإيقاف والإلغاء والفحص النهائي والتسليم لمسؤول الإنتاج فقط' using errcode = '42501';
    elsif not public.story_is_worker(old.id, v_uid) then
      raise exception 'إنت مش مسؤول المرحلة دي في المشروع ده' using errcode = '42501';
    end if;
  end if;

  -- تعديل النطاق: الصفحات ترجع للمراجعة (مش الكتاب كله بيتعاد — الصفحات المتأثرة).
  if r.pages_redo then
    update story_pages set status = 'needs_redo', updated_at = now()
     where project_id = new.id and status <> 'pending';
  end if;
  if r.pages_redo or r.reset_qa then
    new.qa_passed_at := null;
    new.qa_passed_by := null;
  end if;

  select * into v_to from task_steps where line = 'studio' and step = new.status;
  -- شروط الدخول الفعلية لنوع المنتج ده (الكتالوج ناقص الشروط اللي المنتج ألغاها).
  select e.gates into v_gates from public.task_effective_steps('studio', old.product_id) e where e.step = new.status;
  v_gates := coalesce(v_gates, v_to.gates);

  -- الإيقاف المؤقت بيفتكر مكانه.
  if v_to.kind = 'hold' then
    new.held_from := old.status;
  elsif exists (select 1 from task_steps where line = 'studio' and step = old.status and kind = 'hold') then
    new.held_from := null;
  end if;

  -- ── شروط دخول المرحلة ────────────────────────────────────────────────
  if not r.skip_gates then
    foreach g in array v_gates loop
      msg := public.story_gate_check(g, new);
      if msg is not null then
        raise exception '%', msg using errcode = '23514';
      end if;
    end loop;
    if 'qa_complete' = any (v_gates) then
      new.qa_passed_at := coalesce(new.qa_passed_at, now());
      new.qa_passed_by := coalesce(new.qa_passed_by, v_uid);
    end if;
  end if;

  if v_to.kind = 'done' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;

  return new;
end;
$$;

-- ── ٥) إدارة التخصيص (بصلاحية) ──────────────────────────────────────────────

-- حالة وشروط مرحلة لمنتج. p_state: required | optional | off. p_gates_off: شروط الكتالوج اللي
-- المنتج بيلغيها. لو الحالة ≡ الأصل ومفيش شروط ملغية، التخصيص بيتشال (المنتج يمشي على العام).
create or replace function public.studio_route_set(
  p_product text, p_step text, p_state text, p_gates_off text[] default '{}'
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row  task_steps;
  v_base text;
  v_off  text[];
begin
  if not public.task_flow_admin('studio') then
    raise exception 'مالكش صلاحية تعديل مراحل الاستوديو' using errcode = '42501';
  end if;
  if not exists (select 1 from personalized_products where id = p_product and category = 'custom') then
    raise exception 'المنتج ده مش قصة مخصّصة' using errcode = '23514';
  end if;
  select * into v_row from task_steps where line = 'studio' and step = p_step;
  if v_row.step is null or v_row.kind not in ('start', 'stage') then
    raise exception 'المرحلة دي مالهاش تسلسل قابل للتعديل' using errcode = '23514';
  end if;
  if p_state not in ('required', 'optional', 'off') then
    raise exception 'حالة المرحلة غير معروفة' using errcode = '23514';
  end if;
  if v_row.kind = 'start' and p_state <> 'required' then
    raise exception 'مرحلة البداية ثابتة' using errcode = '23514';
  end if;
  -- الشروط الملغية لازم تكون من شروط المرحلة نفسها.
  select coalesce(array_agg(g), '{}') into v_off
    from unnest(coalesce(p_gates_off, '{}'::text[])) g
   where g = any (v_row.gates);
  if p_state = 'off' and exists (
       select 1 from story_projects
        where product_id = p_product and (status = p_step or held_from = p_step)) then
    raise exception 'فيه مشاريع من المنتج ده في المرحلة دي — انقلها الأول' using errcode = '23514';
  end if;

  v_base := case when v_row.optional then 'optional' else 'required' end;
  if p_state = v_base and coalesce(array_length(v_off, 1), 0) = 0 then
    delete from studio_product_routes where product_id = p_product and step = p_step;
  else
    insert into studio_product_routes (product_id, step, state, gates_off, updated_at)
    values (p_product, p_step, p_state, v_off, now())
    on conflict (product_id, step)
    do update set state = excluded.state, gates_off = excluded.gates_off, updated_at = now();
  end if;
end;
$$;

-- يرجّع المنتج للتسلسل العام.
create or replace function public.studio_route_reset(p_product text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_n integer;
begin
  if not public.task_flow_admin('studio') then
    raise exception 'مالكش صلاحية تعديل مراحل الاستوديو' using errcode = '42501';
  end if;
  if exists (
       select 1
         from studio_product_routes o
         join story_projects p
           on p.product_id = o.product_id and (p.status = o.step or p.held_from = o.step)
        where o.product_id = p_product and o.state = 'off') then
    raise exception 'فيه مشاريع من المنتج ده في مرحلة معطّلة — انقلها الأول' using errcode = '23514';
  end if;
  delete from studio_product_routes where product_id = p_product;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.studio_route_set(text, text, text, text[]) from public, anon;
revoke all on function public.studio_route_reset(text) from public, anon;
grant execute on function public.studio_route_set(text, text, text, text[]) to authenticated, service_role;
grant execute on function public.studio_route_reset(text) to authenticated, service_role;
