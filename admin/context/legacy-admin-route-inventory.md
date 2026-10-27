# Legacy admin route inventory

Source audit: 2026-10-27. This inventories checked-out source, not authenticated production. See [the implementation plan](./resource-migration-plan.md) for proposed views, filters, sorting, pagination and forms.

## Counts

- 17 navigation sections.
- 58 navigation tabs.
- 88 `page.tsx` admin routes, including new/detail/alias routes.

## Navigation tabs and permissions

Tab visibility and actual page/action access must both be preserved. Some pages have stricter checks than the tab (permissions/pricing/workflow are examples). The permission below is the navigation requirement, not proof of complete backend authorization.

| Section | Tab | Legacy route | Navigation permission |
| --- | --- | --- | --- |
| مهامي | مهامي | `/dashboard/admin/tasks` | `anyAdmin` |
| مهامي | سير العمل والتوزيع | `/dashboard/admin/tasks/workflow` | `canAssignWork` |
| المستخدمون | المستخدمون والعائلات | `/dashboard/admin/users` | `canManageUsers` |
| المستخدمون | الأدوار والصلاحيات | `/dashboard/admin/users/permissions` | `canManageUsers` |
| المستخدمون | طلبات حذف الحسابات | `/dashboard/admin/users/deletion-requests` | `canManageUsers` |
| المدربون | المدربون | `/dashboard/admin/instructors` | `canManageInstructors` |
| المدربون | مراجعة الملفات | `/dashboard/admin/instructors/review` | `canManageInstructors` |
| المدربون | طلبات الانضمام | `/dashboard/admin/join-requests` | `canManageSupport` |
| منتجات المنصة | المنتجات | `/dashboard/admin/products/platform` | `canManagePublishers` |
| منتجات المنصة | ترتيب «أنت البطل هنا» | `/dashboard/admin/products/hero-order` | `canManageCatalog` |
| منتجات المنصة | خانات التخصيص | `/dashboard/admin/products/customization-fields` | `canManageCatalog` |
| منتجات المنصة | أهداف التخصيص | `/dashboard/admin/products/story-goals` | `canManageCatalog` |
| منتجات المنصة | لهجات الكتابة | `/dashboard/admin/products/writing-dialects` | `canManageCatalog` |
| منتجات المنصة | الإضافات | `/dashboard/admin/addons` | `canManageCatalog` |
| منتجات المنصة | العروض والخصومات | `/dashboard/admin/promotions` | `canManageCatalog` |
| الناشرون | دور النشر | `/dashboard/admin/publishers` | `canManagePublishers` |
| الناشرون | منتجات الناشرين | `/dashboard/admin/products` | `canManagePublishers` |
| الناشرون | مراجعة المنتجات | `/dashboard/admin/products/review` | `canManageCatalog` |
| طلبات المنتجات | الطلبات | `/dashboard/admin/orders` | `canManageOrders` |
| طلبات المنتجات | أسعار الشحن | `/dashboard/admin/settings/shipping` | `canManageOrders` |
| طلبات المنتجات | آراء العملاء | `/dashboard/admin/feedback/enha-lak` | `canManageSupport` |
| طلبات المنتجات | استوديو القصص | `/dashboard/admin/studio` | `canWorkStudio` |
| طلبات المنتجات | إعدادات الاستوديو | `/dashboard/admin/studio/settings` | `canManageStudio` |
| صندوق الرحلة | الاشتراكات | `/dashboard/admin/subscriptions/box` | `canManageSubscriptions` |
| صندوق الرحلة | الخطط | `/dashboard/admin/subscriptions/box/plans` | `canManageSubscriptions` |
| صندوق الرحلة | صناديق الشهر | `/dashboard/admin/subscriptions/box/shipments` | `canManageSubscriptions` |
| الباقات والاشتراكات | باقات الكتابة | `/dashboard/admin/writing/packages` | `canManageCatalog` |
| الباقات والاشتراكات | اشتراكات الباقات | `/dashboard/admin/subscriptions/courses` | `canManageSubscriptions` |
| الباقات والاشتراكات | آراء العملاء | `/dashboard/admin/feedback/creative-writing` | `canManageSupport` |
| الجلسات | الحجوزات | `/dashboard/admin/bookings` | `canManageBookings` |
| الجلسات | التقويم | `/dashboard/admin/bookings/calendar` | `canManageBookings` |
| الجلسات | طلبات تغيير المواعيد | `/dashboard/admin/bookings/change-requests` | `canManageBookings` |
| الجلسات | الجلسات والتقارير | `/dashboard/admin/sessions` | `canManageBookings` |
| الجلسات | الغرف المباشرة | `/dashboard/admin/rooms` | `canManageBookings` |
| الجلسات | طلبات الجلسات المخصصة | `/dashboard/admin/support/session-requests` | `canManageSupport` |
| الخدمات الإبداعية | الخدمات | `/dashboard/admin/writing/services` | `canManageCatalog` |
| الخدمات الإبداعية | الطلبات | `/dashboard/admin/orders/services` | `canManageOrders` |
| الخدمات الإبداعية | مقدّمو الخدمة | `/dashboard/admin/providers` | `canManageInstructors` |
| المحتوى | محتوى الصفحات | `/dashboard/admin/content/pages` | `canManageContent` |
| المحتوى | المدونة | `/dashboard/admin/content/blog` | `canManageContent` |
| المحتوى | آراء العملاء | `/dashboard/admin/content/testimonials` | `canManageContent` |
| المحتوى | الإعلانات | `/dashboard/admin/content/ads` | `canManageContent` |
| المحتوى | التقييمات | `/dashboard/admin/reviews` | `canManageContent` |
| أقلام الرحلة | الصندوق | `/dashboard/admin/aqlam` | `canManageContent` |
| أقلام الرحلة | كل النصوص | `/dashboard/admin/aqlam/posts` | `canManageContent` |
| أقلام الرحلة | الحسابات | `/dashboard/admin/aqlam/people` | `canManageContent` |
| أقلام الرحلة | الإعدادات | `/dashboard/admin/aqlam/settings` | `canManageContent` |
| الصور | صور الموقع | `/dashboard/admin/content/images` | `canManageContent` |
| الصور | مخزن الصور | `/dashboard/admin/media` | `canManageContent` |
| الإعدادات | الإعدادات العامة | `/dashboard/admin/content/settings` | `canManageContent` |
| الإعدادات | الإشعارات | `/dashboard/admin/notifications` | `canManageContent` |
| الدعم | رسائل الدعم | `/dashboard/admin/support/tickets` | `canManageSupport` |
| المالية | مستحقات المدربين | `/dashboard/admin/finance/instructor-payouts` | `canManageFinance` |
| المالية | مستحقات الناشرين | `/dashboard/admin/finance/publisher-payouts` | `canManageFinance` |
| المالية | طلبات السحب | `/dashboard/admin/finance/withdrawals` | `canManageFinance` |
| المالية | أكواد الخصم | `/dashboard/admin/finance/discount-codes` | `canManageFinance` |
| المالية | التسعير والمدفوعات | `/dashboard/admin/settings/pricing` | `canManageFinance` |
| السجلات والتدقيق | السجلات والتدقيق | `/dashboard/admin/audit-logs` | `canViewAuditLogs` |

