-- ═══════════════════════════════════════════════════════════════
-- تصحيح نقاط التكدّس — التوزيع، السجل، والحفظ
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — خريطة البيانات (٢٧ أكتوبر)، تامر: «ابدأ التصحيح».
--
-- ── البند ١: طابور الاستوديو واقف ───────────────────────────
--
--   اللي لقيته: 14 مشروع قصة + 3 مهام (صندوق/إنها لك) **من غير ولا مسؤول**.
--   السبب مش إهمال — الكود:
--     • `story_sync_task` لو مفيش قاعدة توزيع، بيدوّر على «حاملي صلاحية
--       canManageStudio» من خلال `admin_roles`. والمشرفين الستة كلهم
--       `super_admin` **من غير دور** — فالبحث بيرجّع صفر. ومحدش بيتبلّغ.
--     • `work_task_open` (الصندوق، إنها لك) لو مفيش قاعدة → المهمة فاضية.
--
--   اللي بيتعمل:
--     ١) الاتنين بيرجعوا لـ`work_task_managers(line)` (اللي بتشمل المشرف
--        العام) لما مفيش قاعدة — نفس اللي فحص المواعيد بيعمله أصلًا.
--     ٢) **توزيع تلقائي بالأقل شغلًا**: لما مشروع يدخل مرحلة صاحبها «محرّر»
--        أو «مشرف فني» ومافيش حد متعيّن، بيتعيّن واحد من ناس المرحلة في
--        «توزيع المهام» — اللي معاه أقل مشاريع مفتوحة.
--        لو مفيش ناس للمرحلة، المهمة بتروح لمسؤولي الإنتاج زي ما هي.
--     ٣) المهام الفاضية الحالية بتتسند لمسؤولي الخط **من غير إشعارات**
--        (عشان مايوصلش 80 إشعار مرة واحدة) — والملخّص اليومي بالإيميل
--        (في الكود) هو اللي بيبلّغ.
--
-- ── البند ٤: سجل التدقيق ────────────────────────────────────
--     فهرس على التاريخ — الشاشة بتقرا الأحدث، وكانت بتلف على الجدول كله.
--
-- ── البند ٦: جداول بتكبر للأبد ──────────────────────────────
--     `ops_retention_sweep()` بتتنادى من المهمة اليومية:
--       • الإشعارات **المقروءة** الأقدم من 90 يوم بتتمسح.
--       • سجل التدقيق الأقدم من سنة **بيتنقل** لـ`audit_logs_archive` (مش بيتمسح).
--       • سجل الدفع `payment_events` مابيتلمسش (سجل مالي).
--
-- ── البند ٧: «طلباتي» واحد واحد ─────────────────────────────
--     `my_story_image_reviews_all()` — صور كل طلبات العميل في نداء واحد.
--
-- الأثر
--   • تعديل نصّي في دالتين (بيتأكد من النص الأصلي، ولو مالقاهوش بيوقف).
--   • محفّز جديد على story_projects (قبل الإضافة/تغيير المرحلة).
--   • تحديث assignee_ids للمهام المفتوحة الفاضية بس.
--   • جدول أرشيف + فهرسين + دالتين.
--
-- الترتيب
--   بعد `20261027090000_training_settings_and_hidden_answers`.
--
-- التحقق
--   1) select count(*) from work_tasks where status='open' and coalesce(cardinality(assignee_ids),0)=0;  ← 0
--   2) select pg_get_functiondef('public.story_sync_task'::regproc) like '%work_task_managers(''studio'')%';  ← true
--   3) select ops_retention_sweep();  ← {"notifications": n, "audit_archived": n}
--
-- الرجوع للخلف
--   drop trigger if exists story_projects_zz_autoassign_trg on public.story_projects;
--   (والتعديلين النصّيين: نفس الاستبدال بالعكس.)
-- ═══════════════════════════════════════════════════════════════

-- ── ١) story_sync_task: الرجوع لمسؤولي الخط ─────────────────
do $$
declare
  v_src text;
  v_old text := 'and ''canManageStudio'' = any (ar.permissions);' || chr(13) || chr(10) || '  end if;';
  v_new text;
begin
  select pg_get_functiondef('public.story_sync_task'::regproc) into v_src;
  if position('work_task_managers(''studio'')' in v_src) > 0 then
    raise notice 'story_sync_task: الرجوع لمسؤولي الخط متطبّق قبل كده';
    return;
  end if;
  -- السطر بينتهي بـ\r\n أو \n حسب ما اتكتب — نجرّب الاتنين.
  if position(v_old in v_src) = 0 then
    v_old := 'and ''canManageStudio'' = any (ar.permissions);' || chr(10) || '  end if;';
  end if;
  if position(v_old in v_src) = 0 then
    raise exception 'ماللقتش فقرة مسؤولي الإنتاج في story_sync_task — راجع بإيدك.';
  end if;
  v_new := replace(v_old, 'end if;',
    'end if;' || chr(10) ||
    '  -- ⚠️ المشرف العام من غير دور مابيتلقطش فوق — الرجوع لمسؤولي الخط (٢٧ أكتوبر).' || chr(10) ||
    '  if cardinality(v_managers) = 0 then' || chr(10) ||
    '    v_managers := public.work_task_managers(''studio'');' || chr(10) ||
    '  end if;');
  execute replace(v_src, v_old, v_new);
end $$;

