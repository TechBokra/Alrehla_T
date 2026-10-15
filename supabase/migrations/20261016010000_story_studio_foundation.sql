-- ============================================================================
-- استوديو القصص — الأساس: الصلاحيات والأدوار والجداول والحرّاس
-- ============================================================================
-- الغرض   : مسار إنتاج خلف طلبات «إنها لك» المخصّصة: موجز ← نص ← موافقة
--           العميل ← شخصية ← مشاهد ← تركيب ← فحص ← تسليم. كل مرحلة ليها
--           مسؤول، وكل انتقال بيتفحص في القاعدة مش في الشاشة بس.
--
-- الحدود  : • **مفيش تعديل على جدول موجود** غير قيد `admin_roles_known_permissions`
--             (توسيع بس — زي ملفّي canManagePayments وcanAssignWork).
--           • أربعة جداول جديدة بادئتها `story_`، ودوال بنفس البادئة.
--           • ملفات الصور مش جزء من الملف ده: الصورة/الشخصية بتتسجّل كرابط
--             https لحد ما رفع الملفات الخاصة للاستوديو يتبني.
--
-- الترتيب : الكود بيتنشر الأول، وبعده الملف ده. الملف **مايفتحش حاجة**:
--           `story_mode()` الافتراضي `off`، فلا مشروع بيتعمل تلقائيًا ولا
--           الإنشاء اليدوي بيشتغل. التشغيل من «إعدادات الاستوديو».
--
-- الأمان  : • الدور الإداري بيتقرا من `admin_roles` عبر `admin_has_permission`
--             — نفس منطق الكود (`defaultPermissionsForRole`): مدير النظام الكل،
--             والمشرف دوره الإداري أو الافتراضي.
--           • RLS: مفيش وصول لحد غير اللي ليه `canWorkStudio` أو `canManageStudio`.
--             العميل مالوش وصول مباشر خالص (صفحة «قصتي» قرار لاحق وهتعدّي
--             على دوال محدودة الأعمدة).
--           • الإنشاء التلقائي عند الدفع **مابيفشّلش الدفع أبدًا**: أي خطأ فيه
--             بيتحوّل لتحذير في سجل القاعدة.
--
-- الأدوار : الملف بيضيف ٣ أدوار إدارية جديدة (صفوف جديدة بس، مفيش دور
--           موجود بيتغيّر): «محرر قصص» و«مشرف فني» و«مسؤول إنتاج القصص».
--           تعيين الأشخاص عليها من: المستخدمون ← الأدوار والصلاحيات.
--
-- التحقق  : supabase/tests/story_studio_foundation.sql (معاملة بتتراجع).
--
-- الرجوع  : (بالترتيب)
--   drop trigger if exists story_projects_on_paid_trg on public.orders;
--   drop table public.story_cost_entries, public.story_pages,
--              public.story_versions, public.story_projects;
--   drop function public.story_start_project(uuid),
--                 public.story_create_project_for_item(uuid),
--                 public.story_projects_on_paid(), public.story_project_guard(),
--                 public.story_version_guard(), public.story_page_guard(),
--                 public.story_studio_access(), public.story_mode(),
--                 public.admin_has_permission(text);
--   delete from public.admin_roles where name in
--     ('محرر قصص','مشرف فني','مسؤول إنتاج القصص');   -- بعد فكّ الأشخاص منها
--   ثم رجّع قيد الصلاحيات للقايمة بدون canManageStudio وcanWorkStudio.
-- ============================================================================


-- ── ١) الصلاحيتان الجداد ────────────────────────────────────────────────────
--   canManageStudio : مسؤول الإنتاج — التوزيع والتسليم والإيقاف والتكاليف.
--   canWorkStudio   : العمل في المشاريع اللي مسؤول عنها (محرر / مشرف فني).

alter table public.admin_roles drop constraint if exists admin_roles_known_permissions;

alter table public.admin_roles
  add constraint admin_roles_known_permissions
  check (permissions <@ ARRAY[
    'canManageUsers',
    'canManageInstructors',
    'canManagePublishers',
    'canManageCatalog',
    'canManageSubscriptions',
    'canManageOrders',
    'canManageBookings',
    'canManageSupport',
    'canManageContent',
    'canManageFinance',
    'canManagePayments',
    'canAssignWork',
    'canViewAuditLogs',
    'canManageStudio',
    'canWorkStudio'
  ]::text[]);


