# Architecture Context

## Stack

| Layer     | Technology                  | Role   |
| --------- | --------------------------- | ------ |
| Framework | [e.g. Next.js + TypeScript] | [Role] |
| UI        | [e.g. Tailwind + shadcn/ui] | [Role] |
| Auth      | [e.g. Clerk]                | [Role] |
| Database  | [e.g. Prisma + PostgreSQL]  | [Role] |
| [Layer]   | [Technology]                | [Role] |

## System Boundaries

### Refine resources and business commands (agreed standard)

Refine owns resource CRUD, table query state and the resource cache, backed by TanStack Query. Business commands use feature-owned TanStack Query `useMutation` hooks that call Supabase RPC through the shared authenticated client, then refresh affected Refine queries with `useInvalidate`.

The [resource migration plan](./resource-migration-plan.md) specifies proposed views, filters, search, sorting, pagination, forms and delivery phases for the legacy admin. Its [route inventory](./legacy-admin-route-inventory.md) maps all 88 source page routes and the 58 navigation tabs/permissions. These documents are a plan and source audit, not evidence that the resources or RPCs are implemented or deployed.

| Operation | Owner | Supabase access |
| --- | --- | --- |
| List/detail reads | Refine `useTable`, `useList`, `useOne` | Existing Supabase data provider |
| Create/update/delete a resource | Refine `useCreate`, `useUpdate`, `useDelete` and existing resource dialogs | Existing Supabase data provider |
| Confirm/cancel an order or another business command | Feature hook using TanStack Query `useMutation` | Named database function through `supabaseClient.rpc(...)` |
| Column sorting, filters and pagination | Refine table state | Provider applies these to the database query |
| Persist a manually reordered sequence | Feature command mutation | RPC saves the permitted sequence atomically |

#### CRUD resources and tables

- Register resources in the existing resource registry and reuse `ResourceProvider`, resource dialogs and the shared Supabase data provider. Keep feature fields, schemas, defaults and allowlisted payload mapping in the feature.
- Ordinary field edits use Refine CRUD mutations. Business operations with transition rules or coordinated writes use an explicit command such as `confirm_order`; the UI does not implement those operations as an unrestricted status update.
- Configure sorting with `refineCoreProps.sorters` / Refine `setSorters`, and let the Supabase provider apply it before pagination. Use a stable secondary key such as `id` when primary sort values can tie. Display sorting does not write a stored sequence.
- Keep reads in Refine so tables, details, counts and selectors share its query keys. Do not introduce parallel feature query caches for the same resource data.

#### Command flow and cache ownership

1. A row/menu/dialog action calls a feature hook such as `useConfirmOrder`. The component supplies explicit command inputs and renders pending/error/success states; it does not own database rules.
2. The hook uses `useMutation` from `@tanstack/react-query` and calls a feature command function using the existing shared Supabase client. Pass typed, validated arguments to `supabaseClient.rpc("confirm_order", { p_order_id: orderId })`; throw returned Supabase errors so the mutation enters its error state.
3. The database function enforces authorization and allowed transitions, and performs related database writes in one transaction. RLS and appropriate function permissions remain authoritative. Prefer security-invoker functions; any privileged execution requires explicit authorization checks. An RPC name in this document is illustrative, not an existing database contract.
4. After success, use Refine `useInvalidate` for the affected resource list/detail queries, the affected record ID and any related counts or resources changed by the command. Specify `dataProviderName` when the resource uses a named provider. Invalidation must target the same Refine context/provider that owns the reads.
5. Use the QueryClient backing that Refine context. Do not mount a separate QueryClient/cache for commands or manually reproduce Refine query keys. Guard duplicate submissions and disable automatic retries (`retry: false`) unless the command is explicitly designed for safe retries. A mutation pending state alone does not provide server-side idempotency.

Commands belong in their feature, for example `features/orders/commands.ts` for RPC calls and `features/orders/use-confirm-order.ts` for mutation state and invalidation. Reuse schemas from `src/lib/schema/` where applicable. Generic resource components supply action handlers and remain unaware of order-specific RPCs. Commands involving external services may use a server/Edge Function boundary; database rules and atomic database writes still belong on the server.

#### Saved row ordering

