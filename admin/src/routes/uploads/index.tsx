import { createFileRoute } from "@tanstack/react-router";
import { UploadsPage } from "@/features/uploads/page";
export const Route = createFileRoute("/uploads/")({ component: UploadsPage });
