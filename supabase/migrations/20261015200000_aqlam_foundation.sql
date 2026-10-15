-- ============================================================================
-- أقلام الرحلة — الأساس: الجداول والسياسات والدوال
-- ============================================================================
-- الغرض   : منصة نشر للكتّاب الصغار واليافعين على `/aqlam`. الكاتب بينشر
--           **نسخة ثابتة** من نصه، والقراءة مفتوحة للزوار.
--
-- الحدود  : **مفيش تعديل على أي جدول موجود.** ثمانية جداول جديدة بادئتها
--           `aqlam_`، ودوال بنفس البادئة. السجل والإشعارات والإعدادات
--           بتستخدم الموجود (`audit_logs` و`notifyUser` وصف `general` في
--           `site_settings`).
--
-- الحذف   : مفيش FK ولا trigger على `portfolio_documents`. `source_document_id`
--           إشارة بس. المنشور نسخة مستقلة: مسح المستند الأصلي مابيشيلوش من
--           أقلام الرحلة، والكاتب أو الإدارة يشيلوه بزرار «شيل».
--
-- الترتيب : الكود بيتنشر الأول وهو مقفول (`aqlamMode` = off أو مش موجود)،
--           وبعده الملف ده. الملف **مايفتحش** حاجة: الدوال كلها بترفض لو
--           العلم مقفول.
--
-- القواعد اللي بتتطبق هنا، في القاعدة نفسها:
--   • السن بيتحسب من تاريخ الميلاد (الطفل: `child_profiles`، المستقل:
--     `aqlam_writer_profiles`)، والفئة بتتحسب لحظة النشر وبتتخزّن.
--   • أقل من ١٢ (أو تاريخ فاضي): موافقة ولي الأمر ثم مراجعة الإدارة قبل الظهور.
--   • ١٢+: نشر مباشر، ومراجعة بعد الظهور بالبلاغات.
--   • التعليق: على نص أقل من ١٢ للمدربين والإدارة بس.
--   • حدود يومية: ٣ نصوص · ٢٠ تعليق · ٢٠٠ ملصق · ١٠ بلاغات (نافذة ٢٤ ساعة).
--   • ٣ بلاغات مفتوحة من ٣ حسابات مختلفة = إخفاء تلقائي لحد ما الإدارة تراجع.
--   • كل الكتابة من المستخدمين بتمر على دوال `security definer` — مفيش سياسة
--     INSERT/UPDATE/DELETE للمستخدم على جداول النصوص والتعليقات والملصقات.
--
-- التحقق  : `supabase/tests/aqlam_foundation.sql` (معاملة بتتراجع).
-- ============================================================================


-- ── ١) دوال مساعدة ──────────────────────────────────────────────────────────

-- حالة التشغيل من صف `general`: off | pilot | public. الافتراضي مقفول.
create or replace function public.aqlam_mode()
returns text
language sql stable security definer set search_path = public as $$
  select case coalesce((select value ->> 'aqlamMode' from site_settings where key = 'general'), 'off')
           when 'public' then 'public'
           when 'pilot'  then 'pilot'
           else 'off'
         end;
$$;

-- الحساب ده يقدر ينشر ويتفاعل؟ مقفول = لأ لأي حد (حتى الإدارة: ده الإيقاف
-- الطارئ). تجريبي = قايمة مسموحة + الإدارة. عام = الكل.
create or replace function public.aqlam_enabled_for(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case public.aqlam_mode()
           when 'public' then true
           when 'pilot' then
             p_user is not null and (
               coalesce((select (value -> 'aqlamAllowlist') ? p_user::text
                           from site_settings where key = 'general'), false)
               or exists (select 1 from user_profiles
                           where id = p_user and role in ('super_admin', 'general_supervisor'))
             )
           else false
         end;
$$;

-- «النهاردة» بتوقيت القاهرة (كل مواعيد المنصة كده).
create or replace function public.aqlam_today()
returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'Africa/Cairo')::date;
$$;

-- السنّ بالسنين الكاملة. نفس حساب `src/lib/aqlam/age.ts`.
create or replace function public.aqlam_age_on(p_birth date, p_on date default null)
returns integer
language sql stable set search_path = public as $$
  select case when p_birth is null then null
              else extract(year from age(coalesce(p_on, public.aqlam_today()), p_birth))::integer
         end;
$$;

-- سنّ الحساب: الطفل من `child_profiles` (فاضي = ٠ = أقل من ١٢)، والمستقل من
-- `aqlam_writer_profiles`، ومجهول = null (لازم تاريخ ميلاد قبل أول نشر).
create or replace function public.aqlam_age_of(p_user uuid)
returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  v_child  record;
  v_birth  date;
