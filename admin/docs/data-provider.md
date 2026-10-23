# Supabase data provider

## Ownership and configuration

`src/providers/supabase-client.ts` owns the single typed browser client. Authentication and the root Refine data provider obtain that same instance, session storage (`alrehla-admin-auth`), PKCE configuration, and token refresh process. The existing auth module re-exports the getter for compatibility. Do not create another client in a feature.

Set these browser-safe values in `.env.local`, then restart Vite:

```dotenv
VITE_SUPABASE_URL=https://nznfawbcgfwpftbiqima.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<staging publishable key>
```

Never expose a service-role or secret key through a `VITE_` variable. `src/types/supabase.ts` remains the generated staging `Database` contract; no runtime types package is necessary. The unfinished singular `src/provider/` folder is not used by this integration.

`src/providers/data-provider.ts` lazily delegates to the official `@refinedev/supabase` factory. `getApiUrl()` returns the configured `/rest/v1` endpoint. Missing URL or key rejects requests with `DataConfigurationError` (503), without preventing sign-in from rendering. Database read errors propagate to Refine; they are not converted to empty lists. Custom requests and RPC adapters are not implemented in this step.

## Provider boundaries

- The root Refine context owns the staging data provider. Constructing it sends no data request and registers no live resources.
- `component-showcase/layout.tsx` retains its nested Refine context with `previewDataProvider`.
- `form-prototype/refine-demo.tsx` retains its nested Refine context with its own in-memory provider.
- Demo `products` records are fixtures, not a staging resource. Keep all demo actions within these contexts.

For a future real feature, register its actual table/resource and routes on the root Refine context, and mount its pages outside the local demo layouts. Use generated row/insert/update types and Zod for form inputs. Refine resource names are runtime strings, so the official provider does not by itself guarantee table-name or mutation-shape type safety. Validate business operations on the server and enforce access with RLS/guarded RPCs; navigation role checks do not authorize database writes. Review each resource before connecting mutation hooks.

## Verification

From `admin/`, regenerate routes and run TypeScript/build:

```bash
pnpm generate:routes
pnpm typecheck
pnpm build
```

Focused Node tests are in `tests/data-provider.test.ts` and `tests/auth-provider.test.ts`. Using the repository's existing client-side TypeScript loader:

```bash
node --import ../client/node_modules/tsx/dist/loader.mjs --test tests/*.test.ts
```

These checks use fake credentials, mocked HTTP failures, and local demo mutations. They do not write to staging. The previous auth test path documented in earlier progress entries was absent when this change began; the current auth regression suite is under `tests/`.

Reference: [official Refine Supabase provider](https://refine.dev/core/docs/data/packages/supabase/).
