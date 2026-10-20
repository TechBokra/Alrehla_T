-- ============================================================================
-- مهام الشحنات الشهرية لصندوق الرحلة.
--
-- اشتراك الصندوق (٣ أو ٦ أو ١٢ شهر) بيتولّد له صف في box_shipments لكل شهر. قبل الملف ده
-- كانت «مهمة التنفيذ» مهمة واحدة للاشتراك كله (بتفضل مفتوحة ومتأخرة طول المدة)، والشحنات
-- الشهرية برّه نظام المهام. بعده:
--
-- 1) task_steps: مرحلة جديدة (box · shipment) «شحنة الشهر» — ليها مسؤولين مختلفين من «التوزيع»
--    (قاعدة مرحلة shipment)، وإلا بيرجع لمسؤولي «التنفيذ» العامين.
-- 2) مهمة لكل شحنة بتتفتح قبل موعدها بعدد أيام (إعداد boxShipmentLeadDays في site_settings.general،
--    الافتراضي ٧، من ١ لـ٦٠). موعد المهمة = موعد الشحنة نفسه (تاريخ التفعيل + (الشهر−١) شهر).
-- 3) المهمة بتتقفل لما الشحنة تتشحن/تتسلّم أو الاشتراك مايبقاش فعّال، وبتتفتح تاني لو الشحنة رجعت.
-- 4) «التنفيذ» العام على طلب الصندوق مابقاش بيتفتح (الشحنة الأولى بتتفتح عند التفعيل). المهام
--    المفتوحة القديمة على اشتراكات ليها شحنات بتتقفل.
-- 5) box_shipment_tasks_sync(): بيتشغّل من cron المهام ومن فتح صفحة المهام (مقيّد بـ١٠ دقايق).
--
-- ⚠️ الأمان: المحفّزات بتلتقط أي خطأ وتحوّله لتحذير — تفعيل الاشتراك وحالة الشحنة أهم من المهمة.
--    الملف مابيغيّرش جداول الاشتراك ولا الشحنات.
--
-- الاختبار: supabase/tests/box_shipment_tasks.sql (معاملة بتتراجع).
-- الرجوع (يدويًا): drop trigger box_shipments_task_trg / box_subscriptions_task_trg؛
--   drop function box_shipment_tasks_sync, box_shipment_task_sync, box_shipment_due,
--   box_shipment_lead_days؛ delete from task_steps where line='box' and step='shipment' (وقواعده)؛
--   وأعِد تعريف work_tasks_on_status وwork_tasks_sweep_if_due من 20261016030000.
-- ============================================================================


-- ── ١) الكتالوج ─────────────────────────────────────────────────────────────

insert into public.task_steps (line, step, label, hint, sla_hours, owner_kind, sort_order, builtin)
values (
  'box', 'shipment', 'شحنة الشهر',
  'مهمة لكل شحنة شهرية في اشتراك الصندوق — بتتفتح قبل الموعد بعدد الأيام المضبوط، وموعدها هو موعد الشحنة نفسه.',
  null, 'rule', 24, true
)
on conflict (line, step) do nothing;


-- ── ٢) الإعداد والموعد ──────────────────────────────────────────────────────

create or replace function public.box_shipment_lead_days()
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when value ->> 'boxShipmentLeadDays' ~ '^[0-9]{1,3}$'
                 then least(greatest((value ->> 'boxShipmentLeadDays')::integer, 1), 60) end
       from site_settings where key = 'general'),
    7)
$$;

-- موعد شحنة الشهر رقم n: تاريخ التفعيل + (n−1) شهر (نهاية الشهر لو اليوم مش موجود).
create or replace function public.box_shipment_due(p_starts timestamptz, p_month integer)
returns timestamptz
language sql immutable as $$
  select ((p_starts at time zone 'UTC') + make_interval(months => greatest(coalesce(p_month, 1) - 1, 0))) at time zone 'UTC'
$$;

revoke all on function public.box_shipment_lead_days() from public, anon;
grant execute on function public.box_shipment_lead_days() to authenticated, service_role;
grant execute on function public.box_shipment_due(timestamptz, integer) to authenticated, service_role;


-- ── ٣) مهمة شحنة واحدة ──────────────────────────────────────────────────────

