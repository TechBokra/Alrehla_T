# Progress Tracker

### Product personalization scope selection — 2026-11-02

- Redesigned the product editor into responsive cards for basics, story content,
  pricing/writing styles and a cover/audience/status rail. Main Save stays
  reachable while scrolling; preparation days and scope membership remain
  separate forms with their existing guards. Main product upload/save/reset
  behavior is preserved.

- Added the standalone product personalization section contract for edit and
  create routes. It reads full catalog definitions through Refine, shows global
  definitions as inherited, preserves inactive selections, and saves the two
  restricted selection sets independently from the main product form.
- Added a pure planner that retains box/other-product scopes, rejects empty
  scopes and caps targets at 100. The named catalog settings provider rechecks
  product eligibility and definition permissions, validates all current scopes
  before writes, and conditionally updates by ID, timestamp, and prior scope.
- Partial/unconfirmed writes remain visible; explicit refresh advances the
  baseline while reapplying only explicit selection changes, preserving
  unrelated external scope updates. Retry plans only remaining changes.
  Added scope and retry tests and documented the module flow in
  `doc/product-personalization.md`, linked from the architecture guide.
- All 64 tests pass, including scope planning, intent reconciliation and real
  command execution with authorization, concurrent changes and partial retries.
  Browser preview confirmed the Arabic form layout, category conditionals and
  invalid-submit feedback without a real save. TypeScript and the production
  build pass; existing route-generator and bundle-size warnings remain.
  OpenCode's final review is pending. No live settings or product rows changed.

### Catalog settings status switches and delete actions — 2026-11-02

- Replaced read-only status badges with the shared inline `is_active` switch on
  customization fields, story goals and writing dialects. The shared boolean
  update flow rechecks permission, reads the latest row, sends only the changed
  boolean and invalidates the named resource cache.
- Enabled single-row deletion for these three settings resources in the
  permission policy and catalog settings provider. Existing row dropdowns now
  expose delete when authorized and open the shared confirmation dialog;
  provider authorization is refreshed before calling existing Supabase CRUD.
  Bulk deletion remains blocked. Existing database admin policies already
  grant row-level `DELETE`; no schema or policy changes were made.
- Documented customer-choice and order-snapshot effects in the delete
  confirmation copy and catalog settings guide. No live setting rows were
  toggled or deleted. TypeScript and production build pass; no tests were run
  for this follow-up.

### Catalog settings order controls removed — 2026-11-02

- Removed numeric order inputs from all three settings Dialogs and order
  columns from all three lists. Removed order from form schemas/defaults/save
  payloads, so ordinary edits preserve positions saved through dragging.
- Create writes use existing database order defaults. Fields/goals retain
  shared persistent drag reordering; dialect display sorting remains unchanged.
- Updated the feature guide. TypeScript, production build and all seven
  focused adapter tests pass; the new regression confirms that saves omit
  order while shared drag updates remain supported.


### Catalog personalization settings — 2026-11-02

- Added `/catalog/settings/customization-fields`, `/story-goals` and
  `/writing-dialects` with shared ResourceView lists and create/edit Dialogs.
- Fields/goals expose `sort_order` columns and reuse debounced persistent row
  reordering. Forms preserve all/selected product/box applicability and require
  at least one target for restricted scope. Dialects retain immutable codes.
- Registered a permission-aware collapsible `NavMain` settings group, Arabic
  breadcrumbs, catalog permissions and a named `catalogSettings` provider.
  The adapter validates write allowlists, caps fields/goals at 15/30 through
  preflight counts and adapts dialect codes to virtual Refine IDs. No database,
  backend or deployment changes. Product-form selectors remain future work.
- Saved the request flow, state ownership and complete affected component map
  in `doc/catalog-settings.md`, linked from the architecture documents.
- Verification: TypeScript, production build, whitespace checks and all 48
  tests pass (six new adapter tests). Existing route-generator and bundle-size
  warnings remain. Browser showed settings navigation and the add-dialect
  Dialog; a separate preview attempt timed out. No agent live record mutations.

### Shared resource form uploads — 2026-11-02

- Moved signed media-library adapter setup into `hooks/uploads/` and made
  resource form page definitions declare named upload slots with folder,
  accepted formats, file-size and count limits. `ResourceUploadSlots` and
  `useResourceUploadSlot` own UploadCN queue creation, permission state and
  upload resolution; retries remain disabled and uploads do not start on file
  selection.
- Reworked the registered `ImageUploadField` to use `BaseFormField` and a
  resource upload slot. It keeps the queue, preview, progress, removal and
  optional source-picker UI. The product media-library picker remains a small
  feature-owned composition.
- Product Save now waits for the shared resolver to complete every selected
  cover upload before mapping URLs and calling the Refine create/update
  mutation. A denied upload, failed/cancelled queue item or missing
  `secure_url` stops submission before the record mutation. Successful uploads
  followed by a database-save failure stay available for retry without
  uploading the same file again.
- Updated the resource and upload architecture guides. No Supabase function,
  migration, schema, policy, API or deployment changed.

Update this file after every meaningful implementation
change.

## Current Phase

- Implemented: Refine-backed resource pages and store orders. The product edit page and reported runtime crash were verified in the live Chrome session; order details were not separately browser-tested.

## Current Goal

- Resource pages use Refine core `useForm`; a shared typed page context supports form and details definitions; store orders use an allowlisted named provider with shared command descriptors and existing Supabase objects only.

## Completed

