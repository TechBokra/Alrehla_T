import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../src');
function loader(stubs = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const source = readFileSync(file, 'utf8').replaceAll('import.meta.hot', 'undefined');
    const output = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    }}).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(dirname(file), name);
        const path = [base, base + '.ts', base + '.tsx', base + '/index.ts'].find(existsSync);
        if (!path) throw new Error(`Missing test dependency: ${name}`);
        return load(path);
      }
      return require(name);
    };
    vm.runInNewContext(output, { require: localRequire, module: mod, exports: mod.exports,
      URL, AbortSignal, console, setTimeout, clearTimeout, queueMicrotask }, { filename: file });
    return mod.exports;
  }
  return (path) => load(resolve(root, path));
}
const schema = { signInSchema: { safeParse: (data) => ({ success: true, data }) },
  googleSignInSchema: { safeParse: () => ({ success: true }) } };
const authModule = loader({
  '@/providers/supabase-client': { getSupabaseClient: () => null, supabaseConnection: {} },
  '@/lib/schema': schema,
})('providers/refine/auth-provider.ts');
function gateway(profile = {}) {
  let reads = 0;
  let roleId;
  const object = {
    getUser: async () => ({ id: 'actor' }),
    getProfile: async () => ({ id: 'actor', role: 'general_supervisor', archived_at: null,
      admin_role_id: null, full_name: 'Admin', avatar_url: null, ...profile }),
    getPermissions: async (id) => { reads++; roleId = id; return ['canManageCatalog']; },
    signOut: async () => {},
    signIn: async () => ({ userId: 'actor' }),
  };
  return { object, get reads() { return reads; }, get roleId() { return roleId; } };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('authorization shares concurrent reads, expires at 60 seconds and supports default roles', async () => {
  let now = 0;
  const g = gateway();
  const auth = authModule.createAdminAuthProvider(() => g.object, () => now);
  const [a, b] = await Promise.all([auth.getAuthorization(), auth.getAuthorization()]);
  assert.equal(a, b);
  assert.equal(g.reads, 1);
  assert.equal(g.roleId, null);
  now = 59_999;
  await auth.getAuthorization();
  assert.equal(g.reads, 1);
  now = 60_001;
  await auth.getAuthorization();
  assert.equal(g.reads, 2);
  await auth.getAuthorization(true);
  assert.equal(g.reads, 3);
});

test('assigned groups are used; super admins do not require a group', async () => {
  const assigned = gateway({ admin_role_id: 'content-role' });
  await authModule.createAdminAuthProvider(() => assigned.object).getAuthorization();
  assert.equal(assigned.roleId, 'content-role');
  const superAdmin = gateway({ role: 'super_admin' });
  const actor = await authModule.createAdminAuthProvider(() => superAdmin.object).getAuthorization();
  assert.equal(actor.role, 'super_admin');
  assert.equal(superAdmin.reads, 0);
});

test('archived and customer profiles are denied; failed permission reads are retryable', async () => {
  for (const profile of [{ archived_at: '2026-01-01' }, { role: 'customer' }]) {
    const g = gateway(profile);
    assert.equal(await authModule.createAdminAuthProvider(() => g.object).getAuthorization(), null);
    assert.equal(g.reads, 0);
  }
  const g = gateway();
  const auth = authModule.createAdminAuthProvider(() => g.object);
  const read = g.object.getPermissions;
  g.object.getPermissions = async () => { throw new Error('offline'); };
  await assert.rejects(auth.getAuthorization(), /offline/);
  g.object.getPermissions = read;
  assert.equal((await auth.getAuthorization()).permissions[0], 'canManageCatalog');
});

test('session invalidation discards an old pending permission result', async () => {
  const g = gateway();
  let finish;
  g.object.getPermissions = () => new Promise((resolve) => { finish = resolve; });
  const auth = authModule.createAdminAuthProvider(() => g.object);
  const old = auth.getAuthorization();
  await tick();
  auth.invalidateSession();
  g.object.getProfile = async () => ({ id: 'new', role: 'super_admin', archived_at: null });
  g.object.getUser = async () => ({ id: 'new' });
  finish(['canManageCatalog']);
  assert.equal(await old, null);
  assert.equal((await auth.getAuthorization()).id, 'new');
});

const supervisor = { id: 'actor', role: 'general_supervisor', permissions: [] };
const superAdmin = { id: 'actor', role: 'super_admin', permissions: [] };
let currentActor = supervisor;
let version = 1;
const provider = loader({ './auth-provider': { adminAuthProvider: {
  getAuthorization: async () => currentActor, getSessionVersion: () => version,
}}})('providers/refine/access-control-provider.ts');
const can = (actor, resource, action, params) => provider.evaluateResourceAccess(actor, { resource, action, params }).can;

test('policy matrix preserves the users exception and fails closed for unknown actions', () => {
  for (const action of ['list', 'show', 'create', 'edit', 'suspension', 'activity'])
    assert.equal(can(supervisor, 'users', action), true);
  for (const action of ['delete', 'admin_roles', 'assign_admin_role']) {
    assert.equal(can(supervisor, 'users', action), false);
    assert.equal(can(superAdmin, 'users', action), true);
  }
  for (const resource of ['personalized_products', 'addon_products', 'uploads']) {
    assert.equal(can(supervisor, resource, 'list'), false);
    assert.equal(can(superAdmin, resource, 'list'), true);
    assert.equal(can(superAdmin, resource, 'unregistered-command'), false);
  }
  assert.equal(can({ ...supervisor, permissions: ['canManageCatalog'] }, 'addon_products', 'sort'), true);
  assert.equal(can({ ...supervisor, permissions: ['canManageContent'] }, 'uploads', 'upload'), true);
  assert.equal(can(superAdmin, 'unknown', 'list'), false);
  assert.equal(can(null, 'users', 'list'), false);
});

test('own profile/notifications and protected user records remain restricted', () => {
  assert.equal(can(superAdmin, 'profile', 'edit', { id: 'other' }), false);
  assert.equal(can(superAdmin, 'profile', 'edit', { id: 'actor' }), true);
  assert.equal(can(superAdmin, 'notifications', 'list', { recipientId: 'other' }), false);
  const record = { id: 'other', role: 'customer', archived_at: null, is_child_account: false };
  assert.equal(can(superAdmin, 'users', 'delete', { id: 'other', record }), true);
  for (const extra of [{ id: 'actor' }, { role: 'general_supervisor' }, { is_child_account: true }, { archived_at: 'date' }]) {
    const target = { ...record, ...extra };
    assert.equal(can(superAdmin, 'users', 'delete', { id: target.id, record: target }), false);
  }
  assert.equal(can(supervisor, 'users', 'suspension', { record: { ...record, role: 'super_admin' } }), false);
});

test('landing chooses an allowed page; stale auth versions are denied', async () => {
  currentActor = supervisor;
  assert.equal(await provider.resolveAdminLandingPage(), '/users');
  currentActor = superAdmin;
  assert.equal(await provider.resolveAdminLandingPage(), '/catalog/products');
  assert.equal((await provider.supabaseAccessControlProvider.can({ resource: 'users', action: 'list', params: { authVersion: 0 } })).can, false);
});

function uiFixture(allowedActions, status = {}) {
  let tableReads = 0;
  let scope;
  let page;
  const hook = { useResourceAuthorization: (_resource, action) => ({
    allowed: allowedActions.includes(action), data: { can: allowedActions.includes(action), reason: 'ممنوع' },
    isPending: false, isError: false, isFetching: false, refetch: async () => {}, ...status,
  }) };
  const box = ({ children }) => React.createElement('div', null, children);
  const load = loader({
    '@/hooks/resources/use-resource-authorization': hook,
    '@/hooks/resources/use-resource-table': { useResourceTable: () => { tableReads++; return { table: { refineCore: { tableQuery: { data: { data: [] } } } }, reorder: () => {} }; } },
    './resource-context': { ResourceScopeProvider: (props) => { scope = props; return props.children; } },
    './resource-page': { ResourcePage: (props) => { page = props; return null; } },
    './resource-dialogs': { ResourceDialogs: box }, './resource-editor': { ResourceEditor: () => null },
    '@/components/ui/alert': { Alert: box, AlertTitle: box, AlertDescription: box },
    '@/components/ui/button': { Button: ({ children }) => React.createElement('button', null, children) },
    '@/components/ui/skeleton': { Skeleton: () => React.createElement('span', null, 'loading') },
    '@/components/ui/sidebar': { SidebarMenuItem: box, SidebarMenuSkeleton: box, SidebarMenuButton: box },
    '@tanstack/react-router': { Link: ({ children, to }) => React.createElement('a', { href: to }, children), useLocation: () => '/users' },
  });
  return { load, get tableReads() { return tableReads; }, get scope() { return scope; }, get page() { return page; } };
}

test('denied, pending and failed pages never mount their table controller', () => {
  for (const status of [{}, { isPending: true }, { isError: true }]) {
    const fixture = uiFixture([], status);
    const { ResourceProvider } = fixture.load('components/resources/resource-provider.tsx');
    const html = renderToStaticMarkup(React.createElement(ResourceProvider, { resource: 'users', title: 'users', columns: [], form: {} }));
    assert.equal(fixture.tableReads, 0);
    assert.ok(html.length > 0);
  }
});

test('resource feature restrictions can reduce but never grant CRUD access', () => {
  const fixture = uiFixture(['list', 'edit', 'delete']);
  const { ResourceProvider } = fixture.load('components/resources/resource-provider.tsx');
  renderToStaticMarkup(React.createElement(ResourceProvider, {
    resource: 'addon_products', title: 'addons', columns: [], canCreate: true,
    form: { canEdit: (record) => record.id !== 'protected' }, canDelete: () => false,
  }));
  assert.equal(fixture.tableReads, 1);
  assert.equal(fixture.page.canCreate, false);
  assert.equal(fixture.scope.canEdit({ id: 'protected' }), false);
  assert.equal(fixture.scope.canEdit({ id: 'normal' }), true);
  assert.equal(fixture.scope.canDelete({ id: 'normal' }), false);
});

test('sidebar uses the same access decision and hides denied links', () => {
  for (const allowed of [false, true]) {
    const fixture = uiFixture(allowed ? ['list'] : []);
    const { AuthorizedSidebarItem } = fixture.load('components/authorized-sidebar-item.tsx');
    const html = renderToStaticMarkup(React.createElement(AuthorizedSidebarItem, { item: { resource: 'users', to: '/users', label: 'المستخدمون', icon: () => null } }));
    assert.equal(html.includes('href="/users"'), allowed);
  }
});

test('shared hook scopes Refine access queries by session version and rejects stale error data', () => {
  let authVersion = 1;
  const params = [];
  const { useResourceAuthorization } = loader({
    react: { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() },
    '@refinedev/core': { useCan: (input) => { params.push(input.params); return { data: { can: true }, isError: authVersion === 2 }; } },
    '@/providers/refine/auth-provider': { adminAuthProvider: { subscribeSession: () => () => {}, getSessionVersion: () => authVersion } },
  })('hooks/resources/use-resource-authorization.ts');
  assert.equal(useResourceAuthorization('users', 'list').allowed, true);
  authVersion = 2;
  assert.equal(useResourceAuthorization('users', 'list').allowed, false);
  assert.equal(params[0].authVersion, 1);
  assert.equal(params[1].authVersion, 2);
});

function crudFixture(preflight, allowed = true) {
  let writes = 0;
  let writeParams;
  const mutation = { mutation: { isPending: false, error: null }, mutateAsync: async (params) => {
    writes++; writeParams = params; return { data: { id: 'record' } };
  }};
  const load = loader({
    react: { useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}] },
    '@refinedev/core': { useCreate: () => mutation, useUpdate: () => mutation, useDelete: () => mutation,
      useOne: () => ({ query: { isPending: false, isFetching: false, refetch: async () => ({ data: { data: { id: 'record' } } }) }, result: { id: 'record' } }),
    },
    './use-resource-authorization': { useResourceAuthorization: () => ({ allowed, isPending: false, data: { can: allowed }, refetch: async () => ({ data: { can: allowed } }) }) },
    '@/providers/refine/access-control-provider': { assertResourceAccess: preflight },
  });
  return { load, get writes() { return writes; }, get writeParams() { return writeParams; } };
}

