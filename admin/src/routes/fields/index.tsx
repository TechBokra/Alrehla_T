import { createFileRoute } from "@tanstack/react-router";
import { FieldsPage } from "@/features/component-showcase/pages/fields-page";

export const Route = createFileRoute("/fields/")({ component: FieldsPage });