-- ── ٢) الأدوار (صفوف جديدة فقط) ─────────────────────────────────────────────

insert into public.admin_roles (name, permissions)
select v.name, v.perms
  from (values
    ('محرر قصص',           array['canWorkStudio']::text[]),
    ('مشرف فني',           array['canWorkStudio']::text[]),
    ('مسؤول إنتاج القصص',  array['canManageStudio', 'canWorkStudio']::text[])
  ) as v(name, perms)
 where not exists (
   select 1 from public.admin_roles r
    where lower(btrim(r.name)) = lower(btrim(v.name))
 );


-- ── ٣) دوال مساعدة ──────────────────────────────────────────────────────────

-- الإداري ده معاه الصلاحية دي؟ (نفس منطق `defaultPermissionsForRole` + الدور
-- الإداري في الكود.) auth.uid() فاضي (السيرفر) = false.
create or replace function public.admin_has_permission(p_permission text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from user_profiles p
     where p.id = auth.uid()
       and (
         p.role = 'super_admin'
         or (
           p.role = 'general_supervisor'
           and exists (
             select 1
               from admin_roles r
              where (r.id = p.admin_role_id or (p.admin_role_id is null and r.is_default))
                and p_permission = any (r.permissions)
           )
         )
       )
  );
$$;

-- حالة التشغيل من صف `general` في `site_settings`: off | on. الافتراضي مقفول.
create or replace function public.story_mode()
returns text
language sql stable security definer set search_path = public as $$
  select case coalesce((select value ->> 'studioMode' from site_settings where key = 'general'), 'off')
           when 'on' then 'on'
           else 'off'
         end;
$$;

-- يدخل الاستوديو؟ (محرر/مشرف فني أو مسؤول إنتاج.)
create or replace function public.story_studio_access()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.admin_has_permission('canWorkStudio')
      or public.admin_has_permission('canManageStudio');
$$;

revoke all on function public.admin_has_permission(text) from public, anon;
revoke all on function public.story_mode() from public, anon;
revoke all on function public.story_studio_access() from public, anon;
grant execute on function public.admin_has_permission(text) to authenticated, service_role;
grant execute on function public.story_mode() to authenticated, service_role;
grant execute on function public.story_studio_access() to authenticated, service_role;


-- ── ٤) الجداول ──────────────────────────────────────────────────────────────

