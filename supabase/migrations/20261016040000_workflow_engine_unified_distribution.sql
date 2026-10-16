-- ============================================================================
-- مهام الإدارة — (٤) محرك المراحل الكامل + توزيع لكل مرحلة + وصول مشتق من التوزيع
-- ============================================================================
-- يعتمد على: 20261016010000 (الاستوديو) · 20261016020000 (خط studio) ·
--            20261016030000 (كتالوج المراحل والمواعيد).
--
-- المشكلة: مراحل الاستوديو وانتقالاتها وشروطها كانت مكتوبة بالحرف داخل المحفّز
-- (story_project_guard) فمفيش طريقة تضيف مرحلة أو تشيل واحدة أو تغيّر شرط من
-- الشاشة. والاستوديو كان «خط» منفصل في التوزيع بمرحلة واحدة، ومن يشتغل فيه لازم
-- يكون محرر/مشرف فني معيّن على كل مشروع على حدة وبدور استوديو مخصوص.
--
-- اللي بيتغيّر:
--   ١) الكتالوج (task_steps) بقى هو تعريف سير العمل للاستوديو:
--        kind    : start | stage | hold | done | cancel (الأربعة غير stage نظاميين
--                  ومفاتيحهم ثابتة: brief · on_hold · delivered · cancelled).
--        active  : المرحلة الموقوفة بتتخطّاها الحركة للأمام.
--        abilities: إيه الشغل المسموح في المرحلة (text نسخ النص · pages الصفحات).
--        gates   : شروط الدخول للمرحلة (مفردات ثابتة، التركيب بالبيانات).
--        advance_by: مين ينقل للمرحلة اللي بعدها (owner صاحب المرحلة | manager).
--        builtin : من الأصل ولا اتضافت.
--      الحركة «للأمام» محسوبة من ترتيب sort_order (أقرب مرحلة فعّالة بعدها).
--   ٢) task_edges: الانتقالات الاستثنائية (رجوع/قفز) ومين يعملها وأثرها
--      (تجاوز الشروط · إعادة الصفحات · تصفير الفحص).
--   ٣) الحرّاس الثلاثة (المشروع · النسخ · الصفحات) بقوا بيقروا من الكتالوج. السلوك
--      الحالي محفوظ بالظبط (ملف الاختبار الأصلي بيعدّي من غير تعديل).
--   ٤) من «صاحب المرحلة»: بقى كل من اتسندت له مهمة المشروع الحالية (من التوزيع)،
--      أو المحرر/المشرف المعيّن على المشروع (استثناء)، أو مسؤول الإنتاج.
--   ٥) التوزيع لكل مرحلة: assignment_rules.stage بقى يقبل مفتاح أي مرحلة في الكتالوج
--      (مراحل الاستوديو، وحالات الطلب الدقيقة paid/preparing/shipped…). المسند له
--      على مرحلة استوديو بيدخل الاستوديو من غير دور مخصوص (story_studio_access).
--   ٦) دوال إدارة بصلاحية: إنشاء/حذف/ترتيب/إيقاف مرحلة، تحرير الانتقالات، وتطبيق
--      قاعدة التوزيع على المهام المفتوحة.
--
-- ⚠️ لا بيتغيّر: مراحل الطلبات العادية (حالات الطلب نفسها) — بتتحكم فيها مهل وأسماء
--    ومسؤولين بس. الحالة الأصلية لكل مشروع موجود (مفتاح الحالة) مابتتغيّرش.
--
-- الاختبار: supabase/tests/workflow_engine.sql (معاملة بتتراجع) + الاختبارات الأصلية.
--
-- الرجوع (يدويًا): أعِد تعريف story_project_guard / story_version_guard /
--   story_page_guard / story_sync_task / story_studio_access / work_task_open /
--   story_create_project_for_item من ملفات 20261016010000..030000؛ drop table task_edges؛
--   drop function story_transition_rule, story_gate_check, story_is_worker,
--   task_next_step, task_flow_admin, studio_renumber, studio_stage_create,
--   studio_stage_move, studio_stage_delete, studio_stage_flow, studio_edges_set,
--   task_rule_people, task_rule_apply؛ أعِد القيدين story_projects_status
--   وstory_projects_held_from وassignment_rules_stage؛ واحذف أعمدة kind/active/
--   abilities/gates/advance_by/builtin من task_steps ومحفّز assignment_rules_valid.
-- ============================================================================


-- ── ١) توسيع الكتالوج ───────────────────────────────────────────────────────

alter table public.task_steps
  add column if not exists kind       text    not null default 'stage',
  add column if not exists active     boolean not null default true,
  add column if not exists abilities  text[]  not null default '{}',
  add column if not exists gates      text[]  not null default '{}',
  add column if not exists advance_by text    not null default 'owner',
  add column if not exists builtin    boolean not null default false;

alter table public.task_steps drop constraint if exists task_steps_kind;
alter table public.task_steps
  add constraint task_steps_kind check (kind in ('start', 'stage', 'hold', 'done', 'cancel'));

alter table public.task_steps drop constraint if exists task_steps_advance_by;
alter table public.task_steps
  add constraint task_steps_advance_by check (advance_by in ('owner', 'manager'));

alter table public.task_steps drop constraint if exists task_steps_abilities;
alter table public.task_steps
  add constraint task_steps_abilities check (abilities <@ array['text', 'pages']::text[]);

alter table public.task_steps drop constraint if exists task_steps_gates;
alter table public.task_steps
  add constraint task_steps_gates check (gates <@ array[
    'has_text', 'text_editor_approved', 'text_client_approved', 'photo_consent',
    'character_approved', 'pages_ready', 'pages_approved', 'qa_complete']::text[]);

-- التركيب الهيكلي للاستوديو بس؛ مراحل الطلبات (حالات الطلب) مالهاش هيكل.
alter table public.task_steps drop constraint if exists task_steps_structure_line;
alter table public.task_steps
  add constraint task_steps_structure_line check (
    line = 'studio'
    or (kind = 'stage' and active and abilities = '{}' and gates = '{}' and advance_by = 'owner')
  );

-- كل المراحل الموجودة قبل الملف ده «أصلية».
update public.task_steps set builtin = true;


-- ── ٢) الانتقالات الاستثنائية ───────────────────────────────────────────────

