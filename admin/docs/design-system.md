# Admin design system

## Source of truth

The implemented baseline lives in `src/styles.css`, with component-generation
settings in `components.json` and reusable primitives in `src/components/ui/`.
The current setup uses Tailwind CSS v4, shadcn-style Radix components, Lucide
icons, and the `radix-rhea` shadcn preset.

## Foundations

| Area | Current standard |
| --- | --- |
| Typography | Roboto Variable, loaded through Fontsource and exposed as the Tailwind sans font. |
| Color | Semantic OKLCH tokens. Light values are defined in `:root`; dark values override them under `.dark`. |
| Primary | Blue-violet primary color, with paired foreground tokens. |
| Surfaces | Use background, card, popover, muted, and sidebar token pairs for surfaces and their text. |
| Feedback | Use the destructive token for destructive actions/errors; chart colors use the chart token series. |
| Shape | Base radius is `0.45rem`; Tailwind radius utilities derive from this token. |
| Icons | Lucide React (`lucide-react`). |
| Direction | `components.json` currently sets `rtl: false`; RTL behavior is not established yet. |

The live token definitions are the source of truth for exact color values. Do
not copy those values into feature styles; consume their semantic classes or
CSS variables instead.

## Theme and semantic classes

The theme provider supports `light`, `dark`, and `system`, and persists the
selection in local storage under `calesee-admin-preview-theme`. The CSS maps
semantic variables to Tailwind utilities. Prefer classes such as:

```tsx
<section className="bg-card text-card-foreground border-border">
  <p className="text-muted-foreground">Supporting text</p>
</section>
```

Avoid hard-coded hex/RGB colors for shared UI. Use `bg-primary`,
`text-primary-foreground`, `bg-muted`, `border-border`, `ring-ring`, and the
matching semantic token for the element's purpose. Keep color from being the
only signal for status; pair it with text or an icon.

## Component conventions

- Reuse `src/components/ui/` primitives before creating another button, field,
  menu, dialog, popover, table, or feedback pattern.
- Put reusable admin-specific compositions in `src/components/refine-ui/` or
  `src/components/`; keep one-off feature composition close to its feature.
- Use the existing component variants and semantic tokens instead of styling
  each call site independently. Add a variant when the distinction is reused.
- Use the Tailwind spacing scale for layout. Reserve one-off values for a
  deliberate page composition, and keep them out of shared primitives.
- Use the shared notification provider (`sonner`) for user feedback rather
  than inventing a separate toast pattern.

## Interaction and accessibility

- Use visible labels for inputs and describe validation errors beside the
  field. Do not rely on placeholders as labels.
- Preserve keyboard focus indicators using the ring tokens. Do not remove focus
  styles without providing an equally visible replacement.
- Use the Radix-backed dialog/menu primitives for their keyboard and focus
  behavior; ensure every overlay has a clear title and an obvious close path.
- Keep controls operable at narrow widths and avoid encoding meaning through
  color alone.
- Before shipping Arabic UI, define and verify RTL behavior for navigation,
  forms, tables, dialogs, icons, and directional spacing. The current
  `rtl: false` setting means this work is still outstanding.

## Current scope

The theme page is a preview of the implemented tokens and primitives, not a
complete brand specification. Treat the values and conventions above as the
admin frontend baseline; confirm brand, contrast, and RTL requirements before
using it for production workflows.
