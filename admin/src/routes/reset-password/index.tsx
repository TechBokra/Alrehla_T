import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { exchangeRecoveryCode } from "@/features/profile/auth-actions";
import { ResetPasswordPage } from "@/features/profile/recovery-pages";
export const Route = createFileRoute("/reset-password/")({
  validateSearch: z.object({
    code: z.string().optional(),
    error: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    try {
      await exchangeRecoveryCode(deps.code, deps.error);
      return { error: undefined };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "تعذر التحقق من رابط الاستعادة.",
      };
    }
  },
  pendingComponent: () => (
    <p role="status" className="p-6">
      جارٍ التحقق من رابط الاستعادة…
    </p>
  ),
  component: () => <ResetPasswordPage error={Route.useLoaderData().error} />,
});
