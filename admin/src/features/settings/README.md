# Settings feature map

The settings route composes small, domain-owned panels. Shared routing and the
`sidebar-13` navigation stay in this directory; query, schema, form and save
logic belongs to the section that owns those values.

| Section | Module | State |
|---|---|---|
| Catalog definitions | `catalog/` | Active: customization fields, story goals and writing dialects |
| Identity and contact | `identity-contact/` | Active: site name and public contact details |
| Appearance and announcements | `appearance-announcements/` | Disabled; planned section boundary is documented in its README |
| Privacy and retention | `privacy-retention/` | Disabled; planned section boundary is documented in its README |
| Orders and trainers | `orders-trainers/` | Disabled; planned section boundary is documented in its README |
| Payments | `payments/` | Disabled; payment permission stays separate from content settings |

Only active tabs are accepted by the route. Disabled sidebar entries are native
disabled buttons and do not have a query, form, mutation or panel mounted behind
them. For the platform form's query/write contract and the current public-page
refresh boundary, see [`doc/platform-settings.md`](../../../doc/platform-settings.md).