create table if not exists public.task_edges (
  line        text    not null default 'studio',
  from_step   text    not null,
  to_step     text    not null,
  -- مين ينفّذ الانتقال: صاحب المرحلة، أو مسؤول الإنتاج بس.
  who         text    not null default 'owner',
  -- ماتتطبّقش شروط دخول المرحلة الهدف (رجوع لمرحلة اتخطّت شروطها قبل كده).
  skip_gates  boolean not null default false,
  -- الصفحات كلها ترجع «تحتاج إعادة» (تعديل نطاق).
  pages_redo  boolean not null default false,
  -- نتيجة فحص الجودة تتصفّر.
  reset_qa    boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint task_edges_pkey primary key (line, from_step, to_step),
  constraint task_edges_line check (line = 'studio'),
  constraint task_edges_who check (who in ('owner', 'manager')),
  constraint task_edges_distinct check (from_step <> to_step),
  constraint task_edges_from_fkey foreign key (line, from_step)
    references public.task_steps (line, step) on delete cascade on update cascade,
  constraint task_edges_to_fkey foreign key (line, to_step)
    references public.task_steps (line, step) on delete cascade on update cascade
);

alter table public.task_edges enable row level security;

drop policy if exists "Admins read task edges" on public.task_edges;
create policy "Admins read task edges" on public.task_edges
  as permissive for select to authenticated
  using (public.is_admin());

-- الكتابة من الدوال بصلاحية بس (studio_edges_set).
revoke all on public.task_edges from anon;
revoke all on public.task_edges from authenticated;
grant select on public.task_edges to authenticated;
grant all on public.task_edges to service_role;


-- ── ٣) بيانات الاستوديو الحالية: نفس سلوك المحفّز الأصلي بالظبط ─────────────

update public.task_steps set kind = 'start'  where line = 'studio' and step = 'brief';
update public.task_steps set kind = 'hold',  sort_order = 1050 where line = 'studio' and step = 'on_hold';

update public.task_steps set abilities = array['text']
 where line = 'studio' and step in ('text_draft', 'text_review', 'client_text_approval');
update public.task_steps set abilities = array['pages']
 where line = 'studio' and step in ('character', 'scenes', 'art_review', 'layout');

update public.task_steps set gates = array['has_text']              where line = 'studio' and step = 'text_review';
update public.task_steps set gates = array['text_editor_approved']  where line = 'studio' and step = 'client_text_approval';
update public.task_steps set gates = array['text_client_approved', 'photo_consent']
                                                                    where line = 'studio' and step = 'character';
update public.task_steps set gates = array['character_approved']   where line = 'studio' and step = 'scenes';
update public.task_steps set gates = array['pages_ready']          where line = 'studio' and step = 'art_review';
update public.task_steps set gates = array['pages_approved']       where line = 'studio' and step = 'layout';
update public.task_steps set gates = array['qa_complete']          where line = 'studio' and step = 'ready';

-- النقل من الفحص النهائي والتجهيز لمسؤول الإنتاج بس (زي القديم).
update public.task_steps set advance_by = 'manager' where line = 'studio' and step in ('qa', 'ready');

-- الحالتان النهائيتان (كانتا في القيد بس، من غير صف في الكتالوج).
insert into public.task_steps
  (line, step, label, hint, sla_hours, owner_kind, sort_order, show_tab, kind, builtin)
values
  ('studio', 'delivered', 'تم التسليم', 'المشروع اتسلّم للعميل.', null, 'manager', 1000, false, 'done', true),
  ('studio', 'cancelled', 'ملغي', 'المشروع اتلغى.', null, 'manager', 1100, false, 'cancel', true)
on conflict (line, step) do nothing;
update public.task_steps set kind = 'done'   where line = 'studio' and step = 'delivered';
update public.task_steps set kind = 'cancel' where line = 'studio' and step = 'cancelled';

-- الانتقالات الاستثنائية الأصلية (غير «للأمام» و«إيقاف/إلغاء/استئناف»).
insert into public.task_edges (line, from_step, to_step, who, skip_gates, pages_redo, reset_qa) values
  ('studio', 'text_review',           'text_draft', 'owner',   false, false, false),
  ('studio', 'client_text_approval',  'text_draft', 'owner',   false, false, false),
  ('studio', 'art_review',            'scenes',     'owner',   false, false, false),
  ('studio', 'layout',                'art_review', 'owner',   false, false, false),
  ('studio', 'qa',                    'layout',     'manager', true,  false, false),
  ('studio', 'ready',                 'qa',         'manager', false, false, true),
  -- تعديل نطاق: الرجوع للنص بعد ما الرسم بدأ.
  ('studio', 'character',             'text_draft', 'manager', false, true,  true),
  ('studio', 'scenes',                'text_draft', 'manager', false, true,  true),
  ('studio', 'art_review',            'text_draft', 'manager', false, true,  true),
  ('studio', 'layout',                'text_draft', 'manager', false, true,  true),
  ('studio', 'qa',                    'text_draft', 'manager', false, true,  true),
  ('studio', 'ready',                 'text_draft', 'manager', false, true,  true)
on conflict (line, from_step, to_step) do nothing;


-- ── ٤) دوال القراءة المشتركة ────────────────────────────────────────────────

-- الحركة «للأمام» من مرحلة: أقرب مرحلة فعّالة بعدها في الترتيب.
create or replace function public.task_next_step(p_line text, p_step text)
returns text
language sql stable security definer set search_path = public as $$
  select n.step
    from task_steps c
    join task_steps n on n.line = c.line
   where c.line = p_line and c.step = p_step
     and c.kind in ('start', 'stage')
     and n.active and n.kind in ('stage', 'done')
     and n.sort_order > c.sort_order
   order by n.sort_order, n.step
   limit 1
$$;

revoke all on function public.task_next_step(text, text) from public, anon;
grant execute on function public.task_next_step(text, text) to authenticated, service_role;

