-- ═══════════════════════════════════════════════════════════════
-- صحة النظام — أرقام حيّة لتبويب «خريطة البيانات» في لوحة التحكم
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — طلب تامر (٢٧ أكتوبر): «تبويب خاص في لوحة التحكم يساعدنا في
-- الرؤية والفهم». الخريطة نفسها في الكود؛ الدالة دي بتديها الأرقام الحيّة
-- اللي بتحدد لون كل نقطة تكدّس (المهام المتأخرة، المهام من غير مسؤول، حجم
-- الجداول، أبطأ الاستعلامات…).
--
-- ⚠️ قراءة بس. ومحصورة على اللي عنده «السجلات والتدقيق» (canViewAuditLogs).
-- ⚠️ SECURITY DEFINER عشان تقرا إحصائيات Postgres (pg_stat_statements) اللي
--    المستخدم العادي مايشوفهاش — وبترجّع أرقام ونص مختصر للاستعلام بس.
--
-- الأثر: دالة واحدة. مفيش جداول ولا بيانات بتتغيّر.
-- الترتيب: بعد `20261027100000_ops_assignment_and_retention`.
-- التحقق: select public.ops_health() ->> 'db_size';  (من حساب إداري)
-- الرجوع: drop function if exists public.ops_health();
-- ═══════════════════════════════════════════════════════════════

create or replace function public.ops_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_slow jsonb := '[]'::jsonb;
  v_hot  jsonb := '[]'::jsonb;
begin
  if not public.admin_has_permission('canViewAuditLogs') then
    raise exception 'للإدارة بس' using errcode = '42501';
  end if;

  -- أبطأ الاستعلامات وأكترها تكرارًا (لو الإضافة متفعّلة).
  begin
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_slow from (
      select round(s.mean_exec_time::numeric, 1) as mean_ms, s.calls,
             coalesce(substring(s.query from '"public"\."([a-z_0-9]+)"'),
                      left(regexp_replace(s.query, '\s+', ' ', 'g'), 80)) as q
        from pg_stat_statements s
        join pg_roles r on r.oid = s.userid
       where r.rolname in ('authenticated', 'anon', 'service_role')
         and s.calls >= 5
       order by s.mean_exec_time desc
       limit 6
    ) x;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_hot from (
      select s.calls, round(s.total_exec_time::numeric, 0) as total_ms,
             coalesce(substring(s.query from '"public"\."([a-z_0-9]+)"'),
                      left(regexp_replace(s.query, '\s+', ' ', 'g'), 80)) as q
        from pg_stat_statements s
        join pg_roles r on r.oid = s.userid
       where r.rolname in ('authenticated', 'anon', 'service_role')
         and s.query not ilike '%set_config%'
       order by s.calls desc
       limit 6
    ) x;
  exception when others then
    v_slow := '[]'::jsonb;
    v_hot := '[]'::jsonb;
  end;

  return jsonb_build_object(
    'at', now(),
    'db_size_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'connections', (select count(*) from pg_stat_activity),
    'max_connections', current_setting('max_connections')::int,
    'tables', (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'),
    'functions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace),
    'triggers', (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
                  where c.relnamespace = 'public'::regnamespace and not t.tgisinternal),
    'policies', (select count(*) from pg_policies where schemaname = 'public'),

    'tasks', (select coalesce(jsonb_agg(x order by x.line), '[]'::jsonb) from (
      select line,
             count(*) as open,
             count(*) filter (where due_at < now()) as overdue,
             count(*) filter (where coalesce(cardinality(assignee_ids), 0) = 0) as unassigned,
             min(due_at) filter (where due_at < now()) as oldest_due
        from work_tasks where status = 'open' group by line) x),

    'studio', jsonb_build_object(
      'open', (select count(*) from story_projects sp
                where sp.status not in (select step from task_steps where line = 'studio' and kind in ('done', 'cancel'))),
      'no_owner', (select count(*) from story_projects sp
                    join task_steps ts on ts.line = 'studio' and ts.step = sp.status
                   where ts.kind not in ('done', 'cancel')
                     and ((ts.owner_kind = 'editor' and sp.editor_id is null)
                       or (ts.owner_kind = 'art_lead' and sp.art_lead_id is null))),
      'rules', (select count(*) from assignment_rules where line = 'studio'),
      'role_members', (select count(*) from user_profiles u join admin_roles r on r.id = u.admin_role_id
                        where u.archived_at is null
                          and ('canWorkStudio' = any (r.permissions) or 'canManageStudio' = any (r.permissions)))
    ),

    'rules_by_line', (select coalesce(jsonb_object_agg(line, n), '{}'::jsonb)
                        from (select line, count(*) n from assignment_rules group by line) x),

    'rows', jsonb_build_object(
      'notifications', (select count(*) from notifications),
      'notifications_old_read', (select count(*) from notifications where is_read and created_at < now() - interval '90 days'),
      'audit_logs', (select count(*) from audit_logs),
      'work_task_events', (select count(*) from work_task_events),
      'payment_events', (select count(*) from payment_events),
      'orders', (select count(*) from orders),
      'orders_pending', (select count(*) from orders where status = 'pending')
    ),

    'checks', jsonb_build_object(
      'audit_index', exists (select 1 from pg_indexes where indexname = 'audit_logs_created_at_idx'),
      'retention', exists (select 1 from pg_proc where proname = 'ops_retention_sweep'),
      'autoassign', exists (select 1 from pg_trigger where tgname = 'story_projects_zz_autoassign_trg'),
      'batch_reviews', exists (select 1 from pg_proc where proname = 'my_story_image_reviews_all')
    ),

    'slow', v_slow,
    'hot', v_hot
  );
end $$;

revoke execute on function public.ops_health() from public, anon;
grant execute on function public.ops_health() to authenticated;
