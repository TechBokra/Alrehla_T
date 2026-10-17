-- ============================================================================
-- نقاش على طلب الانضمام — مش قبول ورفض وبس
-- ============================================================================
-- الحاجة  : الإدارة محتاجة تسأل المتقدّم قبل ما تبتّ: «ابعتلنا نموذج من
--           شغلك»، «إيه خبرتك مع السنّ ده»، «الرقم ده شغّال؟». اللي
--           موجود زرّان: قبول ورفض. فالسؤال بيحصل برّه الموقع — واتساب
--           أو مكالمة — ومحدّش يعرف بعدين اتقال إيه ولا ليه الطلب
--           اترفض.
--
-- ── المشكلة الحقيقية: المتقدّم مالوش حساب ─────────────────────
--
-- ⚠️ `join_requests` فيه **اسم وبريد وتليفون وبس** — مفيش `user_id`.
--    المتقدّم لسه ما اتقبلش، فمفيش حساب يدخل بيه يقرا رد الإدارة.
--    و«شات» بيتخزّن ومحدّش يقدر يقراه = دفتر ملاحظات للإدارة، مش نقاش.
--
--    وبعتنا الرد بالإيميل مش حل كمان: **الموقع مابيبعتش إيميلات**
--    أصلًا (ولا مكتبة إرسال في المشروع؛ إيميلات Supabase للمصادقة بس).
--
-- الحل    : **رابط بمفتاح سري على الطلب نفسه.** المتقدّم بيفتحه من غير
--           تسجيل دخول ويقرا ويرد. والإدارة بتبعتله الرابط بنفس الطريقة
--           اللي بتبعت بيها الرمز المؤقت (واتساب).
--
-- ⚠️ **المفتاح ٤٣ حرفًا عشوائيًا من `gen_random_bytes`** — مش `id`
--    الطلب. الرقم التسلسلي بيتسرّب في الروابط والسجلات، والمفتاح ده
--    هو كلمة السر الوحيدة على الصفحة.
--
-- ⚠️ **والجدول مقفول على `anon` تمامًا.** القراءة والكتابة من الزائر
--    بتمر على دالتين `SECURITY DEFINER` بياخدوا المفتاح — فمفيش طريق
--    يقرا بيها طلبًا تاني ولا يعدّ الطلبات. سياسة RLS على الجدول
--    مباشرةً كانت هتحتاج تفتحه للزائر.
--
-- ⚠️ **والرد مابيغيّرش حالة الطلب.** `pending` تفضل `pending` —
--    النقاش مش قرار. الحالات التلاتة زي ما هي.
--
-- الأثر   : جدول رسايل جديد + عمود مفتاح + دالتين. مفيش صف موجود
--           بيتغيّر، ومفيش صلاحية بتتوسّع على جدول قايم.
--
-- الرجوع  : drop table public.join_request_messages;
--           alter table public.join_requests drop column access_token;
--           drop function public.join_request_thread(text);
--           drop function public.join_request_reply(text, text);
-- ============================================================================

-- ── ① المفتاح ───────────────────────────────────────────────
alter table public.join_requests
  add column if not exists access_token text;

-- الطلبات القديمة بتاخد مفاتيح كمان، عشان الإدارة تقدر تفتح نقاشًا
-- على طلب قديم من غير ما المتقدّم يعيد التقديم.
update public.join_requests
   set access_token = encode(gen_random_bytes(32), 'base64')
 where access_token is null;

alter table public.join_requests
  alter column access_token set default encode(gen_random_bytes(32), 'base64');

alter table public.join_requests
  alter column access_token set not null;

create unique index if not exists join_requests_access_token_key
  on public.join_requests (access_token);


-- ── ② الرسايل ───────────────────────────────────────────────
create table if not exists public.join_request_messages (
  id         uuid default gen_random_uuid() not null,
  request_id uuid not null,
  -- مين كاتبها. `applicant` بيكتب من الرابط من غير حساب، فمفيش ملف له.
  author     text not null,
  -- ملف الإداري اللي كتب — فاضي لرسايل المتقدّم.
  author_profile_id uuid,
  body       text not null,
  created_at timestamptz default now() not null,
  constraint join_request_messages_pkey primary key (id),
  constraint join_request_messages_author check (author in ('admin', 'applicant')),
  constraint join_request_messages_body check (length(btrim(body)) between 1 and 4000),
  constraint join_request_messages_request_fkey
    foreign key (request_id) references public.join_requests(id) on delete cascade
);

alter table public.join_request_messages enable row level security;

