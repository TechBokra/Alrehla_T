-- ============================================================================
-- مهام الإدارة — (٣) المواعيد + سجل التطورات + كتالوج المراحل
-- ============================================================================
-- يعتمد على: ملف 14 (work_tasks/assignment_rules) و20261016020000 (خط studio).
--
-- المشكلة: المهمة كانت «مفتوحة/خلصت» بس — مفيش موعد، ولا مرحلة أدق من
-- «مراجعة الدفع / التنفيذ»، ولا أثر لمين غيّر إيه وإمتى. والمدير العام (اللي
-- مالوش مهام مسندة) ماكانش عنده طريقة يتابع مسار كل حاجة ووقتها.
--
-- اللي بيتضاف:
--   ١) أعمدة على work_tasks: step (المرحلة الدقيقة) · step_changed_at (من إمتى
--      في المرحلة) · due_at (الموعد) · priority (الأولوية) · وعلامتا إشعار
--      الاقتراب والتأخر (عشان الإشعار مايتكررش).
--   ٢) task_steps: كتالوج المراحل لكل نوع (الاسم · الشرح · المهلة بالساعات ·
--      صاحب المرحلة · ظهور التبويب). الاستوديو بيتعدّل من «إعدادات الاستوديو»،
--      وباقي الأنواع من «المراحل والمواعيد» في المهام. المهلة = ساعات من لحظة
--      دخول المهمة المرحلة (والمرحلة اللي مالهاش مهلة = من غير موعد).
--   ٣) work_task_events: سجل بيتكتب **لوحده بمحفّز** عند أي تغيير (إنشاء، تسنيد،
--      تغيّر مرحلة، تغيّر موعد/أولوية، إنجاز، إعادة فتح) + ملاحظات الإدارة +
--      تذكيرات الموعد. بأثر رجعي: كل مهمة موجودة ليها حدث إنشاء (وإنجاز).
--   ٤) فحص المواعيد: work_tasks_deadline_sweep() بيبعت إشعار «قرب الموعد»
--      (آخر ٢٥٪ من المهلة وبحد أدنى ساعتين) و«فات الموعد» (للمسؤول + المديرين)،
--      مرة واحدة لكل مهمة. بيتشغّل من cron يومي ومن فتح صفحة المهام (مقيّد بـ١٠
--      دقايق) — من غير إضافات جديدة على القاعدة.
--
-- ⚠️ الأمان والاستمرارية:
--   • محفّزات المهام **مابتفشّلش أي عملية تانية**: كل واحدة بتلتقط أي خطأ وتحوّله
--     لتحذير (نفس مبدأ story_sync_task) — حالة الطلب والدفع أهم من الموعد.
--   • work_task_open اتغيّرت (بارامتر step اختياري). الإصدار القديم اتشال، ومفيش
--     حد تاني بينادي عليه غير work_tasks_on_status اللي اتحدّث هنا.
--   • حارس: الموعد/الأولوية/المسؤول لا يتغيّروا من جلسة مستخدم غير حامل
--     «توزيع المهام والطلبات»، وأعمدة المرحلة والإشعارات للنظام بس.
--   • مهام «إنها لك» الموجودة ماتتغيّرش بنيويًا: بس بتاخد step وموعد.
--
-- الاختبار: supabase/tests/task_deadlines.sql (معاملة بتتراجع).
--
-- الرجوع (يدويًا): drop trigger work_tasks_a_guard_trg / work_tasks_b_deadline_trg /
--   work_tasks_c_events_trg on work_tasks; drop trigger task_steps_resync_trg on task_steps;
--   drop table work_task_events, task_steps, work_task_sweeps;
--   drop function work_tasks_guard_fn, work_tasks_deadline_fn, work_tasks_events_fn,
--     task_steps_resync_fn, task_steps_touch_fn, task_due_for, work_task_managers,
--     work_tasks_deadline_sweep, work_tasks_sweep_if_due;
--   alter table work_tasks drop column step, step_changed_at, due_at, priority,
--     soon_notified_at, overdue_notified_at;
--   وأعِد تعريف work_task_open (٧ بارامترات) وwork_tasks_on_status وstory_sync_task
--   من ملف 14 و20261016020000.
-- ============================================================================


-- ── ١) أعمدة المهمة ─────────────────────────────────────────────────────────