begin
  select birth_date into v_child
    from child_profiles
   where nullif(btrim(coalesce(account_profile_id, '')), '') = p_user::text
   order by created_at
   limit 1;
  if found then
    return coalesce(public.aqlam_age_on(v_child.birth_date), 0);
  end if;

  select birth_date into v_birth from aqlam_writer_profiles where user_id = p_user;
  return public.aqlam_age_on(v_birth);
end;
$$;

create or replace function public.aqlam_is_child_account(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from child_profiles
     where nullif(btrim(coalesce(account_profile_id, '')), '') = p_user::text
  );
$$;

-- فئة العرض — نفس تقسيم «إنها لك». خارج المدى = null.
create or replace function public.aqlam_age_band(p_age integer)
returns text
language sql immutable set search_path = public as $$
  select case when p_age is null then null
              when p_age between 6  and 9  then '6-9'
              when p_age between 10 and 12 then '10-12'
              when p_age between 13 and 17 then '13-17'
              when p_age between 18 and 20 then '18-20'
              else null end;
$$;

-- الحساب موقوف دلوقتي؟ (تحذير مابيوقفش حاجة.)
create or replace function public.aqlam_is_suspended(p_user uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  -- plpgsql مش sql: الجدول بيتعمل بعد الدالة دي في الملف، و`sql` بيفحص الجسم وقت الإنشاء.
  return exists (
    select 1 from aqlam_sanctions
     where user_id = p_user
       and kind in ('suspension_7d', 'permanent')
       and (expires_at is null or expires_at > now())
  );
end;
$$;

-- بيانات تواصل في النص؟ شبكة أمان مبسّطة تطابق `src/lib/aqlam/contact-filter.ts`
-- في الحالات الأساسية (رقم، بريد، رابط، @حساب). الفلتر الكامل في الكود.
create or replace function public.aqlam_contains_contact(p_text text)
returns boolean
language plpgsql immutable set search_path = public as $$
declare
  t text;
  s text;
begin
  if p_text is null then return false; end if;
  t := lower(p_text);
  t := translate(t, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  t := regexp_replace(t, '[ً-ٰٟـ​-‏‪-‮⁠﻿]', '', 'g');

  -- رقم متصل
  if t ~ '\d{8,}' then return true; end if;

  -- أرقام مفصولة (٩+)، بعد استثناء السنين («2024 2025 2026» مش تليفون)
  s := regexp_replace(t, '(^|\D)(19|20|21)\d{2}(?=\D|$)', '\1 ', 'g');
  if s ~ '(\d[\s.\-_/()·،,]{0,3}){9,}' then return true; end if;

  -- بريد (عادي أو مموّه)
  if t ~ '[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+\s*\.\s*[a-z]{2,}' then return true; end if;
  if t ~ '[a-z0-9._%+-]+\s*[\[(]\s*at\s*[\])]\s*[a-z0-9-]+\s*(\.|[\[(]?\s*dot\s*[\])]?)\s*[a-z]{2,}' then
    return true;
  end if;

  -- رابط ودومين
  if t ~ '(https?://|www\.)\S+' then return true; end if;
  if t ~ '\m[a-z0-9-]{2,}\.(com|net|org|io|me|app|co|info|eg|link|ly|tv|gg|xyz|online|site|store|shop|dev)\M' then
    return true;
  end if;

  -- اسم حساب
  if t ~ '(^|[\s(])@[a-z0-9_.]{3,}' then return true; end if;

  return false;
end;
$$;


-- ── ٢) الجداول ──────────────────────────────────────────────────────────────

-- التحدّيات الأسبوعية (قبل النصوص لأن النص بيشاور عليها).
create table if not exists public.aqlam_challenges (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  prompt      text not null check (char_length(prompt) between 1 and 2000),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  is_active   boolean not null default true,
  created_by  uuid references public.user_profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- بيانات الكاتب. تاريخ الميلاد بيتجمع **مرة واحدة** عند أول نشر لحساب مستقل.
create table if not exists public.aqlam_writer_profiles (
  user_id     uuid primary key references public.user_profiles (id) on delete cascade,
  birth_date  date,
  pen_name    text check (pen_name is null or char_length(pen_name) between 2 and 40),
  bio         text check (bio is null or char_length(bio) <= 500),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- النسخة الثابتة من النص.
create table if not exists public.aqlam_posts (
  id                   uuid primary key default gen_random_uuid(),
  writer_id            uuid not null references public.user_profiles (id) on delete cascade,
  -- إشارة للمستند الأصلي **من غير FK** (قرار: مسح المستند مايمسّش المنشور).
  source_document_id   uuid,
  title                text not null check (char_length(title) between 1 and 120),
  body                 text not null check (char_length(body) between 20 and 20000),
  category             text not null check (category in ('story', 'poem', 'reflection', 'article', 'scene')),
  display_name         text not null check (char_length(display_name) between 1 and 60),
  name_mode            text not null check (name_mode in ('first_name', 'full_name', 'pen_name')),
  age_group            text not null check (age_group in ('under_12', '12_plus')),
  age_band             text check (age_band in ('6-9', '10-12', '13-17', '18-20')),
  status               text not null default 'pending_guardian'
                         check (status in ('pending_guardian', 'pending_review', 'published', 'hidden', 'rejected', 'removed')),
  allow_indexing       boolean not null default false,
  comments_enabled     boolean not null default true,
  guardian_approved_at timestamptz,
  guardian_approved_by uuid references public.user_profiles (id) on delete set null,
  reviewed_at          timestamptz,
  reviewed_by          uuid references public.user_profiles (id) on delete set null,
  consent_version      text not null,
  consent_at           timestamptz not null default now(),
  published_at         timestamptz,
  removed_at           timestamptz,
  removed_by           uuid references public.user_profiles (id) on delete set null,
  removal_reason       text,
  share_card_url       text,
  challenge_id         uuid references public.aqlam_challenges (id) on delete set null,
  featured_at          timestamptz,
  reaction_count       integer not null default 0 check (reaction_count >= 0),
  comment_count        integer not null default 0 check (comment_count >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- أقل من ١٢ مايظهرش في جوجل أبدًا.
  check (not allow_indexing or age_group = '12_plus'),
  check (status <> 'published' or published_at is not null)
);

create table if not exists public.aqlam_reactions (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.aqlam_posts (id) on delete cascade,
  user_id     uuid not null references public.user_profiles (id) on delete cascade,
  kind        text not null check (kind in ('heart', 'star', 'spark')),
  created_at  timestamptz not null default now(),
  unique (post_id, user_id, kind)
);

create table if not exists public.aqlam_comments (
  id                   uuid primary key default gen_random_uuid(),
  post_id              uuid not null references public.aqlam_posts (id) on delete cascade,
  author_id            uuid not null references public.user_profiles (id) on delete cascade,
  author_display_name  text not null check (char_length(author_display_name) between 1 and 60),
  body                 text not null check (char_length(body) between 1 and 500),
  status               text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  is_instructor        boolean not null default false,
  created_at           timestamptz not null default now()
);

create table if not exists public.aqlam_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.user_profiles (id) on delete cascade,
  target_type  text not null check (target_type in ('post', 'comment')),
  target_id    uuid not null,
  reason       text not null check (reason in ('contact_info', 'inappropriate', 'bullying', 'copied', 'other')),
  details      text check (details is null or char_length(details) <= 500),
  status       text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by   uuid references public.user_profiles (id) on delete set null,
  handled_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- قفل ولي الأمر لكل طفل. الصف الغايب = مفتوح.
create table if not exists public.aqlam_guardian_settings (
  child_id            text primary key references public.child_profiles (id) on delete cascade,
  guardian_id         uuid not null references public.user_profiles (id) on delete cascade,
  publishing_allowed  boolean not null default true,
  comments_allowed    boolean not null default true,
  updated_at          timestamptz not null default now()
);

create table if not exists public.aqlam_sanctions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_profiles (id) on delete cascade,
  kind        text not null check (kind in ('warning', 'suspension_7d', 'permanent')),
  reason      text not null check (char_length(reason) between 1 and 500),
  created_by  uuid references public.user_profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);


-- ── ٣) الفهارس ──────────────────────────────────────────────────────────────
-- القائمة بترتيب الأحدث، وبفلتر الفئة والتصنيف، وبترتيب الملصقات.
create index if not exists aqlam_posts_status_published_idx
  on public.aqlam_posts (status, published_at desc);
create index if not exists aqlam_posts_filter_idx
  on public.aqlam_posts (status, age_band, category, published_at desc);
create index if not exists aqlam_posts_status_reactions_idx
  on public.aqlam_posts (status, reaction_count desc);
create index if not exists aqlam_posts_writer_idx
  on public.aqlam_posts (writer_id, created_at desc);
create index if not exists aqlam_posts_challenge_idx
  on public.aqlam_posts (challenge_id) where challenge_id is not null;
create index if not exists aqlam_reactions_user_idx
  on public.aqlam_reactions (user_id, created_at desc);
create index if not exists aqlam_comments_post_idx
  on public.aqlam_comments (post_id, created_at) where status = 'visible';
create index if not exists aqlam_comments_author_idx
  on public.aqlam_comments (author_id, created_at desc);
create index if not exists aqlam_reports_status_idx
  on public.aqlam_reports (status, created_at);
create index if not exists aqlam_reports_target_idx
  on public.aqlam_reports (target_type, target_id);
create index if not exists aqlam_sanctions_user_idx
  on public.aqlam_sanctions (user_id, created_at desc);
create index if not exists aqlam_guardian_settings_guardian_idx
  on public.aqlam_guardian_settings (guardian_id);
create index if not exists aqlam_challenges_active_idx
  on public.aqlam_challenges (is_active, starts_at desc);


-- ── ٤) مُشغّلات ─────────────────────────────────────────────────────────────

create or replace function public.aqlam_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists aqlam_posts_touch on public.aqlam_posts;
create trigger aqlam_posts_touch before update on public.aqlam_posts
  for each row execute function public.aqlam_touch_updated_at();

drop trigger if exists aqlam_writer_profiles_touch on public.aqlam_writer_profiles;
create trigger aqlam_writer_profiles_touch before update on public.aqlam_writer_profiles
  for each row execute function public.aqlam_touch_updated_at();

-- تاريخ الميلاد **مرة واحدة**: بعد ما يتسجّل مايتغيّرش (غير بتدخّل الإدارة
-- من لوحة قاعدة البيانات). بيمنع تعديله بعد النشر للتحايل على الفئة.
create or replace function public.aqlam_writer_birth_once()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.birth_date is not null and new.birth_date is distinct from old.birth_date then
    raise exception 'aqlam: تاريخ الميلاد اتسجّل مرة وماينفعش يتغيّر' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists aqlam_writer_birth_once_trg on public.aqlam_writer_profiles;
create trigger aqlam_writer_birth_once_trg before update on public.aqlam_writer_profiles
  for each row execute function public.aqlam_writer_birth_once();


-- ── ٥) RLS والصلاحيات ───────────────────────────────────────────────────────
-- ⚠️ `ensure_rls` بيفعّل RLS تلقائيًا على أي جدول جديد، بس بنكتبها صراحة.
-- ⚠️ الصلاحيات الافتراضية في المشروع بتدّي `anon` و`authenticated` كل حاجة
--    على أي جدول جديد — فبنسحبها وبنرجّع بس اللي محتاجينه. السياسات هي
--    اللي بتحدد الصفوف.

