-- ═══════════════════════════════════════════════════════════════
-- التأهيل التأسيسي الذاتي للمدربين — جوّه الموقع
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — طلب تامر (٢٤ أكتوبر):
--   «عايز أستفيد من ملف التأهيل (AlRehla_Foundation_Self_Paced_Training_v5)
--    وبدل ما هو منفصل نخليه داخل الموقع ومرتبط بملف المدربين ولوحة التحكم».
--
-- ── ليه جوّه القاعدة مش ملف ─────────────────────────────────
--
--   الملف المنفصل بيحفظ التقدّم على متصفح المدرب، والإجابات الصحيحة
--   جوّه الملف نفسه، والنتيجة بتوصل بإيميل يدوي — والملف نفسه بيقول
--   «نتيجة ملف محلي قابلة للتعديل». هنا:
--     • المحتوى في `training_courses` — والإجابات الصحيحة **مابتوصلش
--       للمدرب**: الدالة اللي بتديله المحتوى بتشيلها، والتصحيح على
--       الخادم.
--     • التقدّم والمحاولات متسجّلين باسم حسابه — الإدارة بتشوفهم في
--       ملف المدرب من غير إيميل.
--
-- ── اللي بيتعمل ─────────────────────────────────────────────
--
--   ١) `training_courses`: الدورة (المحتوى + إعدادات النجاح). القراءة
--      والتعديل للإدارة بس (`canManageInstructors`).
--   ٢) `training_progress`: تقدّم كل مدرب (الوحدات، الوقت، تاريخ الاجتياز).
--   ٣) `training_final_attempts`: كل محاولة للتقييم النهائي.
--   ٤) دوال:
--        training_course_for_me(course)            المحتوى من غير الإجابات
--        training_start(course)                    أول فتح
--        training_heartbeat(course, seconds)       وقت الدراسة الفعلي
--        training_submit_module(course, i, answers) تصحيح اختبار وحدة
--        training_submit_final(course, answers)     تصحيح التقييم النهائي
--        training_reset_progress(user, course)      الإدارة: إعادة التأهيل
--   ٥) المحتوى الأول: نسخة الملف v5 (الإصدار 1.2) — ٦ وحدات، ١٨ سؤال
--      وحدات، ٢٠ سؤال نهائي (٤ حرجة).
--
-- ⚠️ **اجتياز التأهيل مش اعتماد.** الملف نفسه بيقول «لا يمنح اعتمادًا
--    نهائيًا لتقديم الجلسات». فـ`instructors.training_passed` (قرار
--    الإدارة بعد التدريب العملي) **مابيتلمسش** هنا. الموقع بيستعمل
--    النتيجة كخطوة قبل التفعيل لو `required_for_activation`.
--
-- الأثر
--   • ٣ جداول جديدة + ٦ دوال. مفيش جدول قديم بيتغيّر، ومفيش صف بيتمسح.
--
-- الترتيب
--   بعد `20261025090000_image_review_and_delivery_days` (مش معتمد عليه).
--
-- التحقق
--   1) select id, version, jsonb_array_length(content->'modules'),
--             jsonb_array_length(content->'finalQuestions') from training_courses;
--        ← foundation | 1.2 | 6 | 20
--   2) select count(*) from pg_proc where proname like 'training\_%';  ← 6 (أو أكتر)
--
-- الرجوع للخلف
--   drop function if exists public.training_reset_progress(uuid, text);
--   drop function if exists public.training_submit_final(text, jsonb);
--   drop function if exists public.training_submit_module(text, integer, jsonb);
--   drop function if exists public.training_heartbeat(text, integer);
--   drop function if exists public.training_start(text);
--   drop function if exists public.training_course_for_me(text);
--   -- الجداول سيبها: فيها نتايج المدربين.
-- ═══════════════════════════════════════════════════════════════

-- ── ١) الدورة ───────────────────────────────────────────────
create table if not exists public.training_courses (
  id                      text primary key,
  title                   text not null,
  version                 text not null,
  content                 jsonb not null check (
                            jsonb_typeof(content -> 'modules') = 'array'
                            and jsonb_array_length(content -> 'modules') > 0
                            and jsonb_typeof(content -> 'finalQuestions') = 'array'
                            and jsonb_array_length(content -> 'finalQuestions') > 0
                          ),
  module_pass_pct         smallint not null default 67 check (module_pass_pct between 1 and 100),
  final_pass_pct          smallint not null default 85 check (final_pass_pct between 1 and 100),
  critical_required       boolean not null default true,
  required_for_activation boolean not null default true,
  is_active               boolean not null default true,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references public.user_profiles(id) on delete set null
);

comment on table public.training_courses is
  'دورات التأهيل الذاتي للمدربين. content فيه الإجابات الصحيحة — القراءة للإدارة بس، والمدرب بياخد المحتوى من training_course_for_me.';

create index if not exists training_courses_updated_by_fkidx on public.training_courses (updated_by);

-- ── ٢) التقدّم ───────────────────────────────────────────────
create table if not exists public.training_progress (
  user_id         uuid not null references public.user_profiles(id) on delete cascade,
  course_id       text not null references public.training_courses(id) on delete cascade,
  started_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  active_seconds  integer not null default 0 check (active_seconds >= 0),
  -- {"0": {"attempts":2,"lastScore":2,"bestScore":3,"passedAt":"..."}, ...}
  modules         jsonb not null default '{}'::jsonb,
  final_attempts  integer not null default 0,
  best_score      smallint,
  passed_at       timestamptz,
  passed_version  text,
  reset_at        timestamptz,
  primary key (user_id, course_id)
);

create index if not exists training_progress_course_id_fkidx on public.training_progress (course_id);

-- ── ٣) محاولات التقييم النهائي ──────────────────────────────
create table if not exists public.training_final_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.user_profiles(id) on delete cascade,
  course_id        text not null references public.training_courses(id) on delete cascade,
  course_version   text not null,
  selected         jsonb not null,
  correct          smallint not null,
  total            smallint not null,
  score            smallint not null,
  critical_correct smallint not null,
  critical_total   smallint not null,
  passed           boolean not null,
  submitted_at     timestamptz not null default now()
);

create index if not exists training_final_attempts_user_idx
  on public.training_final_attempts (user_id, course_id, submitted_at desc);
create index if not exists training_final_attempts_course_id_fkidx on public.training_final_attempts (course_id);

-- ── الصلاحيات ───────────────────────────────────────────────
alter table public.training_courses        enable row level security;
alter table public.training_progress       enable row level security;
alter table public.training_final_attempts enable row level security;

revoke all on table public.training_courses, public.training_progress, public.training_final_attempts
  from public, anon, authenticated;
grant select, update on table public.training_courses to authenticated;
grant select on table public.training_progress, public.training_final_attempts to authenticated;

drop policy if exists training_courses_admin_read on public.training_courses;
create policy training_courses_admin_read on public.training_courses
  for select to authenticated
  using ((select public.admin_has_permission('canManageInstructors')));

drop policy if exists training_courses_admin_update on public.training_courses;
create policy training_courses_admin_update on public.training_courses
  for update to authenticated
  using ((select public.admin_has_permission('canManageInstructors')))
  with check ((select public.admin_has_permission('canManageInstructors')));

drop policy if exists training_progress_read on public.training_progress;
create policy training_progress_read on public.training_progress
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.admin_has_permission('canManageInstructors')));

drop policy if exists training_final_attempts_read on public.training_final_attempts;
create policy training_final_attempts_read on public.training_final_attempts
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.admin_has_permission('canManageInstructors')));

