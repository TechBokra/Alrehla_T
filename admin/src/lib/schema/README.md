# Admin validation schemas

Import schemas and inferred types from `@/lib/schema`. This folder contains the validation contracts for the legacy admin feature families, reviewed against `client/src/lib`, `client/src/actions`, and the admin navigation. It has no request, React, provider, environment-variable, or database-write code.

## Public interfaces

- `adminResourceSchemas`: editable form contracts indexed by actual staging table names. Table names are checked against the generated `Database` type. A resource can have different create, edit, and action contracts; a table entry is not permission to perform arbitrary CRUD.
- `adminActionSchemas`: named operations grouped by feature. Orders, moderation, payouts, and other workflow changes use commands rather than a generic status-editing form.
- `adminReadSchemas`: shared search/pagination inputs for read views. These are not complete response schemas or a complete set of resource-specific filters.
- `AdminResourceFormInput<R>` / `AdminResourceFormValues<R>` and `AdminActionInput<R, A>` / `AdminActionValues<R, A>` infer input and parsed output types from the same schema.

```ts
import { adminResourceSchemas, adminActionSchemas } from "@/lib/schema";
import type { AdminResourceFormValues, AdminActionValues } from "@/lib/schema";

type PackageValues = AdminResourceFormValues<"creative_writing_packages">;
type FulfilmentCommand = AdminActionValues<"orders", "fulfilment">;

const packageResult =
  adminResourceSchemas.creative_writing_packages.safeParse(input);
const orderResult = adminActionSchemas.orders.fulfilment.safeParse(command);
```

These registries do **not** register Refine resources or enable pages. Products and add-ons remain the only live catalog resource pages. Authentication and current catalog consumers retain their existing schemas. New contracts are available for future feature forms; they are not wired to the legacy application.

## Modules and reviewed sources

All paths below are relative to `client/src/`.