create index if not exists join_request_messages_request_idx
  on public.join_request_messages (request_id, created_at);

-- الإدارة بتقرا وتكتب من اللوحة بحسابها.
drop policy if exists "admins read join request messages" on public.join_request_messages;
create policy "admins read join request messages" on public.join_request_messages
  for select to public using (is_admin());

drop policy if exists "admins write join request messages" on public.join_request_messages;
create policy "admins write join request messages" on public.join_request_messages
  for insert to public with check (is_admin() and author = 'admin');

-- ⚠️ **ومفيش سياسة للزائر خالص** — بيعدّي على الدالتين تحت وبس.


-- ── ③ قراءة النقاش بالمفتاح ─────────────────────────────────
create or replace function public.join_request_thread(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_req record;
  v_msgs jsonb;
begin
  -- ⚠️ مفتاح قصير أو فاضي بيترفض من غير ما نلمس الجدول.
  if p_token is null or length(p_token) < 20 then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select id, applicant_name, requested_role, status::text as status, created_at
    into v_req
    from join_requests
   where access_token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'author', m.author,
           'body', m.body,
           'createdAt', m.created_at
         ) order by m.created_at), '[]'::jsonb)
    into v_msgs
    from join_request_messages m
   where m.request_id = v_req.id;

  -- ⚠️ **البريد والتليفون مش بيرجعوا.** الصفحة دي مفتوحة بالرابط،
  --    واللي معاه الرابط مش لازم يشوف بيانات تواصل المتقدّم.
  return jsonb_build_object(
    'ok', true,
    'name', v_req.applicant_name,
    'role', v_req.requested_role,
    'status', v_req.status,
    'createdAt', v_req.created_at,
    'messages', v_msgs
  );
end
$$;

revoke all on function public.join_request_thread(text) from public;
grant execute on function public.join_request_thread(text) to anon, authenticated;


-- ── ④ رد المتقدّم بالمفتاح ──────────────────────────────────
create or replace function public.join_request_reply(p_token text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_body  text := btrim(coalesce(p_body, ''));
  v_count integer;
begin
  if p_token is null or length(p_token) < 20 then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if length(v_body) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty');
  end if;
  if length(v_body) > 4000 then
    return jsonb_build_object('ok', false, 'error', 'too_long');
  end if;

  select id into v_id from join_requests where access_token = p_token;
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- ⚠️ **حد أقصى للرسايل على الطلب الواحد.** الصفحة مفتوحة بالرابط
  --    من غير حساب، فمن غير السقف ده أي حد معاه الرابط يقدر يملا
  --    الجدول. ٥٠ رسالة أكتر من أي نقاش حقيقي على طلب انضمام.
  select count(*) into v_count from join_request_messages where request_id = v_id;
  if v_count >= 50 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;

  insert into join_request_messages (request_id, author, body)
  values (v_id, 'applicant', v_body);

  -- ⚠️ **الإدارة لازم تعرف.** الرد جاي من زائر بلا حساب، فدالة
  --    `notify_admins` العادية بترفضه («must be signed in») — وده
  --    بالظبط العطل اللي `notifyAdmins` في الكود بيلفّ حواليه بمفتاح
  --    الخدمة. هنا بنكتب الإشعار مباشرةً، والنص من الدالة مش من
  --    الزائر، فمفيش طريق يحط بيها كلامه في إشعار الإدارة.
  insert into notifications (recipient_profile_id, title, message, link)
  select p.id::text,
         'رد جديد على طلب انضمام',
         (select applicant_name from join_requests where id = v_id) || ' ردّ على طلبه.',
         '/dashboard/admin/join-requests/' || v_id::text
    from user_profiles p
   where p.role in ('super_admin', 'general_supervisor');

  return jsonb_build_object('ok', true);
end
$$;

revoke all on function public.join_request_reply(text, text) from public;
grant execute on function public.join_request_reply(text, text) to anon, authenticated;


-- ============================================================================
-- التحقق — قراءة بس
-- ============================================================================
--   -- (أ) كل طلب له مفتاح؟
--   select count(*) filter (where access_token is null) as "بلا مفتاح",
--          count(*) as "الإجمالي"
--     from join_requests;
--   -- المتوقع: «بلا مفتاح» = 0
--
--   -- (ب) جرّب القراءة بمفتاح حقيقي (مابيغيّرش حاجة)
--   select public.join_request_thread((select access_token from join_requests limit 1));
--
--   -- (ج) ومفتاح غلط لازم يرجّع not_found
--   select public.join_request_thread('xxxxxxxxxxxxxxxxxxxxxxxx');
-- ============================================================================
