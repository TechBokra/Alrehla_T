# Reverted staging-only ordering prototype

The user changed the scope to UI/UX only. There is no ordering RPC dependency in the admin UI.

- Staging: `nznfawbcgfwpftbiqima` (ahmed).
- Original applied version: `20261025171225_reorder_catalog_records`.
- Reversal: `20261025172223_remove_catalog_ordering_rpc_ui_only`.
- Verified that `public.reorder_catalog_records(text,text[],jsonb)` is absent after reversal.
- Catalog data remained unchanged; production was untouched.

These statements are archived solely to explain staging migration history. They are not CLI migrations and must not be applied to either environment.

## Original applied SQL, including temporary verification fixtures

```sql
-- Atomic manual ordering. Additive; apply to ahmed staging before enabling UI.
create or replace function public.reorder_catalog_records(
  p_resource text,
  p_ordered_ids text[],
  p_expected jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
set lock_timeout = '5s'
as $function$
declare
  v_table regclass;
  v_scope text;
  v_current jsonb;
  v_count integer;
  v_noop boolean;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.archived_at is null
      and p.role in ('super_admin', 'general_supervisor')
  ) then
    raise exception 'CATALOG_ORDER_FORBIDDEN' using errcode = '42501';
  end if;

  -- Only these constants ever reach dynamic SQL; resource names are not identifiers.
  case p_resource
    when 'personalized_products' then
      v_table := 'public.personalized_products'::regclass;
      v_scope := 'owner_type = ''platform''';
    when 'addon_products' then
      v_table := 'public.addon_products'::regclass;
      v_scope := 'true';
    else raise exception 'CATALOG_ORDER_INVALID_RESOURCE' using errcode = '22023';
  end case;

  v_count := cardinality(p_ordered_ids);
  if p_ordered_ids is null or array_ndims(p_ordered_ids) > 1
     or jsonb_typeof(p_expected) is distinct from 'array' then
    raise exception 'CATALOG_ORDER_INVALID_INPUT' using errcode = '22023';
  end if;
  if jsonb_array_length(p_expected) <> v_count
     or exists (select 1 from unnest(p_ordered_ids) id where id is null or btrim(id) = '')
     or (select count(distinct id) from unnest(p_ordered_ids) id) <> v_count then
    raise exception 'CATALOG_ORDER_INVALID_IDS' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_expected) as e(id text, sort_order integer, updated_at timestamptz)
    where e.id is null or e.sort_order is null or e.updated_at is null
       or not (e.id = any(p_ordered_ids))
  ) or (select count(distinct e.id) from jsonb_to_recordset(p_expected) as e(id text)) <> v_count then
    raise exception 'CATALOG_ORDER_INVALID_SNAPSHOT' using errcode = '22023';
  end if;

  -- Serialize with inserts/deletes and ordinary edits as well as other reorder calls.
  -- This is intentionally acquired only after authentication/input validation.
  execute format('lock table %s in share row exclusive mode', v_table);
  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''sort_order'',sort_order,''updated_at'',updated_at) order by sort_order,id),''[]''::jsonb) from %s where %s',
    v_table, v_scope
  ) into v_current;

  if jsonb_array_length(v_current) <> v_count or exists (
    select 1 from jsonb_to_recordset(v_current) c(id text) where not (c.id = any(p_ordered_ids))
  ) then
    raise exception 'CATALOG_ORDER_CONFLICT' using errcode = '40001';
  end if;

  -- A lost response followed by the identical request must not write twice.
  select not exists (
    select 1 from unnest(p_ordered_ids) with ordinality o(id, position)
    join jsonb_to_recordset(v_current) c(id text, sort_order integer) on c.id=o.id
    where c.sort_order is distinct from ((o.position - 1) * 10)::integer
  ) into v_noop;
  if v_noop then return v_current; end if;

  if exists (
    select 1 from jsonb_to_recordset(v_current) c(id text, sort_order integer, updated_at timestamptz)
    join jsonb_to_recordset(p_expected) e(id text, sort_order integer, updated_at timestamptz) using(id)
    where c.sort_order is distinct from e.sort_order or c.updated_at is distinct from e.updated_at
  ) then
    raise exception 'CATALOG_ORDER_CONFLICT' using errcode = '40001';
  end if;

  execute format(
    'update %s t set sort_order=((o.position-1)*10)::integer, updated_at=clock_timestamp() '
    'from unnest($1) with ordinality o(id,position) where t.id=o.id and (%s) '
    'and t.sort_order is distinct from ((o.position-1)*10)::integer', v_table, v_scope
  ) using p_ordered_ids;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''sort_order'',sort_order,''updated_at'',updated_at) order by sort_order,id),''[]''::jsonb) from %s where %s',
    v_table, v_scope
  ) into v_current;
  if jsonb_array_length(v_current) <> v_count or exists (
    select 1 from unnest(p_ordered_ids) with ordinality o(id, position)
    left join jsonb_to_recordset(v_current) c(id text, sort_order integer) on c.id=o.id
    where c.id is null or c.sort_order is distinct from ((o.position - 1) * 10)::integer
  ) then
    raise exception 'CATALOG_ORDER_WRITE_REJECTED' using errcode = '42501';
  end if;
  return v_current;
end;
$function$;

revoke all on function public.reorder_catalog_records(text,text[],jsonb) from public, anon;
grant execute on function public.reorder_catalog_records(text,text[],jsonb) to authenticated;
comment on function public.reorder_catalog_records(text,text[],jsonb) is
  'Atomic catalog ordering with scope and optimistic snapshot checks; admin users only.';
-- Run after the migration in a single staging session. Only temporary fixtures
-- are mutated; no public catalog rows or auth users are created/updated.
create temporary table catalog_test_profiles(id uuid primary key, role text, archived_at timestamptz);
create temporary table catalog_test_products(id text primary key, owner_type text, sort_order integer, updated_at timestamptz);
create temporary table catalog_test_addons(id text primary key, sort_order integer, updated_at timestamptz);
insert into catalog_test_profiles values
 ('00000000-0000-0000-0000-000000000001','super_admin',null),
 ('00000000-0000-0000-0000-000000000002','general_supervisor',null),
 ('00000000-0000-0000-0000-000000000003','customer',null),
 ('00000000-0000-0000-0000-000000000004','super_admin',now());
insert into catalog_test_products values ('a','platform',0,'2026-01-01T00:00:00Z'),('b','platform',10,'2026-01-01T00:00:00Z'),('publisher','publisher',0,'2026-01-01T00:00:00Z');
insert into catalog_test_addons values ('x',0,'2026-01-01T00:00:00Z'),('y',10,'2026-01-01T00:00:00Z');
grant select on catalog_test_profiles to authenticated;
grant select, update on catalog_test_products, catalog_test_addons to authenticated;
do $copy$
declare definition text;
begin
  definition := pg_get_functiondef('public.reorder_catalog_records(text,text[],jsonb)'::regprocedure);
  definition := replace(definition, 'public.reorder_catalog_records', 'pg_temp.reorder_catalog_records');
  definition := replace(definition, 'public.user_profiles', 'pg_temp.catalog_test_profiles');
  definition := replace(definition, 'public.personalized_products', 'pg_temp.catalog_test_products');
  definition := replace(definition, 'public.addon_products', 'pg_temp.catalog_test_addons');
  if definition like '%public.personalized_products%' or definition like '%public.addon_products%' then raise exception 'Unsafe fixture mapping'; end if;
  execute definition;
  execute format('grant usage on schema %I to authenticated', (select nspname from pg_namespace where oid=pg_my_temp_schema()));
end;
$copy$;
create function pg_temp.catalog_expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate=expected then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE % for %',expected,statement;
end;
$$;
create function pg_temp.catalog_fixture_snapshot(resource text) returns jsonb language plpgsql as $$
begin
  if resource='personalized_products' then
    return (select jsonb_agg(jsonb_build_object('id',id,'sort_order',sort_order,'updated_at',updated_at)) from pg_temp.catalog_test_products where owner_type='platform');
  end if;
  return (select jsonb_agg(jsonb_build_object('id',id,'sort_order',sort_order,'updated_at',updated_at)) from pg_temp.catalog_test_addons);
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.catalog_expect_error($q$select pg_temp.reorder_catalog_records('addon_products',array['x','y'],pg_temp.catalog_fixture_snapshot('addon_products'))$q$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select pg_temp.catalog_expect_error($q$select pg_temp.reorder_catalog_records('addon_products',array['x','y'],pg_temp.catalog_fixture_snapshot('addon_products'))$q$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.catalog_expect_error($q$select pg_temp.reorder_catalog_records('other',array['x','y'],'[]')$q$,'22023');
select pg_temp.catalog_expect_error($q$select pg_temp.reorder_catalog_records('addon_products',array['x','x'],pg_temp.catalog_fixture_snapshot('addon_products'))$q$,'22023');
select pg_temp.catalog_expect_error($q$select pg_temp.reorder_catalog_records('addon_products',array['x'],jsonb_build_array(pg_temp.catalog_fixture_snapshot('addon_products')->0))$q$,'40001');
select pg_temp.catalog_expect_error($q$select pg_temp.reorder_catalog_records('personalized_products',array['publisher','b'],'[{"id":"publisher","sort_order":0,"updated_at":"2026-01-01T00:00:00Z"},{"id":"b","sort_order":10,"updated_at":"2026-01-01T00:00:00Z"}]')$q$,'40001');
select pg_temp.catalog_expect_error($q$select pg_temp.reorder_catalog_records('addon_products',array['a','b'],pg_temp.catalog_fixture_snapshot('personalized_products'))$q$,'40001');
select pg_temp.catalog_expect_error($q$select pg_temp.reorder_catalog_records('addon_products',array['y','x'],'[{"id":"x","sort_order":0,"updated_at":"2025-01-01T00:00:00Z"},{"id":"y","sort_order":10,"updated_at":"2026-01-01T00:00:00Z"}]')$q$,'40001');
do $test$
declare before_snapshot jsonb; after_snapshot jsonb; repeated jsonb;
begin
  before_snapshot := pg_temp.catalog_fixture_snapshot('addon_products');
  after_snapshot := pg_temp.reorder_catalog_records('addon_products',array['y','x'],before_snapshot);
  if after_snapshot->0->>'id' <> 'y' or (after_snapshot->0->>'sort_order')::integer <> 0 then raise exception 'Ordering failed'; end if;
  repeated := pg_temp.reorder_catalog_records('addon_products',array['y','x'],before_snapshot);
  if repeated <> after_snapshot then raise exception 'Repeat request wrote again'; end if;
  perform pg_temp.catalog_expect_error(format('select pg_temp.reorder_catalog_records(''addon_products'',array[''x'',''y''],%L::jsonb)',before_snapshot),'40001');
  if (select sort_order from pg_temp.catalog_test_products where id='publisher') <> 0 then raise exception 'Publisher modified'; end if;
end;
$test$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.reorder_catalog_records('personalized_products',array['b','a'],pg_temp.catalog_fixture_snapshot('personalized_products'));
reset role;
-- A forced failure during one row update must roll back every row in that call.
create function pg_temp.catalog_reject_update() returns trigger language plpgsql as $$
begin
 if new.id='x' then raise exception 'fixture failure' using errcode='23514'; end if;
 return new;
end;
$$;
create trigger catalog_test_failure before update on catalog_test_addons for each row execute function pg_temp.catalog_reject_update();
set local role authenticated;
do $test$
declare snapshot jsonb;
begin
 snapshot := pg_temp.catalog_fixture_snapshot('addon_products');
 perform pg_temp.catalog_expect_error(format('select pg_temp.reorder_catalog_records(''addon_products'',array[''x'',''y''],%L::jsonb)',snapshot),'23514');
 if snapshot <> pg_temp.catalog_fixture_snapshot('addon_products') then raise exception 'Partial write survived failure'; end if;
end;
$test$;
reset role;
drop function pg_temp.catalog_reject_update() cascade;
drop function pg_temp.catalog_fixture_snapshot(text);
drop function pg_temp.catalog_expect_error(text,text);
drop function pg_temp.reorder_catalog_records(text,text[],jsonb);
drop table catalog_test_addons, catalog_test_products, catalog_test_profiles;
```

## Applied reversal

```sql
-- Revert only the function introduced by the draggable catalog prototype.
-- Existing catalog positions and all product records are preserved.
drop function if exists public.reorder_catalog_records(text,text[],jsonb);
```
