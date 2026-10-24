-- ═══════════════════════════════════════════════════════════════
-- قواعد حجز باقات «بداية الرحلة»: «قريبًا» + السن المناسب
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — قرارات تامر (٢٤ أكتوبر):
--
--   ٩)  باقات التخصص تفضل **ظاهرة** وقت الإطلاق، بس الحجز مقفول
--       («قريبًا») مع زرار «بلّغني لما تفتح». والإدارة بتفتحها من
--       شاشة الباقة.
--
--   ١٠) الطفل مايتسجّلش في باقة مش لسنّه (أقل من ١٢ / ١٢ فأكثر)،
--       **إلا** باستثناء من الإدارة على ملف الطفل نفسه.
--
-- ── اللي بيتضاف ──────────────────────────────────────────────
--
--   ١) `creative_writing_packages.booking_open` (افتراضي true)
--      ⚠️ **وباقات التخصص بتتقفل هنا** (`track = 'specialization'`)
--         — ده تنفيذ القرار، مش أثر جانبي. الفتح من شاشة الباقة.
--
--   ٢) `child_profiles.age_group_override` — استثناء الإدارة.
--      NULL = السن من تاريخ الميلاد. ولي الأمر **مايقدرش** يكتبه
--      (محفّز `guard_child_age_override`) — وإلا الاستثناء يبقى
--      زرار في إيد أي حد.
--
--   ٣) `child_age_group(birth, override)` — حساب الفئة، بتوقيت القاهرة.
--
--   ٤) محفّز `guard_course_booking_rules` قبل إضافة أي اشتراك:
--        • الباقة مقفولة → «هتفتح قريبًا»
--        • طفل بلا تاريخ ميلاد ولا استثناء → «سجّل تاريخ الميلاد»
--        • الفئة مش مطابقة → رسالة بتقول السن والباقة المناسبة
--      ⚠️ **الإدارة مستثناة** (`is_admin()`) — حجز يدوي من اللوحة
--         لحالة خاصة مايتمنعش.
--      ⚠️ **محفّز مش تعديل في `create_course_booking`** عن قصد: كده
--         أي طريق بيكتب اشتراك (الدالة، أو موافقة ولي الأمر على طلب
--         ابنه، أو أي حاجة تتضاف بعدين) بيعدّي على نفس الحارس، ومفيش
--         نص دالة بيتلمس — فالتجريبي والإنتاج مايختلفوش.
--      ⚠️ حجز `self` (صاحب الحساب نفسه) مابيتفحصش سنّه: مفيش تاريخ
--         ميلاد على حسابات البالغين.
--
--   ٥) `package_interest` — «بلّغني لما تفتح»: صف لكل (باقة، مستخدم).
--
-- الأثر
--   • عمودين جداد بقيم افتراضية آمنة، وجدول جديد، ودالة، ومحفّزين.
--   • الصف الوحيد اللي بيتغيّر: باقات التخصص booking_open = false.
--   • الاشتراكات الموجودة **مابتتلمسش** (المحفّز على INSERT بس).
--
-- الترتيب
--   مستقل. الكود بيشتغل قبله وبعده (العمود الناقص = «مفتوحة»).
--
-- التحقق بعد التشغيل
--   1) select name, track, booking_open from creative_writing_packages order by track;
--      ← specialization = false، الباقي true
--   2) select public.child_age_group(current_date - interval '8 years', null);   ← under_12
--      select public.child_age_group(current_date - interval '13 years', null);  ← 12_plus
--      select public.child_age_group(current_date - interval '8 years', '12_plus'); ← 12_plus
--   3) من حساب ولي أمر (مش لوحة SQL):
--        update child_profiles set age_group_override = '12_plus' where id = '<طفله>';
--      ← خطأ «الاستثناء ده من الإدارة بس»
--   4) حجز طفل عنده ٨ سنين في باقة 12_plus من الموقع ← رسالة السن.
--
-- الرجوع للخلف
--   drop trigger if exists guard_course_booking_rules on public.course_subscriptions;
--   drop trigger if exists guard_child_age_override on public.child_profiles;
--   drop function if exists public.guard_course_booking_rules();
--   drop function if exists public.guard_child_age_override();
--   drop function if exists public.child_age_group(date, text);
--   drop table if exists public.package_interest;
--   alter table public.child_profiles drop column if exists age_group_override;
--   alter table public.creative_writing_packages drop column if exists booking_open;
-- ═══════════════════════════════════════════════════════════════

-- ── ١) الباقة مفتوحة للحجز؟ ──────────────────────────────────
-- ⚠️ القفل المبدئي لباقات التخصص بيحصل **مرة واحدة بس، لما العمود
--    يتعمل**. لو الترحيل اتشغّل تاني بعد ما الإدارة فتحت باقة، مايرجعش
--    يقفلها.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'creative_writing_packages'
       and column_name = 'booking_open'
  ) then
    alter table public.creative_writing_packages
      add column booking_open boolean not null default true;
    update public.creative_writing_packages
       set booking_open = false
     where track = 'specialization';
  end if;