- 2026-10-31: Split the Refine provider setup into sibling files under `providers/refine/`: auth, default/named data providers, Arabic Egypt i18n, notifications, router, resources, and the composition component. Kept the TanStack route guard and session refresh listener in `routes/__root.tsx`. Verification: 22 tests, TypeScript and production build pass; route generator emits its existing circular-dependency warning, and Vite reports its existing large chunk warning. No remote mutations were run.

- 2026-10-28: Implemented real UploadCN signing at POST /api/upload/sign for Vercel and Vite development, validating Supabase users/current active admin profiles via RLS, approved public-image folders, strict params/preset, JSON/body limits and origin. Added server signing dependency, shared image policy and authenticated frontend hook; catalog image fields now upload and retain URL-only Refine payloads, with pending-submit guards. Created a dedicated signed Cloudinary admin-image preset without changing storefront presets and updated local preset configuration. Documented Cloudinary account-level byte limits versus untrusted preflight metadata. Verification: pnpm test:uploads (4 grouped auth/signature/policy tests), pnpm typecheck, pnpm build and git diff --check pass. Live local route rejects missing/invalid Supabase sessions with 401. Real Cloudinary credentials successfully uploaded a generated 1-pixel image through the new signed preset, then deleted that test asset. Browser output was checked for Cloudinary/Supabase secrets and passed. No database/schema changes or resource-record writes; hosted route deployment remains pending.

- 2026-10-28: Adopted UploadCN/Cloudinary upload architecture: direct browser upload, authenticated server signing, real progress, successful-result/form ownership, Refine resource persistence, asset cleanup and private-delivery boundaries, unsigned exceptions and chunk/resume behavior. Reused existing core/react packages and avatar/logo/product-media blocks; installed ImageUpload/FileUpload under components/upload and retained existing shared primitives. Added signed Cloudinary adapter/signer, public Vite env placeholders and usage README; migrated the image form adapter away from the removed local-only component. Signing backend/configuration and live resource adoption remain integration work. Verification: pnpm typecheck, pnpm build and git diff --check pass. Mocked signer checks pass for authorized request headers/body, missing authentication, HTTP failure, invalid response and missing cloud name. Existing route-generator circular-dependency and bundle-size warnings remain. No live uploads or remote writes were performed.

- 2026-10-28: Expanded the form-presentation architecture with ownership/composition, label/help/required/error/disabled/RTL conventions, field APIs and value shapes, a standard useAppForm example, extension rules and dialog-footer submission. Recorded the current icon-only description trigger as an implementation gap against the agreed accessible Badge/button contract. Documentation only; runtime components unchanged. Source paths and APIs checked against the workspace; whitespace check passed.

- 2026-10-28: Migrated admin forms to actual Shuip registry sources: all 15 TanStack field components, form context and submit button installed without overwriting existing UI primitives. `src/lib/form.ts` is the sole useAppForm factory/context registration. Migrated catalog, sign-in, Refine/overlay demos and image-upload demo; replaced the field gallery with complete Shuip coverage. All fields compose BaseFormField with a description Badge/tooltip and shared error/disabled presentation. Removed unused legacy wrappers, duplicate factory/context adapters and duplicate showcase/schema; retained image/attachment extensions and form layouts. Verification: `pnpm typecheck`, `pnpm build` and `git diff --check` pass. An isolated RTL browser preview verified validation errors/disabled submission, keyboard autocomplete, multiple-selection chips, inline-edit commits and description help; temporary preview files were removed. Existing route-generator circular-dependency and Vite chunk-size warnings remain.
- 2026-10-28: Added shared `BaseFormField`, `FormFieldLabel` and `FormFieldHelp` with rich labels/descriptions, required markers, circular tooltip help controls, explicit/context-driven errors and custom-control render props. All registered form fields delegate through the base using existing FieldFrame/FieldsetFrame adapters; checkbox/switch rows and group legends retain their semantics. Shared presentation props are forwarded across field wrappers. `/fields` now uses the shared form showcase and adds base-field state examples. SSR checks passed for required/label links, optional non-submit help, normalized TanStack errors, explicit invalid override, disabled controls and fieldset/legend structure. TypeScript and production build passed with the existing large-chunk warning. Browser preview verified RTL rendering and keyboard-focused description tooltip. No database, upload, schema, dependency or authorization changes; existing unrelated test-file deletions were preserved.

- 2026-10-27: Installed the browser Cloudinary SDK in `admin`: exact versions `@cloudinary/react` 1.14.4 and `@cloudinary/url-gen` 1.22.0, with the pnpm lockfile updated. SDK imports and sample URL generation, TypeScript, production build and whitespace checks passed; the existing large-chunk build warning remains. No network uploads or automated tests were run. This adds dependencies only; cloud configuration, upload controls, signing endpoints and media-library integration remain feature implementation work. The client's existing Node SDK is unchanged.

- 2026-10-27: Audited legacy admin navigation/pages/forms/data entry points in `client` and created `resource-migration-plan.md` plus `legacy-admin-route-inventory.md`. The inventory covers 17 sections, 58 tabs and all 88 admin page routes with source links and navigation permissions. The plan specifies each screen's proposed view, filtering/search, default/alternative sorting, pagination and create/edit/command fields, including a phased Refine CRUD + TanStack mutation/Supabase command migration. Distinguished existing local tables/calendar placeholder from proposed server pagination/calendar/Kanban; retained local-only catalog dragging and documented account/external-service server boundaries. Production users URL redirected to sign-in, so authenticated visual parity remains unverified. Documentation only; no runtime, dependency, database or deployment changes.