-- مشروع القصة: واحد لكل بند طلب مخصّص.
create table public.story_projects (
  id                     uuid primary key default gen_random_uuid(),
  order_item_id          uuid not null unique references public.order_items(id) on delete cascade,
  order_id               uuid not null references public.orders(id) on delete cascade,
  product_id             text not null,
  status                 text not null default 'brief',
  -- الحالة اللي المشروع كان فيها قبل الإيقاف المؤقت (فاضية خارج `on_hold`).
  held_from              text,
  -- لقطة من customization_data وقت الإنشاء — **من غير صورة الطفل** (الصورة
  -- بتتقرا من بند الطلب نفسه، فمفيش نسخة تانية من صورة طفل في الجدول ده).
  brief                  jsonb not null default '{}'::jsonb,
  age_band               text,
  page_target            integer,
  -- كرتوني مستوحى (الافتراضي) | وجه حقيقي (محتاج موافقة ولي الأمر).
  face_mode              text not null default 'cartoon',
  photo_consent_at       timestamptz,
  photo_consent_by       uuid references public.user_profiles(id) on delete set null,
  photo_consent_note     text,
  -- موضوع حساس (نفسي/أسري) = مراجعة متخصص إضافية قبل التسليم.
  sensitive_topic        boolean not null default false,
  editor_id              uuid references public.user_profiles(id) on delete set null,
  art_lead_id            uuid references public.user_profiles(id) on delete set null,
  due_at                 timestamptz,
  character_notes        text,
  character_ref_url      text,
  character_approved_at  timestamptz,
  character_approved_by  uuid references public.user_profiles(id) on delete set null,
  qa_checklist           jsonb not null default '{}'::jsonb,
  qa_passed_at           timestamptz,
  qa_passed_by           uuid references public.user_profiles(id) on delete set null,
  delivered_at           timestamptz,
  delivery_note          text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint story_projects_status check (status in (
    'brief', 'text_draft', 'text_review', 'client_text_approval', 'character',
    'scenes', 'art_review', 'layout', 'qa', 'ready', 'delivered', 'on_hold', 'cancelled'
  )),
  constraint story_projects_held_from check (
    held_from is null or held_from in (
      'brief', 'text_draft', 'text_review', 'client_text_approval', 'character',
      'scenes', 'art_review', 'layout', 'qa', 'ready'
    )
  ),
  constraint story_projects_hold_consistent check ((status = 'on_hold') = (held_from is not null)),
  constraint story_projects_age_band check (age_band is null or age_band in ('6-9', '10-12', '13-17', '18-20')),
  constraint story_projects_page_target check (page_target is null or page_target between 4 and 64),
  constraint story_projects_face_mode check (face_mode in ('cartoon', 'real')),
  constraint story_projects_ref_url check (
    character_ref_url is null or (character_ref_url ~ '^https://[^[:space:]]+$' and char_length(character_ref_url) <= 500)
  ),
  constraint story_projects_notes_len check (
    coalesce(char_length(character_notes), 0) <= 4000
    and coalesce(char_length(photo_consent_note), 0) <= 1000
    and coalesce(char_length(delivery_note), 0) <= 1000
  ),
  constraint story_projects_checklist_obj check (jsonb_typeof(qa_checklist) = 'object')
);

comment on table public.story_projects is
  'مشروع قصة لكل بند طلب مخصّص. الحالة بتتحرّك بمحفّز story_project_guard: انتقالات مسموحة، ومسؤول كل مرحلة، وشروط مسبقة (نص معتمد، موافقة عميل، صفحات معتمدة، فحص جودة).';
comment on column public.story_projects.brief is
  'لقطة من customization_data وقت الإنشاء، من غير childPhoto — الصورة بتتقرا من order_items.';

create index story_projects_status_due_idx on public.story_projects (status, due_at);
create index story_projects_order_idx      on public.story_projects (order_id);
create index story_projects_editor_idx     on public.story_projects (editor_id) where editor_id is not null;
create index story_projects_art_lead_idx   on public.story_projects (art_lead_id) where art_lead_id is not null;


-- نسخ النص. النسخة المعتمدة مابتتعدّلش — التعديل نسخة جديدة.
create table public.story_versions (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.story_projects(id) on delete cascade,
  version_no            integer not null,
  body                  text not null,
  -- مصدر المسودة: ai = ولّدها نموذج لغوي (والمحرر راجعها)، editor = كتبها المحرر.
  source                text not null default 'editor',
  status                text not null default 'draft',
  note                  text,
  created_by            uuid references public.user_profiles(id) on delete set null,
  approved_by           uuid references public.user_profiles(id) on delete set null,
  approved_at           timestamptz,
  -- موافقة العميل بتتسجّل بمعرفة الفريق (تمت خارج الموقع) لحد صفحة «قصتي».
  client_decision_at    timestamptz,
  client_decision_note  text,
  created_at            timestamptz not null default now(),

  constraint story_versions_unique_no unique (project_id, version_no),
  constraint story_versions_source check (source in ('ai', 'editor')),
  constraint story_versions_status check (status in (
    'draft', 'editor_approved', 'client_approved', 'changes_requested', 'superseded'
  )),
  constraint story_versions_body_len check (char_length(btrim(body)) between 1 and 100000),
  constraint story_versions_note_len check (
    coalesce(char_length(note), 0) <= 2000 and coalesce(char_length(client_decision_note), 0) <= 1000
  )
);

-- نسخة واحدة معتمدة من العميل في المشروع.
create unique index story_versions_one_client_approved
  on public.story_versions (project_id) where status = 'client_approved';


