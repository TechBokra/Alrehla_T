-- أقلام الرحلة — صفحة الكاتب العامة: ما تربطش الأسماء ببعض.
--
-- المشكلة: لو كاتب نشر نصًا باسمه الحقيقي ونصًا تاني باسم قلم، ثم فعّل
-- صفحته، كانت الصفحة بتجمّع النصّين تحت اسم واحد — فاسمه الحقيقي كان
-- بيتربط باسم قلمه من غير ما يقصد.
--
-- القاعدة الجديدة: الصفحة ليها **اسم قلم** (إجباري)، ولا بيظهر فيها ولا
-- بيتربط بيها غير النصوص اللي ظاهرة بنفس الاسم ده بالظبط.
--
-- إضافة بس (create or replace). بتتشغّل بعد `20261016120000_aqlam_profile_edit.sql`.

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
       -- الرابط بس لو الكاتب فعّل صفحته (١٢+، غير موقوف) والنص ظاهر باسم صفحته.
       case when p.age_group = '12_plus'
                 and w.public_profile
                 and w.pen_name is not null
                 and p.display_name = w.pen_name
                 and not public.aqlam_is_suspended(p.writer_id)
            then w.public_slug end as writer_slug
  from public.aqlam_posts p
  left join public.aqlam_writer_profiles w on w.user_id = p.writer_id
 where p.status = 'published'
   and public.aqlam_mode() <> 'off';

create or replace view public.aqlam_public_writers
with (security_invoker = false) as
select w.public_slug as slug,
       w.pen_name as name,
       w.bio,
       public.aqlam_age_band(public.aqlam_age_of(w.user_id)) as age_band,
       (select count(*) from public.aqlam_posts p
         where p.writer_id = w.user_id and p.status = 'published'
           and p.age_group = '12_plus' and p.display_name = w.pen_name)::integer as posts_count
  from public.aqlam_writer_profiles w
 where w.public_profile
   and w.public_slug is not null
   and w.pen_name is not null
   and public.aqlam_age_of(w.user_id) >= 12
   and not public.aqlam_is_suspended(w.user_id)
   and public.aqlam_mode() <> 'off';

-- الصلاحيات بتتحفظ مع create or replace؛ بنأكدها برضه.
revoke all on public.aqlam_public_posts, public.aqlam_public_writers from anon, authenticated;
grant select on public.aqlam_public_posts, public.aqlam_public_writers to anon, authenticated;

-- الصفحة العامة محتاجة اسم قلم.
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

-- الصلاحيات بتتحفظ مع create or replace؛ بنأكدها برضه.
revoke all on function public.aqlam_set_writer_profile(text, text, boolean) from public, anon, authenticated;
grant execute on function public.aqlam_set_writer_profile(text, text, boolean) to authenticated;
