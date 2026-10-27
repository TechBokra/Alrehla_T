# Admin resource migration plan

Date: 2026-10-27. Status: implementation proposal; no routes, database objects or runtime behavior are changed by this document.

## Evidence and scope

The requested production URL, `https://www.alrehla.org/dashboard/admin/users`, redirects to sign-in in the available browser session. Authenticated production layout was not inspected. Existing behavior below is established from the checked-out `client` source, which may differ from deployed production.

The source contains **17 navigation sections, 58 navigation tabs and 88 admin page routes**. Counts come from `client/src/lib/admin-nav.ts` and `client/src/app/(admin)/dashboard/admin/**/page.tsx`; comments in the navigation file still mention an older, smaller section count. All 88 routes, including detail/new routes, secondary tabs and redirects, are listed in [the route inventory](./legacy-admin-route-inventory.md).

Primary sources:

- [Legacy navigation and tab permissions](../../client/src/lib/admin-nav.ts).
- [Legacy admin pages](../../client/src/app/(admin)/dashboard/admin/).
- [Legacy table](../../client/src/components/dashboard/SimpleDataTable.tsx) and [pagination](../../client/src/components/dashboard/Pagination.tsx).
- [Existing new-admin resource registry](../src/features/catalog/resources.ts), [resource provider](../src/components/resources/resource-provider.tsx) and [architecture](./architecture.md).
- [Existing validation coverage](../src/lib/schema/coverage.md). These schemas cover many legacy actions, but their presence does not mean that a new page or complete legacy form already exists.

Paths in the resource tables below are relative to `/dashboard/admin` in the legacy client. Suggested new route paths are a proposal. Resource names identify existing source tables or read models, not newly verified database grants or deployable RPC contracts. Exact physical columns, permissions and query support must be checked before implementing each resource.

## What exists today

| Area | Observed behavior in client source | Migration implication |
| --- | --- | --- |
| Shared tables | Desktop table and mobile stacked cards; generic local text search; local page size defaults to 10 with 10/25/50 choices; no header sorting implementation | Preserve mobile readability, replace generic value-string search with explicit server search fields, add real sorting |
| Users | Custom name/email search; audience, role, guardian, email presence and archive/suspension filters; outer local pagination defaults to 25 | One Refine table/paginator; remove the legacy nesting of outer pagination with the shared table's own search/pagination |
| Instructors | Local name/specialty search; account/review/training/service/work-model filters; local pagination defaults to 25 | Preserve these filters and move their computation into the server read model |
| Products | Platform/publisher separation; state/publisher URL filters; shared table search/pagination over loaded data | Preserve fixed ownership boundaries and share the list implementation |
| Orders | Custom kind/status/coupon/electronic filters and broad text search over loaded data; query layer batches reads | Batching is not interactive server pagination; implement a filtered, counted read model |
| Calendar | `/bookings/calendar` sorts sessions by scheduled time and renders `SimpleDataTable` | A real calendar is new work; use session IDs for session details, not subscription IDs |
| Tasks and studio | Task overview/lists and studio cards with saved-view/stage filters; bounded reads (tasks 500; studio 200) | Kanban is proposed, not existing; use server totals and per-column loading |
| Administrative history | Notifications load latest 200; audit logs latest 200; feedback up to 500; session changes latest 100 | Replace silent limits with pagination/range selection and accurate totals |
| Publishers | List and detail with products; no admin publisher create form in these routes | Do not invent publisher onboarding fields or enable creation by default |
| New admin | Registered catalog resources are `personalized_products` and `addon_products`; notifications have an existing feature/provider | Most listed screens remain migration work. Showcase/calendar demos are not completed business features |

## Shared implementation contract

1. **CRUD and reads:** Refine resources with the existing Supabase provider, `useTable`/`useList`/`useOne`, CRUD hooks and reusable resource dialogs. Feature forms own fields, defaults, Zod validation and allowlisted payload mapping. Only expose supported operations; a resource can be read-only.
2. **Commands:** feature-owned TanStack Query `useMutation` calling Supabase RPC through the shared authenticated client. Use the QueryClient backing the owning Refine context. On success call Refine `useInvalidate`, including named provider, affected list/detail/count queries and related resources. Do not duplicate resource reads under a second query cache.
3. **Privileged/external operations:** Supabase Auth account creation/invites/password resets and Cloudinary/meeting/payment integrations require a server or Edge Function boundary. Never call Auth admin APIs with a service-role key in the browser. Database-only transitions belong in RPC; external side effects need idempotency/recovery design and cannot be treated as one database transaction.
4. **Search:** one visible field per list, debounce 300 ms, trim input, reset to page 1 on change. Text uses case-insensitive matching on explicitly allowed columns; UUID/reference lookup uses validated exact or supported prefix matching. Related names/emails/phone/items require a verified join/view/search RPC/provider adapter rather than filtering the loaded page. Do not fetch all users to resolve one page's labels.
5. **Filters:** AND between distinct controls; OR only where explicitly needed (for example name OR email). Fixed feature scopes are permanent filters. Keep search/filter/sort/page state in the URL, use accessible Arabic labels, show active filters and a clear-all action. Validate URL values. Totals/count chips use the same permitted data scope.
6. **Sorting:** server sorting before pagination, column allowlist and a stable unique tie-breaker (`id` where applicable). Each resource below specifies a default and other useful sorts. Map display labels to real fields/computed read-model fields; never sort formatted currency/date strings. All sorting in the matrices is proposed unless the observations above explicitly establish it as existing.
7. **Pagination:** `P25` means server pages, default 25, choices 10/25/50, correct filtered total. Use one paginator and reset/clamp it on filters and deletes. `RANGE` means calendar fetches the visible interval, with `[start,end)` semantics and Cairo display time. `BOARD` means separately paged columns (initially 25 each) plus per-column totals. `SMALL` means a verified bounded configuration collection without pagination; switch to server pages if it grows. `FORM`/`DETAIL` have no root-list pagination; child histories paginate independently.
8. **Views:** a table is the default for record comparison, calendar for scheduled sessions, Kanban for actual workflow stages, gallery for visual assets and forms for singleton configuration. Read-only Kanban initially; dragging across stages must call an authorized transition command. Dragging rows to persist display order is a separate scoped reorder command and is not enabled by this plan.
9. **Forms/actions:** use existing `useAppForm` and shared schemas where accurate; use feature pages for large forms/details. Pending actions prevent duplicate submission, preserve values on errors and show actionable feedback. Business commands default to `retry: false` unless safe retries are designed. Frontend visibility never replaces server permission/transition checks.
10. **UI:** use the current admin's theme, components and RTL layout. Legacy source defines field content and workflows, not a requirement to copy its slate colors or page spacing. Email, IDs, URLs and phone values stay directionally readable within Arabic UI.

