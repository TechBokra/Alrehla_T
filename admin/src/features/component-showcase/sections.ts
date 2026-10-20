export const showcaseSections = [
  "theme",
  "ui-primitives",
  "data-view",
  "fields",
  "forms",
  "form-prototype",
  "calendar",
] as const;

export type ShowcaseSection = (typeof showcaseSections)[number];

export const showcaseNavigation: ReadonlyArray<{
  id: ShowcaseSection;
  label: string;
  description: string;
  to:
    | "/theme"
    | "/ui-primitives"
    | "/data-view"
    | "/fields"
    | "/forms"
    | "/form-prototype"
    | "/calendar";
}> = [
  {
    id: "theme",
    label: "Theme",
    description: "Preset colors, typography, and design tokens",
    to: "/theme",
  },
  {
    id: "ui-primitives",
    label: "UI primitives",
    description: "Buttons, overlays, menus, and feedback states",
    to: "/ui-primitives",
  },
  {
    id: "data-view",
    label: "Data view",
    description: "Refine table, sort, filter, and pagination",
    to: "/data-view",
  },
  {
    id: "fields",
    label: "Fields",
    description: "TanStack Form, Zod validation, and submitted values",
    to: "/fields",
  },
  {
    id: "forms",
    label: "Forms",
    description: "Dialog, sheet, section tabs, and save feedback",
    to: "/forms",
  },
  {
    id: "form-prototype",
    label: "Form prototype",
    description: "Typed TanStack fields connected to Refine",
    to: "/form-prototype",
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Calendar views with local event editing",
    to: "/calendar",
  },
];
