import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { completeGoogleLink } from "@/features/profile/auth-actions";
import { adminAuthProvider } from "@/features/auth/supabase";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/auth/link/")({
  validateSearch: z.object({
    code: z.string().optional(),
    error: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    try {
      await completeGoogleLink(deps.code, deps.error);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "تعذر ربط Google.",
      };
    }
    adminAuthProvider.invalidateSession();
    throw redirect({ to: "/profile", replace: true });
  },
  pendingComponent: () => (
    <p role="status" className="p-6">
      جارٍ تأكيد ربط Google…
    </p>
  ),
  component: () => (
    <main dir="rtl" className="grid min-h-svh place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>لم يكتمل ربط Google</CardTitle>
          <CardDescription role="alert">
            {Route.useLoaderData().error}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link to="/profile">العودة للملف الشخصي</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  ),
});
