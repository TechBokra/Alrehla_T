# Admin routes

The admin uses TanStack Router's directory routing conventions. `__root.tsx` owns global providers, session checks, and the root error/loading/not-found components. Each preview feature owns a `route.tsx` layout and an `index.tsx` page. The feature layout renders the existing sidebar/page frame around an `<Outlet />`; feature page components render only their own content.

```text
src/routes/
├── __root.tsx
├── index.tsx                         # / → /theme
├── sign-in/
│   └── index.tsx                     # /sign-in
├── auth/
│   └── callback/
│       └── index.tsx                 # /auth/callback
├── theme/
│   ├── route.tsx                     # Shared theme layout
│   └── index.tsx                     # /theme
├── data-view/
│   ├── route.tsx                     # Layout and view-search validation
│   └── index.tsx                     # /data-view?view=table|kanban|calendar
├── fields/
│   ├── route.tsx
│   └── index.tsx
├── forms/
│   ├── route.tsx
│   └── index.tsx
├── form-prototype/
│   ├── route.tsx
│   └── index.tsx
├── ui-primitives/
│   ├── route.tsx
│   └── index.tsx
├── calendar/
│   └── index.tsx                     # Legacy redirect to calendar data view
└── sections/
    └── $section/
        └── index.tsx                 # Existing dynamic legacy redirects
```

`route.tsx` is the parent route/layout, `index.tsx` is its default page, and `$id` is a dynamic segment. To add a child page, add a file or folder under the relevant feature. Add a nested `route.tsx` with `<Outlet />` when that child needs its own shared layout. Add local supporting files under an ignored `-components/` or `-helpers/` folder so the generator does not treat them as routes.

Existing public URLs remain the same. TanStack's generated internal IDs for index routes end in `/`; navigation targets such as `/theme` and `/sign-in` remain valid. Root auth comparisons normalize trailing slashes so the OAuth callback reaches code exchange with either spelling. Page titles and feature pending/error boundaries live in the parent layouts. The data-view search schema also lives on its parent so existing links and redirects retain typed `view` parameters.

Run `pnpm generate:routes` after moving or adding route files, then `pnpm typecheck` and `pnpm build`. The Vite plugin also generates routes during development. Do not edit `src/routeTree.gen.ts` by hand. This is a Vite application: these are TanStack route files, with client-side execution rather than Next.js server components.
