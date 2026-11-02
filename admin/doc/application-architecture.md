# Admin application architecture

## Startup and protected shell

`src/routes/__root.tsx` mounts the shared application providers and the single
`AdminLayout` for protected routes. The Refine composition lives in
`src/providers/refine/provider.tsx`, which registers the central resources,
named data providers, Supabase authentication, access control, router adapter,
Arabic notifications and i18n. `AdminAccessProvider` waits for the verified
session, permissions, identity and branding before protected content mounts.
Sign-in, OAuth callback/link and password reset screens remain outside the
admin shell.

`src/providers/refine/resources.ts` is the sole resource and navigation
registry. It owns names, labels, list/create/edit/show paths and named provider
metadata. The sidebar reads the same navigation definitions and uses
`AuthorizedSidebarItem`, so direct page checks and sidebar visibility share
Refine authorization policy.

## Data reads and writes

| Resource/data | Refine provider | Reads and writes |
|---|---|---|
| Catalog and shared settings | `default` / `siteSettings` | Existing Supabase data provider |
| Own account | `account` | `account-data-provider.ts` |
| Notifications | `notifications` | `notifications-data-provider.ts` and allowlisted commands |
| Media library | `mediaLibrary` | `media-library-data-provider.ts` and the existing Supabase Edge Function |
| Users | `users` | `users-data-provider.ts` and the existing `admin-users` Edge Function |
| Store orders | `orders` | `orders-data-provider.ts`; list/detail enrichment and allowlisted custom commands |

The registered `refineDataProviders` map is in
`src/providers/refine/data-provider/index.ts`. Providers translate Refine
requests into existing Supabase reads/writes and return `{ data, total }` or
`{ data }`; they do not own React UI state or a second cache. The admin order
provider uses the shared authenticated Supabase client, existing RLS/tables,
triggers and already deployed RPCs.

## Resource list architecture

```text
Feature list route
  → ResourceView and list ResourceAccessGate
  → useResourceController / useResourceTable
  → Shuip table bridge backed by Refine useTable
  → named provider getList
  → Refine / TanStack Query cache
  → DataTable, row actions and dialogs
```

`ResourceView` and its presentation are in `src/components/resources/`.
Selection context (`src/contexts/resource/`) contains only selected row/action
state. `useResourceScope` owns selection and record lookup;
`useResourceController` combines scope, table state and authorization;
`useResourceTable` owns Refine table configuration and local-only drag order.
The list authorization gate wraps the controller so denied/pending pages do not
mount resource queries.

## Route forms and details pages

The module-scope `createResourcePage` factory in
`src/components/resources/page/` defines two kinds. `kind: "form"` combines
Refine core `useForm` with a feature-owned TanStack `useAppForm`; `kind:
"details"` combines a single Refine `useOne` record with a shared command
controller. Both produce stable compound components and page context. The page
provider is in `src/contexts/resource-page/`; `useResourcePage` is the typed
reader in `src/hooks/resources/page/`. Page context remains separate from list
selection context. Form pages expose the TanStack instance as `page.form` and
feature-owned helpers as `page.feature`; details pages expose no form.

Form definitions may declare named upload slots with a folder, accepted types,
maximum size and file count. `ResourceUploadSlots` creates one signed UploadCN
queue per slot through `useResourceUploadSlot`, with `autoUpload: false`, retry
disabled and the same Refine `uploads/upload` permission used by the media
library. The registered `ImageUploadField` reads its named slot, renders the
shared UploadCN picker/progress/preview/removal UI through `BaseFormField`, and
can compose a feature-owned source picker such as the product media library.
The preview shows `جارٍ الرفع…` only for IDs being resolved by the current Save
submission; merely selecting a file does not show upload progress.