## All page routes

“Not a direct tab” includes detail/create routes and aliases, not necessarily obsolete screens. Input labels listed later are literal source observations; dynamic field registries and shared component fields need their referenced files.

| # | Legacy route | Page source | Direct navigation tab / redirect |
| --- | --- | --- | --- |
| 1 | `/dashboard/admin/addons` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/addons/page.tsx>) | الإضافات |
| 2 | `/dashboard/admin/aqlam` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/page.tsx>) | الصندوق |
| 3 | `/dashboard/admin/aqlam/people` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/people/page.tsx>) | الحسابات |
| 4 | `/dashboard/admin/aqlam/posts` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/posts/page.tsx>) | كل النصوص |
| 5 | `/dashboard/admin/aqlam/settings` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/settings/page.tsx>) | الإعدادات |
| 6 | `/dashboard/admin/audit-logs` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/audit-logs/page.tsx>) | السجلات والتدقيق |
| 7 | `/dashboard/admin/bookings/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/[id]/page.tsx>) | Not a direct tab |
| 8 | `/dashboard/admin/bookings/calendar` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/calendar/page.tsx>) | التقويم |
| 9 | `/dashboard/admin/bookings/change-requests` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/change-requests/page.tsx>) | طلبات تغيير المواعيد |
| 10 | `/dashboard/admin/bookings` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/page.tsx>) | الحجوزات |
| 11 | `/dashboard/admin/content/ads` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/ads/page.tsx>) | الإعلانات |
| 12 | `/dashboard/admin/content/blog/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/blog/[id]/page.tsx>) | Not a direct tab |
| 13 | `/dashboard/admin/content/blog/new` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/blog/new/page.tsx>) | Not a direct tab |
| 14 | `/dashboard/admin/content/blog` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/blog/page.tsx>) | المدونة |
| 15 | `/dashboard/admin/content/images` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/images/page.tsx>) | صور الموقع |
| 16 | `/dashboard/admin/content/pages` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/pages/page.tsx>) | محتوى الصفحات |
| 17 | `/dashboard/admin/content/settings` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/settings/page.tsx>) | الإعدادات العامة |
| 18 | `/dashboard/admin/content/testimonials` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/testimonials/page.tsx>) | آراء العملاء |
| 19 | `/dashboard/admin/feedback/creative-writing` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/feedback/creative-writing/page.tsx>) | آراء العملاء |
| 20 | `/dashboard/admin/feedback/enha-lak` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/feedback/enha-lak/page.tsx>) | آراء العملاء |
| 21 | `/dashboard/admin/finance/discount-codes` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/discount-codes/page.tsx>) | أكواد الخصم |
| 22 | `/dashboard/admin/finance/instructor-payouts/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/instructor-payouts/[id]/page.tsx>) | Not a direct tab |
| 23 | `/dashboard/admin/finance/instructor-payouts` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/instructor-payouts/page.tsx>) | مستحقات المدربين |
| 24 | `/dashboard/admin/finance/publisher-payouts/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/publisher-payouts/[id]/page.tsx>) | Not a direct tab |
| 25 | `/dashboard/admin/finance/publisher-payouts` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/publisher-payouts/page.tsx>) | مستحقات الناشرين |
| 26 | `/dashboard/admin/finance/withdrawals` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/withdrawals/page.tsx>) | طلبات السحب |
| 27 | `/dashboard/admin/instructors/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/[id]/page.tsx>) | Not a direct tab |
| 28 | `/dashboard/admin/instructors/[id]/sessions` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/[id]/sessions/page.tsx>) | Not a direct tab |
| 29 | `/dashboard/admin/instructors/media` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/media/page.tsx>) | Redirect → `/dashboard/admin/instructors/review` |
| 30 | `/dashboard/admin/instructors` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/page.tsx>) | المدربون |
| 31 | `/dashboard/admin/instructors/review` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/review/page.tsx>) | مراجعة الملفات |
| 32 | `/dashboard/admin/join-requests/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/join-requests/[id]/page.tsx>) | Not a direct tab |
| 33 | `/dashboard/admin/join-requests` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/join-requests/page.tsx>) | طلبات الانضمام |
| 34 | `/dashboard/admin/media` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/media/page.tsx>) | مخزن الصور |
| 35 | `/dashboard/admin/notifications` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/notifications/page.tsx>) | الإشعارات |
| 36 | `/dashboard/admin/notifications/send` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/notifications/send/page.tsx>) | Not a direct tab |
| 37 | `/dashboard/admin/notifications/types` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/notifications/types/page.tsx>) | Not a direct tab |
| 38 | `/dashboard/admin/orders/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/[id]/page.tsx>) | Not a direct tab |
| 39 | `/dashboard/admin/orders` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/page.tsx>) | الطلبات |
| 40 | `/dashboard/admin/orders/services/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/services/[id]/page.tsx>) | Not a direct tab |
| 41 | `/dashboard/admin/orders/services` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/services/page.tsx>) | الطلبات |
| 42 | `/dashboard/admin` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/page.tsx>) | Not a direct tab |
| 43 | `/dashboard/admin/products/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/[id]/page.tsx>) | Not a direct tab |
| 44 | `/dashboard/admin/products/customization-fields` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/customization-fields/page.tsx>) | خانات التخصيص |
| 45 | `/dashboard/admin/products/hero-order` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/hero-order/page.tsx>) | ترتيب «أنت البطل هنا» |
| 46 | `/dashboard/admin/products/new` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/new/page.tsx>) | Not a direct tab |
| 47 | `/dashboard/admin/products` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/page.tsx>) | منتجات الناشرين |
| 48 | `/dashboard/admin/products/platform/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/platform/[id]/page.tsx>) | Not a direct tab |
| 49 | `/dashboard/admin/products/platform/new` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/platform/new/page.tsx>) | Not a direct tab |
| 50 | `/dashboard/admin/products/platform` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/platform/page.tsx>) | المنتجات |
| 51 | `/dashboard/admin/products/review` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/review/page.tsx>) | مراجعة المنتجات |
| 52 | `/dashboard/admin/products/story-goals` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/story-goals/page.tsx>) | أهداف التخصيص |
| 53 | `/dashboard/admin/products/writing-dialects` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/writing-dialects/page.tsx>) | لهجات الكتابة |
| 54 | `/dashboard/admin/promotions` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/promotions/page.tsx>) | العروض والخصومات |
| 55 | `/dashboard/admin/providers` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/providers/page.tsx>) | مقدّمو الخدمة |
| 56 | `/dashboard/admin/publishers/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/publishers/[id]/page.tsx>) | Not a direct tab |
| 57 | `/dashboard/admin/publishers` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/publishers/page.tsx>) | دور النشر |
| 58 | `/dashboard/admin/reviews` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/reviews/page.tsx>) | التقييمات |
| 59 | `/dashboard/admin/rooms` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/rooms/page.tsx>) | الغرف المباشرة |
| 60 | `/dashboard/admin/sessions/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/sessions/[id]/page.tsx>) | Not a direct tab |
| 61 | `/dashboard/admin/sessions` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/sessions/page.tsx>) | الجلسات والتقارير |
| 62 | `/dashboard/admin/settings/pricing` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/settings/pricing/page.tsx>) | التسعير والمدفوعات |
| 63 | `/dashboard/admin/settings/shipping` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/settings/shipping/page.tsx>) | أسعار الشحن |
| 64 | `/dashboard/admin/studio/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/studio/[id]/page.tsx>) | Not a direct tab |
| 65 | `/dashboard/admin/studio` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/studio/page.tsx>) | استوديو القصص |
| 66 | `/dashboard/admin/studio/settings` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/studio/settings/page.tsx>) | إعدادات الاستوديو |
| 67 | `/dashboard/admin/subscriptions/box/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/[id]/page.tsx>) | Not a direct tab |
| 68 | `/dashboard/admin/subscriptions/box` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/page.tsx>) | الاشتراكات |
| 69 | `/dashboard/admin/subscriptions/box/plans` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/plans/page.tsx>) | الخطط |
| 70 | `/dashboard/admin/subscriptions/box/shipments` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/shipments/page.tsx>) | صناديق الشهر |
| 71 | `/dashboard/admin/subscriptions/courses` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/courses/page.tsx>) | اشتراكات الباقات |
| 72 | `/dashboard/admin/support/session-requests` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/support/session-requests/page.tsx>) | طلبات الجلسات المخصصة |
| 73 | `/dashboard/admin/support/tickets/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/support/tickets/[id]/page.tsx>) | Not a direct tab |
| 74 | `/dashboard/admin/support/tickets` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/support/tickets/page.tsx>) | رسائل الدعم |
| 75 | `/dashboard/admin/tasks/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/tasks/[id]/page.tsx>) | Not a direct tab |
| 76 | `/dashboard/admin/tasks/assignments` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/tasks/assignments/page.tsx>) | Redirect → `/dashboard/admin/tasks/workflow` |
| 77 | `/dashboard/admin/tasks` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/tasks/page.tsx>) | مهامي |
| 78 | `/dashboard/admin/tasks/steps` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/tasks/steps/page.tsx>) | Redirect → `/dashboard/admin/tasks/workflow` |
| 79 | `/dashboard/admin/tasks/workflow` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/tasks/workflow/page.tsx>) | سير العمل والتوزيع |
| 80 | `/dashboard/admin/users/[id]/children` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/users/[id]/children/page.tsx>) | Not a direct tab |
| 81 | `/dashboard/admin/users/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/users/[id]/page.tsx>) | Not a direct tab |
| 82 | `/dashboard/admin/users/deletion-requests` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/users/deletion-requests/page.tsx>) | طلبات حذف الحسابات |
| 83 | `/dashboard/admin/users` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/users/page.tsx>) | المستخدمون والعائلات |
| 84 | `/dashboard/admin/users/permissions` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/users/permissions/page.tsx>) | الأدوار والصلاحيات |
| 85 | `/dashboard/admin/writing/packages/[id]` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/writing/packages/[id]/page.tsx>) | Not a direct tab |
| 86 | `/dashboard/admin/writing/packages/new` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/writing/packages/new/page.tsx>) | Not a direct tab |
| 87 | `/dashboard/admin/writing/packages` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/writing/packages/page.tsx>) | باقات الكتابة |
| 88 | `/dashboard/admin/writing/services` | [page.tsx](<../../client/src/app/(admin)/dashboard/admin/writing/services/page.tsx>) | الخدمات |

## Page-local controls and data/action entry points

Generated from literal labels, column headers, module imports and request expressions in each page folder. These are source evidence, not a complete validated form schema. Shared controls (product content, age, galleries, workflow, configuration registries) are linked separately.

### /addons

- [AddonsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/addons/AddonsClient.tsx>): Literal labels: الاسم; السعر للعميل (ج.م); الوصف القصير; الترتيب في القايمة; الصورة الرئيسية; صور فرعية (لحد ٨); الوصف الكامل; نقاط التفاصيل; معروضة للعملاء. Entry points: `@/actions/addons`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/addons/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/products/addons`.

