# Alrehla non-dashboard UI/UX and logic audit

Date: 2026-09-20  
Scope: every `src/app/**/page.tsx` except `src/app/dashboard/**`. The dashboard route tree was intentionally excluded. Account pages were included even when they import components whose names contain `dashboard`.

## Executive result

- The non-dashboard surface contains **46 page files**.
- **0/46 page files contain `"use client"`**. The pages are Server Components by default.
- Interactive behavior is isolated into client islands: forms, checkout, cart, account/session widgets, notifications, and booking/customization flows.
- The home page is a server-rendered/RSC page. It loads content and product data on the server and renders shared server UI; the root layout still adds global client islands for cart, session, navigation, announcements, and floating actions.
- The project uses shared UI primitives (`Button`, `Card`, `Section`, `RichText`, `ImagePlaceholder`, `BirthDatePicker`) but does not have a shared form system. Native HTML controls are used correctly in many places, but their styling, validation, pending state, and error presentation are repeated by feature.
- There is no React Query, TanStack Query, SWR, query-key registry, or central mutation hook. Data reads are server-side domain functions; mutations are mainly Server Actions; cache refresh is path-based and manually repeated.
- A live Google Lighthouse run was completed for the deployed site through PageSpeed Insights: 14 concrete non-dashboard URLs returned mobile scores. A broader browser smoke test covered 63 concrete non-dashboard URLs; the dashboard route tree was never opened.

## 0. Live deployment and Lighthouse report

Date: 2026-09-20  
Target: `https://alrehlat.vercel.app`  
Scope: non-dashboard routes only; every `/dashboard/*` route was excluded.

### Method and limits

- The live homepage was opened and visually checked in the user's Google Chrome session.
- Lighthouse scores were collected from Google's PageSpeed Insights runner using Lighthouse 13.4.1, emulated Moto G Power, mobile form factor, slow 4G, and HeadlessChromium 153.0.8010.36. These are real Lighthouse measurements, but they are not a local Chrome DevTools run.
- Lighthouse scores vary between runs. The table is a point-in-time mobile sample, not a deployment gate.
- 63 concrete non-dashboard URLs were browser-smoke-tested. One route returned a real 404, 17 anonymous account/order/notification requests redirected to `/sign-in`, and three customization pages had no rendered `<h1>`.

### Mobile Lighthouse scores

| Route | Performance | Accessibility | Best Practices | SEO |
|---|---:|---:|---:|---:|
| `/` | 99 | 94 | 96 | 100 |
| `/about` | 100 | 96 | 100 | 100 |
| `/enha-lak` | 100 | 94 | 100 | 100 |
| `/enha-lak/library` | 90 | 87 | 88 | 100 |
| `/creative-writing` | 99 | 98 | 96 | 100 |
| `/creative-writing/about` | 100 | 96 | 100 | 100 |
| `/creative-writing/packages` | 100 | 96 | 100 | 100 |
| `/creative-writing/instructors` | 90 | 100 | 88 | 100 |
| `/creative-writing/instructors/1b13340c-eaf2-4cc2-ac7c-a8449411b115` | 95 | 98 | 96 | 92 |
| `/creative-writing/services` | 100 | 96 | 100 | 100 |
| `/creative-writing/booking` | 100 | 85 | 100 | 69 |
| `/blog` | 100 | 94 | 100 | 100 |
| `/support` | 100 | 96 | 100 | 100 |
| `/sign-in` | 99 | 94 | 100 | 69 |

Representative homepage metrics were FCP 0.9s, LCP 2.6s, TBT 20ms, CLS 0, and Speed Index 3.9s. The strongest recurring Lighthouse findings were render-blocking requests, legacy JavaScript, image-delivery savings, one long main-thread task, unnamed links, non-sequential heading levels, browser console errors, and an accessibility tree that was not well-formed.

### Route behavior found in the live deployment

