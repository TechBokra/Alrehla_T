import { createFileRoute } from "@tanstack/react-router";
import { FormPrototypePage } from "@/features/form-prototype";

export const Route = createFileRoute("/form-prototype/")({ component: FormPrototypePage });