alter table public.work_tasks
  add column if not exists step               text,
  add column if not exists step_changed_at    timestamptz not null default now(),
  add column if not exists due_at             timestamptz,
  add column if not exists priority           text not null default 'normal',
  add column if not exists soon_notified_at   timestamptz,
  add column if not exists overdue_notified_at timestamptz;

alter table public.work_tasks drop constraint if exists work_tasks_priority;
alter table public.work_tasks
  add constraint work_tasks_priority check (priority in ('low', 'normal', 'high', 'urgent'));

-- فهرس المتابعة: المفتوح حسب الموعد.
create index if not exists work_tasks_due_idx
  on public.work_tasks (due_at) where status = 'open';


-- ── ٢) كتالوج المراحل ───────────────────────────────────────────────────────

create table if not exists public.task_steps (
  line        text        not null,
  step        text        not null,
  label       text        not null,
  hint        text,
  -- ساعات من دخول المهمة المرحلة. null = من غير موعد (موقوف/مفتوح المدة).
  sla_hours   numeric(7,2),
  -- مين صاحب المرحلة: خط الاستوديو بس بيستخدم editor/art_lead/manager،
  -- وباقي الخطوط 'rule' (حسب «توزيع الطلبات»).
  owner_kind  text        not null default 'rule',
  sort_order  integer     not null default 100,
  -- تبويب المرحلة في صندوق الاستوديو (التبويب اللي فيه مشاريع بيظهر دايمًا).
  show_tab    boolean     not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  constraint task_steps_pkey primary key (line, step),
  constraint task_steps_line  check (line in ('enha_lak', 'box', 'courses', 'services', 'studio')),
  constraint task_steps_label check (char_length(btrim(label)) between 2 and 60),
  constraint task_steps_hint  check (hint is null or char_length(hint) <= 300),
  constraint task_steps_sla   check (sla_hours is null or (sla_hours >= 0.25 and sla_hours <= 2160)),
  constraint task_steps_owner check (owner_kind in ('rule', 'editor', 'art_lead', 'manager')),
  constraint task_steps_owner_line check (
    (line = 'studio' and owner_kind <> 'rule') or (line <> 'studio' and owner_kind = 'rule')
  )
);

create or replace function public.task_steps_touch_fn()
returns trigger
language plpgsql
security definer set search_path = public as $$
begin
  new.label := btrim(new.label);
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.task_steps_touch_fn() from public, anon, authenticated;

drop trigger if exists task_steps_touch_trg on public.task_steps;
create trigger task_steps_touch_trg
  before update on public.task_steps
  for each row execute function public.task_steps_touch_fn();

alter table public.task_steps enable row level security;

drop policy if exists "Admins read task steps" on public.task_steps;
create policy "Admins read task steps" on public.task_steps
  as permissive for select to authenticated
  using (public.is_admin());

-- التعديل: «توزيع المهام» لكل الخطوط، ومسؤول الإنتاج لخط الاستوديو.
drop policy if exists "Managers edit task steps" on public.task_steps;
create policy "Managers edit task steps" on public.task_steps
  as permissive for update to authenticated
  using (
    public.admin_has_permission('canAssignWork')
    or (line = 'studio' and public.admin_has_permission('canManageStudio'))
  )
  with check (
    public.admin_has_permission('canAssignWork')
    or (line = 'studio' and public.admin_has_permission('canManageStudio'))
  );

revoke all on public.task_steps from anon;
revoke all on public.task_steps from authenticated;
grant select on public.task_steps to authenticated;
grant update (label, hint, sla_hours, owner_kind, show_tab) on public.task_steps to authenticated;
grant all on public.task_steps to service_role;