alter table public.aqlam_challenges        enable row level security;
alter table public.aqlam_writer_profiles   enable row level security;
alter table public.aqlam_posts             enable row level security;
alter table public.aqlam_reactions         enable row level security;
alter table public.aqlam_comments          enable row level security;
alter table public.aqlam_reports           enable row level security;
alter table public.aqlam_guardian_settings enable row level security;
alter table public.aqlam_sanctions         enable row level security;

revoke all on public.aqlam_challenges, public.aqlam_writer_profiles, public.aqlam_posts,
              public.aqlam_reactions, public.aqlam_comments, public.aqlam_reports,
              public.aqlam_guardian_settings, public.aqlam_sanctions
  from anon, authenticated;

grant select on public.aqlam_challenges, public.aqlam_writer_profiles, public.aqlam_posts,
                public.aqlam_reactions, public.aqlam_comments, public.aqlam_reports,
                public.aqlam_sanctions
  to authenticated;
-- ولي الأمر بيقرا ويكتب قفله بنفسه.
grant select, insert, update on public.aqlam_guardian_settings to authenticated;
-- التحدّيات: الإدارة بتكتب مباشرة، والكل بيقرا النشطة منها.
grant insert, update, delete on public.aqlam_challenges to authenticated;
grant select on public.aqlam_challenges to anon;

