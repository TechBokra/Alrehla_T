-- ============================================================================
-- سجلّ مستحقات موحّد — ومقدّم الخدمة المستقل بقى له رصيد أصلًا
-- ============================================================================
-- العطل الأساسي : **مقدّم الخدمة اللي مش مدرب مالوش أي طريق ياخد فلوسه.**
--
--   ١. العميل بيشتري خدمة من مقدّم «مستقل» → المنصة بتحاسبه
--      (مستحق المقدّم × المعامل + الرسم). يعني فلوس المقدّم **محصَّلة**.
--   ٢. المبلغ بيتخزّن على صف الطلب في `instructor_earning`.
--   ٣. ولوحة المقدّم فيها عمود حرفيًا اسمه **«مستحقك»** — المنصة
--      بتقوله الرقم.
--   ٤. الطلب يكتمل → `record_service_order_earning` بتلاقي
--      `instructor_id IS NULL` (لأنه مش مدرب) **وبترجع `no_instructor`
--      من غير ما تسجّل أي مستحق**.
--   ٥. مفيش جدول مستحقات للمقدّمين أصلًا، و`instructor_payouts` مربوط
--      بمفتاح أجنبي على `instructors` فمينفعش ياخده.
--   ٦. وطلب السحب بيرفضه صراحةً: الدور `service_provider` مش في
--      (`instructor`, `publisher`).
--
--   النتيجة: المنصة بتحصّل، وبتعرض «مستحقك»، **ومفيش في الموقع كله
--   مكان بيسجّل ده كالتزام ولا طريقة يطلبه**.
--
-- العطل التاني  : نظامين متوازيين (`instructor_payouts` و
--   `publisher_payouts`) بنفس المنطق بالظبط. وده مش تكرار كود وبس —
--   **هو سبب ثغرة السحب اللي اتصلّحت في 20261016130000**: محفّز اتكتب
--   لجدول وما اتكتبش للتاني. وإضافة جدول تالت للمقدّمين كانت هتعمّق
--   نفس المشكلة.
--
-- الحل     : سجلّ واحد `payouts` بعمود `owner_kind`. مكان واحد بيتسجّل
--            فيه الاستحقاق، ومكان واحد بيتقفل فيه، ومكان واحد يتصلّح لو
--            اتعطل.
--
-- ⚠️ **الجداول القديمة مابتتمسحش.** صفوفها بتتنقل، وبتفضل في مكانها
--    فاضية — الحذف عملية لا رجوع فيها على جدول مالي، ويستاهل ملفًا
--    منفصلًا بعد ما الجديد يثبت. والكود كله بيتحوّل هنا.
--
-- ⚠️ **الأنواع متشافت، مش متخمّنة:**
--      instructors.id  text | publishers.id text | service_providers.id text
--      withdrawal_requests.id text
--      instructor_payouts.id uuid | publisher_payouts.id uuid
--    فـ`owner_id` و`withdrawal_request_id` **text**.
--
-- ⚠️ **الصلاحيات زيّ ما هي بالظبط.** القراءة لصاحب المستحق، والإدارة
--    الكاملة لمدير النظام — نفس سياسات الجدولين القديمين حرفيًّا،
--    زائد المقدّم. **مفيش توسيع صلاحية في الملف ده.**
--
--    (ملحوظة منفصلة: سياسة الإدارة `is_super_admin()` بينما شاشة
--     المالية متحرّسة بـ`canManageFinance` — فإداري مالية مش مدير
--     نظام بيشوف شاشة فاضية في صمت. مش بغيّرها هنا لأن توسيع صلاحية
--     قرار بيتاخد صريح، مش في ملف تاني.)
--
-- التحقق   : آخر الملف — قراءة بس.
--
-- الرجوع   : الجداول القديمة لسه فيها صفوفها الأصلية (النقل بينسخ
--            مابينقلش)، فالرجوع = إرجاع الكود للجداول القديمة
--            و`drop table public.payouts`.
-- ============================================================================

