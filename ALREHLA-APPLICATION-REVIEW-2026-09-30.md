# Alrehla application review

Date: 2026-09-30  
Scope: current repository checkout, including public pages, account/commerce flows, server actions, data access, authentication, authorization, database scripts, forms, cache invalidation, and shared UI. Dashboard routes were included only where they affect shared architecture or security.

## Executive result

The application has a good foundation, but it is not yet consistently production-safe across every flow.

What is working well:

- All page files are Server Components. There are 141 `page.tsx` files; 90 are under `dashboard` and 51 are outside it. None of the 51 non-dashboard page files contains `"use client"`.
- Critical pricing and order creation are calculated or protected on the server/database instead of trusting form values.
- Supabase SSR sessions, centralized auth guards, RLS, security-definer functions, audit logging, suspended-account checks, and temporary-password handling are present.
- TypeScript passes, lint passes, and the test suite currently passes 22 files / 269 tests.
- Recent UI work improved image handling, contrast, and animation cost.

Main conclusion: the next priority is not adding more page features. It is making the existing layers use one predictable contract and making multi-step business operations atomic and recoverable.

## Verification performed

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test -- --run` | Pass: 22 files, 269 tests |
| `npm run lint` | Pass, with warnings: `next lint` is deprecated and Next inferred a workspace root because multiple lockfiles exist |
| `npm run build` | Fails during prerender of `/sitemap.xml` and `/terms` because `supabaseUrl is required` when this checkout has no environment file |
| Current commit | `5b45f41` |

The build compiled successfully before prerendering. This is partly environment configuration, but it also exposes coupling between static rendering/root metadata and Supabase configuration. The CI workflow hides this by supplying placeholder Supabase variables. Local production builds should fail early with a clear environment diagnostic or use a safe build-time fallback.

The previous live Lighthouse/browser report is dated 2026-09-20. It is not treated as a current performance measurement for this review because the repository has changed since then.

## Current request-to-database architecture

The effective flow is:

```text
Browser page
  -> client component or native form
  -> Server Action in src/actions or app/actions
  -> Supabase server client / RPC
  -> RLS, constraints, triggers, security-definer function
  -> revalidatePath and sometimes router.refresh()
  -> Server Component renders fresh data
