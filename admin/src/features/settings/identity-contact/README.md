# Identity and contact settings

This module owns the active identity/contact panel: site name, contact email,
phone, WhatsApp, working hours, address and social URLs. `model.ts` owns its
query projection, form defaults and Zod contract. `page.tsx` owns query/loading/
error states. `form.tsx` owns field presentation and the save interaction.

Reads use Refine `useOne` from `site_settings` (`key = general`) through the
named `siteSettings` provider. Writes pass only these allowlisted values to the
provider, which merges them into the existing JSON value so other settings are
preserved. The save path rechecks `canManageContent`; Supabase RLS remains the
database boundary.