-- ── ① السجلّ ────────────────────────────────────────────────
create table if not exists public.payouts (
  id                    uuid default gen_random_uuid() not null,
  -- مين صاحب المستحق. **ده اللي كان ناقص** — النظام القديم كان
  -- بيعرف مدرب وناشر وبس.
  owner_kind            text not null,
  -- instructors.id | publishers.id | service_providers.id — كلهم text
  owner_id              text not null,
  period                text not null,
  amount                integer not null,
  status                payout_status_enum default 'pending' not null,
  source_type           text,
  source_id             text,
  description           text,
  -- طلب السحب اللي قفله (محفّز 20261016130000).
  withdrawal_request_id text,
  created_at            timestamptz default now() not null,
  updated_at            timestamptz default now() not null,
  constraint payouts_pkey primary key (id),
  constraint payouts_owner_kind check (owner_kind in ('instructor', 'publisher', 'provider')),
  constraint payouts_amount_positive check (amount > 0)
);

alter table public.payouts enable row level security;

create index if not exists payouts_owner_idx
  on public.payouts (owner_kind, owner_id, status);

create index if not exists payouts_withdrawal_idx
  on public.payouts (withdrawal_request_id)
  where withdrawal_request_id is not null;

-- ⚠️ **الفهارس دي هي اللي بتمنع الدفع مرتين.** نفس ضمانات الجدولين
--    القديمين: مستحق واحد لكل جلسة، وواحد لكل طلب خدمة، وواحد لكل
--    (ناشر + طلب).
create unique index if not exists payouts_session_unique
  on public.payouts (source_id) where source_type = 'session';

create unique index if not exists payouts_service_order_unique
  on public.payouts (source_id) where source_type = 'service_order';

create unique index if not exists payouts_publisher_order_unique
  on public.payouts (owner_id, source_type, source_id)
  where owner_kind = 'publisher' and source_type is not null and source_id is not null;

comment on table public.payouts is
  'سجلّ المستحقات الموحّد — مدرب أو ناشر أو مقدّم خدمة مستقل. بديل instructor_payouts و publisher_payouts.';


-- ── ② الصلاحيات — نفس القديمة حرفيًّا، زائد المقدّم ─────────
drop policy if exists "owner reads own payouts" on public.payouts;
create policy "owner reads own payouts" on public.payouts
  for select to public
  using (
    (owner_kind = 'instructor' and exists (
      select 1 from instructors i
       where i.id::text = payouts.owner_id and i.user_id = auth.uid()))
    or (owner_kind = 'publisher' and exists (
      select 1 from publishers p
       where p.id::text = payouts.owner_id and p.user_id = auth.uid()))
    or (owner_kind = 'provider' and exists (
      select 1 from service_providers s
       where s.id::text = payouts.owner_id and s.user_id = auth.uid()))
  );

drop policy if exists "super admin manages payouts" on public.payouts;
create policy "super admin manages payouts" on public.payouts
  for all to public
  using (is_super_admin())
  with check (is_super_admin());


-- ── ③ نقل الصفوف القديمة ────────────────────────────────────
-- نسخ لا نقل: القديم بيفضل مكانه للرجوع.
insert into public.payouts (
  owner_kind, owner_id, period, amount, status,
  source_type, source_id, description, withdrawal_request_id, created_at, updated_at
)
select 'instructor', instructor_id::text, period, amount, status,
       source_type, source_id, description, withdrawal_request_id, created_at, updated_at
  from public.instructor_payouts
on conflict do nothing;

insert into public.payouts (
  owner_kind, owner_id, period, amount, status,
  source_type, source_id, description, withdrawal_request_id, created_at, updated_at
)
select 'publisher', publisher_id::text, period, amount, status,
       source_type, source_id, description, withdrawal_request_id, created_at, updated_at
  from public.publisher_payouts
