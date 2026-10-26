import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "@/components/refine-ui/form/sign-in-form";

export const Route = createFileRoute("/sign-in/")({
  head: () => ({
    meta: [{ title: "تسجيل الدخول · لوحة إدارة الرحلة" }],
  }),
  component: SignInForm,
});
