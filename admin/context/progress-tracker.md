# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- [e.g. Not started / In progress / Complete]

## Current Goal

- [What you are building right now]

## Completed

- Added sidebar branding from the existing `site_settings.general` logo/favicon fields through a shared named Refine provider. Expanded sidebar shows logo + site icon; collapsed sidebar keeps the icon. Missing/broken image fallback and browser-tab favicon synchronization are included. Replaced the header's demo-dependent Refine home link with a shadcn Breadcrumb using TanStack Router Link to `/`, and allowed `/` in the auth router adapter. No new database writes or schema changes. TypeScript, production build and whitespace checks passed; the existing bundle-size warning remains. No tests were added or run.

- Compacted the desktop sidebar: expanded width is now 14rem (224px), down from 16rem (256px), via `AdminLayout`'s SidebarProvider CSS variable. Navigation uses the existing small menu-button variant, tighter content/group spacing and smaller footer padding. Collapsing, RTL, tooltips and the mobile drawer retain their existing behavior. No generated UI primitives were modified. TypeScript, production build and whitespace checks passed; the existing bundle-size warning remains. No tests were added or run.

- Added `HeaderActions` next to the notification bell in `AdminLayout`: an Arabic “إجراءات سريعة” shadcn Dropdown Menu with the eight requested labels, individual Lucide icons, inherited direction and viewport-constrained width. This is presentation only: items have no destinations, business handlers or requests. Existing header behavior is preserved. TypeScript, production build and whitespace checks passed; the existing bundle-size warning remains. No tests were added or run for this UI request.

- Extended notifications with shared read/unread colors and labels, an authenticated `/notifications` page with 20-row pagination, a sidebar entry and a popover link to the page. Added “تحديد الكل كمقروء” to both surfaces through Refine `useCustomMutation`; its named-provider command derives the recipient from verified Supabase auth, checks the expected identity, updates all of that account’s unread rows in one statement, and invalidates list/count reads. Pending submissions are guarded and failures remain inline. This supersedes the earlier display-only boundary. No schema or policy changes, notification sends or deletes. Route generation, TypeScript, production build and whitespace checks passed; the existing large-bundle warning remains. No tests or real notification updates were run for this follow-up request.

- Added the read-only Arabic notification bell in `AdminLayout`. The popover displays the latest 20 current-user notifications, Cairo timestamps, unread styling and an exact unread badge (`99+` cap). A shared Refine hook polls list/count every 10 seconds in visible tabs, including when closed, disables reads without identity and preserves cached data with visible errors/retry on failures. Root/showcase register the existing Supabase provider by name; demo defaults and form prototypes remain local. No database migrations, writes, read-state updates, navigation links or Realtime subscriptions.
- Notification verification: TypeScript, production build and whitespace checks passed; 7 new notification tests + 6 existing data-provider tests + 6 existing auth tests passed with mocked network calls. Cases include scoped GET requests, exact counts above 20, empty/error responses, cache retention/recovery, recipient isolation, interval options, Cairo formatting and named-provider wiring. Existing bundle-size warning remains. Chrome showed the bell with 4 unread notices and successfully opened the populated popover. Browser connection then timed out/reset during continued verification, so Escape/focus, responsive viewport, hidden-tab timing and live sign-out were not fully verified; no live state-changing actions were taken.

- Expanded `src/lib/schema/` after the user confirmed the remaining legacy admin scope. Added domain contracts for people/permissions/instructors/providers, catalog settings/promotions/discounts, shipping, learning/services/box plans, order actions, finance, content/notifications, support/moderation/Aqlam configuration, tasks/workflow, studio and general settings. Added inferred form/action input/output types and separate registries; kept catalog-specific resource typing narrow. `README.md` records sources, normalized input differences and server-only checks; `coverage.md` maps legacy admin sections. No new resource pages, live registrations, client edits or database operations are part of this step. TypeScript and production build passed; existing bundle-size warning remains. No tests were added/run.

