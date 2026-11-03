# Platform settings

## Sections and feature boundaries

`/settings` keeps section navigation in `features/settings/sidebar.tsx` and
`features/settings/tabs.ts`. Each setting domain owns its own folder so its
query, validation, UI and mutation logic can evolve without collecting unrelated
forms in one settings component.

| Sidebar section | Feature folder | Current state |
|---|---|---|
| الهوية والتواصل | `features/settings/identity-contact/` | Active form |
| المظهر والإعلانات | `features/settings/appearance-announcements/` | Disabled placeholder |
| الخصوصية والاحتفاظ | `features/settings/privacy-retention/` | Disabled placeholder |
| الطلبات والمدربين | `features/settings/orders-trainers/` | Disabled placeholder |
| المدفوعات | `features/settings/payments/` | Disabled placeholder |
| خانات التخصيص، أهداف التخصيص، لهجات الكتابة | `features/settings/catalog/` | Active resource lists and Dialogs |

`features/settings/page.tsx` is only the shell: it chooses the active panel and
places it beside the sidebar. Each active domain exports a page entry point;
disabled domains have a README describing the future boundary but no mounted
panel, query or mutation.

## Identity and contact form

The page edits `site_settings` row `key = general`:

- **بيانات المنصة:** site name.
- **قنوات التواصل:** contact email, phone, WhatsApp, working hours, address,
  Facebook URL and Instagram URL.

Optional empty values remove only their matching keys. The form uses the common
email/HTTP URL validators and limits text lengths. It does not expose image,
watermark, announcement, retention, trainer/order or payment settings; those are
separate sections and their sidebar entries remain disabled.

## Query and mutation ownership

`identity-contact/model.ts` owns the schema, form defaults and Refine query
descriptor. `IdentityContactPage` uses Refine `useOne` with resource
`site_settings`, ID `general`, provider `siteSettings`, and `meta.idColumnName`
`key`. It selects only the identity/contact values from the row's JSON `value`
and returns an identity/contact record plus Refine's query state.

`identity-contact/form.tsx` uses TanStack Form for draft values, validation and
submit state. It calls Refine `useUpdate`; the named provider owns the actual
write. The provider rechecks `site_settings:edit`, validates the allowlisted
identity/contact shape, reads the current `general` JSON, merges those keys and
upserts the existing row. Empty strings delete only an allowed field. It blocks
list, multi-read, create, bulk update, delete and custom operations for this
provider. A successful write invalidates the Refine detail query. An audit entry
records the changed field names as a best-effort side effect.

The editor does not write the entire form object as a replacement JSON value;
unrelated general settings such as studio or workflow controls are preserved.
Existing Supabase RLS remains the database authorization boundary. The admin UI
also requires `canManageContent` (or `super_admin`) to view and save identity
settings; catalog tabs require `canManageCatalog` (or `super_admin`).

## Public page refresh boundary

The legacy Next.js server action both writes this row and calls
`refreshPublicPages()` to invalidate cached public pages. The Vite admin SPA
currently writes through its existing Supabase client and does not call that
Next.js server action, so a write invalidates the Admin Refine detail but does
not force Next.js public-page revalidation. Public pages with their own
revalidation period may therefore show the previous value until they refresh.
Immediate public-page refresh needs an approved bridge to the Next.js server
action; this work adds no API route, RPC, schema or Edge Function.