- `/blog/الصفحة-البيضاء-لماذا-يتوقف-الطفل-وماذا-يُسَاعِدُه` is linked from the blog but renders `404 - الصفحة غير موجودة`. Fix the data slug or remove/repair the link.
- `/enha-lak/custom/emotional-story`, `/enha-lak/custom/deep-sea-adventures`, and `/enha-lak/custom/custom-story-book` render a customization form but no `<h1>`. Add a route-level heading for page identity and SEO.
- `/creative-writing/services/publish-1/order`, `/creative-writing/services/publish-2/order`, and `/creative-writing/services/audio-1/order` redirect anonymous visitors to `/sign-in`; this is expected access control, but the return URL should be preserved and verified after sign-in.
- The account tree, `/notifications`, and the account support/order pages also redirect anonymous visitors to `/sign-in`. A real authenticated Lighthouse pass is still required to measure the post-login experience.
- `/creative-writing/booking/confirm` is reachable without a selected package and renders `الباقة مش محددة`; this should be an intentional guarded empty state with a clear recovery link.
- `/enha-lak/order-confirmation` is reachable without an order and renders `طلب غير موجود`; the page should explain the valid query/ownership requirements without exposing order identifiers.

### Priority actions from the live run

1. Fix the broken blog slug and add route-level `<h1>` headings to the three customization pages.
2. Repair accessibility semantics: give every icon-only link a discernible name, use sequential heading levels, connect form labels/errors with `htmlFor`, `aria-invalid`, and `aria-describedby`, and repair the accessibility tree issues.
3. Investigate the lower-scoring `/enha-lak/library` and `/creative-writing/instructors` routes first: audit their image payloads, client JavaScript, console errors, and render-blocking resources.
4. Add valid page-specific metadata for booking/sign-in/detail routes; the booking and sign-in SEO scores were 69.
5. Re-run Lighthouse on desktop and with an authenticated test account after the public fixes. Keep `/dashboard/*` as a separate admin audit.

## 1. Complete non-dashboard page inventory

Every row below has page-level status `RSC` because the page file has no `"use client"`. “Client child” means a direct imported child whose module starts with `"use client"`; `—` means the page can remain entirely server-side based on its direct imports.

