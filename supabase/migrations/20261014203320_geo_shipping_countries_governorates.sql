-- ============================================================================
-- (١/٣) الدول ← المحافظات ← مناطق الشحن + إغلاق/فتح التوصيل
-- ============================================================================
-- الغرض   : صفحة الطلب تختار الدولة (مصر افتراضيًا) ثم المحافظة ثم المنطقة،
--           والأدمن يتحكم من اللوحة في فتح/إغلاق التوصيل للدولة أو المحافظة أو
--           المنطقة، وفي إيقاف التوصيل كله مؤقتًا (النسخة الإلكترونية تبقى).
-- الأثر   : جداول جديدة (countries, governorates) + أعمدة بقيم افتراضية على
--           shipping_rates و orders + دالة shipping_quote + صف site_settings
--           بمفتاح 'delivery'. لا حذف ولا تغيير في قيم الطلبات القديمة.
--           الصفوف الثلاثة الحالية في shipping_rates (الإسكندرية) تبقى بأسعارها
--           ويُوحَّد إملاء اسم المحافظة فقط. الطلبات القديمة تبقى بنص المحافظة
--           والمدينة كما سُجّلت (لا تعديل عليها).
-- الترتيب : قبل migration الدوال (create_customer_order / create_box_subscription_order)
--           وقبل نشر الكود. متوافقة مع الكود المنشور حاليًا (كل شيء إضافي).
-- التحقق  : انظر الاختبارات في supabase/tests/geo-shipping-order-rpcs.sql.
-- الرجوع  : في آخر الملف (تعليق).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- ١) الدول
-- ─────────────────────────────────────────────────────────────────────────
create table public.countries (
  code                text primary key check (code ~ '^[A-Z]{2}$'),
  name_ar             text not null check (btrim(name_ar) <> ''),
  dial_code           text,
  is_default          boolean not null default false,
  is_listed           boolean not null default true,
  physical_enabled    boolean not null default false,
  electronic_enabled  boolean not null default false,
  unavailable_message text,
  sort_order          integer not null default 100,
  updated_at          timestamptz not null default now()
);
create unique index countries_single_default on public.countries (is_default) where is_default;

comment on table public.countries is
  'الدول في صفحة الطلب. physical_enabled/electronic_enabled يتحكم فيهما الأدمن؛ دوال الطلب تفرضهما في القاعدة.';

alter table public.countries enable row level security;
create policy "Countries are public" on public.countries
  for select using (is_listed or public.is_admin());
create policy "Admins manage countries" on public.countries
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.countries (code, name_ar, dial_code, is_default, physical_enabled, electronic_enabled, unavailable_message, sort_order) values
  ('EG', 'مصر',          '+20',  true,  true,  true,  null, 1),
  ('SA', 'السعودية',     '+966', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 10),
  ('AE', 'الإمارات',     '+971', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 11),
  ('QA', 'قطر',          '+974', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 12),
  ('KW', 'الكويت',       '+965', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 13),
  ('BH', 'البحرين',      '+973', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 14),
  ('OM', 'سلطنة عُمان',  '+968', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 15),
  ('JO', 'الأردن',       '+962', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 20),
  ('LB', 'لبنان',        '+961', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 21),
  ('SY', 'سوريا',        '+963', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 22),
  ('PS', 'فلسطين',       '+970', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 23),
  ('IQ', 'العراق',       '+964', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 24),
  ('YE', 'اليمن',        '+967', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 25),
  ('LY', 'ليبيا',        '+218', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 30),
  ('TN', 'تونس',         '+216', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 31),
  ('DZ', 'الجزائر',      '+213', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 32),
  ('MA', 'المغرب',       '+212', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 33),
  ('MR', 'موريتانيا',    '+222', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 34),
  ('SD', 'السودان',      '+249', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 35),
  ('SO', 'الصومال',      '+252', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 36),
  ('DJ', 'جيبوتي',       '+253', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 37),
  ('KM', 'جزر القمر',    '+269', false, false, false, 'غير متاح الآن — سيتم التوفير قريبًا', 38);