```

Queries are primarily direct Supabase reads in `src/data/domains` and page loaders. Commands are mostly Server Actions in `src/actions`. There is no React Query, SWR, TanStack Query, or shared query-key registry.

This is a valid Next.js architecture, but it is currently a collection of conventions rather than a single platform contract. Different actions return different shapes, use different guards, use different validation depth, and invalidate different paths manually.

## Layer 1: database and data integrity

### Strengths

- The application correctly treats the database as authoritative for important values. Customer order creation goes through a database RPC, and service-order pricing is calculated from approved database offers rather than from the browser.
- RLS and security-definer RPCs are used for sensitive operations such as customer orders, course bookings, and instructor earnings.
- Database triggers and permission revocations protect fields that ordinary row-level policies cannot safely protect.
- The code checks for zero-row updates in several important mutations. This prevents a false success when RLS or a trigger prevents a write.

### Problems

#### P0: database history is not reproducible

There is no `supabase/migrations` directory. The repository has 107 files under `supabase/sql`, including numbered patches, diagnosis scripts, cleanup scripts, and schema changes. The README describes `supabase/migrations` as authoritative, but that directory is absent.

Why it matters:

- A new environment cannot reliably recreate the production schema.
- The order of SQL execution is implicit.
- Diagnosis or cleanup SQL can be mistaken for a deployment migration.
- CI cannot prove that a fresh database matches production.

Fix:

1. Take a schema-only dump of the real database.
2. Create a clean Supabase migration baseline.
3. Convert every still-required numbered SQL change into ordered migrations.
4. Keep diagnosis/data-repair scripts outside the migration directory and label them explicitly.
5. Add CI that resets a disposable database and applies every migration.

#### P1: documentation is not a reliable schema source

`README.md`, `docs/architecture/AL-REHLA-DATABASE.md`, and `docs/DATABASE_SCHEMA_V2.md` disagree with each other and with current code. Examples include the active `user_profiles` model versus legacy `profiles`, children being described as non-auth users while current code creates student auth accounts, and Cloudinary/Daily being described as future integrations although code already uses them.

Fix: designate one generated/current schema document, add the migration version and date to it, and mark old documents as historical. Do not keep two competing ERDs as if both were current.

#### P1: important business operations are only partly transactional

The following operations can leave a valid-looking partial state:

- Course booking RPC succeeds, then preferred slot is updated separately and failures are logged.
- Course consent is updated after booking. If that update fails, the booking remains but is sent to an admin review queue.
- Support ticket creation inserts the ticket and then inserts its first message separately. A first-message failure is logged, but the action still returns success.
- Service-order delivery changes the order to `delivered`, then inserts the delivery message. If the message insert fails, the customer sees a delivered order without the required delivery message.
- Service-order completion changes the order to `completed`, then records instructor earnings in a separate RPC. The repair notification is useful, but the financial state is not atomic.
- Student-account creation uses several Auth/admin/database steps and compensating deletion rather than one durable transaction.

Fix: move each business transition into a database RPC or durable workflow that performs the state change, dependent rows, and idempotency check together. Use an outbox/retry table for notifications and external side effects.

#### P1: notification writes can report success when nothing was written

`markNotificationRead` and `markAllNotificationsRead` ignore Supabase update errors and always return `{ ok: true }` after authentication. This can leave the unread badge stale while the UI tells the user the operation succeeded.

Fix: select the updated row/count, handle errors, and return a standard failure result. Invalidate the notification badge only after a confirmed write.

## Layer 2: commands and queries

### Strengths

- Server Actions keep credentials and business decisions off the browser.
- Many mutations recalculate ownership, price, role, or status from server-side data.
- `use-action.ts` gives client components a common mechanism for pending/error handling and understands both `ok` and `success` results.

### Problems

#### P1: action result contracts are inconsistent

The codebase mixes:

- `{ ok: true, ... }` / `{ ok: false, error }`
- `{ success: true, ... }` / `{ success: false, error }`
- thrown `Error` values
- raw database error text
- silent or best-effort side effects

Why it matters: every form has to know a different contract. A thrown error can escape a client flow, a returned error can be shown as a form message, and a raw PostgREST message can leak implementation details.

Fix: define one shared type, for example:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string> };
```

Use typed domain errors internally, map them to safe Arabic user messages centrally, and log the database/provider details only on the server.

#### P1: raw database messages still reach users

Several actions return or interpolate `error.message`, including parts of booking, provider, portfolio, admin-user, and other mutations. Database messages can expose table names, policy behavior, or internal implementation details and produce inconsistent Arabic UX.

Fix: replace client-facing database text with stable error codes/messages. Keep the original error in structured server logs with a request/correlation ID.

#### P1: product save has an unsafe owner-type boundary and a runtime defect risk

`saveProduct` casts `ownerType` directly from `FormData` to `'platform' | 'publisher'` without validating the enum. It also sends `metadata: { name }` even though the local validated value is `checked.data.name`; the unbound identifier is a runtime defect risk and should be replaced with `checked.data.name`.

Fix: validate `ownerType` with an enum schema, reject invalid combinations before any database call, and use the validated local value in the audit record.

#### P1: service-order messaging trusts a client-controlled delivery flag

`sendServiceOrderMessage(orderId, body, isDelivery = false)` writes `is_delivery` from a browser-supplied boolean. The same flag also controls whether the customer notification is sent. A client must not choose whether a message is a system delivery message or suppress its notification.

Fix: split this into separate server functions or derive the message type from the authenticated role and server-side transition. Only the delivery transition may create a delivery message. Put the invariant in the database as well.

