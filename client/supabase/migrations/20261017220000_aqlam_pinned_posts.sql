-- أقلام الرحلة — تثبيت النصوص المميزة بترتيب.
--
--   • «المميّز» (`featured_at`) بقى «مثبّت»: يظهر في أول القائمة في شريط
--     «مختارات الرحلة» بترتيب تحدده الإدارة (`featured_rank`، ١ = الأول).
--   • الحد الأقصى ٦ نصوص مثبّتة.
--   • النص اللي مابقاش منشور (مخفي/مرفوض/مشال/رجع لموافقة) بيتشال تثبيته
--     لوحده — مايفضلش مثبّت وهو مش ظاهر.
--
-- إضافة بس (عمود + مُشغّل + دالة + create or replace view). العرض العام
-- مكتوب بنفس طريقة `20261017120000` (من غير دوال مقفولة عن الزوار).
-- بتتشغّل بعد `20261017180000_aqlam_policy_decisions.sql`.

alter table public.aqlam_posts add column if not exists featured_rank integer;

-- النص اللي يخرج من «منشور» يخرج من التثبيت.
create or replace function public.aqlam_unpin_when_unpublished()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status <> 'published' then
    new.featured_at := null;
    new.featured_rank := null;
  end if;
  return new;
end;
$$;

drop trigger if exists aqlam_posts_unpin_when_unpublished on public.aqlam_posts;
create trigger aqlam_posts_unpin_when_unpublished
  before update of status on public.aqlam_posts
  for each row execute function public.aqlam_unpin_when_unpublished();

revoke all on function public.aqlam_unpin_when_unpublished() from public, anon, authenticated;

-- ترتيب للموجود: المميّز المنشور ياخد ١، ٢، … بالأحدث تمييزًا؛ والمميّز غير
-- المنشور بيتشال تمييزه. وأكتر من ٦ بيتقص (الأحدث تمييزًا يفضل).
update public.aqlam_posts set featured_at = null, featured_rank = null
 where featured_at is not null and status <> 'published';

with ranked as (
  select id, row_number() over (order by featured_at desc, id) as rn
    from public.aqlam_posts
   where featured_at is not null and status = 'published'
)
update public.aqlam_posts p
   set featured_rank = case when r.rn <= 6 then r.rn::integer end,
       featured_at   = case when r.rn <= 6 then p.featured_at end
  from ranked r
 where p.id = r.id;

create index if not exists aqlam_posts_pinned_idx
  on public.aqlam_posts (featured_rank) where featured_at is not null;

-- إدارة التثبيت (للإدارة بس): pin | unpin | up | down.
--   pin   : نص منشور فقط، والحد ٦، وبيتحط في الآخر.
--   unpin : بيشيل التثبيت.
--   up/down: بيبدّل ترتيبه مع جاره.
create or replace function public.aqlam_set_pin(p_post uuid, p_op text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_max constant integer := 6;
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

revoke all on function public.aqlam_set_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.aqlam_set_pin(uuid, text) to authenticated;


-- العرض العام: عمود الترتيب في الآخر (شرط create or replace view). نفس منطق
-- `20261017120000` حرفيًا — المنطق جوّه العرض، ومفيش دوال مقفولة عن الزوار.
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
       case when p.age_group = '12_plus'
                 and w.public_profile
                 and w.pen_name is not null
                 and p.display_name = w.pen_name
                 and not exists (
                   select 1 from public.aqlam_sanctions s
                    where s.user_id = p.writer_id
                      and s.lifted_at is null
                      and s.kind in ('suspension_7d', 'permanent')
                      and (s.expires_at is null or s.expires_at > now()))
            then w.public_slug end as writer_slug,
       p.featured_rank
  from public.aqlam_posts p
  left join public.aqlam_writer_profiles w on w.user_id = p.writer_id
 where p.status = 'published'
   and public.aqlam_mode() <> 'off';

revoke all on public.aqlam_public_posts from anon, authenticated;
grant select on public.aqlam_public_posts to anon, authenticated;
