-- ═══════════════════════════════════════════════════════════════
-- مراجعة العميل لصورة البطل + مدة التجهيز لكل كتاب
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — قرار تامر (٢٥ أكتوبر):
--   «المراجعة بتكون للصورة فقط — التأخير في الاعتماد بيأخّر ميعاد
--    التسليم».
--   «وقت التسليم لازم يكون متاح لينا ضبطه من كل كتاب أو قصة (قيمة
--    عامة للجميع، ويمكن تغييرها من إعدادات كل كتاب أو قصة)».
--
-- ── اللي بيتعمل ─────────────────────────────────────────────
--
--   ١) `personalized_products`: عمودين اختياريين
--        delivery_days_electronic / delivery_days_printed
--      فاضي = القيمة العامة من «الإعدادات» (مش محتاجة ترحيل —
--      بتتحفظ في `site_settings` زي باقي الإعدادات).
--
--   ٢) جدول `story_image_reviews`: كل مرة الفريق يبعت صورة البطل
--      للعميل = صف. فيه إمتى اتبعتت وإمتى العميل قرّر — والفرق بينهم
--      هو **مدة الانتظار اللي بتتضاف على ميعاد التسليم**.
--        • القراءة: فريق الاستوديو بس. ولي الأمر بيقرا من دالة.
--        • الكتابة: من الدوال بس — مفيش صلاحية كتابة على الجدول.
--
--   ٣) تلات دوال:
--        story_image_send(project, note)      الفريق يبعت الصورة الحالية
--        my_story_image_reviews(order)        ولي الأمر يشوف صوره
--        story_image_decide(review, ok, note) ولي الأمر يوافق أو يطلب تعديل
--      موافقة العميل = اعتماد مرجع الشخصية (`character_approved_at`)
--      — يعني بوابة «المشاهد» بتتفتح بقراره هو.
--
--   ٤) **العميل مابقاش بيراجع النص.** بوابة `text_client_approved`
--      اتشالت من مرحلة «الشخصية» واتحطّ مكانها `text_editor_approved`
--      (اعتماد المحرّر). ومرحلة «موافقة العميل على النص» كانت اختيارية
--      أصلًا (المحرّر يقدر يعدّيها) — اسمها بس اتغيّر.
--      ⚠️ دوال معاينة النص القديمة (`my_story_previews` …) **سايبينها**
--         — مش بتتنادى من الموقع تاني، ومسحها مش لازم.
--
-- ⚠️ **ليه مش بنزوّد `story_projects.due_at` تلقائيًا؟**
--    حارس المشروع بيقصر تعديل الموعد على مسؤول الإنتاج، وفتحه للعميل
--    (حتى من دالة) معناه تعديل الحارس. بدل كده مدة الانتظار متسجّلة
--    في الصف، والموقع بيضيفها على الميعاد اللي بيتعرض للعميل، وشاشة
--    الاستوديو بتعرضها للفريق.
--
-- الأثر
--   • مفيش بيانات بتتغيّر ولا بتتمسح. عمودين فاضيين + جدول جديد فاضي.
--   • الـ١٤ مشروع الحاليين في «الطلب» و«كتابة النص» — مفيش حد واقف
--     على موافقة نص.
--
-- الترتيب
--   بعد `20261024200000_advisor_fixes`.
--
-- التحقق
--   1) select count(*) from information_schema.columns
--       where table_name = 'personalized_products' and column_name like 'delivery_days_%';   ← 2
--   2) select count(*) from pg_proc
--       where proname in ('story_image_send','my_story_image_reviews','story_image_decide'); ← 3
--   3) select gates from task_steps where line = 'studio' and step = 'character';
--        ← {text_editor_approved,photo_consent}
--
-- الرجوع للخلف
--   update task_steps set gates = array['text_client_approved','photo_consent']
--    where line = 'studio' and step = 'character';
--   drop function if exists public.story_image_decide(uuid, boolean, text);
--   drop function if exists public.my_story_image_reviews(uuid);
--   drop function if exists public.story_image_send(uuid, text);
--   -- الجدول والعمودين سيبهم: وجودهم مابيكسرش حاجة، ومسحهم بيضيّع قرارات العملاء.
-- ═══════════════════════════════════════════════════════════════