on conflict do nothing;


-- ── ④ طلب السحب بقى ياخد مقدّم خدمة كمان ────────────────────
alter table public.withdrawal_requests
  add column if not exists provider_id text;

-- ⚠️ **المفتاح الأجنبي مش تزيين هنا.** شاشة الإدارة بتقرا اسم صاحب
--    الطلب بتضمين `service_providers(display_name)`، و PostgREST
--    مابيعرفش يعمل التضمين ده من غير علاقة معرّفة — فالاستعلام كان
--    هيفشل، وشاشة طلبات السحب تطلع فاضية.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'withdrawal_requests_provider_id_fkey'
  ) then
    alter table public.withdrawal_requests
      add constraint withdrawal_requests_provider_id_fkey
      foreign key (provider_id) references public.service_providers(id) on delete cascade;
  end if;
end $$;

alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_owner_check;

-- واحد بالظبط من التلاتة.
alter table public.withdrawal_requests
  add constraint withdrawal_requests_owner_check check (
    (case when instructor_id is not null then 1 else 0 end)
  + (case when publisher_id  is not null then 1 else 0 end)
  + (case when provider_id   is not null then 1 else 0 end) = 1
  );


-- ⚠️ **وصلاحيات الصف كمان.** سياسات `withdrawal_requests` مكتوبة
--    للمدرب والناشر وبس. من غير السياستين دول، المقدّم:
--      • `INSERT` بتترفض — فالطلب مابيتعملش أصلًا.
--      • `SELECT` بترجّع فاضي — فـ`getMyOpenWithdrawalRequests` تقول
--        صفر، والشاشة تعرض الزرار، والقاعدة ترفض. **فشل صامت.**
drop policy if exists "Providers file their own withdrawal requests" on public.withdrawal_requests;
create policy "Providers file their own withdrawal requests" on public.withdrawal_requests
  for insert to public
  with check (
    status = 'pending' and exists (
      select 1 from service_providers s
       where s.id::text = withdrawal_requests.provider_id and s.user_id = auth.uid())
  );

drop policy if exists "Providers view their own withdrawal requests" on public.withdrawal_requests;
create policy "Providers view their own withdrawal requests" on public.withdrawal_requests
  for select to public
  using (
    exists (
      select 1 from service_providers s
       where s.id::text = withdrawal_requests.provider_id and s.user_id = auth.uid())
  );


-- ── ⑤ مستحق الجلسة → السجلّ الموحّد ─────────────────────────
create or replace function public.record_session_earning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_model   text;
  v_price   integer;
begin
  if NEW.attendance is distinct from 'present' then
    return NEW;
  end if;

  select s.id, s.instructor_id, s.scheduled_at, s.session_number,
         (select w.name from writing_packages w
           join course_subscriptions cs on cs.package_id::text = w.id::text
          where cs.id::text = s.course_subscription_id::text) as package_name
    into v_session
    from sessions s
   where s.id::text = NEW.session_id::text;

  if v_session.instructor_id is null then
    return NEW;
  end if;

  select i.work_model into v_model from instructors i
   where i.id::text = v_session.instructor_id::text;
  if v_model is distinct from 'per_session' then
    return NEW;
  end if;

  select ip.approved_price into v_price from instructor_pricing ip
   where ip.instructor_id::text = v_session.instructor_id::text;
  if v_price is null or v_price <= 0 then
    return NEW;
  end if;

  insert into payouts (
    owner_kind, owner_id, period, amount, status, source_type, source_id, description
  )
  values (
    'instructor',
    v_session.instructor_id::text,
    to_char(v_session.scheduled_at at time zone 'Africa/Cairo', 'YYYY-MM'),
    v_price,
    'pending',
    'session',
    v_session.id::text,
    'جلسة ' || v_session.session_number || coalesce(' — ' || v_session.package_name, '')
  )
  on conflict do nothing;

  return NEW;
end
$$;