-- ── مين يدرس ────────────────────────────────────────────────
-- المدرب (صف في instructors) — والإدارة بتعاين من غير ما يتسجّل لها تقدّم.
create or replace function public.training_is_learner(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_uid is not null and exists (select 1 from public.instructors i where i.user_id = p_uid)
$$;
revoke execute on function public.training_is_learner(uuid) from public, anon, authenticated;

-- ── ٤أ) المحتوى من غير الإجابات ─────────────────────────────
create or replace function public.training_course_for_me(p_course text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_c   public.training_courses%rowtype;
  v_p   public.training_progress%rowtype;
begin
  if not (public.training_is_learner(v_uid) or public.admin_has_permission('canManageInstructors')) then
    raise exception 'التأهيل للمدربين بس' using errcode = '42501';
  end if;

  select * into v_c from public.training_courses where id = p_course and is_active;
  if not found then
    return null;
  end if;

  select * into v_p from public.training_progress where user_id = v_uid and course_id = p_course;

  return jsonb_build_object(
    'id', v_c.id,
    'title', v_c.title,
    'version', v_c.version,
    'modulePassPct', v_c.module_pass_pct,
    'finalPassPct', v_c.final_pass_pct,
    'criticalRequired', v_c.critical_required,
    'criticalTotal', (select count(*) from jsonb_array_elements(v_c.content -> 'finalQuestions') q
                       where coalesce((q ->> 'critical')::boolean, false)),
    'topics', coalesce(v_c.content -> 'topics', '[]'::jsonb),
    'modules', (
      select jsonb_agg(
               (m - 'questions') || jsonb_build_object('questions',
                 coalesce((select jsonb_agg(q - 'correct' - 'why' order by qo)
                             from jsonb_array_elements(m -> 'questions') with ordinality qq(q, qo)), '[]'::jsonb))
               order by mo)
        from jsonb_array_elements(v_c.content -> 'modules') with ordinality mm(m, mo)
    ),
    'finalQuestions', (
      select jsonb_agg(q - 'correct' - 'why' - 'critical' order by qo)
        from jsonb_array_elements(v_c.content -> 'finalQuestions') with ordinality qq(q, qo)
    ),
    'progress', case when v_p.user_id is null then null else jsonb_build_object(
      'startedAt', v_p.started_at,
      'activeSeconds', v_p.active_seconds,
      'modules', v_p.modules,
      'finalAttempts', v_p.final_attempts,
      'bestScore', v_p.best_score,
      'passedAt', v_p.passed_at,
      'passedVersion', v_p.passed_version
    ) end,
    'learner', public.training_is_learner(v_uid)
  );
end $$;

-- ── ٤ب) أول فتح ─────────────────────────────────────────────
create or replace function public.training_start(p_course text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.training_is_learner(auth.uid()) then
    return; -- الإدارة بتعاين بس
  end if;
  if not exists (select 1 from public.training_courses where id = p_course and is_active) then
    raise exception 'الدورة مش متاحة' using errcode = '23503';
  end if;
  insert into public.training_progress (user_id, course_id)
  values (auth.uid(), p_course)
  on conflict (user_id, course_id) do nothing;
end $$;

-- ── ٤ج) وقت الدراسة ─────────────────────────────────────────
-- ⚠️ الوقت بيتحسب من السيرفر: أقصى ٢ دقيقة للنداء، ومش أكتر من اللي
--    عدّى فعلًا من آخر نداء — فمحدش يقدر يزوّد وقته بنداءات متكررة.
create or replace function public.training_heartbeat(p_course text, p_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.training_progress
     set active_seconds = active_seconds + least(
           greatest(coalesce(p_seconds, 0), 0),
           120,
           greatest(floor(extract(epoch from now() - last_seen_at))::int, 0)
         ),
         last_seen_at = now()
   where user_id = auth.uid() and course_id = p_course;
end $$;

-- ── ٤د) اختبار الوحدة ───────────────────────────────────────
create or replace function public.training_submit_module(p_course text, p_module integer, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_learner boolean := public.training_is_learner(v_uid);
  v_c       public.training_courses%rowtype;
  v_qs      jsonb;
  v_n       integer;
  v_q       jsonb;
  v_sel     integer;
  v_cor     integer;
  v_rows    jsonb := '[]'::jsonb;
  v_score   integer := 0;
  v_passed  boolean;
  v_key     text := p_module::text;
  v_prev    jsonb;
begin
  if not (v_learner or public.admin_has_permission('canManageInstructors')) then
    raise exception 'التأهيل للمدربين بس' using errcode = '42501';
  end if;
  select * into v_c from public.training_courses where id = p_course and is_active;
  if not found then
    raise exception 'الدورة مش متاحة' using errcode = '23503';
  end if;

  v_qs := v_c.content -> 'modules' -> p_module -> 'questions';
  if v_qs is null or jsonb_typeof(v_qs) <> 'array' then
    raise exception 'الوحدة مش موجودة' using errcode = '23503';
  end if;
  v_n := jsonb_array_length(v_qs);
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> v_n then
    raise exception 'أجب عن كل الأسئلة قبل التصحيح' using errcode = '23514';
  end if;

  for i in 0 .. v_n - 1 loop
    v_q   := v_qs -> i;
    v_sel := case when jsonb_typeof(p_answers -> i) = 'number' then (p_answers ->> i)::int end;
    if v_sel is null then
      raise exception 'أكمل السؤال رقم % قبل التصحيح', i + 1 using errcode = '23514';
    end if;
    v_cor := (v_q ->> 'correct')::int;
    if v_sel = v_cor then v_score := v_score + 1; end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'correct', v_sel = v_cor,
      'selected', v_sel,
      'right', v_q -> 'opts' ->> v_cor,
      'why', v_q ->> 'why'
    ));
  end loop;

  v_passed := v_score * 100 >= v_c.module_pass_pct * v_n;

  if v_learner then
    insert into public.training_progress (user_id, course_id) values (v_uid, p_course)
    on conflict (user_id, course_id) do nothing;

    select modules -> v_key into v_prev from public.training_progress
     where user_id = v_uid and course_id = p_course;

    update public.training_progress
       set modules = jsonb_set(modules, array[v_key], jsonb_build_object(
             'attempts',  coalesce((v_prev ->> 'attempts')::int, 0) + 1,
             'lastScore', v_score,
             'bestScore', greatest(coalesce((v_prev ->> 'bestScore')::int, 0), v_score),
             'total',     v_n,
             -- ⚠️ `null` جوّه JSON مش NULL — فـcoalesce ماينفعش هنا.
             'passedAt',  case when jsonb_typeof(v_prev -> 'passedAt') = 'string' then v_prev -> 'passedAt'
                               when v_passed then to_jsonb(now())
                               else 'null'::jsonb end
           ), true),
           last_seen_at = now()
     where user_id = v_uid and course_id = p_course;
  end if;

  return jsonb_build_object('score', v_score, 'total', v_n, 'passed', v_passed, 'rows', v_rows);
end $$;

-- ── ٤هـ) التقييم النهائي ────────────────────────────────────
create or replace function public.training_submit_final(p_course text, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_learner  boolean := public.training_is_learner(v_uid);
  v_c        public.training_courses%rowtype;
  v_p        public.training_progress%rowtype;
  v_qs       jsonb;
  v_n        integer;
  v_mods     integer;
  v_q        jsonb;
  v_sel      integer;
  v_cor      integer;
  v_ok       boolean;
  v_crit     boolean;
  v_rows     jsonb := '[]'::jsonb;
  v_selected jsonb := '{}'::jsonb;
  v_correct  integer := 0;
  v_cc       integer := 0;
  v_ct       integer := 0;
  v_score    integer;
  v_passed   boolean;
  v_id       uuid;
begin
  if not (v_learner or public.admin_has_permission('canManageInstructors')) then
    raise exception 'التأهيل للمدربين بس' using errcode = '42501';
  end if;
  select * into v_c from public.training_courses where id = p_course and is_active;
  if not found then
    raise exception 'الدورة مش متاحة' using errcode = '23503';
  end if;

  v_mods := jsonb_array_length(v_c.content -> 'modules');
  if v_learner then
    select * into v_p from public.training_progress where user_id = v_uid and course_id = p_course;
    if v_p.user_id is null
       or (select count(*) from jsonb_each(v_p.modules) e
            where e.key ~ '^\d+$' and e.key::int < v_mods
              and jsonb_typeof(e.value -> 'passedAt') = 'string') < v_mods then
      raise exception 'أكمل اختبارات الوحدات كلها الأول' using errcode = '23514';
    end if;
  end if;

  v_qs := v_c.content -> 'finalQuestions';
  v_n  := jsonb_array_length(v_qs);
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> v_n then
    raise exception 'أجب عن كل الأسئلة قبل التسليم' using errcode = '23514';
  end if;

  for i in 0 .. v_n - 1 loop
    v_q   := v_qs -> i;
    v_sel := case when jsonb_typeof(p_answers -> i) = 'number' then (p_answers ->> i)::int end;
    if v_sel is null then
      raise exception 'لم تُجب عن السؤال رقم % بعد', i + 1 using errcode = '23514';
    end if;
    v_cor  := (v_q ->> 'correct')::int;
    v_ok   := v_sel = v_cor;
    v_crit := coalesce((v_q ->> 'critical')::boolean, false);
    if v_ok then v_correct := v_correct + 1; end if;
    if v_crit then
      v_ct := v_ct + 1;
      if v_ok then v_cc := v_cc + 1; end if;
    end if;
    v_selected := v_selected || jsonb_build_object(coalesce(v_q ->> 'id', i::text), v_sel);
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'id', v_q ->> 'id',
      'topic', v_q ->> 'topic',
      'correct', v_ok,
      'critical', v_crit,
      'selected', v_sel,
      'right', v_q -> 'opts' ->> v_cor,
      'why', v_q ->> 'why'
    ));
  end loop;

  v_score  := round(v_correct * 100.0 / v_n);
  v_passed := v_score >= v_c.final_pass_pct and (not v_c.critical_required or v_cc = v_ct);

  if v_learner then
    insert into public.training_final_attempts
      (user_id, course_id, course_version, selected, correct, total, score, critical_correct, critical_total, passed)
    values (v_uid, p_course, v_c.version, v_selected, v_correct, v_n, v_score, v_cc, v_ct, v_passed)
    returning id into v_id;

    update public.training_progress
       set final_attempts = final_attempts + 1,
           best_score     = greatest(coalesce(best_score, 0), v_score),
           passed_at      = coalesce(passed_at, case when v_passed then now() end),
           passed_version = case when passed_at is null and v_passed then v_c.version else passed_version end,
           last_seen_at   = now()
     where user_id = v_uid and course_id = p_course;
  end if;

  return jsonb_build_object(
    'attemptId', v_id,
    'score', v_score, 'correct', v_correct, 'total', v_n,
    'criticalCorrect', v_cc, 'criticalTotal', v_ct,
    'passed', v_passed, 'passPct', v_c.final_pass_pct,
    'rows', v_rows
  );
end $$;

