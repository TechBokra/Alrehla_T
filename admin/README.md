# Admin application

The `admin/` folder contains a standalone React admin frontend built with Vite
and TanStack Router. Its sign-in uses Refine and Supabase staging authentication;
product records and the existing data views remain local UI previews.

## Start locally

Run these commands from this folder:

```bash
pnpm install
pnpm dev
```

Other commands:

```bash
pnpm typecheck
pnpm build
pnpm preview
pnpm generate:routes
```

`typecheck` regenerates the TanStack route tree before running TypeScript.
`src/routeTree.gen.ts` is generated; do not edit it by hand.

## Development tools

`pnpm dev` starts Vite and the Refine Devtools server (port `5001`). Open the
Devtools panel at the bottom of the app, then select **Monitor** to inspect
Refine queries/mutations, resources, providers, and errors. **Overview** shows
dependency information. The provider wraps all Refine contexts, including the
local demo screens.

To run the tools separately, use `pnpm exec vite` and `pnpm devtools` in two
terminals. Restart the development server after this setup change. The Devtools
wrapper is loaded only when `import.meta.env.DEV` is true and is excluded from
production builds. See the [official guide](https://refine.dev/core/docs/guides-concepts/development/#using-devtools).

Configure the two browser-safe Supabase variables in `.env.example` before signing
in. Open `/sign-in` with an existing staging administrator account. See
[Authentication](docs/authentication.md) for setup, access rules, and checks.

## Guides

- [Data tables](docs/data-table.md) — Shuip controls, Refine state, filtering, pagination, and display states.
- [Data provider](docs/data-provider.md) — shared Supabase client, root provider, and isolated demo contexts.
- [Routing](docs/routing.md) — folder routes, parent layouts, index pages, and dynamic children.
- [Architecture](docs/architecture.md) — runtime, route and feature structure,
  current data/auth behavior, and rules for future backend integration.
- [Design system](docs/design-system.md) — current tokens, component sources,
  and UI implementation conventions.

## Current limitations

- Existing demo views use in-memory fixture providers; changes reset when the page reloads.
- Root-route navigation requires a verified Supabase user with a non-archived
  `super_admin` or `general_supervisor` profile.
- The root Supabase data provider is configured, with no live resources registered yet.
  Database RLS and RPC guards must enforce authorization when features are connected.

See the guides before adding a production admin feature so it follows the
existing route, feature, and visual conventions.
