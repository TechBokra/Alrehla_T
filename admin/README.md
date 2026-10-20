# Admin Router Application

This app is the TanStack Router frontend foundation for the admin workspace.

## Router guarantees

- File-based routes are generated into `src/routeTree.gen.ts`.
- Route params and navigation targets are type-safe.
- Search parameters are validated with Zod and kept in the URL.
- Route loaders own page data dependencies.
- The router preloads links on intent (`defaultPreload: "intent"`).
- `@tanstack/router-plugin` enables automatic route code splitting.
- Root and route-level pending, error, and not-found boundaries are included.

## Commands

```bash
pnpm --filter admin dev
pnpm --filter admin generate:routes
pnpm --filter admin typecheck
pnpm --filter admin build
```

The current data adapter uses typed local fixtures so the route architecture can
be exercised independently. Replace the implementations in `src/lib/api.ts`
with the server/BFF client without changing route components or their typed
loader contracts.
