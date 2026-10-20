-- أقلام الرحلة — التعليق باسم القلم.
--
-- لو كاتب اختار اسم قلم لحماية خصوصيته، تعليقاته لازم تظهر بيه برضه؛ كانت
-- بتظهر باسمه الأول الحقيقي. دالة واحدة (create or replace) بنفس صلاحياتها.
-- بتتشغّل بعد `20261016180000_aqlam_writer_page_same_name.sql`.

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

  -- الاسم: المدرب باسمه المعروض. غيره: اسم القلم لو اختاره (١٢+ بس)، وإلا
  -- الاسم الأول. (قبل كده كان بيعلّق باسمه الأول حتى لو بينشر باسم قلم —
  -- فالاسم المستعار كان بيتكشف من التعليقات.)
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

revoke all on function public.aqlam_add_comment(uuid, text) from public, anon, authenticated;
grant execute on function public.aqlam_add_comment(uuid, text) to authenticated;