-- صفحات الكتاب (٠ = الغلاف).
create table public.story_pages (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.story_projects(id) on delete cascade,
  page_no            integer not null,
  page_text          text not null default '',
  scene_description  text not null default '',
  image_url          text,
  status             text not null default 'pending',
  -- عدد مرات إعادة الإنتاج (إعادة صفحة واحدة مش الكتاب كله).
  attempts           integer not null default 0,
  reviewer_note      text,
  updated_at         timestamptz not null default now(),

  constraint story_pages_unique_no unique (project_id, page_no),
  constraint story_pages_no check (page_no between 0 and 99),
  constraint story_pages_status check (status in ('pending', 'drafted', 'approved', 'needs_redo')),
  constraint story_pages_attempts check (attempts >= 0),
  constraint story_pages_image_url check (
    image_url is null or (image_url ~ '^https://[^[:space:]]+$' and char_length(image_url) <= 500)
  ),
  constraint story_pages_len check (
    char_length(page_text) <= 4000 and char_length(scene_description) <= 4000
    and coalesce(char_length(reviewer_note), 0) <= 1000
  )
);


-- تكلفة كل مشروع: أدوات، ووقت بشري، وطباعة… (أساس حساب الربحية).
create table public.story_cost_entries (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.story_projects(id) on delete cascade,
  kind        text not null,
  amount      numeric(10, 2) not null default 0,
  minutes     integer,
  note        text,
  created_by  uuid references public.user_profiles(id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint story_cost_kind check (kind in ('tool', 'human', 'print', 'shipping', 'other')),
  constraint story_cost_amount check (amount >= 0 and amount <= 1000000),
  constraint story_cost_minutes check (minutes is null or minutes between 0 and 100000),
  constraint story_cost_note_len check (coalesce(char_length(note), 0) <= 500)
);

create index story_cost_entries_project_idx on public.story_cost_entries (project_id);


-- ── ٥) الحرّاس (محفّزات) ────────────────────────────────────────────────────

-- مشروع القصة: انتقالات الحالة، ومين بيحرّك إيه، والشروط المسبقة.
-- auth.uid() فاضي = السيرفر (service role): بيتخطّى فحص الشخص لا فحص الحالة.
create or replace function public.story_project_guard()
returns trigger
language plpgsql
set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_manage  boolean;
  v_ok      boolean;
  v_required text[] := array[
    'story_engaging', 'dialogue_age_fit', 'art_matches_text',
    'hero_consistent', 'arabic_text_ok', 'print_ready'
  ];
  k         text;
