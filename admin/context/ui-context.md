# UI Context

## Theme

[Describe the overall visual language — e.g. Dark only.
No light mode. The design language is a dark technical
workspace — near-black backgrounds, layered surfaces,
and vivid accent colors for interactive elements.]

## Colors

[Define your color tokens as CSS custom properties.
All components must use these tokens — no hardcoded
hex values.]

| Role            | CSS Variable       | Value    |
| --------------- | ------------------ | -------- |
| Page background | `--bg-base`        | `#[hex]` |
| Surface         | `--bg-surface`     | `#[hex]` |
| Primary text    | `--text-primary`   | `#[hex]` |
| Muted text      | `--text-muted`     | `#[hex]` |
| Primary accent  | `--accent-primary` | `#[hex]` |
| Border          | `--border-default` | `#[hex]` |
| Error           | `--state-error`    | `#[hex]` |
| Success         | `--state-success`  | `#[hex]` |

## Typography

| Role      | Font              | Variable      |
| --------- | ----------------- | ------------- |
| UI text   | [e.g. Geist Sans] | `--font-sans` |
| Code/mono | [e.g. Geist Mono] | `--font-mono` |

## Border Radius

| Context           | Class            |
| ----------------- | ---------------- |
| Inline / small UI | `rounded-[size]` |
| Cards / panels    | `rounded-[size]` |
| Modals / overlays | `rounded-[size]` |

## Component Library

[e.g. shadcn/ui on top of Tailwind. Components live
in components/ui/. Use the CLI to add new components
rather than writing from scratch.]

## Layout Patterns

- [Pattern — e.g. Editor: full-viewport split with
  left sidebar, center canvas, right sidebar]
- [Pattern — e.g. Sidebars: fixed width with border separator]
- [Pattern — e.g. Modals: centered overlay with backdrop blur]
- [Pattern — e.g. Navbar: top bar with bottom border]

## Icons

[e.g. Lucide React. Stroke-based icons only. Sizes:
h-4 w-4 for inline, h-5 w-5 for buttons.]

## Shared fields and floating surfaces

Text inputs, textareas, select triggers, input groups, checkboxes and radio controls use `border-input` for a visible neutral border. Focus and invalid styles remain owned by the primitives. Floating surfaces use opaque `bg-popover` and `text-popover-foreground`: white in light mode and the configured dark surface in dark mode. Menus must inherit the app theme, without a local `dark` class or translucent background.

Text-entry controls and select triggers use `bg-background` with `border-input`, giving white interiors and gray outlines in light mode. Grouped inputs retain transparent inner controls so only the outer group draws a border. Dialogs, alert dialogs, popovers, select menus and dropdown menus use a solid theme surface and an explicit `border-border`.
