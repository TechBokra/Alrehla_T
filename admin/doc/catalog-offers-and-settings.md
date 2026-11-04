# Catalog offers, add-on rows and settings access

## User-facing behavior

- `/catalog/promotions` adds **العروض والخصومات** to the catalog navigation.
  The table shows the target name/type, badge label, percentage or sale price,
  Cairo start/end times, current period state, activation switch and edit actions.
  It includes scheduled, active, expired and paused rows. The period indicator
  refreshes every 30 seconds. The sortable “العرض” header is right-aligned, and
  the shared column-visibility control stays at the physical left edge of the
  final header cell. Deletion and bulk mutations are blocked; stop an offer with
  its activation switch.
- Create/edit uses the shared resource Dialog. Inputs are target type, searched
  target, discount kind/value, Cairo start/end datetime and optional badge label.
  Targets match the legacy screen: printed product, electronic product, add-on,
  or box plan. Names are searched on the server and saved selections hydrated
  through Refine. New offers are active, matching the legacy behavior.
- Add-ons now explain their role in customer customization. The first table
  column combines image, name and short description; image failures use a shared
  Avatar fallback. The numeric order column is removed. Dragging still persists
  `sort_order` through the existing shared controller; the Dialog is unchanged.
- User menu → **الإعدادات** opens `/settings`. The sidebar has platform and
  catalog groups. **الهوية والتواصل** is the only active platform form;
  appearance/announcements, privacy/retention, orders/trainers and payments are
  disabled placeholders. The three catalog definition lists remain active. The
  page has no account section or internal breadcrumb; the standard admin-header
  breadcrumb and separate profile menu entry remain available.

## Request flow and ownership

1. `PromotionsPage` composes `ResourceView`, resource search, filters and the
   existing create/edit/row-switch controllers. Refine owns list/detail/many
   queries, mutations, authorization and invalidation.
2. `promotionForm` provides the shared Dialog with TanStack Form values,
   validation, field registration and an allowlisted payload mapper.
   `PromotionTargetField` uses Refine `useSelect` for 25-result server searches
   and selected-ID hydration. Changing target type clears the selected ID.
3. `promotionsDataProvider` checks fresh `canManageCatalog` access, permits only
   known resources/operations, validates the complete payload and reloads the
   target's original price before saving. Percentage is an integer 1–99; a sale
   price is a positive integer below the current original price. End must follow
   start, and a new offer cannot already have ended.
4. The provider writes only existing `price_promotions` columns under existing
   RLS. Create sets current `created_by`; edit advances `updated_at`; activation
   accepts only a boolean payload. A returned ID is required to confirm writes.
   List target names are hydrated in at most four grouped reads, not per cell.
5. Shared resource hooks invalidate the named provider's queries after changes.
   The existing checkout `effective_price` calculation still determines the
   customer's actual price. Browser validation is not server
   authorization. No new server API, schema, policy, RPC or deployment is added.

## Components and logic

| Module | Responsibility |
| --- | --- |
| `features/catalog/promotions/page.tsx` | Resource composition and live period clock with timer cleanup. |
| `features/catalog/promotions/columns.tsx` | One target/discount/label/date summary column with a right-aligned sortable header, period state, shared status switch and row actions. |
| `features/catalog/promotions/dialogs.tsx` | TanStack Form, existing shared Dialog contract and Cairo-labelled inputs. |
| `features/catalog/promotions/target-field.tsx` | Searchable, single-target picker, Refine hydration and retry UI. |
| `features/catalog/promotions/model.ts` | Types, form schema, payload mapping, Cairo conversion, display state and Arabic errors. |
| `providers/refine/data-provider/promotions-data-provider.ts` | Resource allowlist, price checks, grouped target hydration and guarded CRUD. |
| `features/settings/page.tsx` | Embedded sidebar-13 layout and the selected existing resource panel. |
| `features/settings/sidebar.tsx` | sidebar-13 adaptation with grouped platform/catalog navigation, active links and disabled future sections. |
| `features/settings/tabs.ts` | Active and disabled section IDs, Arabic labels and icons for settings navigation. |
| `features/settings/catalog/model.ts` | Catalog field/goal/dialect types, schemas, value conversion and allowlisted payload mapping. |
| `features/settings/identity-contact/` | Identity/contact query, editable fields, validation and status UI. |
| `providers/refine/data-provider/site-settings-data-provider.ts` | Guarded partial write to `site_settings.general`, preserving other JSON keys. |
| `components/nav-user.tsx`, `app-sidebar.tsx` | Settings entry in the user menu; removal of catalog settings sidebar group. |
| `providers/refine/resources.ts`, `access-control-provider.ts` | Offer registration/navigation and catalog permission policy. |
| `features/catalog/addons/page.tsx`, `columns.tsx` | Requested explanatory copy and a wide image/name/full-description column; price, status and actions keep fixed widths, with no numeric rank column. |
| `routes/settings/route.tsx`, `routes/catalog/promotions/index.tsx`, `components/admin-layout.tsx` | Route entry points, authorization and page titles. |

### Settings tab navigation

`routes/settings/route.tsx` validates the optional `tab` URL search parameter and
uses a content permission for identity/contact or catalog permission for catalog
tabs. `SettingsPage` receives the selected tab. `SettingsSidebar` renders real router links with `aria-current` using
the Sidebar/Group/Menu composition from `npx shadcn@latest add sidebar-13`.
Only the selected panel mounts its existing Refine resource controller and
Dialog composition. Missing tabs retain the existing catalog default for catalog
managers; content-only actors open identity/contact. Future platform sections are
disabled and have no route panel or data operation.

Legacy `/catalog/settings/*` routes redirect with replacement to their matching
`/settings?tab=...` location, keeping product-editor links and existing resource
registration working. The standard admin header breadcrumb is restored.
Profile/security stays on the separate profile page.

The installed block's demo Dialog, placeholder content and inner breadcrumb were
adapted for an embedded page. Existing UI primitives were retained when the CLI
offered overwrites. The non-collapsible settings sidebar uses the existing admin
SidebarProvider rather than adding a second global shortcut/cookie controller.

## States and limits

Shared ResourceView/Dialog supplies loading, empty/error/retry, access denial,
pending saves and mutation feedback. The target picker separately exposes
loading, empty search and read retry; provider checks catch removed/priceless
targets at submission. Cairo conversion rejects invalid calendar dates and
nonexistent local clock times instead of silently normalizing them.

No tests were added or run for this follow-up. TypeScript and build results are
recorded in `context/progress-tracker.md`. No live offer or add-on rows were
changed for verification.