### /aqlam

- [SanctionBox.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/SanctionBox.tsx>): Literal labels: النوع; السبب. Entry points: `@/actions/aqlam`.
- [_shared.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/_shared.tsx>): Entry points: `@/actions/aqlam`, `@/data/domains/(shared)/aqlam/admin`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/page.tsx>): Literal labels: السبب (للرفض); ملاحظة لولي الأمر. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/aqlam/admin`, `@/actions/aqlam`, `@/data/domains/(shared)/aqlam/config`.

### /aqlam/people

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/people/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/settings/queries`, `@/data/domains/(shared)/aqlam/admin`, `@/actions/aqlam`.

### /aqlam/posts

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/posts/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/aqlam/admin`, `@/actions/aqlam`, `@/data/domains/(shared)/aqlam/config`.

### /aqlam/settings

- [_lists.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/settings/_lists.tsx>): Literal labels: الأيقونة; الترتيب; مفعّل; حذف التصنيف; الكود (إنجليزي صغير); الاسم; الرمز; الصياغة. Entry points: `@/actions/aqlam`.
- [_parts.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/settings/_parts.tsx>): Entry points: `@/actions/aqlam`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/aqlam/settings/page.tsx>): Literal labels: الحالة. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/settings/queries`, `@/data/domains/(shared)/aqlam/config`, `@/data/domains/(shared)/aqlam/admin`, `@/actions/aqlam`.