- Added `admin/vercel.json` with Vercel's documented Vite SPA rewrite to `/index.html`, addressing direct-route/refresh 404s before TanStack Router loads. Documented the admin project's Root Directory (`admin`), Vite preset, `pnpm build`, `dist` output, and redeployment requirement in `admin/README.md`. The Next.js `client/vercel.json` is unchanged. JSON parsing and whitespace checks passed; no deployment or live URL verification was performed, and no tests were added/run.

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

- Implemented root `SiteBrandingProvider` above the route outlet: protected-route branding reads start without waiting for user identity, stay disabled on sign-in/OAuth, and share the root Refine result across live/showcase layouts. Removed the nested showcase branding provider. Memory cache uses five-minute freshness and thirty-minute retention without polling/window-focus refetch; refresh reloads it. No database or persistent-storage changes.
- Sidebar branding now shows only the logo when expanded (including mobile drawer) and only the favicon when collapsed, with fixed-size initial/image Skeletons, cached-image completion handling and empty/failed image fallbacks. Existing data remains during background refetch; browser favicon synchronization is owned by the shared provider.
- Verification: TypeScript and production build passed; five focused tests passed for route gating, cache configuration/reuse, empty/invalid fields, expanded/collapsed rendering and root/showcase wiring. Existing large-chunk warning remains. Live browser verification was blocked by Chrome returning `Debugger unattached`; actual image load/error events, mobile sizing and interactive sidebar toggle were not verified in-browser.

- Fixed duplicate browser auth reads: route checks and identity use a shared 60-second successful-session cache with concurrent-request deduplication. Login/logout and session/account/user changes invalidate it; obsolete in-flight reads cannot restore an old session. Existing verified-user reads, admin/archived checks and database authorization remain in place. Root identity is shared across nested demo/live contexts; layout, notifications and user widgets now consume it instead of starting their own Refine identity queries. Aligned user widgets with the actual name/avatar contract.
- Root router revalidates on logout, account changes and user updates. Identity keys include the session version, unused old keys are collected immediately, and sign-in/OAuth disable identity reads. No database changes or deployment. The working checkout changed to main during implementation; switched back to `codex/separate-app-repositories` at the user's explicit request and continued there. TypeScript, production build and whitespace checks passed; the existing large-chunk build warning remains. Automated tests were not added or run for this request; the existing branding wiring assertion was adjusted for the identity wrapper. Live Vercel behavior remains unverified until deployment.

- Resolved the local theme import failure after the branch switch: the theme provider existed and direct transforms returned 200, while toaster/theme-toggle imports returned 500. Touching Vite config did not clear the stale resolver state; restarted only the identified local Vite process on port 4173. Both failing module transforms now return HTTP 200 without changing the valid import path.
- Added `AppErrorBoundary` around all app providers, Suspense, router and toaster, reusing the shadcn `RootError` screen. Global render failures offer retry/remount and page reload. Route errors still use the same screen; Arabic generic copy is shown in production and technical details only in development. This does not intercept Vite compilation errors or replace form/request error handling. TypeScript, production build and whitespace checks passed; the existing large-chunk warning remains. No automated tests were added or run.

## In Progress

- None yet.

## Next Up

- [First unit to build]

## Open Questions

- [Any unresolved product or technical decisions]

## Architecture Decisions

- 2026-10-27: Agreed on Refine resources/hooks for CRUD, table sorting/filtering/pagination and resource query caching. New business commands (for example confirming an order) use feature-owned TanStack Query `useMutation` hooks calling Supabase RPC through the shared authenticated client, followed by Refine `useInvalidate` against the same context/named provider. Database functions enforce authorization, transitions and atomic writes. Commands share Refine's QueryClient; no duplicate resource read cache is introduced. Saved row ordering follows this command path only when explicitly implemented; existing dragging stays local. Existing notification `useCustomMutation` remains documented as current implementation. Direct TanStack Query dependency setup and runtime adoption remain implementation work; this update changes documentation only.

## Session Notes

- [Context needed to resume work in the next session]

### Uploads page and existing Supabase backend — 2026-10-28

- Supersedes the earlier `/api/upload/sign` implementation, which was removed along with its local server setup and dependency.
- Added Vite `/uploads`, sidebar/resource registration and named Refine Cloudinary provider. Real search, folder filtering, cursor paging, metadata CRUD and guarded deletion use the existing Supabase backend.
- Deployed `media-library` Edge Function to the current development project, configured server secrets and created the restricted signed preset. No production project or database schema changes.
- Upload dialog uses installed ImageUpload, AvatarUpload, LogoUpload and ProductMediaUpload, with shared pending guards and signed uploads. Cover order is local preview only.
- Verified real Cloudinary fixture upload/read/update/delete, function auth/policy/reference-scan rejection, TypeScript/build and read-only browser UI against captured actual assets. Authenticated browser CRUD requires an admin session; it was not claimed as completed.

- Final upload-component integration: TypeScript and production build pass; all four upload modes render in browser verification. Removed temporary preview files and generated CLI artifacts. Existing bundle-size warning remains.

### Field borders and overlay surfaces — 2026-10-29

- Replaced transparent Rhea field borders with shared `border-input` on text inputs, textarea, select/native select, input groups, checkbox and radio primitives.
- Removed forced dark/glass styling from dropdown and submenu content. They now use opaque `bg-popover`, matching existing dialog and popover surfaces and inheriting the app theme.
- Validation: TypeScript, production build and diff whitespace checks pass. Browser preview confirms gray input/textarea borders and opaque white dialog, popover and menu surfaces in light mode. Existing bundle-size warning remains. Temporary preview files removed.

### Complete outlined fields and solid surfaces — 2026-10-30

