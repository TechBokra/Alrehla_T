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
