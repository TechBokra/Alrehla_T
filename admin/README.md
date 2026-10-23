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

Configure the two browser-safe Supabase variables in `.env.example` before signing
in. Open `/sign-in` with an existing staging administrator account. See
[Authentication](docs/authentication.md) for setup, access rules, and checks.

## Guides

- [Routing](docs/routing.md) — folder routes, parent layouts, index pages, and dynamic children.
- [Architecture](docs/architecture.md) — runtime, route and feature structure,
  current data/auth behavior, and rules for future backend integration.
- [Design system](docs/design-system.md) — current tokens, component sources,
  and UI implementation conventions.

## Current limitations

- The app uses in-memory fixture providers; changes reset when the page reloads.
- Root-route navigation requires a verified Supabase user with a non-archived
  `super_admin` or `general_supervisor` profile.
- Live data integration is still pending. Database RLS and RPC guards must enforce
  authorization when those features are connected.

See the guides before adding a production admin feature so it follows the
existing route, feature, and visual conventions.
