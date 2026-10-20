-- أقلام الرحلة — إصلاح العرض العام للزوار.
--
-- المشكلة: عرضَا `aqlam_public_posts` و`aqlam_public_writers` (من
-- `20261016120000` و`20261016180000`) كانوا بيستدعوا دوال مساعدة
-- (`aqlam_is_suspended` / `aqlam_age_of` / `aqlam_age_band`) صلاحية تنفيذها
-- مسحوبة من الزوار عن قصد. Postgres بيفحص صلاحية الدالة على الدور اللي بيقرأ
-- (anon) حتى لو العرض صاحبه غيره، فالقراءة كانت بتفشل بـ
-- "permission denied for function aqlam_is_suspended" وصفحات أقلام الرحلة
-- العامة (القائمة والنص وصفحة الكاتب) كانت بتظهر خطأ.
--
-- الحل: نفس المنطق بالظبط لكن مكتوب جوّه العرض نفسه (الجداول بتتقرا بصلاحية
-- صاحب العرض)، من غير ما نفتح أي دالة للزوار.
--
-- إضافة بس (create or replace view، نفس الأعمدة بنفس الترتيب). مفيش بيانات
-- بتتغيّر. بتتشغّل بعد `20261016180000_aqlam_writer_page_same_name.sql`.

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
                 and not exists (
                   select 1 from public.aqlam_sanctions s
                    where s.user_id = p.writer_id
                      and s.lifted_at is null
                      and s.kind in ('suspension_7d', 'permanent')
                      and (s.expires_at is null or s.expires_at > now()))
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
       case when ag.age between 6  and 9  then '6-9'
            when ag.age between 10 and 12 then '10-12'
            when ag.age between 13 and 17 then '13-17'
            when ag.age between 18 and 20 then '18-20'
            else null end as age_band,
       (select count(*) from public.aqlam_posts p
         where p.writer_id = w.user_id and p.status = 'published'
           and p.age_group = '12_plus' and p.display_name = w.pen_name)::integer as posts_count
  from public.aqlam_writer_profiles w
  left join lateral (
    select true as found, c.birth_date
      from public.child_profiles c
     where nullif(btrim(coalesce(c.account_profile_id, '')), '') = w.user_id::text
     order by c.created_at
     limit 1
  ) ch on true
  cross join lateral (
    -- نفس حساب `aqlam_age_of`: الطفل من child_profiles (فاضي = ٠)، والمستقل من ملفه.
    select case when ch.found
                then coalesce(extract(year from age((now() at time zone 'Africa/Cairo')::date, ch.birth_date))::integer, 0)
                else extract(year from age((now() at time zone 'Africa/Cairo')::date, w.birth_date))::integer
           end as age
  ) ag
 where w.public_profile
   and w.public_slug is not null
   and w.pen_name is not null
   and ag.age >= 12
   and not exists (
     select 1 from public.aqlam_sanctions s
      where s.user_id = w.user_id
        and s.lifted_at is null
        and s.kind in ('suspension_7d', 'permanent')
        and (s.expires_at is null or s.expires_at > now()))
   and public.aqlam_mode() <> 'off';

-- الصلاحيات بتتحفظ مع create or replace؛ بنأكدها برضه.
revoke all on public.aqlam_public_posts, public.aqlam_public_writers from anon, authenticated;
grant select on public.aqlam_public_posts, public.aqlam_public_writers to anon, authenticated;
