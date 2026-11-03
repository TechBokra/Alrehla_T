# Publisher products

## Route and table

`/catalog/publisher-products` shows publisher-owned editions in the catalog.
The title is «منتجات الناشرين» and the description explains that publishers
submit editions from their accounts and products go through review. The table
shows product name (with cover thumbnail), category, publisher, age range, price
and an inline active-state switch. It has no row-action column, create button,
sort-order column or drag-and-drop reordering.

The table is a `ResourceView<Product>` over the existing
`personalized_products` resource. Its permanent `owner_type = publisher` filter
keeps publisher editions separate from platform products. Refine owns the table
query, server pagination, name search, filters and cache. The initial order is
newest first with `id` as a stable tie-breaker.

## Publisher names and filters

`publisher_id` has no generated foreign-key relationship in the current schema,
so the page loads only publisher `id` and `name` through Refine `useList` and the
existing default Supabase provider. The publisher column maps those IDs to names;
the same list supplies the «دار النشر» multi-select filter. Rows without a
publisher ID display «من غير دار نشر».

`createResourceSwitchColumn` supplies the «الحالة» switch and its active/inactive
filter. The switch edits only `is_active`; it does not change `review_status`.
The list keeps all publisher-owned review states visible; review moderation is
outside this route.

## Access and mutations

`ResourceAccessGate` checks `personalized_products` list access before the page
mounts. The resource access policy accepts either `canManagePublishers` or
`canManageCatalog` for product CRUD, matching the existing product-management
boundary. Row sorting continues to require `canManageCatalog`. The page's record
rule allows the status switch only on publisher-owned rows, and
`canCreate={false}` removes create actions from this list.

The shared `ResourceSwitchCell` delegates to `useResourceBooleanField`. That
hook performs a fresh edit access check and record read, verifies the current
field value and publisher ownership, then issues a pessimistic Refine update
containing only `is_active`. It invalidates the matching product list/detail
queries through the same provider. Supabase RLS remains authoritative.

## Module map and states

- `src/routes/catalog/publisher-products/index.tsx` binds the TanStack route.
- `src/features/catalog/publisher-products/page.tsx` loads publisher names,
  handles loading and retry/error states, then configures the scoped list.
- `src/features/catalog/publisher-products/columns.tsx` defines the six display
  columns, publisher filter options, age and price formatting, and shared
  status switch.
- `src/providers/refine/resources.ts` adds the sidebar link while reusing the
  existing product resource registration.
- `src/components/admin-layout.tsx` gives the shared admin breadcrumb the
  publisher-products label.
- `src/components/resources/types.ts` and
  `src/hooks/resources/controller/use-resource-controller.ts` support disabling
  create actions for read-only resource views.
- `src/providers/refine/access-control-provider.ts` grants product management
  access to publisher managers as well as catalog managers.

Publisher-name loading shows a skeleton. If the first read fails, the page shows
an Arabic retry action; if a cached read exists and refresh fails, the table
stays visible with a note that saved publisher names are being shown. A
successful empty publisher result still renders the product table.

No database, schema, migration, policy or deployment changes were made. No tests
were added or run for this route.
