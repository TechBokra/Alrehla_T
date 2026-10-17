-- ════════════════════════════════════════════════════════════════════
-- الإعلانات: جدول الإعلانات وجدول النقرات
-- ════════════════════════════════════════════════════════════════════
--
-- الغرض
-- ─────
-- بانرات إعلانية بتظهر في سلايدر متحرك في خانات محددة من الموقع،
-- لكل واحد توقيت بداية ونهاية، وبيتعدّ عدد النقرات عليه.
-- والمعلن ممكن يكون المنصة نفسها (لينك داخلي) أو معلن خارجي.
--
-- الأثر
-- ─────
-- جدولين جداد. **مفيش أي تعديل على جدول قائم**، ومفيش حذف.
-- الموقع قبل الهجرة دي بيشتغل زي ما هو؛ الخانات بتفضل فاضية
-- لحد ما الإدارة تضيف إعلان.
--
-- الترتيب
-- ───────
-- مستقلة — مش معتمدة على أي هجرة قبلها غير `public.is_admin()`
-- (موجودة من ملف ١١٨) و`user_profiles`.
--
-- التحقق بعد التشغيل
-- ─────────────────
--   select count(*) from public.ads;                    -- 0
--   select count(*) from public.ad_clicks;              -- 0
--   -- والزائر المجهول لازم يشوف الإعلان الشغّال بس:
--   set role anon; select count(*) from public.ads; reset role;
--
-- الرجوع
-- ──────
--   drop table if exists public.ad_clicks;
--   drop table if exists public.ads;
-- (مفيش بيانات تانية بتتأثر — الجدولين جداد ومنفصلين.)
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),

  -- عنوان إداري للتعريف في اللوحة (مش بيظهر على البانر).
  title text not null,
  -- اسم المعلن. فاضي = المنصة نفسها.
  advertiser_name text,

  -- ⚠️ صورتين: الأفقية بتتلخبط على ٣٧٥ بكسل، فالموبايل له صورته.
  --    و`image_url_mobile` فاضية = استعمل الأساسية.
  image_url text not null,
  image_url_mobile text,

  -- لينك التحويل. فاضي = بانر من غير تحويل (إعلان تعريفي).
  link_url text,

  -- ⚠️ **الخانات مصفوفة مش عمود واحد**: نفس الإعلان بيظهر في أكتر
  --    من مكان، والإدارة بتظبط ده من اللوحة. والقيم المسموحة
  --    متحدّدة في `lib/ads.ts` — القاعدة بتتحقق إنها نصوص مش فاضية
  --    بس، عشان إضافة خانة جديدة ما تحتاجش هجرة.
  placements text[] not null default '{}',

  -- التوقيت. فاضي = من غير حد.
  starts_at timestamptz,
  ends_at timestamptz,

  is_active boolean not null default true,

  -- ترتيب الظهور في السلايدر. الأصغر أول.
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ⚠️ النهاية لازم تكون بعد البداية — غير كده الإعلان عمره ما يظهر
  --    والإدارة تفضل تدوّر على السبب.
  constraint ads_window_valid check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  constraint ads_title_not_blank check (btrim(title) <> ''),
  constraint ads_image_not_blank check (btrim(image_url) <> '')
);

comment on table public.ads is
  'بانرات إعلانية بخانات وتوقيت. المعلن ممكن يكون المنصة نفسها (advertiser_name فاضي).';
comment on column public.ads.placements is
  'خانات الظهور. القيم المسموحة في src/lib/ads.ts (PLACEMENTS).';

-- ── النقرات ──────────────────────────────────────────────────────
--
-- ⚠️ **صف لكل نقرة، مش عدّاد على الإعلان.** العدّاد أسرع في العرض،
--    بس بيتوه: نقرة بتفشل فتزيد، أو تنجح فما تزيدش، ومفيش طريقة
--    تراجع. الصفوف بتخلّي العدد محسوبًا من مصدر واحد، وبتسمح
--    بتفصيل بالخانة والتاريخ بعدين.
create table if not exists public.ad_clicks (
  id uuid primary key default gen_random_uuid(),
  -- حذف الإعلان بيحذف نقراته: العدد من غير الإعلان مالوش معنى.
  ad_id uuid not null references public.ads(id) on delete cascade,
  -- الخانة اللي اتنقر منها — عشان نعرف المكان اللي بيجيب نقرات.
  placement text,
  clicked_at timestamptz not null default now()
);