-- ── ٢) work_task_open: الرجوع لمسؤولي الخط ──────────────────
do $$
declare
  v_src text;
  v_old text := 'v_assignees := public.task_rule_people(p_line, p_stage, p_step);';
  v_new text := 'v_assignees := public.task_rule_people(p_line, p_stage, p_step);' || chr(10) ||
                '  -- مفيش قاعدة توزيع → مسؤولو الخط (٢٧ أكتوبر). كانت المهمة بتتعمل فاضية.' || chr(10) ||
                '  if cardinality(v_assignees) = 0 then' || chr(10) ||
                '    v_assignees := public.work_task_managers(p_line);' || chr(10) ||
                '  end if;';
begin
  select pg_get_functiondef('public.work_task_open'::regproc) into v_src;
  if position('v_assignees := public.work_task_managers(p_line);' in v_src) > 0 then
    raise notice 'work_task_open: متطبّق قبل كده';
    return;
  end if;
  if position(v_old in v_src) = 0 then
    raise exception 'ماللقتش سطر التوزيع في work_task_open — راجع بإيدك.';
  end if;
  -- أول ظهور بس (السطر بيتكرر جوّه فرع المرحلة الجديدة باسم v_fresh، مش v_assignees).
  execute overlay(v_src placing v_new from position(v_old in v_src) for length(v_old));
end $$;

-- ── ٢ب) التوزيع التلقائي بالأقل شغلًا ───────────────────────
create or replace function public.studio_pick_worker(p_step text, p_kind text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.profile_id
    from assignment_rules r
    join user_profiles u on u.id = r.profile_id
   where r.line = 'studio' and r.stage = p_step
     and u.role in ('super_admin', 'general_supervisor')
     and u.archived_at is null and u.suspended_at is null
   order by (
     select count(*) from story_projects sp
      where (case when p_kind = 'art_lead' then sp.art_lead_id else sp.editor_id end) = r.profile_id
        and sp.status not in (select step from task_steps where line = 'studio' and kind in ('done', 'cancel'))
   ), r.created_at
   limit 1
$$;
revoke execute on function public.studio_pick_worker(text, text) from public, anon, authenticated;

create or replace function public.story_projects_autoassign_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
begin
  if new.order_closed_at is not null then
    return new;
  end if;
  select owner_kind into v_kind from task_steps where line = 'studio' and step = new.status;
  if v_kind = 'editor' and new.editor_id is null then
    new.editor_id := public.studio_pick_worker(new.status, 'editor');
  elsif v_kind = 'art_lead' and new.art_lead_id is null then
    new.art_lead_id := public.studio_pick_worker(new.status, 'art_lead');
  end if;
  return new;
end $$;
revoke execute on function public.story_projects_autoassign_fn() from public, anon, authenticated;

-- ⚠️ الاسم بيبدأ بـ`story_projects_zz` عن قصد: محفّزات BEFORE بتشتغل بترتيب
--    الاسم، فده بيشتغل **بعد** الحارس — والحارس مابيشوفش التعيين كتعديل من
--    المدرب.
drop trigger if exists story_projects_zz_autoassign_trg on public.story_projects;
create trigger story_projects_zz_autoassign_trg
  before insert or update of status on public.story_projects
  for each row execute function public.story_projects_autoassign_fn();

-- ── ٢ج) المهام الفاضية الحالية → مسؤولو الخط (من غير إشعارات) ──
update public.work_tasks t
   set assignee_ids = public.work_task_managers(t.line)
 where t.status = 'open'
   and coalesce(cardinality(t.assignee_ids), 0) = 0
   and cardinality(public.work_task_managers(t.line)) > 0;

-- ── ٤) سجل التدقيق: فهرس على التاريخ ────────────────────────
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ── ٦) الحفظ: أرشيف السجل + مسح الإشعارات المقروءة القديمة ──
create table if not exists public.audit_logs_archive (like public.audit_logs including defaults);
alter table public.audit_logs_archive enable row level security;
revoke all on table public.audit_logs_archive from public, anon, authenticated;
create index if not exists audit_logs_archive_created_at_idx on public.audit_logs_archive (created_at desc);

create index if not exists notifications_read_created_idx
  on public.notifications (created_at) where is_read;

create or replace function public.ops_retention_sweep()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notes   integer;
  v_audit   integer;
begin
  -- الإشعارات المقروءة الأقدم من 90 يوم. غير المقروء مابيتلمسش.
  delete from notifications where is_read and created_at < now() - interval '90 days';
  get diagnostics v_notes = row_count;

  -- السجل الأقدم من سنة بيتنقل للأرشيف (مش بيتمسح).
  with moved as (
    delete from audit_logs where created_at < now() - interval '365 days' returning *
  )
  insert into audit_logs_archive select * from moved;
  get diagnostics v_audit = row_count;

  return jsonb_build_object('notifications', v_notes, 'audit_archived', v_audit);
end $$;
revoke execute on function public.ops_retention_sweep() from public, anon, authenticated;
grant execute on function public.ops_retention_sweep() to service_role;

-- ── ٧) صور البطل لكل طلبات العميل في نداء واحد ──────────────
create or replace function public.my_story_image_reviews_all()
returns table (
  order_id           uuid,
  order_item_id      uuid,
  status             text,
  sent_at            timestamptz,
  decided_at         timestamptz,
  character_approved boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, sp.order_item_id, r.status, r.sent_at, r.decided_at, sp.character_approved_at is not null
    from public.orders o
    join public.story_projects sp on sp.order_id = o.id
    join public.story_image_reviews r on r.project_id = sp.id
   where (select auth.uid()) is not null
     and o.user_id = (select auth.uid())
     and o.status in ('paid', 'preparing')
     and r.status <> 'withdrawn'
   order by o.id, sp.order_item_id, r.sent_at desc
$$;
revoke execute on function public.my_story_image_reviews_all() from public, anon;
grant execute on function public.my_story_image_reviews_all() to authenticated;
