import { useAppForm } from "@/lib/form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import type { AdminLoginValues } from "@/providers/refine/auth-provider";
import { isAuthConfigured } from "@/providers/supabase-client";
import { signInSchema } from "@/lib/schema";
import { useLogin } from "@refinedev/core";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
export function SignInForm() {
  const submitting = useRef(false);
  const [googleRedirecting, setGoogleRedirecting] = useState(false);
  const { mutateAsync: login, isPending, reset } = useLogin<AdminLoginValues>();
  const busy = isPending || googleRedirecting;
  useEffect(() => {
    const restoreForm = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      submitting.current = false;
      setGoogleRedirecting(false);
      reset();
    };
    window.addEventListener("pageshow", restoreForm);
    return () => window.removeEventListener("pageshow", restoreForm);
  }, [reset]);
  const signInWithGoogle = async () => {
    if (submitting.current || !isAuthConfigured) return;
    submitting.current = true;
    setGoogleRedirecting(true);
    try {
      const result = await login({ providerName: "google" });
      if (result.success) return; // Keep controls locked until the browser leaves.
    } catch {}
    submitting.current = false;
  };
  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: {
      onChange: signInSchema,
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value }) => {
      if (submitting.current || !isAuthConfigured) return;
      submitting.current = true;
      try {
        await login(signInSchema.parse(value));
      } catch {
        // Refine exposes rejected requests through `error` and its notification provider.
      } finally {
        submitting.current = false;
      }
    },
  });
  return (
    <main className="flex min-h-svh flex-col bg-background text-foreground">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full max-w-md">
          <CardHeader className="gap-3">
            <CardTitle className="text-2xl">
              <h1>تسجيل الدخول</h1>
            </CardTitle>
            <CardDescription>
              أهلًا بعودتك. أدخل بيانات حساب الإدارة للمتابعة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form.AppForm>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void form.handleSubmit();
                }}
                onChange={reset}
                noValidate
                aria-busy={busy}
                className="flex flex-col gap-6"
              >
                <FieldGroup>
                  <form.AppField name="email">
                    {(Fields) => (
                      <Fields.InputField
                        label="البريد الإلكتروني"
                        props={{
                          type: "email",
                          dir: "ltr",
                          inputMode: "email",
                          autoComplete: "username",
                          autoCapitalize: "none",
                          spellCheck: false,
                          disabled: busy,
                        }}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="password">
                    {(Fields) => (
                      <Fields.PasswordField
                        label="كلمة المرور"
                        props={{
                          dir: "ltr",
                          autoComplete: "current-password",
                          disabled: busy,
                        }}
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
                <form.SubmitButton
                  props={{
                    size: "lg",
                    className: "w-full",
                    disabled: busy || !isAuthConfigured,
                  }}
                >
                  تسجيل الدخول
                </form.SubmitButton>
                <FieldSeparator>أو</FieldSeparator>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={busy || !isAuthConfigured}
                  onClick={() => {
                    void signInWithGoogle();
                  }}
                >
                  {googleRedirecting ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : null}
                  {googleRedirecting ? (
                    "جارٍ الانتقال إلى Google…"
                  ) : (
                    <>
                      المتابعة باستخدام <bdi>Google</bdi>
                    </>
                  )}
                </Button>
              </form>
            </form.AppForm>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