### /audit-logs

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/audit-logs/page.tsx>): Table columns: ID; التاريخ; الإجراء; بواسطة; التفاصيل. Entry points: `@/data/domains/(admin)/audit/queries`, `@/data/domains/(shared)/auth/queries`.

### /bookings/[id]

- [AddSession.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/[id]/AddSession.tsx>): Literal labels: الموعد (بتوقيت القاهرة); المدرب. Entry points: `@/actions/admin-sessions`.
- [AssignInstructor.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/[id]/AssignInstructor.tsx>): Entry points: `@/actions/bookings`.
- [CancelBooking.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/[id]/CancelBooking.tsx>): Literal labels: سبب الإلغاء. Entry points: `@/actions/bookings`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/[id]/page.tsx>): Literal labels: الغرفة جاهزة; بلا غرفة; تأكيد استلام الدفع وتفعيل الحجز. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/bookings/queries`, `@/data/domains/(admin)/instructors/queries`, `@/data/domains/(admin)/sessions/plan`.

### /bookings/calendar

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/calendar/page.tsx>): Table columns: التاريخ; الوقت; رقم الحجز; الطالب; المدرب. Entry points: `@/data/domains/(shared)/participants/queries`, `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/sessions/queries`.

### /bookings/change-requests

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/change-requests/page.tsx>): Literal labels: سبب الرفض (للرفض بس). Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/sessions/changes`, `@/actions/session-change-requests`.

### /bookings

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/bookings/page.tsx>): Literal labels: —. Table columns: الرقم المرجعي; تاريخ الحجز; المشارك; الباقة; المبلغ; المدرب المفضل; الجلسات; موافقة التسجيل; الحالة. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/bookings/queries`.

### /content/ads

- [AdsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/content/ads/AdsClient.tsx>): Literal labels: تعديل; حذف; عنوان الإعلان; اسم المعلن; صورة الإعلان (الكمبيوتر); صورة الموبايل (اختياري); لينك التحويل; يبدأ; ينتهي; ترتيب الظهور; شغّال. Entry points: `@/actions/ads`, `@/data/domains/(admin)/ads/queries`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/ads/page.tsx>): Entry points: `@/data/domains/(admin)/ads/queries`, `@/data/server-time`.

### /content/blog/[id]

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/blog/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/content/blog`.

### /content/blog/new

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/blog/new/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`.

### /content/blog

- [BlogEditor.tsx](<../../client/src/app/(admin)/dashboard/admin/content/blog/BlogEditor.tsx>): Literal labels: عنوان المقال; الرابط (يُولَّد من العنوان إذا تُرك فارغًا); المقتطف; وصف محركات البحث (SEO); اسم الكاتب; موعد النشر (بتوقيت القاهرة). Entry points: `@/actions/blog`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/blog/page.tsx>): Table columns: العنوان; الكاتب; تاريخ النشر / الموعد; الحالة. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/content/page-data`.

### /content/images

- [SiteImagesClient.tsx](<../../client/src/app/(admin)/dashboard/admin/content/images/SiteImagesClient.tsx>): Entry points: `@/actions/content`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/images/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/settings/queries`.

### /content/pages

- [PageContentClient.tsx](<../../client/src/app/(admin)/dashboard/admin/content/pages/PageContentClient.tsx>): Entry points: `@/actions/content`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/pages/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/content/queries`.

### /content/settings

- [SettingsForm.tsx](<../../client/src/app/(admin)/dashboard/admin/content/settings/SettingsForm.tsx>): Entry points: `@/actions/content`.
- [WatermarkFields.tsx](<../../client/src/app/(admin)/dashboard/admin/content/settings/WatermarkFields.tsx>): Literal labels: حط العلامة على صور الموقع والمنتجات; الكتابة; نوع العلامة; درجة الوضوح; اللون; الحجم; المكان.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/settings/page.tsx>): Literal labels: اسم الموقع; بريد التواصل; رقم التليفون; رقم الواتساب; مواعيد العمل; العنوان; رابط فيسبوك; رابط إنستجرام; امسح الصور المتسابة تلقائيًا; بعد كام يوم متسابة; تتمسح بعد كام يوم; تتمسح بعد كام يوم من انتهاء الطلب; نص التنبيه; يختفي تلقائيًا في; شغّال دلوقتي; إلغاء الطلب بعد (أيام); نبّه لو الحصيلة المقترحة أعلى من (ج.م); سجّل جلسات «بداية الرحلة»; مدة الاحتفاظ بالتسجيل قبل الحذف. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/settings/queries`.

### /content/testimonials

- [TestimonialsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/content/testimonials/TestimonialsClient.tsx>): Literal labels: اسم صاحب الرأي; صفته; يظهر في; نص الرأي. Entry points: `@/actions/content`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/content/testimonials/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/content/testimonials`.

### /feedback/creative-writing


### /feedback/enha-lak


### /finance/discount-codes

- [DiscountCodesClient.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/discount-codes/DiscountCodesClient.tsx>): Literal labels: الكود; نسبة الخصم ٪; يبدأ من; لحد; عدد الاستخدامات كله; ملاحظة للإدارة; شغّال. Entry points: `@/data/domains/(admin)/finance/discount-codes`, `@/actions/discount-codes`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/discount-codes/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/finance/discount-codes`.

### /finance/instructor-payouts/[id]

- [AdminPayoutClient.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/instructor-payouts/[id]/AdminPayoutClient.tsx>): Entry points: `@/actions/finance`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/instructor-payouts/[id]/page.tsx>): Entry points: `@/data/domains/(admin)/finance/queries`, `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/instructors/queries`.

### /finance/instructor-payouts

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/instructor-payouts/page.tsx>): Literal labels: مدفوع; معلق. Table columns: الرقم; المدرب; الفترة; المبلغ; الحالة. Entry points: `@/data/domains/(admin)/finance/queries`, `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/instructors/queries`.

### /finance/publisher-payouts/[id]

- [AdminPublisherPayoutClient.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/publisher-payouts/[id]/AdminPublisherPayoutClient.tsx>): Entry points: `@/actions/finance`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/publisher-payouts/[id]/page.tsx>): Entry points: `@/data/domains/(admin)/finance/queries`, `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/publishers/queries`.

### /finance/publisher-payouts

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/publisher-payouts/page.tsx>): Literal labels: مدفوع; معلق. Table columns: الرقم; الناشر; الفترة; المبلغ; الحالة; الإجراء. Entry points: `@/data/domains/(admin)/finance/queries`, `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/publishers/queries`.

### /finance/withdrawals

- [WithdrawalsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/withdrawals/WithdrawalsClient.tsx>): Literal labels: سبب الرفض (يصل للمدرب). Entry points: `@/data/domains/(admin)/finance/types`, `@/actions/withdrawals`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/finance/withdrawals/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/finance/queries`.