-- التحدّيات
drop policy if exists "Anyone reads active challenges" on public.aqlam_challenges;
create policy "Anyone reads active challenges" on public.aqlam_challenges
  for select to anon, authenticated using (is_active and public.aqlam_mode() <> 'off');
drop policy if exists "Admins manage challenges" on public.aqlam_challenges;
create policy "Admins manage challenges" on public.aqlam_challenges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- بيانات الكاتب: صاحبها والإدارة بس. الكتابة من الدوال.
drop policy if exists "Writers read their own profile" on public.aqlam_writer_profiles;
create policy "Writers read their own profile" on public.aqlam_writer_profiles
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admins read writer profiles" on public.aqlam_writer_profiles;
create policy "Admins read writer profiles" on public.aqlam_writer_profiles
  for select to authenticated using (public.is_admin());

-- النصوص: صاحبها، وولي أمره، والإدارة. القراءة العامة من الـview تحت.
drop policy if exists "Writers read their own posts" on public.aqlam_posts;
create policy "Writers read their own posts" on public.aqlam_posts
  for select to authenticated using (writer_id = auth.uid());
drop policy if exists "Guardians read their children posts" on public.aqlam_posts;
create policy "Guardians read their children posts" on public.aqlam_posts
  for select to authenticated using (public.guardian_of_student(writer_id::text));