For form pages, `useResourceFormCrud` is a thin adapter around Refine `useForm`.
Refine owns edit query state, create/update mutations, CRUD invalidation and
redirect helpers. The adapter performs fresh authorization and record checks.
Resource forms use `useResourceFormBaseline` to keep rendered defaults aligned
with successful resets; its configuration reference advances before TanStack
notifies subscribers, preventing the next layout effect from restoring the
original record. Failed saves and background reads never change that baseline.
Feature `useAppForm` owns values, validation, dirty/touched state and
`isSubmitting`; the shared page upload resolver checks permission, starts the
selected files, waits for all of them and returns their Cloudinary URLs. The
feature maps those URLs into its allowlisted payload.
After a successful direct upload, the slot invalidates `uploads` list/many
queries through the named `mediaLibrary` provider. Page forms call the shared
`context.submit({ prepare, reset })`. `useResourceFormSubmission` owns error
toasts, the whole-submission guard, one awaited Refine list/many/detail
invalidation, authoritative edit refresh, upload cleanup, baseline reset and
create redirect. The page composer disables automatic mutation invalidation
once to avoid duplicating that explicit refresh. Dialogs retain automatic
Refine invalidation. Features own only their schema, values, payload mapping
and reset adapter. The context provider accepts the prepared runtime.

See [Resource form submission](./resource-form-submission.md) for the final
flow, component/hook responsibilities, failure states and verification.

Products use `/catalog/products/create` and
`/catalog/products/:id/edit`; their route wrappers forward only the optional
ID. Resource metadata drives the CreateButton and row Edit navigation. Details
resources use Refine show paths and do not receive a form or implicit Save
button.

The product `onSubmit` awaits `resolveImages("cover", values.images)` before
building the payload and calling `save`. If any upload fails or returns no
secure URL, the resolver rejects and the Refine create/update mutation is never
called. TanStack Form remains submitting through both upload and save.

## Command architecture and orders

Feature command definitions specify labels, authorization action, eligibility,
logical provider command, optional fields/validation and invalidation targets.
`useResourceCommands` performs a fresh access check, refetches the current
record, reruns eligibility, and executes one Refine `useCustomMutation` through
the named provider with retry disabled. It then calls Refine `useInvalidate`
for the declared targets. Pending/error state comes from Refine mutation state;
the hook keeps only selection and preflight/refresh feedback locally.

`useResourcePage(orderPage).actions.<command>` supplies one typed descriptor.
The compound Button and menu presentations are built from the descriptor's
`buttonProps` and `menuItemProps`. Their AlertDialog/input dialog calls the same
`execute` handler; feature-specific presentation can consume the same props
without creating another mutation or cache path.

The `/orders` list uses Refine server filters, search, pagination and sorting.
The named `orders` provider batches order items, customer/participant profiles
and catalog names for the current page. `/orders/:id` reads one enriched record
and shows payment/XPay state, shipping, item customization, totals and
timestamps. Its allowlisted commands cover preparation, shipping, delivery,
cancellation, recording electronic delivery and retrying publisher earnings.
Updates compare expected status and `updated_at`; partial audit/notification/
payout failures are reported after a successful transition and never replay
that transition automatically. Box fulfillment stays on its separate path.

## Cache and security boundaries

Refine and its configured TanStack Query client own resource query keys and
CRUD cache invalidation. Standard create/edit operations use Refine automatic
invalidation. Commands outside CRUD explicitly use Refine `useInvalidate` for
their declared related resources. Neither resource context stores fetched data.

Refine access checks and UI gates control what appears in the admin. Existing
Supabase RLS and existing server functions remain the authoritative security
boundaries. For orders, the current admin RLS policy is broader than the
frontend `canManageOrders` check, so client-side authorization does not narrow
direct database access.

No new or modified Supabase functions, migrations, schema, policies, Next.js
APIs or deployments are part of this implementation. The order commands use
only currently existing tables, triggers, policies and RPCs. XPay callbacks
remain authoritative for payment.

## Detailed implementation guide

See [Resource pages, forms and commands](./doc.md) for component and hook
ownership, list/page flows, form lifecycle, command descriptors, order command
rules, cache behavior and verification steps.


Resource table position persistence is documented in
[Resource row reordering](./resource-reordering.md). It is opt-in through
`orderField`, debounced only after drop, and uses the existing named Refine
provider and `useUpdate` without backend changes.
