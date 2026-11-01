# Admin application architecture

## Shared resource pages

See [ResourceView: flow, components, hooks, mutations and cache](./doc.md) for the current resource composition, access gate, Refine table bridge, named providers, CRUD mutation invalidation and business-command extension pattern.

For route-based create/edit screens, see [Route-based resource forms](./doc.md#15-route-based-resource-forms--products-first). Products use `/catalog/products/create` and `/catalog/products/:id/edit`; other resources retain their dialogs.

Shared form presentation is registered in `src/components/resources/forms/registry.ts`. Dialog and route-page adapters live in `forms/dialog/` and `forms/page/`; their context contracts and stable exports remain at the `forms/` root. Product route form implementation is grouped in `src/features/catalog/products/form-page/`.