-- هل الانتقال ده مسموح؟ ومين ينفّذه؟ وإيه أثره؟
create or replace function public.story_transition_rule(
  p_from text, p_to text, p_held_from text,
  out allowed boolean, out who text, out skip_gates boolean,
  out pages_redo boolean, out reset_qa boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  f task_steps;
  t task_steps;
  e task_edges;
begin
  allowed := false; who := 'owner'; skip_gates := false; pages_redo := false; reset_qa := false;

  select * into f from task_steps where line = 'studio' and step = p_from;
  select * into t from task_steps where line = 'studio' and step = p_to;
  if f.step is null or t.step is null or not t.active then
    return;
  end if;
  if f.kind in ('done', 'cancel') then
    return;
  end if;

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

  if public.task_next_step('studio', p_from) = p_to then
    allowed := true; who := f.advance_by;
    return;
  end if;

  select * into e from task_edges where line = 'studio' and from_step = p_from and to_step = p_to;
  if found then
    allowed := true; who := e.who; skip_gates := e.skip_gates;
    pages_redo := e.pages_redo; reset_qa := e.reset_qa;
  end if;
end;
$$;

revoke all on function public.story_transition_rule(text, text, text) from public, anon;
grant execute on function public.story_transition_rule(text, text, text) to authenticated, service_role;

-- شرط من مفردات الشروط: بيرجّع رسالة النقص أو null. نفس رسائل المحفّز الأصلي.
create or replace function public.story_gate_check(p_gate text, p story_projects)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_required text[] := array[
    'story_engaging', 'dialogue_age_fit', 'art_matches_text',
    'hero_consistent', 'arabic_text_ok', 'print_ready'
  ];
  k text;
begin
  -- محفّزات الحرّاس بتناديها بصلاحية المستخدم؛ مفيش سبب تتنادى من حد من غير وصول للاستوديو
  -- (وإلا بتتحول لوسيلة سؤال عن نسخ/صفحات مشاريع مش بتاعته). السيرفر/الخدمة (uid فاضي) مسموح.
  if auth.uid() is not null and not public.story_studio_access() then
    return null;
  end if;
  case p_gate
    when 'has_text' then
      if not exists (select 1 from story_versions where project_id = p.id and status <> 'superseded') then
        return 'اكتب نسخة من النص الأول';
      end if;
    when 'text_editor_approved' then
      if not exists (select 1 from story_versions where project_id = p.id and status = 'editor_approved') then
        return 'اعتمد نسخة النص كمحرّر الأول';
      end if;
    when 'text_client_approved' then
      if not exists (select 1 from story_versions where project_id = p.id and status = 'client_approved') then
        return 'لازم موافقة العميل على النص قبل الرسم';
      end if;
    when 'photo_consent' then
      if p.face_mode = 'real' and p.photo_consent_at is null then
        return 'الوجه الحقيقي محتاج موافقة ولي الأمر على استخدام الصورة';
      end if;
    when 'character_approved' then
      if p.character_approved_at is null then
        return 'اعتمد مرجع الشخصية الأول';
      end if;
    when 'pages_ready' then
      if not exists (select 1 from story_pages where project_id = p.id)
         or exists (select 1 from story_pages where project_id = p.id and status in ('pending', 'needs_redo')) then
        return 'كل الصفحات لازم تتجهّز قبل مراجعة الرسوم';
      end if;
    when 'pages_approved' then
      if not exists (select 1 from story_pages where project_id = p.id)
         or exists (select 1 from story_pages where project_id = p.id and status <> 'approved') then
        return 'كل الصفحات لازم تتعتمد قبل التركيب';
      end if;
    when 'qa_complete' then
      foreach k in array v_required loop
        if coalesce(p.qa_checklist ->> k, 'false') <> 'true' then
          return format('قايمة فحص الجودة ناقصة: %s', k);
        end if;
      end loop;
      if p.sensitive_topic and coalesce(p.qa_checklist ->> 'sensitive_review', 'false') <> 'true' then
        return 'الموضوع الحساس محتاج مراجعة متخصص قبل التسليم';
      end if;
    else
      null;
  end case;
  return null;
end;
$$;

revoke all on function public.story_gate_check(text, story_projects) from public, anon;
grant execute on function public.story_gate_check(text, story_projects) to authenticated, service_role;

-- مين صاحب المرحلة الحالية للمشروع؟ المسند له المهمة المفتوحة، أو (استثناء) المحرر/المشرف
-- المعيّن على المشروع لو المرحلة بتاعته.
create or replace function public.story_is_worker(p_project uuid, p_uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select p_uid is not null
    and (p_uid = auth.uid() or auth.uid() is null or public.admin_has_permission('canManageStudio'))
    and (
    exists (
      select 1 from work_tasks t
       where t.line = 'studio' and t.source_id = p_project::text
         and t.status = 'open' and p_uid = any (t.assignee_ids)
    )
    or exists (
      select 1
        from story_projects sp
        join task_steps s on s.line = 'studio' and s.step = sp.status
       where sp.id = p_project
         and ((s.owner_kind = 'editor'   and sp.editor_id   = p_uid)
           or (s.owner_kind = 'art_lead' and sp.art_lead_id = p_uid))
    )
  )
$$;

revoke all on function public.story_is_worker(uuid, uuid) from public, anon;
grant execute on function public.story_is_worker(uuid, uuid) to authenticated, service_role;


-- ── ٥) قيود الحالة ← تحقق من الكتالوج ───────────────────────────────────────

alter table public.story_projects drop constraint if exists story_projects_status;
alter table public.story_projects drop constraint if exists story_projects_held_from;

create or replace function public.story_projects_status_valid_fn()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from task_steps where line = 'studio' and step = new.status) then
    raise exception 'مرحلة غير معروفة: %', new.status using errcode = '23514';
  end if;
  if new.held_from is not null and not exists (
       select 1 from task_steps
        where line = 'studio' and step = new.held_from and kind in ('start', 'stage')) then
    raise exception 'مرحلة الإيقاف غير صالحة: %', new.held_from using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.story_projects_status_valid_fn() from public, anon, authenticated;

drop trigger if exists story_projects_status_valid_trg on public.story_projects;
create trigger story_projects_status_valid_trg
  before insert or update of status, held_from on public.story_projects
  for each row execute function public.story_projects_status_valid_fn();


-- ── ٦) الحارس المبني على البيانات ───────────────────────────────────────────

create or replace function public.story_project_guard()
returns trigger
language plpgsql
set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_manage  boolean;
  v_to      task_steps;
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

  select * into r from public.story_transition_rule(old.status, new.status, old.held_from);
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

  -- الإيقاف المؤقت بيفتكر مكانه.
  if v_to.kind = 'hold' then
    new.held_from := old.status;
  elsif exists (select 1 from task_steps where line = 'studio' and step = old.status and kind = 'hold') then
    new.held_from := null;
  end if;

  -- ── شروط دخول المرحلة ────────────────────────────────────────────────
  if not r.skip_gates then
    foreach g in array v_to.gates loop
      msg := public.story_gate_check(g, new);
      if msg is not null then
        raise exception '%', msg using errcode = '23514';
      end if;
    end loop;
    if 'qa_complete' = any (v_to.gates) then
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

-- نسخ النص: نص معتمد مايتعدّلش، ومين يعتمد، ومتى يُسمح بنسخة جديدة.
create or replace function public.story_version_guard()
returns trigger
language plpgsql
set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_manage  boolean := auth.uid() is null or public.admin_has_permission('canManageStudio');
  v_project record;
  v_abil    text[];