- Existing row dragging remains UI-only and limited to the loaded page. `onReorder(ids, rows)` is an extension point, not an automatic persistence contract.
- When a feature explicitly requires saved ordering, define its sequence field (for example the catalog's `sort_order`), scope and pagination/filter behavior first. A feature mutation calls an RPC that validates the rows and permissions and writes the sequence atomically, then invalidates the Refine list. Do not assume the currently loaded page is the complete sequence.

#### Adoption status

This is the standard for new business commands. Current CRUD/resource table behavior already follows the Refine path. Notification mark-all-read still uses the existing Refine `useCustomMutation` adapter described below; it has not been migrated by this documentation change. Before implementing a direct TanStack mutation, declare `@tanstack/react-query` as a direct admin dependency at a version compatible with Refine's installed QueryClient. No order RPC, persisted reordering, dependency change or runtime migration is introduced here.

### Application error handling

- `AppErrorBoundary` in `components/route-states/` wraps the full application in `main.tsx`, outside Suspense, development tools, theme/direction/tooltip providers, router and toaster. Render/lifecycle failures outside route boundaries reuse the shadcn `RootError` screen with retry (remount children) and full reload actions. It has no dependency on Refine, router or theme context and supplies RTL explicitly.
- TanStack Router continues to use `RootError` for route failures. User-facing error copy is generic; raw details appear only in development. Error boundaries do not catch Vite import/compilation failures, event-handler exceptions or arbitrary rejected promises; request/form handlers retain their existing error states. Restart the dev server after branch switches that remove/recreate Vite config or imported modules if its resolver retains stale failures.

### Shared admin session and identity

- `createAdminAuthProvider` shares one verified user/profile read between route `check` and `getIdentity`. Successful eligible-admin results stay in browser memory for 60 seconds; simultaneous calls share one promise. Missing users, rejected roles, archived profiles and failed reads are not cached as successful sessions. New reads still use Supabase `getUser` and the existing profile query.
- Login/logout and Supabase session-token/account changes or `USER_UPDATED` invalidate the cache. A version prevents older in-flight requests from repopulating it after invalidation. The Supabase listener is synchronous, registered before route guards, and unsubscribed during hot reload. Repeated same-session `SIGNED_IN` events do not invalidate the cache.
- Root `AdminIdentityProvider` owns the only UI `useGetIdentity` call, above all nested Refine contexts. Layout, notifications and user components consume `useAdminIdentity`; showcase providers cannot create a second identity read. Its versioned Refine key drops previous-session results, disables sign-in/OAuth reads, uses 60-second freshness, and disables window-focus refetch. Old unused identity keys are immediately collected.
- Route guards still reject unavailable/unauthorized sessions and revalidate when the shared cache expires. Account switches, logout and user updates re-run the router guard. The short cache is for browser navigation/display only; existing database RLS and server authorization remain authoritative for data access and mutations. No persistent identity cache or database change is introduced.

### Site branding and home navigation

- `features/site-branding/SiteBrandingProvider` (implemented in `provider.tsx`) mounts inside root Refine above the route outlet. It reads only site name/logo/favicon from `site_settings` / `general` using the root named `siteSettings` provider and the shared authenticated Supabase client. The existing route guard permits the read only on protected pages; sign-in and OAuth callback disable it. It starts alongside layout identity loading, without waiting for `useGetIdentity`, and never blocks page rendering.
- Root Refine owns the in-memory cache: five-minute freshness, thirty-minute retention, no polling or window-focus refetch. Branding context crosses nested showcase Refine boundaries, so showcase does not register or query its own branding provider. Demo default providers remain local. Full page refresh reloads branding; no localStorage or static asset export is used.
- `SiteBranding` renders only the logo in the expanded sidebar (including the mobile drawer) and only the favicon in the collapsed sidebar. Fixed-size shadcn Skeletons cover initial metadata/image loading; background data refresh retains the previous result. Empty/failed images fall back to the site name/book icon. A scoped effect synchronizes the browser favicon and removes its own link on unmount/change. Only HTTP/HTTPS image URLs are accepted. No configuration writes are made.
- The header uses shadcn Breadcrumb with TanStack Router's Link for `/`, including on showcase pages where the demo Refine Link intentionally suppresses navigation. `/` remains the existing redirect to `/theme`; the auth router's allowlist accepts `/` too.

### Header notifications (implemented)

- `features/notifications/use-header-notifications.ts` owns the current-user read model through Refine `useGetIdentity` and two `useList` queries. Both filter `recipient_profile_id` explicitly; the recipient is included in Refine's cache keys. Queries stay disabled without an identity and do not use previous-recipient placeholder data.
- Root Refine and the showcase context expose `notificationsDataProvider` under the named `notifications` provider; it delegates normal reads to the existing shared Supabase data provider. The showcase default remains `previewDataProvider`; the nested form prototype retains its own local provider. Notification hooks always specify the named provider and never depend on a demo's default.
- Latest 20 rows and exact unread total are separate reads. Both poll every 10 seconds while the header is mounted in a visible tab, even if the popover is closed. Polling pauses in hidden tabs and ends on unmount. Failed refreshes retain successful cached data, expose a visible error and allow manual retry; an unknown unread total is not displayed as zero.
- `NotificationsPopover` is mounted once in `AdminLayout` for desktop/mobile, uses shadcn Popover and semantic tokens, and formats timestamps in `ar-EG` / `Africa/Cairo`. It renders plain notification text and a local link to `/notifications`; stored notification links remain inactive. Shared `NotificationItem` uses semantic primary colors for unread items and muted colors for read items, with explicit status labels. `/notifications` lists all current-user notices with 20-row pagination and the same read/error/polling behavior.
- `MarkAllReadButton` invokes Refine `useCustomMutation` through the named provider using the logical command `notifications/mark-all-read`. The adapter verifies the shared client session with `auth.getUser`, rejects a changed expected identity, and updates only `is_read` on that verified user’s unread rows in one database statement. It does not enumerate IDs, so pagination and the 1,000-row response limit do not restrict the update. Submission is guarded while pending, mutations do not automatically retry, and failures stay visible. Success invalidates notification list queries (including the count). Existing RLS remains authoritative; no schema changes, sends, deletes or Realtime subscriptions were introduced.

### Validation schemas (implemented)

- `src/lib/schema/` is the shared validation layer for auth and legacy admin feature families. Only auth, platform products and add-ons currently consume it in live admin UI. It exports Zod schemas, inferred input/output types and separate form/action/read registries through `index.ts`; it does not import feature code or execute requests.
- Existing client product/add-on input rules were reviewed as reference. Admin form values preserve numeric strings; feature models own defaults, row adapters and allowlisted database payload mapping. Schema extraction preserves existing admin validation behavior. See `src/lib/schema/README.md` for scope and source differences.

### Resource page context (implemented)

- `components/resources/resource-provider.tsx` is the complete reusable page entry point. It owns Refine table configuration, context/page/dialog composition and optional local row dragging. Callers pass a resource, columns, title/description and a form definition with a fields render function. It remounts its controller when the resource changes.
- `components/resources/resource-context.tsx` supplies the lower-level `ResourceScopeProvider`: page-scoped resource name, selected action/row ID, loaded row and open/close callbacks. The public provider supplies its loaded table rows automatically.
- `ResourceRowActions` and the create toolbar use that context; optional `rowActions` config supplies icon/handler definitions.
- `ResourceDialogs` mounts one keyed dialog for create/edit/delete; generic `ResourceEditor` binds the form definition to `ResourceFormDialog`. Catalog fields, validation, defaults and payload mapping remain in `CatalogFormFields`; `CatalogResource` is a small catalog-defaults adapter. The existing Refine data provider owns database requests; context selection itself performs no requests.
- Delete identity/name come from the loaded table rows. Edit reads and create/update mutations remain in `ResourceFormDialog`. No application-wide selected-row singleton is introduced.

The public provider accepts `resource`, `title`, optional `description`, `columns` and `form`. `form.fields` receives `resource`, `action`, `record`, `formId`, `disabled` and `onSave`; render a feature form component that binds its native form to `formId`, validates its inputs and calls `onSave` with an explicit payload. Features retain their own `useAppForm` fields and schemas.

Optional configuration includes `searchField`, `refineCoreProps`, `canCreate`, `canDelete`, `rowActions`, `deleteConsequence`, `storageKey`, `enableRowReordering`, `getRowLabel` and `onReorder(ids, rows)`. Dragging is off by default in the generic provider, applies only to the loaded page, and never persists automatically. Catalog's adapter preserves name search, sort_order/id sorting and enabled local dragging.

- `[folder]` — [What this folder owns and is responsible for]
- `[folder]` — [What this folder owns and is responsible for]
- `[folder]` — [What this folder owns and is responsible for]
- `[folder]` — [What this folder owns and is responsible for]

## Storage Model

- **[Storage type e.g. Database]**: [What lives here —
  e.g. metadata, ownership, relationships]
- **[Storage type e.g. Blob/File Storage]**: [What lives
  here — e.g. generated files, media, large artifacts]

## Auth and Access Model

- [How authentication works — e.g. Every user signs in
  via Clerk]
- [How ownership works — e.g. Every project has a single
  owner]
- [How access control works — e.g. Only the owner or a
  collaborator can mutate project resources]

## Invariants

1. [Rule the codebase must never violate — e.g. Request
   handlers do not run long-lived background work]
2. [Invariant two]
3. [Invariant three]
4. [Invariant four]
