# Alrehla data, request/response, and cache review

Date: 2026-09-30
Scope: how pages and forms query Supabase, how commands return responses, and where data is or is not cached. This is a focused follow-up to the full application review.

## Short answer

The application currently uses this pattern:

~~~text
Server Component or client form
  -> Server Action / Route Handler / domain query
  -> Supabase server/public client
  -> Supabase Data API
  -> RLS + database constraints/triggers/RPC
  -> mapped TypeScript object or action result
  -> revalidatePath() and/or router.refresh()
~~~

The query layer works, but there is no unified query contract and no explicit shared database-query cache. The application has:

- request-scoped React memoization for only two content functions;
- Next route/full-route revalidation settings for public rendering;
- Next client Router Cache during navigation;
- in-memory React cart state;
- sessionStorage for two personalization wizards;
- localStorage for dismissing the announcement bar;
- no React Query/SWR/TanStack Query, no query-key registry, no revalidateTag, and no Redis/server cache.

The most important correction is this: revalidate = 3600 is not proof that every Supabase query is stored in a shared data cache. Most Supabase reads are made through supabase-js without an explicit fetch cache policy or cache tag. The repository should make public-query caching explicit and keep user-specific queries request-scoped.

## 1. Request entry points

### A. Public Server Component page

Example: [library/page.tsx](/Users/air/Documents/Alrehla_T-main/src/app/enha-lak/library/page.tsx:1)

~~~text
GET /enha-lak/library
  -> LibraryPage()
  -> getPersonalizedProducts()
  -> getPublishers()
  -> server renders HTML/RSC payload
  -> LibraryClient receives initialProducts and publishers
~~~

The page is a Server Component. It fetches data before rendering and passes serializable data to a client island for filtering and sorting. This is a good RSC boundary: the database query stays on the server while only local UI filtering runs in the browser.

### B. Authenticated Server Component page

Example: [account/orders/enha-lak/page.tsx](/Users/air/Documents/Alrehla_T-main/src/app/account/orders/enha-lak/page.tsx:1)

~~~text
GET /account/orders/enha-lak
  -> middleware refreshes/reads Supabase session
  -> page calls getOrders()
  -> getOrders() reads auth cookie with createClient()
  -> query includes user ownership and RLS applies
  -> page maps rows to display data
~~~

These pages are marked force-dynamic, which is appropriate for user-specific data. They should never use a shared cross-user cache.

### C. Client form / mutation

Example: [orders.ts](/Users/air/Documents/Alrehla_T-main/src/actions/orders.ts:62)

~~~text
User submits checkout
  -> client invokes createOrder()
  -> Server Action receives serialized values
  -> requireNotDependent() and requireBuyer()
  -> server validation/normalization
  -> Supabase RPC create_customer_order()
  -> database calculates price, shipping, and order items atomically
  -> action returns orderId/paymentReference
~~~

The client-side price is display state only. The database is the authority during order creation, which is the correct security model.

### D. Request/response route handler

The most important browser-facing route is [api/session/route.ts](/Users/air/Documents/Alrehla_T-main/src/app/api/session/route.ts:19).

~~~text
HeaderAccount mounts
  -> fetch('/api/session', { cache: 'no-store' })
  -> getCurrentUser()
  -> getUnreadNotificationCount()
  -> JSON { role, fullName, unreadCount }
  -> HeaderAccount renders account link and notification badge
~~~

This response is correctly marked Cache-Control: no-store, private because it is user-specific. It intentionally lets public HTML remain independent from the user's cookie/session state.

### E. Redirect route handler

[s/[...slug]/route.ts](/Users/air/Documents/Alrehla_T-main/src/app/s/[...slug]/route.ts:22) uses the public Supabase client to resolve an old/short identifier and returns a 307 redirect. It does not return page data. It should remain uncached or have a deliberately short redirect policy because product/blog slugs can change.

## 2. Supabase client layers

### Public client

[public.ts](/Users/air/Documents/Alrehla_T-main/src/lib/supabase/public.ts:19) creates an anonymous client with session persistence disabled.

Used for public data such as site settings/content, products and publishers, blog posts, and public services/instructors.

This is good because public queries do not read cookies and do not accidentally make every public page user-specific.

### Cookie-aware server client

[server.ts](/Users/air/Documents/Alrehla_T-main/src/lib/supabase/server.ts:5) calls cookies() and creates a Supabase SSR client. It is used for authenticated user/session reads, account data, dashboard queries, and Server Actions that need the current user.

Because it reads request cookies, this client must not be placed behind a shared cache without including the user identity in the cache key and proving that no private data can cross users.

### Admin client

[admin.ts](/Users/air/Documents/Alrehla_T-main/src/lib/supabase/admin.ts:20) uses the service-role key and is correctly marked server-only. It bypasses RLS and must only be reached after an explicit server-side permission check.

## 3. Query layer behavior

Query functions are spread across [src/data/domains](/Users/air/Documents/Alrehla_T-main/src/data/domains). They generally:

1. create a public or cookie-aware Supabase client;
2. execute a table query or RPC;
3. map snake_case database rows into application types;
4. return a domain object, null, or an empty array.

Example: [products.ts](/Users/air/Documents/Alrehla_T-main/src/data/domains/products.ts:38) reads active products using the public client and maps the database row into PersonalizedProduct.

Example: [orders.ts](/Users/air/Documents/Alrehla_T-main/src/data/domains/orders.ts:8) reads the authenticated user first, filters orders by user_id, then maps nested order items.

### What is good

- Public and private clients are separated.
- Important user queries include explicit owner filters in addition to RLS.
- Public product queries default to active products; inactive products require an explicit option.
- Some list queries avoid N+1 calls by fetching IDs in batches and building maps.
- Database RPCs are used where multiple rows and calculated prices must be atomic.

### Query-layer problems

#### 1. Errors and empty data have the same response

Many domain functions return [] or null both when there are genuinely no rows and when Supabase returned an error.

That produces indistinguishable states:

~~~text
No products exist          -> []
Supabase is down           -> []
RLS denied the query       -> []
Bad column/migration       -> []
~~~

The UI cannot show the correct message or decide whether to retry.

Recommended query result:

~~~ts
type QueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };
~~~

For pages where an empty fallback is intentional, convert the result at the page boundary and log the original error with a correlation ID.

#### 2. Query functions do not have a cache policy in their API

Most domain functions do not say whether the result is request-scoped only, public and time-cacheable, private and never shareable, or invalidated by a product/order/content mutation.

That policy is currently implied by which client they use and which page calls them. Put the policy beside the query function.

#### 3. getCurrentUser performs profile synchronization as part of identity reads

[auth.ts](/Users/air/Documents/Alrehla_T-main/src/data/domains/auth.ts:70) calls syncUserProfile for every authenticated user read. syncUserProfile first reads and then inserts a profile if absent. Two concurrent first requests can race on the insert.

Recommended change:

- make profile creation an idempotent database trigger or upsert with conflict handling;
- keep read-current-user separate from repair-profile;
- do not let a repair write happen on every header/session read.

#### 4. Sensitive query functions rely on callers and RLS

For example, [getMessagesForTicket](/Users/air/Documents/Alrehla_T-main/src/data/domains/account.ts:71) filters by ticket ID but does not explicitly establish that the current user owns the ticket or is support staff. RLS may correctly block unauthorized rows, but the domain API itself does not communicate its authorization requirement.

Recommended change: expose intent-specific queries such as getMyTicketMessages(ticketId) and getAdminTicketMessages(ticketId), and enforce the actor boundary before querying.

## 4. Command layer and responses

Commands are mostly Server Actions in [src/actions](/Users/air/Documents/Alrehla_T-main/src/actions). The current command pipeline is:

~~~text
serialized browser input
  -> action-level auth guard
  -> manual normalization/validation
  -> Supabase insert/update/RPC
  -> zero-row/error checks in some actions
  -> audit/notification side effects
  -> revalidatePath()
  -> return result or throw
~~~

### Response shapes currently used

The codebase mixes:

~~~ts
{ ok: true, ... }
{ ok: false, error: string }
{ success: true, ... }
{ success: false, error: string }
throw new Error('...')
undefined
~~~

[use-action.ts](/Users/air/Documents/Alrehla_T-main/src/lib/use-action.ts:82) is a compatibility layer that understands ok, success, and { error }. It improves the UI, but it also hides the fact that the server contract is inconsistent.

### Recommended command response

~~~ts
type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: string;
      message: string;
      fieldErrors?: Record<string, string>;
    };
~~~

Use code for program behavior, message for safe Arabic UI text, and fieldErrors for field-level validation. Only Next control-flow errors such as redirect/not-found should be thrown through deliberately.

### Command problems

- Some actions return raw error.message, exposing database/provider details.
- Some actions throw while similar actions return a result.
- Some required side effects are best-effort but the action still reports success.
- Some writes correctly check zero affected rows, but this is not a universal rule.
- Client forms often call router.refresh() after a successful action, but the response does not always include the updated entity needed for immediate UI state.

## 5. Cache and memory layers

### Layer A: React request memoization

Only [getSiteSettings](/Users/air/Documents/Alrehla_T-main/src/data/domains/content.ts:73) and [getSiteContent](/Users/air/Documents/Alrehla_T-main/src/data/domains/content.ts:151) use React.cache().

This prevents duplicate calls during one React server render. It is not a cross-request memory cache and is discarded after the request finishes.

It is useful for avoiding the same settings query from both root metadata and header, but it does not cache products, orders, account data, services, notifications, or dashboard lists across requests.

### Layer B: Next Data Cache / Full Route Cache

The root layout declares [revalidate = 3600](/Users/air/Documents/Alrehla_T-main/src/app/layout.tsx:35), and many private routes explicitly use force-dynamic.