## Resource-by-resource browsing plan

The **view, filters, search, sort and pagination below describe the target**. Names in backticks are logical resource/read-model names; the data layer may need a view or adapter to provide related/computed columns. Form IDs refer to the form specifications later in this document. “No create” is intentional for customer/system-generated records.

### المتابعة — tasks and workflow

| Screen / legacy path | Resource and view | Filters and search | Sorting: default; alternatives | Paging / create |
| --- | --- | --- | --- | --- |
| مهامي `/tasks` | `work_tasks`; table default, optional stage Kanban and existing overview summaries | Mine/all/overdue/soon/open/unassigned/done; work line, stage, assignee, priority; search linked reference and task/subject label | Deadline urgency, priority, due date, ID; created date, priority | P25 / BOARD; no standalone create |
| تفاصيل المهمة `/tasks/[id]` | Task detail, linked entity and event timeline | History type/actor if needed; no root search | Events chronological with stable event key | DETAIL; F01 command forms |
| سير العمل والتوزيع `/tasks/workflow` | `task_steps`, `assignment_rules`, `task_edges`, studio product routes; structured editor | Work group/line; stage label search within configuration | Configured stage sequence; no arbitrary table reorder | SMALL / FORM; F02 |

### الناس — users, instructors and applications

| Screen / legacy path | Resource and view | Filters and search | Sorting: default; alternatives | Paging / create |
| --- | --- | --- | --- | --- |
| المستخدمون والعائلات `/users` | `user_profiles` + authorized email read model; table | Audience all/team/family; role/admin role, guardian yes/no, has/no email, existing/suspended/archived; name OR email search | Created newest + ID; name, role, created oldest | P25; F03 via privileged server command |
| ملف المستخدم `/users/[id]`, children subroute | Profile detail with overview/family/orders/services/sessions/support/activity tabs; child table | Each child list scoped to user; order/session status and name/reference search | Child lists newest; children created oldest; scheduled time for sessions | DETAIL + P25 child lists; F04 commands; children read-only here |
| الأدوار والصلاحيات `/users/permissions` | `admin_roles` and assignments; role list + permission matrix | Role name; permission; member name/email | Default role first then name + ID | SMALL; F05; super-admin restriction |
| طلبات حذف الحسابات `/users/deletion-requests` | `account_deletion_requests`; table + review drawer | Status, requested date; account name/email/reference | Newest + ID; oldest pending | P25; no create, F06 decision |
| المدربون `/instructors` | Instructor/admin read model; table | Account state, profile completeness, pending review, training passed, creative-service participation, work model; name/specialties | Created newest + ID; name, experience | P25; F07 |
| ملف المدرب `/instructors/[id]`, sessions subroute | Detail with profile/training/packages/services/media/session history | Child session status/date, package name/age; no global search | Sessions scheduled newest; media configured sequence | DETAIL + P25 histories; F08 commands/editors |
| مراجعة الملفات `/instructors/review` | `profile_update_requests`, `instructor_media`; review queue with image previews | Pending/approved/rejected, instructor, media/profile type; instructor name | Pending oldest first + ID; newest | P25; no create, F09 decision |
| طلبات الانضمام `/join-requests`, `[id]` | `join_requests`; table + application/message detail | Requested role, status, accepted-without-account, date; applicant name/email | Created newest + ID; oldest pending | P25; no admin application create; F10 decision/reply/account provisioning |

### إنها لك — product catalog and publishers

