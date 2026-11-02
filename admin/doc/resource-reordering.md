# Resource row reordering

Opt into persisted numeric row positions with one resource prop:

```tsx
<ResourceView<Product>
  resource="personalized_products"
  orderField="sort_order"
  // Existing form, columns and other resource options.
/>
```

The field enables dragging and supplies initial ascending field/ID sorting.
The user can sort normally by other columns; persisted dragging is available
only while the primary sort is the position field ascending. Existing
`enableRowReordering` without `orderField` remains local-only.

## Flow

1. The existing Shuip `RowReorderingBoundary` emits reordered IDs only on a
   completed drop. Drag start, hover, cancelled drops and render mount do not
   schedule writes.
2. `useResourceTable` validates the visible IDs and shows the dropped order
   immediately. The shared scheduler waits `DEFAULT_DEBOUNCE_MS` (300 ms).
   Another drop restarts the timer with the latest sequence. Returning to the
   original sequence cancels it. Source/query-scope changes and unmount also
   cancel pending work; an already started server write is not cancelled.
3. `useResourceReorder` locks the batch, disables the existing drag handles,
   shows the Arabic pending toast and checks fresh `sort` authorization.
4. It reads the complete resource scope through Refine `useDataProvider` and
   the same named provider used for mutation/invalidation. Permanent filters
   constrain that read; platform products retain `owner_type=platform`.
   Server paging handles capped responses, and count changes/incomplete reads
   fail before writing. This snapshot exists only for the operation and does
   not introduce another resource cache.
5. Selected visible rows exchange their slots in the full sequence. Search and
   other active filters may hide rows; those rows retain their relative slots.
   Existing unique numeric ranks are reused. Duplicate/null ranks require
   normalizing the complete scoped order to 0-based integer positions, so that
   first repair may also update hidden rows' position values. Missing IDs or
   changed visible ranks reject a stale drop.
6. Fresh per-record sort checks precede sequential Refine `useUpdate` calls for
   changed positions only. Each payload contains only `{ [orderField]: value }`.
   Mutations use pessimistic mode, retries disabled, silent per-row feedback,
   and `invalidates: []`; no write occurs before the drop delay and preflight.
7. One awaited Refine `useInvalidate({ invalidates: ["resourceAll"] })` refreshes
   resource lists, details and selectors under the same provider. The local
   preview is cleared, handles unlock, and the user sees Arabic success/error
   feedback. There is no create mutation or new server command.

## Ownership

| Module | Responsibility |
| --- | --- |
| `lib/const.ts` | Shared 300 ms debounce; search retains its existing alias. |
| `components/resources/types.ts` | Optional numeric `orderField` contract; existing local flag and notification callback remain available. |
| `hooks/resources/table/reorder.ts` | Drop debounce/cancellation, complete paginated snapshot, slot planning, stale/invalid-input checks and sequential execution/partial-failure policy. |
| `hooks/resources/table/use-resource-reorder.ts` | Connects the sequence to fresh authorization, `useDataProvider`, `useUpdate`, Refine invalidation, Arabic toasts and the batch lock. |
| `hooks/resources/table/use-resource-table.ts` | Refine table state, default position sorting, local preview and drop scheduling; clears the preview after persistence. |
| `hooks/resources/controller/use-resource-controller.ts` | Combines sort permission, configured field, canonical sorting and saving state for presentation. |
| `components/resources/view/resource-view.tsx` | Supplies the controller's drop handler and saving-disabled flag to existing table UI. |
| `features/catalog/products/page.tsx`, `features/catalog/addons/page.tsx` | Declare their order field; products retain their permanent ownership scope. No feature mutation, timer or cache logic. |

The existing DnD UI supplies pointer/keyboard interaction and Arabic accessible
announcements. Refine owns mutation results and QueryClient cache. Local state
contains only the temporary preview, timer and batch lock; it is not another
data cache. Server RLS remains authoritative.

## Failure and concurrency limits

Denied sorting, incomplete snapshots and stale/invalid IDs stop before writes.
A failed row update stops the remaining writes, refreshes the resource and
reports partial completion if earlier updates succeeded. The sequence is never
retried automatically. A refresh failure after successful updates explicitly
reports that positions saved but the displayed data could not refresh.

Per-row `useUpdate` writes are not transactional. A simultaneous external reorder
after the preflight read can race this batch; atomic multi-user ordering would
require separately authorized backend work. No Supabase functions, migrations,
schema/policies, API routes or deployments are added by this implementation.
Store-order fulfillment/status changes continue through their command controller.

## Verification

Focused tests cover no pre-drop writes, the exact shared delay, latest-drop
coalescing/cancellation, capped multi-page reads, incomplete/changing snapshots,
later-page slot preservation, duplicate-rank normalization, no-op drops, stale
and invalid input, authorization, final invalidation, partial writes and cache
refresh failure without retry. Tests use controlled provider/mutation adapters;
no production row positions are changed by verification.