- Changed shared text-entry controls and select triggers from the Rhea gray fill to `bg-background`, retaining `border-input`, focus and error styles.
- Added explicit semantic borders to dialog, alert dialog, popover, select menu and dropdown surfaces. Floating content retains opaque theme backgrounds; no forced dark or glass menu styles.
- Validation: shared control/surface style checks and `git diff --check` pass.

### Profile route — 2026-10-30

- Implemented `/profile` with existing shadcn Cards/Tabs, shared `useAppForm` fields, AvatarUpload and named Refine own-account provider. Linked from the user menu.
- Added profile name/avatar saves, read-only email/role, Google linking callback with account continuity check and verified current-password changes.
- Added public forgot/reset-password pages, PKCE recovery validation and sign-in recovery link. Supabase manual-linking, redirect allowlist and email delivery settings remain deployment prerequisites; no hosted settings or user credentials were changed.

- Validation: 15 mocked Auth/provider safety tests pass, TypeScript and production build pass, and `git diff --check` is clean. Authenticated browser loaded the real own-profile data and showed both tabs; empty-password validation, forgot-password form and invalid recovery-link states verified. No real profile edit, credential change, Google link or recovery email was performed during verification. Existing bundle-size warning remains.

### Arabic toast notifications — 2026-10-30

- Added Arabic Refine CRUD/error/success and undo messages, including Arabic number/plural handling.
- Shared Sonner toaster uses RTL, start-aligned content and Arabic accessibility labels. Undo content uses logical spacing.
- Common server error descriptions are presented in Arabic, preserving existing Arabic feature messages. Component showcase reuses the same notification provider.
- Verification: Arabic notification keys, plural forms and error fallbacks passed executable checks; production build passed. Browser preview could not be completed because browser automation was unavailable/timed out. Temporary preview files removed.
- Final TypeScript check passed against the current workspace.

### Remove UI showcase routes — 2026-10-30

- Removed theme, UI primitives, data view, fields, forms, form prototype and legacy sections/calendar routes, plus their feature-only demo files.
- Removed showcase and quick-demo sidebar groups and showcase types from AdminLayout. Shared UI/form/resource components and light/dark theme support remain.
- At that point, home and both sign-in methods landed on `/catalog/products`; this was later changed to the blank dashboard route `/`.

- User additionally requested removal of `/forgot-password`. Removed its sign-in link and public route configuration. Retained `/reset-password` for profile-initiated recovery emails, with a dedicated receiver component and sign-in fallback for invalid links.

- Verification: generated route inventory excludes all removed pages and preserves live catalog/uploads/notifications/profile/auth routes. Password and Google sign-in destination checks pass; 15 own-account/Auth safety checks pass; production build passes with the existing chunk-size warning.
- Final TypeScript check passed.

### Refine provider data folder and application architecture — 2026-10-31

- Grouped the Refine data-provider registry and account, media-library,
  notifications, users and shared Supabase adapters under
  `src/providers/refine/data-provider/`; updated feature imports and
  provider/query tests to the new paths.
- Added `doc/application-architecture.md` with the app startup, route/auth,
  Refine provider, resource read/command, Supabase and Edge Function flows.
- Updated the provider README and architecture context to match the folder
  layout. Verification: 22 tests, `pnpm typecheck` and `pnpm build` pass; the
  build retains the existing large-chunk warning. Changed-file whitespace and
  stale-import checks pass.

### Resource CRUD hook extraction — 2026-10-31

- Moved shared list/table state, create/edit reads and mutations, delete
  mutation handling, and lifecycle helpers from `components/resources/` to
  `src/hooks/resources/`. Resource components now compose hooks and render the
  table/dialog UI.
- Create/edit/delete use Refine's default automatic invalidation.
- Verification: 22 tests, `pnpm typecheck`, `pnpm build` and scoped whitespace
  checks pass. The production build retains the existing large-chunk warning.

### Resource form mutation state — 2026-10-31

- Form pending and mutation errors now come directly from Refine's create/update
  mutation state instead of mirrored React state. Local error state is limited
  to edit preflight checks and post-save callbacks that do not belong to those
  mutations.
- Verification: 22 tests, `pnpm typecheck`, `pnpm build` and scoped whitespace
  checks pass. The build retains the existing large-chunk warning.

### Root admin layout — 2026-10-31

- Moved `AdminLayout` to the root route so protected admin pages share one
  sidebar and header without repeating a wrapper in each route group.
- Route-group components now render only their nested outlet. The shell derives
  the Arabic breadcrumb from the current route. Sign-in, OAuth callbacks and
  password-reset callback screens remain full-screen.
- Updated architecture docs. Validation: 22 tests, `pnpm typecheck`, and
  `pnpm build` pass. Build retains the existing large-chunk warning.

### Separate catalog product and add-on modules — 2026-10-31

- Products and add-ons now each own Refine resource metadata, list columns,
  page composition, model defaults/payload mapping and create/edit form fields
  in their respective folders. Their forms no longer share resource-dependent
  conditional rendering.
- Both features reuse the shared resource table and dialog shell, while keeping
  their form content and schemas independent. The add-on schema no longer
  includes product-only category and electronic-price fields.
- Updated architecture docs. Validation: all 22 tests, `pnpm typecheck`, and
  `pnpm build` pass. The build retains the existing large-chunk warning.

### Shared Refine resource and sidebar authorization — 2026-10-31

- Added a Supabase-backed Refine access-control provider using active profiles
  and assigned/default admin permission groups, with a shared 60-second cache,
  stale-request protection and account-version-scoped Refine access queries.
- ResourceProvider gates table mounting, CRUD controls and sorting; shared CRUD
  hooks recheck authorization before submissions. Custom row actions require
  an explicit registered authorizationAction and preserve feature restrictions.
