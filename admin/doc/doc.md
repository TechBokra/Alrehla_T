# Resource pages, forms and commands

This guide describes the implemented Refine architecture in `admin/` as of
2026-11-02. Refine owns resource metadata, provider selection, reads, CRUD
mutations and query invalidation. The application adds feature-owned forms,
authorization checks, record rules and business commands without creating a
second data cache or resource registry.

## 1. Ownership

| Concern | Owner | Code |
|---|---|---|
| Resource identity, routes and provider names | Refine registry | `src/providers/refine/resources.ts` |
| App providers, auth, notifications and i18n | Refine composition | `src/providers/refine/provider.tsx` |
| Table request state and cache | Refine core + TanStack Query | `useDataTable` bridge and Refine hooks |
| List/dialog composition | Shared resource UI | `src/components/resources/` |
| Page and command context | Thin context + shared hooks | `src/contexts/resource-page/`, `src/hooks/resources/page/` |
| CRUD record query/save/invalidation | Refine `useForm` adapter | `src/hooks/resources/crud/use-resource-form-crud.ts` |
| Form values and validation | TanStack Form via Shuip | Feature forms using `useAppForm` |
| Field and page business rules | Feature modules | `src/features/<feature>/` |
| Supabase request mapping | Named data providers | `src/providers/refine/data-provider/` |
| Server-side authorization | Existing Supabase RLS and existing functions | No backend changes in this work |

Refine remains useful beyond calling a data provider: it supplies the resource
registry and provider abstraction, route helpers, table state, auth/access
integration, notifications/i18n, the `useForm` CRUD lifecycle, cache keys and
automatic invalidation. TanStack Form is used only for field values, validation,
dirty state and submission state.

## 2. Resource list flow

```text
Feature list page
  → ResourceView
  → Refine list authorization gate
  → useResourceController / useResourceTable
  → useDataTable bridge / Refine useTable
  → named data provider getList
  → Supabase
  → Refine / TanStack Query cache
  → DataTable, row actions and dialogs
```

The list gate mounts the table controller only after `list` access is allowed.
Pending, denied and failed permission checks do not start list reads. Refine
holds table query state and owns the cache; context holds only selected rows and
dialog state.

`ResourceView` owns the reusable table presentation. Feature pages supply
columns, search fields, initial sorters and permanent filters. The bridge maps
search, filters, sorting and pagination to Refine's server request. Shared
defaults are `DEFAULT_SEARCH_DEBOUNCE_MS` (300 ms) and
`DEFAULT_RESOURCE_PAGE_SIZE` (20 rows), both in `src/lib/const.ts`. A resource
may choose visible page-size options independently.

`ResourceContextProvider` in `src/contexts/resource/` receives a prepared value
only. `useResourceScope` prepares selection state and record lookup;
`useResourceController` composes scope, resource permissions and table state.
Row action components perform their own Refine authorization checks and call
the shared CRUD hooks. Feature `canEdit(record)` rules may restrict eligible
records but never grant permission.

## 3. Shared route-page factory

`createResourcePage` is defined in
`src/components/resources/page/create-resource-page.tsx`. It is called once at
module scope and returns stable compound components bound to one typed
definition. Its definitions are discriminated:

| Kind | Read/lifecycle | Composition |
|---|---|---|
| `kind: "form"` | Refine core `useForm` for create/edit | Feature form, fields, footer, dirty guard, optional commands |
| `kind: "details"` | One Refine `useOne` query plus command controller | Feature details, command actions/dialogs; no form or implicit Save button |

The form definition holds resource and provider identity, optional dialog/page
configuration, titles, feature form adapter, record restriction, error
formatter and save behavior. The details definition holds its resource,
provider, title, read content and command map. Both expose bound `.Page`,
`.Fields`, `.Footer`, `.DirtyGuard`, `.Action`, `.ActionMenuItem` and
`.CommandDialogs` components. Their component identities are stable because
the factory is not called during render.

