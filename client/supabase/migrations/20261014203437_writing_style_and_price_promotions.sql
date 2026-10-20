-- ============================================================================
-- (٢/٣) أسلوب الكتابة + عروض الأسعار المؤقتة (الجداول والدالة فقط)
-- ============================================================================
-- الغرض   : (أ) اختيار أسلوب كتابة القصة: فصحى / عربية مبسّطة / لهجة (مع قائمة
--               لهجات يديرها الأدمن).
--           (ب) سعر عليه خصم لفترة محددة: نسبة مئوية أو سعر بيع، يديره الأدمن.
-- الأثر   : جدولان جديدان (writing_dialects, price_promotions) + عمود
--           writing_styles على personalized_products (NULL = كل الأساليب) +
--           عمود list_price_snapshot على order_items + دالة effective_price.
--           لا تغيير في أي سعر أو طلب حالي (لا توجد عروض بعد).
-- الترتيب : قبل migration الدوال (create_customer_order / create_box_subscription_order).
-- الرجوع  : في آخر الملف.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- ١) أسلوب الكتابة
--    customization_data.writingStyle = { style: 'fusha'|'simple'|'dialect', dialect?: <code> }
-- ─────────────────────────────────────────────────────────────────────────
create table public.writing_dialects (
  code       text primary key check (code ~ '^[a-z_]{2,20}$'),
  name_ar    text not null check (btrim(name_ar) <> ''),
  is_active  boolean not null default true,
  sort_order integer not null default 100
);
alter table public.writing_dialects enable row level security;
create policy "Dialects are public" on public.writing_dialects
  for select using (is_active or public.is_admin());
create policy "Admins manage dialects" on public.writing_dialects
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.writing_dialects (code, name_ar, sort_order) values
  ('egyptian',  'اللهجة المصرية',   1),
  ('gulf',      'اللهجة الخليجية',  2),
  ('levantine', 'اللهجة الشامية',   3),
  ('iraqi',     'اللهجة العراقية',  4),
  ('maghrebi',  'اللهجة المغاربية', 5),
  ('sudanese',  'اللهجة السودانية', 6);

alter table public.personalized_products
  add column writing_styles text[]
    check (writing_styles is null
           or (cardinality(writing_styles) > 0
               and writing_styles <@ array['fusha','simple','dialect']::text[]));

comment on column public.personalized_products.writing_styles is
  'الأساليب المتاحة لهذا المنتج. NULL = الثلاثة (fusha, simple, dialect).';

-- ─────────────────────────────────────────────────────────────────────────
-- ٢) عروض الأسعار المؤقتة
--    target_type: product_printed | product_electronic (target_id = personalized_products.id)
--                 addon (addon_products.id) | box_plan (box_subscription_plans.id)
-- ─────────────────────────────────────────────────────────────────────────
create table public.price_promotions (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in
                ('product_printed','product_electronic','addon','box_plan')),
  target_id   text not null check (btrim(target_id) <> ''),
  kind        text not null check (kind in ('percent','sale_price')),
  value       numeric not null check (value > 0),
  label       text check (label is null or char_length(label) <= 60),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  is_active   boolean not null default true,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  check (kind <> 'percent' or value < 100)
);
create index price_promotions_lookup
  on public.price_promotions (target_type, target_id, starts_at, ends_at) where is_active;

alter table public.price_promotions enable row level security;
create policy "Current promotions are public" on public.price_promotions
  for select using ((is_active and now() >= starts_at and now() < ends_at) or public.is_admin());
create policy "Admins manage promotions" on public.price_promotions
  for all using (public.is_admin()) with check (public.is_admin());

comment on table public.price_promotions is
  'عروض سعرية مؤقتة. السعر الفعلي يُحسب في القاعدة بـ effective_price ولا يأتي من المتصفح.';

-- أفضل عرض ساري وقت p_at (الأقل سعرًا)، أو السعر الأصلي. sale_price لا يرفع السعر أبدًا.
create or replace function public.effective_price(
  p_type text, p_id text, p_base numeric, p_at timestamptz default now()
) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    min(case kind
          when 'percent'    then round(p_base * (100 - value) / 100.0)
          when 'sale_price' then least(value, p_base)
        end),
    p_base)
  from price_promotions
  where target_type = p_type and target_id = p_id
    and is_active and p_at >= starts_at and p_at < ends_at
$$;
revoke all on function public.effective_price(text, text, numeric, timestamptz) from public, anon;
grant execute on function public.effective_price(text, text, numeric, timestamptz) to authenticated, service_role;

-- لقطة السعر الأصلي للوحدة قبل العرض (للتقارير) — unit_price يبقى المدفوع فعلًا.
alter table public.order_items add column list_price_snapshot integer;
comment on column public.order_items.list_price_snapshot is
  'سعر الوحدة بدون عرض ترويجي وقت الطلب. NULL للطلبات القديمة.';

-- ============================================================================
-- الرجوع (عكسي):
--   alter table public.order_items drop column list_price_snapshot;
--   drop function public.effective_price(text, text, numeric, timestamptz);
--   drop table public.price_promotions;
--   alter table public.personalized_products drop column writing_styles;
--   drop table public.writing_dialects;
-- ⚠️ بعد نشر migration الدوال لازم تُرجَع الدوال أولًا (تعتمد على effective_price).
-- ============================================================================