| Screen / legacy path | Resource and view | Filters and search | Sorting: default; alternatives | Paging / create |
| --- | --- | --- | --- | --- |
| منتجات المنصة `/products/platform` | `personalized_products`, permanent platform scope; table | Category, live/pending/rejected/stopped, age range; product name/slug | `sort_order` then ID; name, price, created date | P25; F11 |
| منتجات الناشرين `/products` | Same table, permanent publisher scope; shared table UI with publisher column | Publisher, missing publisher, category, state, age; product/publisher name | Created newest + ID; name, price, display order | P25; F11 with publisher-specific pricing |
| مراجعة المنتجات `/products/review` | Same product resource, review queue | Review state, publisher; product/publisher name | Updated oldest + ID; newest | P25; no create, F12 decision |
| ترتيب «أنت البطل هنا» `/products/hero-order` | Eligible custom products; selected/available ordering list | Eligibility fixed by feature; product name | Stored featured sequence | SMALL bounded to supported 1–500 IDs; F13 save sequence |
| خانات التخصيص `/products/customization-fields` | `customization_fields`; table | Active, required, applies-to product/box; label | `sort_order`, created time, ID; label | SMALL; F14 |
| أهداف التخصيص `/products/story-goals` | `story_goals`; table | Active, applies-to; label | `sort_order`, created time, ID; label | SMALL; F15 |
| لهجات الكتابة `/products/writing-dialects` | `writing_dialects`; table | Active; Arabic name/code | `sort_order`, code; Arabic name | SMALL; F16 |
| الإضافات `/addons` | `addon_products`; table with image thumbnail | Active, price range; name | `sort_order`, ID; name, price | P25; F17 |
| العروض والخصومات `/promotions` | `price_promotions`; table | Target type/item, scheduled/active/expired, discount kind; target name/badge | End date newest + ID; start date, discount value | P25; F18 |
| دور النشر `/publishers`, `[id]` | `publishers`; table + profile/products detail | Name/bio search; linked products use product filters | Created newest + ID; name | P25; no existing admin create; onboarding decision needed |

### Product orders, story studio and box subscriptions

| Screen / legacy path | Resource and view | Filters and search | Sorting: default; alternatives | Paging / create |
| --- | --- | --- | --- | --- |
| طلبات المنتجات `/orders`, `[id]` | Orders read model joining `orders`/`order_items`; table + order detail | Kind, status, coupon, electronic included, date, payment method; reference/customer/phone/product/child/add-on/coupon | Created newest + ID; total, status, oldest | P25; no create, F19 commands |
| أسعار الشحن `/settings/shipping` | `countries`, `governorates`, `shipping_rates` and delivery settings; country/grouped table | Country, governorate, active, estimated; governorate/city | Governorate, city, ID; fee | P25 rates, SMALL country settings; F20 |
| آراء العملاء `/feedback/enha-lak` | `customer_feedback`, permanent line scope; table + comment drawer | New/seen, rating, date; customer/comment | Created newest + ID; rating, oldest new | P25; no create; mark seen command |
| استوديو القصص `/studio`, `[id]` | `story_projects`; table default + stage Kanban; tabbed production workspace | Active/mine/hold/done, dynamic stage, editor/art lead, overdue, age, face mode; child/order/project reference | Due date ascending nulls last, created newest, ID; created/status | P25 / BOARD; create only from eligible order item; F21 |
| إعدادات الاستوديو `/studio/settings` | Studio mode/settings plus workflow links/product routes | Setting/stage/product label search where useful | Configured sequence | FORM; F22; reuse workflow editor rather than duplicate it |
| اشتراكات الصندوق `/subscriptions/box`, `[id]` | `box_subscriptions`; table + subscription/shipments detail | Active/paused/cancelled, plan, renewal/start date; account/reference | Created newest + ID; start/next due | P25; no manual create; F23 shipment commands |
| خطط الصندوق `/subscriptions/box/plans` | `box_subscription_plans`; table + form | Active, highlighted, duration; plan name | `sort_order`, duration, ID; total/monthly price | SMALL; F24 |
| صناديق الشهر `/subscriptions/box/shipments` | Due shipment read model (`box_shipments`, subscriptions, orders); table | Month, preparation/shipment state, overdue, plan; subscription/customer/tracking | Due month/date ascending + ID; state | P25; system generates rows; F23 |

### بداية الرحلة — learning and creative services

