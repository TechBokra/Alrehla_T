-- ═══════════════════════════════════════════════════════════════
-- المعاينة وموافقة العميل — نص العميل الناقص
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض
--   أكبر بند في دراسة المقارنة: ولي الأمر بيدفع ٨٥٠ جنيه وبعدها
--   مش شايف حاجة لحد ما الكتاب يوصل مطبوع. المنافس بيوريه النص
--   قبل الطباعة.
--
-- ── واللي لقيته وأنا بقرا ────────────────────────────────────
--
-- ⚠️ **الموديل موجود كله ومحروس — والناقص نص العميل بالكامل.**
--
--   • مرحلة `client_text_approval` («موافقة العميل على النص»)
--     موجودة في `task_steps` بين مراجعة النص والرسم.
--   • بوابة `text_client_approved` بتمنع بدء الرسم من غيرها.
--   • `story_versions` فيها `status = 'client_approved'` و
--     `client_decision_at` و`client_decision_note`.
--
--   يعني خط الإنتاج **بيستنى موافقة العميل فعلًا**. بس:
--
--   ١. صلاحيات `story_versions` للقراءة `story_studio_access()`
--      وبس — **فولي الأمر ماعندهوش ولا صف** (قاعدة «ك»: الرفض
--      بيرجع فاضي). مش شايف نص قصة ابنه.
--
--   ٢. والحارس `story_version_guard` بيقول بالحرف:
--        if new.status in ('editor_approved','client_approved')
--           and not v_manage and not story_is_worker(...) then
--             raise 'اعتماد النص للمحرّر أو مسؤول الإنتاج'
--      يعني **العميل ممنوع يوافق على نصّه**. الفريق هو اللي
--      بيحطّ علامة «وافق العميل».
--
--   فخانة اسمها `client_decision_at` بيملاها موظف، وولي الأمر
--   مش شايف اللي بيوافق عليه. الحارس بيطلب `client_decision_note`
--   («سجّل إزاي ومتى العميل وافق») — وده شرف من اللي كتبه، بس
--   سطر مكتوب بالإيد مش موافقة.
--
-- ── اللي الملف ده بيعمله ────────────────────────────────────
--
--   ١. `sent_to_client_at` + `sent_to_client_by`: الفريق بيبعت
--      النسخة لولي الأمر بخطوة صريحة. اعتماد المحرّر ≠ وصلت له.
--   ٢. `client_decision_by`: مين وافق فعلًا. من غيرها «موافقة
--      العميل» مجهولة الهوية ومافيش طريقة تعرف إن ولي الأمر هو
--      اللي عملها.
--   ٣. الحارس بقى يسمح **للمشتري** ينقل النسخة من
--      `editor_approved` لـ`client_approved` أو
--      `changes_requested` — وبس لو اتبعتت له.
--   ٤. `my_story_previews(p_order_id)`: القراءة لولي الأمر،
--      بدالة SECURITY DEFINER بترجّع الحقول اللي تخصّه بس — مش
--      بصلاحية واسعة على الجدول (نفس نمط `my_dependent_link`).
--   ٥. `story_preview_decide(...)`: قراره.
--
-- ── واللي **مش** بيعمله عن قصد ──────────────────────────────
--
-- ⚠️ **طلب التعديل مابيرجّعش المرحلة لوحده.** النسخة بتبقى
--    `changes_requested` والفريق بيشوفها وينقل المرحلة. السبب:
--    إرجاع المرحلة قرار إنتاج (مين المحرّر، والمواعيد تتعاد) —
--    وأي حد بياخده لازم يكون شايف المشروع. والبوابة
--    `text_client_approved` فاضلة مقفولة، فالرسم مش هيبدأ غلط.
--
-- ⚠️ **ومافيش حالة طلب جديدة في `order_status_enum`.** الدراسة
--    قالت تتضاف، ومااتضافتش. السبب: الـenum ده بيتفرّع عليه
--    `create_customer_order` وويبهوك الدفع وتلات شاشات إدارة —
--    وقيمة جديدة فيه بتطلب حالة في كل `switch` منهم، وأي واحد
--    يتنسى بيعرض حالة خام إنجليزي للعميل. حالة «مستني موافقتك»
--    بتتشتق من المشروع والنسخة، واللي بيقفل الرسم هو البوابة
--    مش اسم الحالة.
--
-- الأثر
--   • عمودين جداد على `story_versions` + عمود `client_decision_by`.
--     كلهم `null` للصفوف الموجودة (وهي صفر صف أصلًا).
--   • الحارس اتوسّع: اللي كان مسموح لسه مسموح. الزيادة إن
--     المشتري بقى يقدر ياخد قراره.
--   • تلات دوال جديدة. مفيش جدول اتغيّر ولا صف اتمسح.
--
-- الترتيب
--   بعد أي ملف استوديو. بيعتمد على: `story_versions`،
--   `story_projects`، `story_version_guard`، `orders`.
--
-- التحقق بعد التشغيل
--   1) الأعمدة موجودة:
--        select count(*) from information_schema.columns
--         where table_name='story_versions'
--           and column_name in ('sent_to_client_at','sent_to_client_by','client_decision_by');
--      ← 3
--
--   2) الدوال موجودة:
--        select count(*) from pg_proc
--         where proname in ('my_story_previews','story_preview_decide','story_version_send_to_client');
--      ← 3
--
--   3) الحارس فيه فرع المشتري:
--        select pg_get_functiondef(oid) ilike '%v_is_buyer%'
--          from pg_proc where proname='story_version_guard';
--      ← true
--
--   4) مفيش نسخ اتأثرت:
--        select count(*) from story_versions where client_decision_at is not null;
--      ← نفس الرقم قبل التشغيل (صفر دلوقتي)
--
-- الرجوع للخلف
--   drop function public.story_preview_decide(uuid, boolean, text);
--   drop function public.my_story_previews(uuid);
--   drop function public.story_version_send_to_client(uuid);
--   -- والحارس: شيل فقرة «فرع المشتري» وشغّل CREATE OR REPLACE.
--   -- الأعمدة سيبها: مفيش حاجة بتكسر بوجودها، وشيلها بيضيّع
--   -- أي قرار عميل اتسجّل.
-- ═══════════════════════════════════════════════════════════════

