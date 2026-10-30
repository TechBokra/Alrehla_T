import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/features/profile/recovery-pages";
export const Route = createFileRoute("/forgot-password/")({
  component: ForgotPasswordPage,
});
