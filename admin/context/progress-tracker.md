# Admin progress

## Current phase

First real authentication feature alongside the existing UI previews.

## Completed

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
