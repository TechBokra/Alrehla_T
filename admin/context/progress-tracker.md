# Admin progress

## Current phase

Shared staging authentication and official Refine data-provider foundation alongside local UI previews.

## Completed

- Completed the Refine/Shuip table composition with toolbar, advanced/faceted filtering, multi-sort, column visibility, saved views, both pagination variants, selection, loading/refetch, empty/no-results, and read-failure states. Added the paired `useDataTable` hook for client/server state translation; the local product preview uses it with the complete fixture dataset. Documented usage in `docs/data-table.md`. No staging resources or database writes were introduced.
- The completed table composition passes TypeScript and `git diff --check`. Reviewed the Shuip documentation in the browser; application browser checks and automated tests were not run for this update.
- Replaced the Refine data table's duplicated rendering with `components/block/shuip/data-table.tsx`. The adapter keeps the existing `UseTableReturnType` prop and Refine pagination; Shuip owns headers, rows, pinning, selection display, and loading. Supports Shuip loading variants, custom empty states, row clicks, and class names, with an Arabic default empty state. No provider or database changes.
- The Refine/Shuip adapter passes TypeScript checking and `git diff --check`. No tests or browser checks were run for this component update.
- Connected the installed Refine Devtools package through a development-only wrapper above all Refine contexts. `pnpm dev` now uses the Refine CLI to start Vite and the Devtools server; `pnpm devtools` runs the server separately. Documented usage in the README. No database changes.
- Devtools integration passes TypeScript checking and `git diff --check`. No tests or live server/browser checks were run for this setup.
- Moved browser-client ownership to `src/providers/supabase-client.ts` and wired the root Refine context to the official Supabase data provider. Preserved local demo providers, lazy configuration failures, and auth behavior. Added provider/auth regression checks under `tests/` and `docs/data-provider.md`. No database or live resource changes.
- Verified the provider foundation with route regeneration, TypeScript, the production build, and 12 passing mocked/local tests. Both demo contexts retain their providers; create/edit/delete checks issue no network requests. Build reports a large-chunk warning; route generation reports a dependency circular-import warning. Real-account browser login remains outside these mocked checks.
- Reorganized existing routes into folders with feature `route.tsx` layouts and `index.tsx` pages. Moved preview shells into parent layouts, preserved data-view search and legacy redirects, and kept auth callback handling compatible with trailing slashes. See `../docs/routing.md`.
- Regenerated the route tree and verified all 11 previous navigation URLs remain available. TypeScript and the production build pass after the route reorganization.
- Added Arabic `/sign-in` using the existing shadcn components and Refine `useLogin`.
- Refactored sign-in to the existing TanStack `useAppForm` pattern with `form.AppField`, `Fields.Input`, and `form.SubmitButton`; shared inputs support autocomplete, direction, and an optional password visibility control.
- Added a typed Supabase browser adapter and admin auth provider, using staging environment configuration.
- Added role/archive checks, protected route navigation, real identity lookup, and local-session logout.
- Preserved demo data providers for the existing UI previews.
- Added provider tests and documented configuration and verification in `../docs/authentication.md`.
- Verified the shared-form refactor with TypeScript, a production build, all eight provider tests, and browser checks for Arabic validation, bound input values, and password visibility. A real-account login remains unverified.
- Added Google OAuth initiation through Refine, PKCE callback exchange, shared role/archive checks, and duplicate callback protection. Staging's public auth settings report Google disabled; provider credentials and redirect configuration are still required.
- All 16 auth-provider tests pass. Browser checks confirm disabled-Google feedback, callback cancellation handling, and a retry link back to sign-in. Full Google account login awaits provider configuration.

- Extracted the root loading, error, and not-found screens into reusable `components/route-states/` components using shadcn Card, Skeleton, Badge, and Button, with Arabic RTL content and accessible status/error announcements.

## Boundaries

- Work in `admin/` for this feature was explicitly authorized after the earlier client-only handoff.
- No database migrations or production database changes are part of sign-in.
- The other context files referenced by `AGENTS.md` are missing. `docs/templates/` contains blank templates rather than project decisions. Use the source and authentication documentation for the implemented scope.

## Remaining verification

- Complete a browser login/logout with a real staging admin account.
- Replace demo data providers in separately scoped feature work.