| Module                | Contracts                                                                                                                                                                          | Source                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`             | Password/Google authentication                                                                                                                                                     | Existing admin authentication contract                                                                                                                                                 |
| `catalog.ts`          | Existing platform product/add-on form fields                                                                                                                                       | `lib/product-input.ts`, `actions/addons.ts`, existing admin forms                                                                                                                      |
| `people.ts`           | User creation/invitation/roles/password/suspension/deletion; admin roles; instructor profiles, training, certification, packages and media; provider details/offers; join requests | `actions/admin-users.ts`, `admin-permissions.ts`, `admin-instructors.ts`, `instructors.ts`, `providers.ts`, `join-requests.ts`, `account-deletion.ts`; `lib/instructor-media-input.ts` |
| `catalog-settings.ts` | Customization fields, story goals, dialects, promotions, discount codes, review decisions, ordered IDs                                                                             | Corresponding `lib/` validators and `actions/products.ts`                                                                                                                              |
| `shipping.ts`         | Rates, country/governorate settings, delivery pause and rate adjustments                                                                                                           | `lib/shipping.ts`, `actions/shipping.ts`                                                                                                                                               |
| `learning.ts`         | Writing packages, box plans, creative services, booking assignment/cancellation, sessions/change requests                                                                          | `actions/writing.ts`, `box-plans.ts`, `standalone-services.ts`, `bookings.ts`, `admin-sessions.ts`, `session-change-requests.ts`; `lib/service-details.ts`, `private-files.ts`         |
| `orders.ts`           | Fulfilment/electronic delivery, box shipment/subscription, service-order closure/cancellation/refund/deadline                                                                      | `actions/admin-orders.ts`, `box-subscriptions.ts`, `service-orders.ts`                                                                                                                 |
| `finance.ts`          | Payout confirmation, withdrawal decisions, pricing formulas                                                                                                                        | `actions/finance.ts`, `withdrawals.ts`, `instructors.ts`                                                                                                                               |
| `content.ts`          | Blog, testimonials, ads, page content, site images, notifications, media selection                                                                                                 | `actions/blog.ts`, `content.ts`, `notifications-admin.ts`, `media.ts`; `lib/ads.ts`                                                                                                    |
| `community.ts`        | Support replies/status, review visibility, Aqlam moderation/report/sanction/guardian/pin/settings                                                                                  | `actions/support.ts`, `reviews.ts`, `aqlam.ts`; `lib/aqlam/post.ts`                                                                                                                    |
| `aqlam-config.ts`     | Content/daily limits, moderation, feature toggles, categories/reactions/reasons, filters, copy, blocked words                                                                      | `lib/aqlam/config.ts`: field limits, list parsers, cross-field relationships                                                                                                           |
| `workflow.ts`         | Assignment rules, task priority/deadline/note, task steps, box lead time, studio stage/edges/routes                                                                                | `actions/work-tasks.ts`, `studio-flow.ts`; `lib/work-tasks.ts`, `box-schedule.ts`                                                                                                      |
| `studio.ts`           | Project brief/assignment/version/page/review/consent/character/QA/cost/transition                                                                                                  | `actions/studio.ts`, `lib/studio.ts`, `lib/age-bands.ts`                                                                                                                               |
| `settings.ts`         | Partial general settings, retention, watermark, transfer details                                                                                                                   | `actions/content.ts`, `payments.ts`; `lib/watermark-settings.ts`                                                                                                                       |
| `common.ts`           | IDs, finite money, URLs, Cairo local calendar inputs, ISO instants, common list/action inputs                                                                                      | Shared validation primitives; no defaults for business state                                                                                                                           |

## Form and payload boundaries

1. Feature models own defaults, record-to-form mapping and explicit create/update payload allowlists. Validation does not turn camelCase commands into database payloads. Never pass a whole form directly to `.update()`.
2. Existing catalog forms keep numeric strings. New domain contracts generally accept normalized numbers and booleans, matching server command values. A future `useAppForm` adapter must explicitly convert numeric text, map empty selections to null where required, and then parse. No `z.coerce.number()` converts an empty price to zero.
3. Optionality is explicit per contract. Omitted general settings are preserved. Generic partial schemas are not exposed for orders or other workflow rows. Blank password means generate a temporary password in the authorized server action, not in this layer.
4. `YYYY-MM-DDTHH:mm` is a Cairo wall-clock value; validation does not convert it using the browser timezone. The server must convert using the existing Cairo helpers. Studio assignment deadlines are date-only; task deadlines are ISO instants with an offset.
5. Existing catalog/auth behavior stays unchanged. New contracts reject malformed URLs/calendar dates and fractional integer fields rather than silently truncating or normalizing invalid input as some legacy actions do. This is an explicit validation difference for future forms. Existing client actions have not been replaced.
6. Some contracts deliberately have less information than a complete resource: private-file commands expose an ID only, publisher listings expose read inputs, and notification/content keys remain server-validated allowlists. Provider locators, secrets, lifecycle leases, payment amounts and actor identities are not editable fields.
7. Local demo/prototype schemas remain isolated. A schema registry entry does not connect a demo to staging.

## Required server checks

Zod validates input shape and local field relationships. Existing server authorization, RLS, RPC transactions and triggers remain authoritative for:

- Permission to create an admin role, assign a privileged role, suspend/delete an account, moderate a child’s content, send a broadcast, or access private files.
- Parent ownership/state, current payment verification, valid order transitions, duplicate requests, payout availability and transactional side effects.
- Product/provider/instructor eligibility, active packages, prerequisite existence, training completion, booking/session quota, and extra-session reasons.
- Promotion target existence and current base price, future schedules, current task deadline window, catalog scope and ordering conflicts.
- Maximum counts across records, allowed file formats/capacity, attachment active state, safe media deletion and project-folder ownership.
- Known page-content/site-image/notification keys, supported broadcast audiences, Aqlam database-config acceptance, workflow graphs and transition gates.

The browser parsing successfully is not a server authorization decision. This change adds no new mutation transport or payment-provider integration.

See [coverage.md](./coverage.md) for the legacy admin section map.