| Route | Source | Page status | Direct client child / behavior |
|---|---|---|---|
| `/` | `src/app/page.tsx` | RSC | —; server data for home content, testimonials, publishers |
| `/about` | `src/app/about/page.tsx` | RSC | — |
| `/account` | `src/app/account/page.tsx` | RSC | —; account layout supplies `AccountNav` |
| `/account/bookings` | `src/app/account/bookings/page.tsx` | RSC | — |
| `/account/family` | `src/app/account/family/page.tsx` | RSC | `FamilyClient` |
| `/account/family/requests` | `src/app/account/family/requests/page.tsx` | RSC | `RequestsClient` |
| `/account/notifications` | `src/app/account/notifications/page.tsx` | RSC | —; redirect-style page |
| `/account/orders/creative-writing` | `src/app/account/orders/creative-writing/page.tsx` | RSC | — |
| `/account/orders/creative-writing/[id]` | `src/app/account/orders/creative-writing/[id]/page.tsx` | RSC | `ServiceOrderDetail`, `ReviewForm` |
| `/account/orders/enha-lak` | `src/app/account/orders/enha-lak/page.tsx` | RSC | — |
| `/account/settings` | `src/app/account/settings/page.tsx` | RSC | `ProfileForm`, `DeleteAccountClient` |
| `/account/subscriptions/box` | `src/app/account/subscriptions/box/page.tsx` | RSC | — |
| `/account/subscriptions/course` | `src/app/account/subscriptions/course/page.tsx` | RSC | — |
| `/account/support` | `src/app/account/support/page.tsx` | RSC | — |
| `/account/support/session-request` | `src/app/account/support/session-request/page.tsx` | RSC | `SessionRequestForm` |
| `/blog` | `src/app/blog/page.tsx` | RSC | — |
| `/blog/[slug]` | `src/app/blog/[slug]/page.tsx` | RSC | —; `notFound()` for missing article |
| `/cart` | `src/app/cart/page.tsx` | RSC | `CartClient` |
| `/creative-writing` | `src/app/creative-writing/page.tsx` | RSC | — |
| `/creative-writing/about` | `src/app/creative-writing/about/page.tsx` | RSC | — |
| `/creative-writing/booking` | `src/app/creative-writing/booking/page.tsx` | RSC | `BookingWizardClient` |
| `/creative-writing/booking/confirm` | `src/app/creative-writing/booking/confirm/page.tsx` | RSC | `BookingConfirmClient` |
| `/creative-writing/instructors` | `src/app/creative-writing/instructors/page.tsx` | RSC | — |
| `/creative-writing/instructors/[id]` | `src/app/creative-writing/instructors/[id]/page.tsx` | RSC | — |
| `/creative-writing/packages` | `src/app/creative-writing/packages/page.tsx` | RSC | `DependentRequestButton` |
| `/creative-writing/services` | `src/app/creative-writing/services/page.tsx` | RSC | — |
| `/creative-writing/services/[serviceId]` | `src/app/creative-writing/services/[serviceId]/page.tsx` | RSC | `DependentRequestButton`; `force-dynamic` |
| `/creative-writing/services/[serviceId]/order` | `src/app/creative-writing/services/[serviceId]/order/page.tsx` | RSC | `OrderServiceClient`; `force-dynamic` |
| `/enha-lak` | `src/app/enha-lak/page.tsx` | RSC | — |
| `/enha-lak/checkout` | `src/app/enha-lak/checkout/page.tsx` | RSC | `CheckoutClient`; `force-dynamic` |
| `/enha-lak/custom` | `src/app/enha-lak/custom/page.tsx` | RSC | `AddToCartButton` |
| `/enha-lak/custom/[productSlug]` | `src/app/enha-lak/custom/[productSlug]/page.tsx` | RSC | `PersonalizationWizard` |
| `/enha-lak/custom-library/[productSlug]` | `src/app/enha-lak/custom-library/[productSlug]/page.tsx` | RSC | `LibraryCustomizationWizard` |
| `/enha-lak/custom-subscription/[tierId]` | `src/app/enha-lak/custom-subscription/[tierId]/page.tsx` | RSC | `PersonalizationWizard` |
| `/enha-lak/library` | `src/app/enha-lak/library/page.tsx` | RSC | `LibraryClient` |
| `/enha-lak/order-confirmation` | `src/app/enha-lak/order-confirmation/page.tsx` | RSC | — |
| `/enha-lak/product/[slug]` | `src/app/enha-lak/product/[slug]/page.tsx` | RSC | `AddToCartButton` |
| `/enha-lak/publisher/[slug]` | `src/app/enha-lak/publisher/[slug]/page.tsx` | RSC | — |
| `/enha-lak/subscription` | `src/app/enha-lak/subscription/page.tsx` | RSC | — |
| `/join-us` | `src/app/join-us/page.tsx` | RSC | `JoinForm` |
| `/notifications` | `src/app/notifications/page.tsx` | RSC | `NotificationsClient`; `force-dynamic` |
| `/privacy` | `src/app/privacy/page.tsx` | RSC | — |
| `/sign-in` | `src/app/sign-in/page.tsx` | RSC | `SignInForm` |
| `/sign-up` | `src/app/sign-up/page.tsx` | RSC | `SignUpForm` |
| `/support` | `src/app/support/page.tsx` | RSC | `SupportClient`; `force-dynamic` |
| `/terms` | `src/app/terms/page.tsx` | RSC | — |

## 2. Server/client boundaries and JavaScript

### Confirmed good structure

`src/app/page.tsx` is an async server page. It calls `getSiteSettings`, `getSiteContent`, `getTestimonials`, and `getPublishers` before rendering. It does not use browser APIs, state, effects, or event handlers, so it should remain an RSC.

