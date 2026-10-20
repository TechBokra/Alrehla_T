# Admin application

The `admin/` folder contains a standalone React admin frontend built with Vite
and TanStack Router. It currently serves as a UI and architecture preview: its
product records and sign-in identity are local demos, not production data or
authorization.

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

## Guides

- [Architecture](docs/architecture.md) — runtime, route and feature structure,
  current data/auth behavior, and rules for future backend integration.
- [Design system](docs/design-system.md) — current tokens, component sources,
  and UI implementation conventions.

## Current limitations

- The app uses in-memory fixture providers; changes reset when the page reloads.
- The preview auth provider always reports an authenticated demo admin.
- There is no production API, database adapter, or authorization enforcement in
  this Vite app. Do not treat its demo auth or hidden UI controls as security.

See the guides before adding a production admin feature so it follows the
existing route, feature, and visual conventions.
