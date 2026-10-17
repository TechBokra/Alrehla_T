-- أقلام الرحلة — لوحة ضبط كاملة (حدود، مراجعة، تصنيفات، تفاعلات، فلاتر، نصوص).
--
-- قبل كده الأرقام كانت مكتوبة جوّه الدوال (٣ نصوص في اليوم، ٥ بلاغات…) وجوّه
-- قيود الجداول (التصنيفات الخمسة، حد العنوان ١٢٠…). دلوقتي:
--
--   • جدول `aqlam_config` صف واحد: `value` (عام، بيتقرا من الموقع) و`private`
--     (كلمات ممنوعة — مش بتتقرا من الزوار أبدًا).
--   • كل دالة بتقرا الإعداد وقت التنفيذ، والافتراضي = السلوك القديم بالظبط
--     (فمفيش تغيير لحد ما الإدارة تغيّر حاجة).
--   • قيود الجداول اتوسّعت لحدود أمان عريضة؛ الحد الفعلي بيتفرض في الدوال.
--   • الحفظ بدالة واحدة (`aqlam_save_config`) بتتحقق من كل خانة وكل ترابط.
--
-- بتتشغّل بعد `20261017220000_aqlam_pinned_posts.sql`. آمنة لو اتشغّلت مرتين.

-- ── ١) الجدول ───────────────────────────────────────────────────────────────

create table if not exists public.aqlam_config (
  id          boolean primary key default true check (id),
  value       jsonb not null default '{}'::jsonb,
  private     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.aqlam_config enable row level security;

drop policy if exists aqlam_config_read on public.aqlam_config;
create policy aqlam_config_read on public.aqlam_config
  for select to anon, authenticated using (true);

-- القراءة العامة لأعمدة الإعداد العام بس. `private` (الكلمات الممنوعة) مقفول.
revoke all on public.aqlam_config from anon, authenticated;
grant select (id, value, updated_at) on public.aqlam_config to anon, authenticated;

-- ── ٢) الإعداد الافتراضي (مصدر الحقيقة الوحيد للأرقام الافتراضية) ──────────────

create or replace function public.aqlam_default_config()
returns jsonb
language sql immutable set search_path = public as $$
  select $json$
  {
    "limits": {
      "postsPerDay": 3, "commentsPerDay": 20, "reactionsPerDay": 200, "reportsPerDay": 10,
      "editsPerDay": 10, "guardianRequestsPerDay": 3,
      "titleMax": 120, "bodyMin": 20, "bodyMax": 20000, "commentMax": 500, "bioMax": 500,
      "penNameMin": 2, "penNameMax": 40, "reportDetailsMax": 500,
      "guardianReasonMin": 10, "guardianReasonMax": 500
    },
    "moderation": {
      "reportsToAutoHide": 5, "removedRetentionDays": 7, "maxPinned": 6,
      "review12Plus": "off", "reviewFirstN": 1, "reReviewEdits": false,
      "blockedWordsAction": "reject"
    },
    "features": {
      "publishing": true, "comments": true, "reactions": true, "selfEdit": true, "selfRemove": true,
      "fullName": true, "penName": true, "googleIndexing": true, "writerPages": true, "share": true
    },
    "categories": [
      {"key": "story", "label": "قصة", "icon": "book", "enabled": true},
      {"key": "poem", "label": "قصيدة", "icon": "feather", "enabled": true},
      {"key": "reflection", "label": "خاطرة", "icon": "lightbulb", "enabled": true},
      {"key": "article", "label": "مقال", "icon": "newspaper", "enabled": true},
      {"key": "scene", "label": "مشهد", "icon": "clapperboard", "enabled": true}
    ],
    "reactions": [
      {"key": "heart", "label": "عجبني", "emoji": "❤️", "enabled": true},
      {"key": "star", "label": "مميّز", "emoji": "⭐", "enabled": true},
      {"key": "spark", "label": "ألهمني", "emoji": "✨", "enabled": true}
    ],
    "reportReasons": [
      {"key": "contact_info", "label": "فيه بيانات تواصل", "enabled": true},
      {"key": "inappropriate", "label": "محتوى غير مناسب", "enabled": true},
      {"key": "bullying", "label": "تنمّر أو إساءة", "enabled": true},
      {"key": "copied", "label": "منقول من غير صاحبه", "enabled": true},
      {"key": "other", "label": "سبب آخر", "enabled": true}
    ],
    "filters": {
      "showCategory": true, "showAge": true, "showSort": true,
      "defaultSort": "new", "sorts": ["new", "top"],
      "ageBands": ["6-9", "10-12", "13-17", "18-20"],
      "pageSize": 12
    },
    "featured": {"enabled": true, "title": "مختارات الرحلة", "respectFilters": true},
    "texts": {
      "heroTitle": "أقلام الرحلة",
      "heroSubtitle": "قصص وقصائد وخواطر كتبها صغار ويافعون. اقرا، وشجّع بملصق أو تعليق طيّب، وانشر نصك لما تحب.",
      "emptyMessage": "لسه مفيش نصوص منشورة. كن أول من ينشر.",
      "publishGuidelines": "",
      "closedNotice": "النشر متوقف مؤقتًا. تقدر تقرأ وتشجّع زي العادة."
    },
    "admin": {"pageSize": 20}
  }
  $json$::jsonb
$$;

insert into public.aqlam_config (id, value) values (true, public.aqlam_default_config())
on conflict (id) do nothing;

-- ── ٣) قراءة الإعداد جوّه الدوال ─────────────────────────────────────────────
-- (مقفولة عن الزوار والمستخدمين: بتتنادى من دوال الـ security definer بس.)