test('fresh CRUD denial blocks writes; feature restrictions also prevent submissions', async () => {
  const fixture = crudFixture(async () => { throw new Error('permission revoked'); });
  const { useResourceFormCrud } = fixture.load('hooks/resources/use-resource-form-crud.ts');
  const form = useResourceFormCrud({ resource: 'addon_products' });
  assert.equal(await form.save({ name: 'test' }), false);
  assert.equal(fixture.writes, 0);
  const { useResourceDeleteCrud } = fixture.load('hooks/resources/use-resource-delete-crud.ts');
  assert.equal(await useResourceDeleteCrud({ resource: 'addon_products', id: 'record', canDelete: true }).remove(), false);
  assert.equal(fixture.writes, 0);
  assert.equal(await useResourceFormCrud({ resource: 'addon_products', id: 'record', canEdit: () => false }).save({}), false);
  assert.equal(fixture.writes, 0);
});

test('CRUD guards reject repeated confirmation while permission checks are pending', async () => {
  let finish;
  const fixture = crudFixture(() => new Promise((resolve) => { finish = resolve; }));
  const { useResourceDeleteCrud } = fixture.load('hooks/resources/use-resource-delete-crud.ts');
  const deletion = useResourceDeleteCrud({ resource: 'addon_products', id: 'record', canDelete: true });
  const first = deletion.remove();
  assert.equal(deletion.canDismiss(), false);
  assert.equal(await deletion.remove(), false);
  assert.equal(fixture.writes, 0);
  finish();
  assert.equal(await first, true);
  assert.equal(fixture.writes, 1);
  assert.equal(fixture.writeParams.mutationMode, 'pessimistic');
});