- Added AuthorizedSidebarItem and shared navigation metadata; denied links and
  empty groups hide, with loading placeholders and retryable Arabic failures.
  Standalone pages are gated. The landing resolver was later removed when `/`
  became the default blank dashboard route after sign-in.
- Preserved the users permission exception and super-admin-only sensitive
  actions. No database/server policy changes or deployments. Existing catalog
  RLS remains broader than these frontend permission checks.
- Verification: automated authorization/cache/render/CRUD-guard tests and
  existing server policy tests pass. Authenticated browser confirms RTL sidebar,
  authorized create dialog and keyboard row-menu dismissal without saving or
  deleting records. All 20 tests, TypeScript, production build and whitespace
  checks pass; existing route-generator and large-chunk warnings remain.
  Profile/user updates invalidate the shared authorization snapshot.

### Blank dashboard home route — 2026-11-01

- Changed `/` to an intentionally empty dashboard page inside the shared
  AdminLayout. It mounts no resource table, query or page-specific UI.
- Password sign-in, Google sign-in and an already-authenticated visit to
  `/sign-in` land on `/`. Removed the prior role-based resource landing resolver.

### Unified Refine authentication and permission loading — 2026-11-01

- Replaced root/home asynchronous `beforeLoad` checks with a shared
  `AdminAccessProvider` inside Refine. `useIsAuthenticated` and dependent
  `usePermissions` derive one initial loading boundary from Refine query state.
- The gate mounts before branding, identity, AdminLayout and protected outlets.
  Missing sessions redirect to sign-in; read failures show retryable Arabic
  feedback. The authorization snapshot must match the verified profile ID.
- Session-version keys discard old-account results. OAuth/link/reset callbacks
  bypass bootstrap; authenticated sign-in visitors redirect through the home
  component, which selects products/users/profile from the ready snapshot.
- Resource and sidebar `useCan` queries seed their initial decisions from the
  validated snapshot and include its revision. Existing record restrictions,
  fresh CRUD preflights and table data loading remain independent.
- Focus joins a fresh shared adapter request with Refine permission refetch;
  same-session background refresh preserves forms/uploads. Failed refreshes deny
  access; account/role changes restart bootstrap. Expired snapshots refresh on
  route navigation. Failed password login does not invalidate/unmount its form.
- Updated architecture documentation. No database, policy, remote configuration
  or deployment changes. Browser verification is unavailable: computer-use
  discovery returned no connected browser sessions.
- Verification: all 26 existing/new tests, final TypeScript check, production
  build and whitespace checks pass. The existing large-chunk build warning
  remains. Local installed Node/TypeScript/Vite executables were used for final
  checks after the pnpm/Corepack launcher stalled. No live account changes were
  performed during verification.

### Implementation explanations as a workflow requirement — 2026-11-01

- Added a completion rule to `context/ai-workflow-rules.md`: every implementation
  documents its outcome, flow, architecture, affected components, hooks/logic,
  states and actual verification. Detailed explanations live in architecture or
  feature documentation; delivery responses summarize and link them.
- Documentation-only update; whitespace check passed. No runtime changes.

### Identity and branding inside AdminAccessProvider — 2026-11-01

- Removed the separate AdminIdentityProvider and SiteBrandingProvider wrappers
  and files. All identity/branding consumers use hooks from the shared access
  context. Root composition is Refine → AdminAccessProvider → layout/outlet.
- Identity is mapped into the authorization snapshot from the already verified
  user/profile. There is no UI useGetIdentity query; the adapter's compatibility
  method shares the same session read. Refresh/profile invalidation updates the
  snapshot and all identity consumers together.
- New useAdminBranding runs one Refine useOne after authentication, in parallel
  with permissions. The shared loader waits for initial branding metadata to
  settle; branding failures retain the existing site-name fallback. Sign-in,
  OAuth/link and reset routes disable the query. Session-version/profile metadata
  isolates cache entries; favicon effects clean up on change/unmount.
- Updated central architecture and added doc/admin-access-architecture.md with
  runtime flow, ownership, every affected component/hook and UI state behavior.
- Verification: all 29 tests, final TypeScript check, production build and
  whitespace checks pass. No source imports of either removed provider or UI
  useGetIdentity calls remain. The existing large-chunk warning remains. Live
  browser verification was not performed; no remote account/data changes.

### Refine identity query cache inside AdminAccessProvider — 2026-11-01

- Replaced identity embedded in the permission snapshot with one Refine
  useGetIdentity query inside AdminAccessProvider. Its session-version key and
  60-second freshness isolate accounts and keep identity ready before AdminLayout
  mounts. The auth adapter maps its existing verified session without another
  Supabase user/profile request.
- useAdminIdentity exposes that actual query result through context to all
  consumers; no separate identity provider or consumer query was added. Focus
  refetches identity and permissions through one shared fresh session read.
  Profile saves continue to invalidate the session; detailed profile/Google-link
  data remains a separate resource query.
- Identity pending/error/ID or role mismatch blocks protected children. Background
  same-account refresh preserves mounted forms. OAuth/reset/sign-in routes disable
  the protected identity query.
- Updated architecture and component/hook ownership documentation. All 29 tests
  pass, including real QueryClient identity-cache reuse, version isolation,
  shared backend reads, initial identity gates and background refresh behavior.
  TypeScript, production build and whitespace checks pass. The existing large-
  chunk warning remains. Live browser verification was not performed; no remote
  account/data changes were made.

### ResourceProvider implementation documentation — 2026-11-01