create or replace function public.aqlam_cfg_int(p_group text, p_key text)
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select (c.value #>> array[p_group, p_key])::numeric from public.aqlam_config c where c.id),
    (public.aqlam_default_config() #>> array[p_group, p_key])::numeric
  )::integer
$$;

create or replace function public.aqlam_cfg_bool(p_group text, p_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select (c.value #>> array[p_group, p_key])::boolean from public.aqlam_config c where c.id),
    (public.aqlam_default_config() #>> array[p_group, p_key])::boolean
  )
$$;

create or replace function public.aqlam_cfg_text(p_group text, p_key text)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.value #>> array[p_group, p_key] from public.aqlam_config c where c.id),
    public.aqlam_default_config() #>> array[p_group, p_key]
  )
$$;

-- مفتاح موجود في قايمة (تصنيفات/تفاعلات/أسباب) ومفعّل؟ (p_any = حتى لو متعطّل)
create or replace function public.aqlam_list_key_ok(p_list text, p_key text, p_any boolean default false)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from jsonb_array_elements(
             coalesce((select c.value -> p_list from public.aqlam_config c where c.id),
                      public.aqlam_default_config() -> p_list)) e
     where e ->> 'key' = p_key
       and (p_any or coalesce((e ->> 'enabled')::boolean, true))
  )
$$;

-- تطبيع عربي للمطابقة: من غير تشكيل ولا تطويل، والألفات والياء موحّدة، وحروف صغيرة.
create or replace function public.aqlam_normalize_ar(p text)
returns text
language sql immutable set search_path = public as $$
  select lower(translate(
    regexp_replace(coalesce(p, ''), '[ً-ٰٟـ]', '', 'g'),
    'أإآٱى', 'اااايي'))
$$;

-- النص فيه كلمة من القايمة الممنوعة؟ (مطابقة احتواء بعد التطبيع)
create or replace function public.aqlam_blocked_hit(p_text text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.aqlam_config c,
           jsonb_array_elements_text(coalesce(c.private -> 'blockedWords', '[]'::jsonb)) w
     where c.id
       and char_length(btrim(w)) >= 2
       and position(public.aqlam_normalize_ar(btrim(w)) in public.aqlam_normalize_ar(p_text)) > 0
  )
$$;

revoke all on function public.aqlam_default_config() from public, anon, authenticated;
revoke all on function public.aqlam_cfg_int(text, text) from public, anon, authenticated;
revoke all on function public.aqlam_cfg_bool(text, text) from public, anon, authenticated;
revoke all on function public.aqlam_cfg_text(text, text) from public, anon, authenticated;
revoke all on function public.aqlam_list_key_ok(text, text, boolean) from public, anon, authenticated;
revoke all on function public.aqlam_normalize_ar(text) from public, anon, authenticated;
revoke all on function public.aqlam_blocked_hit(text) from public, anon, authenticated;

-- ── ٤) توسيع القيود: حدود أمان عريضة، والحد الفعلي في الدوال ───────────────────