test('custom row commands require a registered authorization action', () => {
  const fixture = uiFixture(['list']);
  // Policy rejects a custom action even for super admins unless registered.
  assert.equal(can(superAdmin, 'users', 'custom-unregistered'), false);
  assert.equal(can(superAdmin, 'users', 'activity'), true);
});

test('row menus hide forbidden and unregistered commands and preserve record restrictions', () => {
  const Context = React.createContext(null);
  const box = ({ children }) => React.createElement('div', null, children);
  const load = loader({
    './resource-context': { ResourceContext: Context },
    '@/hooks/resources/use-resource-authorization': { useResourceAuthorization: (resource, action, params) => ({ allowed: can(supervisor, resource, action, params) }) },
    '@/providers/refine/access-control-provider': { assertResourceAccess: async () => {} },
    '@/components/ui/direction': { useDirection: () => 'rtl' },
    '@/components/ui/button': { Button: ({ children }) => React.createElement('button', null, children) },
    '@/components/ui/dropdown-menu': { DropdownMenu: box, DropdownMenuTrigger: box, DropdownMenuContent: box, DropdownMenuGroup: box,
      DropdownMenuItem: ({ children }) => React.createElement('span', null, children) },
  });
  const { ResourceRowActions } = load('components/resources/resource-row-actions.tsx');
  const context = { resource: 'users', getRecord: () => ({ id: 'other', role: 'customer' }),
    canEditRow: () => true, canDeleteRow: () => true, openEdit: () => {}, openDelete: () => {} };
  const html = renderToStaticMarkup(React.createElement(Context.Provider, { value: context }, React.createElement(ResourceRowActions, { id: 'other' })));
  assert.ok(html.includes('تعديل'));
  assert.ok(!html.includes('حذف'));
  const custom = { key: 'unknown', authorizationAction: 'unregistered', label: 'Unknown', icon: () => null, onSelect: () => {} };
  assert.equal(renderToStaticMarkup(React.createElement(Context.Provider, { value: context }, React.createElement(ResourceRowActions, { id: 'other', actions: [custom] }))), '');
  context.canEditRow = () => false;
  context.canDeleteRow = () => false;
  assert.equal(renderToStaticMarkup(React.createElement(Context.Provider, { value: context }, React.createElement(ResourceRowActions, { id: 'other' }))), '');
});

