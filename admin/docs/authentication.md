# Admin sign-in

The admin uses its existing shadcn UI with Refine's `useLogin` and a Supabase auth provider. The form follows the shared TanStack `useAppForm` pattern: `form.AppField` renders `Fields.Input`, and `form.SubmitButton` tracks the awaited login request. Open `/sign-in`. Labels, validation, loading feedback, and errors are Arabic; the email and password controls use LTR direction inside the RTL page.

## Configuration

Install with `pnpm install`, copy `.env.example` to `.env.local`, and supply the staging project's publishable key. The current staging project is `nznfawbcgfwpftbiqima` (ahmed). Vite exposes only the `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` variables used by the browser adapter. Never put a secret or service-role key in a `VITE_` variable. Restart Vite after changing environment values.

## Flow

1. The form validates with Zod and calls Refine `useLogin`. Email is trimmed and lowercased; the password is preserved exactly.
2. Supabase authenticates with `signInWithPassword`.
3. The provider reads the authenticated user's `user_profiles` row and accepts only `super_admin` or `general_supervisor` with no `archived_at` value. A rejected or unreadable profile fails login and requests local-session sign-out.
4. Successful login opens `/theme`, the existing UI preview. The app does not accept an arbitrary post-login URL.
5. Root-route checks verify the user through `getUser` and read the profile before allowing navigation. Signed-out and unauthorized visitors go to `/sign-in`; an already authorized admin opening sign-in goes to `/theme`.
6. Logout revokes the current Supabase session and returns to sign-in. Sign-out events invalidate the route, including sign-out in another tab.

The browser keeps the session under the dedicated `alrehla-admin-auth` storage key. There is no separate sign-up, password reset, or remember-me control.

The shared browser client now lives in `src/providers/supabase-client.ts`; authentication and the root data provider use the same session and refresh process. See [Data provider](data-provider.md) for ownership and demo isolation.

## Google sign-in

The Google button calls Refine `useLogin({ providerName: "google" })` independently of the password fields. The adapter checks the project's public auth settings and displays an Arabic error if Google is disabled. Otherwise it starts Google OAuth with PKCE and an account chooser, then returns to `/auth/callback` on the same admin origin. Only ordinary profile/email access is requested; no Gmail or Drive scopes are added.

The callback is reachable before login so it can exchange the one-use code. It then verifies the Supabase user and reads that user's database profile, applying the same role and archival rules as password login. A rejected profile is signed out locally. Repeated callback processing in the same page shares its original promise so the code is not exchanged twice. An expired exchange does not clear an unrelated existing session. Callback failures display an Arabic message and a link back to sign-in; they never display raw provider errors or infer a role from Google metadata.

As checked on October 23, 2026, Google is disabled in staging. In the staging Supabase dashboard, enable the Google provider and configure its Google OAuth client ID/secret. Keep that secret in Supabase rather than the Vite frontend. Add the exact admin callback URLs to Supabase Authentication → URL Configuration → Redirect URLs:

- `http://localhost:4173/auth/callback`
- `http://127.0.0.1:4173/auth/callback`
- The deployed admin origin followed by `/auth/callback`, when known.

Google Cloud's OAuth client must allow the Supabase callback `https://nznfawbcgfwpftbiqima.supabase.co/auth/v1/callback`. This differs from the app callback above. See [Supabase's Google sign-in setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

Supabase may create a normal auth account/profile for a first-time Google identity, depending on its signup settings. This frontend never creates an admin role; an authorized administrator must already have assigned one in the database.

The root guard controls navigation. Supabase RLS and guarded RPCs remain responsible for authorizing database operations. Product and other data views still use their existing in-memory preview providers; this change does not connect those views to live application data. Suspension currently represents a purchase restriction in the existing application, so this sign-in guard uses role and archival status rather than treating `suspended_at` as a general login ban.

## Verification

Run `pnpm typecheck` and `pnpm build` from `admin/`. Current regression checks live in `tests/auth-provider.test.ts` and `tests/data-provider.test.ts`, using Node's test API and the existing TypeScript loader documented in [Data provider](data-provider.md). They cover admin access, denied profiles, read failures, missing configuration, logout, duplicate callback exchange, shared-client wiring, and local demo isolation. The earlier auth test file referenced in historical progress notes was absent when the data-provider change began.

In the browser, visit a protected preview URL while signed out: it should open sign-in. Submit empty or invalid fields, toggle password visibility, and verify the loading state during a request. Test a valid staging admin account to confirm the successful transition to `/theme`, then sign out. This requires an actual staging account; mocked provider checks do not prove a real credential login succeeds.