#### P1: support ticket creation can return false success

`createSupportTicket` returns success when ticket creation succeeds even if the first message insert fails. The user is told the ticket exists, but support may see no opening message.

Fix: use a single RPC/transaction for ticket plus first message, or mark the ticket as incomplete and return a recoverable error. Do not silently continue for a required child write.

## Layer 3: validation and database constraints

Validation exists at several levels, but the coverage is uneven.

```text
Browser required/type checks
  -> selected Zod schemas / custom checks
  -> Server Action validation
  -> RLS and authorization
  -> database NOT NULL / CHECK / FK / trigger / RPC validation
```

The important rule is correct: browser validation is convenience only; the action and database must validate again. The problem is that there is no single schema source for most fields.

Current gaps:

- Support session requests validate phone format but do not enforce clear maximum lengths for contact name/message and have no visible rate-limit/CAPTCHA protection for a public endpoint.
- Support ticket subject/message validation checks non-empty values but not maximum lengths or a category allowlist.
- Several FormData fields are cast directly to strings or union types.
- Some authorization depends entirely on RLS rather than an explicit server-side ownership check, making behavior harder to review and test.
- Database constraints cannot be audited completely from this repository because the actual schema is not represented in a migration chain.

Fix: create shared Zod schemas for every command input, use the same schemas for client hints and server enforcement, and keep database constraints as the final invariant. Add maximum lengths and enum validation to all user-controlled text/state fields.

## Layer 4: forms and field UX

### Current state

- `react-hook-form` and Zod are used well in the Enha Lak wizards.
- There is a shared `FormError` / `FormSuccess` / `FormNotice` component with screen-reader roles.
- Most forms are still native inputs with feature-specific state and validation.
- There is no complete shared field component that standardizes label, hint, error, `id`, `aria-invalid`, and `aria-describedby`.

### Problems

#### P1: form validation is not consistently accessible

In `Step1ChildInfo`, labels are not associated with explicit input IDs, and validation messages are rendered as ordinary `<div>` elements rather than the shared alert component. In `Step2CoverDetails`, the label/error wiring is also incomplete: the error is not linked to the textarea with `aria-describedby`, and the label has no `htmlFor`/matching ID.

This means a sighted user may see the error while a keyboard or screen-reader user may not understand which field failed.

Fix: create a shared `FormField` component and require every field to render:

```tsx
<label htmlFor={id}>...</label>
<input id={id} aria-invalid={Boolean(error)} aria-describedby={errorId} />
<p id={errorId} role="alert">...</p>
```

#### P1: no single form architecture

The app mixes native browser validation, local React state, custom hooks, server actions, `react-hook-form`, and different success/error conventions. This increases regression risk and makes the form behavior different from page to page.

Fix: standardize new forms on: schema -> `react-hook-form` for interactive multi-field flows -> Server Action -> `ActionResult` -> shared status/field components. Keep simple native forms only when they still use the same server schema and result contract.

## Layer 5: authentication, authorization, and permissions

### Strengths

- Supabase SSR session handling is present in `src/lib/supabase/server.ts`.
- `src/lib/auth-guard.ts` centralizes `requireUser`, admin permissions, instructor checks, dependent/guardian rules, and suspended-account checks.
- Middleware protects dashboard/account routes and redirects unauthenticated users.
- Password reset uses a unified notice, reducing account enumeration.
- Database RLS and security-definer functions provide an important second authorization layer.

### Problems

#### P1: middleware defaults a missing profile to customer

If the authenticated user's `user_profiles` lookup fails or returns no row, middleware assigns the role `customer`. A database outage or profile synchronization problem can therefore produce incorrect routing instead of a clear availability failure.

Fix: distinguish `profile not found` from `profile lookup failed`; fail closed for protected role routes, refresh/synchronize the profile through a controlled path, and return a safe error page when identity state cannot be established.

#### P1: account protection is mostly middleware-dependent