-- البيانات الافتراضية. كلها قابلة للتعديل من الشاشة؛ الأرقام تقدير مبدئي.
insert into public.task_steps (line, step, label, hint, sla_hours, owner_kind, sort_order) values
  -- إنها لك
  ('enha_lak', 'payment',   'مراجعة الدفع', 'أول ما العميل يرفع الإيصال — يتأكد من التحويل ويأكد الدفع.', 24, 'rule', 10),
  ('enha_lak', 'fulfilment', 'التنفيذ', 'بعد تأكيد الدفع — التجهيز والشحن.', 72, 'rule', 20),
  ('enha_lak', 'paid',      'بانتظار التجهيز', 'الدفع اتأكد والطلب لسه ماتجهّزش.', 24, 'rule', 21),
  ('enha_lak', 'preparing', 'قيد التجهيز', 'الطلب بيتجهّز (طباعة/تغليف).', 72, 'rule', 22),
  ('enha_lak', 'shipped',   'في الشحن', 'الطلب اتشحن — متابعة التوصيل للعميل.', 120, 'rule', 23),
  -- صندوق الرحلة
  ('box', 'payment',   'مراجعة الدفع', 'أول ما العميل يرفع الإيصال — يتأكد من التحويل ويأكد الدفع.', 24, 'rule', 10),
  ('box', 'fulfilment', 'التنفيذ', 'بعد تأكيد الدفع — التجهيز والشحن.', 72, 'rule', 20),
  ('box', 'paid',      'بانتظار التجهيز', 'الاشتراك اتأكد والصندوق لسه ماتجهّزش.', 48, 'rule', 21),
  ('box', 'preparing', 'قيد التجهيز', 'الصندوق بيتجهّز.', 72, 'rule', 22),
  ('box', 'shipped',   'في الشحن', 'الصندوق اتشحن — متابعة التوصيل.', 120, 'rule', 23),
  -- بداية الرحلة (الحجوزات)
  ('courses', 'payment',   'مراجعة الدفع', 'أول ما العميل يرفع الإيصال — يتأكد من التحويل ويأكد الدفع.', 24, 'rule', 10),
  ('courses', 'fulfilment', 'التنفيذ', 'بعد تأكيد الدفع — تعيين المدرب والجدولة.', 72, 'rule', 20),
  ('courses', 'active',    'تعيين المدرب والجدولة', 'الحجز فعّال — تعيين المدرب وجدولة الجلسات.', 72, 'rule', 21),
  -- الخدمات الإبداعية
  ('services', 'payment',   'مراجعة الدفع', 'أول ما العميل يرفع الإيصال — يتأكد من التحويل ويأكد الدفع.', 24, 'rule', 10),
  ('services', 'fulfilment', 'التنفيذ', 'بعد تأكيد الدفع — متابعة مقدّم الخدمة.', 72, 'rule', 20),
  ('services', 'paid',        'بانتظار البدء', 'الدفع اتأكد والخدمة لسه ماابتدتش.', 24, 'rule', 21),
  ('services', 'in_progress', 'قيد التنفيذ', 'مقدّم الخدمة شغّال على الطلب.', 168, 'rule', 22),
  ('services', 'delivered',   'تسليم ومتابعة العميل', 'الخدمة اتسلّمت — بانتظار تأكيد العميل واكتمال الطلب.', 72, 'rule', 23)
on conflict (line, step) do nothing;

-- استوديو القصص — نفس مراحل المشروع (story_projects.status).
insert into public.task_steps (line, step, label, hint, sla_hours, owner_kind, sort_order) values
  ('studio', 'brief',                'الطلب', 'استلام الطلب ومراجعة بيانات الطفل والموجز قبل بدء الكتابة.', 24, 'editor', 10),
  ('studio', 'text_draft',           'كتابة النص', 'كتابة مسودة النص (أو مراجعة مسودة الذكاء الاصطناعي) وتجهيزها للمراجعة.', 48, 'editor', 20),
  ('studio', 'text_review',          'مراجعة النص', 'مراجعة النص واعتماده قبل عرضه على العميل.', 24, 'editor', 30),
  ('studio', 'client_text_approval', 'موافقة العميل على النص', 'النص عند العميل — متابعة الرد وتسجيل القرار.', 72, 'editor', 40),
  ('studio', 'character',            'الشخصية', 'تجهيز مرجع الشخصية واعتماده.', 48, 'art_lead', 50),
  ('studio', 'scenes',               'المشاهد', 'تجهيز صفحات المشاهد ورسمها.', 120, 'art_lead', 60),
  ('studio', 'art_review',           'مراجعة الرسوم', 'مراجعة الصفحات واعتماد الرسوم.', 24, 'art_lead', 70),
  ('studio', 'layout',               'التركيب', 'تركيب النص على الصفحات وتجهيز الملف النهائي.', 48, 'art_lead', 80),
  ('studio', 'qa',                   'فحص الجودة', 'الفحص النهائي بقايمة الجودة قبل التسليم.', 24, 'manager', 90),
  ('studio', 'ready',                'جاهز للتسليم', 'القصة جاهزة — التسليم للعميل أو للطباعة.', 24, 'manager', 100),
  ('studio', 'on_hold',              'موقوف مؤقتًا', 'المشروع موقوف — بدون موعد لحد ما يتستأنف.', null, 'manager', 110)