-- ─────────────────────────────────────────────────────────────────────────
-- ٢) المحافظات
-- ─────────────────────────────────────────────────────────────────────────
create table public.governorates (
  id               uuid primary key default gen_random_uuid(),
  country_code     text not null references public.countries(code) on update cascade,
  name_ar          text not null check (btrim(name_ar) <> ''),
  physical_enabled boolean not null default true,
  is_active        boolean not null default true,
  sort_order       integer not null default 100,
  updated_at       timestamptz not null default now(),
  unique (country_code, name_ar)
);
alter table public.governorates enable row level security;
create policy "Governorates are public" on public.governorates
  for select using (is_active or public.is_admin());
create policy "Admins manage governorates" on public.governorates
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.governorates (country_code, name_ar, sort_order) values
  ('EG','القاهرة',1),('EG','الجيزة',2),('EG','الإسكندرية',3),('EG','القليوبية',4),
  ('EG','بورسعيد',5),('EG','السويس',6),('EG','دمياط',7),('EG','الدقهلية',8),
  ('EG','الشرقية',9),('EG','كفر الشيخ',10),('EG','الغربية',11),('EG','المنوفية',12),
  ('EG','البحيرة',13),('EG','الإسماعيلية',14),('EG','بني سويف',15),('EG','الفيوم',16),
  ('EG','المنيا',17),('EG','أسيوط',18),('EG','سوهاج',19),('EG','قنا',20),
  ('EG','الأقصر',21),('EG','أسوان',22),('EG','البحر الأحمر',23),('EG','الوادي الجديد',24),
  ('EG','مطروح',25),('EG','شمال سيناء',26),('EG','جنوب سيناء',27);

-- ─────────────────────────────────────────────────────────────────────────
-- ٣) المناطق = shipping_rates الحالي (is_active هو مفتاح فتح/إغلاق المنطقة)
-- ─────────────────────────────────────────────────────────────────────────
update public.shipping_rates
   set governorate = 'الإسكندرية', updated_at = now()
 where governorate in ('الاسكندرية', 'اسكندرية');

alter table public.shipping_rates
  add column country_code text    not null default 'EG' references public.countries(code) on update cascade,
  add column is_estimate  boolean not null default false,
  add column eta_days_min smallint check (eta_days_min is null or eta_days_min >= 0),
  add column eta_days_max smallint check (eta_days_max is null or eta_days_max >= 0),
  add constraint shipping_rates_eta_check check (
    eta_days_min is null or eta_days_max is null or eta_days_min <= eta_days_max);

alter table public.shipping_rates
  add constraint shipping_rates_governorate_fk
  foreign key (country_code, governorate)
  references public.governorates (country_code, name_ar) on update cascade;

alter table public.shipping_rates drop constraint shipping_rates_area_unique;
alter table public.shipping_rates
  add constraint shipping_rates_area_unique unique (country_code, governorate, city);

comment on column public.shipping_rates.is_estimate is
  'قيمة تقديرية لم تُراجَع مع شركة الشحن — تظهر للأدمن كتنبيه.';