The root layout is also server-side, but it wraps the tree with the client `Providers` component. The global client islands are:

- `src/components/providers/Providers.tsx` → `CartProvider`.
- `src/context/CartContext.tsx` → in-memory cart state.
- `src/components/layout/HeaderAccount.tsx` → browser session request to `/api/session`.
- `src/components/layout/NavLinks.tsx` → active route state.
- `src/components/layout/AccountMenu.tsx` → menu, Escape, outside-click, sign-out.
- `src/components/layout/AnnouncementBarClient.tsx`, `FloatingActionsClient.tsx`, `ScrollToTop.tsx`.

This is a reasonable “server page + client islands” design. The main optimization question is global scope: every route receives the cart provider and header/session JavaScript, including static legal/content pages. Keep the islands that are truly global, but measure whether cart state can be scoped to commerce routes and whether the session widget can be made smaller or server-assisted without making all pages request-bound.

### Client-boundary problems

1. The cart provider is global and only stores state in React memory. A full refresh, new tab, or browser restart loses the cart. It also has no persistence/versioning or cross-tab synchronization. See `src/context/CartContext.tsx`.
2. Client form code is feature-specific rather than shared. `SignInForm`, `SignUpForm`, checkout, support, family, booking, and service order flows each own their own `useState`, pending state, and error state.
3. Some interactions use `router.refresh()` after a mutation, while others use `router.push()` or only update local state. There is no consistent post-mutation contract.
4. The global header session widget intentionally trades server knowledge for cacheability, but it still adds a client request on every route transition. The loading placeholder prevents layout shift, which is good; error fallback silently becomes “visitor,” which can hide a real session/network problem.

## 3. Queries, commands, validation, responses, and cache

### Query/read layer

Read logic is mostly centralized in server-side domain modules under `src/data/domains/` (`content`, `products`, `services`, `writing`, `orders`, `account`, `auth`, and others). Pages call these functions directly and pass serializable data into UI components.

There is no query library or client cache abstraction in `package.json` or the source: no React Query/TanStack Query, SWR, `QueryClient`, `useQuery`, `useMutation`, query-key registry, or cache-key constants.

### Command/mutation layer

Mutations are primarily Server Actions under `src/actions/` plus `src/app/actions/family.ts`. Typical flow:

1. Client island collects form state.
2. Client invokes a Server Action.
3. Action authenticates/authorizes and calls Supabase/domain logic.
4. Action returns a small result or throws.
5. Client decides whether to show an error, clear local state, refresh, or navigate.

The backend does have useful authoritative checks. For example, `createOrder` delegates order creation and price/shipping calculation to the `create_customer_order` database RPC (`src/actions/orders.ts`), while the client only submits product IDs, quantities, customization data, and shipping details.

### Response-shape problem

Response contracts are inconsistent across actions:

- `{ ok: true, ... } | { ok: false, error }`
- `{ success: true, ... } | { success: false, error }`
- `{ error: string }` from authentication actions
- thrown `Error` values for validation or database failures
- bare `boolean` results in parts of the family flow

This forces every client to remember different handling rules. Standardize on one discriminated result such as:

```ts
type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string> };
```

Use a shared `useActionFeedback`/`FormErrorSummary` helper so success, pending, field errors, and unexpected errors behave the same way.

### Client and server validation

- The multi-step personalization flows are the strongest implementation: `react-hook-form` + `zodResolver` + shared schema, step-level validation, field-to-step mapping, and an Arabic error summary in `src/components/enha-lak/PersonalizationWizard.tsx` and `personalization-schema.ts`.
- Most other forms use native `required`, `minLength`, manual checks, or server-side checks without a reusable field schema.
- Error output is usually one unassociated paragraph. No non-dashboard form scan found consistent `aria-invalid`, `aria-describedby`, or `role="alert"`/`aria-live` wiring.
- Labels frequently have no `htmlFor`, and fields have no matching `id`; this is visible in `src/components/SignInForm.tsx`, `SignUpForm.tsx`, and `src/app/support/SupportTicketForm.tsx`.
- Server actions often validate again, which is correct, but the validation language and result shape are not standardized.