on conflict (line, step) do nothing;


-- ── ٣) سجل التطورات ─────────────────────────────────────────────────────────

create table if not exists public.work_task_events (
  id          bigint generated always as identity primary key,
  task_id     uuid        not null references public.work_tasks(id) on delete cascade,
  kind        text        not null,
  -- null = النظام (محفّز/فحص مواعيد/عميل).
  actor_id    uuid,
  from_value  text,
  to_value    text,
  note        text,
  created_at  timestamptz not null default now(),
  constraint work_task_events_kind check (kind in (
    'created', 'assigned', 'step', 'due', 'priority', 'done', 'reopened',
    'reminder_soon', 'reminder_overdue', 'note')),
  constraint work_task_events_note check (note is null or char_length(note) <= 1000)
);

create index if not exists work_task_events_task_idx on public.work_task_events (task_id, id);
create index if not exists work_task_events_recent_idx on public.work_task_events (created_at desc);

alter table public.work_task_events enable row level security;

drop policy if exists "Admins read task events" on public.work_task_events;
create policy "Admins read task events" on public.work_task_events
  as permissive for select to authenticated
  using (public.is_admin());

-- الإدارة تضيف ملاحظة باسمها بس — باقي الأحداث من المحفّزات.
drop policy if exists "Admins add task notes" on public.work_task_events;
create policy "Admins add task notes" on public.work_task_events
  as permissive for insert to authenticated
  with check (
    public.is_admin()
    and kind = 'note'
    and actor_id = auth.uid()
    and note is not null
    and char_length(btrim(note)) between 1 and 1000
  );

revoke all on public.work_task_events from anon;
revoke all on public.work_task_events from authenticated;
grant select, insert on public.work_task_events to authenticated;
grant all on public.work_task_events to service_role;


-- ── ٤) حساب الموعد ──────────────────────────────────────────────────────────

-- مهلة المرحلة الدقيقة، وإلا مهلة المرحلة العامة (payment/fulfilment).
-- المرحلة الدقيقة المحدّدة بمهلة فاضية (موقوف مثلًا) = من غير موعد، مش رجوع للعامة.
create or replace function public.task_due_for(
  p_line text, p_step text, p_stage text, p_from timestamptz
)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select p_from + make_interval(secs => (s.sla_hours * 3600)::double precision)
    from task_steps s
   where s.line = p_line
     and s.step in (coalesce(p_step, p_stage), p_stage)
   order by (s.step = coalesce(p_step, p_stage)) desc
   limit 1
$$;

revoke all on function public.task_due_for(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.task_due_for(text, text, text, timestamptz) to service_role;


-- ── ٥) بأثر رجعي: المهام الموجودة ───────────────────────────────────────────
-- (قبل المحفّزات الجديدة عشان مايتسجّلش حدث لكل تعديل.)

update public.work_tasks w
   set step_changed_at = w.created_at,
       step = coalesce(
         case
           when w.stage = 'payment' then 'payment'
           when w.status <> 'open' then null
           when w.line in ('enha_lak', 'box') then
             (select o.status::text from public.orders o
               where o.id::text = w.source_id and o.status::text in ('paid', 'preparing', 'shipped'))
           when w.line = 'courses' then
             (select c.status::text from public.course_subscriptions c
               where c.id::text = w.source_id and c.status::text = 'active')
           when w.line = 'services' then
             (select s.status::text from public.service_orders s
               where s.id::text = w.source_id and s.status::text in ('paid', 'in_progress', 'delivered'))
           when w.line = 'studio' then
             (select sp.status from public.story_projects sp where sp.id::text = w.source_id)
         end,
         w.stage)
 where w.step is null;

update public.work_tasks w
   set due_at = public.task_due_for(w.line, w.step, w.stage, w.step_changed_at)
 where w.due_at is null;

