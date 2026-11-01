-- ═══════════════════════════════════════════════════════════════
-- صندوق الرحلة: أسبوع شحن محدد لكل شحنة + الشحنة اللي بعدها مقفولة لحد وقتها
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — طلب تامر (١ نوفمبر):
--   «كل طلب لازم يكون له حدود معيّنة بتتعمل مع تأكيد الطلب: هيبتدي إمتى،
--    ومعاه يتحدد ميعاد كل الشحنات. لا يتم شحن الشحنة إلا في الأسبوع المحدد
--    لها. لا تكون الشحنات التالية فعّالة إلا لما اللي قبلها تطلع أو ييجي وقتها.»
--
-- القواعد:
--   • البداية = تأكيد الدفع (`starts_at`، زي ما هي) — والإدارة تقدر تغيّرها
--     طول ما مفيش شحنة اتشحنت (`box_subscription_set_start`).
--   • أسبوع الشحنة رقم n = الأسبوع (سبت ← جمعة، بتوقيت القاهرة) اللي فيه
--     «البداية + (n-1) شهر».  ← `box_shipment_week_start`
--   • الشحنة **فعّالة** لو: هي الأولى، أو اللي قبلها اتشحنت/اتسلّمت، أو
--     أسبوعها جه.  ← `box_shipment_active`
--   • «بدأ التجهيز» محتاج الشحنة فعّالة. «اتشحن» محتاج كمان إن أسبوعها
--     يكون بدأ (مش قبله). بعد الأسبوع مسموح — بتتعلّم «متأخرة» بس، عشان
--     الطفل مايخسرش صندوقه.
--   • الحالات بالترتيب: لسه ← بيتجهّز ← اتشحن ← اتسلّم (مفيش رجوع).
--   • مهمة التجهيز بتتفتح قبل الأسبوع بـ«أيام التجهيز» (الإعدادات، ٧ افتراضي)
--     **ولو الشحنة فعّالة بس**، وموعدها آخر يوم في الأسبوع.
--
-- ⚠️ الحارس على المستخدمين بس (authenticated) — الدوال الداخلية والصيانة
--    بمفتاح الخدمة مش متقيّدة.
--
-- الأثر: دوال + حارس على box_shipments. مفيش بيانات بتتغيّر.
--   الاشتراكين الحاليين (بدأوا ١٦ أكتوبر): شحنة الشهر الأول أسبوعها
--   ١٠–١٦ أكتوبر (متأخرة)، والتاني ١٤–٢٠ نوفمبر ومقفولة لحد كده.
-- الترتيب: بعد `20261016060000_box_shipment_tasks`.
-- التحقق:
--   select month_number, public.box_shipment_week_start(s.starts_at, month_number), public.box_shipment_active(sh.id)
--     from box_shipments sh join box_subscriptions s on s.id = sh.subscription_id order by 1;
-- الرجوع:
--   drop trigger if exists box_shipments_guard_trg on public.box_shipments;
--   drop function if exists public.box_shipments_guard_fn(), public.box_subscription_set_start(uuid, date),
--     public.box_shipment_active(uuid), public.box_shipment_week_start(timestamptz, integer);
--   وتشغيل box_shipment_task_sync / box_shipment_tasks_sync / box_shipments_task_fn من 20261016060000.
-- ═══════════════════════════════════════════════════════════════

-- ── أسبوع الشحنة (يبدأ السبت، بتوقيت القاهرة) ────────────────
create or replace function public.box_shipment_week_start(p_starts timestamptz, p_month integer)
returns date
language sql
stable
set search_path = public
as $$
  select d - ((extract(dow from d)::int + 1) % 7)
    from (select (public.box_shipment_due(p_starts, p_month) at time zone 'Africa/Cairo')::date as d) x
$$;

create or replace function public.box_cairo_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Africa/Cairo')::date $$;