### Cache and state update behavior

- Root layout exports `revalidate = 3600` for public content.
- Mutations manually call `revalidatePath()` for affected routes. This is useful but scattered across dozens of actions and easy to miss when a new reader depends on the same data.
- Some client mutations call `router.refresh()`; others navigate or update local state only.
- There is no cache tag/resource-key policy and no centralized invalidation map.
- `force-dynamic` is used on 15 non-dashboard page files, mainly authenticated/account pages and interactive checkout/service flows. This is appropriate for user-specific data, but the public page list should be reviewed so `force-dynamic` is not used merely to work around a data-access pattern.

Recommended cache model for this architecture: keep RSC reads, define resource tags such as `content:site`, `product:{id}`, `orders:user:{id}`, and `support:user:{id}`, and make each action invalidate the exact resource tags plus any affected page paths. Do not add a client query library solely to compensate for missing invalidation discipline.

### Transaction and partial-success risks

Several actions perform multiple writes or side effects without a single transaction/outbox boundary. A concrete example is `createSupportTicket` in `src/actions/support.ts`: it inserts the ticket, inserts the first message, logs a message error without failing the operation, sends an admin notification, then returns success. A ticket can therefore be reported as successful while its first message is missing.

For multi-write business operations, move the database writes into a Postgres function/transaction and use an outbox or retryable notification job for notifications. Return success only when the required business state is durable.

## 4. Shared UI versus native HTML

### Shared primitives found

`src/components/ui/` contains:

- `Button.tsx`
- `Card.tsx`
- `Section.tsx`
- `RichText.tsx`
- `ImagePlaceholder.tsx`
- `BirthDatePicker.tsx`

These are used across public pages and flows. `Button` centralizes variants, pending state, and minimum touch sizing; `Card` and `Section` provide layout/style reuse; `RichText` avoids rendering arbitrary HTML; `BirthDatePicker` is a real interactive shared control.

### Native HTML findings

Native `<form>`, `<input>`, `<select>`, `<textarea>`, and `<button>` are widespread. That is not itself a problem—native controls are preferable for semantics and browser behavior. The problem is repeated behavior around them:

- repeated Tailwind input classes;
- repeated labels without `htmlFor`/`id`;
- repeated `useState` values and manual validation;
- repeated pending/error/success handling;
- no shared field-error or error-summary component;
- no shared accessible select/file-upload/textarea patterns.

Build a small feature-agnostic form layer: `FormField`, `Input`, `Select`, `Textarea`, `FileField`, `FieldError`, `FormErrorSummary`, and `SubmitButton`. Keep native controls underneath these components.

### Naming/coupling issue

Several account pages import `DashboardPageHeader` and `SimpleDataTable` from `src/components/dashboard/*`, even though the routes are outside `src/app/dashboard/**`. The dashboard route itself was not audited, but this naming/coupling should be cleaned up: extract neutral shared components such as `AccountPageHeader` and `DataTable` into `src/components/ui` or `src/components/shared` so customer pages do not depend on an admin-oriented folder.

## 5. UI/UX and accessibility findings

### Positive patterns

- Root document sets Arabic language and RTL direction in `src/app/layout.tsx`.
- Desktop navigation uses `aria-current="page"` and visible focus rings in `src/components/layout/NavLinks.tsx`.
- Account menu has `aria-haspopup`, `aria-expanded`, a `role="menu"`, Escape handling, and outside-click close behavior.
- The home hero uses responsive aspect ratios and `next/image`; its empty decorative image alt is intentional because the adjacent heading carries the meaning.
- Blog images use meaningful alt text; public pages use `notFound()` for missing dynamic records in several places.
- The header reserves space while session state loads, reducing layout shift.
- `RichText` renders an allow-listed text format instead of injecting arbitrary HTML.

