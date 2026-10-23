import { createFileRoute } from "@tanstack/react-router";
import { ThemePage } from "@/features/component-showcase/pages/theme-page";

export const Route = createFileRoute("/theme/")({ component: ThemePage });