alter table public.work_tasks alter column step set not null;

-- سجل رجعي: الإنشاء (والإنجاز لو خلصت).
insert into public.work_task_events (task_id, kind, to_value, created_at)
select w.id, 'created', w.step, w.created_at
  from public.work_tasks w
 where not exists (select 1 from public.work_task_events e where e.task_id = w.id);

insert into public.work_task_events (task_id, kind, actor_id, to_value, created_at)
select w.id, 'done', w.done_by,
       case when w.due_at is null then 'no_due'
            when w.done_at <= w.due_at then 'on_time'
            else 'late' end,
       w.done_at
  from public.work_tasks w
 where w.status = 'done' and w.done_at is not null
   and not exists (select 1 from public.work_task_events e where e.task_id = w.id and e.kind = 'done');


-- ── ٦) المحفّزات على work_tasks ─────────────────────────────────────────────
-- الترتيب بالاسم: a (حارس) ← b (موعد) ← c (سجل).

-- الحارس: من جلسة مستخدم مباشرة (current_user = authenticated). المحفّزات والدوال
-- اللي بتشتغل بصلاحية القاعدة (security definer) مش بتتأثر.
create or replace function public.work_tasks_guard_fn()
returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.step is distinct from old.step
       or new.step_changed_at is distinct from old.step_changed_at
       or new.soon_notified_at is distinct from old.soon_notified_at
       or new.overdue_notified_at is distinct from old.overdue_notified_at then
      raise exception 'المرحلة وعلامات التنبيه بيحدّثها النظام بس' using errcode = '42501';
    end if;
    if (new.due_at is distinct from old.due_at
        or new.priority is distinct from old.priority
        or new.assignee_ids is distinct from old.assignee_ids)
       and not public.admin_has_permission('canAssignWork') then
      raise exception 'تغيير الموعد أو الأولوية أو المسؤول محتاج صلاحية «توزيع المهام والطلبات»'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.work_tasks_deadline_fn()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recalc boolean := false;
begin
  begin
    if tg_op = 'INSERT' then
      new.step := coalesce(nullif(btrim(new.step), ''), new.stage);
      new.step_changed_at := coalesce(new.step_changed_at, now());
      if new.due_at is null then
        new.due_at := public.task_due_for(new.line, new.step, new.stage, new.step_changed_at);
      end if;
      return new;
    end if;

    -- مسارات قديمة ماتعرفش عن step.
    if new.step is null then
      new.step := old.step;
    end if;

    if old.status = 'done' and new.status = 'open' then
      v_recalc := true;                       -- اتفتحت تاني
    elsif new.status = 'open' and new.step is distinct from old.step then
      v_recalc := true;                       -- دخلت مرحلة جديدة
    end if;

    if v_recalc then
      new.step_changed_at := now();
      new.soon_notified_at := null;
      new.overdue_notified_at := null;
      -- الموعد اللي اتحدّد بالإيد بيتفضّل لو اتغيّر في نفس التعديل؛ غير كده بيتحسب من جديد.
      if new.due_at is not distinct from old.due_at then
        new.due_at := public.task_due_for(new.line, new.step, new.stage, new.step_changed_at);
      end if;
    elsif new.due_at is distinct from old.due_at then
      new.soon_notified_at := null;           -- موعد جديد ← تذكير جديد
      new.overdue_notified_at := null;
    end if;
  exception when others then
    raise warning 'work_tasks_deadline_fn: task % — %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function public.work_tasks_events_fn()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_state text;