The `useResourcePage(definition)` hook reads the page context and returns its
record, optional ID, request state, named shared upload handles, stable bound
components' data and typed `actions`. Form definitions expose the TanStack
`useAppForm` instance as `form` and feature-owned state separately as
`feature`. Details definitions return action descriptors; they do not return a
form.
Page context (`src/contexts/resource-page/`) is separate from table/dialog
selection context (`src/contexts/resource/`). Both providers accept prepared
values and contain no request or permission logic.

Example feature ownership:

```tsx
export const productForm = createResourcePage<Product, ProductFeatureForm>({
  kind: "form",
  resource: "personalized_products",
  page: {
    title: (mode) => mode === "create" ? "إضافة منتج" : "تعديل المنتج",
    canEdit: isEditableProduct,
    getErrorMessage: catalogError,
    useFeatureForm: useProductFeatureForm,
    Content: ProductFormContent,
    Fields: ProductFormFields,
  },
});

// The route wrapper only forwards the optional route ID.
export function ProductFormPage({ id }: { id?: string }) {
  const Page = productForm.Page;
  return <Page id={id} />;
}
```

The product list passes `form={productForm}` and `mode="page"` to
`ResourceView`. The resource registry provides the create/edit route patterns;
Refine's CreateButton and the default row Edit action use those registered
routes. Dialog resources use the same `kind: "form"` contract with a dialog
field renderer. A details-only resource uses the `kind: "details"` contract and
does not need a fake form definition.

## 4. Component and hook responsibilities

| Module | Responsibility |
|---|---|
| `components/resources/view/resource-view.tsx` | List permission boundary, table page and dialog host |
| `components/resources/page/create-resource-page.tsx` | Bind stable route page components; render loading, failure and unavailable states; prepare context |
| `components/resources/page/resource-command-dialogs.tsx` | Render a command's AlertDialog or input dialog using the shared descriptor |
| `contexts/resource-page/index.tsx` | Thin page context provider and context reader |
| `hooks/resources/page/use-resource-page.ts` | Read the context with definition-derived record/form/action types |
| `hooks/resources/page/use-resource-commands.ts` | One Refine custom mutation, permission/record preflight, duplicate guard and explicit invalidation per detail scope |
| `hooks/resources/crud/use-resource-form-crud.ts` | Thin Refine `useForm` adapter for access, fresh record check, save result and page redirect helper |
| `components/resources/page/resource-upload-slots.tsx` and `hooks/resources/page/use-resource-upload-slot.ts` | Build named UploadCN queues and signed adapters from page configuration, check upload permission and await selected files |
| `components/forms/fields/image-upload-field.tsx` | Registered image field with BaseFormField, UploadCN queue/preview UI and an optional feature media picker |
| `components/resources/forms/page/resource-form-footer.tsx` | Subscribe to TanStack Form and render save/cancel buttons |
| `components/resources/forms/page/resource-form-dirty-guard.tsx` | Confirm dirty route navigation and use the browser's unload warning |
| `features/<feature>/` | Schemas, defaults, payload mapping, fields, detail content and business rules |

Presentation components render descriptor props. They do not create a second
mutation, permission check or cache path for a feature command.

## 5. CRUD form lifecycle

Refine core `useForm` is the CRUD lifecycle owner:

| Responsibility | Owner |
|---|---|
| Edit record read/query state | Refine `useForm` query |
| Create/update request and mutation state | Refine `useForm` mutation and `onFinish` |
| CRUD cache invalidation | Refine automatic invalidation by default; shared page submissions await explicit Refine invalidation |
| Redirect helper | Refine `useForm.redirect`; automatic redirect is disabled |
| Field values, validation, touched/dirty and `isSubmitting` | TanStack `useAppForm` |
| Fresh access and record eligibility | Thin application preflight |
| Named adapter/uploader setup, queue and upload permission | Shared resource upload slots |
| Waiting for selected image uploads and rejecting failures | Shared resource upload resolver |
| Image field state and media-library picker composition | Registered shared field plus optional feature picker |
| Mapping uploaded URLs into an allowlisted resource payload | Feature form hook |