drop policy if exists "Admins read all posts" on public.aqlam_posts;
create policy "Admins read all posts" on public.aqlam_posts
  for select to authenticated using (public.is_admin());

-- الملصقات: بتاعتك بس (عشان تعرف إيه اللي ضغطته)، والإدارة.
drop policy if exists "Users read their own reactions" on public.aqlam_reactions;
create policy "Users read their own reactions" on public.aqlam_reactions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admins read reactions" on public.aqlam_reactions;
create policy "Admins read reactions" on public.aqlam_reactions
  for select to authenticated using (public.is_admin());

-- التعليقات: صاحبها، وصاحب النص (الكاتب وولي أمره)، والإدارة.
drop policy if exists "Authors read their own comments" on public.aqlam_comments;
create policy "Authors read their own comments" on public.aqlam_comments
  for select to authenticated using (author_id = auth.uid());
drop policy if exists "Post owners read comments on their posts" on public.aqlam_comments;
create policy "Post owners read comments on their posts" on public.aqlam_comments
  for select to authenticated using (
    exists (select 1 from public.aqlam_posts p
             where p.id = post_id
               and (p.writer_id = auth.uid() or public.guardian_of_student(p.writer_id::text)))
  );
drop policy if exists "Admins read comments" on public.aqlam_comments;
create policy "Admins read comments" on public.aqlam_comments
  for select to authenticated using (public.is_admin());

-- البلاغات: بلاغك أنت، والإدارة.
drop policy if exists "Reporters read their own reports" on public.aqlam_reports;
create policy "Reporters read their own reports" on public.aqlam_reports
  for select to authenticated using (reporter_id = auth.uid());
drop policy if exists "Admins read reports" on public.aqlam_reports;
create policy "Admins read reports" on public.aqlam_reports
  for select to authenticated using (public.is_admin());

-- قفل ولي الأمر: بيديره ولي أمر الطفل ده بس.
drop policy if exists "Guardians read their children settings" on public.aqlam_guardian_settings;
create policy "Guardians read their children settings" on public.aqlam_guardian_settings
  for select to authenticated using (guardian_id = auth.uid() or public.is_admin());
drop policy if exists "Guardians create their children settings" on public.aqlam_guardian_settings;
create policy "Guardians create their children settings" on public.aqlam_guardian_settings
  for insert to authenticated with check (
    guardian_id = auth.uid()
    and exists (select 1 from public.child_profiles c
                 where c.id = child_id and c.user_profile_id = auth.uid())
  );
drop policy if exists "Guardians update their children settings" on public.aqlam_guardian_settings;
create policy "Guardians update their children settings" on public.aqlam_guardian_settings
  for update to authenticated
  using (guardian_id = auth.uid()
         and exists (select 1 from public.child_profiles c
                      where c.id = child_id and c.user_profile_id = auth.uid()))
  with check (guardian_id = auth.uid()
         and exists (select 1 from public.child_profiles c
                      where c.id = child_id and c.user_profile_id = auth.uid()));

-- العقوبات: صاحب الحساب يشوف عقوباته، والإدارة.
drop policy if exists "Users read their own sanctions" on public.aqlam_sanctions;
create policy "Users read their own sanctions" on public.aqlam_sanctions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admins read sanctions" on public.aqlam_sanctions;
create policy "Admins read sanctions" on public.aqlam_sanctions
  for select to authenticated using (public.is_admin());


-- ── ٦) القراءة العامة ───────────────────────────────────────────────────────
-- views بتشتغل بصلاحية صاحبها (عن قصد) عشان الزائر المجهول يقرا المنشور
-- بس، **من غير `writer_id` ولا أي بيانات حساب**. ومقفولة لما التشغيل مقفول.
-- ⚠️ ده عن قصد "security definer view": الحارس هو شرط `status = 'published'`
--    وقائمة الأعمدة هنا. أي عمود جديد لازم يتراجع إن كان آمن للعلن.