`src/app/account/layout.tsx` calls `getCurrentUser()` but does not itself redirect a visitor. That is acceptable as a first gate only while the matcher is correct. Server-side layouts should also enforce `requireUser`/`requireBuyer` so an internal render, future matcher change, or alternate entry point cannot bypass the account boundary.

#### P1: several sensitive reads/writes rely on RLS without explicit intent checks

RLS is good defense in depth, but important commands such as ticket replies and service-order messages should explicitly verify the actor's relationship to the resource before attempting the insert. This produces clearer behavior, safer logs, and tests that do not depend on a policy silently rejecting the request.

#### P1: public support request has abuse exposure

`submitSupportSessionRequest` accepts unauthenticated submissions. It has phone validation but no visible length limits, rate limiting, spam protection, or duplicate throttling. This can be used to flood the support queue and admin notifications.

Fix: add an edge/server rate limit keyed by IP plus normalized phone, a honeypot or CAPTCHA where appropriate, input limits, and notification deduplication.

## Layer 6: transactions and side effects

The strongest atomic path is customer order creation through a database RPC. The weakest paths are operations that combine a status update, child row, notification, audit record, or external provider call in separate requests.

Use this rule:

```text
Database state transition + required database rows = one transaction/RPC
Notifications, email, video rooms, and other external work = outbox/retry job
```

Do not make a user repeat a successful payment/status transition because a notification failed. Do not tell a user an operation succeeded when a required child row failed.

## Layer 7: cache, invalidation, and state updates

### Current behavior

- Root layout exports `revalidate = 3600`.
- Content queries use React `cache()`, which is request-scoped memoization, not a shared application cache.
- Mutations manually call `revalidatePath()` for affected pages.
- Client components often call `router.refresh()` after a mutation.
- There is no `revalidateTag`, shared cache-key registry, React Query, SWR, or mutation/query invalidation abstraction.

### Problems

- Invalidation lists are scattered across actions and can easily miss a related page.
- A mutation can update a notification, account header, dashboard list, and detail page but invalidate only some of them.
- `router.refresh()` is used as a broad repair mechanism rather than as part of a predictable mutation contract.
- The global cart is in-memory React state only. A refresh, new tab, browser restart, or device change loses it. There is no persistence, cross-tab synchronization, schema versioning, or server cart recovery.

Fix:

1. Define domain cache tags such as `product:{id}`, `catalog`, `order:{id}`, `account:{id}`, and `notifications:{userId}`.
2. Put all invalidation in domain functions, not in every UI action.
3. Return the updated entity or a canonical summary from mutations so the client can update immediately.
4. Persist authenticated carts server-side; use a versioned local cart for anonymous users and merge it at sign-in.
5. Keep database/RPC pricing authoritative at checkout, as the app already does.

## Layer 8: Server Components, client JavaScript, and boundaries

### Positive finding

The app does not put `"use client"` on page files outside dashboard. This is the right default for the home/public/account route layer. Interactive behavior is pushed into nested client components.

### Remaining issues

- The root layout mounts global client providers and client islands for the cart, header/session behavior, navigation, announcement, floating actions, and scroll behavior. This means every route pays some hydration cost even when it does not need commerce state.
- The cart provider is global although the cart is relevant only to commerce flows. Scope it to routes that need it if the header can be made a smaller client island.
- There are 21 non-dashboard pages with `force-dynamic`. Each should be reviewed individually; public content should not become dynamic merely because a shared layout reads user/session data.
- 14 account pages have no `generateMetadata`, so titles and robots behavior are inconsistent. Add segment metadata, normally with `robots: { index: false }` for private pages.
- There are no route-level `error.tsx` boundaries for public, commerce, or account sections. The app has a global error boundary and dashboard/admin boundaries, but a recoverable checkout/account failure can still fall to a generic global screen.
- Account and public pages import components from `src/components/dashboard`. Shared elements such as page headers and data tables should move to a neutral shared component area so the public/account layer does not depend on admin naming and folder structure.