The edit query is enabled only after access is allowed and uses retries disabled.
The adapter rechecks access before save, refetches the same edit query for
record eligibility, then calls Refine `onFinish`. It does not mount a second
detail query. The feature's `onSubmit` asks the shared upload resolver for
selected image URLs and maps them into the allowlisted payload inside the
`prepare` callback passed to shared `context.submit({ prepare, reset })`. The
shared resource submission invokes save only after preparation succeeds. The
resolver waits until all selected files finish; any upload failure
rejects before the Refine create/update mutation can run. TanStack Form remains
submitting through upload and save.

Queued covers do not show upload progress before Save. The shared upload slot
marks only IDs being resolved by the current save operation as active, and
disables queue controls until those uploads finish. After a direct Cloudinary
upload succeeds, it invalidates the internal `media-assets` query so the asset
appears in the product image picker. The shared page
composer disables automatic mutation invalidation; `useResourceFormSubmission`
then awaits one Refine invalidation for the resource's list/many/detail targets.
On edit it refreshes the existing detail query and invokes the feature's reset
callback with that server result. The product adapter uses
`useResourceFormBaseline`: it advances the configured defaults before calling
TanStack reset so the next render cannot reapply the original record. It clears completed uploads and redirects a
successful create only after reset. Image replacement/removal therefore updates
the form baseline, while removing an association never deletes the asset.

Shared resource submission owns prepare/save error toasts, refresh-failure
feedback and the duplicate guard across preparation through reset. Product
feature code retains validation, defaults, upload-to-payload mapping and its
TanStack reset adapter. Dialogs retain automatic Refine invalidation and close
after save. Failed saves retain entered values for retry. Background query
refreshes do not reset dirty form state. Refine mutation state supplies pending and server errors;
local state is limited to permission/preflight and non-mutation feedback.

`ResourceFormFooter` is rendered inside `form.AppForm`; it disables Save while
TanStack validation is running/invalid or the page is externally disabled or
pending. Save labels and cancel visibility are presentation props. No generic
validation banner is shown. Backend errors can be mapped through a feature
`getErrorMessage` formatter; field validation remains beside each field.

The product page keeps the existing responsive field grid, Shuip fields,
`BaseFormField`, a declared signed Cloudinary cover slot, deferred upload, media
permission gate and product schema. Its separate preparation-days save uses a
Refine update mutation and reuses `useForm`'s detail query for its fresh record
check. It is blocked while the main product form is dirty. Add-ons use the same
form contract in dialog mode. The users resource has only a placeholder form
configuration; this change does not expand it.

The product form presents name, category, read-only platform ownership, short
and long descriptions, paper/electronic prices, custom-story writing styles,
minimum/maximum age, feature lines, one book cover and the edit-only active
flag. The long description keeps its Markdown helper copy. Creation remains
platform-owned, approved and inactive. Writing styles keep their existing
storage semantics. Sort order stays out of the form and remains a table
ordering concern.

Selected image files remain local until Save. The shared UploadCN slot uploads
the cover before Refine submits the product payload; the form stays submitting
until both operations finish. Failed uploads reject preparation and do not
create or update the product. Existing saved images are preserved unless the
user replaces/removes the association; removing an association never deletes a
Cloudinary asset. Failed/pending uploads disable Save.
Preparation days are a separate edit-only save, 1–120 or blank. The staging
setup notice reflects the local nullable-column migration; this implementation
does not apply that migration remotely.

## 6. Shared command actions

