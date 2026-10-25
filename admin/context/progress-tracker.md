# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- [e.g. Not started / In progress / Complete]

## Current Goal

- [What you are building right now]

## Completed

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