### Problems to fix

1. Form labels and fields are not consistently programmatically associated. Add stable IDs and `htmlFor` everywhere.
2. Field errors are not consistently linked to fields. Add `aria-invalid`, `aria-describedby`, and a polite/assertive live region for submit-level errors.
3. Success states often replace content without moving focus or announcing completion. Focus the success heading or add a live status region.
4. Icon-only actions need accessible names. The blog share buttons and any icon-only controls should receive `aria-label` and a tooltip/visible text where appropriate.
5. The mobile navigation links do not consistently carry the same visible focus treatment as the desktop links.
6. `BirthDatePicker` should expose `aria-expanded`, `aria-haspopup="dialog"`, a label, and a dialog/calendar name; the trigger should communicate the selected date to assistive technology.
7. Form validation is uneven: checkout and support rely heavily on native/manual checks, while the personalization wizard has much better schema-driven feedback. Consolidate the stronger pattern.
8. Run a real contrast/keyboard/mobile audit after the app can be started with representative data. Static inspection alone cannot provide reliable Lighthouse contrast or performance scores.

## 6. Loading, empty, not-found, and error UX

The non-dashboard boundary inventory finds only:

- `src/app/account/loading.tsx`
- `src/app/not-found.tsx`
- `src/app/global-error.tsx`

There are no route-level `error.tsx` boundaries for the main public, commerce, support, or account segments. Add segment-level loading/error boundaries for content-heavy and mutation-heavy areas, especially:

- `/creative-writing`
- `/enha-lak`
- `/account`
- `/support`
- `/notifications`

Many individual pages do provide empty states, such as no service providers or an empty cart, but this behavior is not a consistent page contract. Define a shared `PageState` pattern for loading, empty, error, and not-found states.

## 7. Prioritized architecture improvements

### P0 — protect correctness and user trust

- Make multi-write business operations atomic or idempotent. Start with support ticket creation, order/payment proof flows, booking transitions, and notification side effects.
- Standardize action results and do not report success when a required child write fails.
- Persist cart state with a versioned local storage schema or server-backed cart; validate the persisted shape before restoring it.

### P1 — remove repeated behavior

- Introduce shared `FormField`/`FieldError`/`FormErrorSummary`/`SubmitButton` primitives with accessible wiring.
- Define schemas once per domain and use them on the client and server. Keep database constraints/RPC validation authoritative.
- Define a resource-tag and invalidation policy; replace scattered ad hoc refresh decisions with documented invalidation helpers.
- Add `loading.tsx` and `error.tsx` at the major non-dashboard route segments.
- Extract neutral shared table/header components from `src/components/dashboard/*` for account routes.

### P2 — polish and reduce cost

- Measure the global client provider/header bundle and narrow the cart provider if it is not needed on content/legal routes.
- Add accessible names and focus management to icon-only controls and multi-step success/error transitions.
- Add automated route checks for page-level RSC status, form accessibility attributes, and mutation result contracts.
- Re-run Lighthouse on a production build with public seed data and an authenticated test account once Antigravity quota or another Lighthouse runner is available.

## 8. Delegated Codex logic findings

The Codex read-only logic audit confirmed the RSC/client inventory and found these additional route and business-logic risks:

### Authentication and authorization

- `/enha-lak/checkout` has an ineffective visitor guard. `getCurrentUser()` returns a visitor object, so `if (!user) redirect(...)` is unreachable. Anonymous users see checkout and are rejected only later by the action. Fix with an explicit visitor check or `requireUser()`.
- Service-order, notification, and middleware redirects lose the original destination. Preserve an internal callback path through sign-in.
- `/auth/callback` accepts an arbitrary `next` value and passes it to `new URL(next, requestUrl.origin)`, allowing an external redirect target. Restrict it to internal paths.
- The callback points failures to `/auth/auth-code-error`, but no matching page exists.
- Some account data queries rely on live Supabase RLS rather than explicit user filters. High-risk examples include box subscriptions filtered by full name, course subscriptions filtered after retrieval, sessions not scoped in the domain query, ticket messages filtered only by ticket ID, and service-order messages checked only for authentication. Verify these against the live policies and add explicit ownership checks where possible.