begin
  begin
    if tg_op = 'INSERT' then
      insert into work_task_events (task_id, kind, to_value) values (new.id, 'created', new.step);
      if cardinality(new.assignee_ids) > 0 then
        insert into work_task_events (task_id, kind, to_value)
        values (new.id, 'assigned', array_to_string(new.assignee_ids, ','));
      end if;
      return null;
    end if;

    if new.assignee_ids is distinct from old.assignee_ids then
      insert into work_task_events (task_id, kind, actor_id, from_value, to_value)
      values (new.id, 'assigned', v_actor,
              array_to_string(old.assignee_ids, ','), array_to_string(new.assignee_ids, ','));
    end if;

    if new.step is distinct from old.step and new.status = 'open' then
      insert into work_task_events (task_id, kind, actor_id, from_value, to_value)
      values (new.id, 'step', v_actor, old.step, new.step);
    end if;

    -- تغيير موعد بالإيد فقط (مش اللي بيتحسب مع مرحلة جديدة / إعادة فتح).
    if new.due_at is distinct from old.due_at
       and new.step is not distinct from old.step
       and not (old.status = 'done' and new.status = 'open') then
      insert into work_task_events (task_id, kind, actor_id, from_value, to_value)
      values (new.id, 'due', v_actor, old.due_at::text, new.due_at::text);
    end if;

    if new.priority is distinct from old.priority then
      insert into work_task_events (task_id, kind, actor_id, from_value, to_value)
      values (new.id, 'priority', v_actor, old.priority, new.priority);
    end if;

    if old.status = 'open' and new.status = 'done' then
      v_state := case
        when new.due_at is null then 'no_due'
        when coalesce(new.done_at, now()) <= new.due_at then 'on_time'
        else 'late'
      end;
      insert into work_task_events (task_id, kind, actor_id, to_value)
      values (new.id, 'done', coalesce(new.done_by, v_actor), v_state);
    elsif old.status = 'done' and new.status = 'open' then
      insert into work_task_events (task_id, kind, actor_id, to_value)
      values (new.id, 'reopened', v_actor, new.step);
    end if;
  exception when others then
    raise warning 'work_tasks_events_fn: task % — %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.work_tasks_guard_fn() from public, anon;
revoke all on function public.work_tasks_deadline_fn() from public, anon, authenticated;
revoke all on function public.work_tasks_events_fn() from public, anon, authenticated;

drop trigger if exists work_tasks_a_guard_trg on public.work_tasks;
create trigger work_tasks_a_guard_trg
  before update on public.work_tasks
  for each row execute function public.work_tasks_guard_fn();

drop trigger if exists work_tasks_b_deadline_trg on public.work_tasks;
create trigger work_tasks_b_deadline_trg
  before insert or update on public.work_tasks
  for each row execute function public.work_tasks_deadline_fn();

drop trigger if exists work_tasks_c_events_trg on public.work_tasks;
create trigger work_tasks_c_events_trg
  after insert or update on public.work_tasks
  for each row execute function public.work_tasks_events_fn();


-- ── ٧) فتح المهمة بمرحلة دقيقة ──────────────────────────────────────────────
-- نفس السلوك القديم + بارامتر step: لو المهمة مفتوحة وجت مرحلة جديدة (paid →
-- preparing مثلًا) المرحلة والموعد بيتحدّثوا بدل ما الاستدعاء يتجاهَل.

drop function if exists public.work_task_open(text, text, text, text, text, text, boolean);

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
begin
  -- المسؤولين اللي لسه إداريين بس (اللي اتشالت صلاحيته مايوصلوش مهام).
  select coalesce(array_agg(r.profile_id order by r.created_at), '{}'::uuid[])
    into v_assignees
    from assignment_rules r
    join user_profiles u on u.id = r.profile_id
   where r.line = p_line and r.stage = p_stage
     and u.role in ('super_admin', 'general_supervisor');

  select * into v_existing from work_tasks
   where line = p_line and source_id = p_source and stage = p_stage;

  if found then
    if v_existing.status = 'open' then
      -- مرحلة دقيقة جديدة على مهمة مفتوحة: حدّث المرحلة (المحفّز بيحسب الموعد).
      if p_step is not null and p_step is distinct from v_existing.step then
        update work_tasks set step = p_step where id = v_existing.id;
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

