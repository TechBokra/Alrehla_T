# Resource pages and dialog forms

## Live staging pages

- `/catalog/products`: platform-owned `personalized_products`, with library/custom editing.
- `/catalog/addons`: `addon_products` with inclusive customization pricing.

Both pages use the root Refine/Supabase provider, shared session, existing admin route guard, and database RLS. The shared admin layout adds catalog navigation without introducing another Refine context. Showcase/form-prototype data remains local.

## Reusing the pattern

`components/resources/ResourcePage` (file: `resource-page.tsx`) composes the title, search/filter/sort toolbar, create button, table, saved views, numbered pagination, and editor slot. Its inputs are a Refine table instance, title/description, create callback, storage key, and editor content. `useResourceEditor` supplies stable create/edit callbacks and a fresh session key for every opening.

`ResourceFormDialog` uses the existing `FormDialog`, blocks pending dismissal, and confirms dirty cancellation/navigation. `ResourceDialogCancel` uses the same close guard as Escape and the close button. Browser unload protection covers dirty/pending forms.

For a new resource:

1. Register its actual table/resource and list route in the root registry. Add a route under the live admin layout, outside demo provider contexts.
2. Keep typed row adapters, Zod validation, explicit insert/update mappers, and resource columns with the feature.
3. Use the paired Refine/Shuip `useDataTable` hook for list state. Define permanent scope filters and a real text `searchField`.
4. Pass a resource editor to `ResourcePage`. Use `useAppForm`, `form.AppField`, existing fields, and `form.SubmitButton`; do not derive editable fields from table columns.
5. Use Refine `useOne`, `useCreate`, and `useUpdate` for loading/mutations. Whitelist payload fields, disable mutation retries, and implement the resource's server rules before exposing new operations.

The catalog feature shares a typed editor for its common fields. Product/add-on models own their respective mappings and constraints. Dialog is the only implemented presentation; sheet/section/page editing can be added through the same page/editor seam later.

## Save behavior

- New records start inactive. Platform records use `owner_type=platform`, no publisher, and approved review status. Add-ons always use `supports_customization=true` and `customization_price=0`.
- Edit fetches the selected ID; platform editing rejects publisher and subscription records. The record is refetched and eligibility rechecked before updating.
- Existing slugs are never sent in update payloads. Creation uses a readable name plus an eight-character UUID suffix. A uniqueness rejection returns an Arabic retry message, without automatic mutation retry.
- Forms expose essential names/descriptions/prices/category/image/active/order fields. Unexposed galleries, features, ages, writing styles, publisher data, and other metadata are omitted from updates. Library products preserve their electronic-price field.
- Blank optional descriptions/image URLs become null. Images use URLs only; add-ons require `https://res.cloudinary.com/`, as enforced by staging. No upload/deletion flows are included.
- Save failures preserve form values. Concurrent or acknowledged submissions are guarded against duplicates. Successful saves invalidate list/many queries and the edited detail, show one success toast, and close. An invalidation failure reports that the list needs refreshing while retaining the successful save outcome.
- Loading, missing/unavailable records, explicit permission errors, and failed reads have distinct states. RLS-hidden rows cannot be distinguished from nonexistent rows, so the unavailable message covers both.

These direct Supabase saves do **not** run the Next.js storefront-cache refresh or audit-log actions. That integration is explicitly deferred. RLS/admin checks are existing database behavior, not a new server-side validation layer; Zod protects the form and existing database constraints remain authoritative. No production or schema changes were made.

## Verification

Read-only staging inspection on October 24, 2026 confirmed RLS enabled and admin-write policies on both tables; `is_admin()` accepts `super_admin` and `general_supervisor`. The review trigger and add-on customization/Cloudinary constraints are present. Standard Cloudinary URL acceptance was checked using a read-only SQL expression. There were 11 platform products and two add-ons at inspection time. No rows were inserted or updated.

Run the tests from `admin/`:

```bash
node --import ../client/node_modules/tsx/dist/loader.mjs --test tests/*.test.ts
pnpm typecheck
pnpm build
```

Catalog unit/mocked checks cover validation, defaults, allowlists, untouched fields/slugs, ownership eligibility, submission guards, dismissal decisions, edit-state classification, failed invalidation, routing, and demo-provider isolation. These tests do not replace an authenticated browser/save test.

Verified in the existing authenticated local Chrome session: both staging lists load, create/edit dialogs render, the selected product's values load into edit, invalid input displays validation, dirty cancellation prompts and discards, and unmatched search shows the no-results state. No valid form was submitted. Some browser click operations timed out, so dropdown/sort/pagination interactions are not claimed as browser-verified. Successful live save/invalidation remains unverified without modifying staging.

Manual checks with a staging admin: open each catalog route, search/filter/sort/page, open and cancel create, edit and discard changes, verify closing a dirty dialog prompts, and verify read errors offer retry. Saving will modify staging; no automatic fixture records are created by this change. Verify list/detail refresh after an authorized manual save, then reopen the record to confirm persisted values.
