-- ═══════════════════════════════════════════════════════════════
-- إصلاحات مراجعة Supabase (Security + Performance Advisor)
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — طلب تامر (٢٤ أكتوبر): «راجع سوبابيز وقدّم الإصلاحات اللازمة».
--
-- التقرير وقت الكتابة:
--   أمان:  ٣ أخطاء · ٢ search_path · ٢١ دالة للزوار · ١٠١ دالة للمسجّلين ·
--          ٢ جدول RLS من غير صلاحيات · حماية كلمات السر المسرّبة مقفولة
--   أداء:  ٩٠ صلاحية بتعيد حساب المستخدم لكل صف · ٣٤٢ صلاحية مكرّرة ·
--          ٥٦ مفتاح ربط من غير فهرس · ٤٧ فهرس مش مستخدم
--
-- ── اللي بيتصلّح هنا ─────────────────────────────────────────
--
--   ١) `story_project_buyer` — **الثغرة الوحيدة الحقيقية.** بترجّع رقم
--      حساب المشتري لأي مشروع قصة، وأي حد (حتى من غير تسجيل) كان يقدر
--      يناديها. بتتستعمل جوّه دوال داخلية بس → بتتقفل على الكل.
--
--   ٢) صلاحية التنفيذ من الزوار (`anon`) على دوال مش ليهم:
--        • دوال المحفّزات (Triggers) — مابتتنادَاش مباشرة أصلًا
--        • معاينة القصة (`my_story_previews` / `story_preview_decide`)
--          — للعميل المسجّل بس
--        • `ad_click_counts` (للإدارة) و`valid_applies_to` (للوحة)
--      ⚠️ صلاحية المحفّز مابتتفحصش وقت ما المحفّز يشتغل — بتتفحص وقت
--         إنشائه بس. يعني السحب مابيوقفش أي حماية.
--
--   ٣) `search_path` ثابت لدالتين (`box_shipment_due` و`touch_ads_updated_at`).
--
--   ٤) **الأداء — ٩٠ صلاحية:** `auth.uid()` ← `(select auth.uid())`.
--      المعنى واحد بالظبط؛ الفرق إن Postgres بيحسبها مرة للاستعلام
--      بدل مرة لكل صف. بتتولّد من القاعدة نفسها وقت التشغيل (مش نص
--      منسوخ)، وتشغيلها تاني مابيغيّرش حاجة.
--
--   ٥) **الأداء — فهرس لكل مفتاح ربط من غير فهرس** (٥٦). برضه بيتولّد
--      وقت التشغيل، و`if not exists`.
--
-- ── اللي **مش** بيتصلّح هنا، وليه ───────────────────────────
--
--   • الـ٣ «أخطاء» (`aqlam_public_writers/posts/comments` — Security
--     Definer View): **مقصودة.** دي النوافذ اللي الزوار بيشوفوا منها
--     نصوص «أقلام الرحلة» المنشورة وصفحات الكتّاب، وبتعرض أعمدة آمنة
--     بس (مفيش تاريخ ميلاد ولا رقم حساب). تحويلها زي ما المراجعة بتقول
--     كان هيقفل الصفحات العامة على الزوار — وده اتجرّب واتصلّح في
--     `20261017120000_aqlam_public_views_anon_fix`.
--   • باقي الـ٢١ دالة للزوار (`is_admin` / `is_instructor` / … و
--     `public_instructors` و`join_request_*`): صلاحيات الجداول العامة
--     بتناديها، وصفحات الزوار بتستعملها. سحبها بيكسر الموقع للزوار.
--   • الـ١٠١ دالة للمسجّلين: دي واجهة الموقع (الطلب، الحجز، الدفع…)،
--     وكل واحدة بتتأكد من صاحب الطلب جوّاها.
--   • جدولين RLS من غير صلاحيات (`stale_order_notification_outbox`،
--     `work_task_sweeps`): داخليين للمهام المجدولة — «مقفول على الكل»
--     هو المطلوب بالظبط.
--   • الصلاحيات المكرّرة (٣٤٢): دمجها إعادة كتابة لصلاحيات الموقع كله
--     — مخاطرة كبيرة على مكسب صغير بحجم البيانات الحالي. تتعمل لوحدها
--     بعدين لو الموقع كبر.
--   • الفهارس المش مستخدمة (٤٧): القاعدة جديدة، والإحصائيات قصيرة —
--     فهرس «مش مستخدم» النهارده ممكن يكون لشاشة بتتفتح مرة في الشهر.
--   • حماية كلمات السر المسرّبة: **إعداد في لوحة Supabase**، مش SQL.
--
-- الأثر
--   • مفيش بيانات بتتغيّر. صلاحيات تنفيذ + فهارس + نص صلاحيات بنفس المعنى.
--   • إنشاء الفهارس بيقفل الكتابة على الجدول لحظات (الجداول صغيرة).
--
-- التحقق
--   أعد تشغيل المراجعة في Supabase (Advisors ← Rerun linter):
--     • auth_rls_initplan ← صفر
--     • unindexed_foreign_keys ← صفر
--     • function_search_path_mutable ← صفر
--     • anon_security_definer_function_executable ← أقل بـ٨
--
-- الرجوع للخلف
--   • الصلاحيات: `grant execute on function … to anon` للدالة المطلوبة.
--   • الفهارس: `drop index if exists public.<اسم>_fkidx`.
--   • نص الصلاحيات: نفس المعنى، مفيش داعي للرجوع.
-- ═══════════════════════════════════════════════════════════════