revoke all on function public.work_task_open(text, text, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.work_task_open(text, text, text, text, text, text, boolean, text) to service_role;

-- نفس محفّز ملف 14 + تمرير المرحلة الدقيقة (حالة الطلب نفسها).
create or replace function public.work_tasks_on_status()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_kind    text := tg_argv[0];
  v_line    text;
  v_label   text;
  v_link    text;
  v_status  text := new.status::text;
  v_paid    boolean;
  v_closed  boolean;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if v_kind = 'orders' then
    v_line  := case when new.box_plan_id is null then 'enha_lak' else 'box' end;
    v_label := case when v_line = 'box' then 'اشتراك صندوق الرحلة' else 'طلب «إنها لك»' end;
    v_link  := '/dashboard/admin/orders/' || new.id::text;
    v_paid  := v_status in ('paid', 'preparing', 'shipped', 'delivered');
    v_closed := v_status in ('delivered', 'cancelled', 'refunded', 'failed');
  elsif v_kind = 'courses' then
    v_line  := 'courses';
    v_label := 'حجز باقة «بداية الرحلة»';
    v_link  := '/dashboard/admin/bookings/' || new.id::text;
    v_paid  := v_status in ('active', 'completed');
    v_closed := v_status in ('completed', 'cancelled');
  else
    v_line  := 'services';
    v_label := 'طلب خدمة إبداعية';
    v_link  := '/dashboard/admin/orders/services/' || new.id::text;
    v_paid  := v_status in ('paid', 'in_progress', 'delivered', 'completed');
    v_closed := v_status in ('completed', 'cancelled', 'refunded');
  end if;

  -- ١) الإيصال وصل ← مراجعة الدفع.
  if v_status = 'awaiting_verification' then
    perform public.work_task_open(v_line, 'payment', new.id::text, new.payment_reference,
      v_label || ' — مراجعة الدفع', v_link, true, 'payment');
  else
    -- خرج من «بانتظار التأكيد» لأي حالة (اتأكد، اترفض، اتلغى) ← مهمة الدفع خلصت.
    perform public.work_task_close(v_line, 'payment', new.id::text);
  end if;

  -- ٢) الدفع اتأكد ← التنفيذ (لحد ما يتسلّم/يكتمل/يتلغى). المرحلة الدقيقة = حالة الطلب.
  if v_closed then
    perform public.work_task_close(v_line, 'fulfilment', new.id::text);
  elsif v_paid then
    perform public.work_task_open(v_line, 'fulfilment', new.id::text, new.payment_reference,
      v_label || ' — التنفيذ', v_link, true, v_status);
  end if;

  return new;
end
$function$;


-- ── ٨) مهام الاستوديو: المرحلة + صاحبها واسمها من الكتالوج ──────────────────

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
  v_assignees uuid[];
  v_one       uuid;
  v_existing  work_tasks;
  v_prev      uuid[];
  v_who       uuid;
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

  -- المشروع خلص ← المهمة تخلص.
  if v_p.status in ('delivered', 'cancelled') then
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

  -- صاحب المرحلة: من كتالوج المراحل (قابل للتعديل من «إعدادات الاستوديو»)،
  -- وإلا التقسيم الأصلي.
  select ts.owner_kind, ts.label into v_kind, v_stage
    from task_steps ts where ts.line = 'studio' and ts.step = v_p.status;
  v_kind := coalesce(v_kind, case
    when v_p.status in ('brief', 'text_draft', 'text_review', 'client_text_approval') then 'editor'
    when v_p.status in ('character', 'scenes', 'art_review', 'layout') then 'art_lead'
    else 'manager' end);

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
  v_assignees := case when v_one is not null then array[v_one] else v_managers end;

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

-- لما اسم مرحلة استوديو أو صاحبها يتغيّر من الإعدادات: المهام المفتوحة عندها تتحدّث.
create or replace function public.task_steps_resync_fn()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if new.line = 'studio'
     and (new.label is distinct from old.label or new.owner_kind is distinct from old.owner_kind) then
    for v_id in select sp.id from story_projects sp where sp.status = new.step loop
      begin
        perform public.story_sync_task(v_id);
      exception when others then
        raise warning 'task_steps_resync_fn: project % — %', v_id, sqlerrm;
      end;
    end loop;
  end if;
  return null;
end;
$$;

revoke all on function public.task_steps_resync_fn() from public, anon, authenticated;

drop trigger if exists task_steps_resync_trg on public.task_steps;
create trigger task_steps_resync_trg
  after update on public.task_steps
  for each row execute function public.task_steps_resync_fn();


-- ── ٩) فحص المواعيد والإشعارات ──────────────────────────────────────────────