-- القيم التقديرية (جنيه) — **ليست عروض أسعار من شركة شحن**، تُراجَع قبل الإطلاق.
--   ٦٠: القاهرة/الجيزة/القليوبية · ٧٥: الدلتا والقناة · ٩٠: الصعيد الأقرب · ١٢٠: الأطراف
insert into public.shipping_rates (country_code, governorate, city, fee, is_active, is_estimate)
select 'EG', c.gov, c.city, c.fee, true, true
from (values
  ('القاهرة',       'القاهرة',            60),
  ('القاهرة',       'مدن أخرى بالمحافظة', 60),
  ('الجيزة',        'الجيزة',             60),
  ('الجيزة',        'مدن أخرى بالمحافظة', 60),
  ('القليوبية',     'بنها',               60),
  ('القليوبية',     'مدن أخرى بالمحافظة', 60),
  ('بورسعيد',       'بورسعيد',            75),
  ('السويس',        'السويس',             75),
  ('دمياط',         'دمياط',              75),
  ('الدقهلية',      'المنصورة',           75),
  ('الدقهلية',      'مدن أخرى بالمحافظة', 75),
  ('الشرقية',       'الزقازيق',           75),
  ('الشرقية',       'مدن أخرى بالمحافظة', 75),
  ('كفر الشيخ',     'كفر الشيخ',          75),
  ('الغربية',       'طنطا',               75),
  ('الغربية',       'مدن أخرى بالمحافظة', 75),
  ('المنوفية',      'شبين الكوم',         75),
  ('المنوفية',      'مدن أخرى بالمحافظة', 75),
  ('البحيرة',       'دمنهور',             75),
  ('البحيرة',       'مدن أخرى بالمحافظة', 75),
  ('الإسماعيلية',   'الإسماعيلية',        75),
  ('بني سويف',      'بني سويف',           90),
  ('الفيوم',        'الفيوم',             90),
  ('المنيا',        'المنيا',             90),
  ('أسيوط',         'أسيوط',              90),
  ('سوهاج',         'سوهاج',              90),
  ('قنا',           'قنا',                90),
  ('الأقصر',        'الأقصر',             90),
  ('أسوان',         'أسوان',             120),
  ('البحر الأحمر',  'الغردقة',           120),
  ('الوادي الجديد', 'الخارجة',           120),
  ('مطروح',         'مرسى مطروح',        120),
  ('شمال سيناء',    'العريش',            120),
  ('جنوب سيناء',    'الطور',             120)
) as c(gov, city, fee)
on conflict (country_code, governorate, city) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- ٤) الطلب يحفظ الدولة (لقطة تاريخية) — والعميل لا يغيّرها بعد الإنشاء
-- ─────────────────────────────────────────────────────────────────────────
alter table public.orders
  add column country_code text not null default 'EG' references public.countries(code) on update cascade;

create or replace function public.guard_order_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- الاستثناء الوحيد: العميل يقول «حوّلت» ويسيب وسيلة الدفع والإيصال.
  IF OLD.status = 'pending'
     AND NEW.status = 'awaiting_verification' THEN
    NULL;
  ELSE
    NEW.status              := OLD.status;
    NEW.payment_method      := OLD.payment_method;
    NEW.payment_receipt_url := OLD.payment_receipt_url;
  END IF;

  -- الفلوس والملكية والرقم المرجعي: العميل ما بيلمسهمش أبدًا.
  NEW.id                    := OLD.id;
  NEW.user_id               := OLD.user_id;
  NEW.total_amount          := OLD.total_amount;
  NEW.shipping_fee          := OLD.shipping_fee;
  NEW.created_at            := OLD.created_at;
  NEW.payment_reference     := OLD.payment_reference;
  NEW.transaction_reference := OLD.transaction_reference;
  -- الدولة محسوب عليها الشحن وقت الطلب، فتتقفل مع السعر.
  NEW.country_code          := OLD.country_code;

  -- التنفيذ والشحن: الإدارة وحدها.
  NEW.shipped_at         := OLD.shipped_at;
  NEW.delivered_at       := OLD.delivered_at;
  NEW.tracking_reference := OLD.tracking_reference;
  NEW.admin_notes        := OLD.admin_notes;
  NEW.electronic_sent_at := OLD.electronic_sent_at;   -- ملف 138
  NEW.box_plan_id        := OLD.box_plan_id;
  NEW.box_details        := OLD.box_details;

  -- عنوان الشحن وإيميل الاستلام مفتوحين عن قصد: العميل يصحّحهم قبل التنفيذ.

  RETURN NEW;
