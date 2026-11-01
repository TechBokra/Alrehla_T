import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient } from '@tanstack/react-query';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../src');
function loader(stubs = {}, globals = {}) {
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
      URL, AbortSignal, console, setTimeout, clearTimeout, queueMicrotask, ...globals }, { filename: file });
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

const supervisor = { id: 'actor', role: 'general_supervisor', permissions: [],
  identity: { id: 'actor', name: 'Admin', email: 'admin@example.com', avatar: null, role: 'general_supervisor' } };
const superAdmin = { ...supervisor, role: 'super_admin', identity: { ...supervisor.identity, role: 'super_admin' } };
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
  assert.equal(provider.resolveAdminLandingPage(currentActor), '/users');
  currentActor = superAdmin;
  assert.equal(provider.resolveAdminLandingPage(currentActor), '/catalog/products');
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
    '@/providers/refine/access-control-provider': { evaluateResourceAccess: provider.evaluateResourceAccess },
    '@/hooks/auth/use-admin-access': { useAdminSessionVersion: () => authVersion,
      useAdminAccess: () => ({ ready: true, version: authVersion, actor: supervisor, permissionsVersion: authVersion }) },
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

function bootstrapFixture(path, authState, permissionState, brandingState = { isPending: false, isError: false }, identityState = identified) {
  let mounted = 0;
  let authOptions;
  let permissionOptions;
  let brandingOptions;
  let identityOptions;
  let accessState;
  const AccessContext = React.createContext(null);
  const box = ({ children }) => React.createElement('div', null, children);
  const { AdminAccessProvider } = loader({
    '@refinedev/core': {
      useGetIdentity: ({ queryOptions }) => { identityOptions = queryOptions; return identityState; },
      useIsAuthenticated: ({ queryOptions }) => { authOptions = queryOptions; return authState; },
      usePermissions: ({ options }) => { permissionOptions = options; return permissionState; },
    },
    '@tanstack/react-router': { useLocation: () => path,
      Navigate: ({ to }) => React.createElement('a', { href: to }, 'redirect') },
    './auth-provider': { adminAuthProvider: { invalidateSession() {} } },
    '@/hooks/auth/use-admin-access': { AdminAccessContext: AccessContext, useAdminSessionVersion: () => 7 },
    '@/hooks/auth/use-admin-branding': { useAdminBranding: (options) => {
      brandingOptions = options;
      return { query: brandingState, branding: { name: 'الرحلة' } };
    } },
    '@/components/route-states/loading': { Loading: () => React.createElement('div', { role: 'status' }, 'جارٍ التحميل') },
    '@/components/ui/alert': { Alert: box, AlertTitle: box, AlertDescription: box },
    '@/components/ui/button': { Button: ({ children }) => React.createElement('button', null, children) },
  })('providers/refine/admin-access-provider.tsx');
  const Child = () => { mounted++; accessState = React.useContext(AccessContext); return React.createElement('div', null, 'protected child'); };
  const html = renderToStaticMarkup(React.createElement(AdminAccessProvider, null, React.createElement(Child)));
  return { html, mounted, authOptions, permissionOptions, brandingOptions, identityOptions, accessState };
}
const identified = { isPending: false, isFetching: false, isError: false, isSuccess: true, data: supervisor.identity };
const checked = { isPending: false, isFetching: false, isError: false, data: { authenticated: true, profileId: 'actor' } };
const granted = { isPending: false, isFetching: false, isError: false, isSuccess: true,
  data: supervisor, dataUpdatedAt: 10 };