## Layer 9: shared UI and UX

### Strengths

- Shared UI primitives exist for buttons, cards, sections, form messages, avatars, rich text, images, and reveal effects.
- The latest UI commit removed layout-affecting `transition-all`, improved text contrast, and stopped cover images from being cropped.
- Server-rendered page content gives a good baseline for no-JavaScript access and SEO.

### Problems

- The cart header control is 40x40 pixels, below the 44x44 storefront touch-target recommendation, and its changing item count is not in an `aria-live` region.
- The project still uses many native `<input>`, `<select>`, and `<textarea>` elements directly, so focus, error, hint, and disabled/pending behavior varies by feature.
- Form error wiring is inconsistent even though a shared `FormError` exists.
- No current Lighthouse run is included in this review. The 2026-09-20 snapshot was strong overall, but route-specific accessibility/performance regressions must be rechecked after the latest UI commit.

## Release and security hygiene

### P1: package manager and lockfile policy are inconsistent

CI says Bun and `bun.lock` are authoritative, while the repository also contains `package-lock.json`, package scripts use `npm`, and local lint warns because multiple lockfiles cause workspace-root inference ambiguity.

Fix: choose Bun or npm, remove the other lockfile from the repository, use the same package manager in local scripts, CI, and Vercel, and explicitly set the Next workspace root if needed.

### P1: CSP is report-only

Security headers are a good improvement, but the Content Security Policy is sent as `Content-Security-Policy-Report-Only` and includes `unsafe-inline` and `unsafe-eval`. It records violations but does not block them.

Fix: collect and review violations in preview, then enforce CSP with nonces/hashes and remove `unsafe-eval` from production if possible. Keep third-party sources explicit.

### P1: build configuration is not self-describing

Only `.env.example` is present in this checkout. The production build currently fails without the public Supabase variables, while CI supplies placeholders. Add an explicit environment validation module and a documented `build:ci` path. Static routes should not unexpectedly require live database configuration unless that dependency is intentional.

## Recommended implementation order

### Immediate

1. Fix `saveProduct` to use the validated name and validate `ownerType`.
2. Split delivery messages from ordinary service messages and derive delivery state on the server.
3. Make support ticket plus first message atomic; add length limits and rate limiting to public support.
4. Make notification mutations check errors and return real failure states.
5. Make middleware fail closed on profile lookup errors and add an explicit account-layout guard.
6. Standardize the package manager and make the production build reproducible with documented environment validation.

### Next

1. Establish `supabase/migrations` from the real schema and add migration CI.
2. Add a shared `ActionResult`, domain error mapper, and correlation-ID logging.
3. Create shared Zod command schemas and accessible `FormField` primitives.
4. Add route-level error/loading boundaries for public, commerce, and account segments.
5. Introduce domain cache tags/invalidation and a persisted cart strategy.

### After that

1. Move multi-step booking/service/student-account operations into atomic RPCs or durable workflows.
2. Add end-to-end tests for sign-in, cart/checkout, booking/payment proof, support tickets, service delivery, and role boundaries.
3. Enforce CSP after preview validation.
4. Refresh the schema/architecture documentation from the migration source of truth.
5. Run a new mobile and desktop Lighthouse pass on every non-dashboard route after the next UI release.

## Final assessment

The application is structurally promising and has already corrected several serious issues: server-side pricing, stronger guards, RLS-backed operations, zero-row mutation checks, safer password flows, and a server-first route tree. It should not yet be called fully hardened because the same business rule is often split across the browser, action, database, notification, and cache layers without one atomic contract.

The highest-value architectural change is to make every mutation follow one predictable pipeline:

```text
typed input schema
  -> authenticated actor + explicit resource authorization
  -> one atomic domain command
  -> safe ActionResult<T>
  -> outbox for side effects
  -> centralized cache tags
  -> focused client state update
```

That change will solve more of the current problems than adding more individual checks to individual pages.