- Added `doc/doc.md` (subsequently translated to English): end-to-end resource flow, each shared component,
  hooks and logic locations, data-provider selection, table search/filter/sort/
  pagination, form ownership, CRUD mutations and Refine cache invalidation.
- Verified invalidation defaults against installed Refine source. Distinguished
  implemented CRUD from business-command extension patterns and local drag order.
  Recorded current empty users form and unconnected specialized actions instead
  of describing the earlier users plan as completed UI.
- Linked the guide from the application architecture. Documentation-only change;
  local Markdown link and whitespace checks pass. Runtime tests/build were not
  rerun; no application code, remote data or deployment changes.

### ResourceProvider guide language — 2026-11-01

- Translated `doc/doc.md` fully into English at the user's request, including
  diagrams, component/hook responsibilities, CRUD/cache flows and known limits.
- Documentation-only change. English-content, local-link and whitespace checks
  pass; runtime tests/build were not rerun.


### Resource system separation — 2026-11-01

- Renamed the shared page composer to `ResourceView` and split resource context,
  contracts, controller/scope/row-action hooks and presentation into distinct
  modules following Refine core's separation of resource context, hooks and UI.
- `ResourceContextProvider` now accepts a prepared value only. The access gate
  remains outside `useResourceController`, preserving the no-query-while-pending
  or denied behavior. Feature pages now import ResourceView; shared public UI
  exports are collected in the resources barrel.
- Updated the English resource guide, architecture context, application guide
  and stale migration-plan file link. Added a controller test for access plus
  feature restrictions and ensured page, sort and pagination configuration is
  preserved. Added scope tests for page-local selection, stable action keys and
  record eligibility. All 31 automated tests, TypeScript, production build and
  whitespace checks pass. The existing large-chunk warning remains.

### Resource presentation folders — 2026-11-01

- Grouped the shared resource presentation by responsibility: `access/`,
  `actions/`, `dialogs/`, `forms/` and `view/`. Each folder has its own entry
  file; the root `components/resources/index.ts` exposes the stable imports used
  by routes and feature pages. Shared UI types remain in `types.ts`, while
  feature-specific resource files stay under `features/<feature>/` and shared
  behavior remains in `hooks/resources/`.
- Updated route/feature imports, resource tests, the English resource guide,
  architecture context and migration-plan link. All 31 admin tests, direct
  TypeScript check, production build and whitespace checks pass. The existing
  large-chunk warning remains.

### Resource hook folders — 2026-11-01

- Grouped shared resource hooks into `authorization/`, `actions/`,
  `controller/`, `crud/`, `scope/` and `table/`. Each group has its own
  `index.ts`; the root `hooks/resources/index.ts` is the stable import surface.
  Hook implementations now import sibling groups through their local indexes,
  while feature presentation uses the shared root entry.
- Updated resource component imports, test module paths and the English
  resource/architecture guides. All 31 admin tests, direct TypeScript check,
  production build and whitespace checks pass. The existing large-chunk
  warning remains.

### Route-based product forms — 2026-11-01

- Added `/catalog/products/create` and `/catalog/products/:id/edit` using the
  shared `ResourceFormPage`, Refine CRUD hook, TanStack Form footer and dirty
  navigation guard. The list CreateButton and product Edit row action now use
  those routes; delete and other resource dialogs remain unchanged. Successful
  create navigates to the new product's edit page; edit saves reset the form
  from the Refine mutation result and show an Arabic success toast.
- Added platform product fields for category, pricing, custom writing styles,
  ages, descriptions, features, active status and a book-cover image. New
  files stay in UploadCN until Save and use the existing signed Cloudinary
  adapter; the media-library picker reads through the named Refine provider
  behind media permissions. Preparation-day values save separately and display
  a staging setup notice when the production columns are absent.
- Fixed first-load validation: product and preparation schemas now validate on
  the first Save attempt, then revalidate on edits, so empty required fields do
  not render errors before interaction. The product form now uses one
  responsive two-column field grid without section cards or section headings.
  Only the long-description field has its requested Markdown helper. The short
  description, image controls and save
  footer span both columns; related fields sit side by side. The live
  create page showed no initial errors; an empty Save attempt showed the expected
  name and paper-price errors and disabled Save.
- Added the local migration `20261101193607_add_product_preparation_days.sql`
  for nullable 1–120 day columns. It was not applied to any remote database.
  Updated the English resource guide and architecture notes.
- Validation: 35 tests pass, `pnpm typecheck`, `pnpm build` and `git diff --check`
  pass. The route generator circular-dependency and Vite large-chunk
  warnings remain. No live product writes, media uploads, remote schema
  changes or deployments were performed.

### Single product cover — 2026-11-01

- Replaced the product form's cover/gallery collection with one book-cover
  selection. The label says “غلاف الكتاب — يفضّل طولي (3:4)”; the ratio is
  recommended and previewed at 3:4, but not enforced during upload.
- The schema, UploadCN queue, and media-library picker each allow one image.
  Saved payloads populate `cover_image_url` and clear `gallery_image_urls`.
  Existing products use their cover or first legacy gallery URL as the form
  default; saving normalizes the record to one cover without deleting assets.

### Product form and resource form organization — 2026-11-01

- Grouped the product route form into `features/catalog/products/form-page/`:
  page composition, TanStack form, schema, route-specific defaults/payload
  mapping and image field now have local files and a folder entry point. The
  product root keeps its existing dialog model and list modules.
- Split shared resource forms into `forms/dialog/` and `forms/page/`, each with
  a presentation object. The root `forms/registry.ts` composes both objects;
  shared context contracts and public exports stay in `forms/`. ResourceView
  and product form routes now consume the registry.