### /instructors/[id]

- [AdminInstructorClient.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/[id]/AdminInstructorClient.tsx>): Literal labels: اجتاز التدريب والاختبار بنجاح; كلمة المرور الجديدة (8 أحرف أو أرقام على الأقل). Entry points: `@/actions/instructors`, `@/actions/admin-instructors`.
- [InstructorProfileEditor.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/[id]/InstructorProfileEditor.tsx>): Literal labels: الاسم المعروض; سنوات الخبرة; النبذة; التخصصات (مفصولة بفاصلة). Entry points: `@/actions/instructors`.
- [InstructorServicesSection.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/[id]/InstructorServicesSection.tsx>): Literal labels: حصيلة المدرب (ج.م); مفعّلة; سبب الرفض (يصل للمدرب). Entry points: `@/actions/instructor-services`.
- [TransferWorkPanel.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/[id]/TransferWorkPanel.tsx>): Entry points: `@/actions/instructors`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/instructors/queries`, `@/data/domains/(admin)/instructors/profile-updates`, `@/data/domains/(admin)/instructors/certification`, `@/data/domains/(shared)/pricing/queries`, `@/data/domains/(shared)/services/queries`, `@/data/domains/(shared)/writing/packages`, `@/data/domains/(shared)/instructors/public`, `@/data/domains/(admin)/instructors/media`.

### /instructors/[id]/sessions

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/[id]/sessions/page.tsx>): Table columns: الجلسة; الرقم المرجعي; الباقة; تاريخ الجلسة; الحالة. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/instructors/queries`, `@/data/domains/(shared)/sessions/queries`.

### /instructors/media


### /instructors

- [InstructorsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/InstructorsClient.tsx>): Literal labels: نشط; موقوف; مخفي — شغّال; بانتظار الاعتماد; قيد التدريب; ملفه لسه ناقص; طلب مراجعة; اجتاز; لم يجتز; حالة الحساب; طلب المراجعة; التدريب; الخدمات الإبداعية; نظام العمل; البريد الإلكتروني; الاسم الكامل; الاسم المعروض للطلاب; سنوات الخبرة; التخصصات (مفصولة بفاصلة); كلمة المرور الأولية (اختياري); نبذة. Table columns: الاسم; التخصص; نظام العمل; التدريب; الخدمات الإبداعية; المراجعة; الحساب. Entry points: `@/actions/admin-instructors`, `@/data/domains/(admin)/instructors/types`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/instructors/queries`.

### /instructors/review

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/instructors/review/page.tsx>): Literal labels: سبب السحب; مدرب جديد — ملفه الأول; سبب الرفض. Entry points: `@/data/domains/(admin)/instructors/media`, `@/data/domains/(shared)/instructors/media-types`, `@/data/domains/(shared)/writing/packages`, `@/actions/instructor-media`, `@/actions/instructor-review`.

### /join-requests/[id]

- [JoinInstructorAccount.tsx](<../../client/src/app/(admin)/dashboard/admin/join-requests/[id]/JoinInstructorAccount.tsx>): Entry points: `@/actions/admin-instructors`.
- [JoinRequestActions.tsx](<../../client/src/app/(admin)/dashboard/admin/join-requests/[id]/JoinRequestActions.tsx>): Entry points: `@/actions/join-requests`.
- [JoinRequestThread.tsx](<../../client/src/app/(admin)/dashboard/admin/join-requests/[id]/JoinRequestThread.tsx>): Literal labels: رسالة للمتقدّم. Entry points: `@/actions/join-requests`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/join-requests/[id]/page.tsx>): Entry points: `@/data/domains/(admin)/join-requests/queries`, `@/data/domains/(shared)/auth/queries`.

### /join-requests

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/join-requests/page.tsx>): Literal labels: مقبول — الحساب لسه ما اتعملش. Table columns: الاسم; الدور المطلوب; تاريخ التقديم; الحالة. Entry points: `@/data/domains/(admin)/join-requests/queries`, `@/data/domains/(shared)/auth/queries`.

### /media

- [OrphanGallery.tsx](<../../client/src/app/(admin)/dashboard/admin/media/OrphanGallery.tsx>): Literal labels: راجعت الصور دي، ومفيش منها حاجة المفروض ترجع مكانها في الموقع. Entry points: `@/actions/media`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/media/page.tsx>): Literal labels: مستخدمة في الموقع; مش مستخدمة حاليًا. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/media/queries`, `@/data/domains/(admin)/media/cleanup`, `@/data/domains/(shared)/settings/queries`.

### /notifications

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/notifications/page.tsx>): Literal labels: آخر إشعارات; لسه مش متقروءة; مستلمين مختلفين. Table columns: العنوان; المستلِم; التاريخ; الحالة. Entry points: `@/data/domains/(shared)/auth/queries`.

### /notifications/send

- [SendForm.tsx](<../../client/src/app/(admin)/dashboard/admin/notifications/send/SendForm.tsx>): Literal labels: يروح لمين; العنوان. Entry points: `@/actions/notifications-admin`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/notifications/send/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`.

### /notifications/types

- [TypesForm.tsx](<../../client/src/app/(admin)/dashboard/admin/notifications/types/TypesForm.tsx>): Entry points: `@/actions/notifications-admin`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/notifications/types/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`.

### /orders/[id]

- [ElectronicDeliveryPanel.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/[id]/ElectronicDeliveryPanel.tsx>): Entry points: `@/actions/admin-orders`.
- [FulfilmentPanel.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/[id]/FulfilmentPanel.tsx>): Literal labels: رقم الشحنة أو اسم شركة الشحن (يصل للعميل); سبب الإلغاء (يصل للعميل). Entry points: `@/actions/admin-orders`.
- [StudioOrderPanel.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/[id]/StudioOrderPanel.tsx>): Entry points: `@/data/domains/(admin)/studio/queries`, `@/actions/studio`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/orders/detail`.

### /orders

- [OrdersClient.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/OrdersClient.tsx>): Literal labels: بحث; الحالة; كود الخصم; فيه نسخة إلكترونية. Table columns: رقم الطلب; العميل; المنتجات والإضافات; كود الخصم; الإجمالي; الحالة.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/orders/page-data`.

