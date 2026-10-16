-- أقلام الرحلة — الدفعة التانية: ملفي، تعديل النص، صفحة الكاتب الاختيارية،
-- وأدوات أسهل للإدارة (بحث بالاسم/الإيميل + رفع العقوبة).
--
-- إضافة بس: مفيش جدول ولا دالة موجودة بتتمسح. بتتشغّل بعد
-- `20261015200000_aqlam_foundation.sql`، وتتشغّل أكتر من مرة من غير ضرر.

-- ── ١) أعمدة جديدة ──────────────────────────────────────────────────────────

alter table public.aqlam_posts      add column if not exists edited_at timestamptz;
alter table public.aqlam_sanctions  add column if not exists lifted_at timestamptz;
alter table public.aqlam_sanctions  add column if not exists lifted_by uuid
  references public.user_profiles (id) on delete set null;

-- صفحة الكاتب العامة: اختيارية، مقفولة افتراضيًا. الرابط عشوائي (مش UUID الحساب).
alter table public.aqlam_writer_profiles add column if not exists public_profile boolean not null default false;
alter table public.aqlam_writer_profiles add column if not exists public_slug text;
create unique index if not exists aqlam_writer_profiles_slug_idx
  on public.aqlam_writer_profiles (public_slug) where public_slug is not null;

-- نسخ النصوص القديمة قبل كل تعديل: ليها استعمالين — حد التعديل اليومي،
-- ودليل للإدارة لو حد بدّل نص سليم بنص مخالف.
create table if not exists public.aqlam_post_edits (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.aqlam_posts (id) on delete cascade,
  writer_id   uuid not null references public.user_profiles (id) on delete cascade,
  old_title   text not null,
  old_body    text not null,
  created_at  timestamptz not null default now()
);
create index if not exists aqlam_post_edits_writer_idx on public.aqlam_post_edits (writer_id, created_at desc);
create index if not exists aqlam_post_edits_post_idx   on public.aqlam_post_edits (post_id, created_at desc);

alter table public.aqlam_post_edits enable row level security;
revoke all on public.aqlam_post_edits from anon, authenticated;
grant select on public.aqlam_post_edits to authenticated;
drop policy if exists "Admins read post edits" on public.aqlam_post_edits;
create policy "Admins read post edits" on public.aqlam_post_edits
  for select to authenticated using (public.is_admin());


-- ── ٢) العقوبة المرفوعة ما بتوقّفش حد ───────────────────────────────────────

create or replace function public.aqlam_is_suspended(p_user uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from aqlam_sanctions
     where user_id = p_user
       and lifted_at is null
       and kind in ('suspension_7d', 'permanent')
       and (expires_at is null or expires_at > now())
  );
end;
$$;


-- ── ٣) العرض العام: «عُدّل» + رابط صفحة الكاتب (لو اختارها) ─────────────────
-- أعمدة جديدة في الآخر بس (شرط `create or replace view`).
create or replace view public.aqlam_public_posts
with (security_invoker = false) as
select p.id,
       p.title,
       p.body,
       left(p.body, 280) as excerpt,
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
       p.published_at,
       p.edited_at,
       -- الرابط العشوائي بس، وبس لو الكاتب فعّل صفحته وهو ١٢+ وغير موقوف.
       case when p.age_group = '12_plus'
                 and w.public_profile
                 and not public.aqlam_is_suspended(p.writer_id)
            then w.public_slug end as writer_slug
  from public.aqlam_posts p
  left join public.aqlam_writer_profiles w on w.user_id = p.writer_id
 where p.status = 'published'
   and public.aqlam_mode() <> 'off';

-- صفحات الكتّاب اللي اختاروا يظهروا. من غير `user_id` ولا تاريخ ميلاد.
create or replace view public.aqlam_public_writers
with (security_invoker = false) as
select w.public_slug as slug,
       coalesce(w.pen_name,
                (select p.display_name from public.aqlam_posts p
                  where p.writer_id = w.user_id and p.status = 'published'
                  order by p.published_at desc limit 1)) as name,
       w.bio,
       public.aqlam_age_band(public.aqlam_age_of(w.user_id)) as age_band,
       (select count(*) from public.aqlam_posts p
         where p.writer_id = w.user_id and p.status = 'published'
           and p.age_group = '12_plus')::integer as posts_count
  from public.aqlam_writer_profiles w
 where w.public_profile
   and w.public_slug is not null
   and public.aqlam_age_of(w.user_id) >= 12
   and not public.aqlam_is_suspended(w.user_id)
   and public.aqlam_mode() <> 'off';

revoke all on public.aqlam_public_posts, public.aqlam_public_writers from anon, authenticated;
grant select on public.aqlam_public_posts, public.aqlam_public_writers to anon, authenticated;