- Updated the resource/architecture guides and authorization test module mock.
  TypeScript, tests, production build and whitespace checks pass. No runtime
  behavior or remote data/schema was changed by this organization refactor.

### Resource page and dialog form modes — 2026-11-01

- Made ResourceView's `mode` an explicit discriminant. Dialog mode requires a
  dialog form definition with title and fields; page mode omits the dialog
  `form` prop, removing the `form.canEdit` undefined crash for route-based forms.
- Moved the optional feature record restriction to top-level `canEdit` so it
  applies consistently to row actions and dialog CRUD without coupling it to
  presentation fields.
- Resource registration now derives create/edit URL patterns from resources in
  page mode. The shared Refine CreateButton and row Edit action use those
  routes; router path resolution and parsing match registered patterns rather
  than product-specific URLs.
- Updated the English resource and architecture guides. TypeScript validation
  and the production build pass. There is no `admin/tests` directory in this
  checkout, so no admin test suite was available. No backend, schema, or remote
  changes were made.

### Refine resource pages and store orders — 2026-11-02

- Replaced the route-form-specific page composer with the module-scope
  `createResourcePage` factory and typed `useResourcePage` context. Form pages
  use Refine core `useForm` for query, mutation, redirect and CRUD invalidation;
  TanStack `useAppForm` remains the values/validation/dirty/submitting owner.
  Product and add-on forms use the shared contract, and the incomplete users
  form remains unchanged.
- Added one command controller using Refine `useCustomMutation`, fresh Refine
  access checks, fresh-record eligibility checks, duplicate guards and declared
  `useInvalidate` targets. Compound button and menu actions share their
  descriptor and one confirmation/input dialog path. Form-page commands block
  while the feature form is dirty.
- Registered `/orders` and `/orders/:id`, the named `orders` provider,
  `canManageOrders` UI policy and sidebar entry. The provider enriches list and
  detail reads from existing tables, checks command inputs/session/permissions,
  and conditionally updates against expected status plus `updated_at`. Existing
  notification, audit and payout work is preserved with partial-success
  feedback; XPay remains authoritative. Public child-photo previews remain
  public-only, while private references show unavailable previews.
- No Supabase functions, migrations, schema, policies, Next.js APIs or
  deployments were added or changed. Existing broad admin order RLS is
  unchanged and documented as broader than the frontend permission gate.
- Added pure fulfillment/electronic-delivery policy tests. Validation:
  `pnpm test` passes 6 tests, `pnpm typecheck`, `pnpm build` and
  `git diff --check` pass. The route generator retains its circular-dependency
  warning and Vite retains its large-chunk warning. Browser verification was
  attempted in the existing Chrome session, but CUA returned “Debugger
  unattached”; no order command or real fulfillment/payout mutation was run.
- Fixed the product form page context contract: `page.form` exposes the
  TanStack form instance; `page.feature` exposes form-specific state, while
  shared upload handles are exposed separately as `page.uploads`.
  The reported `form.store` crash now shows a working product edit page in the
  existing Chrome session. Command eligibility is skipped until a details
  record loads, preventing predicates from reading fields on the temporary
  empty record. Verification for this fix: `pnpm test`, `pnpm typecheck`,
  `pnpm build` and `git diff --check` pass.

### Product image cache and upload progress — 2026-11-02

- Product form saves suppress Refine's default invalidation targets and await
  one targeted Refine invalidation for `personalized_products` list/many/detail.
  Edit saves also refetch the detail query and reset the form from that server
  response, so cover URL replacement and removal refresh both table and form
  state.
- Successful browser-direct Cloudinary uploads invalidate `uploads` list/many
  through the named `mediaLibrary` provider. Queued covers show
  `جارٍ الرفع…` only while the Save submission resolves those upload IDs; they
  remain removable and show no progress before Save.
- Added a regression test for pre-save versus save-started upload IDs. No
  backend or Cloudinary schema changes. `pnpm test` (9 tests), `pnpm typecheck`,
  `pnpm build` and `git diff --check` pass; Vite retains the existing large
  chunk warning.


### Shared page-form submission ownership — 2026-11-02

- Moved main product CRUD save orchestration out of the feature hook into
  `useResourceFormSubmission` and its tested submission sequence. Resource
  composition exposes `context.submit({ prepare, reset })`; the feature keeps
  schema/values, upload-to-payload mapping and its typed TanStack reset adapter.
- Shared submission owns prepare/backend error toasts, the submission guard,
  one awaited Refine invalidation on the same provider and saved record ID,
  authoritative edit refresh, completed-upload cleanup, reset and create
  redirect. The page composer disables automatic mutation invalidation once;
  existing dialog forms retain automatic invalidation and their current UI.
- Separated feature context from internal CRUD dependencies and removed unused
  raw save/error/redirect methods from public page context. Context providers
  accept prepared values. Refine remains query/mutation/cache owner; TanStack
  Form remains values/validation/dirty/isSubmitting owner.
- Removed the product-specific saved-row selection helper; shared submission
  now selects the refreshed row before invoking the feature reset callback.
  Image replacement/removal behavior and deferred-upload progress are retained.
- Saved the flow and complete module responsibility map in
  `doc/resource-form-submission.md`, linked from the architecture/resource guides.
  The separate preparation-days operation retains its existing behavior.
- Verification: 17 tests pass, including upload/save failures, intentional
  retry, cache/detail partial refresh failures, image replacement/removal,
  reset-before-redirect and duplicate preparation submissions. TypeScript,
  production build and whitespace checks pass; existing route-generator and
  bundle-size warnings remain. No live product mutations or backend changes.


### Product submission connection follow-up — 2026-11-02