-- ── ⑥ مستحق طلب الخدمة → **والمستقل بقى داخل فيه** ──────────
create or replace function public.record_service_order_earning(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_order      record;
  v_earning    numeric;
  v_name       text;
  v_owner_kind text;
  v_owner_id   text;
  v_inserted   integer := 0;
begin
  -- ⚠️ **الحراسة دي منقولة حرفيًّا من النسخة القديمة.** الملف ده
  --    بيوسّع مين **يستحق**، مش مين **يقدر ينادي**. أي تخفيف هنا كان
  --    هيخلّي أي حساب مسجَّل يسجّل مستحقًا على طلب مش بتاعه.
  if v_user is null then
    raise exception 'لازم تسجّل الدخول';
  end if;

  select o.id, o.buyer_profile_id, o.instructor_id, o.provider_id,
         o.instructor_earning, o.amount, o.status, o.standalone_service_id
    into v_order
    from service_orders o
   where o.id::text = p_order_id;

  if not found then
    raise exception 'الطلب مش موجود';
  end if;

  -- المشتري أو الإدارة وبس. مفيش طرف تالت بيسجّل مستحقات.
  if v_order.buyer_profile_id::text <> v_user::text
     and not public.is_admin() then
    raise exception 'الطلب ده مش طلبك';
  end if;

  -- بيسجّل بعد الاكتمال وبس. الدالة مبتقفلش الطلب ومبتغيّرش حالته.
  if v_order.status::text <> 'completed' then
    raise exception 'الطلب لسه ما اكتملش';
  end if;

  -- ⚠️ **هنا كان العطل.** الكود القديم كان بيقف عند
  --    `IF v_order.instructor_id IS NULL THEN RETURN 'no_instructor'`
  --    — ومقدّم الخدمة المستقل **مالوش `instructor_id` بالتعريف**
  --    (قيد `service_providers_kind_shape`: المستقل له `user_id`
  --    و`instructor_id` فاضي). فشغله كان بيكتمل بلا أي مستحق، للأبد.
  if v_order.instructor_id is not null then
    v_owner_kind := 'instructor';
    v_owner_id   := v_order.instructor_id::text;
  elsif v_order.provider_id is not null then
    -- المنصة بتقدّم بنفسها = مفيش مستحق لحد. المستقل = له مستحق.
    select case when sp.kind::text = 'platform' then null else 'provider' end,
           sp.id::text
      into v_owner_kind, v_owner_id
      from service_providers sp
     where sp.id::text = v_order.provider_id::text;
  end if;

  if v_owner_kind is null then
    return jsonb_build_object('recorded', false, 'reason', 'platform_or_no_owner');
  end if;

  v_earning := coalesce(v_order.instructor_earning, v_order.amount);
  if v_earning is null or v_earning <= 0 then
    return jsonb_build_object('recorded', false, 'reason', 'no_amount');
  end if;

  select s.name into v_name from standalone_services s
   where s.id::text = v_order.standalone_service_id::text;

  insert into payouts (
    owner_kind, owner_id, period, amount, status, source_type, source_id, description
  )
  values (
    v_owner_kind, v_owner_id, to_char(now(), 'YYYY-MM'),
    round(v_earning)::integer, 'pending', 'service_order', v_order.id::text,
    coalesce(v_name, 'خدمة إبداعية')
  )
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'recorded', v_inserted > 0,
    'reason', case when v_inserted > 0 then 'inserted' else 'already_recorded' end,
    'ownerKind', v_owner_kind,
    'amount', round(v_earning)::integer
  );
end
$$;


-- ── ⑦ حارس طلب السحب → بيقرا من السجلّ الموحّد ──────────────
create or replace function public.guard_withdrawal_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind      text;
  v_owner     text;
  v_available numeric := 0;
  v_open      integer := 0;