### /orders/services/[id]

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/services/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/service-orders/queries`, `@/data/domains/(shared)/service-orders/messages`.

### /orders/services

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/orders/services/page.tsx>): Table columns: رقم الطلب; معرّف المشتري; الخدمة; مقدّم الخدمة; تاريخ الدفع; المبلغ الإجمالي; المهلة; الحالة. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/service-orders/queries`.

### /

- [layout.tsx](<../../client/src/app/(admin)/dashboard/admin/layout.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/page.tsx>): Literal labels: طلبات آخر ٧ أيام; إجمالي الطلبات; إجمالي الحجوزات; باقات نشطة; المدربون; مقال جديد; باقة جديدة; منتج جديد للمنصة; إرسال إشعار; الإعدادات وشريط التنبيه; صور الموقع; أسعار الشحن; المستخدمون; مقالات منشورة; مقالات مجدولة أو مسودّة; آراء عملاء. Table columns: الرقم المرجعي; العميل; المبلغ; التاريخ. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/reviews/queue`, `@/data/domains/(admin)/orders/queries`, `@/data/domains/(admin)/instructors/queries`, `@/data/domains/(shared)/sessions/queries`, `@/data/domains/(shared)/writing/packages`, `@/data/domains/(admin)/content/blog`, `@/data/domains/(shared)/content/testimonials`, `@/data/domains/(shared)/settings/queries`, `@/data/domains/(admin)/audit/queries`, `@/data/domains/(admin)/dashboard/timing`.

### /products/[id]

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/products/queries`, `@/data/domains/(shared)/publishers/queries`, `@/data/domains/(shared)/pricing/queries`, `@/actions/products`.

### /products/customization-fields

- [CustomizationFieldsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/products/customization-fields/CustomizationFieldsClient.tsx>): Literal labels: اسم الخانة; مثال جوّه الخانة; إلزامية; ظاهرة للعملاء. Entry points: `@/actions/customization-fields`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/customization-fields/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/products/customization-fields`, `@/data/domains/(admin)/products/customization-fields`, `@/data/domains/(shared)/products/queries`.

### /products/hero-order

- [HeroOrderClient.tsx](<../../client/src/app/(admin)/dashboard/admin/products/hero-order/HeroOrderClient.tsx>): Entry points: `@/actions/product-order`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/hero-order/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/products/queries`.

### /products/new


### /products

- [NewProductPage.tsx](<../../client/src/app/(admin)/dashboard/admin/products/NewProductPage.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/publishers/queries`, `@/data/domains/(shared)/pricing/queries`.
- [ProductEditFormClient.tsx](<../../client/src/app/(admin)/dashboard/admin/products/ProductEditFormClient.tsx>): Literal labels: اسم المنتج; النوع / التصنيف; دار النشر; الوصف; صورة الغلاف. Entry points: `@/actions/products`.
- [ProductFormClient.tsx](<../../client/src/app/(admin)/dashboard/admin/products/ProductFormClient.tsx>): Literal labels: اسم المنتج; النوع / التصنيف; دار النشر; الوصف; صورة الغلاف. Entry points: `@/actions/products`.
- [ProductListPage.tsx](<../../client/src/app/(admin)/dashboard/admin/products/ProductListPage.tsx>): Literal labels: من غير دار نشر. Table columns: اسم المنتج; النوع; دار النشر; السنّ; السعر; الحالة. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/products/queries`, `@/data/domains/(shared)/publishers/queries`.
- [ProductStateToggle.tsx](<../../client/src/app/(admin)/dashboard/admin/products/ProductStateToggle.tsx>): Entry points: `@/actions/products`.

### /products/platform/[id]


### /products/platform/new


### /products/platform


### /products/review

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/review/page.tsx>): Literal labels: موقوف; سبب الرفض. Entry points: `@/data/domains/(admin)/products/queries`, `@/actions/products`.

### /products/story-goals

- [StoryGoalsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/products/story-goals/StoryGoalsClient.tsx>): Literal labels: الهدف; ظاهر للعملاء. Entry points: `@/actions/story-goals`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/story-goals/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/products/story-goals`, `@/data/domains/(shared)/products/queries`.

### /products/writing-dialects

- [WritingDialectsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/products/writing-dialects/WritingDialectsClient.tsx>): Literal labels: فعّالة. Entry points: `@/data/domains/(admin)/writing/queries`, `@/actions/writing-dialects`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/products/writing-dialects/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/writing/queries`.

### /promotions

- [PromotionsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/promotions/PromotionsClient.tsx>): Literal labels: ينطبق على; العنصر; نوع الخصم; يبدأ (بتوقيت القاهرة); ينتهي (بتوقيت القاهرة); عنوان على الشارة (اختياري). Entry points: `@/data/domains/(admin)/promotions/queries`, `@/actions/promotions`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/promotions/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/promotions/queries`.

### /providers

- [ProvidersClient.tsx](<../../client/src/app/(admin)/dashboard/admin/providers/ProvidersClient.tsx>): Literal labels: الحساب; الاسم المعروض للعميل; نبذة قصيرة تظهر في قايمة الاختيار; الاسم المعروض; نبذة; الحالة; ظاهر. Entry points: `@/actions/providers`, `@/data/domains/(admin)/providers/queries`.
- [TransferProviderPanel.tsx](<../../client/src/app/(admin)/dashboard/admin/providers/TransferProviderPanel.tsx>): Entry points: `@/actions/providers`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/providers/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/providers/queries`, `@/data/domains/(shared)/services/queries`, `@/data/domains/(shared)/pricing/queries`.

### /publishers/[id]

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/publishers/[id]/page.tsx>): Table columns: اسم المنتج; النوع; السعر; الحالة. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/products/queries`, `@/data/domains/(shared)/publishers/queries`.

### /publishers

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/publishers/page.tsx>): Table columns: الاسم; الوصف. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/publishers/queries`.

### /reviews

- [AdminReviewsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/reviews/AdminReviewsClient.tsx>): Literal labels: سبب الإخفاء (يُسجَّل في سجل التدقيق). Entry points: `@/data/domains/(shared)/reviews/types`, `@/actions/reviews`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/reviews/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/reviews/queries`.

### /rooms

- [RecordingsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/rooms/RecordingsClient.tsx>): Entry points: `@/actions/recordings`.
- [RoomsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/rooms/RoomsClient.tsx>): Entry points: `@/actions/rooms`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/rooms/page.tsx>): Literal labels: الغرفة جاهزة; بلا غرفة; بتتسجّل; مش بتتسجّل; هيتمسح في أقرب تشغيل; محفوظ; جلسات الشهر; أطول جلسة; المتوقّع آخر الشهر. Table columns: المشارك; الجلسة; دخل الساعة; قاعد; المدرب; اتسجّل; المدة; الحالة; الموعد; الغرفة; التسجيل. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/sessions/queries`, `@/data/domains/(shared)/settings/queries`, `@/data/domains/(admin)/dashboard/timing`.