Every command definition contains a key, Arabic label and description,
authorization action, provider command identifier, eligibility rule, payload
mapper, optional fields/validation/error formatter, and Refine invalidation
targets. Feature command contracts live beside feature rules, such as
`src/features/orders/commands.ts`.

`useResourcePage(orderPage)` returns typed descriptors such as:

```tsx
const order = useResourcePage(orderPage);
order.actions.startPreparation.buttonProps;
order.actions.startPreparation.menuItemProps;
order.actions.startPreparation.isPending;
order.actions.startPreparation.error;
```

`<OrderPage.Action name="startPreparation" />` renders a Button from the same
descriptor's `buttonProps`; menu items use `menuItemProps`. Feature UI may use
those props directly. Each presentation opens the same shared AlertDialog or
input dialog; confirmation calls the descriptor's `execute`. Therefore the
button, menu item and custom feature presentation all share one authorization
check, fresh record check, mutation, duplicate guard, pending/error state,
feedback and invalidation.

Command inputs use `useAppForm` and existing Shuip fields. The shared controller
validates, checks fresh access, refetches the current record and reruns feature
eligibility before mutation. There is one active command per mounted detail
page; conflicting actions are disabled. Commands use Refine `useCustomMutation`
with retry disabled and the named provider's `custom` method. On success the
controller calls Refine `useInvalidate` for the declared resource/provider and
record targets. A refresh failure is reported separately from command success.
Refine mutation state owns command pending/error; local state stores only the
selected command, field input, preflight and refresh feedback.

Form-page definitions may also register commands. Their feature form adapter
exposes its current dirty state; the shared controller blocks opening and
executing record-refreshing commands while the form is dirty and renders an
Arabic prompt to save or discard first. All command presentations still use the
same descriptor and execution path.

## 7. Store orders implementation

The order resource is registered centrally at `/orders` with the named
`orders` provider and `/orders/:id` show route. Both routes remain inside the
shared `AdminLayout`; the sidebar's `AuthorizedSidebarItem` and the page gate
use the same Refine `list` permission. Orders require `canManageOrders`, with
active `super_admin` access. Generic create, edit, delete and sort actions are
denied.

The list uses Refine table state, server pagination (20 default; 20/50/100
choices), newest-first plus ID sorting, 300 ms search across order reference
and recipient name/phone, and the status, payment method and date filters.
Columns show reference/date, customer, products/add-ons, discount, total,
status, payment method and a Show action. The provider reads the current page
with the existing Supabase data provider, then batches related order items,
profiles and product/add-on names for that page.

The details page uses one Refine `useOne` record, enriched by the same provider.
Its components read that record through `useResourcePage(orderPage)` and render
customer, payment/XPay state, shipping address, products/customization, totals
and timestamps. Legacy public Cloudinary child-photo URLs are previewed;
private photo references are never converted to public URLs and show an
unavailable-preview message. Box monthly fulfillment is not handled here.

The `orders` provider exposes only these allowlisted commands:

| Command | Eligibility |
|---|---|
| Start preparation | `paid` → `preparing` |
| Mark shipped | `paid` or `preparing` → `shipped`; tracking is optional |
| Mark delivered | `shipped` → `delivered` |
| Cancel | Existing cancellable states; a reason is required |
| Mark electronic delivery | Paid fulfillment state, electronic item and delivery email, not already marked sent; records the event but does not send the file |
| Retry publisher earnings | Existing idempotent RPC, available after delivery |

XPay callbacks remain the authority for payment; there is no manual payment
confirmation, receipt-upload or refund command. Before a write, the provider
checks the current Supabase session/admin permission and reloads the order. It
conditionally updates against both expected `status` and `updated_at`; zero
changed rows become a conflict requiring refresh and intentional retry. It
preserves existing timestamp fields and calls existing audit, notification and
publisher-payout operations after the transition. Follow-up work is not
transactional with the status update: partial completion is returned as a
warning, and the transition is never retried automatically. Notification event
settings are respected; a failed settings read is fail-open as in the existing
notification helper.