### Mutation correctness and validation

- Booking creation writes the preferred slot after the booking RPC; slot-write failure can leave a booking without the requested slot.
- Booking payment confirmation activates the subscription before inserting sessions; session insertion failure can return success with zero sessions.
- Service delivery writes a delivery message before updating status; service completion writes payout state after completion; support ticket creation writes the ticket and first message separately. These require a transaction/RPC or an outbox/retry strategy.
- `signIn()` and `signUp()` cast raw `FormData` without a server schema. `signUp()` ignores profile-insert failure. Family, support-session, and payment inputs also need runtime validation beyond TypeScript/native HTML checks.
- `NotificationsClient`, family deletion, profile/deletion forms, session requests, and some payment/order flows do not consistently catch action failures or reset pending state, producing stale or permanently busy UI.

### Confirmed route behavior gaps

- `/support`: search has no filtering logic; WhatsApp is a dead button; use a smaller server page plus focused client islands.
- `/account/support`: “new ticket” points to `#` and is a no-op.
- `/blog/[slug]`: share buttons have no action/URL; metadata and page fetch the same post twice; the cover image sizing should be explicit.
- `/enha-lak/library`: print filtering is a no-op and “newest” sorts by ID instead of creation date.
- `/enha-lak/product/[slug]` only resolves platform-owned products while publisher pages expose publisher products, so some publisher links can lead to a missing-product route.
- `/enha-lak/order-confirmation`: every status except `awaiting_verification` is displayed as paid; map every status explicitly.
- `/account/subscriptions/box`: full-name filtering is fragile; use the authenticated profile ID.
- `/join-us`: admin notification is called twice per submission.
- `/creative-writing/services`: provider loading is N+1; batch providers. Metadata/page pairs also duplicate several domain reads across blog, instructor, service, product, and publisher pages.

## 9. Verification and delegated-agent status

Local inspection commands included route inventory, page-level `use client` scan, client-boundary import scan, shared UI/native-control scan, cache/mutation scan, and action/result-shape scan.

`npx tsc --noEmit --incremental false` passed in the delegated Codex run. The initial `npm run typecheck` attempt failed before source checking because the unbuilt checkout lacks `.next/types`; that was an environment/generation issue, not a confirmed source error. Codex's Vitest run hit read-only environment errors creating temporary directories. The project is not a Git worktree at this path.

Antigravity attempts:

1. Original UI/UX + Lighthouse brief: blocked by headless command permission before inspection.
2. Isolated temporary-copy retry with auto-approval confined to the copy: report stream interrupted before completion.
3. Concise UI/UX and Lighthouse retries: provider returned `RESOURCE_EXHAUSTED` / “Individual quota reached,” with a reported reset window of roughly 158 hours. No Lighthouse score was available.
4. Lighthouse-only retry in a sandboxed temporary copy: provider returned the same `RESOURCE_EXHAUSTED` quota error before Antigravity could start the audit.
5. Explicit `agy --agent claude` Lighthouse retry: Claude agent was accepted, but the provider returned `RESOURCE_EXHAUSTED (429)` before Lighthouse execution; reported reset window was roughly 158 hours.
6. Codex Lighthouse audit: all 46 non-dashboard routes were inventoried, but **0 URLs were tested**. No local server was reachable; `next build` failed fetching Cairo from `fonts.googleapis.com`; starting a server failed with `listen EPERM`; the declared Vercel URL failed DNS; and Lighthouse/Playwright/Puppeteer tooling was unavailable. No scores or metrics were claimed.

Therefore this report contains confirmed source findings only and explicitly does not claim Lighthouse scores.
