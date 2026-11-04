-- ═══════════════════════════════════════════════════════════════
-- التأهيل التأسيسي: إعدادات في لوحة التحكم + إخفاء إجابات التقييم النهائي
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — قرار تامر (٢٧ أكتوبر):
--   ١) «يفضّل يكون في لوحة التحكم كل ما هو ممكن» — الوقت المتوقع ومدة
--      التوقف التلقائي كانوا مكتوبين في الكود.
--   ٢) «في التقييم النهائي ماتظهرش للمدرب الإجابات الصحيحة، مع بقاء إعادة
--      التقييم. ومفيش مشكلة نحدّد له الوحدات اللي محتاجة مراجعة».
--
-- ── اللي بيتعمل ─────────────────────────────────────────────
--
--   • أعمدة جديدة في `training_courses`:
--       estimate_min_minutes / estimate_max_minutes   (٤٥ / ٦٠)
--       idle_minutes                                  (٣)
--       topic_modules  jsonb  {"المجال": [رقم الوحدة من 0, ...]}
--         ← بيربط مجالات التقييم النهائي بالوحدات، عشان التقرير يقول
--           «راجع الوحدة كذا». بيتملا مبدئيًا من عناوين النسخة الحالية،
--           والإدارة بتعدّله من الشاشة.
--   • `training_submit_final` بقت **مابترجّعش** الإجابة الصحيحة ولا التعليل
--     ولا صح/غلط لكل سؤال — بترجّع الدرجة ونتيجة كل مجال والوحدات اللي
--     محتاجة مراجعة بس.
--     ⚠️ الإخفاء في القاعدة مش في الشاشة: لو اتخفت في الشاشة بس، أي حد
--        يفتح أدوات المتصفح كان هيقراها من رد السيرفر.
--   • `training_course_for_me` بترجّع الوقت المتوقع ومدة التوقف.
--
-- الأثر
--   • ٤ أعمدة بقيم افتراضية. مفيش بيانات بتتمسح. المحاولات القديمة زي ما هي.
--
-- الترتيب
--   بعد `20261025120000_foundation_training`.
--
-- التحقق
--   1) select estimate_min_minutes, estimate_max_minutes, idle_minutes, topic_modules
--        from training_courses;                    ← 45 | 60 | 3 | {…المجالات…}
--   2) select pg_get_functiondef('public.training_submit_final'::regproc) like '%''why''%';
--        ← false
--
-- الرجوع للخلف
--   شغّل تعريف `training_submit_final` من ملف 20261025120000 تاني.
--   (الأعمدة سيبها — مابتكسرش حاجة.)
-- ═══════════════════════════════════════════════════════════════

alter table public.training_courses
  add column if not exists estimate_min_minutes smallint not null default 45,
  add column if not exists estimate_max_minutes smallint not null default 60,
  add column if not exists idle_minutes         smallint not null default 3,
  add column if not exists topic_modules        jsonb    not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'training_courses_settings_chk') then
    alter table public.training_courses add constraint training_courses_settings_chk check (
      estimate_min_minutes between 1 and 1000
      and estimate_max_minutes between estimate_min_minutes and 1000
      and idle_minutes between 1 and 60
      and jsonb_typeof(topic_modules) = 'object'
    );
  end if;
end $$;

comment on column public.training_courses.topic_modules is
  'مجالات التقييم النهائي ← أرقام الوحدات (من 0). تقرير المدرب بيقول «راجع الوحدات دي» للمجالات اللي غلط فيها.';

-- ربط مبدئي من عناوين الوحدات الحالية — مرة واحدة (لو لسه فاضي).
update public.training_courses c
   set topic_modules = coalesce((
     select jsonb_object_agg(t.topic, t.mods)
       from (
         select tp.topic,
                coalesce(jsonb_agg(m.idx order by m.idx) filter (where m.idx is not null), '[]'::jsonb) as mods
           from jsonb_array_elements_text(c.content -> 'topics') as tp(topic)
           left join lateral (
             select (o - 1)::int as idx
               from jsonb_array_elements(c.content -> 'modules') with ordinality x(mm, o)
              where case tp.topic
                      when 'الهوية والغاية'             then mm ->> 'title' like '%التعرّف%' or mm ->> 'title' like '%الرؤية%'
                      when 'القيم والشيفرات'            then mm ->> 'title' like '%القيم%' or mm ->> 'title' like '%الشيفرات%'
                      when 'خريطة الرحلة ولغة التصميم'  then mm ->> 'title' like '%خريطة%'
                      when 'الحضور والقرار التيسيري'    then mm ->> 'title' like '%القيم الخمس%' or mm ->> 'title' like '%التفكير بمنهجية%'
                      when 'التوثيق وحدود المسؤولية'    then mm ->> 'title' like '%التعرّف%' or mm ->> 'title' like '%التفكير بمنهجية%'
                      else false
                    end
           ) m on true
          group by tp.topic
       ) t
   ), '{}'::jsonb)
 where c.topic_modules = '{}'::jsonb
   and jsonb_typeof(c.content -> 'topics') = 'array';