The code does not use revalidateTag, unstable_cache, fetch(..., { next: { revalidate, tags } }) for database reads, a named cache-key module, or use cache/cacheTag.

Therefore the intended public-page ISR behavior is not expressed at the query level. The route may still be statically/full-route rendered where its segment allows it, but the Supabase query itself has no explicit durable cache identity or tag. This should be verified in deployment rather than assumed from the root revalidate value.

Next distinguishes persistent Data Cache from request memoization: a cached fetch can persist across requests, while React.cache() only lasts for the render request. The official Next.js caching guide also notes that non-fetch data clients may use React.cache() for request memoization, but they need an explicit strategy for persistent caching. [Next.js caching guide](https://nextjs.org/docs/15/app/guides/caching)

### Layer C: Next client Router Cache

When navigating with Link or router navigation, Next stores RSC payloads in the browser Router Cache. The application also calls router.refresh() after many mutations. That refresh invalidates the current route's client RSC payload and causes a new server render, but it is not a database query cache and does not update every route that may show the same entity.

This is why a product edit, order status change, or notification read can still leave another already-visited route stale if its path was not invalidated or refreshed.

### Layer D: application memory

[CartContext.tsx](/Users/air/Documents/Alrehla_T-main/src/context/CartContext.tsx:42) stores cart items in React state:

~~~text
tab memory only
  -> lost on hard refresh
  -> lost on browser restart
  -> not shared between tabs
  -> not shared between devices
~~~

The wizard components save temporary form progress in sessionStorage. The announcement dismissal uses localStorage. There is no persistent cart, IndexedDB cart, service-worker cache, or cross-tab BroadcastChannel synchronization.

The cart price is display state; the final customer order RPC correctly recalculates authoritative prices. That protects the database, but it does not protect user experience when a cart is lost or when a displayed price becomes stale.

### Layer E: HTTP/browser cache

The authenticated session endpoint explicitly uses no-store, which is correct. Public page responses should be inspected in the deployed environment to verify whether they are static/ISR or dynamic/private. The repository does not contain a project-level cache service or explicit CDN policy for domain data.

## 6. Cache invalidation after mutations

The application mainly invalidates by hard-coded paths:

~~~ts
revalidatePath('/account/orders/...')
revalidatePath('/dashboard/admin/orders/...')
router.refresh()
~~~

This works for known paths but is fragile. A single order update can affect the customer order list, customer detail page, admin list/detail page, provider/instructor dashboards, notification badge/list, finance/payout pages, and review counters.

The action must remember every consumer. There is no central dependency map.

Recommended domain invalidation module:

~~~ts
export const cacheKeys = {
  product: (id: string) => 'product:' + id,
  catalog: () => 'catalog',
  order: (id: string) => 'order:' + id,
  account: (id: string) => 'account:' + id,
  notifications: (id: string) => 'notifications:' + id,
};

export function invalidateOrder(orderId: string, userId: string) {
  // Central place for tags/paths affected by an order.
}
~~~

Use tags for domain data and keep path revalidation only for route-specific presentation. Return the updated row/entity from the mutation so the current screen can update without waiting for a broad refresh.

## 7. Final data-layer rating

| Area | Current rating | Reason |
|---|---:|---|
| Server-side database access | Good | Public and cookie-aware clients are separated |
| RLS/DB authority | Good direction | Important pricing/order operations use RPC/RLS/triggers |
| Query organization | Medium | Domain folders exist, but result/error contracts vary |
| Request/response contract | Needs work | ok, success, throws, and raw errors coexist |
| Persistent data cache | Weak/unclear | No explicit query-level cache tags or shared cache policy |
| Request memoization | Limited but correct | Only two content functions use React.cache() |
| Client state persistence | Weak | Cart is tab-memory only; wizard state is temporary |
| Invalidation | Medium/fragile | Many manual revalidatePath() calls, no central keys |
| Error observability | Needs work | Empty arrays often hide whether a query failed |

## 8. Recommended target architecture

~~~text
Page / Client Form
  -> typed input schema
  -> domain query or command
  -> actor + resource authorization
  -> database transaction/RPC
  -> QueryResult<T> / ActionResult<T>
  -> outbox for notifications/external side effects
  -> domain cache tags + route invalidation
  -> updated entity returned to current UI
~~~

Implementation order:

1. Standardize QueryResult<T> and ActionResult<T>.
2. Separate public cached queries from private request-scoped queries.
3. Add explicit cache tags/keys for catalog, products, orders, account, and notifications.
4. Replace silent empty-array error handling at critical query boundaries.
5. Persist authenticated cart state and merge anonymous cart state at sign-in.
6. Move required multi-row commands into database transactions/RPCs.
7. Add integration tests that prove cache invalidation and ownership behavior against a real disposable Supabase database.

## Working-tree note

At the time of this review, the checkout also contained uncommitted changes in next-env.d.ts, src/data/domains/account.ts, and src/data/domains/admin.ts. I did not modify or reset those files.
