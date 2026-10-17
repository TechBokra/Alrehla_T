-- أقلام الرحلة — قرارات السياسة (٣ حاجات):
--
--   ١) حد البلاغات للإخفاء التلقائي: ٥ حسابات مختلفة (كان ٣).
--   ٢) النص المحذوف («مشال») بيتمسح نهائيًا بعد ٧ أيام: النص نفسه، وتعليقاته
--      وتشجيعاته ونسخ تعديله، وبلاغاته. المسح بيتم بمهمة يومية بتنادي
--      `aqlam_purge_removed()`. سجل العقوبات مابيتمسحش.
--   ٣) قفل التعليقات لابن بيتم بطلب من ولي الأمر **للإدارة مع سبب**، والإدارة
--      توافق أو ترفض (بملاحظة). فتح التعليقات تاني بيفضل فوري لولي الأمر.
--      قفل النشر مابيتغيّرش.
--
-- إضافة بس (جداول جديدة + create or replace). مفيش بيانات بتتغيّر غير إن
-- التعليقات المشالة قبل كده بتاخد مهلة ٧ أيام من تاريخ تشغيل الملف ده.
-- بتتشغّل بعد `20261017120000_aqlam_public_views_anon_fix.sql`.


-- ── ١) حد البلاغات = ٥ ──────────────────────────────────────────────────────
create or replace function public.aqlam_report(
  p_target_type text,
  p_target_id   uuid,
  p_reason      text,
  p_details     text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_threshold constant integer := 5;   -- حسابات مختلفة = إخفاء تلقائي
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

  if v_open >= c_threshold then
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
      'نص أو تعليق اتخبّى بعد ' || c_threshold || ' بلاغات. راجعه.', '/dashboard/admin/aqlam');
  end if;

  return jsonb_build_object('ok', true, 'auto_hidden', v_hidden);
end;
$$;

revoke all on function public.aqlam_report(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.aqlam_report(text, uuid, text, text) to authenticated;


-- ── ٢) مسح المشال بعد ٧ أيام ────────────────────────────────────────────────
-- التعليق ماكانش بيسجّل وقت الشيل، فبنضيف العمود ومُشغّل بيملاه.
alter table public.aqlam_comments add column if not exists removed_at timestamptz;

create or replace function public.aqlam_comment_removed_at()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'removed' and (tg_op = 'INSERT' or old.status is distinct from 'removed') then
    new.removed_at := coalesce(new.removed_at, now());
  elsif new.status <> 'removed' then
    new.removed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists aqlam_comments_removed_at on public.aqlam_comments;
create trigger aqlam_comments_removed_at
  before insert or update of status on public.aqlam_comments
  for each row execute function public.aqlam_comment_removed_at();

-- اللي اتشال قبل كده ياخد ٧ أيام من النهارده.
update public.aqlam_comments set removed_at = now() where status = 'removed' and removed_at is null;

create index if not exists aqlam_posts_removed_idx
  on public.aqlam_posts (removed_at) where status = 'removed';
create index if not exists aqlam_comments_removed_idx
  on public.aqlam_comments (removed_at) where status = 'removed';

-- بيمسح نهائيًا اللي عدّى عليه `p_days` يوم من الشيل. بتتنادى من المهمة اليومية
-- بس (service role) — مش من أي مستخدم.
create or replace function public.aqlam_purge_removed(p_days integer default 7)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cut      timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 7), 1));
  v_post_ids uuid[];
  v_posts    integer := 0;
  v_comments integer := 0;
  v_reports  integer := 0;
  n          integer;
begin
  -- نصوص: بلاغاتها وبلاغات تعليقاتها الأول (البلاغ مالوش FK على الهدف)، وبعدين
  -- النص نفسه (التعليقات والتشجيعات ونسخ التعديل بتتمسح معاه بالـ cascade).
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

  -- تعليقات اتشالت لوحدها (النص نفسه لسه ظاهر).
  delete from aqlam_reports
   where target_type = 'comment'
     and target_id in (select id from aqlam_comments where status = 'removed' and removed_at < v_cut);
  get diagnostics n = row_count; v_reports := v_reports + n;

  delete from aqlam_comments where status = 'removed' and removed_at < v_cut;
  get diagnostics v_comments = row_count;

  return jsonb_build_object('ok', true, 'posts', v_posts, 'comments', v_comments, 'reports', v_reports);
end;
$$;

revoke all on function public.aqlam_purge_removed(integer) from public, anon, authenticated;
revoke all on function public.aqlam_comment_removed_at() from public, anon, authenticated;