-- ── ٤) تعديل نص ─────────────────────────────────────────────────────────────
-- الكاتب بس. نفس قواعد النشر (طول، فلتر بيانات التواصل). الاسم الظاهر ما
-- بيتغيّرش (لو عايز اسم تاني: شيل وانشر من جديد).
--   • منشور ١٢+            ← يفضل منشور، وبيتعلّم «عُدّل».
--   • منشور أقل من ١٢      ← يرجع لموافقة ولي الأمر (المحتوى اتغيّر).
--   • بانتظار (ولي أمر/مراجعة) ← يتعدّل مكانه من غير ما يتغيّر وضعه.
--   • مرفوض                ← يتقدّم تاني (أقل من ١٢: ولي الأمر، غيره: المراجعة).
--   • مخفي/مشال            ← ماينفعش.
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
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not public.aqlam_enabled_for(v_uid) then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if public.aqlam_is_suspended(v_uid) then return jsonb_build_object('ok', false, 'error', 'suspended'); end if;

  select * into v_post from aqlam_posts where id = p_post and writer_id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_post.status in ('hidden', 'removed') then
    return jsonb_build_object('ok', false, 'error', 'not_editable');
  end if;

  if char_length(v_title) not between 1 and 120
     or char_length(v_body) not between 20 and 20000
     or p_category not in ('story', 'poem', 'reflection', 'article', 'scene') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if public.aqlam_contains_contact(v_title) or public.aqlam_contains_contact(v_body) then
    return jsonb_build_object('ok', false, 'error', 'contact_info');
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
                     where writer_id = v_uid and created_at > now() - interval '24 hours') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  v_status := v_post.status;
  if v_changed or p_category is distinct from v_post.category then
    if v_post.status = 'published' and v_post.age_group = 'under_12' then
      v_status := 'pending_guardian';
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
         allow_indexing = (age_group = '12_plus' and coalesce(p_allow_indexing, false)),
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
      'كاتب عدّل نصًا مرفوضًا وقدّمه تاني.', '/dashboard/admin/aqlam');
  end if;

  return jsonb_build_object('ok', true, 'status', v_status, 'changed', v_changed,
                            'back_to_approval', v_status <> v_post.status);
end;
$$;


-- ── ٥) ملف الكاتب: اسم قلم، نبذة، وصفحة عامة اختيارية ───────────────────────
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

  if (v_pen is not null and char_length(v_pen) not between 2 and 40)
     or (v_bio is not null and char_length(v_bio) > 500) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if public.aqlam_contains_contact(v_pen) or public.aqlam_contains_contact(v_bio) then
    return jsonb_build_object('ok', false, 'error', 'contact_info');
  end if;

  if coalesce(p_public, false) then
    v_age := public.aqlam_age_of(v_uid);
    if v_age is null then return jsonb_build_object('ok', false, 'error', 'birthdate_required'); end if;
    if v_age < 12 then return jsonb_build_object('ok', false, 'error', 'too_young'); end if;
    -- لازم اسم يظهر: اسم قلم، أو نص منشور عنده اسم.
    if v_pen is null and not exists (
         select 1 from aqlam_posts where writer_id = v_uid and status = 'published') then
      return jsonb_build_object('ok', false, 'error', 'pen_name_required');
    end if;
  end if;

  insert into aqlam_writer_profiles (user_id, pen_name, bio, public_profile)
  values (v_uid, v_pen, v_bio, coalesce(p_public, false))
  on conflict (user_id) do update
    set pen_name = excluded.pen_name,
        bio = excluded.bio,
        public_profile = excluded.public_profile;

  -- الرابط بيتعمل مرة وبيفضل ثابت (حتى لو الصفحة اتقفلت وفتحت تاني).
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


-- ── ٦) الإدارة: رفع العقوبة، وبحث بالاسم/الإيميل ────────────────────────────
create or replace function public.aqlam_lift_sanction(p_sanction uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  n integer;
begin
  if v_uid is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  update aqlam_sanctions set lifted_at = now(), lifted_by = v_uid
   where id = p_sanction and lifted_at is null;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- بحث (اسم أو إيميل أو رقم الحساب) و/أو أسماء لقائمة أرقام. الإدارة بس —
-- الإيميل في `auth.users` والواجهة ماتقدرش تقراه بنفسها.
create or replace function public.aqlam_admin_find_users(p_query text default null, p_ids uuid[] default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_q   text := btrim(coalesce(p_query, ''));
  v_res jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_ids is not null and cardinality(p_ids) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', u.id, 'full_name', u.full_name, 'email', a.email)), '[]'::jsonb)
      into v_res
      from user_profiles u
      left join auth.users a on a.id = u.id
     where u.id = any (p_ids[1:100]);
    return jsonb_build_object('ok', true, 'users', v_res);
  end if;

  if char_length(v_q) < 2 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_res
    from (
      select jsonb_build_object('id', u.id, 'full_name', u.full_name, 'email', a.email) as x
        from user_profiles u
        left join auth.users a on a.id = u.id
       where u.id::text = v_q
          or a.email ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
          or u.full_name ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
       order by u.full_name
       limit 10
    ) s;
  return jsonb_build_object('ok', true, 'users', v_res);
end;
$$;

-- العقوبة تتبلّغ لصاحب الحساب (من غير كده الإيقاف بيبان له كأنه عطل).
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

  perform public.aqlam_notify(
    p_user::text,
    case p_kind when 'warning' then 'تنبيه من أقلام الرحلة'
                when 'suspension_7d' then 'اتوقّفت عن النشر في أقلام الرحلة ٧ أيام'
                else 'اتوقّفت عن النشر في أقلام الرحلة' end,
    btrim(p_reason),
    '/aqlam'
  );
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;


-- ── ٧) صلاحيات الدوال الجديدة ───────────────────────────────────────────────
revoke all on function
  public.aqlam_update_post(uuid, text, text, text, boolean, boolean),
  public.aqlam_set_writer_profile(text, text, boolean),
  public.aqlam_lift_sanction(uuid),
  public.aqlam_admin_find_users(text, uuid[])
  from public, anon, authenticated;

grant execute on function
  public.aqlam_update_post(uuid, text, text, text, boolean, boolean),
  public.aqlam_set_writer_profile(text, text, boolean),
  public.aqlam_lift_sanction(uuid),
  public.aqlam_admin_find_users(text, uuid[])
  to authenticated;