| Screen / legacy path | Resource and view | Filters and search | Sorting: default; alternatives | Paging / create |
| --- | --- | --- | --- | --- |
| باقات الكتابة `/writing/packages`, new, `[id]` | `creative_writing_packages`; table + full-page form | Active, age group, track; name/description | Created oldest + ID to preserve current query order; name, price, sessions | P25; F25 |
| اشتراكات الباقات `/subscriptions/courses` | `course_subscriptions`; table linking booking detail | Active/completed/cancelled, package, participant, start date | Created newest + ID; start date, package | P25; no create; booking commands |
| آراء العملاء `/feedback/creative-writing` | Same feedback feature with fixed line scope | New/seen, rating, date; customer/comment | Created newest + ID; rating | P25; no create; mark seen command |
| الحجوزات `/bookings`, `[id]` | `course_subscriptions` + booking read model; table + subscription/session plan detail | Booking status, package, preferred/assigned instructor, recording consent, paid/date; participant/reference | Created newest + ID; amount, date | P25; customer-generated; F26 |
| التقويم `/bookings/calendar` | `sessions` + names/read model; real month/week/day calendar + agenda/table switch | Instructor, package, status, participant, visible date interval; participant/reference | Scheduled time ascending + ID | RANGE; no generic create; F26 add-session from subscription |
| طلبات تغيير المواعيد `/bookings/change-requests` | `session_change_requests`; table + before/after drawer | Pending/approved/rejected, requester, instructor, date; participant/session reference | Pending oldest first + ID; newest | P25; no create; F27 |
| الجلسات والتقارير `/sessions`, `[id]` | `sessions`, `session_reports`; table + report detail; shared calendar link | Status, instructor, package, date, report present, recording consent; participant/reference | Scheduled newest + ID; upcoming first | P25; F28 settings/commands; no unrelated standalone session |
| الغرف المباشرة `/rooms` | Operational dashboard: active attendance, recordings and scheduled-room tables | Live/scheduled/ended, instructor, recording state, date; session/reference | Active attendance latest; future sessions ascending; recordings newest | Separate P25 lists; no arbitrary room create; F29 |
| طلبات الجلسات المخصصة `/support/session-requests` | `support_session_requests`; table + request drawer | Open/all, pending/contacted/resolved; contact name/phone/message; optional age/date filters only if backed by stored request fields | Created newest + ID; oldest pending | P25; no admin create; F51 |
| الخدمات الإبداعية `/writing/services` | `standalone_services`; table + detail/form | Active, category, price type, files allowed; name/category | `sort_order` nulls last, ID; name, price, delivery days | P25; F30 |
| طلبات الخدمات `/orders/services`, `[id]` | `service_orders`; table + order/messages/files detail | Status, service, provider, payment/due date, overdue; reference/buyer/provider/service | Created newest + ID; due date, amount | P25; no create; F31 |
| مقدّمو الخدمة `/providers` | `service_providers`, `provider_services`; table + offerings detail | Kind platform/instructor/individual, status, service, approved offering; name/email | Kind then display name + ID; approved service count if supported | P25; F32 |

### الموقع — content, community and media

| Screen / legacy path | Resource and view | Filters and search | Sorting: default; alternatives | Paging / create |
| --- | --- | --- | --- | --- |
| محتوى الصفحات `/content/pages` | Known `page_content` keys; grouped structured editor | Page/section; search existing visible text/key/label | Registry order | FORM; F33; no arbitrary content key create |
| المدونة `/content/blog`, new, `[id]` | `blog_posts`; table + editor/preview | Draft/scheduled/published, author, date; title/slug/excerpt | Publication date newest + ID; created, title, scheduled date | P25; F34 |
| آراء العملاء المنشورة `/content/testimonials` | `testimonials`; table + content preview | Product line; author/content | Created newest + ID; author | P25; F35; separate from submitted feedback/reviews |
| الإعلانات `/content/ads` | `ads`; table + image preview and statistics | Active/scheduled/expired, page/position, advertiser; title/advertiser | `sort_order`, ID; dates, views/clicks if read model supports | P25; F36 |
| التقييمات `/reviews` | `reviews`; moderation table | Visible/hidden, rating, related product/service, date; reviewer/text/target | Created newest + ID; rating | P25; no admin create; F37 hide/restore |
| صندوق أقلام `/aqlam` | Separate post/guardian/report review queues; split-pane cards + detail | Queue kind, pending state, age/category; author/title/report text | Pending oldest + ID; created | P25 per queue; no admin post create; F38 decisions |
| كل النصوص `/aqlam/posts` | `aqlam_posts`; table with text preview and pinned strip | Status, category, age band; title/body/author as allowed by read model | New/old/reaction count with stable tie-breaker; pinned sequence separately | P25 default, honor admin configured size where valid; F38 |
| حسابات أقلام `/aqlam/people` | Authorized writer/profile read model + `aqlam_sanctions` | Allowlist/blocked/warned, age, sanction active; account name/email/pen name | Name + ID; newest sanction | P25; no user create; F39 |
| إعدادات أقلام `/aqlam/settings` | Singleton `aqlam_config` and site mode/allowlist | Section selector; field label search | Schema/registry order | FORM; F40 |
| صور الموقع `/content/images` | Known site-image keys; gallery grouped by page | Page/section; key/label | Registry order | SMALL; F41 replacement, no arbitrary slot create |
| مخزن الصور `/media` | Cloudinary asset/reference read model; gallery | Used/orphan, folder/type/date; public ID/name | Created newest + public ID | Provider cursor/load-more; no arbitrary DB resource create; F42 |
| الإعدادات العامة `/content/settings` | `site_settings`; sectioned singleton form | Settings section, label search | Defined section order | FORM; F43 |
| الإشعارات `/notifications` | Admin notification read model; table | Recipient, read/unread, type, date; title/message/recipient | Created newest + ID | P25; broadcast command F44 |
| إرسال إشعار `/notifications/send` | Command form | Audience selector; no list search/filter/sort | Not applicable | FORM; F44 |
| أنواع الإشعارات `/notifications/types` | Supported type registry + disabled settings | Enabled/disabled, type name | Registry order | SMALL; F45 |

### الدعم والمالية والتدقيق

