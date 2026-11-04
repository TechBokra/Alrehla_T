# Box subscription plans

The `/subscriptions/box/plans` route manages the plans shown on the public
«صندوق الرحلة» page. It uses `ResourceView` for the list and create/edit
dialogs for mutations. Its page description explains why the image and feature
list distinguish plans for customers.

## Fields and table

The dialog mirrors the existing client form in
`client/src/app/(admin)/dashboard/admin/subscriptions/box/plans/BoxPlansClient.tsx`:

- Name, total price, displayed monthly price and duration.
- Savings note, short description and one feature per line.
- Plan image, highlighted state and customer visibility.
- Subscriber add-on discount and optional free add-on.

The form starts with a two-column section: plan name and short description on
the left, and the image preview with a full-width upload/change button on the
right, matching the existing client form. The remaining fields use a two-column
grid. The UploadCN image field accepts JPG, PNG, WebP and AVIF up to 5 MiB and signs uploads into
`alrehla/box-plans`. Table rows show the image avatar beside the name, visibility
and highlighted badges, duration, total/monthly prices and row actions. The
list searches plan names and sorts by display order, then duration.

## Data and access

`boxPlansDataProvider` is the only mutation path for this feature. It validates
the camel-case form payload with the shared `boxPlanSchema`, maps it to the
existing `box_subscription_plans` database columns, and clears another
highlighted plan before setting a new one. Add-on choices use a narrow virtual
`box_plan_addons` list mapped to `addon_products`. The database's existing
unique highlight index and RLS remain authoritative; no schema migration was
added.

The route and provider require `canManageSubscriptions`. The existing
`media-library` Edge Function now allowlists the box-plan image folder and
allows supervisors with `canManageSubscriptions` to sign uploads for that
folder. The function still authenticates the current user and checks role
permissions. Deploy the updated function before enabling uploads in a hosted
admin environment.

## Cache and audit boundary

The provider writes best-effort `box_plan_created`, `box_plan_updated` and
`box_plan_deleted` audit entries through the existing audit table. It does not
call the Next.js server action's `refreshPublicPages()`, so Refine list
invalidation does not invalidate the Next.js public-page cache. Public plans may
remain cached until the existing cache window expires. A server-side
revalidation bridge is needed if immediate public refresh is required.

## Files and verification

- UI: `src/features/subscriptions/box-plans/`
- Resource, navigation and route: `src/providers/refine/resources.ts`,
  `src/routes/subscriptions/box/plans/index.tsx`
- Provider and permission rules: `src/providers/refine/data-provider/box-plans-data-provider.ts`,
  `src/providers/refine/access-control-provider.ts`
- Upload folder and function authorization: `../client/supabase/functions/media-library/index.ts`

TypeScript validation checks route generation and provider/form contracts.
No live plan rows or media were changed while implementing this page.