begin
  v_manage := v_uid is null or public.admin_has_permission('canManageStudio');

  -- الهوية والتوزيع والموعد لمسؤول الإنتاج بس.
  if new.order_item_id is distinct from old.order_item_id
     or new.order_id is distinct from old.order_id
     or new.product_id is distinct from old.product_id then
    raise exception 'ربط المشروع بالطلب مايتغيّرش' using errcode = '42501';
  end if;
  if not v_manage and (
       new.editor_id is distinct from old.editor_id
    or new.art_lead_id is distinct from old.art_lead_id
    or new.due_at is distinct from old.due_at
  ) then
    raise exception 'التوزيع والموعد لمسؤول الإنتاج فقط' using errcode = '42501';
  end if;

  new.updated_at := now();

  -- موافقة الصورة: بتتسجّل وقتها ومين سجّلها.
  if new.photo_consent_at is not null and old.photo_consent_at is null then
    new.photo_consent_by := coalesce(new.photo_consent_by, v_uid);
  end if;
  if new.character_approved_at is not null and old.character_approved_at is null then
    new.character_approved_by := coalesce(new.character_approved_by, v_uid);
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- ── انتقال حالة ────────────────────────────────────────────────────────
  if old.status in ('delivered', 'cancelled') then
    raise exception 'المشروع منتهي (%) — مايتعدّلش', old.status using errcode = '42501';
  end if;

  v_ok := case old.status
    when 'brief'                then new.status in ('text_draft', 'on_hold', 'cancelled')
    when 'text_draft'           then new.status in ('text_review', 'on_hold', 'cancelled')
    when 'text_review'          then new.status in ('client_text_approval', 'text_draft', 'on_hold', 'cancelled')
    when 'client_text_approval' then new.status in ('character', 'text_draft', 'on_hold', 'cancelled')
    when 'character'            then new.status in ('scenes', 'text_draft', 'on_hold', 'cancelled')
    when 'scenes'               then new.status in ('art_review', 'text_draft', 'on_hold', 'cancelled')
    when 'art_review'           then new.status in ('layout', 'scenes', 'text_draft', 'on_hold', 'cancelled')
    when 'layout'               then new.status in ('qa', 'art_review', 'text_draft', 'on_hold', 'cancelled')
    when 'qa'                   then new.status in ('ready', 'layout', 'text_draft', 'on_hold', 'cancelled')
    when 'ready'                then new.status in ('delivered', 'qa', 'text_draft', 'on_hold', 'cancelled')
    when 'on_hold'              then new.status = old.held_from
    else false
  end;
  if not v_ok then
    raise exception 'انتقال غير مسموح: % ← %', old.status, new.status using errcode = '23514';
  end if;

  -- تعديل النص بعد ما الرسم بدأ = تعديل نطاق: مسؤول الإنتاج بس، والصفحات
  -- كلها ترجع للمراجعة (مش الكتاب كله بيتعاد توليده — الصفحات المتأثرة).
  if new.status = 'text_draft'
     and old.status in ('character', 'scenes', 'art_review', 'layout', 'qa', 'ready') then
    if not v_manage then
      raise exception 'تعديل النص بعد بدء الرسم لمسؤول الإنتاج فقط' using errcode = '42501';
    end if;
    update story_pages set status = 'needs_redo', updated_at = now()
     where project_id = new.id and status <> 'pending';
    new.qa_passed_at := null;
    new.qa_passed_by := null;
  end if;

  -- مين يحرّك: صاحب المرحلة (المحرر للنص، المشرف الفني للرسم) أو مسؤول الإنتاج.
  if not v_manage then
    if new.status in ('on_hold', 'cancelled', 'delivered') or old.status in ('qa', 'ready', 'on_hold') then
      raise exception 'الإيقاف والإلغاء والفحص النهائي والتسليم لمسؤول الإنتاج فقط' using errcode = '42501';
    elsif old.status in ('brief', 'text_draft', 'text_review', 'client_text_approval')
          and old.editor_id is distinct from v_uid then
      raise exception 'إنت مش محرّر المشروع ده' using errcode = '42501';
    elsif old.status in ('character', 'scenes', 'art_review', 'layout')
          and old.art_lead_id is distinct from v_uid then
      raise exception 'إنت مش المشرف الفني للمشروع ده' using errcode = '42501';
    end if;
  end if;

  -- الإيقاف المؤقت بيفتكر مكانه.
  if new.status = 'on_hold' then
    new.held_from := old.status;
  elsif old.status = 'on_hold' then
    new.held_from := null;
  end if;

  -- ── الشروط المسبقة ──────────────────────────────────────────────────
  if new.status = 'text_review' and not exists (
       select 1 from story_versions where project_id = new.id and status <> 'superseded') then
    raise exception 'اكتب نسخة من النص الأول' using errcode = '23514';
  end if;

  if new.status = 'client_text_approval' and not exists (
       select 1 from story_versions where project_id = new.id and status = 'editor_approved') then
    raise exception 'اعتمد نسخة النص كمحرّر الأول' using errcode = '23514';
  end if;

  if new.status = 'character' then
    if old.status = 'client_text_approval' and not exists (
         select 1 from story_versions where project_id = new.id and status = 'client_approved') then
      raise exception 'لازم موافقة العميل على النص قبل الرسم' using errcode = '23514';
    end if;
    if new.face_mode = 'real' and new.photo_consent_at is null then
      raise exception 'الوجه الحقيقي محتاج موافقة ولي الأمر على استخدام الصورة' using errcode = '23514';
    end if;
  end if;

  if new.status = 'scenes' and new.character_approved_at is null then
    raise exception 'اعتمد مرجع الشخصية الأول' using errcode = '23514';
  end if;

  if new.status = 'art_review' and (
       not exists (select 1 from story_pages where project_id = new.id)
       or exists (select 1 from story_pages where project_id = new.id and status in ('pending', 'needs_redo'))
     ) then
    raise exception 'كل الصفحات لازم تتجهّز قبل مراجعة الرسوم' using errcode = '23514';
  end if;

  if new.status = 'layout' and old.status = 'art_review' and (
       not exists (select 1 from story_pages where project_id = new.id)
       or exists (select 1 from story_pages where project_id = new.id and status <> 'approved')
     ) then
    raise exception 'كل الصفحات لازم تتعتمد قبل التركيب' using errcode = '23514';
  end if;

  if new.status = 'ready' then
    foreach k in array v_required loop
      if coalesce(new.qa_checklist ->> k, 'false') <> 'true' then
        raise exception 'قايمة فحص الجودة ناقصة: %', k using errcode = '23514';
      end if;
    end loop;
    if new.sensitive_topic and coalesce(new.qa_checklist ->> 'sensitive_review', 'false') <> 'true' then
      raise exception 'الموضوع الحساس محتاج مراجعة متخصص قبل التسليم' using errcode = '23514';
    end if;
    new.qa_passed_at := coalesce(new.qa_passed_at, now());
    new.qa_passed_by := coalesce(new.qa_passed_by, v_uid);
  end if;

  if old.status = 'ready' and new.status = 'qa' then
    new.qa_passed_at := null;
    new.qa_passed_by := null;
  end if;

  if new.status = 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;

  return new;