-- ── ٣) ولي الأمر يطلب قفل التعليقات من الإدارة ──────────────────────────────
create table if not exists public.aqlam_guardian_requests (
  id          uuid primary key default gen_random_uuid(),
  child_id    text not null references public.child_profiles (id) on delete cascade,
  -- اسم الابن وقت الطلب: الإدارة مش بتقرا `child_profiles`، فبنحفظه هنا للعرض.
  child_name  text not null default '',
  guardian_id uuid not null references public.user_profiles (id) on delete cascade,
  kind        text not null default 'close_comments' check (kind in ('close_comments')),
  reason      text not null check (char_length(reason) between 10 and 500),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note  text check (admin_note is null or char_length(admin_note) <= 500),
  decided_by  uuid references public.user_profiles (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- طلب واحد مفتوح لكل ابن.
create unique index if not exists aqlam_guardian_requests_one_pending_idx
  on public.aqlam_guardian_requests (child_id, kind) where status = 'pending';
create index if not exists aqlam_guardian_requests_guardian_idx
  on public.aqlam_guardian_requests (guardian_id, created_at desc);
create index if not exists aqlam_guardian_requests_status_idx
  on public.aqlam_guardian_requests (status, created_at);

alter table public.aqlam_guardian_requests enable row level security;
revoke all on public.aqlam_guardian_requests from anon, authenticated;
grant select on public.aqlam_guardian_requests to authenticated;
drop policy if exists "Guardians read their requests" on public.aqlam_guardian_requests;
create policy "Guardians read their requests" on public.aqlam_guardian_requests
  for select to authenticated using (guardian_id = auth.uid() or public.is_admin());

-- طلب قفل التعليقات.
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

  if v_reason is null or char_length(v_reason) not between 10 and 500 then
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
       where child_id = p_child and created_at > now() - interval '24 hours') >= 3 then
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

-- ولي الأمر يسحب طلبه قبل ما الإدارة تقرر.
create or replace function public.aqlam_cancel_guardian_request(p_request uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  n integer;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  update aqlam_guardian_requests set status = 'cancelled', decided_at = now()
   where id = p_request and guardian_id = v_uid and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- قرار الإدارة: موافقة (القفل بيتطبّق) أو رفض (الملاحظة إجبارية، وولي الأمر بيتبلّغ بيها).
create or replace function public.aqlam_decide_guardian_request(p_request uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_req  record;
  v_name text;
begin
  if v_uid is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if not coalesce(p_approve, false) and v_note is null then
    return jsonb_build_object('ok', false, 'error', 'note_required');
  end if;

  select * into v_req from aqlam_guardian_requests where id = p_request for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_req.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;

  select full_name into v_name from child_profiles where id = v_req.child_id;

  if coalesce(p_approve, false) then
    insert into aqlam_guardian_settings (child_id, guardian_id, publishing_allowed, comments_allowed)
    values (v_req.child_id, v_req.guardian_id, true, false)
    on conflict (child_id) do update set comments_allowed = false, updated_at = now();
  end if;

  update aqlam_guardian_requests
     set status = case when coalesce(p_approve, false) then 'approved' else 'rejected' end,
         admin_note = v_note, decided_by = v_uid, decided_at = now()
   where id = p_request;

  perform public.aqlam_notify(v_req.guardian_id::text,
    case when coalesce(p_approve, false) then 'اتقفلت التعليقات لـ ' || coalesce(v_name, 'ابنك')
         else 'طلب قفل التعليقات اترفض' end,
    coalesce(v_note, case when coalesce(p_approve, false) then 'الإدارة وافقت على طلبك.' else null end),
    '/account/family/aqlam');
  return jsonb_build_object('ok', true);
end;
$$;

-- قفل التعليقات مابقاش بيتم مباشرة: بطلب للإدارة. فتحها تاني فوري، وقفل النشر زي ما هو.
create or replace function public.aqlam_set_guardian_settings(
  p_child               text,
  p_publishing_allowed  boolean,
  p_comments_allowed    boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_comments_open boolean;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  if not exists (select 1 from child_profiles where id = p_child and user_profile_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select comments_allowed into v_comments_open from aqlam_guardian_settings where child_id = p_child;
  v_comments_open := coalesce(v_comments_open, true);
  if v_comments_open and not coalesce(p_comments_allowed, true) then
    return jsonb_build_object('ok', false, 'error', 'needs_admin_request');
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

revoke all on function
  public.aqlam_request_comments_lock(text, text),
  public.aqlam_cancel_guardian_request(uuid),
  public.aqlam_decide_guardian_request(uuid, boolean, text),
  public.aqlam_set_guardian_settings(text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function
  public.aqlam_request_comments_lock(text, text),
  public.aqlam_cancel_guardian_request(uuid),
  public.aqlam_decide_guardian_request(uuid, boolean, text),
  public.aqlam_set_guardian_settings(text, boolean, boolean)
  to authenticated;

-- إغلاق الباب الخلفي: ولي الأمر كان بيقدر يكتب في جدول الإعدادات مباشرة
-- (بيتخطى الطلب للإدارة). الكتابة بقت من الدوال بس؛ والقراءة زي ما هي.
revoke insert, update, delete on public.aqlam_guardian_settings from anon, authenticated;
grant select on public.aqlam_guardian_settings to authenticated;
drop policy if exists "Guardians create their children settings" on public.aqlam_guardian_settings;
drop policy if exists "Guardians update their children settings" on public.aqlam_guardian_settings;