comment on table public.ad_clicks is
  'صف لكل نقرة على إعلان. العدد بيتحسب من هنا، مش من عدّاد.';

create index if not exists ad_clicks_ad_idx on public.ad_clicks (ad_id, clicked_at desc);

-- ⚠️ فهرس GIN على المصفوفة: استعلام الزائر بيفلتر بـ`placements @> …`
--    على كل عرض للصفحة.
create index if not exists ads_placements_idx on public.ads using gin (placements);
create index if not exists ads_active_idx on public.ads (is_active, sort_order);

-- ── الصلاحيات ────────────────────────────────────────────────────

alter table public.ads enable row level security;
alter table public.ad_clicks enable row level security;

-- ⚠️ **الزائر بيشوف الشغّال وقت العرض بس.** الفلترة متكرّرة في الكود
--    (`visibleAds`) عشان الرسالة والترتيب، بس الحارس الحقيقي هنا:
--    إعلان منتهي أو مقفول **مش بيخرج من القاعدة أصلًا**، فلو شاشة
--    نسيت تفلتر، الزائر مش هيشوفه.
drop policy if exists "ads are readable when live" on public.ads;
create policy "ads are readable when live" on public.ads
  for select
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "admins manage ads" on public.ads;
create policy "admins manage ads" on public.ads
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ⚠️ **الزائر بيكتب نقرة ومابيقراش ولا نقرة.** مفيش سياسة `select`
--    لغير الأدمن، فالأرقام مش معروضة لحد برّه اللوحة.
--
-- ⚠️ وبيكتب **من غير ما يحدّد `clicked_at`**: العمود افتراضي `now()`
--    بتوقيت السيرفر، فمحدّش يقدر يزوّر تاريخ نقرة.
drop policy if exists "anyone may record a click" on public.ad_clicks;
create policy "anyone may record a click" on public.ad_clicks
  for insert
  with check (true);

drop policy if exists "admins read clicks" on public.ad_clicks;
create policy "admins read clicks" on public.ad_clicks
  for select
  using (public.is_admin());

drop policy if exists "admins delete clicks" on public.ad_clicks;
create policy "admins delete clicks" on public.ad_clicks
  for delete
  using (public.is_admin());

grant select on public.ads to anon, authenticated;
grant insert on public.ad_clicks to anon, authenticated;

-- ── العدد لكل إعلان ──────────────────────────────────────────────
--
-- ⚠️ **دالة مش استعلام في الكود**: عدّ النقرات لكل إعلان من الكود
--    معناه استعلام لكل إعلان (أو جلب كل الصفوف وعدّها في الذاكرة).
--    الدالة بترجع العدد لكل إعلان في نداء واحد.
--
-- ⚠️ **و`security definer` مع حارس صريح جوّه**: الدالة بتقرا نقرات
--    كل الإعلانات، فلازم تتأكد بنفسها إن اللي بينادي أدمن — مش
--    تعتمد على سياسة الجدول (الـdefiner بيتخطّاها).
create or replace function public.ad_click_counts()
returns table (ad_id uuid, clicks bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'غير مصرح';
  end if;

  return query
    select c.ad_id, count(*)::bigint
    from public.ad_clicks c
    group by c.ad_id;
end;
$$;

revoke all on function public.ad_click_counts() from public;
grant execute on function public.ad_click_counts() to authenticated;

-- ── تحديث updated_at ─────────────────────────────────────────────
create or replace function public.touch_ads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ads_touch_updated_at on public.ads;
create trigger ads_touch_updated_at
  before update on public.ads
  for each row execute function public.touch_ads_updated_at();