end;
$$;

create trigger story_project_guard_trg
  before update on public.story_projects
  for each row execute function public.story_project_guard();


-- نسخ النص: نص معتمد مايتعدّلش، ومين يعتمد، ومتى يُسمح بنسخة جديدة.
create or replace function public.story_version_guard()
returns trigger
language plpgsql
set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_manage  boolean := auth.uid() is null or public.admin_has_permission('canManageStudio');
  v_project record;
begin
  select id, status, editor_id into v_project from story_projects where id = new.project_id;
  if not found then
    raise exception 'المشروع مش موجود' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    if v_project.status not in ('text_draft', 'text_review', 'client_text_approval') then
      raise exception 'النص بيتكتب في مراحل النص بس (الحالة: %)', v_project.status using errcode = '23514';
    end if;
    if not v_manage and v_project.editor_id is distinct from v_uid then
      raise exception 'إنت مش محرّر المشروع ده' using errcode = '42501';
    end if;
    if new.status <> 'draft' then
      raise exception 'النسخة الجديدة بتبدأ مسودة' using errcode = '23514';
    end if;
    new.created_by := coalesce(new.created_by, v_uid);
    return new;
  end if;

  -- UPDATE
  if new.project_id is distinct from old.project_id
     or new.version_no is distinct from old.version_no then
    raise exception 'النسخة مايتغيّرش ربطها ولا رقمها' using errcode = '42501';
  end if;
  if old.status in ('editor_approved', 'client_approved')
     and (new.body is distinct from old.body or new.source is distinct from old.source) then
    raise exception 'النص المعتمد مايتعدّلش — اعمل نسخة جديدة' using errcode = '42501';
  end if;
  if old.status = 'superseded' and new.status <> 'superseded' then
    raise exception 'نسخة قديمة اتستبدلت — مارجعتش' using errcode = '23514';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('editor_approved', 'client_approved')
       and not v_manage and v_project.editor_id is distinct from v_uid then
      raise exception 'اعتماد النص للمحرّر أو مسؤول الإنتاج' using errcode = '42501';
    end if;
    if new.status = 'editor_approved' then
      if old.status <> 'draft' then
        raise exception 'الاعتماد من مسودة بس' using errcode = '23514';
      end if;
      new.approved_by := coalesce(new.approved_by, v_uid);
      new.approved_at := coalesce(new.approved_at, now());
    elsif new.status = 'client_approved' then
      if old.status <> 'editor_approved' then
        raise exception 'موافقة العميل بعد اعتماد المحرّر' using errcode = '23514';
      end if;
      if coalesce(btrim(new.client_decision_note), '') = '' then
        raise exception 'سجّل إزاي ومتى العميل وافق' using errcode = '23514';
      end if;
      new.client_decision_at := coalesce(new.client_decision_at, now());
    elsif new.status = 'changes_requested' then
      if old.status not in ('draft', 'editor_approved') then
        raise exception 'طلب التعديل على مسودة أو نسخة معتمدة من المحرّر' using errcode = '23514';
      end if;
      new.client_decision_at := coalesce(new.client_decision_at, now());
    end if;
  end if;

  return new;
