# Refine + Shuip data tables

The Refine table composes the existing [Shuip Radix block](https://shuip.plvo.dev/blocks/radix/data-table). Refine owns data requests and mutations; Shuip owns table rendering and controls. Existing resource/provider boundaries are unchanged.

## Usage

```tsx
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { useDataTable } from "@/components/refine-ui/data-table/use-data-table";

const table = useDataTable<Product>({
  columns,
  refineCoreProps: { resource: "actual_table_name", pagination: { pageSize: 20 } },
  searchField: "name", // a real text field, required for server global search
  enableRowSelection: true,
});

return <DataTable
  table={table}
  toolbarVariant="inline-chips"
  filterVariant="popover"
  paginationVariant="numbered"
  pageSizeOptions={[10, 20, 50]}
  viewsStorageKey="resource-specific-key"
/>;
```

This is a recipe, not a newly registered live resource. The product showcase remains inside its local Refine provider.

## Columns and controls

Give data columns `meta.label` and `meta.variant` (`text`, `number`, `date`, `select`, or `multiSelect`). Select variants also need `meta.options: [{ label, value }]`. Use the block's `DataTableColumnHeader` for sortable headers. Disable sorting/filtering/hiding as appropriate for selection and action columns. Selection checkboxes belong in the column definitions.

The toolbar includes search, metadata-driven faceted filters, the advanced filter builder, multi-sort, and column visibility. Saved filter/sort views appear when a unique `viewsStorageKey` is provided; these are local browser preferences. `toolbarActions` adds resource actions, and `toolbar={false}` hides the toolbar. Filter builders support popover/dialog presentation. Toolbar variants are `default`, `inline-chips`, and `minimal`.

## Data modes

- **Server (default):** pagination, sorting, search, and completed filter conditions become Refine requests. The hook translates Shuip operator/value objects into Refine filters, including the raw PostgREST formatting needed by the installed Supabase provider for negative membership/contains filters. Incomplete filter rows stay visible without being sent. Search is hidden unless `searchField` is configured. Refine permanent filters remain the responsibility of `refineCoreProps.filters.permanent`.
- **Client:** use `mode: "client"` for bounded, fully loaded local datasets. Refine fetches with pagination/filtering/sorting off; Shuip computes these in memory. Set `initialState.pagination` for the visible page size. The showcase uses this mode, and its demo provider respects pagination off so searches cover the full fixture dataset.

Use the paired `useDataTable` hook for Shuip advanced filters. Refine's stock React Table hook does not translate Shuip condition objects automatically. Existing plain `<DataTable table={stockRefineTable} />` rendering remains compatible, but requires appropriate filter wiring before using the advanced controls.

## Display states

- Initial loading uses skeletons by default; `loadingVariant="shimmer"` or `"overlay"` customizes it. Refetches use an overlay over existing rows.
- Empty datasets and no matching results have separate Arabic messages; filtered results offer a clear button. `emptyState` replaces the default.
- Failed reads show an explicit error and retry action, never an empty-success message.
- Pagination supports `simple` and `numbered` variants, stays available for empty filtered pages, and uses the server's total in server mode. Selection counts describe rows on the loaded page.

The older Refine pagination/filter/sorter modules remain available for existing custom compositions. This adapter uses Shuip controls for the complete table.
