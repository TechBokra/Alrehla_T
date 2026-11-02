# Resource page form submission

Page forms use one resource-owned submission lifecycle. Product forms initialize
`baseline = useResourceFormBaseline(() => initialValues)` and pass
`baseline.defaultValues` to `useAppForm`. A feature passes only
its payload preparation and TanStack reset adapter to `context.submit`:

```tsx
onSubmit: async ({ value }) => {
  await submit({
    prepare: async () => {
      const values = productPageSchema.parse(value);
      const urls = await resolveImages("cover", values.images);
      return mode === "edit"
        ? toUpdatePayload(values, urls)
        : toCreatePayload(values, urls);
    },
    reset: (saved) => baseline.reset(form, valuesFromProduct(saved)),
  });
}
```

## Flow

1. TanStack Form validates the form and awaits `submit` inside `onSubmit`.
2. The shared submission guard locks the entire operation, including upload
   preparation and cache refresh. TanStack `isSubmitting` drives disabled UI
   and loading states throughout; the guard does not create another UI state.
3. The feature's `prepare` callback validates/maps its values and calls the
   existing upload resolver. That resolver checks upload permission and awaits
   selected files. An upload failure displays an error and prevents CRUD.
4. The shared submission calls the existing `useResourceFormCrud.save` adapter.
   It checks fresh authorization and record restrictions and calls Refine core
   `useForm.onFinish`, which uses the configured named data provider. Refine
   still owns the actual query, mutation state and resource cache.
5. On success, the shared hook awaits Refine `useInvalidate` for the resource's
   declared targets, defaulting to list/many/detail with the saved ID and same
   provider. The page composer disables automatic mutation invalidation once;
   dialogs retain their existing automatic invalidation.
6. Edit mode refreshes the existing detail query. The shared flow clears
   completed uploads and invokes `reset` with the authoritative row. The feature
   maps the row to field values and calls `baseline.reset(form, values)`, which
   updates the defaults used by the next render before resetting TanStack Form. A changed
   or removed image is mapped into the new clean form baseline.
7. The shared flow displays optional success copy from the page definition
   after reset. Creation then uses the existing Refine redirect helper.
   Edit mode stays on the current page. No new cache or detail query is added.

## Responsibilities

| File/module | Responsibility |
| --- | --- |
| `hooks/resources/crud/form-baseline.ts` | Keeps the rendered default-values configuration synchronized with a successful reset, before notifying form subscribers. It stores no live field/query state. |
| `hooks/resources/crud/use-resource-form-baseline.ts` | Creates that baseline once per mounted form; initial/background record changes do not replace unsaved values. |
| `hooks/resources/page/form-submission.ts` | Submission contract, execution order, whole-flow guard, preparation/save failure handling, partial refresh feedback, cleanup/reset/redirect ordering. Its injected operations are the internal test seam. |
| `hooks/resources/page/use-resource-form-submission.ts` | Connects that sequence to the current CRUD adapter, Refine invalidation, upload handles, the definition's error formatter and Arabic error toasts. |
| `components/resources/page/create-resource-page.tsx` | Composes the shared hook with the loaded resource scope, supplies `submit` to the feature hook, and publishes the prepared runtime through context. Existing loading/access/unavailable UI remains here. |
| `components/resources/page/types.ts` | Separates the feature-facing submit interface from internal CRUD dependencies. |
| `contexts/resource-page/types.ts` | Exposes submit to composed page content and hides unused raw save/error/redirect methods; context providers remain thin and accept prepared values. |
| `features/catalog/products/form-page/form.tsx` | Product schema/defaults, TanStack field state, allowed create/edit payload mapping, reset adapter and field presentation. The main save handler contains no mutation, invalidation or error-toast orchestration. The separate preparation-days operation uses the same baseline helper; its mutation and feedback behavior is unchanged. |
| `features/catalog/products/form-page/values.ts` | Pure product-row-to-field-values mapping, including cleared/replaced covers. |
| `hooks/resources/crud/use-resource-form-crud.ts` | Existing Refine query/mutation ownership and fresh access/record checks, reused unchanged. |

## Failures and retry

- Preparation failure never reaches the resource mutation. Failed queued files
  and entered values remain available for correction.
- A failed save uses the configured backend error formatter, retains values,
  and releases the guard for an intentional retry.
- Cache/detail refresh failure after persistence is reported as a saved record
  with a refresh problem. It never repeats the mutation automatically. The
  mutation response is the fallback reset baseline when detail refresh fails.
- Background query refreshes do not invoke reset; only successful submission
  does. Initial access/loading/errors continue through the existing page gate.

## Verification

The shared lifecycle tests cover removed/replaced image baselines, upload
failure before mutation, backend failure and retry, refresh partial completion,
reset-before-redirect ordering, and duplicate submissions during preparation.
The existing upload tests remain in place. No backend changes or live product
mutations are required by this refactor.

## Validation followed by save: rollback regression

A successful `form.reset(savedValues)` updates TanStack Form's internal
`options.defaultValues`. `useAppForm` then calls `FormApi.update(options)` in a
layout effect after render. Previously, both product forms kept the original
record in frozen React state and passed those old defaults on every render.
After reset clears touched metadata, TanStack accepts the old options again and
restores the original fields, even though the mutation, Refine invalidation and
detail read succeeded.

`useResourceFormBaseline` fixes this by advancing the configured default-values
reference before calling reset. The next React layout effect therefore receives
the saved baseline. Failed validation/preparation/save and background reads do
not advance it. This baseline is form configuration; live values, validation and
dirty state still belong entirely to TanStack Form.

`tests/resource-form-baseline.test.mjs` uses the installed `FormApi`, `FieldApi`,
product schema, revalidation logic and shared submission flow. It rejects an
invalid submit, corrects the name and replaces/removes a cover, saves once, then
runs the exact option-update step used by `useAppForm` on the next render. Both
cases reproduced the original name/image rollback before the baseline update
and pass after it. A subsequent unsaved edit also survives option updates.