| Screen / legacy path | Resource and view | Filters and search | Sorting: default; alternatives | Paging / create |
| --- | --- | --- | --- | --- |
| رسائل الدعم `/support/tickets`, `[id]` | `support_tickets`, message thread; table + conversation detail | Status, category, date; subject/customer/ticket reference | Updated/latest activity if available, otherwise created newest + ID; oldest open | P25; no admin ticket create; F46 |
| مستحقات المدربين `/finance/instructor-payouts`, `[id]` | `payouts`, permanent instructor scope; table + breakdown | Pending/paid, instructor, period; instructor/payout reference | Created newest + ID; amount, period | P25; system-generated; F47 paid command |
| مستحقات الناشرين `/finance/publisher-payouts`, `[id]` | `payouts`, permanent publisher scope; shared table + breakdown | Pending/paid, publisher, period; publisher/payout reference | Created newest + ID; amount, period | P25; system-generated; F47 |
| طلبات السحب `/finance/withdrawals` | `withdrawal_requests`; table + decision drawer | Status, owner, date, amount; person/reference | Created newest + ID; oldest pending, amount | P25; user-generated; F48 |
| أكواد الخصم `/finance/discount-codes` | `discount_codes` + usage counts; table | Active/scheduled/expired/exhausted, line; exact/partial code and internal note | Created newest + ID; expiry, percent, usage | P25; F49 |
| التسعير والمدفوعات `/settings/pricing` | Pricing formulas and payment/transfer settings; tabbed forms | Pricing/payment section only | Defined section order | FORM; F50; separate catalog/payment permissions |
| السجلات والتدقيق `/audit-logs` | `audit_logs`; read-only table + detail JSON viewer | Actor, action, entity type, date; entity ID/action reference | Created newest + ID; oldest | P25; no create/edit/delete |
| لوحة الملخص `/` | Aggregate read models; statistics + actionable queues/recent rows | Date range and permitted work line | Recent activity newest; urgent queue by deadline | Bounded previews link to P25 lists; no generic create |

## Form and command specifications

These are field/content requirements carried forward from source plus explicit implementation choices. Required markers must be reconciled with the actual legacy action and current database constraints per feature: existing UI `required` markers and extracted schemas sometimes differ. Read-only IDs, owner scope, calculated prices, usage totals and audit metadata must not become writable form inputs. Compound/account operations are commands even when the UI label says “Create”.