end;
$$;

create trigger story_version_guard_trg
  before insert or update on public.story_versions
  for each row execute function public.story_version_guard();


-- الصفحات: الكتابة في مراحل الرسم بس، والاعتماد للمشرف الفني.
create or replace function public.story_page_guard()
returns trigger
language plpgsql
set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_manage  boolean := auth.uid() is null or public.admin_has_permission('canManageStudio');
  v_project record;
  v_pid     uuid := coalesce(new.project_id, old.project_id);
begin
  select id, status, art_lead_id into v_project from story_projects where id = v_pid;
  if not found then
    -- الحذف المتتالي من المشروع نفسه.
    return coalesce(new, old);
  end if;

  if tg_op <> 'DELETE' then
    if v_project.status not in ('character', 'scenes', 'art_review', 'layout') and not v_manage then
      raise exception 'الصفحات بتتعدّل في مراحل الرسم بس (الحالة: %)', v_project.status using errcode = '23514';
    end if;
    if not v_manage and v_project.art_lead_id is distinct from v_uid then
      raise exception 'إنت مش المشرف الفني للمشروع ده' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception 'الصفحة مايتغيّرش مشروعها' using errcode = '42501';
    end if;
    new.updated_at := now();
    -- محتوى الصفحة المعتمدة بيرجع للمراجعة لو اتغيّر.
    if old.status = 'approved' and new.status = 'approved'
       and (new.page_text is distinct from old.page_text
         or new.scene_description is distinct from old.scene_description
         or new.image_url is distinct from old.image_url) then
      new.status := 'drafted';
    end if;
    if new.status = 'drafted' and old.status = 'needs_redo' then
      new.attempts := old.attempts + 1;
    end if;
  end if;

  if tg_op = 'INSERT' and new.status not in ('pending', 'drafted') then
    raise exception 'الصفحة الجديدة بتبدأ منتظرة أو مجهّزة' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger story_page_guard_trg
  before insert or update or delete on public.story_pages
  for each row execute function public.story_page_guard();


-- ── ٦) الإنشاء: تلقائي عند الدفع، ويدوي لمسؤول الإنتاج ─────────────────────