begin
  NEW.status := 'pending';

  if NEW.instructor_id is not null then
    v_kind := 'instructor'; v_owner := NEW.instructor_id::text;
  elsif NEW.publisher_id is not null then
    v_kind := 'publisher';  v_owner := NEW.publisher_id::text;
  elsif NEW.provider_id is not null then
    v_kind := 'provider';   v_owner := NEW.provider_id::text;
  else
    raise exception 'طلب السحب لازم يكون لمدرب أو ناشر أو مقدّم خدمة';
  end if;

  select coalesce(sum(amount), 0) into v_available
    from payouts
   where owner_kind = v_kind and owner_id = v_owner and status = 'pending';

  select count(*) into v_open
    from withdrawal_requests w
   where w.status = 'pending'
     and ((v_kind = 'instructor' and w.instructor_id::text = v_owner)
       or (v_kind = 'publisher'  and w.publisher_id::text  = v_owner)
       or (v_kind = 'provider'   and w.provider_id::text   = v_owner));

  if v_open > 0 then
    raise exception 'فيه طلب سحب مستني المراجعة خلاص';
  end if;

  if v_available <= 0 then
    raise exception 'مفيش رصيد قابل للسحب';
  end if;

  -- ⚠️ المبلغ **بيتكتب، مش بيتفحص** — اللي جه من العميل بيتجاهل.
  NEW.amount := v_available;

  return NEW;
end
$$;


-- ── ⑧ قفل المستحقات عند «تم التحويل» → السجلّ الموحّد ───────
create or replace function public.close_payouts_for_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind   text;
  v_owner  text;
  v_closed integer := 0;
begin
  if NEW.status <> 'paid' or OLD.status = 'paid' then
    return NEW;
  end if;

  if    NEW.instructor_id is not null then v_kind := 'instructor'; v_owner := NEW.instructor_id::text;
  elsif NEW.publisher_id  is not null then v_kind := 'publisher';  v_owner := NEW.publisher_id::text;
  elsif NEW.provider_id   is not null then v_kind := 'provider';   v_owner := NEW.provider_id::text;
  else return NEW;
  end if;

  -- اللي اتعملوا قبل الطلب وبس — المبلغ اتحسب من الرصيد ساعتها،
  -- وشغل اتسجّل بعده مش داخل في الفلوس اللي اتحوّلت.
  update payouts
     set status = 'paid', withdrawal_request_id = NEW.id, updated_at = now()
   where owner_kind = v_kind and owner_id = v_owner
     and status = 'pending' and created_at <= NEW.created_at;
  get diagnostics v_closed = row_count;

  if v_closed = 0 then
    raise notice 'طلب السحب % اتسجّل مدفوعًا ومفيش مستحقات معلّقة اتقفلت', NEW.id;
  end if;

  return NEW;
end
$$;


-- ============================================================================
-- التحقق — قراءة بس
-- ============================================================================
--   -- (أ) النقل تمّ؟
--   select 'قديم: مدربين' as "المصدر", count(*) from instructor_payouts
--   union all select 'قديم: ناشرين', count(*) from publisher_payouts
--   union all select 'الموحّد', count(*) from payouts;
--
--   -- (ب) الدوال اتحدّثت؟ لازم الأربعة ✅
--   select p.proname as "الدالة",
--          case when pg_get_functiondef(p.oid) like '%payouts%'
--               and pg_get_functiondef(p.oid) not like '%instructor_payouts%'
--               and pg_get_functiondef(p.oid) not like '%publisher_payouts%'
--               then '✅' else '🔴 لسه على القديم' end as "النتيجة"
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('record_session_earning','record_service_order_earning',
--                        'guard_withdrawal_request','close_payouts_for_withdrawal');
--
--   -- (ج) طلب السحب بياخد مقدّم؟
--   select case when exists (select 1 from information_schema.columns
--                where table_name='withdrawal_requests' and column_name='provider_id')
--               then '✅' else '🔴' end as "عمود المقدّم";
-- ============================================================================
