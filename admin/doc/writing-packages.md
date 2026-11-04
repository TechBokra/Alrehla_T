# Creative-writing packages

## User-facing behavior

The admin sidebar has a separate **بداية الرحلة** group with one entry,
**باقات الكتابة الإبداعية**, at `/writing/packages`. The page lists the
packages used by the client site and supports create/edit in the shared
resource Dialog. Search matches package names. The table starts with a separate
50px Avatar column, then package name, session count, price, active-state switch
and row actions. Avatar, switch and action columns default to 50px, cap at 70px
and remain visible. Compact status/action header icons carry accessible Arabic
labels.

The dialog follows the current client/admin package fields: name, age group,
track, short description, target audience, full description, price, number of
sessions, session duration, total program duration, prerequisite note and active
state. The first responsive two-column row places the Avatar fallback beside
**اسم الباقة**. Remaining fields use a two-column grid.

The existing `creative_writing_packages` table has no persisted image field.
The user chose Avatar fallback only, so the form displays a non-editable package
Avatar and the table column always uses its package-icon fallback. No image
upload or database migration is part of this page.

The shared row menu includes delete. Its confirmation warns about linked
records. The existing admin package RLS policy permits deletion; foreign keys
block it when records such as course subscriptions, service orders, study
materials or prerequisite packages still reference the package. Instructor
package links cascade under the existing foreign key.

## Request flow and ownership

1. `adminNavigationGroups` registers the separate sidebar group and package
   resource. `AuthorizedSidebarItem` checks `list` access before showing the
   link. The route wrapper sets the browser title and mounts
   `WritingPackagesPage`.
2. `ResourceView` runs the resource access gate, then `useResourceController`
   and `useResourceTable` load the table through Refine's `useTable` and the
   existing `default` Supabase provider. Refine owns query keys, pagination,
   search, edits and cache invalidation.
3. `writingPackageForm` uses the shared Dialog and Refine CRUD controller.
   `WritingPackageDialogFields` owns TanStack Form values and validation;
   `model.ts` converts them into the existing database column names. New
   packages get a unique slug, while edits omit `slug` so saved client URLs
   stay stable. The form keeps an existing prerequisite package ID if present.
4. `writingPackageColumns` renders a 50px shared Avatar column and uses
   `createResourceSwitchColumn` for `is_active`. The shared boolean-field hook
   authorizes the row, reads the latest record, writes only the boolean field,
  and invalidates list/many/detail data through Refine. Its visible column has
  a 50px default size and a 70px maximum.
5. The access-control provider allows list/show/create/edit/delete to super
   admins and admins with `canManageCatalog`; saved row reordering is denied,
   while normal table header sorting remains available. The shared row-actions
   menu handles edit/delete authorization and the shared delete dialog handles
   confirmation. Existing Supabase RLS and foreign keys remain authoritative.
   There is no new provider, API, schema, policy or deployment.

The legacy client save action calls `revalidatePath` and the public-page refresh
helper. The new admin resource writes directly through Refine's Supabase
provider, so it does not invoke that Next.js revalidation path. If a public
package page is served from a cached build, this admin save does not actively
revalidate it.

## Component and logic map

| Module | Responsibility |
| --- | --- |
| `routes/writing/packages/index.tsx` | Route entry and browser tab title. |
| `features/writing/packages/page.tsx` | Composes the shared list, search, table and dialog. |
| `features/writing/packages/dialogs.tsx` | Module-scope dialog definition, first image/name row, field layout and TanStack form submission. |
| `features/writing/packages/columns.tsx` | Separate compact Avatar/name columns, package details, active-state switch and row actions. |
| `features/writing/packages/model.ts` | Existing table type, form schema/defaults, row conversion, create/update payloads, slug generation and Arabic errors. |
| `providers/refine/resources.ts` | Sidebar group, route, resource label and form-mode registration. |
| `providers/refine/access-control-provider.ts` | Catalog permission policy; row deletion is allowed, saved reorder remains denied. |
| `components/admin-layout.tsx` | Arabic breadcrumb label. |
| `components/resources/` and `hooks/resources/` | Existing shared query, CRUD, access, status mutation, dialog and cache lifecycle. |

## States and verification

The shared resource gate handles loading/error/denied access. The shared table
handles loading, empty and query-error states. The Dialog handles edit-record
loading, retry, form validation, pending saves and save errors. The status
switch shows its shared pending/disabled and Arabic success/error feedback.

Route generation completed successfully with the existing circular-dependency
warning. Tests, typecheck and build were not run for this change. No live package
rows were modified. Image selection and public package image rendering remain
unavailable because the existing resource has no persisted image field.
