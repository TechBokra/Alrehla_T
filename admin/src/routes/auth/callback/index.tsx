import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { completeGoogleSignIn } from "@/features/auth/supabase";

export const Route = createFileRoute("/auth/callback/")({
  validateSearch: z.object({ code: z.string().optional(), error: z.string().optional() }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await completeGoogleSignIn(deps);
    if (result.success) throw redirect({ to: "/theme", replace: true });
    return { message: result.error?.message ?? "تعذّر إكمال تسجيل الدخول. حاول مرة أخرى." };
  },
  head: () => ({ meta: [{ title: "تأكيد تسجيل الدخول · الرحلة" }] }),
  pendingComponent: () => (
    <main className="grid min-h-svh place-items-center bg-background p-6" role="status">
      جارٍ تأكيد تسجيل الدخول…
    </main>
  ),
  component: GoogleCallbackPage,
});

function GoogleCallbackPage() {
  const { message } = Route.useLoaderData();
  return (
    <main dir="rtl" className="grid min-h-svh place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle><h1>تعذّر تسجيل الدخول</h1></CardTitle>
          <CardDescription role="alert">{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full"><Link to="/sign-in" replace>العودة لتسجيل الدخول</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