-- ── ١) الثغرة: رقم مشتري أي مشروع قصة ──────────────────────
revoke execute on function public.story_project_buyer(uuid) from public, anon, authenticated;

-- ── ٢) دوال مش للزوار ───────────────────────────────────────
-- المحفّزات: مابتتنادَاش من برّه أصلًا.
revoke execute on function public.guard_child_age_override()     from public, anon, authenticated;
revoke execute on function public.guard_course_booking_rules()   from public, anon, authenticated;
revoke execute on function public.guard_order_item_addons()      from public, anon, authenticated;
revoke execute on function public.close_payouts_for_withdrawal() from public, anon, authenticated;
revoke execute on function public.touch_ads_updated_at()         from public, anon, authenticated;

-- للمسجّلين بس.
revoke execute on function public.my_story_previews(uuid)                    from public, anon;
revoke execute on function public.story_preview_decide(uuid, boolean, text) from public, anon;
revoke execute on function public.ad_click_counts()                          from public, anon;
revoke execute on function public.valid_applies_to(text[])                   from public, anon;
grant  execute on function public.my_story_previews(uuid)                    to authenticated;
grant  execute on function public.story_preview_decide(uuid, boolean, text) to authenticated;
grant  execute on function public.ad_click_counts()                          to authenticated;
grant  execute on function public.valid_applies_to(text[])                   to authenticated;

-- ── ٣) search_path ثابت ─────────────────────────────────────
alter function public.box_shipment_due(timestamptz, integer) set search_path = public;
alter function public.touch_ads_updated_at() set search_path = public;

-- ── ٤) الصلاحيات: المستخدم يتحسب مرة للاستعلام ──────────────
--
-- ⚠️ `(?<!SELECT )`: Postgres بيكتب `(select auth.uid())` بعد الحفظ
--    على شكل `( SELECT auth.uid() AS uid)` — فالشرط ده بيخلّي التشغيل
--    التاني مايلفّهاش مرة كمان.
do $$
declare
  r       record;
  v_re    constant text := '(?<!SELECT )auth\.(uid|jwt|role)\(\)';
  v_sql   text;
  v_count integer := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ v_re or coalesce(with_check, '') ~ v_re)
  loop
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then
      v_sql := v_sql || ' using (' || regexp_replace(r.qual, v_re, '(select auth.\1())', 'g') || ')';
    end if;
    if r.with_check is not null then
      v_sql := v_sql || ' with check (' || regexp_replace(r.with_check, v_re, '(select auth.\1())', 'g') || ')';
    end if;
    execute v_sql;
    v_count := v_count + 1;
  end loop;
  raise notice 'صلاحيات اتعدّلت: %', v_count;
end $$;

-- ── ٥) فهرس لكل مفتاح ربط مالوش فهرس ────────────────────────
do $$
declare
  r       record;
  v_name  text;
  v_count integer := 0;
begin
  for r in
    select c.conrelid::regclass as tbl,
           cl.relname          as tname,
           c.conname,
           array_agg(a.attname order by k.ord) as cols,
           c.conkey
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
      cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.contype = 'f'
       -- مفيش فهرس أول أعمدته هي أعمدة المفتاح نفسها
       and not exists (
         select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] = c.conkey
       )
     group by c.conrelid, cl.relname, c.conname, c.conkey
  loop
    v_name := left(r.tname || '_' || array_to_string(r.cols, '_'), 55) || '_fkidx';
    execute format('create index if not exists %I on %s (%s)',
                   v_name, r.tbl,
                   (select string_agg(quote_ident(x), ', ') from unnest(r.cols) x));
    v_count := v_count + 1;
  end loop;
  raise notice 'فهارس اتعملت: %', v_count;
end $$;
