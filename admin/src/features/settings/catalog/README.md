# Catalog settings

This module owns the three active definition resources: customization fields,
story goals and writing dialects. `pages.tsx` composes each `ResourceView`;
`model.ts`, `columns.tsx`, dialogs and scope selection own their corresponding
data and presentation. Product personalization imports the scope contract from
this module. Queries and mutations continue through the named
`catalogSettings` provider.