### /sessions/[id]

- [SessionSettings.tsx](<../../client/src/app/(admin)/dashboard/admin/sessions/[id]/SessionSettings.tsx>): Entry points: `@/actions/admin-sessions`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/sessions/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/sessions/attachments`, `@/data/domains/(shared)/sessions/messages`, `@/data/domains/(shared)/sessions/queries`, `@/data/domains/(admin)/instructors/queries`, `@/data/domains/(shared)/writing/packages`, `@/data/domains/(shared)/sessions/reports`, `@/data/domains/(shared)/participants/queries`, `@/data/domains/(shared)/auth/queries`.

### /sessions

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/sessions/page.tsx>): Table columns: الجلسة; الرقم المرجعي; المتدرب; الباقة; المدرب; الموعد; الحالة; التقرير. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/sessions/queries`.

### /settings/pricing

- [PaymentQrUploader.tsx](<../../client/src/app/(admin)/dashboard/admin/settings/pricing/PaymentQrUploader.tsx>): Entry points: `@/actions/payments`.
- [PaymentSettingsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/settings/pricing/PaymentSettingsClient.tsx>): Literal labels: رسالة تظهر للعميل لو البوابة وقعت; رقم المحفظة (إنستاباي / فودافون كاش). Entry points: `@/actions/payments`.
- [PricingFormulaEditor.tsx](<../../client/src/app/(admin)/dashboard/admin/settings/pricing/PricingFormulaEditor.tsx>): Literal labels: مضاعف المنصة; الرسوم الثابتة للمنصة (ج.م).
- [PricingTabsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/settings/pricing/PricingTabsClient.tsx>): Entry points: `@/actions/instructors`, `@/actions/finance`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/settings/pricing/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/pricing/queries`, `@/actions/payments`.

### /settings/shipping

- [ShippingRatesClient.tsx](<../../client/src/app/(admin)/dashboard/admin/settings/shipping/ShippingRatesClient.tsx>): Literal labels: التوصيل متوقف حاليًا; رسالة للعميل (اختيارية); توصيل المطبوع; النسخة الإلكترونية; رسالة الإغلاق للعميل; الدولة; إضافة محافظة لهذه الدولة; المحافظة; المنطقة / المدينة; السعر (ج.م); مفعّلة; سعر تقديري. Entry points: `@/data/domains/(admin)/shipping/queries`, `@/data/domains/(shared)/shipping/types`, `@/actions/shipping`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/settings/shipping/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/shipping/queries`.

### /studio/[id]

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/studio/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/studio/queries`, `@/actions/studio`.
- [panels.tsx](<../../client/src/app/(admin)/dashboard/admin/studio/[id]/panels.tsx>): Literal labels: الفئة العمرية; عدد الصفحات المستهدف; شكل الوجه; موضوع حسّاس (نفسي/أسري); إزاي ومتى ولي الأمر وافق؟; المحرّر; المشرف الفني; موعد التسليم; نص القصة; مصدر المسودة; ملاحظة (اختياري); قرار العميل — إزاي ومتى؟; وصف الشخصية (الملامح، الملابس، الألوان); رابط صورة المرجع; رقم الصفحة (٠ = الغلاف); نص الصفحة; وصف المشهد; رابط صورة الصفحة; ملاحظة المراجعة (إلزامية مع الإعادة); النوع; المبلغ; دقائق عمل (اختياري); ملاحظة. Entry points: `@/data/domains/(admin)/studio/queries`, `@/actions/studio`.

### /studio

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/studio/page.tsx>): Literal labels: الطلب اتلغى — محتاج قرار. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/studio/queries`.

### /studio/settings

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/studio/settings/page.tsx>): Literal labels: الحالة. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/studio/queries`, `@/data/domains/(admin)/tasks/queries`, `@/actions/studio`.

### /subscriptions/box/[id]

- [ShipmentsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/[id]/ShipmentsClient.tsx>): Entry points: `@/actions/box-subscriptions`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/subscriptions/box`, `@/data/domains/(shared)/products/story-goals`.

### /subscriptions/box

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/page.tsx>): Literal labels: نشط; متوقف مؤقتاً; ملغى. Table columns: الاشتراك; المشترك; الخطة; الشحنات; الشحنة الجاية; الحالة. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/subscriptions/box`.

### /subscriptions/box/plans

- [BoxPlansClient.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/plans/BoxPlansClient.tsx>): Literal labels: اسم الباقة; المدة بالأشهر; السعر الإجمالي (ج.م); السعر الشهري المعروض (ج.م); ملاحظة التوفير; خصم المشترك على الإضافات ٪; إضافة مجانية في كل صندوق; ترتيب العرض; وصف مختصر; مزايا الباقة; الأكثر اختيارًا; ظاهرة للعملاء. Entry points: `@/actions/box-plans`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/plans/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/subscriptions/plans`, `@/data/domains/(shared)/products/addons`.

### /subscriptions/box/shipments

- [DueShipmentsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/shipments/DueShipmentsClient.tsx>): Entry points: `@/data/domains/(shared)/subscriptions/types`, `@/actions/box-subscriptions`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/box/shipments/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/subscriptions/shipments`.

### /subscriptions/courses

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/subscriptions/courses/page.tsx>): Table columns: رقم الاشتراك; المشارك; الباقة; تاريخ البدء; الحالة. Entry points: `@/data/domains/(shared)/participants/queries`, `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/bookings/queries`.

### /support/session-requests

- [SessionRequestsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/support/session-requests/SessionRequestsClient.tsx>): Entry points: `@/actions/support`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/support/session-requests/page.tsx>): Entry points: `@/data/domains/(admin)/support/queries`, `@/data/domains/(shared)/auth/queries`.

### /support/tickets/[id]

- [TicketActions.tsx](<../../client/src/app/(admin)/dashboard/admin/support/tickets/[id]/TicketActions.tsx>): Entry points: `@/actions/support`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/support/tickets/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/support/queries`, `@/data/domains/(admin)/support/queries`, `@/data/domains/(shared)/auth/queries`.

