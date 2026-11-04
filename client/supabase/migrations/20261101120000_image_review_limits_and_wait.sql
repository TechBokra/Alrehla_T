-- ═══════════════════════════════════════════════════════════════
-- صورة البطل: تعديلين بس بأسباب + انتظار العميل بيأخّر الموعد فعلًا
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — طلب تامر (١ نوفمبر):
--   ١) «بيسمح له بطلب التعديل مرتين فقط مع أسباب».
--      ← عمود `client_reasons` (أسباب من قايمة ثابتة) + حد أقصى طلبين
--        تعديل لكل مشروع. بعدهم: موافقة، أو كلام مع الدعم.
--   ٢) «تأخذ من الوقت وتأخر وقت التسليم كل ما المستخدم أو ولي الأمر
--      اتأخر في الرد».
--      ← كان الميعاد بيتأخر **في الشاشة بس** (للعميل). دلوقتي لما العميل
--        يقرّر، مدة انتظاره بتتضاف على:
--          • موعد تسليم المشروع (`story_projects.due_at`)
--          • موعد المرحلة المفتوحة للفريق (`work_tasks.due_at`، خط studio)
--        فالفريق مابيتحسبش متأخر بسبب انتظار العميل.
--
-- ⚠️ حارس المشروع بيقصر تغيير `due_at` على مسؤول الإنتاج. اتفتح له
--    استثناء **واحد**: إشارة داخلية بتتحط جوّه `story_image_decide` بس
--    (set_config محلي للمعاملة)، ولعمود الموعد بس — التوزيع لأ.
--
-- الأثر:
--   - story_image_reviews: + client_reasons text[]
--   - story_image_decide: + p_reasons، حد التعديلين، تمديد المواعيد
--     (التوقيع القديم بـ٣ معاملات اتشال؛ النداء بالأسماء بيشتغل زي ما هو)
--   - story_project_guard: استثناء الموعد من جوّه دالة القرار بس
-- الترتيب: بعد `20261025090000_image_review_and_delivery_days`.
-- التحقق:
--   select pg_get_function_arguments('public.story_image_decide'::regproc);
--     ← … p_reasons text[] DEFAULT NULL
--   select prosrc ilike '%alrehla.client_wait%' from pg_proc where proname = 'story_project_guard'; ← true
-- الرجوع:
--   تشغيل نسخة story_image_decide من `20261025090000_...`
--   والحارس: نفس الـreplace بالعكس (السطر عليه تعليق).
-- ═══════════════════════════════════════════════════════════════

alter table public.story_image_reviews
  add column if not exists client_reasons text[];

-- ── الحارس: الموعد يتمدّد من دالة القرار بس ──────────────────
do $$
declare
  v_def text;
  v_old text := 'or new.due_at is distinct from old.due_at';
  v_new text := 'or (new.due_at is distinct from old.due_at and coalesce(current_setting(''alrehla.client_wait'', true), '''') <> ''on'') -- انتظار العميل (20261101120000)';
begin
  select pg_get_functiondef('public.story_project_guard'::regproc) into v_def;
  if position('alrehla.client_wait' in v_def) > 0 then
    raise notice 'story_project_guard: already patched';
  elsif position(v_old in v_def) = 0 then
    raise exception 'story_project_guard: النص المتوقع مش موجود — مااتعدّلش';
  else
    execute replace(v_def, v_old, v_new);
  end if;
end $$;

-- ── القرار ───────────────────────────────────────────────────
drop function if exists public.story_image_decide(uuid, boolean, text);

create or replace function public.story_image_decide(
  p_review_id uuid,
  p_approve   boolean,
  p_note      text default null,
  p_reasons   text[] default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_r       record;
  v_note    text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_reasons text[];
  v_used    integer;
  v_wait    interval;
begin
  if v_uid is null then
    raise exception 'لازم تسجّل الدخول' using errcode = '42501';
  end if;

  select r.id, r.status, r.image_url, r.project_id, r.sent_at, sp.character_approved_at, o.user_id
    into v_r
    from public.story_image_reviews r
    join public.story_projects sp on sp.id = r.project_id
    join public.orders o on o.id = sp.order_id
   where r.id = p_review_id
     for update of r;

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

  if not p_approve then
    select count(*) into v_used
      from public.story_image_reviews
     where project_id = v_r.project_id and status = 'changes_requested';
    if v_used >= 2 then
      raise exception 'استخدمت طلبي التعديل المتاحين. وافق على الصورة، أو كلّمنا من صفحة الدعم لو فيه مشكلة.'
        using errcode = '23514';
    end if;

    select array_agg(distinct x order by x) into v_reasons
      from unnest(coalesce(p_reasons, '{}'::text[])) x
     where x in ('face', 'hair', 'skin', 'clothes', 'age', 'accessories', 'other');
    if coalesce(cardinality(v_reasons), 0) = 0 then
      raise exception 'اختار سبب التعديل' using errcode = '23514';
    end if;
    if v_note is null then
      raise exception 'اكتب عايز نعدّل إيه في الصورة' using errcode = '23514';
    end if;
  end if;

  update public.story_image_reviews
     set status         = case when p_approve then 'approved' else 'changes_requested' end,
         decided_at     = now(),
         decided_by     = v_uid,
         client_note    = v_note,
         client_reasons = case when p_approve then null else v_reasons end
   where id = p_review_id;

  -- مدة انتظار العميل بتتضاف على مواعيد الفريق (المشروع والمرحلة المفتوحة).
  v_wait := now() - v_r.sent_at;
  if v_wait > interval '0' then
    perform set_config('alrehla.client_wait', 'on', true);
    update public.story_projects
       set due_at = due_at + v_wait
     where id = v_r.project_id and due_at is not null;
    perform set_config('alrehla.client_wait', '', true);

    update public.work_tasks
       set due_at = due_at + v_wait
     where line = 'studio' and source_id = v_r.project_id::text
       and status = 'open' and due_at is not null;
  end if;

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
end $function$;

revoke execute on function public.story_image_decide(uuid, boolean, text, text[]) from public, anon;
grant execute on function public.story_image_decide(uuid, boolean, text, text[]) to authenticated;
