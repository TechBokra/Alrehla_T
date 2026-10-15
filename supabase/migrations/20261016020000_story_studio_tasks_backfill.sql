-- ============================================================================
-- استوديو القصص — (٢) ربط مهام الإدارة + استيراد الطلبات الحالية
-- ============================================================================
-- يعتمد على: 20261016010000_story_studio_foundation.sql
--
-- ١) مهام الإدارة (`work_tasks` / «مهامي»):
--    • خط مهام جديد `studio` (مرحلة `fulfilment` بس). مهمة **واحدة لكل مشروع**،
--      اسمها وصاحبها بيتغيّروا مع مرحلة المشروع: المحرر في مراحل النص، والمشرف
--      الفني في مراحل الرسم، ومسؤول الإنتاج في الفحص والتسليم والإيقاف (وأي
--      مرحلة مالهاش صاحب معيّن).
--    • مهام «إنها لك» الموجودة (مراجعة الدفع + التنفيذ) **ماتتلمسش** — دي مهمة
--      الطلب (الشحن والتجهيز)، ودي مهمة المشروع (التأليف والرسم). مفيش تعارض في
--      القيد الفريد (line, source_id, stage) لأن الخط مختلف.
--    • المسند له الجديد بيوصله إشعار (زي مهام الطلبات). فشل المزامنة **مايفشّلش**
--      أي عملية على المشروع.
--    • لو الطلب اتلغى/اتردّ والمشروع لسه شغّال: المشروع بيتعلّم `order_closed_at`
--      والمهمة بتروح لمسؤول الإنتاج بعنوان تحذير — القرار (إلغاء المشروع) بشري.
--
-- ٢) الاستيراد بأثر رجعي:
--    • بند مخصّص في طلب مدفوع (paid/preparing/shipped) من غير مشروع ← مشروع.
--      بيتنفّذ مرة هنا، وبعدها `story_backfill_projects()` لمسؤول الإنتاج
--      (لطلبات اتدفعت والاستوديو مقفول).
--    • الطلبات اللي اتسلّمت/اتلغت ماتتستوردش (بتتبدأ يدويًا لو لزم).
--
-- الأمان: كل الدوال security definer بـ search_path ثابت، والمزامنة بتتحقق من أن
-- المسند له إداري غير مؤرشف/موقوف (نفس قاعدة work_task_open).
--
-- التراجع (يدويًا): drop trigger story_projects_task_trg on story_projects;
--   drop trigger story_projects_order_closed_trg on orders;
--   drop function story_sync_task(uuid), story_projects_task_fn(), story_orders_closed_fn(),
--     story_backfill_core(), story_backfill_projects(), story_backfill_pending();
--   delete from work_tasks where line = 'studio'; delete from assignment_rules where line = 'studio';
--   ثم رجّع قيدي work_tasks_line وassignment_rules_line بدون 'studio'،
--   وalter table story_projects drop column order_closed_at.
-- ============================================================================


-- ── ١) خط المهام الجديد ─────────────────────────────────────────────────────

alter table public.work_tasks drop constraint if exists work_tasks_line;
alter table public.work_tasks
  add constraint work_tasks_line check (line in ('enha_lak', 'box', 'courses', 'services', 'studio'));

alter table public.assignment_rules drop constraint if exists assignment_rules_line;
alter table public.assignment_rules
  add constraint assignment_rules_line check (line in ('enha_lak', 'box', 'courses', 'services', 'studio'));

-- الطلب اتلغى/اتردّ والمشروع لسه شغّال.
alter table public.story_projects add column if not exists order_closed_at timestamptz;


-- ── ٢) مزامنة المهمة ────────────────────────────────────────────────────────