### /support/tickets

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/support/tickets/page.tsx>): Table columns: رقم التذكرة; المُرسل; الموضوع; التاريخ; الحالة. Entry points: `@/data/domains/(admin)/support/queries`, `@/data/domains/(shared)/auth/queries`.

### /tasks/[id]

- [TaskControls.tsx](<../../client/src/app/(admin)/dashboard/admin/tasks/[id]/TaskControls.tsx>): Literal labels: موعد التسليم (بتوقيت القاهرة); الأولوية; ملاحظة. Entry points: `@/actions/work-tasks`, `@/data/domains/(admin)/tasks/queries`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/tasks/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/tasks/queries`.

### /tasks/assignments


### /tasks

- [TasksClient.tsx](<../../client/src/app/(admin)/dashboard/admin/tasks/TasksClient.tsx>): Literal labels: النوع; المرحلة; المسؤول; سنّدها لـ. Entry points: `@/data/domains/(admin)/tasks/queries`, `@/actions/work-tasks`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/tasks/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/tasks/queries`.

### /tasks/steps


### /tasks/workflow

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/tasks/workflow/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/tasks/queries`, `@/data/domains/(admin)/studio/queries`.

### /users/[id]/children

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/users/[id]/children/page.tsx>): Table columns: الاسم; العمر. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/dashboard/timing`.

### /users/[id]

- [AdminUserDetailClient.tsx](<../../client/src/app/(admin)/dashboard/admin/users/[id]/AdminUserDetailClient.tsx>): Literal labels: كلمة المرور الجديدة (8 أحرف أو أرقام على الأقل); اختر الدور الجديد:. Table columns: رقم الطلب; التاريخ; عدد المنتجات; الإجمالي; الحالة; رقم التتبع; إجراء; اسم الخدمة; المدرب; المبلغ; الجلسة; الباقة; الموعد; الموضوع; القسم. Entry points: `@/actions/admin-users`.
- [DeleteAccountPanel.tsx](<../../client/src/app/(admin)/dashboard/admin/users/[id]/DeleteAccountPanel.tsx>): Literal labels: سبب الحذف. Entry points: `@/actions/admin-users`.
- [SuspensionPanel.tsx](<../../client/src/app/(admin)/dashboard/admin/users/[id]/SuspensionPanel.tsx>): Literal labels: السبب. Entry points: `@/actions/admin-users`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/users/[id]/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(admin)/users/auth`, `@/data/domains/(admin)/dashboard/timing`, `@/actions/admin-users`.

### /users/deletion-requests

- [DeletionRequestsClient.tsx](<../../client/src/app/(admin)/dashboard/admin/users/deletion-requests/DeletionRequestsClient.tsx>): Literal labels: ملاحظة الإدارة. Entry points: `@/actions/account-deletion`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/users/deletion-requests/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`.

### /users

- [UsersClient.tsx](<../../client/src/app/(admin)/dashboard/admin/users/UsersClient.tsx>): Literal labels: ولي أمر; الدور; البريد; الحالة; البريد الإلكتروني; الاسم الكامل. Table columns: الاسم; البريد الإلكتروني; الدور; ولي أمر; الإجراءات. Entry points: `@/actions/admin-users`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/users/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`.

### /users/permissions

- [PermissionsEditor.tsx](<../../client/src/app/(admin)/dashboard/admin/users/permissions/PermissionsEditor.tsx>): Literal labels: اسم الدور; اسم الدور الجديد. Entry points: `@/actions/admin-permissions`, `@/data/domains/(shared)/auth/queries`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/users/permissions/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`.

### /writing/packages/[id]

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/writing/packages/[id]/page.tsx>): Literal labels: اسم الباقة; الفئة العمرية; المسار; الوصف القصير; الفئة المستهدفة; الوصف الكامل; السعر (ج.م); عدد الجلسات; مدة الجلسة; مدة البرنامج الإجمالية (نص); ملاحظة المتطلبات السابقة; الباقة نشطة ومتاحة للحجز. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/writing/packages`, `@/actions/writing`.

### /writing/packages/new

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/writing/packages/new/page.tsx>): Literal labels: اسم الباقة; الفئة العمرية; المسار; الوصف القصير; الفئة المستهدفة; الوصف الكامل; السعر (ج.م); عدد الجلسات; مدة الجلسة; مدة البرنامج الإجمالية (نص); ملاحظة المتطلبات السابقة; الباقة نشطة ومتاحة للحجز. Entry points: `@/data/domains/(shared)/auth/queries`, `@/actions/writing`.

### /writing/packages

- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/writing/packages/page.tsx>): Literal labels: نشط; غير نشط. Table columns: اسم الباقة; عدد الجلسات; السعر; الحالة. Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/writing/packages`.

### /writing/services

- [ServicesManagerClient.tsx](<../../client/src/app/(admin)/dashboard/admin/writing/services/ServicesManagerClient.tsx>): Literal labels: اسم الخدمة; التصنيف; السعر (ج.م); نوع السعر; مدة التسليم (أيام); ترتيب العرض; الوصف القصير; صورة الخدمة; عن الخدمة; هتاخد إيه; محتاجين منك إيه; نماذج من شغل قبل كده; تسمح برفع ملفات; أقصى حجم للملف (ميجا). Entry points: `@/actions/standalone-services`.
- [page.tsx](<../../client/src/app/(admin)/dashboard/admin/writing/services/page.tsx>): Entry points: `@/data/domains/(shared)/auth/queries`, `@/data/domains/(shared)/services/queries`.

## Shared field and registry sources

- [client/src/components/dashboard/ProductContentFields.tsx](<../../client/src/components/dashboard/ProductContentFields.tsx>).
- [client/src/components/dashboard/ProductAgeFields.tsx](<../../client/src/components/dashboard/ProductAgeFields.tsx>).
- [client/src/components/dashboard/ElectronicPriceField.tsx](<../../client/src/components/dashboard/ElectronicPriceField.tsx>).
- [client/src/components/dashboard/WritingStylesField.tsx](<../../client/src/components/dashboard/WritingStylesField.tsx>).
- [client/src/components/dashboard/GalleryField.tsx](<../../client/src/components/dashboard/GalleryField.tsx>).
- [client/src/components/admin/WorkflowEditor.tsx](<../../client/src/components/admin/WorkflowEditor.tsx>).
- [client/src/lib/site-content.ts](<../../client/src/lib/site-content.ts>).
- [client/src/lib/aqlam/config.ts](<../../client/src/lib/aqlam/config.ts>).
- [client/src/lib/admin-nav.ts](<../../client/src/lib/admin-nav.ts>).