begin
  select id, status into v_project from story_projects where id = new.project_id;
  if not found then
    raise exception 'المشروع مش موجود' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    select abilities into v_abil from task_steps where line = 'studio' and step = v_project.status;
    if not ('text' = any (coalesce(v_abil, '{}'::text[]))) then
      raise exception 'النص بيتكتب في مراحل النص بس (الحالة: %)', v_project.status using errcode = '23514';
    end if;
    if not v_manage and not public.story_is_worker(v_project.id, v_uid) then
      raise exception 'إنت مش محرّر المشروع ده' using errcode = '42501';
    end if;
    if new.status <> 'draft' then
      raise exception 'النسخة الجديدة بتبدأ مسودة' using errcode = '23514';
    end if;
    new.created_by := coalesce(new.created_by, v_uid);
    return new;
  end if;

  -- UPDATE
  if new.project_id is distinct from old.project_id
     or new.version_no is distinct from old.version_no then
    raise exception 'النسخة مايتغيّرش ربطها ولا رقمها' using errcode = '42501';
  end if;
  if old.status in ('editor_approved', 'client_approved')
     and (new.body is distinct from old.body or new.source is distinct from old.source) then
    raise exception 'النص المعتمد مايتعدّلش — اعمل نسخة جديدة' using errcode = '42501';
  end if;
  if old.status = 'superseded' and new.status <> 'superseded' then
    raise exception 'نسخة قديمة اتستبدلت — مارجعتش' using errcode = '23514';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('editor_approved', 'client_approved')
       and not v_manage and not public.story_is_worker(v_project.id, v_uid) then
      raise exception 'اعتماد النص للمحرّر أو مسؤول الإنتاج' using errcode = '42501';
    end if;
    if new.status = 'editor_approved' then
      if old.status <> 'draft' then
        raise exception 'الاعتماد من مسودة بس' using errcode = '23514';
      end if;
      new.approved_by := coalesce(new.approved_by, v_uid);
      new.approved_at := coalesce(new.approved_at, now());
    elsif new.status = 'client_approved' then
      if old.status <> 'editor_approved' then
        raise exception 'موافقة العميل بعد اعتماد المحرّر' using errcode = '23514';
      end if;
      if coalesce(btrim(new.client_decision_note), '') = '' then
        raise exception 'سجّل إزاي ومتى العميل وافق' using errcode = '23514';
      end if;
      new.client_decision_at := coalesce(new.client_decision_at, now());
    elsif new.status = 'changes_requested' then
      if old.status not in ('draft', 'editor_approved') then
        raise exception 'طلب التعديل على مسودة أو نسخة معتمدة من المحرّر' using errcode = '23514';
      end if;
      new.client_decision_at := coalesce(new.client_decision_at, now());
    end if;
  end if;

  return new;
end;
$$;

-- الصفحات: الكتابة في مراحل الرسم بس (حسب قدرات المرحلة)، والاعتماد لصاحب المرحلة.
create or replace function public.story_page_guard()
returns trigger
language plpgsql
set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_manage  boolean := auth.uid() is null or public.admin_has_permission('canManageStudio');
  v_project record;
  v_abil    text[];
  v_pid     uuid := coalesce(new.project_id, old.project_id);
begin
  select id, status into v_project from story_projects where id = v_pid;
  if not found then
    -- الحذف المتتالي من المشروع نفسه.
    return coalesce(new, old);
  end if;

  if tg_op <> 'DELETE' then
    select abilities into v_abil from task_steps where line = 'studio' and step = v_project.status;
    if not ('pages' = any (coalesce(v_abil, '{}'::text[]))) and not v_manage then
      raise exception 'الصفحات بتتعدّل في مراحل الرسم بس (الحالة: %)', v_project.status using errcode = '23514';
    end if;
    if not v_manage and not public.story_is_worker(v_project.id, v_uid) then
      raise exception 'إنت مش المشرف الفني للمشروع ده' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception 'الصفحة مايتغيّرش مشروعها' using errcode = '42501';
    end if;
    new.updated_at := now();
    -- محتوى الصفحة المعتمدة بيرجع للمراجعة لو اتغيّر.
    if old.status = 'approved' and new.status = 'approved'
       and (new.page_text is distinct from old.page_text
         or new.scene_description is distinct from old.scene_description
         or new.image_url is distinct from old.image_url) then
      new.status := 'drafted';
    end if;
    if new.status = 'drafted' and old.status = 'needs_redo' then
      new.attempts := old.attempts + 1;
    end if;
  end if;

  if tg_op = 'INSERT' and new.status not in ('pending', 'drafted') then
    raise exception 'الصفحة الجديدة بتبدأ منتظرة أو مجهّزة' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- المشروع الجديد يبدأ من مرحلة البداية في الكتالوج.
create or replace function public.story_create_project_for_item(p_order_item uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_item  record;
  v_id    uuid;
  v_start text;
begin
  select oi.id, oi.order_id, oi.product_id, oi.customization_data, pp.category
    into v_item
    from order_items oi
    join personalized_products pp on pp.id = oi.product_id
   where oi.id = p_order_item;
  if not found or v_item.category <> 'custom' then
    return null;
  end if;

  select step into v_start from task_steps
   where line = 'studio' and kind = 'start' and active
   order by sort_order limit 1;

  insert into story_projects (order_item_id, order_id, product_id, status, brief)
  values (
    v_item.id, v_item.order_id, v_item.product_id, coalesce(v_start, 'brief'),
    case when jsonb_typeof(v_item.customization_data) = 'object'
         then v_item.customization_data - 'childPhoto'
         else '{}'::jsonb end
  )
  on conflict (order_item_id) do nothing
  returning id into v_id;

  return v_id;
end;
$$;


-- ── ٧) التوزيع لكل مرحلة ────────────────────────────────────────────────────

alter table public.assignment_rules drop constraint if exists assignment_rules_stage;

-- المرحلة لازم تكون العامة (دفع/تنفيذ) أو مرحلة موجودة في الكتالوج للنوع ده.
create or replace function public.assignment_rules_valid_fn()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage in ('payment', 'fulfilment') and new.line <> 'studio' then
    return new;
  end if;
  if new.line = 'studio' and new.stage = 'fulfilment' then
    return new;  -- القاعدة العامة القديمة: مسؤولو الإنتاج.
  end if;
  if not exists (select 1 from task_steps where line = new.line and step = new.stage) then
    raise exception 'مرحلة غير معروفة للتوزيع: % / %', new.line, new.stage using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.assignment_rules_valid_fn() from public, anon, authenticated;