test('one Refine bootstrap gate blocks all protected children until auth and permissions resolve', () => {
  for (const [auth, permissions] of [
    [{ ...checked, isPending: true, isFetching: true, data: undefined }, granted],
    [checked, { ...granted, isPending: true, isSuccess: false, data: undefined }],
    [checked, { ...granted, data: { ...supervisor, id: 'different-account' } }],
    [{ ...checked, isError: true }, granted],
    [checked, { ...granted, isError: true, isSuccess: false }],
    [checked, { ...granted, data: null }],
  ]) {
    const result = bootstrapFixture('/users', auth, permissions);
    assert.equal(result.mounted, 0);
    assert.ok(result.html.includes('جارٍ التحميل') || result.html.includes('إعادة المحاولة'));
  }
  assert.equal(bootstrapFixture('/users', checked, granted).mounted, 1);
  // A same-session background refresh preserves mounted forms and uploads.
  assert.equal(bootstrapFixture('/users', checked, { ...granted, isFetching: true }).mounted, 1);
});

test('public callbacks bypass bootstrap; sign-in redirects only after authentication is known', () => {
  for (const path of ['/auth/callback', '/auth/link', '/reset-password']) {
    const result = bootstrapFixture(path, { ...checked, isPending: true }, granted);
    assert.equal(result.mounted, 1);
    assert.equal(result.authOptions.enabled, false);
    assert.equal(result.permissionOptions.enabled, false);
    assert.equal(result.brandingOptions.enabled, false);
    assert.equal(result.identityOptions.enabled, false);
  }
  const anonymous = { ...checked, data: { authenticated: false } };
  assert.equal(bootstrapFixture('/sign-in', anonymous, granted).mounted, 1);
  assert.equal(bootstrapFixture('/sign-in', checked, granted).html, '<a href="/">redirect</a>');
  const protectedPage = bootstrapFixture('/users', anonymous, granted);
  assert.equal(protectedPage.mounted, 0);
  assert.equal(protectedPage.html, '<a href="/sign-in">redirect</a>');
  assert.equal(bootstrapFixture('/sign-in', checked, granted).permissionOptions.enabled, false);
});

test('Refine permission bootstrap shares adapter reads; connection errors are retryable auth failures', async () => {
  const g = gateway();
  const auth = authModule.createAdminAuthProvider(() => g.object);
  assert.equal((await auth.check()).authenticated, true);
  const [a, b] = await Promise.all([auth.getPermissions(), auth.getAuthorization()]);
  assert.equal(a, b);
  assert.equal(g.reads, 1);
  auth.invalidateSession();
  g.object.getUser = async () => { throw new Error('offline'); };
  await assert.rejects(auth.check(), /تعذّر الاتصال/);
  g.object.getUser = async () => null;
  assert.equal((await auth.check()).authenticated, false);
});

test('resource checks seed Refine from the current bootstrap and never allow a pending session', () => {
  let ready = true;
  let version = 1;
  const inputs = [];
  const { useResourceAuthorization } = loader({
    '@/providers/refine/access-control-provider': { evaluateResourceAccess: provider.evaluateResourceAccess },
    '@/hooks/auth/use-admin-access': { useAdminSessionVersion: () => version,
      useAdminAccess: () => ({ ready, version, actor: supervisor, permissionsVersion: version }) },
    '@refinedev/core': { useCan: (input) => {
      inputs.push(input);
      return { data: input.queryOptions.initialData?.() ?? { can: true }, isError: false };
    } },
  })('hooks/resources/use-resource-authorization.ts');
  assert.equal(useResourceAuthorization('users', 'list').allowed, true);
  assert.equal(useResourceAuthorization('uploads', 'list').allowed, false);
  ready = false;
  version++;
  assert.equal(useResourceAuthorization('users', 'list').allowed, false);
  assert.equal(inputs.at(-1).queryOptions.enabled, false);
  assert.equal(inputs.at(-1).queryOptions.initialData, undefined);
  assert.equal(inputs.at(-1).params.authVersion, 2);
});