-- بترجّع: opened | closed | none
create or replace function public.box_shipment_task_sync(p_shipment uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  s        record;
  v_due    timestamptz;
  v_people uuid[];
  v_title  text;
  v_link   text;
  v_child  text;
  v_task   work_tasks;
  v_who    uuid;
begin
  select sh.id, sh.subscription_id, sh.month_number, sh.status, sub.status as sub_status,
         sub.starts_at, sub.months, sub.details, o.payment_reference
    into s
    from box_shipments sh
    join box_subscriptions sub on sub.id = sh.subscription_id
    left join orders o on o.id = sub.order_id
   where sh.id = p_shipment;
  if not found then
    return 'none';
  end if;

  if s.status in ('shipped', 'delivered') or s.sub_status <> 'active' or s.starts_at is null then
    if exists (select 1 from work_tasks where line = 'box' and stage = 'fulfilment'
                and source_id = p_shipment::text and status = 'open') then
      perform public.work_task_close('box', 'fulfilment', p_shipment::text);
      return 'closed';
    end if;
    return 'none';
  end if;

  v_due := public.box_shipment_due(s.starts_at, s.month_number);
  if now() < v_due - make_interval(days => public.box_shipment_lead_days()) then
    return 'none';  -- لسه بدري
  end if;

  select * into v_task from work_tasks
   where line = 'box' and stage = 'fulfilment' and source_id = p_shipment::text;
  if found then
    if v_task.status = 'open' then
      return 'none';
    end if;
    -- الشحنة رجعت للتجهيز بعد ما كانت اتقفلت ← نفس المهمة تتفتح تاني بنفس الموعد.
    update work_tasks set status = 'open', done_at = null, done_by = null, step = 'shipment'
     where id = v_task.id;
    update work_tasks set due_at = v_due where id = v_task.id;
    return 'opened';
  end if;

  v_people := public.task_rule_people('box', 'fulfilment', 'shipment');
  v_child  := nullif(btrim(coalesce(s.details ->> 'childName', '')), '');
  v_title  := 'صندوق الرحلة — شحنة الشهر ' || s.month_number::text
              || case when s.months is not null then ' من ' || s.months::text else '' end
              || coalesce(' — ' || v_child, '');
  v_link   := '/dashboard/admin/subscriptions/box/' || s.subscription_id::text;

  insert into work_tasks (line, stage, source_id, reference, title, link, assignee_ids, step, due_at)
  values ('box', 'fulfilment', p_shipment::text, s.payment_reference, v_title, v_link, v_people, 'shipment', v_due)
  on conflict (line, source_id, stage) do nothing;

  foreach v_who in array v_people loop
    insert into notifications (recipient_profile_id, title, message, link)
    values (
      v_who::text, v_title,
      'مسند ليك' || case when s.payment_reference is not null then ' — ' || s.payment_reference else '' end
        || '. تلاقيه في «مهامي».',
      v_link
    );
  end loop;
  return 'opened';
end;
$$;

revoke all on function public.box_shipment_task_sync(uuid) from public, anon, authenticated;
grant execute on function public.box_shipment_task_sync(uuid) to service_role;


-- ── ٤) كل الشحنات (cron + فتح صفحة المهام) ──────────────────────────────────

create or replace function public.box_shipment_tasks_sync()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r        record;
  v_res    text;
  v_open   integer := 0;
  v_closed integer := 0;
begin
  for r in
    select sh.id
      from box_shipments sh
      join box_subscriptions sub on sub.id = sh.subscription_id
     where (sh.status in ('pending', 'preparing') and sub.status = 'active' and sub.starts_at is not null
            and now() >= public.box_shipment_due(sub.starts_at, sh.month_number)
                         - make_interval(days => public.box_shipment_lead_days()))
        or exists (select 1 from work_tasks w
                    where w.line = 'box' and w.stage = 'fulfilment' and w.status = 'open'
                      and w.source_id = sh.id::text
                      and (sh.status in ('shipped', 'delivered') or sub.status <> 'active'))
  loop
    begin
      v_res := public.box_shipment_task_sync(r.id);
      if v_res = 'opened' then v_open := v_open + 1;
      elsif v_res = 'closed' then v_closed := v_closed + 1;
      end if;
    exception when others then
      raise warning 'box_shipment_tasks_sync: shipment % — %', r.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('opened', v_open, 'closed', v_closed);
end;
$$;

revoke all on function public.box_shipment_tasks_sync() from public, anon, authenticated;
grant execute on function public.box_shipment_tasks_sync() to service_role;


-- ── ٥) المحفّزات ────────────────────────────────────────────────────────────

create or replace function public.box_shipments_task_fn()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.box_shipment_task_sync(new.id);
  exception when others then
    raise warning 'box_shipments_task_fn: shipment % — %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

create or replace function public.box_subscriptions_task_fn()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  begin
    for r in select id from box_shipments where subscription_id = new.id loop
      perform public.box_shipment_task_sync(r.id);
    end loop;
  exception when others then
    raise warning 'box_subscriptions_task_fn: subscription % — %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.box_shipments_task_fn() from public, anon, authenticated;
revoke all on function public.box_subscriptions_task_fn() from public, anon, authenticated;

drop trigger if exists box_shipments_task_trg on public.box_shipments;
create trigger box_shipments_task_trg
  after insert or update of status on public.box_shipments
  for each row execute function public.box_shipments_task_fn();

drop trigger if exists box_subscriptions_task_trg on public.box_subscriptions;
create trigger box_subscriptions_task_trg
  after update of status on public.box_subscriptions
  for each row execute function public.box_subscriptions_task_fn();


-- ── ٦) «التنفيذ» العام على طلب الصندوق ──────────────────────────────────────

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
  elsif v_paid and v_line <> 'box' then
    -- صندوق الرحلة: التنفيذ مهمة لكل شحنة شهرية (box_shipment_task_sync)، مش مهمة واحدة للاشتراك كله.
    perform public.work_task_open(v_line, 'fulfilment', new.id::text, new.payment_reference,
      v_label || ' — التنفيذ', v_link, true, v_status);
  end if;

  return new;
end
$function$;


-- المهام المفتوحة القديمة على اشتراكات ليها شحنات: الشحنات الشهرية بقت بديلها.
update public.work_tasks w
   set status = 'done', done_at = now()
 where w.line = 'box' and w.stage = 'fulfilment' and w.status = 'open'
   and exists (select 1 from public.box_subscriptions s where s.order_id::text = w.source_id);


-- ── ٧) الفحص من صفحة المهام ─────────────────────────────────────────────────

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
  begin
    perform public.box_shipment_tasks_sync();
  exception when others then
    raise warning 'work_tasks_sweep_if_due: box sync — %', sqlerrm;
  end;
  return public.work_tasks_deadline_sweep();
end;
$$;

revoke all on function public.work_tasks_sweep_if_due() from public, anon;
grant execute on function public.work_tasks_sweep_if_due() to authenticated, service_role;

-- الشحنات المستحقة دلوقتي تتفتح لها مهام.
select public.box_shipment_tasks_sync();