-- ── ٤و) الإدارة: إعادة التأهيل ──────────────────────────────
-- ⚠️ مابيمسحش المحاولات القديمة — بيرجّع الوحدات والاجتياز بس، والتاريخ
--    بيفضل في `training_final_attempts` و`reset_at`.
create or replace function public.training_reset_progress(p_user uuid, p_course text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_has_permission('canManageInstructors') then
    raise exception 'للإدارة بس' using errcode = '42501';
  end if;
  update public.training_progress
     set modules = '{}'::jsonb, passed_at = null, passed_version = null, reset_at = now()
   where user_id = p_user and course_id = p_course;
end $$;

revoke execute on function public.training_course_for_me(text)                  from public, anon;
revoke execute on function public.training_start(text)                          from public, anon;
revoke execute on function public.training_heartbeat(text, integer)             from public, anon;
revoke execute on function public.training_submit_module(text, integer, jsonb)  from public, anon;
revoke execute on function public.training_submit_final(text, jsonb)            from public, anon;
revoke execute on function public.training_reset_progress(uuid, text)           from public, anon;
grant execute on function public.training_course_for_me(text)                  to authenticated;
grant execute on function public.training_start(text)                          to authenticated;
grant execute on function public.training_heartbeat(text, integer)             to authenticated;
grant execute on function public.training_submit_module(text, integer, jsonb)  to authenticated;
grant execute on function public.training_submit_final(text, jsonb)            to authenticated;
grant execute on function public.training_reset_progress(uuid, text)           to authenticated;

-- ── ٥) المحتوى الأول: ملف التأهيل v5 (الإصدار 1.2) ──────────
-- ⚠️ `on conflict do nothing`: لو الإدارة رفعت نسخة أحدث، تشغيل الملف تاني
--    مابيرجّعهاش للقديمة.
insert into public.training_courses (id, title, version, content)
values (
  'foundation',
  'التأهيل التأسيسي لميسّري «بداية الرحلة»',
  '1.2',
  $seed$
{"modules":[{"title":"التعرّف إلى «بداية الرحلة»","subtitle":"ما الذي نُيسّره، وما الذي لا نعد به؟","tag":"الهوية","goal":"أن تميّز التجربة التربوية من درس الكتابة التقليدي، وأن تقرأ الإنجاز في ضوء ما عاشه المشارك.","pages":[{"title":"ابدأ من تعريف البرنامج","paragraphs":["«بداية الرحلة» تجربة تربوية آمنة تتخذ من الكتابة وسيلة تساعد المشارك على اكتشاف ذاته، والتعبير عنها، وبناء علاقة واعية وقابلة للاستمرار مع الكتابة.","أنت لا تدخل الجلسة لتصنع كاتبًا أو لتحصل على نص مثالي. أنت تهيّئ خبرة مقصودة يستطيع المشارك خلالها أن يلاحظ ويتخيل ويفكر ويختار ويجرب ويعود إلى ما كتب. قد يتعلم في هذه الرحلة مهارات أدبية ولغوية حقيقية؛ لكن الأدوات تُعلَّم في خدمة ما يريد المشارك قوله، لا لتجعل صوته نسخة من صوتك.","تستقبل «بداية الرحلة» مشاركين باختلاف أعمارهم. استخدم كلمة «المشارك» تسمية جامعة، وتذكر أن أساليب المساندة تختلف من شخص لآخر؛ لا تجعل العمر وحده حكمًا على قدراته."],"cards":[["تجربة تربوية","لا يكفي اختيار نشاط جذاب؛ اسأل عمّا سيتاح للمشارك أن يفعله ويتعلمه بنفسه."],["تجربة آمنة","للمشارك كرامته وصوته وحقه في الرفض والصمت وعدم مشاركة ما لا يرغب فيه."]],"note":"السؤال الأول في تخطيطك: ما الخبرة التي سيعيشها المشارك، لا ما النص الذي سأحصل عليه؟"},{"title":"الكتابة وسيلة... ومهارة أيضًا","paragraphs":["حين تتحول فكرة إلى كلمات أو رسم أو مخطط، تصبح مرئية وقابلة للتأمل والمراجعة. تسمح الكتابة بالتوقف وتغيير الرأي واختبار البدائل، وتترك أثرًا يمكن العودة إليه لاحقًا. وقد يبدأ المشارك بكلمة، أو جملة، أو خريطة أفكار، أو رسم يرافقه حديث، قبل أن يكتب نصًا أطول.","لا يلزم أن تنتهي كل جلسة بقصة مكتملة. ربما كان الإنجاز اكتشاف بداية، أو اختيار فكرة من عدة احتمالات، أو مراجعة جملة، أو استخدام أداة جديدة. لكن تجنّب استنتاج أن النص الجميل بلا قيمة؛ اقرأ جودة العمل إلى جانب مصدر الفكرة، ومقدار مساعدتك، وما فعله المشارك بنفسه.","ولا تفترض أن الكتابة ينبغي أن تكون شخصية أو عاطفية. يستطيع المشارك أن يكتب عن عالم خيالي بعيد عنه، أو يحتفظ بنصه لنفسه؛ فالخيال ليس بابًا خفيًا لاستجوابه عن حياته."],"cards":[["ليست ورشة لإنتاج نصوص","المنتج مهم، لكن ليس وحده مقياس قيمة المحاولة."],["وليست درسًا خاليًا من المهارات","تعلّم أدوات توليد الأفكار والوصف والتنظيم والمراجعة حين تخدم غرض المشارك."]],"scenario":{"prompt":"كتب مشارك فقرتين، ثم أعاد صياغة جملة واختار صياغة أوضح. هل الجلسة «غير ناجحة» لأنه لم يكمل القصة؟","choices":["نعم، لأن المنتج غير مكتمل.","لا؛ فقد مارس المراجعة واتخذ قرارًا داخل الكتابة."],"answer":1,"feedback":"وصف ما حدث أدق من الحكم على الجلسة بعدد الصفحات."}},{"title":"الميسّر يهيّئ الشروط ولا يمتلك التجربة","paragraphs":["للمشارك ملكية الفكرة والصوت والمعنى والقرار. تستطيع أن تقترح أسئلة أو أدوات أو نماذج جزئية، لكن لا تختار عنه ختام القصة أو تصوغ نصه كاملًا لمجرد رفع مستواه. وفي المقابل لا تنسحب عندما يتعثر؛ فالدعم المناسب قد يكون توضيحًا للتعليمات أو اختيارًا بين مدخلين أو وقتًا إضافيًا.","احرص أن يكون الأمان أساس التعلم، لا بديلًا عنه: يمكن تقديم ملاحظة محددة تساعد النص على التطور من غير سخرية أو ضغط. وتبقى الخصوصية حقًا للمشارك؛ لكن إذا ظهرت دلالات خطر جدي فاتبع إجراءات الحماية المعتمدة، ولا تعد بسرية مطلقة.","الغاية هي بناء علاقة واعية ومستقلة بالكتابة. قد يعود المشارك إليها أو لا يعود بعد انتهاء اللقاءات. لا تضمن هذا التحول، ولا تجعل استمرار الكتابة وعدًا يقدمه لك."],"cards":[["ملكية حقيقية","خيارات يستطيع المشارك قبولها أو رفضها أو اقتراح بديل عنها."],["استقلال تدريجي","يستخدم أدوات ويطلب دعمًا محددًا، دون أن يحتاج إلى موافقتك في كل خطوة."]],"note":"عبارتك أمام المشارك وأسرته تصف ما نلتزم بتقديمه، لا ما نضمن أن يتحقق داخله."},{"title":"حدود مسؤوليتك المهنية ومسؤولية إدارة المنصة","paragraphs":["تتولى إدارة «بداية الرحلة» قبل بدء الخدمة استكمال الموافقات والاتفاقيات وإعدادات الخصوصية وحفظ البيانات، وتنظيم التواصل الرسمي ومسارات الحماية. وصول مشارك إلى جدول جلساتك المعتمد يعني أنك لست مطالبًا بإعادة جمع هذه الموافقات أو إدارة شروطها بوصفها جزءًا من التيسير.","تتركز مسؤوليتك في الحضور التربوي المهني: احترام كرامة المشارك وصوته وحقه في الاختيار، واستخدام قنوات المنصة المعتمدة، وعدم مشاركة النصوص أو تفسيرها أو استدراج المعلومات الخاصة. لا تطلب بيانات أو تسجيلات خارج ما يتطلبه العمل ويجيزه نظام المنصة.","قد يظهر أثناء الجلسة أمر لا تحسمه خبرتك التربوية وحدها؛ وعند وجود مؤشر جدي يمس السلامة أو مسألة تتطلب قرارًا إداريًا، يكون دورك الاستجابة بهدوء، وحماية الموقف قدر الإمكان، وإحالته عبر المسار المعتمد، لا التحقيق أو التشخيص أو اتخاذ قرار الحماية بمفردك."],"cards":[["تتولاه الإدارة","الموافقات وسياسات الخصوصية والصلاحيات وإجراءات الحماية التنظيمية."],["تتولاه أنت","البيئة التربوية واحترام الملكية والحدود المهنية وإحالة ما يتجاوز اختصاص التيسير."]],"note":"هذا تحديد للصلاحيات، لا دعوة إلى تجاهل خطر يظهر أثناء الجلسة. لا تجعل الإجراءات الإدارية موضوعًا لنشاطك التربوي.","scenario":{"prompt":"بعد جلسة كتابة عادية، سألك أحد أولياء الأمور عن نسخة كاملة من نص لم يختر المشارك مشاركته معه. ما الموقف المنسجم مع حدود دورك؟","choices":["أرسل النص مباشرة لأنني المسؤول عن كل ما يخص المشارك.","أحترم خصوصية النص وأحيل طلب الوصول إلى سياسة وقنوات المنصة المعتمدة، دون إفصاح من تلقاء نفسي.","أطلب من المشارك شرح سبب رفضه أمام الأسرة."],"answer":1,"feedback":"إدارة الوصول والمشاركة خاضعة لسياسات المنصة، بينما يحفظ الميسّر خصوصية المشارك ولا يتصرف في النصوص بصلاحية شخصية."}}],"questions":[{"id":"m1q1","q":"ما الوصف الأقرب لطبيعة «بداية الرحلة»؟","opts":["درس يضمن تعليم كتابة قصة متقنة.","تجربة تربوية آمنة تتخذ الكتابة وسيلة للاكتشاف والتعبير.","جلسات علاجية تعتمد الكتابة لتفسير النفس."],"correct":1,"why":"هذا هو تعريف البرنامج ومعناه المرجعي."},{"id":"m1q2","q":"لم يكتمل نص المشارك، لكنه جرّب أداة مراجعة واتخذ قرارًا بنفسه. ما موقفك؟","opts":["تصف ما فعله بوصفه شاهدًا معتبرًا في التجربة.","تعدّ الجلسة فاشلة لأن النص غير مكتمل.","تعلن أنه أصبح كاتبًا مستقلًا."],"correct":0,"why":"نصف ما حدث دون اختزال التجربة في المنتج أو تعميم النمو من شاهد واحد."},{"id":"m1q3","q":"اختار المشارك موضوعًا خياليًا بدل الكتابة عن حياته. ماذا تفعل؟","opts":["تطلب منه العودة إلى موضوع شخصي حتى تتحقق الغاية.","تفسر اختياره بوصفه تهربًا من مشاعره.","تحترم الموضوع الخيالي وتبني عليه خبرة كتابية مناسبة."],"correct":2,"why":"لا يُشترط الإفصاح الشخصي، ويمكن للخيال أن يخدم الخبرة التربوية."}]},{"title":"الرؤية والغايات ووعود البرنامج","subtitle":"ما الأثر الذي نرجوه، وما حدود ما نستطيع ضمانه؟","tag":"البوصلة","goal":"أن تميّز الرؤية والرسالة والغاية الإنسانية، وأن تصوغ توقعات تربوية صادقة.","pages":[{"title":"الرؤية والرسالة والغاية الإنسانية","paragraphs":["الرؤية: أن يمتلك كل مشارك علاقة واعية ومستقلة بالكتابة، يعود إليها لفهم ذاته والتعبير عنها ومواصلة نموه.","الرسالة: تصميم وتيسير تجربة آمنة ومتدرجة تستخدم الكتابة في خدمة الاكتشاف والتفكير والخيال والتعبير، مع تعليم الأدوات التي تساعد صوت المشارك على الظهور واستقلاله على النمو.","الغاية الإنسانية: الإسهام في أن يصبح المشارك أقدر على الوعي بذاته، وخوض المحاولة، ومراجعة أفكاره بمرونة، والتعبير بصوت أصيل، ومواصلة التعلم والنمو باستقلال أكبر.","انتبه إلى كلمة «الإسهام»: يمكنك أن تصمم شروطًا تساعد النمو، لكنك لا تملك فرض تحول داخلي ولا تحديد موعد حدوثه."],"cards":[["الرؤية","إلى أي علاقة بالكتابة نطمح؟"],["الرسالة","كيف نُنشئ الخبرة التعليمية والتيسيرية؟"],["الغاية الإنسانية","في أي قدرات إنسانية نأمل أن نسهم؟"]]},{"title":"الغايات التربوية الست","paragraphs":["لا تتعامل مع الغايات الست بوصفها قائمة يجب أن تنجزها في جلسة واحدة أو اختبارًا يقاس به كل مشارك بالمقدار نفسه. قد تركز جلسة على فتح باب المحاولة، وأخرى على مراجعة فكرة، وثالثة على تجربة طريقة تعبير جديدة.","الغايات مرتبطة ببعضها؛ فالمشارك الذي يقارن بين نهايتين قد يمارس التفكير المرن، ويتدرّب على المراجعة الكتابية، ويتخذ قرارًا مستقلًا في الوقت نفسه."],"cards":[["الوعي بالذات","ملاحظة الأفكار والمشاعر والخبرات والأسئلة ومنح ما يختاره المشارك منها لغة ومعنى."],["التفكير التأملي والمرن","السؤال وتجريب الاحتمالات ومراجعة الرؤية بدل التمسك بالإجابة الأولى."],["الخيال والتعبير الأصيل","استخدام الخيال واكتشاف الصوت الخاص بعيدًا عن تقليد نموذج جاهز."],["أدوات التعبير الكتابي","توليد الأفكار وتنميتها وتنظيمها وصياغتها ومراجعتها وتحريرها في خدمة المعنى."],["الملكية والاستقلال","المبادرة والاختيار وطلب دعم محدد واستخدام أدوات باعتماد أقل على الميسّر."],["العلاقة الواعية بالكتابة","التعرف إلى وظائف الكتابة وامتلاك طرق يمكن العودة إليها بعد البرنامج."]],"note":"اختر للخبرة غاية غالبة؛ لا تعلن تحقيق «تحول» لأن مشاركًا نجح في مهمة واحدة."},{"title":"خريطة الرحلة: خمسة اتجاهات، لا درجات لتصنيف الأشخاص","paragraphs":["لدى «بداية الرحلة» خريطة تربوية تصف اتجاهات محتملة لتطور علاقة المشارك بالكتابة. إنها ليست جدولًا إلزاميًا يُطبّق بالتسلسل، ولا مستوى توضع فيه بطاقة باسم المشارك. قد تظهر عدة اتجاهات في جلسة واحدة، وقد يحتاج الشخص إلى دعم مختلف عندما يتغير نوع الكتابة أو التحدي.","الأمان حاضنة مستمرة لجميع الخبرات، وليس محطة نتجاوزها نهائيًا. والمحاولة والاطمئنان والمبادرة وتهيئة العودة لا تعني وعودًا بتحول مضمون؛ بل تساعدك على فهم ما تتيحه الخبرة، وما قد تلاحظه من شواهد."],"cards":[["١ · الأمان","«أستطيع أن أحاول هنا»؛ حق المحاولة والسؤال والرفض دون إدانة."],["٢ · المحاولة الكاشفة","«أكتب وأجرّب فأكتشف»؛ الدخول في فعل صغير يفتح احتمالًا."],["٣ · الاطمئنان إلى الكتابة","«أستطيعها وقد تنفعني»؛ التعرف إلى فائدة ممكنة للكتابة."],["٤ · المبادرة بالكتابة","«أعود إليها باختياري»؛ اختيار فكرة أو أداة أو عودة من تلقاء المشارك."],["٥ · تهيئة العودة","«أعرف كيف أستأنف»؛ امتلاك مدخل يمكن تجربته لاحقًا إذا اختار."]],"note":"في التدريب التطبيقي ستتعلّم كيف تقرأ الشواهد وتستخدم الخريطة في بناء المسار؛ هنا يكفي أن تفهم معناها وحدودها.","scenario":{"prompt":"استخدم مشارك خريطة أفكار من تلقاء نفسه في جلسة، لكنه تردد في جلسة تالية عند قراءة نصه بصوت مرتفع. ما القراءة الأدق؟","choices":["تراجع من محطة المبادرة إلى محطة الأمان وفقد ما تعلمه.","قد يبادر في موقف ويحتاج إلى دعم الأمان في موقف آخر؛ الخريطة مرنة وليست تصنيفًا ثابتًا.","نجحت الرحلة وانتهت حاجته إلى التيسير."],"answer":1,"feedback":"الخريطة تصف اتجاهات مرتبطة بالموقف وليست مراحل جامدة أو أحكامًا نهائية على المشارك."}},{"title":"لغة العمل المشتركة: الغاية والحركة والفعل والخبرة","paragraphs":["قبل التدريب التطبيقي ستسمع مصطلحات مثل «الغاية التربوية»، و«الحركة التربوية»، و«الفعل الجوهري»، و«الخبرة». ليست أسماء مختلفة للنشاط نفسه؛ بل مفاتيح تساعدك على التمييز بين المعنى الذي يخدمه العمل، وما يفعله المشارك بنفسه، وكيف تصمم فرصة حدوث ذلك.","مثلًا: قد تخدم جلسة غاية تنمية المبادرة؛ وتكون الحركة المقصودة الانتقال من انتظار اقتراح الميسّر إلى اختيار مدخل خاص للكتابة؛ ويكون الفعل الجوهري اختيار هذا المدخل والشروع في المحاولة؛ أما النشاط فقد يكون الاختيار من صور أو أشياء أو أفكار يبتكرها المشارك. يمكن تغيير النشاط مع بقاء الحركة والفعل الجوهري.","لا تحتاج الآن إلى حفظ خطوات تصميم الجلسة؛ تلك مهارة سنمارسها بتفصيل في التأهيل التطبيقي. المطلوب أن تميّز المفاهيم وألّا تختزل التجربة في شكل النشاط أو جودة الناتج."],"cards":[["الغاية","الاتجاه التربوي الأوسع الذي تخدمه التجربة."],["الحركة التربوية","ما نسعى إلى أن يصبح ممكنًا للمشارك في هذه الخبرة."],["الفعل الجوهري","الاختيار أو الفعل الذي يفقد النشاط معناه إذا قام به الميسّر بدلًا من المشارك."],["الخبرة والنشاط","الخبرة بناء ذو معنى؛ والنشاط أحد المداخل أو الوسائط لتنفيذها."]],"scenario":{"prompt":"في خبرة هدفها توسيع اختيار المشارك لمدخل قصته، ما الفعل الذي لا ينبغي للميسّر الاستحواذ عليه؟","choices":["اختيار مدخل القصة بدل المشارك حتى لا يتعثر.","تجهيز مواد مناسبة وشرح كيفية استخدامها.","أن يختار المشارك مدخلًا ويبدأ محاولة منه، مع دعم مناسب عند الحاجة."],"answer":2,"feedback":"يمكن للميسّر تجهيز الأداة وتوضيحها؛ لكن الاختيار الجوهري نفسه ينبغي أن يبقى في يد صاحب التجربة."}},{"title":"الوعود الصادقة وما لا نعد به","paragraphs":["نستطيع الالتزام بتجربة آمنة ومقصودة، وأدوات مناسبة، وفرص فعلية للمحاولة، ودعم متدرج ومراجعة مسؤولة. هذه التزامات مرتبطة بما نقدمه وكيف نقدمه.","لا نستطيع أن نضمن أن يصبح كل مشارك كاتبًا، أو أن يكتشف «موهبة كامنة»، أو أن يحب الكتابة ويستمر فيها. ولا نستخدم النص لتشخيص شخصية صاحبه أو تفسير حالته النفسية، ولا نضغط عليه للكشف عن تجاربه الخاصة.","حين تتحدث مع أسرة المشارك، قل مثلًا: «سنوفّر فرصًا للتجريب والتعبير وتعلم أدوات تساعد على الكتابة، ونلاحظ ما يظهر خلال الرحلة». لا تقل: «نضمن أن يصبح ابنكم كاتبًا واثقًا خلال عدد محدد من الجلسات»."],"scenario":{"prompt":"تسألك أسرة: «هل ستجعلون ابننا يحب الكتابة بالتأكيد؟» ما الإجابة الأنسب؟","choices":["نعم، هذا هو الوعد الأساسي للبرنامج.","سنهيئ له خبرات وأدوات وفرصًا حقيقية، لكننا لا نضمن نتيجة داخلية بعينها."],"answer":1,"feedback":"تمييز الالتزام المهني من النتيجة التي لا يمكن ضمانها جزء من صدق البرنامج."}}],"questions":[{"id":"m2q1","q":"ما المعنى الذي تحمله كلمة «الإسهام» في الغاية الإنسانية؟","opts":["أن نمو المشارك مضمون عند إكمال الجلسات.","أن البرنامج يهيئ شروط النمو دون فرض التحول أو توقيته.","أن البرنامج لا يعلم مهارات الكتابة."],"correct":1,"why":"الغاية الإنسانية متواضعة وصادقة في ما يمكن إحداثه."},{"id":"m2q2","q":"أي العبارات يصلح وعدًا تقدمه للأسرة؟","opts":["سنقدم تجربة آمنة وفرصًا للكتابة ومساندة مناسبة.","نضمن أن يكتب الطفل رواية مكتملة.","نضمن أن يحب الكتابة بقية حياته."],"correct":0,"why":"نلتزم بما يقع في نطاق تصميم التجربة وتيسيرها."},{"id":"m2q3","q":"كيف تختار الغايات التربوية لجلسة؟","opts":["تجمع الغايات الست في كل مرة حتى لو كان النشاط مزدحمًا.","تختار غاية أو حركة غالبة وتبقي سائر الغايات أفقًا لا قائمة إلزامية.","تستبعد تعلم الأدوات الكتابية كليًا."],"correct":1,"why":"الغايات مترابطة ولا يجب تحميل كل خبرة جميعها."}]},{"title":"القيم الخمس الحاكمة","subtitle":"كيف يظهر احترام المشارك في أبسط قرار تتخذه؟","tag":"القيم","goal":"أن تميّز القيم الخمس وتفهم التوازن بين الأمان والتعليم والملكية.","pages":[{"title":"الثقة بالإمكانات واحترام التفرد","paragraphs":["القيمة الأولى: الثقة بقدرات المشارك وإمكاناته. ابدأ مما يستطيع المشارك فعله، لا من حكم ثابت بما ينقصه. إذا قال طفل «لا أعرف ماذا أكتب»، فقد تكون التعليمة مبهمة، أو المهمة واسعة، أو الوسيط غير مناسب. يمكنك أن تعرض صورتين أو تقسّم الخطوة، دون أن تصفه بأنه «بلا خيال».","القيمة الثانية: احترام التفرد وأصالة الصوت. ليس مطلوبًا أن تعجبك نهاية القصة أو فكرتها حتى يكون لها مكان مشروع. علّم المشارك كيف يختبر وضوح ما كتب وأثره في القارئ، لكن لا تجعل ذائقتك معيارًا يلزمه بتبنيها.","الثقة لا تعني تجاهل الصعوبة، والتفرد لا يعني الامتناع عن التعليم؛ بل أن يكون التعليم مساندًا لقدرة قائمة وصوتٍ يخص صاحبه."],"cards":[["بدل التصنيف","«لم يبدأ من التعليمة الأولى، لكنه اقترح حدثًا بعد عرض صورتين»."],["بدل فرض ذائقتك","«ما الأثر الذي تريد أن تتركه هذه النهاية لدى القارئ؟»"]]},{"title":"الملكية والنمو قبل الإنجاز","paragraphs":["القيمة الثالثة: ملكية المشارك لرحلته. اختياراته يجب أن تكون حقيقية لا شكلية: يستطيع الاختيار بين مدخلين، أو اقتراح ثالث، أو قبول تعديلك أو رفضه، ضمن حدود العمل المتفق عليها. لا تكتب نيابة عنه لتجعل النص أجمل.","القيمة الرابعة: النمو قبل الإنجاز. انظر إلى ما جرى خلال المحاولة لا إلى جودة النص وحدها. النص القصير قد يحتوي اختيارات مستقلة ومراجعة. والنص الأجمل قد يكون نتاج تدخل كثيف من الميسّر؛ لذا دوّن مصدر الفكرة، ونوع الدعم، وما فعله صاحب العمل بنفسه.","لا تحكم على نمو دائم من موقف واحد، ولا تعكس الأولوية فتتجاهل جودة الكتابة تمامًا. يمكنك أن تقرأ جودة الصياغة ومعها سياق إنتاجها."],"cards":[["ملكية","من صاحب القرار النهائي بشأن النص؟"],["نمو","ماذا جرّب المشارك؟ وما المساعدة التي احتاجها؟"]]},{"title":"الأمان يحفظ الكرامة ولا يلغي التعلم","paragraphs":["القيمة الخامسة: الأمان أساس التعلم والتعبير. من حق المشارك أن يصمت أو يرفض قراءة نصه أو يغير موضوعه، ومن حقه أن يتعلم من الخطأ من دون سخرية أو إدانة.","يمكنك أن تقدم مراجعة صريحة ومحترمة: «بدأ المشهد في الحديقة ثم وصل البطل إلى المنزل دون انتقال واضح؛ هل تريد أن نراجع هذه النقطة؟». هنا لا تتجاهل ضعف النص، ولا تحوّل الملاحظة إلى تقييم للشخص.","ليست الخصوصية سرية مطلقة أمام خطر جدي. عند ظهور دلالة تستدعي الحماية، تتبع الإجراءات المعتمدة ولا تدخل في تأويل نفسي. تفاصيل إجراءات الحماية جزء من الدليل التطبيقي، وليست مجالًا لاجتهاد مستقل داخل هذه الوحدة."],"scenario":{"prompt":"رفضت مشاركة قراءة نصها أمامك. ما القرار الأكثر اتساقًا مع القيم؟","choices":["تحترم رفضها وتعرض طريقًا آخر للمشاركة دون ضغط.","تصرّ على القراءة لأن ذلك ضروري لاختبار نموها."],"answer":0,"feedback":"الأمان يشمل حق عدم الإفصاح، مع بقاء حدود الحماية عند وجود خطر جدي."}},{"title":"أربعة أبعاد متكاملة لحضورك المهني","paragraphs":["يوضح الدليل المرجعي أن حضور الميسّر داخل الجلسة يقوم على أربعة أبعاد متزامنة، لا خطوات تنتهي من إحداها قبل الأخرى. وهي صورة عملية لما تعنيه القيم الخمس حين تتحول إلى ممارسة يومية.","تهيّئ الشروط المناسبة لتصبح المحاولة ممكنة؛ وتنتبه لما يحدث فعلًا دون أن تختزل المشارك في تفسير متسرع؛ وتتدخل بقدر الحاجة، فلا تستحوذ على النص ولا تنسحب عند الصعوبة؛ وتحفظ ملكية المشارك للأفكار والاختيارات والمعاني.","لن نفصّل هنا أدوات التدخل أو سلّم الدعم؛ سنستخدمها في التدريب التطبيقي عبر حالات وجلسات. المطلوب في هذه المرحلة أن ترى الأبعاد الأربعة باعتبارها مسؤوليات مهنية متداخلة."],"cards":[["تهيئة الشروط","وقت وأدوات وتعليمات واضحة وسياق يجعل المحاولة ممكنة."],["الانتباه لما يحدث","وصف كلمات المشارك وسلوكه واختياراته قبل الاستنتاج."],["التدخل بقدر الحاجة","سؤال أو أداة أو توضيح يناسب الموقف، مع مراجعة أثره."],["حفظ الملكية","يبقى الصوت والمعنى والقرار الأساسي في يد المشارك."]],"scenario":{"prompt":"توقف طفل عن الكتابة بعد جملة واحدة. أي استجابة تجمع الأبعاد الأربعة بأفضل صورة؟","choices":["أصفه بأنه لا يملك خيالًا، ثم أكتب الجملة التالية عنه.","ألاحظ التوقف وأتحقق من حاجته، وأتيح أداة مناسبة ثم أترك له اختيار ما يكتب.","أرفض مساعدته لأن الاستقلال يقتضي ألا أتدخل أبدًا."],"answer":1,"feedback":"تهيئة الشروط والانتباه والتدخل وحفظ الملكية تعمل معًا؛ وغياب أحدها قد يغيّر معنى الخبرة."}}],"questions":[{"id":"m3q1","q":"لم يبدأ طفل الكتابة بعد تعليمتك. أي وصف أنسب؟","opts":["هذا طفل خياله ضعيف.","لم يبدأ من التعليمة، وسأجرب مدخلًا مختلفًا لأرى ما يساعده.","ينبغي إنجاز قصته بدلاً عنه."],"correct":1,"why":"ابدأ بوصف ما وقع وابحث عن الدعم بدل إلصاق صفة ثابتة."},{"id":"m3q2","q":"ما الذي يدل على ملكية حقيقية للمشارك؟","opts":["اختياره من بدائل جميعها تنتهي بما تفضله أنت.","إمكانية قبول البدائل أو رفضها أو اقتراح خيار ثالث.","التزامه بكل تعديلاتك كي يخرج النص متقنًا."],"correct":1,"why":"الملكية قرار فعلي لا اختيار شكلي."},{"id":"m3q3","q":"ما معنى «النمو قبل الإنجاز»؟","opts":["نهمل جودة النص كليًا.","نقيّم جمال اللغة وحده.","نقرأ جودة النص مع مصدر الفكرة والمساعدة والمحاولة والمراجعة."],"correct":2,"why":"لا نختزل التعلّم في المنتج ولا نستبعد جودة النص."}]},{"title":"الشيفرات الثماني (1–4)","subtitle":"الكتابة والنص والإمكانات والصوت","tag":"الشيفرات ١–٤","goal":"أن تستخدم الشيفرات الأربع الأولى في قراءة المواقف دون فرض نموذج واحد للتعبير.","pages":[{"title":"الشيفرة الأولى: الكتابة وسيلة للنمو والوعي","paragraphs":["لا تنظر إلى الكتابة باعتبارها المنتج النهائي وحده؛ إنها فعل يتيح الملاحظة والتفكير والتخيل والتعبير والاختيار والمراجعة. حين يحتاج المشارك إلى وصف مدينة تخيلها، علّمه اختيار التفاصيل الحسية التي تخدم الصورة التي يريد أن ينقلها.","المهارة هنا أصيلة وليست زائدة. الفرق هو أن تبدأ من العالم الذي اختاره المشارك، بدل أن تقدم شرحًا طويلًا في الوصف ثم تطلب منه تقليد نموذج لا يعنيه.","السؤال الذي يختبر قرارك: «هل تخدم الأداة ما يحاول المشارك أن يقوله؟». "],"cards":[["تدخل مناسب","«ما أول شيء تريد أن يراه القارئ عندما يصل إلى مدينتك؟»"],["تدخل غير مناسب","«هذه فقرتي الجاهزة؛ انسخها ليصبح وصفك أجمل»."]]},{"title":"الشيفرة الثانية: النص أثر مهم لا معيار وحيد","paragraphs":["حين تراجع نصًا، لا تقرأ الكلمات بمعزل عن الطريقة التي نشأت بها. اسأل: ما الذي اختاره المشارك؟ أين احتاج إلى المساندة؟ هل جرب احتمالًا أو راجع شيئًا؟","قد يكتب مشارك نصف صفحة لكنه يغيّر البداية باختياره، بينما يكتب آخر نصًا طويلًا بمساعدة كثيفة منك. لا تحكم للأول أو الثاني بمستوى نمو ثابت، ولا تعلن نجاح أحدهما لمجرد طول النص أو جماله.","استبدل الأحكام العامة بملاحظات وصفية: «قارن بين بدايتين واختار الثانية ثم كتب المشهد التالي». هذه صياغة أمينة لما رأيته."],"note":"هناك فرق بين وصف شاهد واحد وبين الادعاء بتحول داخلي مستمر."},{"title":"الشيفرة الثالثة: الإمكانات تُكتشف وتُنمى","paragraphs":["لا تبدأ من افتراض أن المشارك يفتقر إلى القدرة. قد تكون لديه فكرة لكنه لا يعرف كيف يدخل إلى الكتابة، أو يكون التحدي أكبر من قدرته الحالية على تنفيذه.","تستطيع أن تدعوه إلى الحديث عن الفكرة قبل كتابتها، أو استخدام رسم، أو اختيار حدث من بديلين، أو تقسيم المهمة. وما يناسب مشاركًا قد لا يناسب آخر، حتى لو كانا في السن نفسها.","صف الاستجابة الدقيقة: «اقترح حدثًا بعد عرض صورتين»، لا «هذا الطفل عاجز عن توليد الأفكار». الأولى تساعدك على قرار تالٍ، والثانية تصنف الشخص."],"cards":[["احترام الإمكان","ادرس طبيعة العائق بدل افتراض نقص ثابت."],["تعليم فاعل","قدّم مدخلًا يساعد المشارك على إنجاز الفعل بنفسه."]]},{"title":"الشيفرة الرابعة: لكل مشارك صوته وتجربته","paragraphs":["لا توجد إجابة نموذجية واحدة في التعبير عن الذات. ليس من حق ذائقتك الأدبية أن تملي نهاية سعيدة أو شخصية شجاعة أو موضوعًا يحبه الميسّر.","إذا عاد بطل القصة إلى المنزل دون تحقيق هدفه، تستطيع أن تسأل: «ما الأثر الذي تريد أن تتركه هذه النهاية؟ وهل تمهد الأحداث له؟». ثم تساعد على مراجعة ما يحتاج توضيحًا دون انتزاع القرار.","احذر الأسئلة الموجِّهة مثل «أليس الأفضل أن ينتصر البطل؟». قد تبدو سؤالًا، لكنها تقود نحو جوابك المفضل. اجعل سؤالك يفتح بدائل مشروعة."],"scenario":{"prompt":"كتب مشارك نهاية لا تعجبك. ماذا تسأله أولًا؟","choices":["«أليس الأفضل أن تغيّر النهاية؟»","«ما الأثر الذي تريد أن يشعر به القارئ عند هذه النهاية؟»"],"answer":1,"feedback":"ناقش الغرض والأثر والوضوح، واترك ملكية القرار لصاحب النص."}}],"questions":[{"id":"m4q1","q":"أي طريقة تعلم الوصف الحسي وفق الشيفرة الأولى؟","opts":["يصف المشارك مكانًا اختاره ويتعلم أداة تخدم تصويره.","تفرض فقرة ثابتة يحفظها الجميع.","تستبعد تعليم الوصف لأن الكتابة مجرد وسيلة."],"correct":0,"why":"الأداة الكتابية جزء أصيل حين تخدم غرض المشارك."},{"id":"m4q2","q":"أي عبارة تصف الشيفرة الثانية بدقة؟","opts":["طول النص يحدد نجاح الجلسة.","ينبغي تجاهل الجودة الفنية.","ننظر إلى النص وسياق إنتاجه ومقدار الدعم وما فعله المشارك."],"correct":2,"why":"النص أثر مهم لكنه لا يكشف وحده مسار التعلم."},{"id":"m4q3","q":"مشارك اختار نهاية مختلفة عن ذائقتك. أفضل تدخل هو:","opts":["إعادة كتابة النهاية بطريقتك.","سؤاله عن الأثر المقصود ومساعدته على اختبار وضوحه.","الامتناع تمامًا عن أي ملاحظة فنية."],"correct":1,"why":"النقاش الفني جائز، واستبدال صوت صاحبه غير جائز."}]},{"title":"الشيفرات الثماني (5–8)","subtitle":"الخطأ ودور الميسّر والذات والاستقلال","tag":"الشيفرات ٥–٨","goal":"أن تحفظ كرامة المشارك، وتقدّم دعمًا متزنًا، وتبقي تفسير ذاته ومستقبله في يده.","pages":[{"title":"الشيفرة الخامسة: الخطأ فرصة للتعلم","paragraphs":["الخطأ جزء طبيعي من محاولة الكتابة والتجريب. إذا اختلط مكان الشخصيات أو غمض تسلسل الأحداث، لا تجعل الخطأ دليلًا على قيمة صاحبه؛ لكن لا تتجاهله ولا تُغرق النص بمديح غير صادق.","قدّم ملاحظة محددة، مرتبطة بأثر واضح، واطرح خطوة قابلة للتجريب: «انتقلت الشخصية إلى المنزل دون أن نعرف كيف وصلت؛ هل نراجع هذا الانتقال؟». اختر وقتًا مناسبًا؛ فالمقاطعة المتكررة أثناء توليد الفكرة قد تغلق باب المحاولة.","السؤال الحاكم: «هل تجعل ملاحظتي التعلم ممكنًا، أم تجعل الخطأ تهديدًا للقبول؟»."],"cards":[["لا للإدانة","افصل الخطأ عن صاحبه."],["لا للتجاهل","اختر نقطة مراجعة واحدة ذات معنى."]]},{"title":"الشيفرة السادسة: الميسّر يصنع البيئة ولا يصنع الكاتب","paragraphs":["أنت مسؤول عن الوقت والأدوات والأسئلة والدعم والحدود والتغذية الراجعة، لكنك لا تملك النص ولا الفكرة. إذا قال المشارك: «اكتب أنت الباقي»، فلا تقدّم فقرة تامة ثم تنسبها إلى تجربته.","ابدأ بمساعدة كافية وآمنة: توضيح، أو سؤال يفتح مدخلًا، أو مثال جزئي، أو تقسيم المهمة. لا يطلب منك المبدأ التمسك بأقل قدر من الدعم على حساب احتياج المشارك، وإنما تقدير القدر المناسب، ثم إعادة الفعل والقرار إليه.","تجنب طرفَي الاستحواذ والانسحاب: الاستحواذ يجعل النص عملك، والانسحاب يترك صاحبه أمام صعوبة من دون مساعدة."],"cards":[["الاستحواذ","تختار وتكتب وتصحح حتى يصير النص أقرب إليك."],["الانسحاب","تمتنع عن المساندة باسم احترام الاستقلال."],["التيسير","تدعم بقدر الحاجة وتعيد القرار والفعل."]]},{"title":"الشيفرة السابعة: لا تفسّر ذات المشارك نيابة عنه","paragraphs":["قد يكتب المشارك عن شخصية وحيدة أو عن خوف أو غياب. النص الخيالي ليس دليلًا على أنه يمر شخصيًا بالموقف نفسه. لا تقل: «أنت تشعر بالوحدة، ولذلك كتبت هذا».","إذا أراد المشارك مناقشة قصته، يمكنك أن تسأل عن الشخصية، أو عما يريد أن يفهمه القارئ، دون استدراج إفصاح خاص أو تقديم تشخيص نفسي. وله الحق في عدم القراءة أو تفسير نصه.","عند ظهور مؤشر خطر جدي، لا تتجاهله ولا تُجري جلسة علاجية. التزم بمسار الحماية المعتمد. هذا الاستثناء لا يمنحك حرية تفسير جميع النصوص الشخصية."],"note":"الخصوصية حق، والسلامة حد. تفاصيل التصعيد المهني تُراجع في دليل الحماية التطبيقي."},{"title":"الشيفرة الثامنة: علاقة واعية ومستقلة قابلة للاستمرار","paragraphs":["غايتك ألا يصبح وجودك أو إعجابك شرطًا لكل محاولة جديدة. ساعد المشارك على التعرف إلى أدوات تنفعه: دفتر أفكار، خريطة تخطيط، مشروع مفتوح، أو طريقة مراجعة تعلّمها.","قد تظهر المبادرة عندما يأتي من تلقاء نفسه بفكرة من قائمته أو يطلب مساعدة محددة بدل انتظار التعليمات. لاحظ ما حدث ولا تعلن أنه «أصبح مستقلًا إلى الأبد».","لا تفرض على المشارك وعدًا بالكتابة اليومية أو الاستمرار بعد البرنامج. يكفي أن تهيئ طريقًا يمكنه العودة إليه إذا اختار ذلك."],"scenario":{"prompt":"لماذا لا نطلب من المشارك أن يَعِد بالكتابة كل يوم بعد البرنامج؟","choices":["لأن العودة ينبغي أن تكون اختيارًا ممكنًا لا التزامًا يفرضه الميسّر.","لأن الكتابة خارج الجلسات ممنوعة."],"answer":0,"feedback":"نعمل على تمكين الاستقلال، لا صناعة اعتماد أو شعور بالدَّين."}}],"questions":[{"id":"m5q1","q":"ما الذي تعبّر عنه الشيفرة الخامسة؟","opts":["نمدح كل نص حتى لا ينزعج صاحبه.","نستخدم الخطأ مدخلًا لملاحظة واضحة ومراجعة محترمة.","نصحح كل الأخطاء في اللحظة نفسها."],"correct":1,"why":"قبول الخطأ لا يعني تجاهله أو تقديم مديح غير صادق."},{"id":"m5q2","q":"طلب منك مشارك أن تكتب الحكاية عنه. ماذا تفعل؟","opts":["تكتبها كاملة ثم تشجعه على نسخها.","تتركه بلا مساعدة حتى يعتمد على نفسه.","تطرح سؤالًا أو مدخلًا مناسبًا ثم تترك له مواصلة الفعل."],"correct":2,"why":"التيسير توازن بين الدعم والملكية."},{"id":"m5q3","q":"كتبت مشاركة قصة خيالية عن العزلة. أي استجابة سليمة؟","opts":["تسأل عن مقصدها السردي دون نسبة التجربة إليها.","تؤكد أنها تعيش عزلة شخصية.","تطلب أن تكشف سبب شعورها بالعزلة."],"correct":0,"why":"النص الخيالي لا يخولك تشخيص الذات أو إلزام صاحبته بالإفصاح."}]},{"title":"التفكير بمنهجية «بداية الرحلة»","subtitle":"تكامل الشيفرات وبوصلة القرار","tag":"الدمج","goal":"أن توازن بين مبادئ متعددة وأن تفرّق بين الشاهد والحكم العام قبل التقييم النهائي.","pages":[{"title":"الشيفرات منظومة واحدة لا قواعد منفصلة","paragraphs":["قد يبدو مبدآن في توتر داخل الموقف نفسه: تريد أن تحترم اختيار المشارك، وأن تساعده على مراجعة نصه؛ تريد أن تسمح بالتعثر، وألا تترك الخطأ بلا تعلم؛ تريد أن تشجع الاستقلال، وألا تنسحب حين يحتاج إلى الدعم.","المطلوب ليس اختيار مبدأ وإلغاء الآخر، بل قرار يحفظ التوازن: علّم أداة داخل غرض ذي معنى، واكتشف موضع ضعف النص من دون إدانة صاحبه، وقدّم دعمًا كافيًا ثم أعد القرار إلى المشارك.","حين يتعلق الأمر بالخصوصية، احترم حق عدم الإفصاح؛ لكن لا تعد بسرية مطلقة إذا ظهرت دلالة خطر جدي تستلزم اتباع مسار الحماية المعتمد."],"cards":[["الكتابة وسيلة ومهارة","علّم الأداة دون جعلها غاية مستقلة."],["لا إجابة نموذجية وتوجد مراجعة","ناقش الأثر والوضوح دون فرض ذائقتك."],["الخطأ مقبول وله مراجعة","افصل الشخص عن الخطأ."],["دعم دون استحواذ أو انسحاب","امنح المساعدة الكافية ثم أعد الفعل."],["الخصوصية حق والسلامة حد","احمِ الخصوصية واتبع إجراءات الحماية عند الخطر."]]},{"title":"مثال متكامل: الروبوت الضائع","paragraphs":["اختار طفل في العاشرة أن يكتب قصة عن روبوت ضائع في مدينة كبيرة. كتب بداية قصيرة ثم قال: «لا أعرف كيف أكمل، اكتب أنت الباقي». لا تطلب منه أن يواجه التعثر وحده، ولا تُكمل القصة نيابة عنه.","يمكنك أن تسأله: «ما المشكلة الأولى التي قد تواجه الروبوت؟». وإن احتاج دعمًا إضافيًا، اعرض احتمالين مع حقه في اقتراح ثالث، أو اقترح رسم المكان وتحديد ثلاثة أشياء يراها الروبوت. هكذا تعلمه أداة لتوليد الحدث وتحفظ اختياره.","بعد أن يواصل، دوّن وصفًا: «حدد مشكلة الروبوت واختار أن يبحث عن صديق ثم كتب الحدث التالي». لا تقل إنك اكتشفت «استقلالًا ثابتًا» من موقف واحد."],"scenario":{"prompt":"أمامك موقف الروبوت: ما أكثر تدخل متوازن؟","choices":["تكتب بقية القصة كنموذج نهائي ليوفر الوقت.","تطرح سؤالًا يولد حدثًا، ثم تتيح للطفل اختيار طريقه."],"answer":1,"feedback":"هذا التدخل يوازن بين الدعم وصوت المشارك والتعلم من التعثر."}},{"title":"التوثيق المهني وملف الرحلة: وظيفتان مختلفتان","paragraphs":["بعد الجلسة قد تحتاج إلى ملاحظات مهنية تساعدك على فهم ما حدث: ماذا اختار المشارك؟ ما الدعم الذي قُدّم؟ ماذا حدث بعده؟ وما الذي يستحق البناء عليه في اللقاء التالي؟ هذا هو التوثيق الوصفي، وهو لا يصدر أحكامًا على الشخصية أو يزعم نموًا دائمًا من شاهد واحد.","أما «ملف الرحلة» فيحفظ أثرًا من تجربة الكتابة يختار المشارك ما يناسبه منه، مثل مسودة أو خريطة أفكار أو نص يريد الاحتفاظ به. لا يدخل كل ما كُتب في الملف تلقائيًا، ولا تصبح ملاحظات الميسّر عن الجلسة مادة منشورة أو مشتركة لمجرد أنها وُثقت.","تحدد الإدارة نظام حفظ الملفات وصلاحيات الوصول والمشاركة. وفي التدريب التطبيقي سنتدرب على صياغة التقرير، واختيار الشواهد، وتحديد ما يمكن أن يساعد في بناء الجلسة التالية."],"cards":[["التوثيق الوصفي","سجل مهني لملاحظات محددة تدعم قرارات التيسير التالية."],["ملف الرحلة","أثر يختار المشارك إدراجه من عمله وعودته إلى الكتابة، وفق حدود المنصة."]],"scenario":{"prompt":"احتفظ الميسّر بملاحظات عن تعثر المشارك وخطوة الدعم التي ساعدته، وكتب المشارك مسودة يريد إبقاءها خاصة. ما التصرف المناسب؟","choices":["تُدرج المسودة والملاحظات تلقائيًا في ملف الرحلة ليطلع عليها الجميع.","تُحفظ الملاحظات في سجلها المهني حسب سياسة المنصة، ويُحترم قرار المشارك بشأن ما يدخل ملف الرحلة.","يُحذف كل أثر للجلسة لأن النص لم يكتمل."],"answer":1,"feedback":"ملكية المشارك وخصوصيته لا تزولان بسبب وجود مساحة رقمية أو سجل للتوثيق."}},{"title":"بوصلة الميسّر ومفردات الفريق","paragraphs":["قبل القرار اسأل نفسك: هل يحفظ كرامة المشارك وخصوصيته؟ هل يبقي الفعل والقرار الجوهريين في يده؟ هل يتيح محاولة حقيقية؟ هل يقدم مهارةً في خدمة المعنى؟ وهل أستطيع وصف النتيجة دون تعميم أو تأويل نفسي؟","في لغة الفريق: «النمو» تغير تدريجي في علاقة المشارك بذاته وتفكيره وتعبيره والكتابة، لا مجرد تحسن المنتج. «التحول» انتقال داخلي تهيئ التجربة شروطه دون فرضه. «الصوت الخاص» طريقته الأصيلة في منح تجربته أو خياله لغة وشكلًا. «الأثر» ما يتغير في العلاقة بالذات والكتابة، لا ما يُنتج وحده.","خلاصة التأهيل: لا تحفظ الشيفرات لتردد أسماءها فحسب؛ استخدمها عندما تختار سؤالك، وتحدد مقدار تدخلِك، وتصف ما حدث، وتراجع قرارك. اجتياز هذه المرحلة يقيس فهم الأسس، ولا يثبت وحده جاهزيتك لإدارة جلسة."],"cards":[["النمو","لا يُحسم بشاهد واحد."],["الصوت الخاص","لا يعني أسلوبًا ثابتًا أو نسخة من أسلوبك."],["التيسير","حضور فاعل ومتزن مع حفظ الملكية."],["الأثر","يتجاوز طول النص وجماله."]]},{"title":"قبل الانتقال إلى التطبيق: اربط المفاهيم في موقف واحد","paragraphs":["تخيّل أن مشاركًا بدأ الجلسة باقتراح قصة، لكنه تردد في اختيار بدايتها، ثم عاد إلى إحدى أفكاره دون طلب موافقتك. لا تحتاج إلى وضعه في «مستوى»؛ بل إلى رؤية الشاهد وفهم الحاجة وترك القرار في يده.","يمكنك تفسير الموقف تربويًا بالاستناد إلى خريطة الرحلة، وفهم الحركة والفعل الجوهري، والأبعاد الأربعة لحضورك. وبعد اللقاء تصف ما حدث في سجل مهني، دون أن تقرر نيابة عن المشارك ما يجب أن يدخل ملف الرحلة.","أنت الآن تمتلك اللغة المشتركة التي سنستخدمها لاحقًا في حالات التدريب التطبيقي. هناك ستتعلم إعداد موجز البداية وخريطة المسار وبطاقة الجلسة، وقيادة النشاط، وتعليم مهارة كتابية، وتوثيق ما يساعد على بناء اللقاء التالي."],"cards":[["أثناء اللقاء","تهيئة → ملاحظة → تدخل مناسب → حفظ القرار للمشارك."],["بعد اللقاء","وصف الشواهد المهنية → اقتراح خطوة تالية → احترام ملف الرحلة والخصوصية."]],"note":"اجتياز هذه المرحلة إثبات لفهم المرجعية، لا ترخيص تلقائي لإدارة الجلسات أو اعتمادًا لاكتمال الكفاءة التطبيقية.","scenario":{"prompt":"بعد المحاولة الأولى، قال الميسّر: «أصبح هذا المشارك مستقلًا تمامًا وسأختار أفضل نصوصه وأضعها في ملفه». أين الخلل؟","choices":["لا خلل؛ المبادرة مرة واحدة تثبت الاستقلال النهائي.","الخلل في تعميم النمو من شاهد واحد، وفي اتخاذ قرار إدراج النصوص نيابة عن المشارك.","الخلل الوحيد أنه لم يطلب كتابة صفحات أكثر."],"answer":1,"feedback":"نصف الشواهد في سياقها، ونحترم ملكية النص وقرار المشارك بشأن ملف الرحلة، دون استنتاجات شاملة."}}],"questions":[{"id":"m6q1","q":"ما التوازن الصحيح بين احترام النص ومراجعته؟","opts":["لا تقدم أي ملاحظة حتى لو طلب المشارك التطوير.","تستبدل النهاية بنهاية نموذجية.","تساعد على اختبار الوضوح والأثر وتترك قرار التعديل لصاحب النص."],"correct":2,"why":"من الممكن حفظ الصوت وتعليم أدوات المراجعة معًا."},{"id":"m6q2","q":"أي عبارة وصفية يمكن تضمينها في تقرير الجلسة؟","opts":["اختار المشارك حدثًا بعد عرض احتمالين، ثم تابع بنفسه.","صار المشارك مستقلًا في حياته كلها.","ثبت أنه يمتلك ذكاءً خياليًا استثنائيًا."],"correct":0,"why":"نسجل الشواهد السياقية لا صفات أو تحولات لا دليل عليها."},{"id":"m6q3","q":"ماذا يعني اجتياز التأهيل التأسيسي؟","opts":["أن الميسّر أصبح معتمدًا لإدارة كل الجلسات دون تقييم آخر.","أن فهمه النظري للمبادئ اجتاز معايير هذه المرحلة، ويحتاج تقييمًا تطبيقيًا لاحقًا.","أن المشاركين سيحققون نتائج مضمونة."],"correct":1,"why":"التأهيل التأسيسي لا يقوم مقام التحقق من الأداء العملي."}]}],"finalQuestions":[{"id":"f01","topic":"الهوية والغاية","q":"مشارك كتب مشهدًا قصيرًا، لكنه اختار شخصيته وراجع بدايته. ماذا تستنتج؟","opts":["فشل لأنه لم يتم النص.","ظهرت شواهد على الاختيار والمراجعة دون حكم شامل على نموه.","أصبح كاتبًا مستقلًا تمامًا.","لا توجد أي معلومات عن تجربته."],"correct":1,"why":"النص ليس المعيار الوحيد؛ والشاهد الواحد ليس حكمًا عامًا."},{"id":"f02","topic":"الهوية والغاية","q":"أسرة تطلب ضمان أن يحب ابنها الكتابة بعد ثماني جلسات. كيف ترد؟","opts":["نضمن ذلك إذا حضر جميع اللقاءات.","سنستبعد الأدوات اللغوية ونركز على مشاعره فقط.","نستطيع إتاحة خبرات وأدوات ودعم؛ ولا نضمن حب الكتابة أو الاستمرار.","لا يمكننا تقديم أي التزام."],"correct":2,"why":"يمكن ضمان شروط التجربة ومهنيتها، لا تحول داخلي محدد."},{"id":"f03","topic":"الهوية والغاية","q":"ما الاستخدام الأكثر اتساقًا مع وظيفة الكتابة في البرنامج؟","opts":["توفير فرصة لرؤية الفكرة والتأمل فيها وتجريب صياغات جديدة.","استخدامها وحدها أداة للكشف عن الشخصية.","إنتاج نص أدبي مثالي بنهاية كل جلسة.","تدريب جميع المشاركين على قالب واحد."],"correct":0,"why":"الكتابة وسيلة للتفكير والتعبير والتجريب وليست اختبار شخصية."},{"id":"f04","topic":"خريطة الرحلة ولغة التصميم","q":"في خبرة تريد توسيع مبادرة مشارك اعتاد انتظار الميسّر ليختار موضوع الكتابة، أي وصف يميّز بدقة بين الغاية والحركة والفعل الجوهري والنشاط؟","opts":["الغاية كتابة عشر جمل؛ الحركة إنهاؤها سريعًا؛ والفعل الجوهري تصحيح الميسّر لها.","الغاية إنتاج قصة مثالية؛ الحركة اتباع خطوات محددة؛ والفعل الجوهري اختيار الميسّر أفضل فكرة.","الغاية تنمية المبادرة؛ الحركة إتاحة اختيار مدخل للكتابة؛ والفعل الجوهري أن يختار المشارك بنفسه؛ والنشاط وسيلة يمكن تكييفها.","الغاية والحركة والفعل الجوهري والنشاط أسماء مختلفة لتمرين واحد."],"correct":2,"why":"الغاية اتجاه تربوي أوسع، والحركة تصف ما نريد إتاحته في الخبرة، والفعل الجوهري يبقى بيد المشارك، أما النشاط فهو وسيلة قابلة للتغيير."},{"id":"f05","topic":"القيم والشيفرات","q":"قال طفل «لا أملك أفكارًا». ما أول قراءة تربوية مناسبة؟","opts":["الخيال سمة غير موجودة لديه.","يجب كتابة القصة نيابة عنه.","قد يكون المدخل صعبًا؛ سأجرب سؤالًا أو وسيطًا آخر.","أطلب منه مغادرة النشاط."],"correct":2,"why":"الثقة بالإمكانات تعني فهم التعثر لا تصنيف صاحبه."},{"id":"f06","topic":"القيم والشيفرات","q":"اقترحت تعديلًا ولم يوافق عليه المشارك. ما القرار المناسب؟","opts":["تحترم اختياره وتناقش أثره عند الحاجة، ضمن حدود العمل.","تعدّل نصه دون علمه لأنه أفضل فنيًا.","ترفض تقديم الدعم لاحقًا.","تفرض التصحيح بوصفه شرطًا لقبوله."],"correct":0,"why":"ملكية المشارك حقيقية في شأن قرارات نصه.","critical":true},{"id":"f07","topic":"خريطة الرحلة ولغة التصميم","q":"يبادر مشارك بكتابة قصة خيالية، لكنه يتردد حين يُدعى لقراءة نصه بصوت مرتفع. كيف تفهم موقعه على خريطة الرحلة؟","opts":["المبادرة تعني أن الأمان لم يعد مطلوبًا في بقية رحلته.","أضعه في مستوى ثابت اسمه «المبادرة» وألزمه بالقراءة كي يتقدم.","قد تظهر المبادرة في موقف ويحتاج إلى الأمان والدعم في موقف آخر؛ المحطات اتجاهات مرنة لا تصنيفات للأشخاص.","تردده في القراءة يثبت أن كل محاولاته السابقة لم تكن ذات قيمة."],"correct":2,"why":"خريطة الرحلة تصف اتجاهات متداخلة في علاقة المشارك بالكتابة، والأمان حاضنة مستمرة؛ لا يُحكم على نموه أو تراجعه من موقف واحد."},{"id":"f08","topic":"القيم والشيفرات","q":"رفض مشارك قراءة نصه. ما الاستجابة الصحيحة؟","opts":["تفسر الرفض بوصفه اضطرابًا نفسيًا.","تضغط عليه لأن الإفصاح شرط للتعلم.","تحترم الرفض وتقترح متابعة لا تتطلب الإفصاح.","تهدده بأن الجلسة لن تحتسب."],"correct":2,"why":"حق عدم الإفصاح جزء من الأمان التربوي.","critical":true},{"id":"f09","topic":"القيم والشيفرات","q":"يريد المشارك وصف غابة اختارها بنفسه. كيف تعلّم الوصف؟","opts":["تقدّم نصك الأدبي لنسخه حرفيًا.","تسأله عمّا يريد للقارئ أن يراه، وتعرض أداة وصف تخدم غرضه.","تتركه دون أداة لأنه يجب أن يكون مستقلًا.","تفرض موضوعًا آخر لا يهمه."],"correct":1,"why":"المهارة تُعلّم داخل معنى يختاره المشارك."},{"id":"f10","topic":"القيم والشيفرات","q":"اختار مشارك نهاية غير سعيدة لمشهد. أي سؤال أنسب؟","opts":["أليس الأفضل أن ينتصر البطل؟","لماذا ترفض النهاية الصحيحة؟","ما الأثر الذي تريد أن تتركه النهاية لدى القارئ؟","هل تريد أن أكتب النهاية بدلًا منك؟"],"correct":2,"why":"السؤال يفتح المعنى دون أن يقود للإجابة المفضلة."},{"id":"f11","topic":"التوثيق وحدود المسؤولية","q":"دوّن ميسّر بعد جلسة أن المشارك اختار موضوعه بمساعدة سؤال واحد، لكن المشارك لا يرغب في إدراج مسودته الخاصة ضمن ملف الرحلة. ما التمييز الصحيح؟","opts":["يُدرج الميسّر جميع المسودات تلقائيًا لأن التوثيق وملف الرحلة شيء واحد.","يمكنه حفظ ملاحظة وصفية مهنية تساعده على التخطيط، ويُحترم اختيار المشارك بشأن ما يدخل ملف الرحلة وفق نظام المنصة.","يستبدل الميسّر المسودة بنص من كتابته حتى يبدو ملف الرحلة مكتملًا.","يمتنع عن أي توثيق وصفي لأن المشارك لم يرغب في مشاركة المسودة."],"correct":1,"why":"التوثيق الوصفي سجل مهني لشواهد تدعم قرارات التيسير، أما ملف الرحلة فيحفظ ما يختار المشارك الاحتفاظ به من أثر كتابته ضمن حدود المنصة."},{"id":"f12","topic":"الحضور والقرار التيسيري","q":"توقف مشارك عند بداية نشاط كتابي. أي استجابة تمثل الأبعاد الأربعة لحضور الميسّر بصورة متكاملة؟","opts":["أحكم بأنه يفتقر إلى الخيال، ثم أكتب الفقرة الأولى كي تتحسن النتيجة.","أكتفي بتشجيعه لفظيًا دون الانتباه لما يصعب عليه أو تقديم أداة عند الحاجة.","أهيّئ تعليمات واضحة، وألاحظ موضع التعثر، وأقدم سؤالًا أو أداة مناسبة، وأبقي اختيار الفكرة وصياغتها في يده.","أتبع مخطط الجلسة حرفيًا حتى لو ظهر أن المدخل لا يخدم المشارك."],"correct":2,"why":"تعمل أبعاد الحضور الأربعة معًا: تهيئة الشروط، والانتباه لما يحدث، والتدخل بقدر الحاجة، وحفظ ملكية المشارك لفعله وقراره."},{"id":"f13","topic":"الحضور والقرار التيسيري","q":"نص مشارك يحتوي انتقالًا غامضًا. أي تغذية راجعة مناسبة؟","opts":["أنت فوضوي في الكتابة.","جملتك سيئة؛ أعد كتابة كل شيء.","انتقل البطل من الحديقة إلى المنزل دون توضيح؛ هل نراجع هذا الانتقال؟","ممتاز ولا يحتاج شيء إلى تطوير."],"correct":2,"why":"الملاحظة محددة ومحترمة وقابلة للمراجعة."},{"id":"f14","topic":"الحضور والقرار التيسيري","q":"قال الطفل: «اكتب أنت ما بقي». ما التدخل المتزن؟","opts":["إكمال القصة ليشعر بالنجاح.","تقديم سؤال أو بديلين يساعدانه على توليد حدث ثم إعادة الفعل إليه.","تركه صامتًا مهما استمر تعثره.","إعطاؤه نهاية إلزامية."],"correct":1,"why":"تجنب الاستحواذ والانسحاب؛ قدّم دعمًا مناسبًا."},{"id":"f15","topic":"القيم والشيفرات","q":"كتبت مشاركة قصة عن صديقة وحيدة. أي استنتاج مقبول؟","opts":["الكتابة تثبت أنها تشعر بالوحدة.","ينبغي طلب الاعتراف بتجربة شخصية.","من حقنا تشخيص حالتها من النص.","نسأل عن مقصد الشخصية في القصة دون نسبة التجربة إلى صاحبتها."],"correct":3,"why":"لا تفسر ذات المشارك من خياله.","critical":true},{"id":"f16","topic":"خريطة الرحلة ولغة التصميم","q":"بدأ مشارك يستخدم خريطة أفكار من تلقاء نفسه. ما ملاحظتك الأدق؟","opts":["استخدم خريطة أفكار سبق تعلمها دون أن أطلب منه ذلك هذه المرة.","أصبح قادرًا على الاستقلال في حياته كلها.","يمكنني الآن الامتناع عن المساعدة إلى الأبد.","ثبت أن الجميع يحتاج الخريطة نفسها."],"correct":0,"why":"الوصف المحدد أدق من الحكم الشامل."},{"id":"f17","topic":"التوثيق وحدود المسؤولية","q":"ظهر في جدول ميسّر مشارك جديد أُدرجت جلساته عبر المنصة. ما التوزيع الصحيح للمسؤوليات بين الإدارة والميسّر؟","opts":["يجمع الميسّر موافقات الأسرة ويضع سياسة الخصوصية بنفسه قبل كل لقاء.","يمكن للميسّر مشاركة النصوص كيفما شاء ما دامت الإدارة تدير الخصوصية.","لا تعنيه أي حدود مهنية ما دام إعداد الموافقات من اختصاص الإدارة.","تتولى الإدارة الموافقات والسياسات والتنظيم؛ ويباشر الميسّر عمله التربوي ملتزمًا بالخصوصية والقنوات المعتمدة، ويحيل ما يتجاوز دوره إليها."],"correct":3,"why":"الموافقات والحفظ والصلاحيات إجراءات مؤسسية، أما حفظ كرامة المشارك وخصوصيته وحدود العلاقة والإحالة عند الحاجة فهي التزامات مهنية للميسّر."},{"id":"f18","topic":"التوثيق وحدود المسؤولية","q":"ظهر أثناء الجلسة مؤشر جدي يشير إلى خطر على سلامة مشارك. ما حدود دورك المهني؟","opts":["تَعِده بسرية مطلقة مهما كان الخطر.","تتجاهل المؤشر لأن أي نص قد يكون خياليًا.","تبدأ تحقيقًا شخصيًا أو تشخيصًا نفسيًا وتتخذ قرار الحماية بمفردك.","تستجيب بهدوء وتحيل الأمر عبر مسار الحماية المعتمد لدى الإدارة، دون تحقيق أو تشخيص خارج دورك."],"correct":3,"why":"لا تُسقط الخصوصية واجب الإحالة عند ظهور مؤشر جدي؛ الإدارة تحدد مسار الحماية، ويلتزم الميسّر بحدوده المهنية دون التحقيق أو التشخيص.","critical":true},{"id":"f19","topic":"الحضور والقرار التيسيري","q":"في اللقاء الأول اختار مشارك فكرة من تلقاء نفسه، ثم احتاج إلى مساعدة عند كتابة أول جملة. ما الاستجابة التي تربط قراءة الشواهد بتصميم الخبرة التالية؟","opts":["أقرر أنه أصبح مستقلًا تمامًا لأن اختياره الأول كافٍ للحكم على رحلته.","أوثق اختياره وما احتاج إليه من دعم، وأهيّئ خبرة تسمح له بتجريب صياغة أولى بمساندة مناسبة مع بقاء الصياغة والقرار له.","أصنفه بأنه غير قادر على الكتابة، وأختار كل أفكاره المقبلة.","أحذف ملاحظة التعثر لأنها تتعارض مع ملاحظة المبادرة."],"correct":1,"why":"تصف الشواهد ما حدث فعلًا، وتساعد على اختيار حركة تربوية واقعية؛ الجمع بين دعم الصياغة وحفظ الفعل الجوهري أهم من تصنيف المشارك."},{"id":"f20","topic":"الهوية والغاية","q":"ما معنى اجتياز اختبار هذه المرحلة؟","opts":["تحقق الحد المطلوب من فهم المبادئ التأسيسية، ويبقى تقييم الأداء العملي لاحقًا.","اعتماد نهائي لإدارة جميع الجلسات.","ضمان تحقق النمو لدى المشاركين.","إلغاء الحاجة إلى الاطلاع على دليل الحماية."],"correct":0,"why":"الاختبار النظري خطوة ضمن التأهيل وليس اعتمادًا مهنيًا شاملًا."}],"topics":["الهوية والغاية","القيم والشيفرات","خريطة الرحلة ولغة التصميم","الحضور والقرار التيسيري","التوثيق وحدود المسؤولية"]}
$seed$::jsonb
)
on conflict (id) do nothing;