test('Supabase gateway reads only the assigned/default role and rejects missing groups', async () => {
  for (const adminRoleId of [null, 'assigned']) {
    let permissionsFilter;
    let missing = false;
    const client = {
      auth: { getSession: async () => ({ data: { session: {} } }), getUser: async () => ({ data: { user: { id: 'actor' } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      from: (table) => ({ select: () => ({ eq: (field, value) => {
        if (table === 'admin_roles') permissionsFilter = [field, value];
        return { maybeSingle: async () => ({ data: table === 'user_profiles'
          ? { id: 'actor', role: 'general_supervisor', archived_at: null, admin_role_id: adminRoleId }
          : missing ? null : { permissions: [] } }) };
      } }) }),
    };
    const { adminAuthProvider } = loader({
      '@/providers/supabase-client': { getSupabaseClient: () => client, supabaseConnection: { url: 'https://example.supabase.co', publishableKey: 'public-test-key' } },
      '@/lib/schema': schema,
    })('providers/refine/auth-provider.ts');
    assert.ok(await adminAuthProvider.getAuthorization());
    assert.deepEqual(permissionsFilter, adminRoleId ? ['id', adminRoleId] : ['is_default', true]);
    missing = true;
    await assert.rejects(adminAuthProvider.getAuthorization(true), /صلاحيات/);
  }
});