-- ── ١. الأعمدة ─────────────────────────────────────────────────

alter table public.story_versions
  add column if not exists sent_to_client_at  timestamptz,
  add column if not exists sent_to_client_by  uuid references public.user_profiles(id) on delete set null,
  add column if not exists client_decision_by uuid references public.user_profiles(id) on delete set null;

comment on column public.story_versions.sent_to_client_at is
  'إمتى الفريق بعت النسخة لولي الأمر. اعتماد المحرّر مش معناه إنها وصلته — والعميل مايقدرش يوافق على نسخة مااتبعتتش له.';
comment on column public.story_versions.client_decision_by is
  'مين أخد القرار فعلًا. لو = مشتري الطلب، فدي موافقة ولي الأمر نفسه؛ لو إداري، فهو سجّلها بالنيابة (والسبب لازم يكون في client_decision_note).';

-- ── ٢. مين مشتري الطلب بتاع المشروع ده ────────────────────────
--
-- ⚠️ دالة لوحدها عشان الحارس والدوال التلات يستعملوا **نفس**
--    التعريف. لو كل واحد كتب الاستعلام بنفسه، تعديل في واحد
--    مابيوصلش للباقي.

create or replace function public.story_project_buyer(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select o.user_id
    from public.story_projects sp
    join public.orders o on o.id = sp.order_id
   where sp.id = p_project_id
$$;

comment on function public.story_project_buyer(uuid) is
  'مشتري الطلب اللي المشروع ده تابع له — تعريف واحد يستعمله الحارس ودوال المعاينة.';

-- ── ٣. الحارس: المشتري بقى يقدر ياخد قراره ────────────────────

create or replace function public.story_version_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_uid       uuid := auth.uid();
  v_manage    boolean := auth.uid() is null or public.admin_has_permission('canManageStudio');
  v_project   record;
  v_abil      text[];
  v_is_buyer  boolean := false;
begin
  select id, status into v_project from story_projects where id = new.project_id;
  if not found then
    raise exception 'المشروع مش موجود' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    select abilities into v_abil from task_steps where line = 'studio' and step = v_project.status;
    if not ('text' = any (coalesce(v_abil, '{}'::text[]))) then
      raise exception 'النص بيتكتب في مراحل النص بس (الحالة: %)', v_project.status using errcode = '23514';
    end if;
    if not v_manage and not public.story_is_worker(v_project.id, v_uid) then
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

  -- ══ فرع المشتري ═════════════════════════════════════════════
  --
  -- ⚠️ ولي الأمر مش موظف ومش محرّر — فكل الفحوص تحت كانت بترفضه.
  --    هنا بنعرّفه، وبنسمح له بحاجة واحدة بالظبط: قراره على نسخة
  --    **اتبعتت له**. وأي عمود تاني بيلمسه = رفض، مش تجاهل.
  if not v_manage and v_uid is not null then
    v_is_buyer := public.story_project_buyer(v_project.id) = v_uid;
  end if;

  if v_is_buyer and not v_manage and not public.story_is_worker(v_project.id, v_uid) then
    if old.sent_to_client_at is null then
      raise exception 'النسخة دي مااتبعتتلكش للمعاينة' using errcode = '42501';
    end if;
    if old.status <> 'editor_approved' then
      raise exception 'النسخة دي مش جاهزة لقرارك' using errcode = '23514';
    end if;
    if new.status not in ('client_approved', 'changes_requested') then
      raise exception 'قرارك إما الموافقة أو طلب تعديل' using errcode = '23514';
    end if;
    -- ⚠️ **الأعمدة اللي بره قراره لازم تفضل زيّ ما هي.** من غير
    --    الفحص ده، نداء مباشر كان يقدر يعدّل نص القصة أو تاريخ
    --    الإرسال مع القرار في نفس التحديث.
    if new.body          is distinct from old.body
       or new.source     is distinct from old.source
       or new.note       is distinct from old.note
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at
       or new.created_by  is distinct from old.created_by
       or new.sent_to_client_at is distinct from old.sent_to_client_at
       or new.sent_to_client_by is distinct from old.sent_to_client_by then
      raise exception 'قرارك بيسجّل القرار وبس' using errcode = '42501';
    end if;
    new.client_decision_at := coalesce(new.client_decision_at, now());
    new.client_decision_by := v_uid;
    return new;
  end if;

  -- ══ إرسال النسخة للعميل ═════════════════════════════════════
  if new.sent_to_client_at is distinct from old.sent_to_client_at then
    if old.sent_to_client_at is not null then
      raise exception 'النسخة اتبعتت للعميل خلاص' using errcode = '23514';
    end if;
    if new.status <> 'editor_approved' then
      raise exception 'ابعت للعميل نسخة معتمدة من المحرّر' using errcode = '23514';
    end if;
    new.sent_to_client_by := coalesce(new.sent_to_client_by, v_uid);
  end if;

  if new.status is distinct from old.status then
    if new.status in ('editor_approved', 'client_approved')
       and not v_manage and not public.story_is_worker(v_project.id, v_uid) then
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
      -- ⚠️ الشرط ده هو اللي بيخلّي «وافق العميل» مش علامة مجرّدة:
      --    لو الفريق سجّلها بالنيابة، لازم يكتب إزاي ومتى. وولي
      --    الأمر اللي بيوافق من حسابه بياخد السطر ده تلقائيًا من
      --    `story_preview_decide`.
      if coalesce(btrim(new.client_decision_note), '') = '' then
        raise exception 'سجّل إزاي ومتى العميل وافق' using errcode = '23514';
      end if;
      new.client_decision_at := coalesce(new.client_decision_at, now());
      new.client_decision_by := coalesce(new.client_decision_by, v_uid);
    elsif new.status = 'changes_requested' then
      if old.status not in ('draft', 'editor_approved') then
        raise exception 'طلب التعديل على مسودة أو نسخة معتمدة من المحرّر' using errcode = '23514';
      end if;
      new.client_decision_at := coalesce(new.client_decision_at, now());
      new.client_decision_by := coalesce(new.client_decision_by, v_uid);
    end if;
  end if;

  return new;
end;
$function$;

-- ── ٤. القراءة لولي الأمر ──────────────────────────────────────
--
-- ⚠️ **دالة مش صلاحية.** صلاحية SELECT لولي الأمر على
--    `story_versions` كانت هتوريه كل أعمدة الصف — مين كتب، ومين
--    اعتمد، وملاحظات الفريق الداخلية. الدالة بترجّع اللي يخصّه
--    بس، وبترجّع **نص النسخة المبعوتة له وحدها**: المسودات اللي
--    الفريق لسه بيتناقش فيها مش بتاعته.

create or replace function public.my_story_previews(p_order_id uuid)
returns table (
  project_id         uuid,
  order_item_id      uuid,
  product_id         text,
  project_status     text,
  version_id         uuid,
  version_no         integer,
  body               text,
  version_status     text,
  sent_at            timestamptz,
  decision_at        timestamptz,
  decision_note      text,
  decided_by_me      boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    sp.id,
    sp.order_item_id,
    sp.product_id,
    sp.status,
    sv.id,
    sv.version_no,
    sv.body,
    sv.status,
    sv.sent_to_client_at,
    sv.client_decision_at,
    sv.client_decision_note,
    sv.client_decision_by = auth.uid()
  from public.story_projects sp
  join public.orders o   on o.id = sp.order_id
  join public.story_versions sv on sv.project_id = sp.id
 where o.id = p_order_id
   and o.user_id = auth.uid()
   and auth.uid() is not null
   and sv.sent_to_client_at is not null
 order by sp.order_item_id, sv.version_no desc
$$;

comment on function public.my_story_previews(uuid) is
  'معاينات ولي الأمر لطلبه: النسخ اللي اتبعتت له وحدها، وبالحقول اللي تخصّه. أي طلب مش بتاعه بيرجّع صفر صفوف.';

-- ── ٥. قرار ولي الأمر ──────────────────────────────────────────

create or replace function public.story_preview_decide(
  p_version_id uuid,
  p_approve    boolean,
  p_note       text default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_project uuid;
  v_sent    timestamptz;
  v_status  text;
  v_note    text;
begin
  if auth.uid() is null then
    raise exception 'لازم تسجّل الدخول' using errcode = '42501';
  end if;

  select project_id, sent_to_client_at, status
    into v_project, v_sent, v_status
    from public.story_versions where id = p_version_id;

  -- ⚠️ نفس الرسالة للنسخة المش موجودة وللنسخة المش بتاعته: الفرق
  --    بينهم بيقول لأي حد إن الرقم ده موجود في النظام.
  if not found or public.story_project_buyer(v_project) is distinct from auth.uid() then
    raise exception 'المعاينة دي مش على طلبك' using errcode = '42501';
  end if;
  if v_sent is null then
    raise exception 'النسخة دي مااتبعتتلكش للمعاينة' using errcode = '42501';
  end if;
  if v_status <> 'editor_approved' then
    raise exception 'المعاينة دي مش مستنية قرارك' using errcode = '23514';
  end if;

  if p_approve then
    -- السطر اللي الحارس بيطلبه — بييجي من النظام مش من موظف.
    v_note := 'وافق ولي الأمر من حسابه على الموقع';
    if coalesce(btrim(p_note), '') <> '' then
      v_note := v_note || ' — ' || left(btrim(p_note), 500);
    end if;
    update public.story_versions
       set status = 'client_approved', client_decision_note = v_note
     where id = p_version_id;
    return 'approved';
  end if;

  if coalesce(btrim(p_note), '') = '' then
    raise exception 'اكتب عايز نعدّل إيه بالظبط' using errcode = '23514';
  end if;

  update public.story_versions
     set status = 'changes_requested',
         client_decision_note = 'طلب ولي الأمر تعديل: ' || left(btrim(p_note), 500)
   where id = p_version_id;
  return 'changes_requested';
end;
$function$;

comment on function public.story_preview_decide(uuid, boolean, text) is
  'قرار ولي الأمر على معاينة نص قصة ابنه. بترفض أي نسخة مش على طلبه أو مااتبعتتش له. الحارس story_version_guard هو اللي بيفرض باقي القواعد.';

-- ── ٦. الفريق بيبعت النسخة ─────────────────────────────────────
--
-- ⚠️ ليه دالة والفريق عنده صلاحية UPDATE؟ عشان الإشعار والوقت
--    يتسجّلوا مرة واحدة، وعشان الشاشة تاخد سببًا واضحًا لو
--    الإرسال ماينفعش (نسخة مش معتمدة، أو اتبعتت خلاص) بدل
--    رسالة صلاحيات عامة.

create or replace function public.story_version_send_to_client(p_version_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_at timestamptz := now();
begin
  update public.story_versions
     set sent_to_client_at = v_at, sent_to_client_by = auth.uid()
   where id = p_version_id;

  -- ⚠️ قاعدة «و»: التحديث على صفر صفوف **بينجح**. من غير السطر ده
  --    الشاشة كانت بتقول «اتبعتت» والعميل مش شايف حاجة.
  if not found then
    raise exception 'النسخة دي مش موجودة أو مش من حقك' using errcode = '42501';
  end if;
  return v_at;
end;
$function$;

comment on function public.story_version_send_to_client(uuid) is
  'بيبعت نسخة نص معتمدة لولي الأمر يعاينها. SECURITY INVOKER عن قصد: صلاحيات الاستوديو والحارس هما اللي بيقرّروا.';