END
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- ٥) إيقاف التوصيل المؤقت (مفتاح عام) — صف مستقل كي لا نلمس صف general
-- ─────────────────────────────────────────────────────────────────────────
insert into public.site_settings (key, value)
select 'delivery', '{"paused": false, "pausedMessage": ""}'::jsonb
where not exists (select 1 from public.site_settings where key = 'delivery');

-- ─────────────────────────────────────────────────────────────────────────
-- ٦) shipping_quote: مرجع واحد لـ«هل التوصيل متاح؟ وبكم؟»
--    يستعملها دوال الطلب (الحارس الحقيقي) والواجهة (للعرض فقط).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.shipping_quote(
  p_country text, p_governorate text, p_city text
) returns table (available boolean, fee numeric, reason text, message text)
language plpgsql stable security definer set search_path = public as $$
declare
  c record; g record; r record; v_paused boolean; v_paused_msg text;
begin
  select * into c from countries where code = upper(btrim(coalesce(p_country, 'EG')));
  if not found or not c.is_listed then
    return query select false, 0::numeric, 'country_unknown', 'الدولة غير مدعومة'; return;
  end if;

  select coalesce((value ->> 'paused')::boolean, false), nullif(btrim(value ->> 'pausedMessage'), '')
    into v_paused, v_paused_msg
    from site_settings where key = 'delivery';
  if coalesce(v_paused, false) then
    return query select false, 0::numeric, 'paused',
      coalesce(v_paused_msg, 'التوصيل متوقف مؤقتًا — يمكنك طلب النسخة الإلكترونية'); return;
  end if;

  if not c.physical_enabled then
    return query select false, 0::numeric, 'country_closed',
      coalesce(nullif(btrim(c.unavailable_message), ''), 'غير متاح الآن — سيتم التوفير قريبًا'); return;
  end if;

  select * into g from governorates
   where country_code = c.code and name_ar = btrim(coalesce(p_governorate, '')) and is_active;
  if not found then
    return query select false, 0::numeric, 'governorate_unknown', 'المحافظة غير مسجّلة'; return;
  end if;
  if not g.physical_enabled then
    return query select false, 0::numeric, 'governorate_closed',
      'التوصيل لهذه المحافظة غير متاح الآن'; return;
  end if;

  select * into r from shipping_rates
   where country_code = c.code and governorate = g.name_ar
     and city = btrim(coalesce(p_city, ''));
  if not found then
    return query select false, 0::numeric, 'area_unknown', 'منطقة الشحن دي مش مسجّلة — تواصل معانا'; return;
  end if;
  if not r.is_active then
    return query select false, 0::numeric, 'area_closed',
      'التوصيل لهذه المنطقة غير متاح الآن'; return;
  end if;

  return query select true, r.fee, 'ok', null::text;
end $$;

revoke all on function public.shipping_quote(text, text, text) from public, anon;
grant execute on function public.shipping_quote(text, text, text) to authenticated, service_role;

-- ============================================================================
-- الرجوع (يُجرَّب على staging؛ على production بقرار مكتوب فقط). الترتيب عكسي:
--   drop function public.shipping_quote(text, text, text);
--   delete from public.site_settings where key = 'delivery';
--   alter table public.orders drop column country_code;
--   -- (أعد guard_order_fields بدون سطر country_code من آخر migration له)
--   delete from public.shipping_rates where is_estimate;
--   alter table public.shipping_rates drop constraint shipping_rates_area_unique;
--   alter table public.shipping_rates drop constraint shipping_rates_governorate_fk;
--   alter table public.shipping_rates add constraint shipping_rates_area_unique unique (governorate, city);
--   alter table public.shipping_rates drop column eta_days_max, drop column eta_days_min,
--     drop column is_estimate, drop column country_code;
--   drop table public.governorates; drop table public.countries;
-- ⚠️ لا رجوع بعد تسجيل طلبات بدولة غير مصر قبل ترحيلها.
-- ============================================================================