-- ── المحتوى للمدرب: + الوقت المتوقع ومدة التوقف ─────────────
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
    'estimateMin', v_c.estimate_min_minutes,
    'estimateMax', v_c.estimate_max_minutes,
    'idleMinutes', v_c.idle_minutes,
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

-- ── التقييم النهائي: من غير الإجابات الصحيحة ────────────────
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
  v_ok       boolean;
  v_crit     boolean;
  v_topic    text;
  v_stats    jsonb := '{}'::jsonb;   -- {"المجال": {"correct":n,"total":n}}
  v_selected jsonb := '{}'::jsonb;
  v_correct  integer := 0;
  v_cc       integer := 0;
  v_ct       integer := 0;
  v_score    integer;
  v_passed   boolean;
  v_id       uuid;
  v_topics   jsonb;
  v_review   jsonb;
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
    v_ok    := v_sel = (v_q ->> 'correct')::int;
    v_crit  := coalesce((v_q ->> 'critical')::boolean, false);
    v_topic := coalesce(nullif(v_q ->> 'topic', ''), 'عام');
    if v_ok then v_correct := v_correct + 1; end if;
    if v_crit then
      v_ct := v_ct + 1;
      if v_ok then v_cc := v_cc + 1; end if;
    end if;
    v_stats := jsonb_set(v_stats, array[v_topic], jsonb_build_object(
      'correct', coalesce((v_stats -> v_topic ->> 'correct')::int, 0) + case when v_ok then 1 else 0 end,
      'total',   coalesce((v_stats -> v_topic ->> 'total')::int, 0) + 1
    ), true);
    v_selected := v_selected || jsonb_build_object(coalesce(v_q ->> 'id', i::text), v_sel);
  end loop;

  v_score  := round(v_correct * 100.0 / v_n);
  v_passed := v_score >= v_c.final_pass_pct and (not v_c.critical_required or v_cc = v_ct);

  -- نتيجة كل مجال (بترتيب المجالات في الدورة)، والوحدات المرتبطة باللي فيه غلط.
  select coalesce(jsonb_agg(jsonb_build_object(
           'topic', s.key,
           'correct', (s.value ->> 'correct')::int,
           'total', (s.value ->> 'total')::int
         ) order by coalesce(t.ord, 1000), s.key), '[]'::jsonb)
    into v_topics
    from jsonb_each(v_stats) s
    left join jsonb_array_elements_text(v_c.content -> 'topics') with ordinality t(name, ord) on t.name = s.key;

  select coalesce(jsonb_agg(distinct m.idx order by m.idx), '[]'::jsonb)
    into v_review
    from jsonb_each(v_stats) s
    cross join lateral jsonb_array_elements_text(coalesce(v_c.topic_modules -> s.key, '[]'::jsonb)) as m0(v)
    cross join lateral (select m0.v::int as idx) m
   where (s.value ->> 'correct')::int < (s.value ->> 'total')::int
     and m0.v ~ '^\d+$' and m0.v::int < v_mods;

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

  -- ⚠️ مفيش `rows` تاني: لا الإجابة الصحيحة ولا التعليل ولا صح/غلط لكل سؤال.
  return jsonb_build_object(
    'attemptId', v_id,
    'score', v_score, 'correct', v_correct, 'total', v_n,
    'criticalCorrect', v_cc, 'criticalTotal', v_ct,
    'passed', v_passed, 'passPct', v_c.final_pass_pct,
    'topics', v_topics,
    'reviewModules', v_review
  );
end $$;