end $$;

comment on column public.creative_writing_packages.booking_open is
  'false = الباقة ظاهرة بس الحجز «قريبًا» (قرار ٢٤ أكتوبر). مختلف عن is_active اللي بيخفيها خالص.';

-- ── ٢) استثناء السن ─────────────────────────────────────────
alter table public.child_profiles
  add column if not exists age_group_override text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'child_profiles_age_group_override_check'
  ) then
    alter table public.child_profiles
      add constraint child_profiles_age_group_override_check
      check (age_group_override is null or age_group_override in ('under_12', '12_plus'));
  end if;
end $$;

comment on column public.child_profiles.age_group_override is
  'استثناء من الإدارة: الطفل يتعامل كأنه في الفئة دي بغض النظر عن تاريخ ميلاده. ولي الأمر مايقدرش يكتبه.';

create or replace function public.guard_child_age_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.age_group_override is distinct from
     (case when tg_op = 'UPDATE' then old.age_group_override else null end)
     and not public.is_admin()
     -- لوحة SQL والمهام الداخلية (من غير مستخدم) مسموح لها.
     and auth.uid() is not null
  then
    raise exception 'الاستثناء ده من الإدارة بس.';
  end if;
  return new;
end $$;

drop trigger if exists guard_child_age_override on public.child_profiles;
create trigger guard_child_age_override
  before insert or update of age_group_override on public.child_profiles
  for each row execute function public.guard_child_age_override();

-- ── ٣) فئة الطفل ────────────────────────────────────────────
create or replace function public.child_age_group(p_birth date, p_override text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_override in ('under_12', '12_plus') then p_override
    when p_birth is null then null
    when extract(year from age((now() at time zone 'Africa/Cairo')::date, p_birth)) < 12
      then 'under_12'
    else '12_plus'
  end
$$;

-- ── ٤) الحارس ───────────────────────────────────────────────
create or replace function public.guard_course_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg   record;
  v_child record;
  v_group text;
begin
  if public.is_admin() then
    return new;
  end if;

  select name, age_group, booking_open
    into v_pkg
    from creative_writing_packages
   where id = new.package_id;

  if not found then
    return new; -- الـFK والدالة بيتعاملوا مع الباقة الغلط
  end if;

  if v_pkg.booking_open is false then
    raise exception 'باقة «%» هتفتح للحجز قريبًا. تقدر تضغط «بلّغني لما تفتح» من صفحتها.', v_pkg.name;
  end if;

  if new.child_id is null then
    return new;
  end if;

  select full_name, birth_date, age_group_override
    into v_child
    from child_profiles
   where id = new.child_id;

  if not found then
    return new;
  end if;

  v_group := public.child_age_group(v_child.birth_date, v_child.age_group_override);

  if v_group is null then
    raise exception 'سجّل تاريخ ميلاد % من «عائلتي» الأول، عشان نتأكد إن الباقة مناسبة لسنّه.', v_child.full_name;
  end if;

  if v_group <> v_pkg.age_group then
    raise exception '%',
      case when v_pkg.age_group = 'under_12'
        then format('باقة «%s» لأقل من ١٢ سنة، و%s سنّه ١٢ أو أكتر. اختار باقة من مسار اليافعين، أو كلّمنا لو محتاج استثناء.', v_pkg.name, v_child.full_name)
        else format('باقة «%s» لـ١٢ سنة فأكثر، و%s سنّه أقل من ١٢. اختار باقة من مسار التأسيس، أو كلّمنا لو محتاج استثناء.', v_pkg.name, v_child.full_name)
      end;
  end if;

  return new;
end $$;

drop trigger if exists guard_course_booking_rules on public.course_subscriptions;
create trigger guard_course_booking_rules
  before insert on public.course_subscriptions
  for each row execute function public.guard_course_booking_rules();

-- ── ٥) «بلّغني لما تفتح» ────────────────────────────────────
create table if not exists public.package_interest (
  id          uuid primary key default gen_random_uuid(),
  package_id  text not null references public.creative_writing_packages(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  notified_at timestamptz,
  unique (package_id, user_id)
);

comment on table public.package_interest is
  'مين طلب يتبلّغ لما باقة «قريبًا» تفتح. notified_at بيتملى لما الإدارة تبعت الإشعار.';

alter table public.package_interest enable row level security;

drop policy if exists "own interest insert" on public.package_interest;
create policy "own interest insert" on public.package_interest
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "own interest read" on public.package_interest;
create policy "own interest read" on public.package_interest
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "own interest delete" on public.package_interest;
create policy "own interest delete" on public.package_interest
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins update interest" on public.package_interest;
create policy "admins update interest" on public.package_interest
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.package_interest to authenticated;