-- ── ١) مدة التجهيز لكل كتاب ─────────────────────────────────
alter table public.personalized_products
  add column if not exists delivery_days_electronic smallint,
  add column if not exists delivery_days_printed    smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'personalized_products_delivery_days_chk') then
    alter table public.personalized_products
      add constraint personalized_products_delivery_days_chk check (
        (delivery_days_electronic is null or delivery_days_electronic between 1 and 120)
        and (delivery_days_printed is null or delivery_days_printed between 1 and 120)
      );
  end if;
end $$;

comment on column public.personalized_products.delivery_days_electronic is
  'مدة تجهيز النسخة الإلكترونية بالأيام. فاضي = القيمة العامة من الإعدادات.';
comment on column public.personalized_products.delivery_days_printed is
  'مدة تجهيز النسخة المطبوعة بالأيام (قبل الشحن). فاضي = القيمة العامة من الإعدادات.';

-- ── ٢) مراجعات صورة البطل ───────────────────────────────────
create table if not exists public.story_image_reviews (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.story_projects(id) on delete cascade,
  image_url   text not null check (image_url ~ '^https://'),
  staff_note  text check (staff_note is null or char_length(staff_note) <= 500),
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'changes_requested', 'withdrawn')),
  sent_at     timestamptz not null default now(),
  sent_by     uuid references public.user_profiles(id) on delete set null,
  decided_at  timestamptz,
  decided_by  uuid references public.user_profiles(id) on delete set null,
  client_note text check (client_note is null or char_length(client_note) <= 500)
);

comment on table public.story_image_reviews is
  'صورة البطل اللي اتبعتت لولي الأمر يعتمدها. decided_at - sent_at = مدة الانتظار اللي بتتضاف على ميعاد التسليم.';

create index if not exists story_image_reviews_project_idx on public.story_image_reviews (project_id, sent_at desc);
create index if not exists story_image_reviews_sent_by_fkidx on public.story_image_reviews (sent_by);
create index if not exists story_image_reviews_decided_by_fkidx on public.story_image_reviews (decided_by);
-- صورة واحدة بس مستنية قرار في المشروع.
create unique index if not exists story_image_reviews_one_pending
  on public.story_image_reviews (project_id) where status = 'pending';

alter table public.story_image_reviews enable row level security;
revoke all on table public.story_image_reviews from public, anon, authenticated;
grant select on table public.story_image_reviews to authenticated;

drop policy if exists story_image_reviews_studio_read on public.story_image_reviews;
create policy story_image_reviews_studio_read on public.story_image_reviews
  for select to authenticated
  using ((select public.story_studio_access()));