create or replace view public.aqlam_public_posts
with (security_invoker = false) as
select p.id,
       p.title,
       p.body,
       p.category,
       p.display_name,
       p.age_band,
       p.age_group,
       p.allow_indexing,
       p.comments_enabled,
       p.share_card_url,
       p.challenge_id,
       p.featured_at,
       p.reaction_count,
       p.comment_count,
       p.published_at
  from public.aqlam_posts p
 where p.status = 'published'
   and public.aqlam_mode() <> 'off';

create or replace view public.aqlam_public_comments
with (security_invoker = false) as
select c.id,
       c.post_id,
       c.author_display_name,
       c.is_instructor,
       c.body,
       c.created_at
  from public.aqlam_comments c
  join public.aqlam_posts p on p.id = c.post_id
 where c.status = 'visible'
   and p.status = 'published'
   and public.aqlam_mode() <> 'off';

revoke all on public.aqlam_public_posts, public.aqlam_public_comments from anon, authenticated;
grant select on public.aqlam_public_posts, public.aqlam_public_comments to anon, authenticated;


-- ── ٧) الدوال اللي بتكتب ────────────────────────────────────────────────────
-- كلها بترجّع jsonb: { ok: true, ... } أو { ok: false, error: '<كود>' }.
-- الكود (مش جملة عربي) عشان الواجهة تترجمه وتختار رسالتها.