drop trigger if exists assignment_rules_valid_trg on public.assignment_rules;
create trigger assignment_rules_valid_trg
  before insert or update on public.assignment_rules
  for each row execute function public.assignment_rules_valid_fn();

-- مسؤولو مرحلة: قاعدة المرحلة الدقيقة أولًا، وإلا القاعدة العامة (دفع/تنفيذ).
-- المسؤول لازم لسه إداري ومش موقوف/مؤرشف.
create or replace function public.task_rule_people(p_line text, p_stage text, p_step text)
returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid[];
begin
  if p_step is not null and p_step <> p_stage then
    select coalesce(array_agg(r.profile_id order by r.created_at), '{}'::uuid[]) into v
      from assignment_rules r
      join user_profiles u on u.id = r.profile_id
     where r.line = p_line and r.stage = p_step
       and u.role in ('super_admin', 'general_supervisor')
       and u.archived_at is null and u.suspended_at is null;
    if cardinality(v) > 0 then
      return v;
    end if;
  end if;
  select coalesce(array_agg(r.profile_id order by r.created_at), '{}'::uuid[]) into v
    from assignment_rules r
    join user_profiles u on u.id = r.profile_id
   where r.line = p_line and r.stage = p_stage
     and u.role in ('super_admin', 'general_supervisor')
     and u.archived_at is null and u.suspended_at is null;
  return v;
end;
$$;

revoke all on function public.task_rule_people(text, text, text) from public, anon, authenticated;
grant execute on function public.task_rule_people(text, text, text) to service_role;