| ID | Form/action and fields | Controls and behavior |
| --- | --- | --- |
| F01 | Task assignment: responsible profiles; deadline: Cairo datetime/clear; priority: low/normal/high/urgent; note; complete task | Multi-select, datetime, enum, textarea; separate command per action; display linked entity and history |
| F02 | Workflow: line/stage; label, hint, SLA hours, owner kind, assignees, show tab; add studio stage after another; active/optional, abilities, gates, advance actor, allowed edges, reset-QA/pages-redo flags; product stage required/optional/off; box lead days | Sectioned configuration editor, checkbox matrices and number inputs. Preserve distinction between saving defaults and applying them to currently open tasks |
| F03 | User create: **full name, email, assignable role**; admin role when applicable; direct/invite mode; optional temporary password in direct mode | Text/email, role select with team/family grouping, segmented mode. Direct mode can generate temporary credential; show result once in memory. Invite shows generated link. Instructor creation is F07; child/student creation remains family-owned. Role assignment/account provisioning require server authorization |
| F04 | User commands: change role/admin role; reset temporary password (generated/custom); suspend vs block login with reason; archive/delete with reason; restore | Dedicated dialogs, conditional password/reason inputs; preserve self/super-admin restrictions and archive semantics; no raw profile CRUD bypass for Auth state |
| F05 | Admin role: **name, at least one permission**; user-to-admin-role assignment | Text 2–40 chars, permission checklist, profile/role select. Retain protections for system/default roles and last privileged administrator |
| F06 | Deletion request: done/rejected; admin note (required for rejection) | Review context + decision dialog; resolving a request and deleting an account are distinct operations |
| F07 | Instructor create: **email, full name**, display name (fallback full name), experience, specialties, work model monthly/per-session, optional temporary password, bio | Email/text, nonnegative number, tags, select, textarea. Server creates account and complete instructor linkage; prefill accepted application when provided |
| F08 | Instructor profile: display name, bio, specialties, experience. Training: meeting link, completion date, exam score, certification passed. Packages: eligible package IDs. Services: service, instructor proceeds, active/review state, rejection feedback. Work transfer: target instructor | Tabs with purpose-specific forms; retain effective customer-price preview and financial distinction. Status/certification/transfer/password/delete are commands; media review uses F09 |
| F09 | Approve/reject profile request or media; feedback (required on rejection); revoke previously approved media with required reason; approve eligible bundle | Before/after profile comparison, image/video previews, decision textarea. Do not approve an incomplete profile merely by changing instructor status |
| F10 | Application decision approved/rejected; applicant reply message; account creation from accepted application | Decision buttons + textarea and prefilled F03/F07 flow. Preserve message thread and accepted-without-account state; no public token displayed in list |
| F11 | Product: name, category; platform owner fixed; publisher selector for publisher scope; short description, long description, printed price **or publisher cost**, cover image, gallery, feature lines, min/max age; custom category electronic price and allowed writing styles; edit active/display order where supported | Large form or full page with grouped sections. Publisher category restrictions and calculated customer price remain server-enforced. Preserve absent fields on partial edits. Existing new-admin product schema/form is narrower: extend it deliberately for gallery/features/ages/styles and publisher pricing before claiming full parity |
| F12 | Product moderation: approve/reject, rejection note; active state as separate operation | Preview product + publisher data; require rejection reason; invalidate review queue/product lists |
| F13 | Hero ordering: selected unique eligible product IDs in sequence | Selected/available list, move buttons/drag, explicit save; server checks eligibility and scope. This is separate from current local-only catalog row dragging |
| F14 | Customization field: **label**, placeholder, required, active, applies-to products/box or all | Text, switches, async multi-select. Preserve existing order; persistence of drag order requires a separate command |
| F15 | Story goal: **label** (reserved “other” excluded), active, applies-to products/box or all | Text/switch/multi-select; do not delete values needed by existing orders without supported semantics |
| F16 | Writing dialect: **immutable code, Arabic name**, active | Code input lower-case letters/underscore 2–20, text up to 60; existing records keep their code |
| F17 | Add-on: **name, price**, short/full descriptions, display order, main image, gallery up to 8, detail bullets up to 10, active | Number/money, textarea, Cloudinary image controls and list editor. Existing new-admin schema/form lacks some legacy fields; reconcile shared catalog vs add-on contracts |
| F18 | Promotion: **target type, target item, discount kind, value, Cairo start/end**, badge label optional | Dependent item selector; percent vs sale-price money; valid date interval, percent below 100. Server validates target availability/overlap rules |
| F19 | Order commands: confirm receipt/payment; fulfilment transition, tracking/carrier text, cancellation reason; electronic delivery; eligible studio start; box shipment-related action | Dedicated action forms on detail; preserve paid/cancelled/delivery gates, earnings and related task effects. Customer/items/totals are not manually editable generic form values |
| F20 | Shipping rate: **country, governorate, city/area, fee**, active, estimate. Governorate create: country/name. Country flags: printed/electronic enabled, closed message. Global pause/message; governorate flags; bulk fee delta | Dependent selects, money, switches, message textarea. Bulk adjustment and availability changes use explicit commands; protect scope and existing addresses |
| F21 | Studio brief: age band, target pages, face mode, sensitive topic; real-face consent evidence. Assign editor/art lead/due date. Draft body/source/note; version/customer decisions. Character notes/reference URL; page number/text/scene/image; review note; QA checklist; cost kind/amount/minutes/note; stage transition/note | Full-page tabbed workspace. Append versions and use commands for approvals/transitions/cost recording; stage-specific gates and consent remain on server. No generic project-create dialog |
| F22 | Studio mode; eligible project backfill; product routes/stage settings via F02 | Configuration forms and explicit backfill command, with visible result summary; do not treat backfill as automatic page load |
| F23 | Box shipment: prepare/ship/complete supported transition and optional tracking text | Action drawer per subscription/month; preserve payment/status gates and month identity. No manual duplicate subscription creation |
| F24 | Box plan: **name, duration months, total price, displayed monthly price**, savings note, description, image upload, feature lines, highlighted, active, sort order, add-on discount %, free add-on | Money/numbers, textarea, image, switches/select; total ≤ monthly × months; add-on discount 0–90. Reuse the legacy image-upload contract |
| F25 | Writing package: name, age group under-12/12+, track, short/full description, target audience, price, session count, session-duration text, total-duration text, prerequisite note, active; prerequisite linkage only if supported by action | Full-page grouped form; existing source marks several descriptive fields required while normalized schemas allow optional values—settle this in the feature contract before building |
| F26 | Booking commands: confirm payment, assign instructor, cancel/reason; add session: Cairo datetime, eligible instructor, reason (required for extra session) | Booking detail with session plan; preserve number-of-sessions constraints, compensation/extra-session rules and notification effects |
| F27 | Schedule change: approve/reject, rejection note | Show original/proposed datetime, requester, instructor and conflict context; validate conflicts on server, not only calendar |
| F28 | Session settings: meeting URL and Cairo scheduled datetime; operational actions/report display as supported | Read report separately. Keep rescheduling/room changes behind commands where coordinated effects apply; no fabricated admin report-create form |
| F29 | Room create/recreate/open, recording open/remove, retention cleanup | Server/Edge Function integration with meeting provider and signed media access. Action inputs come from selected session/recording; no secret URLs in generic cache persistence |
| F30 | Service: **name, price**, category, fixed/starts-from, delivery days, sort order, short/full description, cover/gallery up to 8, deliverables up to 8, requirements, file uploads enabled, max MB, allowed kinds PDF/Word/image | Large grouped form, money/select, image/gallery, textarea lines and conditional file settings. File-size bounds come from actual server/upload configuration |
| F31 | Service-order lifecycle: payment confirmation, assign/transfer provider where supported, progress/complete/cancel decisions, message and permitted delivery attachments | Detail workflow reuses existing service-order contracts; separate financial status from delivery messages; external upload/delivery side effects need server boundary |
| F32 | Independent provider: existing eligible account email, **display name**, bio. Profile: display name/bio/status. Offering: service, approved proceeds, review status, active, notes where supported; transfer target | Candidate selector avoids creating unrelated Auth accounts; approved price must be positive. Show provider proceeds separately from calculated customer price. Multi-entity writes/approval/transfer use commands |
| F33 | Page content: registry key with text/longtext/richtext value depending on known field | Group by page/section, searchable labels/current text; preserve keys and unedited fields, no arbitrary JSON editor |
| F34 | Blog: **title, content**, slug (generate when empty), excerpt, SEO description, cover image, author name, draft/published/scheduled, scheduled Cairo datetime | Full editor with preview, image picker and conditional schedule required. Display publication state accurately |
| F35 | Testimonial: **author name, content**, author role, line general/enha-lak/creative-writing | Text/textarea/select; admin-authored display content, not customer feedback mutation |
| F36 | Ad: **title, desktop image, at least one page/position placement**, advertiser name, mobile image, redirect link, starts/ends, sort order, active | Image controls, placement checkbox grid, dates, link validator; reject invalid intervals/unsafe destinations; stats read-only |
| F37 | Review visibility: hide reason, restore | Reason textarea for audit context. Do not edit customer's rating/text or allow staff-authored customer review creation |
| F38 | Aqlam moderation: post approve/reject/hide/restore/remove + reason; guardian approve/reject + note; report dismissed/actioned; pin/unpin/reorder | Queue-specific dialogs, rejection note rules; enforce moderation/retention and max-pinned rules server-side |
| F39 | Aqlam sanction: user, kind, reason; lift sanction; allowlist add/remove | User selector and command dialog; display sanction history and current effective restriction |
| F40 | Aqlam config: mode/allowlist; publishing/comments/reactions/edit/remove/name/indexing/writer/share flags; limits; moderation; categories; reactions; report reasons; blocked words; public filters/sorts/age bands/page size; featured/texts; admin page size | Port section controls from `client/src/lib/aqlam/config.ts` registry and existing `_parts`/`_lists` renderers. Typed numbers/selects/switches/repeater rows; preserve exact per-field bounds and section reset/save semantics |
| F41 | Site image: known image slot key + replacement URL/upload | Gallery cards with label, dimensions/context and preview; verify source slot metadata, preserve registry and image transforms |
| F42 | Asset cleanup: selected public IDs, acknowledgement for high ratio where required | Gallery selection + usage preview; server rechecks references/project folder before deletion. Upload/cleanup uses Cloudinary server integration |
| F43 | General settings: site name/logo/favicon; contact email/phone/WhatsApp/hours/address/social links; watermark enabled/text/type/opacity/color/size/place; orphan/private/child-photo cleanup and retention; banner text/end/active; stale order days; financial warning threshold; recording enabled/retention | Sectioned form from legacy settings/action contracts, not one replacement JSON blob. Upload fields and Cairo timestamps where applicable; save only allowlisted fields. Invalidate branding reads after branding updates |
| F44 | Broadcast notification: **target audience, title**, message, internal/HTTPS link | Audience select, text/textarea/link, preview of audience and content before send. Server performs delivery; track result/partial failure. Sending is a command, not direct inserts from a generic create form |
| F45 | Supported notification type toggles | Registry checklist mapped to disabled-type setting; no arbitrary notification-type create |
| F46 | Support reply: **message**; close ticket | Conversation composer, pending/error states, refresh thread/list/unread counts; no generic edit of customer messages |
| F47 | Payout: mark recorded payout as paid | Display beneficiary, period, amount and ledger context; command records state. Does not itself initiate a bank transfer |
| F48 | Withdrawal decision: approve/paid/reject, admin note (required on rejection) | Decision dialog with balance/context and allowed next states; server validates balances/concurrency |
| F49 | Discount code: **code, percent**, allowed lines, start/end dates, max uses, internal note, active | Uppercase code 3–30; percent 1–90; positive integer max uses if present; valid date range. Preserve legacy meaning of empty allowed lines; verify it before implementation |
| F50 | Pricing: instructor/platform multiplier and fixed fee, publisher/provider formulas; payment method flags/availability message; transfer wallet number/QR image | Separate permission-gated tabs and live price preview. Recalculate using server rules; secrets never appear in client forms or public settings |
| F51 | Custom-session request: mark contacted, mark resolved, reopen to pending | Show contact name/phone and submitted message; selected request ID plus target state are command inputs. No new booking/session is created just by changing contact status |

