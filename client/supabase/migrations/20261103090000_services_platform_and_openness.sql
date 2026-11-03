-- ═══════════════════════════════════════════════════════════════
-- الخدمات الإبداعية: المنصة مقدّم تلقائي بسعر الكارت + مين يقدّم الخدمة
-- + اسم المدرب الحالي + المدرب يظهر في باقاته بس
-- ═══════════════════════════════════════════════════════════════
--
-- تعليقات فريق العمل (٣ نوفمبر):
--   ١) «المدرب لا يظهر في أي باقة طالما إنه لم يخصّص باقاته» — كانت
--      القايمة الفاضية = كل الباقات. دلوقتي الفاضية = ولا باقة، والحارس
--      بيرفض حجز مع مدرب مش مسجّل على الباقة.
--   ٢) «السعر الجديد مش ظاهر في الموقع بعد تعديله من كارت الخدمة» — الموقع
--      بيعرض أقل سعر من **عروض المقدّمين**، وعرض المنصة كان بسعر تاني
--      (٥٥٠) غير الكارت (٣٠٠). دلوقتي عرض المنصة = سعر الكارت دايمًا.
--   ٣) «زر يحدد إن كانت الخدمة متاحة للمدربين أو مقدّمي الخدمات أو
--      محصورة بالمنصة» ← عمودين open_to_instructors / open_to_individuals.
--   ٤) «المدرب Test 4 ما زال يظهر بنفس الاسم» — اسم مقدّم الخدمة كان
--      نسخة اتاخدت مرة واحدة. دلوقتي بيتبع اسم المدرب الحالي.
--   ٥) «المنصة مقدّم خدمة تلقائي لكل الخدمات بالسعر اللي حددناه».
--
-- ⚠️ قفل الخدمة على نوع (مثلًا المدربين) بيوقّف عروضهم عليها (is_active =
--    false) — مابيمسحهاش. ولو اتفتحت تاني، الإدارة تفعّلها من «مقدّمو الخدمة».
-- ⚠️ عرض المنصة ماينفعش يتسعّر من «مقدّمو الخدمة» — السعر من كارت الخدمة.
--
-- الأثر:
--   - standalone_services: + open_to_instructors، open_to_individuals (افتراضي true = زي النهارده)
--   - عرض للمنصة على كل خدمة (معتمد، بسعر الكارت). «مراجعة نص» هتبقى ٣٠٠ بدل ٥٥٠.
--   - أسماء مقدّمي الخدمة من المدربين = أسماء المدربين (test 4 ← Esraa fouad،
--     ناهدة احمد ← Rana Mostafa).
--   - المدربين اللي من غير باقات (٣، كلهم لسه في التدريب) مش هيظهروا في أي باقة.
-- الترتيب: بعد ملفات ١ نوفمبر.
-- التحقق:
--   select s.name, s.price, ps.approved_price from standalone_services s
--     join provider_services ps on ps.service_id = s.id
--     join service_providers sp on sp.id = ps.provider_id and sp.kind = 'platform';   ← نفس السعر
-- الرجوع:
--   drop trigger if exists standalone_services_platform_trg on public.standalone_services;
--   drop trigger if exists provider_services_platform_trg on public.provider_services;
--   drop trigger if exists instructors_provider_name_trg on public.instructors;
--   drop trigger if exists service_providers_instructor_name_trg on public.service_providers;
--   (الأعمدة والعروض ممكن تفضل — وجودها مابيكسرش حاجة.)
-- ═══════════════════════════════════════════════════════════════

-- ── ٣) مين يقدّم الخدمة ──────────────────────────────────────
alter table public.standalone_services
  add column if not exists open_to_instructors boolean not null default true,
  add column if not exists open_to_individuals boolean not null default true;

-- ── ٢ و٥) المنصة مقدّم تلقائي بسعر الكارت ─────────────────────
create or replace function public.platform_provider_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select id from service_providers where kind = 'platform' order by created_at limit 1 $$;

-- عرض المنصة: السعر من الكارت دايمًا، ومعتمد.
create or replace function public.provider_services_platform_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_svc  record;
begin
  select kind into v_kind from service_providers where id = new.provider_id;
  select price, open_to_instructors, open_to_individuals into v_svc
    from standalone_services where id = new.service_id;

  if v_kind = 'platform' then
    new.approved_price  := v_svc.price;
    new.requested_price := null;
    new.status          := 'approved';
  elsif new.is_active and new.status = 'approved'
        and ((v_kind = 'instructor' and not coalesce(v_svc.open_to_instructors, true))
          or (v_kind = 'individual' and not coalesce(v_svc.open_to_individuals, true))) then
    -- الخدمة مقفولة على النوع ده — العرض يتسجّل بس مايتفعّلش.
    new.is_active := false;
  end if;
  return new;
