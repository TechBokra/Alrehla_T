import { createFileRoute } from "@tanstack/react-router";
import { UiPrimitivesPage } from "@/features/component-showcase/pages/ui-primitives-page";

export const Route = createFileRoute("/ui-primitives/")({ component: UiPrimitivesPage });