alter table public.aqlam_posts drop constraint if exists aqlam_posts_title_check;
alter table public.aqlam_posts drop constraint if exists aqlam_posts_body_check;
alter table public.aqlam_posts drop constraint if exists aqlam_posts_category_check;
alter table public.aqlam_comments drop constraint if exists aqlam_comments_body_check;
alter table public.aqlam_writer_profiles drop constraint if exists aqlam_writer_profiles_pen_name_check;
alter table public.aqlam_writer_profiles drop constraint if exists aqlam_writer_profiles_bio_check;
alter table public.aqlam_reports drop constraint if exists aqlam_reports_details_check;
alter table public.aqlam_guardian_requests drop constraint if exists aqlam_guardian_requests_reason_check;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aqlam_posts_title_len') then
    alter table public.aqlam_posts add constraint aqlam_posts_title_len
      check (char_length(title) between 1 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aqlam_posts_body_len') then
    alter table public.aqlam_posts add constraint aqlam_posts_body_len
      check (char_length(body) between 1 and 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aqlam_posts_category_fmt') then
    alter table public.aqlam_posts add constraint aqlam_posts_category_fmt
      check (category ~ '^[a-z][a-z0-9_]{1,23}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aqlam_comments_body_len') then
    alter table public.aqlam_comments add constraint aqlam_comments_body_len
      check (char_length(body) between 1 and 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aqlam_writer_pen_name_len') then
    alter table public.aqlam_writer_profiles add constraint aqlam_writer_pen_name_len
      check (pen_name is null or char_length(pen_name) between 2 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aqlam_writer_bio_len') then
    alter table public.aqlam_writer_profiles add constraint aqlam_writer_bio_len
      check (bio is null or char_length(bio) <= 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aqlam_reports_details_len') then
    alter table public.aqlam_reports add constraint aqlam_reports_details_len
      check (details is null or char_length(details) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aqlam_guardian_requests_reason_len') then
    alter table public.aqlam_guardian_requests add constraint aqlam_guardian_requests_reason_len
      check (char_length(reason) between 1 and 1000);
  end if;
end $$;

-- ── ٥) التحقق من الإعداد وحفظه (إدارة فقط) ──────────────────────────────────

create or replace function public.aqlam_clean_config(p jsonb)
returns jsonb
language plpgsql stable set search_path = public as $$
declare
  d      jsonb := public.aqlam_default_config();
  v      jsonb := coalesce(p, '{}'::jsonb);
  o      jsonb := '{"limits":{},"moderation":{},"features":{},"filters":{},"featured":{},"texts":{},"admin":{}}'::jsonb;
  b      record;
  path   text[];
  n      numeric;
  arr    jsonb;
  e      jsonb;
  i      integer;
  keys   text[];
  k      text;
  s      text;
  txt    text;
  bounds constant jsonb := $json$
  {
    "limits.postsPerDay": [1, 50], "limits.commentsPerDay": [1, 500],
    "limits.reactionsPerDay": [10, 5000], "limits.reportsPerDay": [1, 200],
    "limits.editsPerDay": [1, 100], "limits.guardianRequestsPerDay": [1, 20],
    "limits.titleMax": [20, 300], "limits.bodyMin": [1, 2000], "limits.bodyMax": [200, 100000],
    "limits.commentMax": [20, 2000], "limits.bioMax": [50, 1000],
    "limits.penNameMin": [2, 10], "limits.penNameMax": [10, 60],
    "limits.reportDetailsMax": [50, 2000],
    "limits.guardianReasonMin": [3, 100], "limits.guardianReasonMax": [50, 1000],
    "moderation.reportsToAutoHide": [0, 50], "moderation.removedRetentionDays": [1, 365],
    "moderation.maxPinned": [1, 12], "moderation.reviewFirstN": [1, 20],
    "filters.pageSize": [6, 48], "admin.pageSize": [10, 100]
  }
  $json$::jsonb;
  flags constant text[] := array[
    'moderation.reReviewEdits',
    'features.publishing', 'features.comments', 'features.reactions', 'features.selfEdit',
    'features.selfRemove', 'features.fullName', 'features.penName', 'features.googleIndexing',
    'features.writerPages', 'features.share',
    'filters.showCategory', 'filters.showAge', 'filters.showSort',
    'featured.enabled', 'featured.respectFilters'
  ];
  enums constant jsonb := $json$
  {
    "moderation.review12Plus": ["off", "first", "all"],
    "moderation.blockedWordsAction": ["reject", "review"],
    "filters.defaultSort": ["new", "top", "old"]
  }
  $json$::jsonb;
  -- نصوص: [أقل طول، أكبر طول]
  texts constant jsonb := $json$
  {
    "featured.title": [1, 40],
    "texts.heroTitle": [1, 80], "texts.heroSubtitle": [1, 240], "texts.emptyMessage": [1, 160],
    "texts.publishGuidelines": [0, 800], "texts.closedNotice": [1, 240]
  }
  $json$::jsonb;
  icons constant text[] := array['book', 'feather', 'lightbulb', 'newspaper', 'clapperboard', 'pen',
                                 'quote', 'sparkles', 'heart', 'star', 'globe', 'music'];
begin
  if jsonb_typeof(v) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'root');
  end if;

  -- أرقام صحيحة داخل حدودها
  for b in select key, value from jsonb_each(bounds) loop
    path := string_to_array(b.key, '.');
    if (v #> path) is null then
      n := (d #>> path)::numeric;
    else
      if jsonb_typeof(v #> path) <> 'number'
         or (v #>> path)::numeric <> trunc((v #>> path)::numeric) then
        return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', b.key);
      end if;
      n := (v #>> path)::numeric;
      if n < (b.value ->> 0)::numeric or n > (b.value ->> 1)::numeric then
        return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', b.key);
      end if;
    end if;
    o := jsonb_set(o, path, to_jsonb(n::integer), true);
  end loop;

  -- ترابط الحدود
  if (o #>> '{limits,bodyMin}')::integer >= (o #>> '{limits,bodyMax}')::integer then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'limits.bodyMin');
  end if;
  if (o #>> '{limits,penNameMin}')::integer > (o #>> '{limits,penNameMax}')::integer then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'limits.penNameMin');
  end if;
  if (o #>> '{limits,guardianReasonMin}')::integer > (o #>> '{limits,guardianReasonMax}')::integer then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'limits.guardianReasonMin');
  end if;

  -- مفاتيح تشغيل/إيقاف
  foreach k in array flags loop
    path := string_to_array(k, '.');
    if (v #> path) is null then
      o := jsonb_set(o, path, d #> path, true);
    elsif jsonb_typeof(v #> path) <> 'boolean' then
      return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', k);
    else
      o := jsonb_set(o, path, v #> path, true);
    end if;
  end loop;

  -- اختيارات من قايمة
  for b in select key, value from jsonb_each(enums) loop
    path := string_to_array(b.key, '.');
    if (v #> path) is null then
      o := jsonb_set(o, path, d #> path, true);
    elsif jsonb_typeof(v #> path) <> 'string' or not (b.value ? (v #>> path)) then
      return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', b.key);
    else
      o := jsonb_set(o, path, v #> path, true);
    end if;
  end loop;

  -- نصوص
  for b in select key, value from jsonb_each(texts) loop
    path := string_to_array(b.key, '.');
    if (v #> path) is null then
      o := jsonb_set(o, path, d #> path, true);
    else
      if jsonb_typeof(v #> path) <> 'string' then
        return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', b.key);
      end if;
      txt := btrim(replace(v #>> path, E'\r', ''));
      if char_length(txt) < (b.value ->> 0)::integer or char_length(txt) > (b.value ->> 1)::integer then
        return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', b.key);
      end if;
      o := jsonb_set(o, path, to_jsonb(txt), true);
    end if;
  end loop;

  -- ترتيب الفرز: قايمة غير فاضية من new/top/old، والافتراضي منها
  arr := coalesce(v #> '{filters,sorts}', d #> '{filters,sorts}');
  if jsonb_typeof(arr) <> 'array' or jsonb_array_length(arr) not between 1 and 3 then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'filters.sorts');
  end if;
  keys := array[]::text[];
  for e in select * from jsonb_array_elements(arr) loop
    if jsonb_typeof(e) <> 'string' or (e #>> '{}') not in ('new', 'top', 'old') or (e #>> '{}') = any (keys) then
      return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'filters.sorts');
    end if;
    keys := keys || (e #>> '{}');
  end loop;
  if not ((o #>> '{filters,defaultSort}') = any (keys)) then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'filters.defaultSort');
  end if;
  o := jsonb_set(o, '{filters,sorts}', arr, true);

  -- شرايح السن الظاهرة في الفلتر (ممكن تبقى فاضية)
  arr := coalesce(v #> '{filters,ageBands}', d #> '{filters,ageBands}');
  if jsonb_typeof(arr) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'filters.ageBands');
  end if;
  keys := array[]::text[];
  for e in select * from jsonb_array_elements(arr) loop
    if jsonb_typeof(e) <> 'string' or (e #>> '{}') not in ('6-9', '10-12', '13-17', '18-20')
       or (e #>> '{}') = any (keys) then
      return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'filters.ageBands');
    end if;
    keys := keys || (e #>> '{}');
  end loop;
  o := jsonb_set(o, '{filters,ageBands}', arr, true);

  -- التصنيفات: ١–١٢، مفتاح فريد بصيغة ثابتة، تسمية، أيقونة من قايمة، ومنها واحد مفعّل
  arr := coalesce(v -> 'categories', d -> 'categories');
  if jsonb_typeof(arr) <> 'array' or jsonb_array_length(arr) not between 1 and 12 then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'categories');
  end if;
  keys := array[]::text[];
  n := 0;
  i := 0;
  for e in select * from jsonb_array_elements(arr) loop
    i := i + 1;
    s := e ->> 'key';
    txt := btrim(coalesce(e ->> 'label', ''));
    if jsonb_typeof(e) <> 'object' or s is null or s !~ '^[a-z][a-z0-9_]{1,23}$' or s = any (keys)
       or char_length(txt) not between 1 and 30
       or not ((coalesce(e ->> 'icon', 'pen')) = any (icons))
       or jsonb_typeof(e -> 'enabled') is distinct from 'boolean' then
      return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'categories.' || i);
    end if;
    keys := keys || s;
    if (e ->> 'enabled')::boolean then n := n + 1; end if;
  end loop;
  if n = 0 then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'categories');
  end if;
  -- تصنيف عليه نصوص ما ينفعش يتشال من القايمة (يتعطّل بس).
  if exists (select 1 from public.aqlam_posts where not (category = any (keys))) then
    return jsonb_build_object('ok', false, 'error', 'category_in_use');
  end if;
  o := jsonb_set(o, '{categories}', (
    select jsonb_agg(jsonb_build_object(
             'key', x ->> 'key', 'label', btrim(x ->> 'label'),
             'icon', coalesce(x ->> 'icon', 'pen'), 'enabled', (x ->> 'enabled')::boolean)
           order by ord)
      from jsonb_array_elements(arr) with ordinality as t(x, ord)), true);

  -- التفاعلات: المفاتيح التلاتة ثابتة (القاعدة بتحسبها)، والباقي قابل للتعديل
  arr := coalesce(v -> 'reactions', d -> 'reactions');
  if jsonb_typeof(arr) <> 'array' or jsonb_array_length(arr) <> 3 then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'reactions');
  end if;
  keys := array[]::text[];
  i := 0;
  for e in select * from jsonb_array_elements(arr) loop
    i := i + 1;
    s := e ->> 'key';
    if jsonb_typeof(e) <> 'object' or s not in ('heart', 'star', 'spark') or s = any (keys)
       or char_length(btrim(coalesce(e ->> 'label', ''))) not between 1 and 20
       or char_length(btrim(coalesce(e ->> 'emoji', ''))) not between 1 and 8
       or jsonb_typeof(e -> 'enabled') is distinct from 'boolean' then
      return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'reactions.' || i);
    end if;
    keys := keys || s;
  end loop;
  o := jsonb_set(o, '{reactions}', (
    select jsonb_agg(jsonb_build_object(
             'key', x ->> 'key', 'label', btrim(x ->> 'label'),
             'emoji', btrim(x ->> 'emoji'), 'enabled', (x ->> 'enabled')::boolean)
           order by ord)
      from jsonb_array_elements(arr) with ordinality as t(x, ord)), true);

  -- أسباب البلاغ: الخمسة ثابتة، التسمية والتفعيل قابلين للتعديل، ومنها واحد مفعّل
  arr := coalesce(v -> 'reportReasons', d -> 'reportReasons');
  if jsonb_typeof(arr) <> 'array' or jsonb_array_length(arr) <> 5 then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'reportReasons');
  end if;
  keys := array[]::text[];
  n := 0;
  i := 0;
  for e in select * from jsonb_array_elements(arr) loop
    i := i + 1;
    s := e ->> 'key';
    if jsonb_typeof(e) <> 'object'
       or s not in ('contact_info', 'inappropriate', 'bullying', 'copied', 'other') or s = any (keys)
       or char_length(btrim(coalesce(e ->> 'label', ''))) not between 1 and 40
       or jsonb_typeof(e -> 'enabled') is distinct from 'boolean' then
      return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'reportReasons.' || i);
    end if;
    keys := keys || s;
    if (e ->> 'enabled')::boolean then n := n + 1; end if;
  end loop;
  if n = 0 then
    return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'reportReasons');
  end if;
  o := jsonb_set(o, '{reportReasons}', (
    select jsonb_agg(jsonb_build_object(
             'key', x ->> 'key', 'label', btrim(x ->> 'label'), 'enabled', (x ->> 'enabled')::boolean)
           order by ord)
      from jsonb_array_elements(arr) with ordinality as t(x, ord)), true);

  return jsonb_build_object('ok', true, 'value', o);
end;
$$;

-- قراءة الإعداد كامل (مع الكلمات الممنوعة) — للإدارة بس.
create or replace function public.aqlam_admin_config()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r record;
begin
  if auth.uid() is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  select value, private, updated_at, updated_by into r from public.aqlam_config where id;
  return jsonb_build_object('ok', true,
    'value', coalesce(r.value, public.aqlam_default_config()),
    'private', coalesce(r.private, '{}'::jsonb),
    'updated_at', r.updated_at,
    'updated_by', r.updated_by);
end;
$$;

-- حفظ الإعداد. `p_private` = null يعني سيب الكلمات الممنوعة زي ما هي.
create or replace function public.aqlam_save_config(p_value jsonb, p_private jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_clean   jsonb;
  v_words   jsonb;
  v_seen    text[] := array[]::text[];
  v_out     jsonb := '[]'::jsonb;
  w         text;
  nw        text;
begin
  if v_uid is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_clean := public.aqlam_clean_config(p_value);
  if not (v_clean ->> 'ok')::boolean then return v_clean; end if;

  if p_private is not null then
    v_words := p_private -> 'blockedWords';
    if v_words is null then v_words := '[]'::jsonb; end if;
    if jsonb_typeof(v_words) <> 'array' or jsonb_array_length(v_words) > 300 then
      return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'blockedWords');
    end if;
    for w in select jsonb_array_elements_text(v_words) loop
      w := btrim(regexp_replace(w, '\s+', ' ', 'g'));
      if char_length(w) not between 2 and 40 then
        return jsonb_build_object('ok', false, 'error', 'config_invalid', 'field', 'blockedWords');
      end if;
      nw := public.aqlam_normalize_ar(w);
      if not (nw = any (v_seen)) then
        v_seen := v_seen || nw;
        v_out := v_out || to_jsonb(w);
      end if;
    end loop;
    update public.aqlam_config
       set value = v_clean -> 'value',
           private = jsonb_build_object('blockedWords', v_out),
           updated_at = now(), updated_by = v_uid
     where id;
  else
    update public.aqlam_config
       set value = v_clean -> 'value', updated_at = now(), updated_by = v_uid
     where id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.aqlam_clean_config(jsonb) from public, anon, authenticated;
revoke all on function public.aqlam_admin_config() from public, anon, authenticated;
revoke all on function public.aqlam_save_config(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.aqlam_admin_config() to authenticated;
grant execute on function public.aqlam_save_config(jsonb, jsonb) to authenticated;

-- ── ٦) الدوال اللي بتكتب — بنفس منطقها القديم + قراءة الإعداد ─────────────────

-- نشر نص. أقل من ١٢ ← بانتظار ولي الأمر. ١٢+ ← ظاهر فورًا (أو للمراجعة حسب السياسة).
create or replace function public.aqlam_publish_post(
  p_title               text,
  p_body                text,
  p_category            text,
  p_name_mode           text,
  p_pen_name            text,
  p_allow_indexing      boolean,
  p_comments_enabled    boolean,
  p_source_document_id  uuid,
  p_birth_date          date,
  p_consent_version     text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_child     record;
  v_full_name text;
  v_age       integer;
  v_group     text;
  v_display   text;
  v_title     text := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  v_body      text := btrim(replace(coalesce(p_body, ''), E'\r', ''));
  v_pen       text := nullif(regexp_replace(btrim(coalesce(p_pen_name, '')), '\s+', ' ', 'g'), '');
  v_status    text;
  v_id        uuid;
  v_blocked   boolean;
  v_review    text := public.aqlam_cfg_text('moderation', 'review12Plus');
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if public.aqlam_is_suspended(v_uid) then return jsonb_build_object('ok', false, 'error', 'suspended'); end if;
  if not public.aqlam_cfg_bool('features', 'publishing') then
    return jsonb_build_object('ok', false, 'error', 'publishing_closed');
  end if;

  if char_length(v_title) not between 1 and public.aqlam_cfg_int('limits', 'titleMax')
     or char_length(v_body) not between public.aqlam_cfg_int('limits', 'bodyMin') and public.aqlam_cfg_int('limits', 'bodyMax')
     or not public.aqlam_list_key_ok('categories', p_category, true)
     or p_name_mode not in ('first_name', 'full_name', 'pen_name')
     or nullif(btrim(coalesce(p_consent_version, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if not public.aqlam_list_key_ok('categories', p_category) then
    return jsonb_build_object('ok', false, 'error', 'category_disabled');
  end if;
  if (p_name_mode = 'full_name' and not public.aqlam_cfg_bool('features', 'fullName'))
     or (p_name_mode = 'pen_name' and not public.aqlam_cfg_bool('features', 'penName')) then
    return jsonb_build_object('ok', false, 'error', 'name_mode_disabled');
  end if;

  if public.aqlam_contains_contact(v_title) or public.aqlam_contains_contact(v_body)
     or public.aqlam_contains_contact(v_pen) then
    return jsonb_build_object('ok', false, 'error', 'contact_info');
  end if;

  v_blocked := public.aqlam_blocked_hit(v_title || ' ' || v_body || ' ' || coalesce(v_pen, ''));
  if v_blocked and public.aqlam_cfg_text('moderation', 'blockedWordsAction') = 'reject' then
    return jsonb_build_object('ok', false, 'error', 'blocked_word');
  end if;

  if (select count(*) from aqlam_posts
       where writer_id = v_uid and created_at > now() - interval '24 hours')
     >= public.aqlam_cfg_int('limits', 'postsPerDay') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  -- مصدر النسخة لازم يكون مستند الكاتب نفسه (إشارة بس، من غير ربط).
  if p_source_document_id is not null and not exists (
       select 1 from portfolio_documents
        where id = p_source_document_id and student_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end if;

  select c.id, c.full_name, c.birth_date into v_child
    from child_profiles c
   where nullif(btrim(coalesce(c.account_profile_id, '')), '') = v_uid::text
   order by c.created_at
   limit 1;

  if found then
    -- حساب ابن: السنّ من ملف الطفل (فاضي = أقل من ١٢)، والاسم منه.
    v_full_name := v_child.full_name;
    v_age := coalesce(public.aqlam_age_on(v_child.birth_date), 0);
    if exists (select 1 from aqlam_guardian_settings
                where child_id = v_child.id and not publishing_allowed) then
      return jsonb_build_object('ok', false, 'error', 'guardian_locked');
    end if;
  else
    select full_name into v_full_name from user_profiles where id = v_uid;
    v_age := public.aqlam_age_of(v_uid);
    if v_age is null then
      -- أول نشر لحساب مستقل: تاريخ الميلاد يتجمع مرة واحدة.
      if p_birth_date is null then
        return jsonb_build_object('ok', false, 'error', 'birthdate_required');
      end if;
      v_age := public.aqlam_age_on(p_birth_date);
      if p_birth_date > public.aqlam_today() or v_age > 110 then
        return jsonb_build_object('ok', false, 'error', 'invalid_birthdate');
      end if;
      if v_age < 12 then
        return jsonb_build_object('ok', false, 'error', 'too_young');
      end if;
      insert into aqlam_writer_profiles (user_id, birth_date)
      values (v_uid, p_birth_date)
      on conflict (user_id) do update set birth_date = excluded.birth_date
        where aqlam_writer_profiles.birth_date is null;
    end if;
  end if;

  v_group := case when v_age >= 12 then '12_plus' else 'under_12' end;

  -- الاسم الظاهر: أقل من ١٢ الاسم الأول بس.
  if p_name_mode = 'first_name' then
    v_display := split_part(btrim(coalesce(v_full_name, '')), ' ', 1);
  elsif v_group = 'under_12' then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  elsif p_name_mode = 'full_name' then
    v_display := regexp_replace(btrim(coalesce(v_full_name, '')), '\s+', ' ', 'g');
  else
    if v_pen is null
       or char_length(v_pen) not between public.aqlam_cfg_int('limits', 'penNameMin') and public.aqlam_cfg_int('limits', 'penNameMax') then
      return jsonb_build_object('ok', false, 'error', 'invalid_name');
    end if;
    v_display := v_pen;
  end if;
  if char_length(coalesce(v_display, '')) not between 1 and 60 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;

  -- أقل من ١٢: ولي الأمر الأول. ١٢+: ظاهر فورًا إلا لو السياسة أو الكلمات الممنوعة تطلب مراجعة.
  v_status := case
    when v_group = 'under_12' then 'pending_guardian'
    when v_blocked then 'pending_review'
    when v_review = 'all' then 'pending_review'
    when v_review = 'first'
         and (select count(*) from aqlam_posts where writer_id = v_uid and published_at is not null)
             < public.aqlam_cfg_int('moderation', 'reviewFirstN') then 'pending_review'
    else 'published' end;

  insert into aqlam_posts (
    writer_id, source_document_id, title, body, category, display_name, name_mode,
    age_group, age_band, status, allow_indexing, comments_enabled,
    consent_version, published_at
  ) values (
    v_uid, p_source_document_id, v_title, v_body, p_category, v_display, p_name_mode,
    v_group, public.aqlam_age_band(v_age), v_status,
    (v_group = '12_plus' and coalesce(p_allow_indexing, false) and public.aqlam_cfg_bool('features', 'googleIndexing')),
    coalesce(p_comments_enabled, true),
    btrim(p_consent_version),
    case when v_status = 'published' then now() end
  ) returning id into v_id;

  -- نص طفل: ولي الأمر يعرف إن فيه حاجة بانتظاره.
  if v_status = 'pending_guardian' and v_child.id is not null then
    perform public.aqlam_notify(
      (select user_profile_id::text from child_profiles where id = v_child.id),
      'نص جديد بانتظار موافقتك',
      split_part(btrim(coalesce(v_full_name, '')), ' ', 1) || ' كتب نصًا وعايز ينشره في أقلام الرحلة. اقراه وقرر.',
      '/account/family/aqlam'
    );
  elsif v_status = 'pending_review' then
    perform public.aqlam_notify_admins('نص بانتظار مراجعتك في أقلام الرحلة',
      'نص جديد لازم يتراجع قبل ما يظهر.', '/dashboard/admin/aqlam');
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status, 'age_group', v_group);
end;
$$;

-- «شيل»: الكاتب يشيل نصه (لو الإدارة سامحة بكده).
create or replace function public.aqlam_remove_own_post(p_post uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  n integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_cfg_bool('features', 'selfRemove') then
    return jsonb_build_object('ok', false, 'error', 'removal_closed');
  end if;
  update aqlam_posts
     set status = 'removed', removed_at = now(), removed_by = v_uid, removal_reason = 'writer'
   where id = p_post and writer_id = v_uid and status <> 'removed';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  update aqlam_reports set status = 'actioned', handled_at = now()
   where target_type = 'post' and target_id = p_post and status = 'open';
  return jsonb_build_object('ok', true);
end;
$$;

-- تعديل نص الكاتب نفسه.
create or replace function public.aqlam_update_post(
  p_post              uuid,
  p_title             text,
  p_body              text,
  p_category          text,
  p_allow_indexing    boolean,
  p_comments_enabled  boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_post    aqlam_posts%rowtype;
  v_child   record;
  v_title   text := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  v_body    text := btrim(replace(coalesce(p_body, ''), E'\r', ''));
  v_changed boolean;
  v_status  text;
  v_is_child boolean := false;
  v_blocked boolean;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if public.aqlam_is_suspended(v_uid) then return jsonb_build_object('ok', false, 'error', 'suspended'); end if;
  if not public.aqlam_cfg_bool('features', 'selfEdit') then
    return jsonb_build_object('ok', false, 'error', 'editing_closed');
  end if;

  select * into v_post from aqlam_posts where id = p_post and writer_id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_post.status in ('hidden', 'removed') then
    return jsonb_build_object('ok', false, 'error', 'not_editable');
  end if;

  if char_length(v_title) not between 1 and public.aqlam_cfg_int('limits', 'titleMax')
     or char_length(v_body) not between public.aqlam_cfg_int('limits', 'bodyMin') and public.aqlam_cfg_int('limits', 'bodyMax')
     or not public.aqlam_list_key_ok('categories', p_category, true) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  -- تصنيف متعطّل: النص يفضل عليه، لكن مايتنقلش ليه.
  if p_category is distinct from v_post.category and not public.aqlam_list_key_ok('categories', p_category) then
    return jsonb_build_object('ok', false, 'error', 'category_disabled');
  end if;
  if public.aqlam_contains_contact(v_title) or public.aqlam_contains_contact(v_body) then
    return jsonb_build_object('ok', false, 'error', 'contact_info');
  end if;

  v_blocked := public.aqlam_blocked_hit(v_title || ' ' || v_body);
  if v_blocked and public.aqlam_cfg_text('moderation', 'blockedWordsAction') = 'reject' then
    return jsonb_build_object('ok', false, 'error', 'blocked_word');
  end if;

  select c.id, c.user_profile_id, c.full_name into v_child
    from child_profiles c
   where nullif(btrim(coalesce(c.account_profile_id, '')), '') = v_uid::text
   order by c.created_at limit 1;
  v_is_child := found;
  if v_is_child and exists (select 1 from aqlam_guardian_settings
                             where child_id = v_child.id and not publishing_allowed) then
    return jsonb_build_object('ok', false, 'error', 'guardian_locked');
  end if;

  v_changed := (v_title is distinct from v_post.title) or (v_body is distinct from v_post.body);

  if v_changed and (select count(*) from aqlam_post_edits
                     where writer_id = v_uid and created_at > now() - interval '24 hours')
                   >= public.aqlam_cfg_int('limits', 'editsPerDay') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  v_status := v_post.status;
  if v_changed or p_category is distinct from v_post.category then
    if v_post.status = 'published' and v_post.age_group = 'under_12' then
      v_status := 'pending_guardian';
    elsif v_post.status = 'published' and v_post.age_group = '12_plus'
          and (public.aqlam_cfg_bool('moderation', 'reReviewEdits')
               or (v_blocked and public.aqlam_cfg_text('moderation', 'blockedWordsAction') = 'review')) then
      v_status := 'pending_review';
    elsif v_post.status = 'rejected' then
      v_status := case when v_post.age_group = 'under_12' then 'pending_guardian' else 'pending_review' end;
    end if;
  end if;

  if v_changed then
    insert into aqlam_post_edits (post_id, writer_id, old_title, old_body)
    values (v_post.id, v_uid, v_post.title, v_post.body);
  end if;

  update aqlam_posts
     set title = v_title,
         body = v_body,
         category = p_category,
         allow_indexing = (age_group = '12_plus' and coalesce(p_allow_indexing, false)
                           and public.aqlam_cfg_bool('features', 'googleIndexing')),
         comments_enabled = coalesce(p_comments_enabled, true),
         status = v_status,
         -- «عُدّل» بس لو النص كان ظاهر قبل كده واتغيّر فعلًا.
         edited_at = case when v_changed and v_post.published_at is not null then now() else edited_at end,
         -- رجوع لدورة الموافقة = القرارات القديمة ما بقتش سارية.
         guardian_approved_at = case when v_status = 'pending_guardian' then null else guardian_approved_at end,
         guardian_approved_by = case when v_status = 'pending_guardian' then null else guardian_approved_by end,
         reviewed_at = case when v_status <> v_post.status then null else reviewed_at end,
         reviewed_by = case when v_status <> v_post.status then null else reviewed_by end,
         removal_reason = case when v_status <> v_post.status then null else removal_reason end
   where id = v_post.id;

  if v_status = 'pending_guardian' and v_status <> v_post.status and v_is_child and v_child.user_profile_id is not null then
    perform public.aqlam_notify(
      v_child.user_profile_id::text,
      'نص بانتظار موافقتك',
      split_part(btrim(coalesce(v_child.full_name, '')), ' ', 1) || ' عدّل نصًا في أقلام الرحلة. اقراه وقرر.',
      '/account/family/aqlam'
    );
  elsif v_status = 'pending_review' and v_status <> v_post.status then
    perform public.aqlam_notify_admins('نص بانتظار مراجعتك في أقلام الرحلة',
      'كاتب عدّل نصًا وقدّمه للمراجعة.', '/dashboard/admin/aqlam');
  end if;

  return jsonb_build_object('ok', true, 'status', v_status, 'changed', v_changed,
                            'back_to_approval', v_status <> v_post.status);
end;
$$;

-- ملصق: شغّل/اطفي. بيرجّع العدد الجديد.
create or replace function public.aqlam_set_reaction(p_post uuid, p_kind text, p_on boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if public.aqlam_is_suspended(v_uid) then return jsonb_build_object('ok', false, 'error', 'suspended'); end if;
  if p_kind not in ('heart', 'star', 'spark') then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if not exists (select 1 from aqlam_posts where id = p_post and status = 'published') then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if coalesce(p_on, true) then
    if not public.aqlam_cfg_bool('features', 'reactions') then
      return jsonb_build_object('ok', false, 'error', 'reactions_off');
    end if;
    if not public.aqlam_list_key_ok('reactions', p_kind) then
      return jsonb_build_object('ok', false, 'error', 'reaction_disabled');
    end if;
    if (select count(*) from aqlam_reactions
         where user_id = v_uid and created_at > now() - interval '24 hours')
       >= public.aqlam_cfg_int('limits', 'reactionsPerDay') then
      return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;
    insert into aqlam_reactions (post_id, user_id, kind) values (p_post, v_uid, p_kind)
      on conflict (post_id, user_id, kind) do nothing;
  else
    delete from aqlam_reactions where post_id = p_post and user_id = v_uid and kind = p_kind;
  end if;

  select count(*) into v_count from aqlam_reactions where post_id = p_post;
  update aqlam_posts set reaction_count = v_count where id = p_post;
  return jsonb_build_object('ok', true, 'reaction_count', v_count);
end;
$$;

-- تعليق. أقل من ١٢ ← المدربين والإدارة بس.
create or replace function public.aqlam_add_comment(p_post uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid         uuid := auth.uid();
  v_body        text := btrim(replace(coalesce(p_body, ''), E'\r', ''));
  v_post        record;
  v_is_instr    boolean;
  v_is_admin    boolean;
  v_name        text;
  v_id          uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if public.aqlam_is_suspended(v_uid) then return jsonb_build_object('ok', false, 'error', 'suspended'); end if;
  if not public.aqlam_cfg_bool('features', 'comments') then
    return jsonb_build_object('ok', false, 'error', 'comments_off');
  end if;
  if char_length(v_body) not between 1 and public.aqlam_cfg_int('limits', 'commentMax') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if public.aqlam_contains_contact(v_body) then return jsonb_build_object('ok', false, 'error', 'contact_info'); end if;
  if public.aqlam_blocked_hit(v_body) then return jsonb_build_object('ok', false, 'error', 'blocked_word'); end if;

  select id, writer_id, age_group, comments_enabled into v_post
    from aqlam_posts where id = p_post and status = 'published';
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not v_post.comments_enabled then return jsonb_build_object('ok', false, 'error', 'comments_closed'); end if;

  v_is_instr := exists (select 1 from instructors where user_id = v_uid and status = 'active');
  v_is_admin := public.is_admin();

  if v_post.age_group = 'under_12' and not (v_is_instr or v_is_admin) then
    return jsonb_build_object('ok', false, 'error', 'comments_restricted');
  end if;

  -- ولي الأمر قفل التعليقات على ابنه (استقبالًا وكتابةً).
  if exists (select 1 from aqlam_guardian_settings g
               join child_profiles c on c.id = g.child_id
              where not g.comments_allowed
                and nullif(btrim(coalesce(c.account_profile_id, '')), '') in (v_post.writer_id::text, v_uid::text)) then
    return jsonb_build_object('ok', false, 'error', 'guardian_locked');
  end if;

  -- حساب أقل من ١٢ مايعلّقش (إلا لو مدرب/إدارة).
  if not (v_is_instr or v_is_admin) and public.aqlam_is_child_account(v_uid)
     and coalesce(public.aqlam_age_of(v_uid), 0) < 12 then
    return jsonb_build_object('ok', false, 'error', 'too_young');
  end if;

  if (select count(*) from aqlam_comments
       where author_id = v_uid and created_at > now() - interval '24 hours')
     >= public.aqlam_cfg_int('limits', 'commentsPerDay') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  -- الاسم: المدرب باسمه المعروض. غيره: اسم القلم لو اختاره (١٢+ بس)، وإلا الاسم الأول.
  if v_is_instr then
    select display_name into v_name from instructors where user_id = v_uid and status = 'active' limit 1;
  else
    select coalesce(
             (select w.pen_name from aqlam_writer_profiles w
               where w.user_id = v_uid and w.pen_name is not null
                 and coalesce(public.aqlam_age_of(v_uid), 0) >= 12),
             (select split_part(btrim(c.full_name), ' ', 1) from child_profiles c
               where nullif(btrim(coalesce(c.account_profile_id, '')), '') = v_uid::text limit 1),
             (select split_part(btrim(u.full_name), ' ', 1) from user_profiles u where u.id = v_uid)
           ) into v_name;
  end if;
  if nullif(btrim(coalesce(v_name, '')), '') is null then v_name := 'قارئ'; end if;

  insert into aqlam_comments (post_id, author_id, author_display_name, body, is_instructor)
  values (p_post, v_uid, left(v_name, 60), v_body, v_is_instr)
  returning id into v_id;

  update aqlam_posts
     set comment_count = (select count(*) from aqlam_comments where post_id = p_post and status = 'visible')
   where id = p_post;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- بلاغ على نص أو تعليق. عدد حسابات مختلفة (من الإعداد) = إخفاء تلقائي لحد المراجعة.
create or replace function public.aqlam_report(
  p_target_type text,
  p_target_id   uuid,
  p_reason      text,
  p_details     text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_open    integer;
  v_hidden  boolean := false;
  v_post_id uuid;
  v_limit   integer := public.aqlam_cfg_int('moderation', 'reportsToAutoHide');
  n         integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if p_target_type not in ('post', 'comment')
     or not public.aqlam_list_key_ok('reportReasons', p_reason)
     or char_length(coalesce(p_details, '')) > public.aqlam_cfg_int('limits', 'reportDetailsMax') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if p_target_type = 'post' then
    if not exists (select 1 from aqlam_posts where id = p_target_id and status = 'published') then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
  else
    select post_id into v_post_id from aqlam_comments where id = p_target_id and status = 'visible';
    if v_post_id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  end if;

  if (select count(*) from aqlam_reports
       where reporter_id = v_uid and created_at > now() - interval '24 hours')
     >= public.aqlam_cfg_int('limits', 'reportsPerDay') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  insert into aqlam_reports (reporter_id, target_type, target_id, reason, details)
  values (v_uid, p_target_type, p_target_id, p_reason, nullif(btrim(coalesce(p_details, '')), ''))
  on conflict (reporter_id, target_type, target_id) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', true, 'already', true); end if;

  select count(distinct reporter_id) into v_open
    from aqlam_reports
   where target_type = p_target_type and target_id = p_target_id and status = 'open';

  -- الحد صفر = الإخفاء التلقائي مقفول (البلاغات بتتجمّع للمراجعة بس).
  if v_limit > 0 and v_open >= v_limit then
    if p_target_type = 'post' then
      update aqlam_posts set status = 'hidden', removal_reason = 'auto_reports'
       where id = p_target_id and status = 'published';
    else
      update aqlam_comments set status = 'hidden' where id = p_target_id and status = 'visible';
      update aqlam_posts
         set comment_count = (select count(*) from aqlam_comments where post_id = v_post_id and status = 'visible')
       where id = v_post_id;
    end if;
    v_hidden := true;
    perform public.aqlam_notify_admins('إخفاء تلقائي في أقلام الرحلة',
      'نص أو تعليق اتخبّى بعد ' || v_limit::text || ' بلاغات. راجعه.', '/dashboard/admin/aqlam');
  end if;

  return jsonb_build_object('ok', true, 'auto_hidden', v_hidden);
end;
$$;

-- صفحة الكاتب واسمه القلمي.
create or replace function public.aqlam_set_writer_profile(
  p_pen_name text,
  p_bio      text,
  p_public   boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_pen  text := nullif(regexp_replace(btrim(coalesce(p_pen_name, '')), '\s+', ' ', 'g'), '');
  v_bio  text := nullif(btrim(replace(coalesce(p_bio, ''), E'\r', '')), '');
  v_age  integer;
  v_slug text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if public.aqlam_is_suspended(v_uid) then return jsonb_build_object('ok', false, 'error', 'suspended'); end if;

  if (v_pen is not null
      and char_length(v_pen) not between public.aqlam_cfg_int('limits', 'penNameMin') and public.aqlam_cfg_int('limits', 'penNameMax'))
     or (v_bio is not null and char_length(v_bio) > public.aqlam_cfg_int('limits', 'bioMax')) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if public.aqlam_contains_contact(v_pen) or public.aqlam_contains_contact(v_bio) then
    return jsonb_build_object('ok', false, 'error', 'contact_info');
  end if;
  if public.aqlam_blocked_hit(coalesce(v_pen, '') || ' ' || coalesce(v_bio, '')) then
    return jsonb_build_object('ok', false, 'error', 'blocked_word');
  end if;

  if coalesce(p_public, false) then
    if not public.aqlam_cfg_bool('features', 'writerPages') then
      return jsonb_build_object('ok', false, 'error', 'writer_pages_closed');
    end if;
    v_age := public.aqlam_age_of(v_uid);
    if v_age is null then return jsonb_build_object('ok', false, 'error', 'birthdate_required'); end if;
    if v_age < 12 then return jsonb_build_object('ok', false, 'error', 'too_young'); end if;
    if v_pen is null then return jsonb_build_object('ok', false, 'error', 'pen_name_required'); end if;
  end if;

  insert into aqlam_writer_profiles (user_id, pen_name, bio, public_profile)
  values (v_uid, v_pen, v_bio, coalesce(p_public, false))
  on conflict (user_id) do update
    set pen_name = excluded.pen_name,
        bio = excluded.bio,
        public_profile = excluded.public_profile;

  if coalesce(p_public, false) then
    update aqlam_writer_profiles
       set public_slug = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
     where user_id = v_uid and public_slug is null
    returning public_slug into v_slug;
    if v_slug is null then
      select public_slug into v_slug from aqlam_writer_profiles where user_id = v_uid;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'slug', v_slug);
end;
$$;

-- طلب ولي الأمر قفل التعليقات لابنه (السبب إجباري، وحدوده من الإعداد).
create or replace function public.aqlam_request_comments_lock(p_child text, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_reason text := nullif(regexp_replace(btrim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
  v_name   text;
  v_id     uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;

  select full_name into v_name from child_profiles where id = p_child and user_profile_id = v_uid;
  if not found then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;

  if v_reason is null
     or char_length(v_reason) not between public.aqlam_cfg_int('limits', 'guardianReasonMin') and public.aqlam_cfg_int('limits', 'guardianReasonMax') then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;
  if exists (select 1 from aqlam_guardian_settings where child_id = p_child and not comments_allowed) then
    return jsonb_build_object('ok', false, 'error', 'already_locked');
  end if;
  if exists (select 1 from aqlam_guardian_requests
              where child_id = p_child and kind = 'close_comments' and status = 'pending') then
    return jsonb_build_object('ok', false, 'error', 'already_pending');
  end if;
  if (select count(*) from aqlam_guardian_requests
       where child_id = p_child and created_at > now() - interval '24 hours')
     >= public.aqlam_cfg_int('limits', 'guardianRequestsPerDay') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  insert into aqlam_guardian_requests (child_id, child_name, guardian_id, kind, reason)
  values (p_child, coalesce(v_name, ''), v_uid, 'close_comments', v_reason)
  returning id into v_id;

  perform public.aqlam_notify_admins('طلب قفل تعليقات في أقلام الرحلة',
    'ولي أمر ' || coalesce(v_name, 'ابن') || ' طلب قفل التعليقات. راجع السبب وقرّر.',
    '/dashboard/admin/aqlam');
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- تثبيت/ترتيب المختارات — الحد الأقصى من الإعداد.
create or replace function public.aqlam_set_pin(p_post uuid, p_op text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_max  integer := public.aqlam_cfg_int('moderation', 'maxPinned');
  v_uid  uuid := auth.uid();
  v_post record;
  v_n    integer;
  v_mine integer;
  v_nb   record;
begin
  if v_uid is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_op not in ('pin', 'unpin', 'up', 'down') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select id, status, featured_at into v_post from aqlam_posts where id = p_post for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  -- نرقّم المثبّت ١..ن بالترتيب الحالي (بيصلّح أي فجوة أو ترتيب ناقص).
  update aqlam_posts p set featured_rank = r.rn::integer
    from (select id, row_number() over (order by featured_rank nulls last, featured_at desc, id) as rn
            from aqlam_posts where featured_at is not null) r
   where p.id = r.id and p.featured_rank is distinct from r.rn::integer;

  if p_op = 'pin' then
    if v_post.status <> 'published' then return jsonb_build_object('ok', false, 'error', 'not_published'); end if;
    if v_post.featured_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
    select count(*) into v_n from aqlam_posts where featured_at is not null;
    if v_n >= c_max then return jsonb_build_object('ok', false, 'error', 'pin_limit'); end if;
    update aqlam_posts set featured_at = now(), featured_rank = v_n + 1 where id = p_post;

  elsif p_op = 'unpin' then
    update aqlam_posts set featured_at = null, featured_rank = null where id = p_post;
    update aqlam_posts p set featured_rank = r.rn::integer
      from (select id, row_number() over (order by featured_rank, featured_at desc, id) as rn
              from aqlam_posts where featured_at is not null) r
     where p.id = r.id;

  else
    if v_post.featured_at is null then return jsonb_build_object('ok', false, 'error', 'not_pinned'); end if;
    select featured_rank into v_mine from aqlam_posts where id = p_post;
    if p_op = 'up' then
      select id, featured_rank into v_nb from aqlam_posts
       where featured_at is not null and featured_rank < v_mine order by featured_rank desc limit 1;
    else
      select id, featured_rank into v_nb from aqlam_posts
       where featured_at is not null and featured_rank > v_mine order by featured_rank asc limit 1;
    end if;
    if v_nb.id is not null then
      update aqlam_posts set featured_rank = v_nb.featured_rank where id = p_post;
      update aqlam_posts set featured_rank = v_mine where id = v_nb.id;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- المسح اليومي: بدون رقم = مدة الاحتفاظ من الإعداد.
create or replace function public.aqlam_purge_removed(p_days integer default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_days     integer := greatest(coalesce(p_days, public.aqlam_cfg_int('moderation', 'removedRetentionDays'), 7), 1);
  v_cut      timestamptz := now() - make_interval(days => v_days);
  v_post_ids uuid[];
  v_posts    integer := 0;
  v_comments integer := 0;
  v_reports  integer := 0;
  n          integer;
begin
  select coalesce(array_agg(id), '{}') into v_post_ids
    from aqlam_posts where status = 'removed' and removed_at < v_cut;

  if cardinality(v_post_ids) > 0 then
    delete from aqlam_reports
     where (target_type = 'post' and target_id = any (v_post_ids))
        or (target_type = 'comment' and target_id in (select id from aqlam_comments where post_id = any (v_post_ids)));
    get diagnostics n = row_count; v_reports := v_reports + n;

    delete from aqlam_posts where id = any (v_post_ids);
    get diagnostics v_posts = row_count;
  end if;

  delete from aqlam_reports
   where target_type = 'comment'
     and target_id in (select id from aqlam_comments where status = 'removed' and removed_at < v_cut);
  get diagnostics n = row_count; v_reports := v_reports + n;

  delete from aqlam_comments where status = 'removed' and removed_at < v_cut;
  get diagnostics v_comments = row_count;

  return jsonb_build_object('ok', true, 'posts', v_posts, 'comments', v_comments, 'reports', v_reports);
end;
$$;