end $$;

drop trigger if exists provider_services_platform_trg on public.provider_services;
create trigger provider_services_platform_trg
  before insert or update on public.provider_services
  for each row execute function public.provider_services_platform_fn();

create or replace function public.standalone_services_platform_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_platform uuid := public.platform_provider_id();
begin
  if v_platform is not null then
    insert into provider_services (provider_id, service_id, approved_price, status, is_active, updated_at)
    values (v_platform, new.id, new.price, 'approved', true, now())
    on conflict (provider_id, service_id) do update
      set approved_price = excluded.approved_price, updated_at = now();
  end if;

  -- قفل الخدمة على نوع ← عروضه تتوقف.
  if tg_op = 'UPDATE' then
    if old.open_to_instructors and not new.open_to_instructors then
      update provider_services ps set is_active = false, updated_at = now()
        from service_providers sp
       where sp.id = ps.provider_id and sp.kind = 'instructor' and ps.service_id = new.id and ps.is_active;
    end if;
    if old.open_to_individuals and not new.open_to_individuals then
      update provider_services ps set is_active = false, updated_at = now()
        from service_providers sp
       where sp.id = ps.provider_id and sp.kind = 'individual' and ps.service_id = new.id and ps.is_active;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists standalone_services_platform_trg on public.standalone_services;
create trigger standalone_services_platform_trg
  after insert or update of price, open_to_instructors, open_to_individuals on public.standalone_services
  for each row execute function public.standalone_services_platform_fn();

-- كل الخدمات الحالية: عرض المنصة بسعر الكارت.
insert into provider_services (provider_id, service_id, approved_price, status, is_active, updated_at)
select public.platform_provider_id(), s.id, s.price, 'approved', true, now()
  from standalone_services s
 where public.platform_provider_id() is not null
on conflict (provider_id, service_id) do update
  set approved_price = excluded.approved_price, status = 'approved', updated_at = now();

-- ── ٤) اسم مقدّم الخدمة = اسم المدرب الحالي ──────────────────
create or replace function public.service_providers_instructor_name_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'instructor' and new.instructor_id is not null then
    select coalesce(nullif(btrim(display_name), ''), new.display_name)
      into new.display_name
      from instructors where id = new.instructor_id;
  end if;
  return new;
end $$;

drop trigger if exists service_providers_instructor_name_trg on public.service_providers;
create trigger service_providers_instructor_name_trg
  before insert or update on public.service_providers
  for each row execute function public.service_providers_instructor_name_fn();

create or replace function public.instructors_provider_name_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.display_name is distinct from old.display_name then
    update service_providers set display_name = new.display_name, updated_at = now()
     where instructor_id = new.id and kind = 'instructor';
  end if;
  return null;
end $$;

drop trigger if exists instructors_provider_name_trg on public.instructors;
create trigger instructors_provider_name_trg
  after update of display_name on public.instructors
  for each row execute function public.instructors_provider_name_fn();

update service_providers sp
   set display_name = i.display_name, updated_at = now()
  from instructors i
 where sp.instructor_id = i.id and sp.kind = 'instructor'
   and nullif(btrim(i.display_name), '') is not null
   and sp.display_name is distinct from i.display_name;

-- ── ١) الحجز مع مدرب لازم يكون مسجّل على الباقة ──────────────
do $$
declare
  v_def text;
  v_old text := 'if new.child_id is null then';
  v_new text := '-- المدرب لازم يكون مسجّل على الباقة (تعليقات الفريق، ٣ نوفمبر) — instructor_package_check
  if new.preferred_instructor_id is not null
     and not exists (select 1 from instructor_packages ip
                      where ip.instructor_id::text = new.preferred_instructor_id::text
                        and ip.package_id::text = new.package_id::text) then
    raise exception ''المدرب ده مش بيدرّب الباقة دي — اختار مدرب تاني، أو سيب الاختيار لينا.'';
  end if;

  if new.child_id is null then';
begin
  select pg_get_functiondef('public.guard_course_booking_rules'::regproc) into v_def;
  if position('instructor_package_check' in v_def) > 0 then
    raise notice 'guard_course_booking_rules: already patched';
  elsif position(v_old in v_def) = 0 then
    raise exception 'guard_course_booking_rules: النص المتوقع مش موجود — مااتعدّلش';
  else
    execute replace(v_def, v_old, v_new);
  end if;
end $$;