- Consolidated current-resource validation into `src/lib/schema/` after the user confirmed scope: sign-in/Google auth, platform products and add-ons only. Reviewed client product and add-on contracts; extracted existing catalog rules unchanged, added inferred types and a typed resource-schema registry, and updated forms/auth gateways/payload mappers to import the shared layer. Fixed stale `@/lib/auth` imports after the folder move. Feature models retain defaults/conversion/allowlists and compatibility re-exports; demo schemas remain isolated. No client files, database schemas, permissions or live data were changed.
- Shared schema extraction passes TypeScript, production build and `git diff --check`; existing chunk-size warning remains. No tests were added or run for this request. Scope/source notes are in `src/lib/schema/README.md`.
- Moved complete page assembly into shared `components/resources/resource-provider.tsx`: table fetching/options, page context, action/dialog hosting and optional UI-only dragging are now generic. Resource pages pass resource/title/description/columns plus `form.fields`; optional props include `enableRowReordering`, `onReorder(ids, rows)`, `getRowLabel`, `canCreate`, `canDelete`, `rowActions`, storage key and Refine query settings. Generic defaults do not assume catalog-specific columns/sorters. `CatalogResource` now only supplies catalog defaults and `CatalogFormFields` validation/payload logic. The page renders its title/description; the footer/form and CRUD behavior remain shared. No database changes, real saves, deletions or persisted drag ordering were introduced.
- Shared provider extraction passes TypeScript, production build and `git diff --check`; existing chunk-size warning remains. Updated the router's import to match the concurrently renamed `resources` registry export. No tests or browser checks were run.
- Introduced resource-scoped `ResourceProvider`/`useResourceContext` for resource name, active create/edit/delete target, row ID/loaded row, delete eligibility and open/close actions. `ResourceDialogs` now hosts one keyed create/edit or delete dialog; `CatalogResource` no longer assembles conditional editor/delete props. `CatalogEditor`, create toolbar and row menus consume context. Optional `rowActions` supplies custom icon/handler definitions, while resource-specific deletion copy is passed from ProductsPage. Table rows remain the source for delete identity; no new reads/mutations or database changes were introduced.
- Resource context refactor passes TypeScript, production build and `git diff --check`; existing chunk-size warning remains. No tests or browser checks were run for this change.
- Made catalog table requests configurable through optional `searchField` and typed `refineCoreProps` props. Callers can provide pagination, filters, sorters, query options and provider metadata; the explicit `resource` prop remains the request target. Defaults remain name search, 20 rows, and sort_order/id ordering. Platform ownership filtering is now passed through ProductsPage's permanent Refine filters; add-ons need no request overrides. No new database logic or live mutations.
- Configurable table props pass TypeScript, production build and `git diff --check`; existing chunk-size warning remains. No tests or browser checks were run for this change.
- Simplified create/edit dialogs: `CatalogResource` now takes an explicit `resource` prop (products/add-ons pages provide their table names). `ResourceFormDialog` owns Refine `useOne`/`useCreate`/`useUpdate`, loading/refetch states, pending/error handling and list/detail invalidation. `CatalogEditor` retains explicit fields, Zod validation and allowlisted payload mapping through `useAppForm`. Save/Cancel live in the fixed dialog footer outside the scrolling form body; the external Save button targets the form ID. Removed the dirty-discard AlertDialog, navigation blocker and before-unload confirmation. Existing form values stay mounted during edit rechecks. No database changes or live saves were made.
- Dialog refactor passes TypeScript, production build and `git diff --check`; existing large-chunk warning remains. No tests or browser checks were run for this change.
- Added reusable `ResourceRowActions` and `createResourceActions({ onEdit, onDelete })`: icon-button dropdown actions receive each row's ID. Catalog products/add-ons use the actions column; Edit opens the existing dialog and Delete opens reusable `ResourceDeleteDialog` with pessimistic `useDelete` and query invalidation. At the user's request, deletion now takes its ID/name/eligibility directly from the loaded table row; `useOne` and pre/post-delete record fetches were removed. The dialog blocks duplicate submissions/dismissal while pending and keeps errors visible. Database RLS remains authoritative; the provider's successful delete response is used without a separate affected-row verification. Staging DELETE grants/admin policies and FK behavior were previously inspected read-only. No database changes or actual deletions were performed; no tests were added/run for this request.
- Resource actions pass TypeScript, production build and `git diff --check`; existing large-chunk warning remains. Actual browser/delete interactions are unverified.
- Added inline UI-only row dragging directly to the existing catalog products/add-ons resource table using Shuip and installed dnd-kit sensors. Removed the separate preview screen/button. Search, filters, sorting, pagination and create/edit stay on the same page. Dragged positions apply only to the loaded result in component memory; provider data is not mutated. No new queries, RPC calls, saved positions or order-business-state changes are part of this UI.
- Reverted the previously deployed staging ordering RPC through `20261025172223_remove_catalog_ordering_rpc_ui_only` and verified the function is absent. Original staging migration was `20261025171225_reorder_catalog_records`; no catalog rows were changed and production was untouched. The earlier database-backed plan is superseded by UI-only scope.
- UI-only implementation passes TypeScript, production build and `git diff --check`. The existing large-chunk build warning remains. Browser interactions were not verified because no browser was connected. No new tests were added/run for this reduced scope. Applied/reverted staging statements are archived in `client/supabase/maintenance/history/catalog-ordering-reverted.md` for history only, outside CLI migrations.

## In Progress

- None yet.

## Next Up

- [First unit to build]

## Open Questions

- [Any unresolved product or technical decisions]

## Architecture Decisions

- [Decisions made that affect the system design or
  data model — include why the decision was made]

## Session Notes

- [Context needed to resume work in the next session]