-- المديرين: مدير النظام + حاملو «توزيع المهام» (+ «إدارة الاستوديو» لخط الاستوديو).
create or replace function public.work_task_managers(p_line text)
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(u.id order by u.full_name), '{}'::uuid[])
    from user_profiles u
   where u.role in ('super_admin', 'general_supervisor')
     and u.archived_at is null and u.suspended_at is null
     and (
       u.role = 'super_admin'
       or exists (
         select 1 from admin_roles r
          where (r.id = u.admin_role_id or (u.admin_role_id is null and r.is_default))
            and ('canAssignWork' = any (r.permissions)
                 or (p_line = 'studio' and 'canManageStudio' = any (r.permissions)))
       )
     )
$$;

revoke all on function public.work_task_managers(text) from public, anon, authenticated;
grant execute on function public.work_task_managers(text) to service_role;

create table if not exists public.work_task_sweeps (
  id        boolean primary key default true check (id),
  last_run  timestamptz not null default 'epoch'
);
insert into public.work_task_sweeps (id) values (true) on conflict do nothing;
alter table public.work_task_sweeps enable row level security;
revoke all on public.work_task_sweeps from anon, authenticated;
grant all on public.work_task_sweeps to service_role;

-- الفحص نفسه. «قرب» = آخر ٢٥٪ من المهلة (حد أدنى ساعتين). مرة واحدة لكل مرحلة.
create or replace function public.work_tasks_deadline_sweep()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t        record;
  v_soon   integer := 0;
  v_over   integer := 0;
  v_to     uuid[];
  v_who    uuid;
  v_when   text;
  v_ref    text;
  v_lead   interval;
begin
  for t in
    select * from work_tasks
     where status = 'open' and due_at is not null and overdue_notified_at is null
     order by due_at
  loop
    begin
      v_when := to_char(t.due_at at time zone 'Africa/Cairo', 'DD/MM HH24:MI');
      v_ref  := coalesce(' — ' || t.reference, '');

      if now() >= t.due_at then
        select coalesce(array_agg(distinct x), '{}'::uuid[]) into v_to
          from unnest(t.assignee_ids || public.work_task_managers(t.line)) x;
        foreach v_who in array v_to loop
          insert into notifications (recipient_profile_id, title, message, link)
          values (v_who::text, '⚠ فات موعد: ' || t.title,
                  'الموعد كان ' || v_when || v_ref || '. افتح المهمة وحدّد المطلوب.',
                  '/dashboard/admin/tasks/' || t.id::text);
        end loop;
        update work_tasks
           set overdue_notified_at = now(), soon_notified_at = coalesce(soon_notified_at, now())
         where id = t.id;
        insert into work_task_events (task_id, kind, to_value) values (t.id, 'reminder_overdue', t.due_at::text);
        v_over := v_over + 1;

      elsif t.soon_notified_at is null then
        v_lead := greatest((t.due_at - t.step_changed_at) * 0.25, interval '2 hours');
        if now() >= t.due_at - v_lead then
          v_to := case when cardinality(t.assignee_ids) > 0
                       then t.assignee_ids else public.work_task_managers(t.line) end;
          foreach v_who in array v_to loop
            insert into notifications (recipient_profile_id, title, message, link)
            values (v_who::text, '⏰ قرب موعد: ' || t.title,
                    'الموعد ' || v_when || v_ref || '.',
                    '/dashboard/admin/tasks/' || t.id::text);
          end loop;
          update work_tasks set soon_notified_at = now() where id = t.id;
          insert into work_task_events (task_id, kind, to_value) values (t.id, 'reminder_soon', t.due_at::text);
          v_soon := v_soon + 1;
        end if;
      end if;
    exception when others then
      raise warning 'work_tasks_deadline_sweep: task % — %', t.id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('soon', v_soon, 'overdue', v_over);
end;
$$;

revoke all on function public.work_tasks_deadline_sweep() from public, anon, authenticated;
grant execute on function public.work_tasks_deadline_sweep() to service_role;

-- من صفحة المهام: أي إداري يفتحها بيشغّل الفحص لو عدّى ١٠ دقايق على آخر مرة.
create or replace function public.work_tasks_sweep_if_due()
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return null;
  end if;
  update work_task_sweeps set last_run = now()
   where id and last_run < now() - interval '10 minutes';
  if not found then
    return null;
  end if;
  return public.work_tasks_deadline_sweep();
end;
$$;

revoke all on function public.work_tasks_sweep_if_due() from public, anon;
grant execute on function public.work_tasks_sweep_if_due() to authenticated, service_role;
