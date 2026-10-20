-- ============================================================================
-- اختبار التشديد الأمني (migration 20261014205714) — يدوي، داخل معاملة تُلغى
-- ============================================================================
-- التشغيل : SQL editor. بيرمي استثناءً في الآخر برسالة RESULT فيها النتائج
--           (ده المقصود — عشان المعاملة كلها تتلغي ولا يبقى أثر).
-- المتوقع : links: الداخلية true والباقي false · anon_guard_order_fields=false ·
--           anon_is_admin_still=true (سياسات RLS محتاجاها) · trigger_update_rows=1 ·
--           notified>=1 · last_title_len=120 · last_msg_len=500 · last_link=null ·
--           remaining_trigger_fns_with_anon=0 · reset_due_cfg=["search_path=public"]
-- ============================================================================
begin;
do $t$
declare
  v_uid uuid;
  v_out jsonb := '{}'::jsonb;
  v_n integer;
  v_row record;
begin
  v_out := v_out || jsonb_build_object('links', (
    select jsonb_agg(jsonb_build_object('s', s, 'ok', public.is_internal_link(s)) order by ord)
    from (values (1,'/dashboard/admin/orders/1'),(2,'/'),(3,null),(4,'//evil.com'),(5,'https://evil.com'),
                 (6,E'/\\evil'),(7,'javascript:alert(1)'),(8,'/a b'),(9,''),(10,'/x'||repeat('a',301))) t(ord,s)));
  v_out := v_out || jsonb_build_object(
    'anon_guard_order_fields', has_function_privilege('anon','public.guard_order_fields()','EXECUTE'),
    'anon_is_admin_still', has_function_privilege('anon','public.is_admin()','EXECUTE'),
    'reset_due_cfg', (select proconfig from pg_proc where oid='public.reset_due_notifications()'::regprocedure),
    'remaining_trigger_fns_with_anon', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.prorettype='trigger'::regtype and has_function_privilege('anon', p.oid, 'EXECUTE')));
  select id into v_uid from public.user_profiles order by created_at limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  execute 'set local role authenticated';
  -- محفّز BEFORE UPDATE لسه بيشتغل بعد سحب EXECUTE من الدور.
  update public.user_profiles set full_name = full_name where id = v_uid;
  get diagnostics v_n = row_count;
  v_out := v_out || jsonb_build_object('trigger_update_rows', v_n);
  v_n := public.notify_admins(repeat('ع', 200), repeat('م', 900), 'https://evil.example/x');
  v_out := v_out || jsonb_build_object('notified', v_n);
  execute 'reset role';
  select length(title) tl, length(message) ml, link into v_row
    from public.notifications where title like 'ع%' order by length(title) desc limit 1;
  v_out := v_out || jsonb_build_object('last_title_len', v_row.tl, 'last_msg_len', v_row.ml, 'last_link', v_row.link);
  raise exception 'RESULT: %', v_out::text;
end
$t$;
rollback;