-- ── ٣أ) الفريق يبعت الصورة ──────────────────────────────────
--
-- ⚠️ الصورة اللي بتتبعت هي **مرجع الشخصية المحفوظ** في المشروع —
--    مش رابط بيتكتب في الزرار. مصدر واحد: اللي الفريق شايفه في
--    الشاشة هو اللي العميل بيشوفه.
create or replace function public.story_image_send(p_project_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_p   record;
  v_id  uuid;
begin
  if v_uid is null
     or not (public.admin_has_permission('canManageStudio') or public.story_is_worker(p_project_id, v_uid)) then
    raise exception 'إرسال الصورة لفريق المشروع بس' using errcode = '42501';
  end if;

  select id, status, character_ref_url, character_approved_at
    into v_p
    from public.story_projects where id = p_project_id;
  if not found then
    raise exception 'المشروع مش موجود' using errcode = '23503';
  end if;
  if v_p.status <> 'character' then
    raise exception 'الصورة بتتبعت للعميل في مرحلة «الشخصية»' using errcode = '23514';
  end if;
  if v_p.character_approved_at is not null then
    raise exception 'صورة البطل اتعتمدت خلاص' using errcode = '23514';
  end if;
  if coalesce(v_p.character_ref_url, '') !~ '^https://' then
    raise exception 'احفظ رابط صورة البطل الأول' using errcode = '23514';
  end if;

  -- صورة أحدث بتلغي اللي قبلها لو لسه مستنية.
  update public.story_image_reviews
     set status = 'withdrawn'
   where project_id = p_project_id and status = 'pending';

  insert into public.story_image_reviews (project_id, image_url, staff_note, sent_by)
  values (p_project_id, v_p.character_ref_url, nullif(left(btrim(coalesce(p_note, '')), 500), ''), v_uid)
  returning id into v_id;

  return v_id;
end $$;

-- ── ٣ب) ولي الأمر يشوف صوره ─────────────────────────────────
create or replace function public.my_story_image_reviews(p_order_id uuid)
returns table (
  project_id         uuid,
  order_item_id      uuid,
  product_id         text,
  review_id          uuid,
  image_url          text,
  staff_note         text,
  status             text,
  sent_at            timestamptz,
  decided_at         timestamptz,
  client_note        text,
  character_approved boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select sp.id, sp.order_item_id, sp.product_id,
         r.id, r.image_url, r.staff_note, r.status, r.sent_at, r.decided_at, r.client_note,
         sp.character_approved_at is not null
    from public.orders o
    join public.story_projects sp on sp.order_id = o.id
    join public.story_image_reviews r on r.project_id = sp.id
   where o.id = p_order_id
     and (select auth.uid()) is not null
     and o.user_id = (select auth.uid())
     and r.status <> 'withdrawn'
   order by sp.order_item_id, r.sent_at desc
$$;

-- ── ٣ج) قرار ولي الأمر ──────────────────────────────────────
create or replace function public.story_image_decide(
  p_review_id uuid,
  p_approve   boolean,
  p_note      text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_r    record;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if v_uid is null then
    raise exception 'لازم تسجّل الدخول' using errcode = '42501';
  end if;

  select r.id, r.status, r.image_url, r.project_id, sp.character_approved_at, o.user_id
    into v_r
    from public.story_image_reviews r
    join public.story_projects sp on sp.id = r.project_id
    join public.orders o on o.id = sp.order_id
   where r.id = p_review_id;

  -- ⚠️ نفس الرسالة للمش موجودة وللمش بتاعته.
  if not found or v_r.user_id is distinct from v_uid then
    raise exception 'الصورة دي مش على طلبك' using errcode = '42501';
  end if;
  if v_r.status <> 'pending' then
    raise exception 'الصورة دي مش مستنية قرارك' using errcode = '23514';
  end if;
  if v_r.character_approved_at is not null then
    raise exception 'صورة البطل اتعتمدت خلاص' using errcode = '23514';
  end if;

  if not p_approve and v_note is null then
    raise exception 'اكتب عايز نعدّل إيه في الصورة' using errcode = '23514';
  end if;

  update public.story_image_reviews
     set status      = case when p_approve then 'approved' else 'changes_requested' end,
         decided_at  = now(),
         decided_by  = v_uid,
         client_note = v_note
   where id = p_review_id;

  if p_approve then
    -- موافقته = اعتماد مرجع الشخصية، بنفس الصورة اللي شافها.
    update public.story_projects
       set character_ref_url     = v_r.image_url,
           character_approved_at = now(),
           character_approved_by = v_uid
     where id = v_r.project_id
       and character_approved_at is null;
    return 'approved';
  end if;
  return 'changes_requested';
end $$;

revoke execute on function public.story_image_send(uuid, text)               from public, anon;
revoke execute on function public.my_story_image_reviews(uuid)               from public, anon;
revoke execute on function public.story_image_decide(uuid, boolean, text)   from public, anon;
grant  execute on function public.story_image_send(uuid, text)               to authenticated;
grant  execute on function public.my_story_image_reviews(uuid)               to authenticated;
grant  execute on function public.story_image_decide(uuid, boolean, text)   to authenticated;

-- ── ٤) العميل بيراجع الصورة مش النص ─────────────────────────
update public.task_steps
   set gates = array['text_editor_approved', 'photo_consent'],
       hint  = 'تجهيز صورة البطل وإرسالها لولي الأمر يعتمدها — المشاهد مابتبدأش قبل اعتماده.'
 where line = 'studio' and step = 'character'
   and 'text_client_approved' = any (gates);

update public.task_steps
   set label = 'تأكيد النص (اختياري)',
       hint  = 'خطوة اختيارية — العميل مابيراجعش النص، بيراجع صورة البطل بس.'
 where line = 'studio' and step = 'client_text_approval'
   and label = 'موافقة العميل على النص';
