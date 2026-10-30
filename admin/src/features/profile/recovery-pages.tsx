import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAppForm } from "@/lib/form";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "./status";
import { newPasswordSchema, recoverySchema } from "./model";
import { saveRecoveredPassword, sendPasswordReset } from "./auth-actions";

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const form = useAppForm({
    defaultValues: { email: "" },
    validators: { onChange: recoverySchema, onSubmit: recoverySchema },
    onSubmit: async ({ value }) => {
      setError("");
      try {
        await sendPasswordReset(value.email);
        setSent(true);
      } catch (error) {
        setError(error instanceof Error ? error.message : "تعذر إرسال الرابط.");
      }
    },
  });
  return (
    <main
      dir="rtl"
      className="grid min-h-svh place-items-center bg-background p-6"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1>استعادة كلمة المرور</h1>
          </CardTitle>
          <CardDescription>
            أدخل بريد حسابك وسنرسل لك رابطًا لتعيين كلمة مرور جديدة.
          </CardDescription>
        </CardHeader>
        <form.AppForm>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <CardContent className="flex flex-col gap-4">
              {error && <ErrorAlert message={error} />}
              {sent ? (
                <Alert role="status">
                  <AlertTitle>تحقق من بريدك</AlertTitle>
                  <AlertDescription>
                    إذا كان البريد مسجلًا، فستصلك رسالة لإعادة تعيين كلمة
                    المرور. افتحها في هذا المتصفح، وتحقق من البريد غير المرغوب
                    فيه.
                  </AlertDescription>
                </Alert>
              ) : (
                <FieldGroup>
                  <form.AppField name="email">
                    {(field) => (
                      <field.InputField
                        label="البريد الإلكتروني"
                        required
                        props={{
                          type: "email",
                          dir: "ltr",
                          autoComplete: "email",
                        }}
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              )}
            </CardContent>
            <CardFooter className="mt-6 flex flex-col gap-3">
              {!sent && (
                <form.SubmitButton props={{ className: "w-full" }}>
                  إرسال رابط الاستعادة
                </form.SubmitButton>
              )}
              <Button variant="ghost" asChild>
                <Link to="/sign-in">العودة لتسجيل الدخول</Link>
              </Button>
            </CardFooter>
          </form>
        </form.AppForm>
      </Card>
    </main>
  );
}
export function ResetPasswordPage({ error: initialError }: { error?: string }) {
  const [error, setError] = useState(initialError ?? "");
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const form = useAppForm({
    defaultValues: { password: "", confirmPassword: "" },
    validators: { onChange: newPasswordSchema, onSubmit: newPasswordSchema },
    onSubmit: async ({ value }) => {
      setError("");
      try {
        await saveRecoveredPassword(value);
        form.reset();
        setSaved(true);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "تعذر حفظ كلمة المرور.",
        );
      }
    },
  });
  return (
    <main
      dir="rtl"
      className="grid min-h-svh place-items-center bg-background p-6"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1>{saved ? "تم تحديث كلمة المرور" : "تعيين كلمة مرور جديدة"}</h1>
          </CardTitle>
          <CardDescription>
            {saved
              ? "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة."
              : "استخدم ١٢ حرفًا على الأقل. كلمة مرور Google لن تتغير."}
          </CardDescription>
        </CardHeader>
        {initialError ? (
          <CardContent className="flex flex-col gap-4">
            <ErrorAlert message={initialError} />
            <Button asChild>
              <Link to="/forgot-password">طلب رابط جديد</Link>
            </Button>
          </CardContent>
        ) : saved ? (
          <CardFooter>
            <Button
              onClick={() => void navigate({ to: "/sign-in", replace: true })}
            >
              تسجيل الدخول
            </Button>
          </CardFooter>
        ) : (
          <form.AppForm>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <CardContent className="flex flex-col gap-4">
                {error && <ErrorAlert message={error} />}
                <FieldGroup>
                  <form.AppField name="password">
                    {(field) => (
                      <field.PasswordField
                        label="كلمة المرور الجديدة"
                        required
                        props={{ dir: "ltr", autoComplete: "new-password" }}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="confirmPassword">
                    {(field) => (
                      <field.PasswordField
                        label="تأكيد كلمة المرور"
                        required
                        props={{ dir: "ltr", autoComplete: "new-password" }}
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </CardContent>
              <CardFooter className="mt-6">
                <form.SubmitButton>حفظ كلمة المرور</form.SubmitButton>
              </CardFooter>
            </form>
          </form.AppForm>
        )}
      </Card>
    </main>
  );
}
