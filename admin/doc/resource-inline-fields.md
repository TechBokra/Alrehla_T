# Inline resource boolean fields

Configure a switch column without feature mutation callbacks:

```tsx
import { createResourceSwitchColumn } from "@/components/resources";

createResourceSwitchColumn<Product>({
  field: "is_active",
  label: "الحالة",
  trueLabel: "نشط",       // Default
  falseLabel: "غير نشط", // Default
});
```

Products and add-ons use this factory instead of a read-only status badge.
Their existing status filter options and action menus remain available.
Only boolean-compatible keys are accepted by the typed factory. Null/missing
values are disabled at runtime rather than silently treated as writable false.

## Flow and state

1. The factory supplies the existing status filter metadata and registers the
   editable field as `meta.resourceBooleanField`. The resource controller reads
   configured leaf columns to prepare an allowlist in ResourceContext.
2. The stable `ResourceSwitchCell` reads the current record through the shared
   hook. It composes the existing shadcn Switch, with an Arabic accessible name
   containing the field label, record name/ID and current/pending state. Pointer and
   keyboard events do not bubble into row navigation.
3. A checked-change event immediately calls `useResourceBooleanField`. There
   is no drop debounce for switches. Its guard blocks repeated clicks through
   authorization, the request and cache refresh. Pending state sets `aria-busy`, supplies `جارٍ الحفظ…` in the
   accessible name and disables only that cell. Each cell owns a Refine mutation;
   independent rows can save independently.
4. The shared executor checks registered-field membership, boolean values, row
   identity and the existing edit/record restrictions. It checks fresh Refine
   edit permission, reads the same record through the named data provider, then
   rechecks fresh-record eligibility and authorization. A changed field value
   refreshes the table and asks for an intentional retry before any write.
5. Refine `useUpdate` sends exactly `{ [field]: checked }` with the resource,
   record ID, metadata and correct named provider. Mutation mode is pessimistic;
   retries, per-row automatic notifications and automatic invalidation are
   disabled so the shared flow can await one targeted refresh.
6. The shared hook awaits Refine `useInvalidate` for list/many/detail under the
   same provider and ID. The controlled switch receives the refreshed record;
   there is no second checked-value state or custom resource cache. A row may
   disappear if the updated value no longer matches an active status filter.

Refine owns mutation pending/error state. Local phase state covers authorization,
the fresh read and post-mutation refresh; a ref guards the operation. The context
provider accepts prepared identity/rules and contains no request logic. Feature
columns declare presentation only.

## Custom action cells

The same stable cell can be composed alongside existing row actions. Register
the field on that column so it is allowed by the resource context:

```tsx
{
  id: "active_action",
  meta: { resourceBooleanField: "is_active" },
  cell: ({ row }) => (
    <ResourceSwitchCell
      id={String(row.original.id)}
      field="is_active"
      label="الحالة"
    />
  ),
}
```

`useResourceBooleanField(id, field)` is the lower-level shared hook when custom
presentation is required. Both the factory and custom cell use that same
execution path. Rendering a cell without registered metadata leaves it disabled.

## Responsibility map

| Module | Responsibility |
| --- | --- |
| `components/resources/columns/resource-switch-column.tsx` | Typed column factory, metadata registration, reusable Switch cell and Arabic accessible pending/status labels. |
| `hooks/resources/crud/use-resource-boolean-field.ts` | Reads resource context, resolves the provider, owns the per-cell Refine update hook, preflight/refresh phase, Arabic feedback and targeted invalidation. |
| `hooks/resources/crud/boolean-field-update.ts` | Testable guarded sequence: allowlist/input validation, fresh authorization/record checks, single-field write, response verification and refresh behavior. |
| `hooks/resources/controller/use-resource-controller.ts` | Prepares configured fields, provider metadata, formatter and record policy; edit rules fall back to the existing page/dialog form restriction when no explicit override is given. |
| `contexts/resource/types.ts` | Type-only inline-update configuration contract. The existing provider remains thin. |
| `features/catalog/products/columns.tsx`, `features/catalog/addons/columns.tsx` | Opt into is_active switches; no feature hook, callback, toast or invalidation code. |
| Resource/hooks public exports | Expose the factory, cell and shared hook through the existing interfaces. |

## Failures and limits

Failed edits retain the server-controlled state, show an Arabic error through
the existing formatter and release the guard for intentional retry. A write
failure also invalidates to reconcile responses that may have failed after
the server committed. Unexpected response values are not reported as success.
A refresh failure after saving explicitly reports that the value saved but
the display could not refresh; it does not repeat the update.

Fresh checks reduce stale changes but do not provide a database compare-and-swap
transaction. Existing RLS/server policies remain authoritative. This helper is
for ordinary boolean CRUD flags such as is_active; business transitions such as
order fulfillment or account suspension retain their registered commands.
No Supabase functions, schema/policy changes, APIs or deployments are included.

## Verification

Controlled tests cover both toggle directions and exact payload keys,
unregistered/nonboolean fields, cached/fresh record restrictions, fresh access
denial, stale values, duplicate preflight clicks, failed-save retry, refresh
failure, no-op values and unexpected mutation responses. No live product/add-on
flags are changed by automated verification.