create or replace function public.story_sync_task(p_project uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p         record;
  v_child     text;
  v_stage     text;
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

  -- صاحب المرحلة.
  v_one := case
    when v_p.order_closed_at is not null then null
    when v_p.status in ('brief', 'text_draft', 'text_review', 'client_text_approval') then v_p.editor_id
    when v_p.status in ('character', 'scenes', 'art_review', 'layout') then v_p.art_lead_id
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
  v_stage := case v_p.status
    when 'brief' then 'الطلب' when 'text_draft' then 'كتابة النص' when 'text_review' then 'مراجعة النص'
    when 'client_text_approval' then 'موافقة العميل على النص' when 'character' then 'الشخصية'
    when 'scenes' then 'المشاهد' when 'art_review' then 'مراجعة الرسوم' when 'layout' then 'التركيب'
    when 'qa' then 'فحص الجودة' when 'ready' then 'جاهز للتسليم' when 'on_hold' then 'موقوف مؤقتًا'
    else v_p.status end;
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
           assignee_ids = v_assignees,
           status = 'open', done_at = null, done_by = null
     where id = v_existing.id;
  else
    v_prev := '{}'::uuid[];
    insert into work_tasks (line, stage, source_id, reference, title, link, assignee_ids)
    values ('studio', 'fulfilment', p_project::text, v_p.payment_reference, v_title,
            '/dashboard/admin/studio/' || p_project::text, v_assignees);
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

revoke all on function public.story_sync_task(uuid) from public, anon, authenticated;
grant execute on function public.story_sync_task(uuid) to service_role;

create or replace function public.story_projects_task_fn()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.story_sync_task(new.id);
  exception when others then
    raise warning 'story_projects_task_fn: project % — %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.story_projects_task_fn() from public, anon, authenticated;

create trigger story_projects_task_trg
  after insert or update of status, editor_id, art_lead_id, order_closed_at on public.story_projects
  for each row execute function public.story_projects_task_fn();


-- ── ٣) الطلب اتلغى/اتردّ ────────────────────────────────────────────────────

create or replace function public.story_orders_closed_fn()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.status::text in ('cancelled', 'refunded', 'failed')
       and old.status::text not in ('cancelled', 'refunded', 'failed') then
      update story_projects
         set order_closed_at = now()
       where order_id = new.id and order_closed_at is null
         and status not in ('delivered', 'cancelled');
    elsif new.status::text in ('paid', 'preparing', 'shipped', 'delivered')
          and old.status::text in ('cancelled', 'refunded', 'failed') then
      update story_projects set order_closed_at = null
       where order_id = new.id and order_closed_at is not null;
    end if;
  exception when others then
    raise warning 'story_orders_closed_fn: order % — %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.story_orders_closed_fn() from public, anon, authenticated;

create trigger story_projects_order_closed_trg
  after update of status on public.orders
  for each row execute function public.story_orders_closed_fn();


-- ── ٤) الاستيراد بأثر رجعي ──────────────────────────────────────────────────

-- بنود مخصّصة في طلبات مدفوعة (جارية) من غير مشروع.
create or replace function public.story_backfill_core()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_n integer := 0;
  v_item uuid;
begin
  for v_item in
    select oi.id
      from order_items oi
      join orders o on o.id = oi.order_id
      join personalized_products pp on pp.id = oi.product_id
     where pp.category = 'custom'
       and o.status::text in ('paid', 'preparing', 'shipped')
       and not exists (select 1 from story_projects sp where sp.order_item_id = oi.id)
     order by o.created_at nulls last, oi.id
  loop
    if public.story_create_project_for_item(v_item) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.story_backfill_core() from public, anon, authenticated;
grant execute on function public.story_backfill_core() to service_role;

-- كام بند ناقصه مشروع؟ (للشاشة)
create or replace function public.story_backfill_pending()
returns integer
language sql stable security definer set search_path = public as $$
  select case when public.story_studio_access() then (
    select count(*)::integer
      from order_items oi
      join orders o on o.id = oi.order_id
      join personalized_products pp on pp.id = oi.product_id
     where pp.category = 'custom'
       and o.status::text in ('paid', 'preparing', 'shipped')
       and not exists (select 1 from story_projects sp where sp.order_item_id = oi.id)
  ) else 0 end
$$;

revoke all on function public.story_backfill_pending() from public, anon;
grant execute on function public.story_backfill_pending() to authenticated, service_role;

-- استيراد يدوي — مسؤول الإنتاج بس (مايشترطش تشغيل الاستوديو: ده تنظيف لحقّ فات).
create or replace function public.story_backfill_projects()
returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_has_permission('canManageStudio') then
    raise exception 'الاستيراد لمسؤول الإنتاج فقط' using errcode = '42501';
  end if;
  return public.story_backfill_core();
end;
$$;

revoke all on function public.story_backfill_projects() from public, anon;
grant execute on function public.story_backfill_projects() to authenticated, service_role;

-- مرة واحدة الآن: الطلبات المدفوعة الحالية.
select public.story_backfill_core();