-- ── الشحنة فعّالة؟ ────────────────────────────────────────────
create or replace function public.box_shipment_active(p_shipment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select sh.month_number = 1
      or public.box_cairo_today() >= public.box_shipment_week_start(sub.starts_at, sh.month_number)
      or exists (select 1 from box_shipments p
                  where p.subscription_id = sh.subscription_id
                    and p.month_number = sh.month_number - 1
                    and p.status in ('shipped', 'delivered'))
    from box_shipments sh
    join box_subscriptions sub on sub.id = sh.subscription_id
   where sh.id = p_shipment and sub.starts_at is not null
$$;

-- ── الحارس ────────────────────────────────────────────────────
create or replace function public.box_shipments_guard_fn()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sub   record;
  v_week  date;
begin
  if new.status is not distinct from old.status or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if not (   (old.status = 'pending'   and new.status in ('preparing', 'shipped'))
          or (old.status = 'preparing' and new.status = 'shipped')
          or (old.status = 'shipped'   and new.status = 'delivered')) then
    raise exception 'الشحنة بتمشي بالترتيب: لسه ← بيتجهّز ← اتشحن ← اتسلّم' using errcode = '23514';
  end if;

  select status, starts_at into v_sub from box_subscriptions where id = new.subscription_id;
  if new.status in ('preparing', 'shipped') then
    if v_sub.status <> 'active' then
      raise exception 'الاشتراك مش نشط — شغّله الأول' using errcode = '23514';
    end if;
    if v_sub.starts_at is null then
      raise exception 'حدّد تاريخ بداية الاشتراك الأول' using errcode = '23514';
    end if;
    v_week := public.box_shipment_week_start(v_sub.starts_at, new.month_number);
    if not public.box_shipment_active(new.id) then
      raise exception 'شحنة الشهر % لسه مش فعّالة — بتتفتح لما شحنة الشهر % تطلع أو ييجي أسبوعها (%).',
        new.month_number, new.month_number - 1, to_char(v_week, 'YYYY-MM-DD') using errcode = '23514';
    end if;
    if new.status = 'shipped' and public.box_cairo_today() < v_week then
      raise exception 'شحنة الشهر % بتتشحن في أسبوعها بس: من % لـ %.',
        new.month_number, to_char(v_week, 'YYYY-MM-DD'), to_char(v_week + 6, 'YYYY-MM-DD') using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists box_shipments_guard_trg on public.box_shipments;
create trigger box_shipments_guard_trg
  before update of status on public.box_shipments
  for each row execute function public.box_shipments_guard_fn();

-- ── مهمة التجهيز: بالأسبوع والتفعيل ──────────────────────────
create or replace function public.box_shipment_task_sync(p_shipment uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  s        record;
  v_week   date;
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

  v_week := public.box_shipment_week_start(s.starts_at, s.month_number);
  -- الموعد = آخر يوم في الأسبوع (بداية السبت اللي بعده بتوقيت القاهرة).
  v_due := ((v_week + 7)::timestamp at time zone 'Africa/Cairo');
  if public.box_cairo_today() < v_week - public.box_shipment_lead_days()
     or not public.box_shipment_active(p_shipment) then
    return 'none';  -- لسه بدري، أو اللي قبلها لسه ماطلعتش
  end if;

  select * into v_task from work_tasks
   where line = 'box' and stage = 'fulfilment' and source_id = p_shipment::text;
  if found then
    if v_task.status = 'open' then
      if v_task.due_at is distinct from v_due then
        update work_tasks set due_at = v_due where id = v_task.id;
      end if;
      return 'none';
    end if;
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
        || '. أسبوع الشحن: ' || to_char(v_week, 'YYYY-MM-DD') || ' ← ' || to_char(v_week + 6, 'YYYY-MM-DD')
        || '. تلاقيه في «مهامي».',
      v_link
    );
  end loop;
  return 'opened';
end;
$$;

revoke all on function public.box_shipment_task_sync(uuid) from public, anon, authenticated;
grant execute on function public.box_shipment_task_sync(uuid) to service_role;

-- الكرون: كل الشحنات المفتوحة في الاشتراكات النشطة + أي مهمة لازم تتقفل.
create or replace function public.box_shipment_tasks_sync()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
     where (sh.status in ('pending', 'preparing') and sub.status = 'active' and sub.starts_at is not null)
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

-- شحنة اتشحنت ← اللي بعدها ممكن تكون اتفعّلت، فمهمتها تتفتح على طول.
create or replace function public.box_shipments_task_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next uuid;
begin
  begin
    perform public.box_shipment_task_sync(new.id);
    if new.status in ('shipped', 'delivered') then
      select id into v_next from box_shipments
       where subscription_id = new.subscription_id and month_number = new.month_number + 1;
      if v_next is not null then
        perform public.box_shipment_task_sync(v_next);
      end if;
    end if;
  exception when others then
    raise warning 'box_shipments_task_fn: shipment % — %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

-- ── الإدارة تحدّد تاريخ البداية (قبل أول شحنة) ───────────────
create or replace function public.box_subscription_set_start(p_subscription uuid, p_start date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub    record;
  v_starts timestamptz;
  r        record;
begin
  if not public.admin_has_permission('canManageSubscriptions') then
    raise exception 'للإدارة بس' using errcode = '42501';
  end if;
  if p_start is null
     or p_start < public.box_cairo_today() - 60
     or p_start > public.box_cairo_today() + 120 then
    raise exception 'تاريخ البداية لازم يكون من شهرين فاتوا لحد ٤ شهور قدّام' using errcode = '22023';
  end if;

  select id, months into v_sub from box_subscriptions where id = p_subscription for update;
  if not found then
    raise exception 'الاشتراك مش موجود' using errcode = '23503';
  end if;
  if exists (select 1 from box_shipments where subscription_id = p_subscription
              and status in ('preparing', 'shipped', 'delivered')) then
    raise exception 'فيه شحنة بدأت تتجهّز أو اتشحنت — تاريخ البداية مابقاش يتغيّر' using errcode = '23514';
  end if;

  -- الضهر بتوقيت القاهرة: بعيد عن حدود اليوم في أي منطقة زمنية.
  v_starts := ((p_start::timestamp + interval '12 hours') at time zone 'Africa/Cairo');
  update box_subscriptions
     set starts_at          = v_starts,
         ends_at            = v_starts + make_interval(months => greatest(coalesce(v_sub.months, 1), 1)),
         next_shipment_date = v_starts,
         updated_at         = now()
   where id = p_subscription;

  -- المهام المفتوحة بتتقفل وبتتحسب من جديد على الجدول الجديد.
  for r in select id from box_shipments where subscription_id = p_subscription loop
    if exists (select 1 from work_tasks where line = 'box' and stage = 'fulfilment'
                and source_id = r.id::text and status = 'open') then
      perform public.work_task_close('box', 'fulfilment', r.id::text);
    end if;
    perform public.box_shipment_task_sync(r.id);
  end loop;

  return jsonb_build_object('ok', true, 'startsAt', v_starts);
end $$;

revoke execute on function public.box_subscription_set_start(uuid, date) from public, anon;
grant execute on function public.box_subscription_set_start(uuid, date) to authenticated;
revoke execute on function public.box_shipment_active(uuid) from public, anon;
grant execute on function public.box_shipment_active(uuid) to authenticated, service_role;