## 8. Access, route and sidebar behavior

`src/providers/refine/access-control-provider.ts` is the frontend policy.
Resource pages call Refine `useCan`; submission and command hooks use a fresh
preflight. Active administrators without a matching permission are denied for
orders. The order provider checks session and permission again before custom
commands. The shared route metadata and sidebar definitions remain in
`src/providers/refine/resources.ts`; no second registry is added.

Authorization gates control the admin UI and must not be treated as a database
security boundary. Existing Supabase RLS is unchanged and currently allows
broader administrator order access than `canManageOrders` UI policy.

## 9. Cache behavior

Refine and its TanStack Query client own resource query keys and CRUD cache
invalidation. Dialog create/edit calls use Refine's automatic invalidation.
Page forms use shared `useResourceFormSubmission`, which awaits one explicit
Refine invalidation for list/many/detail after saving. The page composer disables
automatic mutation targets once to prevent duplicate invalidation. On edit the
shared hook also refreshes the existing detail query and passes that server row
to the feature reset adapter. Direct
Cloudinary uploads invalidate the internal `media-assets` query because they
bypass Refine mutations. Details commands explicitly invalidate
their declared Refine targets. The `orders` provider name is supplied on reads
and writes to keep cache/provider identity aligned. `ResourceContext` and
`ResourcePageContext` contain UI state only and are not data caches.

## 10. Backend boundary

No new or modified Supabase functions, migrations, tables/columns, policies,
Next.js APIs or deployments are included. The order commands use only existing
tables, RLS, triggers and already deployed RPCs. Do not apply a remote schema
or policy change under this work. Tightening the existing broad order RLS and
introducing server-enforced `canManageOrders` are separate, explicitly
authorized work.

## 11. Verification checklist

- Create/edit routes resolve directly and refresh; Refine Create/Edit actions
  navigate through the central resource metadata.
- A denied list/detail page mounts no resource query; the details page owns one
  Refine `useOne` record query.
- Create/edit use Refine `useForm` lifecycle and Refine invalidation (automatic
  for dialogs; shared page submission awaits explicit targeted invalidation); a
  successful create resets the form before Refine redirects to Edit.
- Compound button/menu/custom command presentations use one descriptor and
  execution path. Duplicate clicks, stale records, invalid input and permission
  failures are guarded.
- Order transitions are limited to the allowlisted states and compare both
  `status` and `updated_at`; payment callbacks remain authoritative.
- Public child-photo URLs may render; private references remain unavailable.
- Arabic RTL loading, error, dialog, keyboard and footer behavior is checked.
- Run `pnpm test`, `pnpm typecheck`, `pnpm build` and `git diff --check` from
  `admin/`. Browser verification should use controlled test records and must
  not make real fulfillment or payout changes.

Shared page submission ownership and the full flow are documented in
[Resource form submission](./resource-form-submission.md).


## Resource row order persistence

Pass `orderField="sort_order"` to ResourceView to enable persisted dragging.
The shared hook supplies ascending field/ID sorting and waits for the shared
300 ms debounce after the final drop. Features supply no update/invalidation
callback. Existing enableRowReordering without an order field remains local-only.
See [Resource row reordering](./resource-reordering.md) for authorization, complete
scope reads, pagination/filter behavior, mutation/cache ownership and partial
failure handling.


## Inline boolean resource columns

Use `createResourceSwitchColumn<Product>({ field: "is_active", label: "الحالة" })`
for a boolean CRUD switch. Column metadata registers the field with the resource
context; shared hooks perform fresh edit/record checks, a single-field Refine
useUpdate and awaited list/many/detail invalidation. The existing shadcn Switch
shows per-cell pending state and retains server-controlled values on failure.
See [Inline resource fields](./resource-inline-fields.md) for custom action cells,
allowlisting, provider identity and mutation/cache ownership.