-- فتح مهمة الطلب: المسؤول من قاعدة المرحلة الدقيقة (paid/preparing/shipped…) وإلا العامة.
create or replace function public.work_task_open(
  p_line text, p_stage text, p_source text, p_reference text, p_title text, p_link text,
  p_notify boolean, p_step text default null
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_assignees uuid[];
  v_existing  work_tasks;
  v_who       uuid;
  v_fresh     uuid[];
begin
  v_assignees := public.task_rule_people(p_line, p_stage, p_step);

  select * into v_existing from work_tasks
   where line = p_line and source_id = p_source and stage = p_stage;

  if found then
    if v_existing.status = 'open' then
      -- مرحلة دقيقة جديدة على مهمة مفتوحة: حدّث المرحلة (المحفّز بيحسب الموعد)،
      -- ولو للمرحلة الجديدة مسؤولون مخصوصين اتسندت لهم.
      if p_step is not null and p_step is distinct from v_existing.step then
        v_fresh := public.task_rule_people(p_line, p_stage, p_step);
        if cardinality(v_fresh) > 0
           and (select coalesce(array_agg(x order by x), '{}') from unnest(v_fresh) x)
               is distinct from (select coalesce(array_agg(x order by x), '{}') from unnest(v_existing.assignee_ids) x) then
          update work_tasks set step = p_step, assignee_ids = v_fresh where id = v_existing.id;
          if p_notify then
            foreach v_who in array v_fresh loop
              if not (v_who = any (v_existing.assignee_ids)) then
                insert into notifications (recipient_profile_id, title, message, link)
                values (
                  v_who::text, p_title,
                  'مسند ليك' || case when p_reference is not null then ' — ' || p_reference else '' end
                    || '. تلاقيه في «مهامي».',
                  p_link
                );
              end if;
            end loop;
          end if;
        else
          update work_tasks set step = p_step where id = v_existing.id;
        end if;
      end if;
      return;
    end if;
    -- رجعت للمرحلة دي تاني (مثلًا الإيصال اترفض واترفع تاني) — نفس المهمة.
    update work_tasks
       set status = 'open', done_at = null, done_by = null, step = coalesce(p_step, step)
     where id = v_existing.id;
    v_assignees := v_existing.assignee_ids;
  else
    insert into work_tasks (line, stage, source_id, reference, title, link, assignee_ids, step)
    values (p_line, p_stage, p_source, p_reference, p_title, p_link, v_assignees, p_step);
  end if;

  if p_notify then
    foreach v_who in array v_assignees loop
      insert into notifications (recipient_profile_id, title, message, link)
      values (
        v_who::text,
        p_title,
        'مسند ليك' || case when p_reference is not null then ' — ' || p_reference else '' end
          || '. تلاقيه في «مهامي».',
        p_link
      );
    end loop;
  end if;
end
$function$;

-- مهمة الاستوديو: المسند له = استثناء المشروع (محرر/مشرف) ثم مسؤولو المرحلة ثم الإنتاج.
create or replace function public.story_sync_task(p_project uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p         record;
  v_child     text;
  v_stage     text;
  v_kind      text;
  v_title     text;
  v_managers  uuid[];
  v_people    uuid[];
  v_assignees uuid[];
  v_one       uuid;
  v_existing  work_tasks;
  v_prev      uuid[];
  v_who       uuid;
  v_end       boolean;
begin
  select sp.id, sp.status, sp.editor_id, sp.art_lead_id, sp.order_closed_at, sp.brief,
         o.payment_reference
    into v_p
    from story_projects sp
    left join orders o on o.id = sp.order_id
   where sp.id = p_project;
  if not found then
    return;
  end if;

  -- المشروع خلص (تسليم/إلغاء) ← المهمة تخلص.
  select exists (select 1 from task_steps
                  where line = 'studio' and step = v_p.status and kind in ('done', 'cancel'))
         or v_p.status in ('delivered', 'cancelled')
    into v_end;
  if v_end then
    perform public.work_task_close('studio', 'fulfilment', p_project::text);
    return;
  end if;

  -- مسؤولو الإنتاج: القواعد المضبوطة في «توزيع المهام» أولًا، وإلا حاملو الصلاحية.
  select coalesce(array_agg(r.profile_id order by r.created_at), '{}'::uuid[])
    into v_managers
    from assignment_rules r
    join user_profiles u on u.id = r.profile_id
   where r.line = 'studio' and r.stage = 'fulfilment'
     and u.role in ('super_admin', 'general_supervisor')
     and u.archived_at is null and u.suspended_at is null;

  if cardinality(v_managers) = 0 then
    select coalesce(array_agg(u.id order by u.full_name), '{}'::uuid[])
      into v_managers
      from user_profiles u
      join admin_roles ar on ar.id = u.admin_role_id
     where u.role in ('super_admin', 'general_supervisor')
       and u.archived_at is null and u.suspended_at is null
       and 'canManageStudio' = any (ar.permissions);
  end if;

  -- مسؤولو المرحلة الحالية من «توزيع المهام».
  select coalesce(array_agg(r.profile_id order by r.created_at), '{}'::uuid[])
    into v_people
    from assignment_rules r
    join user_profiles u on u.id = r.profile_id
   where r.line = 'studio' and r.stage = v_p.status and r.stage <> 'fulfilment'
     and u.role in ('super_admin', 'general_supervisor')
     and u.archived_at is null and u.suspended_at is null;

  -- صاحب المرحلة الافتراضي واسمها من الكتالوج (قابل للتعديل من الإعدادات).
  select ts.owner_kind, ts.label into v_kind, v_stage
    from task_steps ts where ts.line = 'studio' and ts.step = v_p.status;
  v_kind := coalesce(v_kind, case
    when v_p.status in ('brief', 'text_draft', 'text_review', 'client_text_approval') then 'editor'
    when v_p.status in ('character', 'scenes', 'art_review', 'layout') then 'art_lead'
    else 'manager' end);

  -- استثناء المشروع: محرر/مشرف معيّن على المشروع نفسه.
  v_one := case
    when v_p.order_closed_at is not null then null
    when v_kind = 'editor' then v_p.editor_id
    when v_kind = 'art_lead' then v_p.art_lead_id
    else null
  end;
  if v_one is not null and not exists (
       select 1 from user_profiles u
        where u.id = v_one and u.role in ('super_admin', 'general_supervisor')
          and u.archived_at is null and u.suspended_at is null) then
    v_one := null;
  end if;

  v_assignees := case
    when v_one is not null then array[v_one]
    when v_p.order_closed_at is null and cardinality(v_people) > 0 then v_people
    else v_managers
  end;

  v_child := nullif(btrim(coalesce(v_p.brief ->> 'childName', '')), '');
  v_stage := coalesce(v_stage, case v_p.status
    when 'brief' then 'الطلب' when 'text_draft' then 'كتابة النص' when 'text_review' then 'مراجعة النص'
    when 'client_text_approval' then 'موافقة العميل على النص' when 'character' then 'الشخصية'
    when 'scenes' then 'المشاهد' when 'art_review' then 'مراجعة الرسوم' when 'layout' then 'التركيب'
    when 'qa' then 'فحص الجودة' when 'ready' then 'جاهز للتسليم' when 'on_hold' then 'موقوف مؤقتًا'
    else v_p.status end);
  v_title := case when v_p.order_closed_at is not null then '⚠ الطلب اتلغى — راجع المشروع: ' else '' end
          || 'مشروع قصة' || coalesce(' ' || v_child, '') || ' — ' || v_stage;

  select * into v_existing
    from work_tasks
   where line = 'studio' and stage = 'fulfilment' and source_id = p_project::text;

  if found then
    v_prev := case when v_existing.status = 'open' then v_existing.assignee_ids else '{}'::uuid[] end;
    update work_tasks
       set title = v_title, reference = v_p.payment_reference,
           link = '/dashboard/admin/studio/' || p_project::text,
           assignee_ids = v_assignees, step = v_p.status,
           status = 'open', done_at = null, done_by = null
     where id = v_existing.id;
  else
    v_prev := '{}'::uuid[];
    insert into work_tasks (line, stage, source_id, reference, title, link, assignee_ids, step)
    values ('studio', 'fulfilment', p_project::text, v_p.payment_reference, v_title,
            '/dashboard/admin/studio/' || p_project::text, v_assignees, v_p.status);
  end if;

  -- إشعار للي اتضاف بس.
  foreach v_who in array v_assignees loop
    if not (v_who = any (v_prev)) then
      begin
        insert into notifications (recipient_profile_id, title, message, link)
        values (
          v_who::text, v_title,
          'مسند ليك' || coalesce(' — ' || v_p.payment_reference, '') || '. تلاقيه في «مهامي».',
          '/dashboard/admin/studio/' || p_project::text
        );
      exception when others then
        raise warning 'story_sync_task: notification for % failed — %', v_who, sqlerrm;
      end;
    end if;
  end loop;
end;
$$;

-- الوصول للاستوديو: صلاحية استوديو، أو مسؤول على مرحلة من مراحله في «توزيع المهام»،
-- أو مسند له مهمة استوديو مفتوحة. (مفيش دور استوديو مخصوص لازم.)
create or replace function public.story_studio_access()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.admin_has_permission('canWorkStudio')
      or public.admin_has_permission('canManageStudio')
      or exists (
        select 1
          from assignment_rules r
          join user_profiles u on u.id = r.profile_id
         where r.line = 'studio' and r.profile_id = auth.uid()
           and u.role in ('super_admin', 'general_supervisor')
           and u.archived_at is null and u.suspended_at is null
      )
      or exists (
        select 1 from work_tasks t
         where t.line = 'studio' and t.status = 'open' and auth.uid() = any (t.assignee_ids)
      );
$$;


-- ── ٨) إدارة الهيكل (دوال بصلاحية) ──────────────────────────────────────────

-- مين يحرّر الهيكل؟ مراحل الاستوديو: مسؤول إنتاج القصص بس (ومدير النظام). باقي الخطوط: «توزيع المهام».
create or replace function public.task_flow_admin(p_line text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_line = 'studio'
              then public.admin_has_permission('canManageStudio')
              else public.admin_has_permission('canAssignWork') end
$$;

-- مين يوزّع؟ «توزيع المهام» لكل الخطوط، ومسؤول إنتاج القصص للاستوديو.
create or replace function public.task_rule_admin(p_line text)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.admin_has_permission('canAssignWork')
      or (p_line = 'studio' and public.admin_has_permission('canManageStudio'))
$$;

revoke all on function public.task_rule_admin(text) from public, anon;
grant execute on function public.task_rule_admin(text) to authenticated, service_role;

revoke all on function public.task_flow_admin(text) from public, anon;
grant execute on function public.task_flow_admin(text) to authenticated, service_role;

create or replace function public.studio_renumber()
returns void
language sql security definer set search_path = public as $$
  update task_steps t
     set sort_order = r.rn * 10
    from (select step, row_number() over (order by sort_order, step) as rn
            from task_steps where line = 'studio' and kind in ('start', 'stage')) r
   where t.line = 'studio' and t.step = r.step and t.sort_order is distinct from r.rn * 10
$$;

revoke all on function public.studio_renumber() from public, anon, authenticated;

-- مرحلة جديدة بعد مرحلة موجودة. بترجّع مفتاحها.
create or replace function public.studio_stage_create(
  p_label text, p_after text, p_hint text default null, p_sla numeric default null,
  p_owner text default 'manager'
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_after task_steps;
  v_key   text;
begin
  if not public.task_flow_admin('studio') then
    raise exception 'مالكش صلاحية تعديل مراحل الاستوديو' using errcode = '42501';
  end if;
  p_label := btrim(coalesce(p_label, ''));
  if char_length(p_label) not between 2 and 60 then
    raise exception 'اسم المرحلة من حرفين لـ٦٠ حرف' using errcode = '23514';
  end if;
  if p_owner not in ('editor', 'art_lead', 'manager') then
    raise exception 'صاحب المرحلة غير معروف' using errcode = '23514';
  end if;
  select * into v_after from task_steps where line = 'studio' and step = p_after;
  if v_after.step is null or v_after.kind not in ('start', 'stage') then
    raise exception 'مرحلة الإضافة بعدها غير صالحة' using errcode = '23514';
  end if;

  v_key := 'x_' || substr(md5(random()::text || clock_timestamp()::text || p_label), 1, 8);
  insert into task_steps (line, step, label, hint, sla_hours, owner_kind, sort_order, show_tab, kind, builtin)
  values ('studio', v_key, p_label, nullif(btrim(coalesce(p_hint, '')), ''), p_sla, p_owner,
          v_after.sort_order + 1, true, 'stage', false);
  perform public.studio_renumber();
  return v_key;
end;
$$;

-- تحريك مرحلة خطوة لفوق (-1) أو لتحت (+1) في ترتيب الخط.
create or replace function public.studio_stage_move(p_step text, p_dir integer)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_chain text[];
  v_i     integer;
  v_j     integer;
  v_a     integer;
  v_b     integer;
begin
  if not public.task_flow_admin('studio') then
    raise exception 'مالكش صلاحية تعديل مراحل الاستوديو' using errcode = '42501';
  end if;
  if p_dir not in (-1, 1) then
    raise exception 'اتجاه غير معروف' using errcode = '23514';
  end if;
  select array_agg(step order by sort_order, step) into v_chain
    from task_steps where line = 'studio' and kind in ('start', 'stage');
  v_i := array_position(v_chain, p_step);
  if v_i is null then
    raise exception 'المرحلة دي مش في الترتيب' using errcode = '23514';
  end if;
  if v_i = 1 then
    raise exception 'مرحلة البداية ثابتة في أول الترتيب' using errcode = '23514';
  end if;
  v_j := v_i + p_dir;
  if v_j < 2 or v_j > array_length(v_chain, 1) then
    return;  -- في الطرف بالفعل
  end if;
  select sort_order into v_a from task_steps where line = 'studio' and step = v_chain[v_i];
  select sort_order into v_b from task_steps where line = 'studio' and step = v_chain[v_j];
  if v_a = v_b then
    v_b := v_a + p_dir;
  end if;
  update task_steps set sort_order = v_b where line = 'studio' and step = v_chain[v_i];
  update task_steps set sort_order = v_a where line = 'studio' and step = v_chain[v_j];
  perform public.studio_renumber();
end;
$$;

-- المرحلة مستخدمة؟ (مشروع فيها/متوقف منها، أو مهمة مفتوحة عليها)
create or replace function public.studio_stage_usage(p_step text)
returns integer
language sql stable security definer set search_path = public as $$
  select (select count(*)::integer from story_projects where status = p_step or held_from = p_step)
$$;

revoke all on function public.studio_stage_usage(text) from public, anon;
grant execute on function public.studio_stage_usage(text) to authenticated, service_role;

create or replace function public.studio_stage_delete(p_step text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row task_steps;
begin
  if not public.task_flow_admin('studio') then
    raise exception 'مالكش صلاحية تعديل مراحل الاستوديو' using errcode = '42501';
  end if;
  select * into v_row from task_steps where line = 'studio' and step = p_step;
  if v_row.step is null then
    raise exception 'المرحلة مش موجودة' using errcode = '23514';
  end if;
  if v_row.kind <> 'stage' then
    raise exception 'مراحل البداية والإيقاف والتسليم والإلغاء نظامية ومايتحذفوش' using errcode = '23514';
  end if;
  if public.studio_stage_usage(p_step) > 0 then
    raise exception 'فيه مشاريع في المرحلة دي — انقلها الأول' using errcode = '23514';
  end if;
  delete from assignment_rules where line = 'studio' and stage = p_step;
  delete from task_steps where line = 'studio' and step = p_step;  -- الانتقالات بتتشال بالتتابع
  perform public.studio_renumber();
end;
$$;

-- خصائص المرحلة: فعّالة؟ قدراتها؟ شروط دخولها؟ مين ينقل منها؟
create or replace function public.studio_stage_flow(
  p_step text, p_active boolean, p_abilities text[], p_gates text[], p_advance_by text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row task_steps;
begin
  if not public.task_flow_admin('studio') then
    raise exception 'مالكش صلاحية تعديل مراحل الاستوديو' using errcode = '42501';
  end if;
  select * into v_row from task_steps where line = 'studio' and step = p_step;
  if v_row.step is null or v_row.kind not in ('start', 'stage') then
    raise exception 'المرحلة دي مالهاش هيكل قابل للتعديل' using errcode = '23514';
  end if;
  p_abilities := coalesce(p_abilities, '{}'::text[]);
  p_gates := coalesce(p_gates, '{}'::text[]);
  if not (p_abilities <@ array['text', 'pages']::text[]) then
    raise exception 'قدرات غير معروفة' using errcode = '23514';
  end if;
  if not (p_gates <@ array['has_text', 'text_editor_approved', 'text_client_approved', 'photo_consent',
                           'character_approved', 'pages_ready', 'pages_approved', 'qa_complete']::text[]) then
    raise exception 'شروط غير معروفة' using errcode = '23514';
  end if;
  if p_advance_by not in ('owner', 'manager') then
    raise exception 'قيمة النقل غير معروفة' using errcode = '23514';
  end if;
  if not p_active then
    if v_row.kind = 'start' then
      raise exception 'مرحلة البداية ماتتوقفش' using errcode = '23514';
    end if;
    if public.studio_stage_usage(p_step) > 0 then
      raise exception 'فيه مشاريع في المرحلة دي — انقلها الأول' using errcode = '23514';
    end if;
  end if;
  update task_steps
     set active = p_active, abilities = p_abilities, gates = p_gates, advance_by = p_advance_by
   where line = 'studio' and step = p_step;
end;
$$;

-- الانتقالات الاستثنائية الخارجة من مرحلة — بتستبدل القايمة كلها.
-- p_edges: [{ "to": "text_draft", "who": "manager", "skipGates": false, "pagesRedo": false, "resetQa": false }]
create or replace function public.studio_edges_set(p_from text, p_edges jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_from task_steps;
  v_to   task_steps;
  e      jsonb;
  v_who  text;
  v_next text;
begin
  if not public.task_flow_admin('studio') then
    raise exception 'مالكش صلاحية تعديل مراحل الاستوديو' using errcode = '42501';
  end if;
  select * into v_from from task_steps where line = 'studio' and step = p_from;
  if v_from.step is null or v_from.kind not in ('start', 'stage') then
    raise exception 'المرحلة دي مالهاش انتقالات قابلة للتعديل' using errcode = '23514';
  end if;
  if p_edges is null or jsonb_typeof(p_edges) <> 'array' then
    raise exception 'صيغة الانتقالات غير صحيحة' using errcode = '23514';
  end if;

  v_next := public.task_next_step('studio', p_from);
  delete from task_edges where line = 'studio' and from_step = p_from;

  for e in select * from jsonb_array_elements(p_edges) loop
    select * into v_to from task_steps where line = 'studio' and step = (e ->> 'to');
    if v_to.step is null or v_to.step = p_from or v_to.kind not in ('start', 'stage') or not v_to.active then
      raise exception 'مرحلة هدف غير صالحة: %', coalesce(e ->> 'to', '—') using errcode = '23514';
    end if;
    continue when v_to.step = v_next;  -- الحركة للأمام مش استثناء
    v_who := coalesce(e ->> 'who', 'owner');
    if v_who not in ('owner', 'manager') then
      raise exception 'قيمة مين ينفّذ غير معروفة' using errcode = '23514';
    end if;
    insert into task_edges (line, from_step, to_step, who, skip_gates, pages_redo, reset_qa)
    values ('studio', p_from, v_to.step, v_who,
            coalesce((e ->> 'skipGates')::boolean, false),
            coalesce((e ->> 'pagesRedo')::boolean, false),
            coalesce((e ->> 'resetQa')::boolean, false))
    on conflict (line, from_step, to_step) do update
      set who = excluded.who, skip_gates = excluded.skip_gates,
          pages_redo = excluded.pages_redo, reset_qa = excluded.reset_qa;
  end loop;
end;
$$;

-- طبّق قاعدة التوزيع الحالية لمرحلة على مهامها المفتوحة. بترجّع عدد المهام اللي اتغيّرت.
create or replace function public.task_rule_apply(p_line text, p_step text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  t       record;
  v_new   uuid[];
  v_n     integer := 0;
  v_who   uuid;
  v_old   uuid[];
  v_id    uuid;
begin
  if not public.task_rule_admin(p_line) then
    raise exception 'مالكش صلاحية التوزيع' using errcode = '42501';
  end if;

  if p_line = 'studio' then
    -- المهمة بتتحسب من حالة المشروع (استثناء المشروع يفضل غالب).
    for v_id in select id from story_projects where status = p_step loop
      begin
        select assignee_ids into v_old from work_tasks
         where line = 'studio' and source_id = v_id::text and status = 'open';
        perform public.story_sync_task(v_id);
        if v_old is distinct from (select assignee_ids from work_tasks
                                    where line = 'studio' and source_id = v_id::text and status = 'open') then
          v_n := v_n + 1;
        end if;
      exception when others then
        raise warning 'task_rule_apply: project % — %', v_id, sqlerrm;
      end;
    end loop;
    return v_n;
  end if;

  for t in
    select * from work_tasks
     where line = p_line and status = 'open' and (step = p_step or (step is null and stage = p_step))
  loop
    v_new := public.task_rule_people(t.line, t.stage, t.step);
    if cardinality(v_new) > 0
       and (select coalesce(array_agg(x order by x), '{}') from unnest(v_new) x)
           is distinct from (select coalesce(array_agg(x order by x), '{}') from unnest(t.assignee_ids) x) then
      update work_tasks set assignee_ids = v_new where id = t.id;
      foreach v_who in array v_new loop
        if not (v_who = any (t.assignee_ids)) then
          insert into notifications (recipient_profile_id, title, message, link)
          values (v_who::text, t.title,
                  'مسند ليك' || coalesce(' — ' || t.reference, '') || '. تلاقيه في «مهامي».', t.link);
        end if;
      end loop;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.studio_stage_create(text, text, text, numeric, text) from public, anon;
revoke all on function public.studio_stage_move(text, integer) from public, anon;
revoke all on function public.studio_stage_delete(text) from public, anon;
revoke all on function public.studio_stage_flow(text, boolean, text[], text[], text) from public, anon;
revoke all on function public.studio_edges_set(text, jsonb) from public, anon;
revoke all on function public.task_rule_apply(text, text) from public, anon;
grant execute on function public.studio_stage_create(text, text, text, numeric, text) to authenticated, service_role;
grant execute on function public.studio_stage_move(text, integer) to authenticated, service_role;
grant execute on function public.studio_stage_delete(text) to authenticated, service_role;
grant execute on function public.studio_stage_flow(text, boolean, text[], text[], text) to authenticated, service_role;
grant execute on function public.studio_edges_set(text, jsonb) to authenticated, service_role;
grant execute on function public.task_rule_apply(text, text) to authenticated, service_role;

-- مرحلة أُضيفت/اتغيّر اسمها ← عنوان المهام المفتوحة بيتحدّث (المحفّز الأصلي بيغطي label/owner).


-- ── ٩) رحلة الطلب: مشاريع الاستوديو لصفحة الطلب ─────────────────────────────
-- مدير الطلبات يشوف مرحلة مشروع القصة داخل رحلة الطلب (مرحلة + موعد + هل الطلب اتلغى) من غير
-- ما يبقى عنده صلاحية استوديو ولا يشوف النصوص والتكلفة. بيانات الحالة بس.
create or replace function public.order_studio_projects(p_order uuid)
returns table (
  id uuid, order_item_id uuid, status text, held_from text,
  due_at timestamptz, order_closed boolean, child_name text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.admin_has_permission('canManageOrders') or public.story_studio_access()) then
    return;
  end if;
  return query
    select sp.id, sp.order_item_id, sp.status, sp.held_from, sp.due_at,
           sp.order_closed_at is not null,
           nullif(btrim(coalesce(sp.brief ->> 'childName', '')), '')
      from story_projects sp
     where sp.order_id = p_order
     order by sp.created_at
     limit 20;
end;
$$;

revoke all on function public.order_studio_projects(uuid) from public, anon;
grant execute on function public.order_studio_projects(uuid) to authenticated, service_role;