test('focus joins one fresh permission read and discards an obsolete refresh completion', async () => {
  for (const changedWhilePending of [false, true]) {
    let currentVersion = 7;
    let invalidations = 0;
    let starts = 0;
    let joins = 0;
    let identityJoins = 0;
    let finish;
    let pending;
    const effects = [];
    const listeners = new Map();
    const box = ({ children }) => children;
    const { AdminAccessProvider } = loader({
      react: { ...React, useEffect: (effect) => { effects.push(effect); } },
      '@refinedev/core': {
        useGetIdentity: () => ({ ...identified, refetch: async () => { identityJoins++; await pending; } }),
        useIsAuthenticated: () => checked,
        usePermissions: () => ({ ...granted, refetch: async () => {
          joins++;
          assert.ok(pending, 'fresh adapter request starts before Refine refetch');
          return { data: await pending, isError: false };
        } }),
      },
      '@tanstack/react-router': { useLocation: () => '/users', Navigate: () => null },
      './auth-provider': { adminAuthProvider: {
        getAuthorization: (refresh) => {
          assert.equal(refresh, true);
          starts++;
          pending = new Promise((resolve) => { finish = resolve; });
          return pending;
        },
        getSessionVersion: () => currentVersion,
        invalidateSession: () => { invalidations++; currentVersion++; },
      } },
      '@/hooks/auth/use-admin-access': { AdminAccessContext: React.createContext(null), useAdminSessionVersion: () => 7 },
      '@/hooks/auth/use-admin-branding': { useAdminBranding: () => ({ query: { isPending: false }, branding: { name: 'الرحلة' } }) },
      '@/components/route-states/loading': { Loading: () => null },
      '@/components/ui/alert': { Alert: box, AlertTitle: box, AlertDescription: box },
      '@/components/ui/button': { Button: box },
    }, {
      window: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener() {} },
      document: { visibilityState: 'visible' },
    })('providers/refine/admin-access-provider.tsx');
    renderToStaticMarkup(React.createElement(AdminAccessProvider, null, 'content'));
    // Focus registration only; the navigation effect is independently stale-time driven.
    const cleanup = effects[0]();
    listeners.get('focus')();
    assert.equal(starts, 1);
    assert.equal(joins, 1);
    assert.equal(identityJoins, 1);
    if (changedWhilePending) currentVersion++;
    finish({ ...supervisor, id: 'replacement' });
    await tick();
    assert.equal(invalidations, changedWhilePending ? 0 : 1);
    cleanup();
  }
});

test('a rejected password login does not restart bootstrap and unmount its form', async () => {
  const g = gateway();
  g.object.signIn = async () => ({ errorCode: 'invalid_credentials' });
  const auth = authModule.createAdminAuthProvider(() => g.object);
  assert.equal((await auth.login({ email: 'test@example.com', password: 'invalid' })).success, false);
  assert.equal(auth.getSessionVersion(), 0);
});

test('identity is derived from the verified session without another user/profile read', async () => {
  const g = gateway();
  let userReads = 0;
  let profileReads = 0;
  let name = 'Before';
  const getUser = g.object.getUser;
  const getProfile = g.object.getProfile;
  g.object.getUser = async () => { userReads++; return { ...await getUser(), email: 'admin@example.com' }; };
  g.object.getProfile = async () => { profileReads++; return { ...await getProfile(), full_name: name }; };
  const auth = authModule.createAdminAuthProvider(() => g.object);
  await auth.check();
  await auth.getPermissions();
  const cache = new QueryClient();
  const options = () => ({ queryKey: ['admin-identity', auth.getSessionVersion()], queryFn: () => auth.getIdentity(), staleTime: 60_000 });
  const identity = await cache.fetchQuery(options());
  assert.equal(identity.name, 'Before');
  assert.equal(identity.email, 'admin@example.com');
  assert.equal(await cache.fetchQuery(options()), identity);
  assert.equal(userReads, 1);
  assert.equal(profileReads, 1);
  name = 'After';
  auth.invalidateSession();
  await auth.getAuthorization();
  assert.equal((await cache.fetchQuery(options())).name, 'After');
  cache.clear();
  assert.equal(userReads, 2);
  assert.equal(profileReads, 2);
});