-- نشر نص. أقل من ١٢ ← بانتظار ولي الأمر. ١٢+ ← ظاهر فورًا.
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
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if public.aqlam_is_suspended(v_uid) then return jsonb_build_object('ok', false, 'error', 'suspended'); end if;

  if char_length(v_title) not between 1 and 120
     or char_length(v_body) not between 20 and 20000
     or p_category not in ('story', 'poem', 'reflection', 'article', 'scene')
     or p_name_mode not in ('first_name', 'full_name', 'pen_name')
     or nullif(btrim(coalesce(p_consent_version, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if public.aqlam_contains_contact(v_title) or public.aqlam_contains_contact(v_body)
     or public.aqlam_contains_contact(v_pen) then
    return jsonb_build_object('ok', false, 'error', 'contact_info');
  end if;

  if (select count(*) from aqlam_posts
       where writer_id = v_uid and created_at > now() - interval '24 hours') >= 3 then
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
    if v_pen is null or char_length(v_pen) not between 2 and 40 then
      return jsonb_build_object('ok', false, 'error', 'invalid_name');
    end if;
    v_display := v_pen;
  end if;
  if char_length(coalesce(v_display, '')) not between 1 and 60 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;

  v_status := case when v_group = 'under_12' then 'pending_guardian' else 'published' end;

  insert into aqlam_posts (
    writer_id, source_document_id, title, body, category, display_name, name_mode,
    age_group, age_band, status, allow_indexing, comments_enabled,
    consent_version, published_at
  ) values (
    v_uid, p_source_document_id, v_title, v_body, p_category, v_display, p_name_mode,
    v_group, public.aqlam_age_band(v_age), v_status,
    (v_group = '12_plus' and coalesce(p_allow_indexing, false)),
    coalesce(p_comments_enabled, true),
    btrim(p_consent_version),
    case when v_status = 'published' then now() end
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status, 'age_group', v_group);
end;
$$;

-- «شيل»: الكاتب يشيل نصه (نسخة مستقلة). الإدارة تشيل من دالة المراجعة.
create or replace function public.aqlam_remove_own_post(p_post uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  n integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
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

-- قرار ولي الأمر على نص ابنه (أقل من ١٢).
create or replace function public.aqlam_guardian_decide(p_post uuid, p_approve boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_writer uuid;
  n integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  select writer_id into v_writer from aqlam_posts where id = p_post;
  if v_writer is null or not public.guardian_of_student(v_writer::text) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  update aqlam_posts
     set status = case when p_approve then 'pending_review' else 'rejected' end,
         guardian_approved_at = case when p_approve then now() end,
         guardian_approved_by = case when p_approve then v_uid end,
         reviewed_at = case when p_approve then reviewed_at else now() end,
         reviewed_by = case when p_approve then reviewed_by else v_uid end
   where id = p_post and status = 'pending_guardian';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;
  return jsonb_build_object('ok', true, 'status', case when p_approve then 'pending_review' else 'rejected' end);
end;
$$;

-- مراجعة الإدارة على نص: approve | reject | hide | restore | remove | feature | unfeature
create or replace function public.aqlam_moderate_post(p_post uuid, p_action text, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  n integer;
begin
  if v_uid is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_action = 'approve' then
    update aqlam_posts set status = 'published', published_at = coalesce(published_at, now()),
           reviewed_at = now(), reviewed_by = v_uid
     where id = p_post and status = 'pending_review';
  elsif p_action = 'reject' then
    update aqlam_posts set status = 'rejected', reviewed_at = now(), reviewed_by = v_uid,
           removal_reason = nullif(btrim(coalesce(p_reason, '')), '')
     where id = p_post and status in ('pending_review', 'pending_guardian');
  elsif p_action = 'hide' then
    update aqlam_posts set status = 'hidden', reviewed_at = now(), reviewed_by = v_uid,
           removal_reason = nullif(btrim(coalesce(p_reason, '')), '')
     where id = p_post and status = 'published';
  elsif p_action = 'restore' then
    update aqlam_posts set status = 'published', reviewed_at = now(), reviewed_by = v_uid
     where id = p_post and status = 'hidden';
  elsif p_action = 'remove' then
    update aqlam_posts set status = 'removed', removed_at = now(), removed_by = v_uid,
           removal_reason = nullif(btrim(coalesce(p_reason, '')), '')
     where id = p_post and status <> 'removed';
  elsif p_action = 'feature' then
    update aqlam_posts set featured_at = now() where id = p_post and status = 'published';
  elsif p_action = 'unfeature' then
    update aqlam_posts set featured_at = null where id = p_post;
  else
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  -- إخفاء أو شيل = البلاغات المفتوحة على النص اتعالجت. واسترجاع = الإدارة
  -- راجعت وقررت إنه سليم، فالبلاغات القديمة اتقفلت (وإلا بلاغ واحد جديد
  -- كان هيكمّل التلاتة ويخفيه تاني فورًا).
  if p_action in ('hide', 'remove', 'reject') then
    update aqlam_reports set status = 'actioned', handled_by = v_uid, handled_at = now()
     where target_type = 'post' and target_id = p_post and status = 'open';
  elsif p_action = 'restore' then
    update aqlam_reports set status = 'dismissed', handled_by = v_uid, handled_at = now()
     where target_type = 'post' and target_id = p_post and status = 'open';
  end if;
  return jsonb_build_object('ok', true);
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
    if (select count(*) from aqlam_reactions
         where user_id = v_uid and created_at > now() - interval '24 hours') >= 200 then
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
  v_commenter   record;
  v_is_instr    boolean;
  v_is_admin    boolean;
  v_name        text;
  v_id          uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if public.aqlam_is_suspended(v_uid) then return jsonb_build_object('ok', false, 'error', 'suspended'); end if;
  if char_length(v_body) not between 1 and 500 then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if public.aqlam_contains_contact(v_body) then return jsonb_build_object('ok', false, 'error', 'contact_info'); end if;

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
       where author_id = v_uid and created_at > now() - interval '24 hours') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  -- الاسم: المدرب باسمه المعروض، والباقي الاسم الأول.
  if v_is_instr then
    select display_name into v_name from instructors where user_id = v_uid and status = 'active' limit 1;
  else
    select coalesce(
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

-- بلاغ على نص أو تعليق. ٣ حسابات مختلفة = إخفاء تلقائي لحد المراجعة.
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
  n         integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if p_target_type not in ('post', 'comment')
     or p_reason not in ('contact_info', 'inappropriate', 'bullying', 'copied', 'other')
     or char_length(coalesce(p_details, '')) > 500 then
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
       where reporter_id = v_uid and created_at > now() - interval '24 hours') >= 10 then
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

  if v_open >= 3 then
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
  end if;

  return jsonb_build_object('ok', true, 'auto_hidden', v_hidden);
end;
$$;

-- مراجعة الإدارة على تعليق: hide | restore | remove
create or replace function public.aqlam_moderate_comment(p_comment uuid, p_action text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_post uuid;
begin
  if v_uid is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_action not in ('hide', 'restore', 'remove') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  update aqlam_comments
     set status = case p_action when 'hide' then 'hidden' when 'restore' then 'visible' else 'removed' end
   where id = p_comment
  returning post_id into v_post;
  if v_post is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  update aqlam_posts
     set comment_count = (select count(*) from aqlam_comments where post_id = v_post and status = 'visible')
   where id = v_post;

  if p_action in ('hide', 'remove') then
    update aqlam_reports set status = 'actioned', handled_by = v_uid, handled_at = now()
     where target_type = 'comment' and target_id = p_comment and status = 'open';
  elsif p_action = 'restore' then
    update aqlam_reports set status = 'dismissed', handled_by = v_uid, handled_at = now()
     where target_type = 'comment' and target_id = p_comment and status = 'open';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- إغلاق بلاغ: actioned | dismissed
create or replace function public.aqlam_handle_report(p_report uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  n integer;
begin
  if v_uid is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_status not in ('actioned', 'dismissed') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  update aqlam_reports set status = p_status, handled_by = v_uid, handled_at = now()
   where id = p_report and status = 'open';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- عقوبة: warning | suspension_7d | permanent
create or replace function public.aqlam_sanction_user(p_user uuid, p_kind text, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_kind not in ('warning', 'suspension_7d', 'permanent')
     or char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500
     or not exists (select 1 from user_profiles where id = p_user) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  insert into aqlam_sanctions (user_id, kind, reason, created_by, expires_at)
  values (p_user, p_kind, btrim(p_reason), v_uid,
          case p_kind when 'suspension_7d' then now() + interval '7 days' end)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ولي الأمر يضبط قفل ابنه.
create or replace function public.aqlam_set_guardian_settings(
  p_child               text,
  p_publishing_allowed  boolean,
  p_comments_allowed    boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not exists (select 1 from child_profiles where id = p_child and user_profile_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  insert into aqlam_guardian_settings (child_id, guardian_id, publishing_allowed, comments_allowed)
  values (p_child, v_uid, coalesce(p_publishing_allowed, true), coalesce(p_comments_allowed, true))
  on conflict (child_id) do update
    set publishing_allowed = excluded.publishing_allowed,
        comments_allowed   = excluded.comments_allowed,
        updated_at         = now();
  return jsonb_build_object('ok', true);
end;
$$;


-- ── ٨) صلاحيات تنفيذ الدوال ─────────────────────────────────────────────────
-- الصلاحية الافتراضية في المشروع بتدّي `anon` و`authenticated` تنفيذ أي دالة
-- جديدة. بنسحبها ونرجّع بس اللي الواجهة بتناديه. الدوال المساعدة بتتنفذ من
-- جوّه الدوال دي (بصلاحية صاحبها) ومحتاجاش صلاحية مباشرة.

revoke all on function
  public.aqlam_enabled_for(uuid), public.aqlam_today(),
  public.aqlam_age_on(date, date), public.aqlam_age_of(uuid),
  public.aqlam_is_child_account(uuid), public.aqlam_age_band(integer),
  public.aqlam_is_suspended(uuid), public.aqlam_contains_contact(text),
  public.aqlam_touch_updated_at(), public.aqlam_writer_birth_once()
  from public, anon, authenticated;

revoke all on function
  public.aqlam_publish_post(text, text, text, text, text, boolean, boolean, uuid, date, text),
  public.aqlam_remove_own_post(uuid), public.aqlam_guardian_decide(uuid, boolean),
  public.aqlam_moderate_post(uuid, text, text), public.aqlam_set_reaction(uuid, text, boolean),
  public.aqlam_add_comment(uuid, text), public.aqlam_report(text, uuid, text, text),
  public.aqlam_moderate_comment(uuid, text), public.aqlam_handle_report(uuid, text),
  public.aqlam_sanction_user(uuid, text, text),
  public.aqlam_set_guardian_settings(text, boolean, boolean)
  from public, anon, authenticated;

grant execute on function
  public.aqlam_publish_post(text, text, text, text, text, boolean, boolean, uuid, date, text),
  public.aqlam_remove_own_post(uuid), public.aqlam_guardian_decide(uuid, boolean),
  public.aqlam_moderate_post(uuid, text, text), public.aqlam_set_reaction(uuid, text, boolean),
  public.aqlam_add_comment(uuid, text), public.aqlam_report(text, uuid, text, text),
  public.aqlam_moderate_comment(uuid, text), public.aqlam_handle_report(uuid, text),
  public.aqlam_sanction_user(uuid, text, text),
  public.aqlam_set_guardian_settings(text, boolean, boolean)
  to authenticated;

-- `aqlam_mode()` متاحة للزائر والمستخدم: سياسة التحدّيات بتناديها بصلاحية
-- اللي بيقرا. (الـviews بتناديها بصلاحية صاحبها ومحتاجاش.)
grant execute on function public.aqlam_mode() to anon, authenticated;
