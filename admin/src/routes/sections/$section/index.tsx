import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const legacySectionSchema = z.enum([
  "overview",
  "actions",
  "data",
  "views",
  "forms",
  "primitives",
]);

const legacySectionRoutes = {
  overview: "/theme",
  actions: "/ui-primitives",
  data: "/data-view",
  views: "/data-view",
  forms: "/fields",
  primitives: "/ui-primitives",
} as const;

export const Route = createFileRoute("/sections/$section/")({
  params: {
    parse: (params) => ({
      section: legacySectionSchema.parse(params.section),
    }),
    stringify: ({ section }) => ({ section }),
  },
  beforeLoad: ({ params }) => {
    throw redirect({ to: legacySectionRoutes[params.section] });
  },
});
