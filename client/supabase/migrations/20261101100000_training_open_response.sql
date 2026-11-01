-- ═══════════════════════════════════════════════════════════════
-- التأهيل التأسيسي V1.5: سؤال الكتابة المفتوح + مراجعة الإدارة لكل فئة عمرية
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — طلب تامر (١ نوفمبر):
--   ١) ملف V1.5 فيه سؤال ٢٥ «كيف تساند المشارك ليبدأ؟»: كتابة حرّة لكل سن
--      (٧، ١١، ١٥، ١٩) + حوار قصير. مالوش إجابة صحيحة — بياخد نقطة
--      «إتمام» لو اتكتب فيه حاجة (زي الملف بالظبط)، والمضمون للإدارة.
--   ٢) الإدارة تقرا إجابات السؤال ده + إشارات أسئلة الفئات (adminBand)
--      وتسجّل ترشيحها للمدرب لكل فئة عمرية.
--
-- ⚠️ الترشيح قرار الإدارة — الملف نفسه بيقول «لا توصية آلية»؛ الشاشة بتعرض
--    إشارات بس (إجابات مواقف الفئات + ملاحظات المتابعة).
-- ⚠️ المدرب مابيشوفش adminBand ولا ملاحظات المتابعة ولا مراجعة الإدارة.
--
-- الأثر:
--   - training_final_attempts: + open_answers، admin_review، reviewed_by، reviewed_at
--   - training_course_for_me: بيشيل adminBand كمان من الأسئلة.
--   - training_submit_final: بيقبل إجابة السؤال المفتوح (كائن نصوص).
--   - training_review_attempt: جديدة — الإدارة تسجّل الترشيح.
--   المحاولات القديمة زي ما هي (الأعمدة الجديدة null).
-- الترتيب: بعد `20261027090000_training_settings_and_hidden_answers`.
--   ⚠️ شغّله **قبل** رفع ملف V1.5 من لوحة التحكم.
-- التحقق:
--   select column_name from information_schema.columns
--    where table_name = 'training_final_attempts' and column_name in ('open_answers','admin_review');
-- الرجوع:
--   drop function if exists public.training_review_attempt(uuid, jsonb);
--   ثم تشغيل نسخة الدالتين من `20261027090000_...` (الأعمدة الجديدة ممكن تفضل).
-- ═══════════════════════════════════════════════════════════════

alter table public.training_final_attempts
  add column if not exists open_answers jsonb,
  add column if not exists admin_review jsonb,
  add column if not exists reviewed_by  uuid references public.user_profiles(id) on delete set null,
  add column if not exists reviewed_at  timestamptz;

create index if not exists training_final_attempts_reviewed_by_fkidx
  on public.training_final_attempts (reviewed_by);

-- ── المحتوى للمدرب: من غير adminBand كمان ────────────────────
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
      select jsonb_agg(q - 'correct' - 'why' - 'critical' - 'adminBand' - 'adminReview' order by qo)
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

-- ── التقييم النهائي: + السؤال المفتوح ────────────────────────
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
  v_a        jsonb;
  v_sel      integer;
  v_ok       boolean;
  v_crit     boolean;
  v_topic    text;
  v_stats    jsonb := '{}'::jsonb;   -- {"المجال": {"correct":n,"total":n}}
  v_selected jsonb := '{}'::jsonb;
  v_open     jsonb := '{}'::jsonb;   -- {"q_id": {"field": "نص"}}
  v_clean    jsonb;
  v_field    jsonb;
  v_text     text;
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
    v_q := v_qs -> i;
    v_a := p_answers -> i;

    -- سؤال الكتابة: نقطة «إتمام» لو اتكتب أي حاجة — مضمونه للإدارة.
    if v_q ->> 'type' = 'open_response' then
      v_clean := '{}'::jsonb;
      if jsonb_typeof(v_a) = 'object' then
        for v_field in select f from jsonb_array_elements(coalesce(v_q -> 'fields', '[]'::jsonb)) f loop
          v_text := left(btrim(coalesce(v_a ->> (v_field ->> 'id'), '')), 16000);
          if v_text <> '' then
            v_clean := v_clean || jsonb_build_object(v_field ->> 'id', v_text);
          end if;
        end loop;
        -- اختيار السن اللي اتكتب عنه الحوار (V1.5).
        if coalesce(v_a ->> 'dialogueAge', '') ~ '^[a-z0-9_]{1,40}$' then
          v_clean := v_clean || jsonb_build_object('dialogueAge', v_a ->> 'dialogueAge');
        end if;
      end if;
      v_open := v_open || jsonb_build_object(coalesce(v_q ->> 'id', i::text), v_clean);
      if exists (select 1 from jsonb_each_text(v_clean) e where e.key <> 'dialogueAge') then
        v_correct := v_correct + 1;
      end if;
      continue;
    end if;

    v_sel := case when jsonb_typeof(v_a) = 'number' then (p_answers ->> i)::int end;
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
      (user_id, course_id, course_version, selected, open_answers, correct, total, score,
       critical_correct, critical_total, passed)
    values (v_uid, p_course, v_c.version, v_selected, nullif(v_open, '{}'::jsonb), v_correct, v_n, v_score,
            v_cc, v_ct, v_passed)
    returning id into v_id;

    update public.training_progress
       set final_attempts = final_attempts + 1,
           best_score     = greatest(coalesce(best_score, 0), v_score),
           passed_at      = coalesce(passed_at, case when v_passed then now() end),
           passed_version = case when passed_at is null and v_passed then v_c.version else passed_version end,
           last_seen_at   = now()
     where user_id = v_uid and course_id = p_course;
  end if;

  -- ⚠️ مفيش `rows`: لا الإجابة الصحيحة ولا التعليل ولا صح/غلط لكل سؤال.
  return jsonb_build_object(
    'attemptId', v_id,
    'score', v_score, 'correct', v_correct, 'total', v_n,
    'criticalCorrect', v_cc, 'criticalTotal', v_ct,
    'passed', v_passed, 'passPct', v_c.final_pass_pct,
    'topics', v_topics,
    'reviewModules', v_review
  );
end $$;

-- ── مراجعة الإدارة: ترشيح المدرب لكل فئة عمرية ──────────────
-- p_review = {"bands": {"A": "recommended"|"followup"|"not_yet", ...}, "note": "..."}
create or replace function public.training_review_attempt(p_attempt uuid, p_review jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bands jsonb := '{}'::jsonb;
  v_note  text;
  v_row   record;
begin
  if not public.admin_has_permission('canManageInstructors') then
    raise exception 'للإدارة بس' using errcode = '42501';
  end if;
  if jsonb_typeof(p_review) <> 'object' then
    raise exception 'مراجعة غير مفهومة' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_bands
    from jsonb_each_text(coalesce(p_review -> 'bands', '{}'::jsonb)) e
   where e.key in ('A', 'B', 'C', 'DE')
     and e.value in ('recommended', 'followup', 'not_yet');
  v_note := nullif(left(btrim(coalesce(p_review ->> 'note', '')), 4000), '');

  update public.training_final_attempts
     set admin_review = jsonb_build_object('bands', v_bands, 'note', v_note),
         reviewed_by  = auth.uid(),
         reviewed_at  = now()
   where id = p_attempt
  returning id, user_id into v_row;
  if not found then
    raise exception 'المحاولة مش موجودة' using errcode = '23503';
  end if;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'userId', v_row.user_id);
end $$;

revoke execute on function public.training_review_attempt(uuid, jsonb) from public, anon;
grant execute on function public.training_review_attempt(uuid, jsonb) to authenticated;