test('branding joins bootstrap loading and starts in parallel with permissions', () => {
  const pendingBrand = bootstrapFixture('/users', checked, granted, { isPending: true });
  assert.equal(pendingBrand.mounted, 0);
  assert.ok(pendingBrand.html.includes('جارٍ التحميل'));
  const pendingPermissions = bootstrapFixture('/users', checked, { ...granted, isPending: true, isSuccess: false });
  assert.equal(pendingPermissions.brandingOptions.enabled, true);
  assert.equal(pendingPermissions.permissionOptions.enabled, true);
  const pendingAuth = bootstrapFixture('/users', { ...checked, isPending: true, data: undefined }, granted);
  assert.equal(pendingAuth.brandingOptions.enabled, false);
  assert.equal(bootstrapFixture('/sign-in', checked, granted).brandingOptions.enabled, false);
  const result = bootstrapFixture('/users', checked, granted);
  assert.equal(result.accessState.identity.data.name, 'Admin');
  assert.equal(result.accessState.branding.name, 'الرحلة');
  assert.equal(result.accessState.isLoading, false);
  const updated = bootstrapFixture('/users', checked, granted, undefined, { ...identified, data: { ...identified.data, name: 'Changed', avatar: 'https://example.com/avatar.png' } });
  assert.equal(updated.accessState.identity.data.name, 'Changed');
  assert.equal(updated.accessState.identity.data.avatar, 'https://example.com/avatar.png');
  assert.equal(bootstrapFixture('/users', checked, granted, { isPending: false, isError: true }).mounted, 1);
  for (const identity of [
    { ...identified, isPending: true, isSuccess: false, data: undefined },
    { ...identified, isError: true },
    { ...identified, data: null },
    { ...identified, data: { ...identified.data, id: 'other' } },
    { ...identified, data: { ...identified.data, role: 'super_admin' } },
  ]) assert.equal(bootstrapFixture('/users', checked, granted, undefined, identity).mounted, 0);
  assert.equal(bootstrapFixture('/users', checked, granted, undefined, { ...identified, isFetching: true }).mounted, 1);
  assert.deepEqual(Array.from(result.identityOptions.queryKey), ['admin-identity', 7]);
  assert.equal(result.identityOptions.staleTime, 60_000);
  assert.equal(result.identityOptions.retry, false);
  assert.equal(result.identityOptions.refetchOnWindowFocus, false);
});

test('branding query is session-scoped and favicon synchronization cleans up', () => {
  const model = loader()('features/site-branding/model.ts');
  const options = model.siteBrandingQuery({ enabled: true, version: 4, profileId: 'actor' });
  assert.equal(options.meta.authVersion, 4);
  assert.equal(options.meta.identity, 'actor');
  assert.equal(options.dataProviderName, 'siteSettings');
  assert.equal(options.queryOptions.refetchOnWindowFocus, false);
  assert.equal(model.siteBrandingQuery({ enabled: false, version: 5 }).queryOptions.enabled, false);
  assert.equal(model.siteBrandingValues({ siteName: '  الرحلة  ', logo: 'javascript:bad', favicon: 'data:image/png,x' }).name, 'الرحلة');
  assert.equal(model.siteBrandingValues({ logo: 'javascript:bad' }).logo, undefined);
  const effects = [];
  let removed = false;
  let appended;
  let captured;
  const { useAdminBranding } = loader({
    react: { ...React, useEffect: (effect) => effects.push(effect) },
    '@refinedev/core': { useOne: (input) => {
      captured = input;
      return { query: { isPending: false }, result: { siteName: 'Brand', favicon: 'https://example.com/favicon.png' } };
    } },
  }, {
    document: { createElement: () => ({ remove: () => { removed = true; } }),
      head: { appendChild: (link) => { appended = link; } } },
  })('hooks/auth/use-admin-branding.ts');
  function ReadBranding() { useAdminBranding({ enabled: true, version: 4, profileId: 'actor' }); return null; }
  renderToStaticMarkup(React.createElement(ReadBranding));
  assert.equal(captured.meta.identity, 'actor');
  const cleanup = effects[0]();
  assert.equal(appended.href, 'https://example.com/favicon.png');
  cleanup();
  assert.equal(removed, true);
});