## Suggested new route and resource organization

Keep the 17 familiar section labels and group related screens as tabs; details/new forms are child routes, not extra sidebar entries. Preserve existing `/catalog/products` and `/catalog/addons` destinations. Suggested new roots:

| Section | Proposed new admin root | Notes |
| --- | --- | --- |
| مهامي | `/tasks` | Detail + `/tasks/workflow`; legacy steps/assignments redirect here |
| المستخدمون | `/users` | Details, permissions, deletion requests |
| المدربون | `/instructors` | Review/media alias, join requests linked under same section |
| منتجات المنصة | `/catalog/products` | Shared products table, platform scope, catalog settings tabs |
| الناشرون | `/publishers` | Products/review use same underlying product resource with distinct route scopes |
| طلبات المنتجات | `/orders` | Shipping, feedback and studio remain section tabs |
| صندوق الرحلة | `/subscriptions/box` | Plans and monthly shipments |
| الباقات والاشتراكات | `/writing/packages` | Course subscriptions and scoped feedback |
| الجلسات | `/bookings` | Calendar, changes, session detail, rooms, custom requests |
| الخدمات الإبداعية | `/writing/services` | Service orders and providers |
| المحتوى | `/content` | Pages/blog/testimonials/ads/reviews |
| أقلام الرحلة | `/aqlam` | Inbox/posts/people/settings |
| الصور | `/content/images` | Media library tab |
| الإعدادات | `/settings` | General + administrative notification tabs |
| الدعم | `/support/tickets` | Thread detail |
| المالية | `/finance` | Payouts/withdrawals/codes/pricing |
| السجلات والتدقيق | `/audit-logs` | Read-only |