-- بند طلب مخصّص ← مشروع. مرة واحدة (on conflict). من غير صورة الطفل.
create or replace function public.story_create_project_for_item(p_order_item uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_item record;
  v_id   uuid;
begin
  select oi.id, oi.order_id, oi.product_id, oi.customization_data, pp.category
    into v_item
    from order_items oi
    join personalized_products pp on pp.id = oi.product_id
   where oi.id = p_order_item;
  if not found or v_item.category <> 'custom' then
    return null;
  end if;

  insert into story_projects (order_item_id, order_id, product_id, brief)
  values (
    v_item.id, v_item.order_id, v_item.product_id,
    case when jsonb_typeof(v_item.customization_data) = 'object'
         then v_item.customization_data - 'childPhoto'
         else '{}'::jsonb end
  )
  on conflict (order_item_id) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.story_create_project_for_item(uuid) from public, anon, authenticated;
grant execute on function public.story_create_project_for_item(uuid) to service_role;

-- إنشاء يدوي (طلبات اتدفعت قبل التشغيل، أو بند اتفوّت). مسؤول الإنتاج بس،
-- والطلب لازم يكون مدفوع، والاستوديو شغّال.
create or replace function public.story_start_project(p_order_item uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_id     uuid;
begin
  if not public.admin_has_permission('canManageStudio') then
    raise exception 'بدء مشروع لمسؤول الإنتاج فقط' using errcode = '42501';
  end if;
  if public.story_mode() <> 'on' then
    raise exception 'الاستوديو مقفول — شغّله من إعدادات الاستوديو' using errcode = '55000';
  end if;

  select o.status::text into v_status
    from order_items oi join orders o on o.id = oi.order_id
   where oi.id = p_order_item;
  if v_status is null then
    raise exception 'بند الطلب مش موجود' using errcode = '23503';
  end if;
  if v_status not in ('paid', 'preparing', 'shipped', 'delivered') then
    raise exception 'الطلب لسه ماتدفعش' using errcode = '23514';
  end if;

  v_id := public.story_create_project_for_item(p_order_item);
  if v_id is null then
    if exists (select 1 from story_projects where order_item_id = p_order_item) then
      raise exception 'فيه مشروع للبند ده بالفعل' using errcode = '23505';
    end if;
    raise exception 'البند ده مش منتج مخصّص' using errcode = '23514';
  end if;
  return v_id;
end;
$$;

revoke all on function public.story_start_project(uuid) from public, anon;
grant execute on function public.story_start_project(uuid) to authenticated, service_role;

-- عند الدفع: مشروع لكل بند مخصّص. **مايفشّلش الدفع أبدًا.**
create or replace function public.story_projects_on_paid()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'paid'
     and old.status::text is distinct from 'paid'
     and public.story_mode() = 'on' then
    begin
      perform public.story_create_project_for_item(oi.id)
         from order_items oi
        where oi.order_id = new.id;
    exception when others then
      raise warning 'story_projects_on_paid: order % — %', new.id, sqlerrm;
    end;
  end if;
  return null;
end;
$$;

revoke all on function public.story_projects_on_paid() from public, anon, authenticated;

create trigger story_projects_on_paid_trg
  after update of status on public.orders
  for each row execute function public.story_projects_on_paid();


-- ── ٧) الصلاحيات (RLS) ──────────────────────────────────────────────────────

alter table public.story_projects      enable row level security;
alter table public.story_versions      enable row level security;
alter table public.story_pages         enable row level security;
alter table public.story_cost_entries  enable row level security;

revoke all on public.story_projects, public.story_versions,
              public.story_pages, public.story_cost_entries from anon;
revoke truncate on public.story_projects, public.story_versions,
                   public.story_pages, public.story_cost_entries from authenticated;
-- مفيش حذف مباشر: المشروع بيتشال بحذف الطلب (cascade)، والنسخ بتتستبدل.
revoke delete on public.story_projects, public.story_versions from authenticated;
-- إنشاء المشروع من الدالتين بس.
revoke insert on public.story_projects from authenticated;

-- مشاريع
create policy "Studio staff read story projects" on public.story_projects
  for select to authenticated using (public.story_studio_access());
create policy "Studio staff update story projects" on public.story_projects
  for update to authenticated
  using (public.story_studio_access()) with check (public.story_studio_access());

-- نسخ النص
create policy "Studio staff read story versions" on public.story_versions
  for select to authenticated using (public.story_studio_access());
create policy "Studio staff add story versions" on public.story_versions
  for insert to authenticated with check (public.story_studio_access());
create policy "Studio staff update story versions" on public.story_versions
  for update to authenticated
  using (public.story_studio_access()) with check (public.story_studio_access());

-- صفحات
create policy "Studio staff read story pages" on public.story_pages
  for select to authenticated using (public.story_studio_access());
create policy "Studio staff add story pages" on public.story_pages
  for insert to authenticated with check (public.story_studio_access());
create policy "Studio staff update story pages" on public.story_pages
  for update to authenticated
  using (public.story_studio_access()) with check (public.story_studio_access());
create policy "Studio managers delete story pages" on public.story_pages
  for delete to authenticated using (public.admin_has_permission('canManageStudio'));

-- تكاليف: مسؤول الإنتاج أو المالية بس (المحرر مايشوفش أرقام).
create policy "Studio managers read story costs" on public.story_cost_entries
  for select to authenticated
  using (public.admin_has_permission('canManageStudio') or public.admin_has_permission('canManageFinance'));
create policy "Studio managers add story costs" on public.story_cost_entries
  for insert to authenticated
  with check (
    (public.admin_has_permission('canManageStudio') or public.admin_has_permission('canManageFinance'))
    and created_by = auth.uid()
  );
create policy "Studio managers delete story costs" on public.story_cost_entries
  for delete to authenticated
  using (public.admin_has_permission('canManageStudio') or public.admin_has_permission('canManageFinance'));