- Found the old main product save handler present again while the shared
  submission interface was still installed. Reconnected the product hook to
  `context.submit({ prepare, reset })` and removed its obsolete invalidation
  override and deleted-helper import.
- Preserved the current product success notifications through optional
  `page.successMessage` text. The shared submission displays that toast after
  reset and before redirect; the product hook contains no CRUD feedback/cache
  orchestration. The hook itself remains to own TanStack form state, schema,
  defaults and payload mapping.
- Updated the lifecycle ordering test and focused resource submission guide.
- Follow-up validation: all 17 tests, TypeScript, production build and
  whitespace checks pass. Existing route-generator and bundle warnings remain.


### Validation-save rollback root cause — 2026-11-02

- Reproduced the reported rollback with the installed TanStack Form library:
  reject an invalid submit, correct the name/image, save once, reset from the
  fresh record, then run the option-update effect used by useAppForm. The form
  returned to the original name and cover despite successful persistence.
- Cause: frozen initial `defaultValues` were passed back after reset cleared
  touched metadata. TanStack Form's option update then reapplied those original
  values. Cache invalidation alone cannot prevent this form-state rollback.
- Added shared `createResourceFormBaseline`/`useResourceFormBaseline` to advance
  configured defaults before reset notifies subscribers. Product main and
  preparation-days forms now use it. Live values and dirty/validation state
  stay in TanStack Form; failed saves and background reads do not reset fields.
- Added regression tests using real FormApi/FieldApi, the product schema and
  shared submission path. Removal/replacement cases failed before the baseline
  change and pass after it; subsequent unsaved edits survive option updates.
  Updated the resource guide and module responsibility map.
- Verification: all 19 tests, TypeScript, production build and whitespace
  checks pass. Existing route-generator circular-dependency and bundle-size
  warnings remain. No live product writes or backend changes were performed.


### Debounced persistent resource row ordering — 2026-11-02

- Added `ResourceView.orderField`, adopted as `orderField="sort_order"` by products
  and add-ons. Removed their repeated initial sort configuration because the
  shared table supplies ascending field/ID sorting. Existing local-only reorder
  mode and optional drop notifications remain available.
- The existing DnD end callback creates an immediate local preview and schedules
  one trailing save after DEFAULT_DEBOUNCE_MS (300 ms). Later drops replace it;
  returning to the original order, navigation, query-scope changes or unmount
  cancel pending writes. Active saving disables existing drag handles.
- Shared persistence rechecks sort access, reads the complete permanent-filter
  scope with server pagination and plans changed positions. Existing unique rank
  slots are preserved; duplicate/null ranks normalize the scoped sequence.
  Visible rows exchange their positions without treating a table page as the
  complete resource. Reads remain operation snapshots through useDataProvider.
- Per-row Refine useUpdate calls write only the order field, use the same named
  provider, disable retries/optimism and defer invalidation until batch completion.
  One resource invalidation refreshes lists/details, including partial failures.
  Writes are not transactional; no backend/schema/RPC changes or deployments.
- Saved the complete flow/module map in doc/resource-reordering.md and linked
  it from the architecture/resource guides. Added focused scheduler, pagination,
  rank planning, authorization, partial failure and refresh-failure tests.
- Verification: all 31 tests, TypeScript, production build and whitespace
  checks pass. Existing route-generator circular-dependency and bundle-size
  warnings remain. Verification used controlled adapters and did not reorder
  live records.


### Shared inline boolean resource columns — 2026-11-02

- Added createResourceSwitchColumn and ResourceSwitchCell, composed from the
  existing shadcn Switch. Products/add-ons now declare is_active switch columns
  with existing status filter labels. Custom action cells can use the same cell
  by registering their field in column metadata.
- Resource context carries the configured-field allowlist, named provider/meta,
  formatter and edit/record policy. Edit record eligibility falls back to the
  existing page/dialog form rule when there is no explicit ResourceView override.
  Context providers remain thin; feature columns contain no mutation logic.
- Shared per-cell useResourceBooleanField performs fresh authorization, a fresh
  provider read and eligibility/stale-field checks before a pessimistic Refine
  useUpdate containing only the registered boolean field. Duplicate requests
  are blocked through preflight/mutation/refresh; independent rows can save
  independently. Refine owns request state and cache.
- The hook awaits one list/many/detail invalidation on the same provider/ID,
  supplies Arabic accessible pending/success/error feedback and reconciles failed/ambiguous
  responses without automatic retries. Existing command workflows, server RLS
  and backend/schema/configuration remain unchanged.
- Saved the flow, custom-action example and module map in
  doc/resource-inline-fields.md and linked the central guides. Added controlled
  tests for toggling, payload allowlisting, access/record restrictions, stale
  values, duplicate clicks, errors/retry, response validation and cache failures.
- Verification: all 42 tests, TypeScript, production build and whitespace
  checks pass. Existing route-generator circular-dependency and bundle warnings
  remain. No live product/add-on flags or backend configuration were changed.


### Users role filter contract — 2026-11-02

- The user list RPC accepts one exact `p_role` string. Restricted the role
  filter builder to its supported `is` operator and made the users query adapter
  reject non-equality or non-scalar role filters instead of dropping operator
  information and sending an incorrect equality request.
- No RPC, migration, schema or remote data changes. Automated tests and build
  were not run.


### Catalog search and customization field rows — 2026-11-02

- Restored server-side name search on platform products and add-ons lists by
  passing `searchField="name"` to both ResourceView compositions.
- Consolidated customization field name, required badge, example and product/
  box visibility into one “خانة التخصيص” column. Status and row actions remain
  separate controls. No backend changes; tests/build were not run.