One physical table may power several route scopes. Configure an explicit unique Refine resource identifier when registering it more than once, or reuse one registration and pass explicit permanent filters; verify the choice against current Refine APIs before implementation. Avoid ambiguous duplicate resource names. Route access and named-provider selection must remain explicit.

The existing new-admin `/notifications` is **current-user inbox/read-state**, while legacy `/dashboard/admin/notifications` is **administrative delivery history/broadcast management**. Keep them distinct (for example `/notifications` vs `/settings/notifications`), with separate authorization and read scopes.

## Delivery sequence

| Phase | Deliverable | Completion evidence |
| --- | --- | --- |
| 0. Contracts and shared mechanics | Verify source table columns, grants/RLS/functions and read-model needs; record the operation/permission matrix; add direct compatible TanStack Query dependency when first needed; shared server-search/filter/sort/page handling and command convention | One list proves filtered server pagination and stable order; one command proves pending/error/invalidation on the owning cache; no duplicate paginator/cache |
| 1. Users vertical slice | Users list with all legacy filters, detail tabs, account provisioning/reset/role/suspension/archive workflows; permissions and deletion requests | Search beyond first page works; role restrictions enforced server-side; credential results are temporary; child/history links use correct IDs |
| 2. Catalog parity | Complete platform/add-on fields; publisher products, reviews, customization/goals/dialects, promotions; publisher read-only profiles | Missing legacy fields preserved on edit; platform/publisher scopes isolated; correct customer/proceeds prices; images/gallery and validation verified |
| 3. Product operations | Orders/detail, shipping, box plans/subscriptions/monthly shipments, feedback; task read model | Commands preserve payment/fulfilment/earnings/task effects; no direct business-status CRUD bypass; true counts beyond previous caps |
| 4. Learning and services | Instructors/reviews/applications, packages/bookings/session plan, real calendar, schedule changes, rooms, services/providers/orders | Cairo date round trip, calendar boundaries/conflicts, eligible instructor/provider checks, files/rooms via server integration |
| 5. Tasks and studio | Task detail/overview, optional Kanban, workflow configuration, production workspace/settings | Dynamic stages/roles respected; per-column pagination; stage gates enforced even on drag; defaults vs open-task application preserved |
| 6. Content and community | Pages/blog/testimonials/ads/reviews, Aqlam queues/config, galleries/media, general settings and admin notifications | Registry parity, safe links/images, permission-specific actions, no confusion between personal/admin notifications |
| 7. Support, finance and audit | Support thread, financial ledgers/decisions/codes/pricing, audit explorer | Read/write permissions separated, duplicate decisions rejected, ledger integrity checked, accurate paginated history |
| 8. Route reconciliation and release | Map all 88 legacy routes to destinations/redirects; remove placeholders for migrated features; verify role-specific menus/deep links | Every inventory row has a migration outcome; protected route refresh works; responsive RTL checks; production-like read-only smoke checks before enabling writes |

Each phase is independently deliverable; do not register all resources with working create/delete buttons before their contracts exist. For each feature, verify successful and rejected actions, related cache invalidation, pagination/search/sort interaction, authorization, not-found/error/empty states, and preservation of untouched fields. Use focused tests for data/command rules plus typecheck/build for runtime changes; this planning update itself requires document/link/route coverage checks only.

## Decisions still needed before affected implementation

- **Publisher onboarding:** no admin create form exists in the inspected route set. Keep read-only until the intended Auth + publisher profile flow and fields are specified.
- **Saved ordering:** catalog dragging is currently local-only by explicit prior scope. Hero featured ordering is a separate legacy workflow; migrating it or enabling stored catalog ordering requires a verified command contract.
- **Read models and access:** related email/customer/name/coupon/item search and aggregate sort/counts need verified secure query support. Never grant broad access to `user_emails` or weaken RLS just to populate a table.
- **Existing RPCs:** command names in examples are illustrative. Reuse verified deployed contracts where available; this source audit did not inspect live Supabase objects or apply any migration.
- **Schema/form parity:** resolve legacy UI versus normalized schema differences per form, especially product/add-on fields, package required fields, gallery limits and upload constraints.
- **Production parity:** compare the authenticated deployed screens with source when a signed-in browser session is available. The plan does not claim pixel-level production verification.

## References for the chosen data pattern

- [Refine Supabase provider](https://refine.dev/core/docs/data/packages/supabase/): CRUD data-provider integration.
- [Refine table state](https://refine.dev/core/docs/data/hooks/use-table/): server sort/filter/pagination state and location synchronization.
- [Supabase RPC](https://supabase.com/docs/reference/javascript/rpc) and [database functions](https://supabase.com/docs/guides/database/functions): database command boundary.
