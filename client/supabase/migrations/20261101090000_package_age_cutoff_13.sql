-- ═══════════════════════════════════════════════════════════════
-- سن الباقات: الحد بقى ١٣ سنة بدل ١٢ — قرار تامر (١ نوفمبر)
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض: خيارات «الفئة العمرية» في إدارة الباقات بقت «دون 13 سنة» و
--   «13 سنة فما فوق». الحارس اللي بيمنع حجز طفل في باقة مش لسنّه لازم
--   يحسب بنفس الحد، وإلا طفل عنده ١٢ سنة يتمنع من باقة «دون 13».
--
-- ⚠️ المفاتيح `under_12` / `12_plus` فضلت زي ما هي (في الباقات وفي
--    استثناءات الأطفال) — تغييرها مالوش فايدة للمستخدم ومخاطرته عالية.
--    المعنى بس اللي اتغيّر: under_12 = «دون ١٣»، 12_plus = «١٣ فما فوق».
-- ⚠️ سن «أقلام» والحماية (١٢ سنة) مالوش علاقة بالملف ده ومتغيّرش.
--
-- الأثر: دالتين بس. مفيش جداول ولا بيانات بتتغيّر.
--   أطفال عندهم ١٢ سنة بالظبط هيتحسبوا «دون ١٣» من دلوقتي.
-- الترتيب: بعد `20261024090000_package_booking_rules`.
-- التحقق:
--   select public.child_age_group((now() - interval '12 years 6 months')::date, null); -- under_12
--   select public.child_age_group((now() - interval '13 years 1 day')::date, null);     -- 12_plus
-- الرجوع: تشغيل نسخة الدالتين من `20261024090000_package_booking_rules.sql`.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.child_age_group(p_birth date, p_override text)
returns text
language sql
stable
set search_path to 'public'
as $function$
  select case
    when p_override in ('under_12', '12_plus') then p_override
    when p_birth is null then null
    when extract(year from age((now() at time zone 'Africa/Cairo')::date, p_birth)) < 13
      then 'under_12'
    else '12_plus'
  end
$function$;

create or replace function public.guard_course_booking_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
        then format('باقة «%s» لـدون ١٣ سنة، و%s سنّه ١٣ أو أكتر. اختار باقة لـ١٣ سنة فما فوق، أو كلّمنا لو محتاج استثناء.', v_pkg.name, v_child.full_name)
        else format('باقة «%s» لـ١٣ سنة فما فوق، و%s سنّه أقل من ١٣. اختار باقة من مسار التأسيس الإبداعي، أو كلّمنا لو محتاج استثناء.', v_pkg.name, v_child.full_name)
      end;
  end if;

  return new;
end $function$;
