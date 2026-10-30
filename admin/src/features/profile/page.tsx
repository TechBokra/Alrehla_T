import { ErrorAlert } from "./status";
import { useState } from "react";
import { useOne, useUpdate } from "@refinedev/core";
import { toast } from "sonner";
import { useAppForm } from "@/lib/form";
import { useAdminIdentity } from "@/features/auth/identity-provider";
import { adminAuthProvider } from "@/features/auth/supabase";
import { useLibraryUploadAdapter } from "@/features/uploads/use-upload-adapter";
import { AvatarUpload } from "@/components/upload/avatar-upload";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { changePassword, linkGoogle, sendPasswordReset } from "./auth-actions";
import {
  changePasswordSchema,
  profileSchema,
  type ProfileRecord,
} from "./model";

export function ProfilePage() {
  const identity = useAdminIdentity();
  const { query } = useOne<ProfileRecord>({
    resource: "profile",
    id: identity.data?.id ?? "",
    dataProviderName: "account",
    queryOptions: { enabled: Boolean(identity.data?.id), retry: false },
  });
  const profile = query.data?.data;
  if (query.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>تعذر تحميل الملف الشخصي</AlertTitle>
        <AlertDescription>
          <p>{query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!profile)
    return (
      <div
        className="flex flex-col gap-4"
        role="status"
        aria-label="جارٍ تحميل الملف الشخصي"
      >
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  return (
    <ProfileContent
      key={profile.id}
      profile={profile}
      onSaved={async () => {
        adminAuthProvider.invalidateSession();
        await query.refetch();
      }}
    />
  );
}

function ProfileContent({
  profile,
  onSaved,
}: {
  profile: ProfileRecord;
  onSaved: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState("details");
  return (
    <section
      dir="rtl"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
      aria-labelledby="profile-title"
    >
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage
            src={profile.avatar_url ?? undefined}
            alt={profile.full_name}
          />
          <AvatarFallback>{profile.full_name.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 id="profile-title" className="text-2xl font-semibold">
            الملف الشخصي
          </h1>
          <p className="truncate text-muted-foreground">
            <bdi>{profile.full_name}</bdi>
          </p>
          <p>
            <bdi dir="ltr">{profile.email}</bdi>
          </p>
        </div>
        <Badge variant="secondary">
          {profile.role === "super_admin" ? "مدير النظام" : "مشرف عام"}
        </Badge>
      </div>
      <Tabs
        dir="rtl"
        value={tab}
        onValueChange={(value) => {
          if (!uploading) setTab(value);
        }}
      >
        <TabsList aria-label="أقسام الملف الشخصي">
          <TabsTrigger value="details" disabled={uploading}>
            البيانات الشخصية
          </TabsTrigger>
          <TabsTrigger value="security" disabled={uploading}>
            الدخول والأمان
          </TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <ProfileForm
            profile={profile}
            uploading={uploading}
            onUploadingChange={setUploading}
            onSaved={onSaved}
          />
        </TabsContent>
        <TabsContent value="security">
          <div className="flex flex-col gap-6">
            <LinkedAccounts profile={profile} />
            <PasswordForm email={profile.email} />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
function ProfileForm({
  profile,
  uploading,
  onUploadingChange,
  onSaved,
}: {
  profile: ProfileRecord;
  uploading: boolean;
  onUploadingChange: (pending: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const { mutateAsync: update, mutation } = useUpdate();
  const [error, setError] = useState("");
  const adapter = useLibraryUploadAdapter("alrehla/avatars");
  const form = useAppForm({
    defaultValues: {
      full_name: profile.full_name,
      avatar_url: profile.avatar_url ?? "",
    },
    validators: { onChange: profileSchema, onSubmit: profileSchema },
    onSubmit: async ({ value }) => {
      if (uploading || mutation.isPending) return;
      setError("");
      try {
        await update({
          resource: "profile",
          id: profile.id,
          dataProviderName: "account",
          values: profileSchema.parse(value),
          mutationMode: "pessimistic",
        });
        await onSaved();
        toast.success("تم حفظ الملف الشخصي.");
        form.reset(value);
      } catch (error) {
        setError(message(error));
      }
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>البيانات الشخصية</CardTitle>
        <CardDescription>
          حدّث اسمك وصورتك. بريد الدخول والصلاحيات لا يتغيران من هذا النموذج.
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
          <CardContent className="flex flex-col gap-6">
            {error && <ErrorAlert message={error} />}
            <FieldGroup>
              <form.AppField name="full_name">
                {(field) => (
                  <field.InputField
                    label="الاسم الكامل"
                    required
                    props={{
                      autoComplete: "name",
                      disabled: mutation.isPending,
                    }}
                  />
                )}
              </form.AppField>
              <Field>
                <FieldLabel>الصورة الشخصية</FieldLabel>
                <form.Subscribe selector={(state) => state.values.avatar_url}>
                  {(url) =>
                    adapter ? (
                      <AvatarUpload
                        disabled={mutation.isPending}
                        adapter={adapter}
                        src={url || null}
                        maxSize={5 * 1024 * 1024}
                        onPendingChange={onUploadingChange}
                        onChange={(item) => {
                          form.setFieldValue(
                            "avatar_url",
                            item?.result?.secure_url ?? "",
                          );
                        }}
                      />
                    ) : (
                      <FieldDescription>
                        رفع الصور غير متاح حتى يكتمل إعداد Cloudinary.
                      </FieldDescription>
                    )
                  }
                </form.Subscribe>
                <FieldDescription>
                  تُحفظ الصورة في ملفك عند الضغط على حفظ التغييرات. إزالة
                  المعاينة لا تحذف الملف من المكتبة.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>بريد تسجيل الدخول</FieldLabel>
                <p>
                  <bdi dir="ltr">{profile.email}</bdi>{" "}
                  <Badge variant="outline">
                    {profile.emailConfirmed ? "مؤكد" : "غير مؤكد"}
                  </Badge>
                </p>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6">
            <form.SubmitButton
              props={{ disabled: uploading || mutation.isPending }}
            >
              {uploading ? "انتظر اكتمال رفع الصورة…" : "حفظ التغييرات"}
            </form.SubmitButton>
          </CardFooter>
        </form>
      </form.AppForm>
    </Card>
  );
}
function LinkedAccounts({ profile }: { profile: ProfileRecord }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>طرق تسجيل الدخول</CardTitle>
        <CardDescription>
          طرق دخول مختلفة إلى حساب الإدارة نفسه، بنفس البيانات والصلاحيات.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel>البريد الإلكتروني</FieldLabel>
            <p>
              <bdi dir="ltr">{profile.email}</bdi>
            </p>
          </Field>
          <Field>
            <FieldLabel>
              <bdi>Google</bdi>{" "}
              <Badge variant={profile.googleLinked ? "secondary" : "outline"}>
                {profile.googleLinked ? "متصل" : "غير متصل"}
              </Badge>
            </FieldLabel>
            {profile.googleEmail && (
              <p>
                <bdi dir="ltr">{profile.googleEmail}</bdi>
              </p>
            )}
            <FieldDescription>
              {profile.googleLinked
                ? "يمكنك استخدام Google للدخول إلى هذا الحساب."
                : "اختر حساب Google الذي تريد ربطه. بريد الحساب الأساسي يظل كما هو."}
            </FieldDescription>
          </Field>
        </FieldGroup>
        {error && <ErrorAlert message={error} />}
      </CardContent>
      {!profile.googleLinked && (
        <CardFooter>
          <Button
            disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                await linkGoogle();
              } catch (error) {
                setError(message(error));
                setBusy(false);
              }
            }}
          >
            {busy ? "جارٍ الانتقال إلى Google…" : "ربط حساب Google"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
function PasswordForm({ email }: { email: string }) {
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const form = useAppForm({
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
    validators: {
      onChange: changePasswordSchema,
      onSubmit: changePasswordSchema,
    },
    onSubmit: async ({ value }) => {
      setError("");
      try {
        await changePassword(value);
        form.reset();
        toast.success("تم تغيير كلمة المرور.");
      } catch (error) {
        setError(message(error));
      }
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>كلمة المرور</CardTitle>
        <CardDescription>
          غيّر كلمة مرور الموقع. كلمة مرور حساب Google لا تتغير.
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
          <CardContent className="flex flex-col gap-5">
            {error && <ErrorAlert message={error} />}
            <FieldGroup>
              <form.AppField name="currentPassword">
                {(field) => (
                  <field.PasswordField
                    label="كلمة المرور الحالية"
                    required
                    props={{ dir: "ltr", autoComplete: "current-password" }}
                  />
                )}
              </form.AppField>
              <form.AppField name="password">
                {(field) => (
                  <field.PasswordField
                    label="كلمة المرور الجديدة"
                    description="١٢ حرفًا على الأقل. استخدم كلمة مرور خاصة بهذا الموقع."
                    required
                    props={{ dir: "ltr", autoComplete: "new-password" }}
                  />
                )}
              </form.AppField>
              <form.AppField name="confirmPassword">
                {(field) => (
                  <field.PasswordField
                    label="تأكيد كلمة المرور الجديدة"
                    required
                    props={{ dir: "ltr", autoComplete: "new-password" }}
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6">
            <form.SubmitButton props={{ disabled: sending }}>
              حفظ كلمة المرور
            </form.SubmitButton>
          </CardFooter>
        </form>
      </form.AppForm>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          تدخل باستخدام Google فقط، أو نسيت كلمة المرور؟ أرسل رابطًا إلى بريد
          حسابك لتعيين كلمة مرور.
        </p>
        {sent && (
          <Alert role="status">
            <AlertTitle>تحقق من بريدك</AlertTitle>
            <AlertDescription>
              إذا كان البريد مسجلًا، فستصلك رسالة لإعادة تعيين كلمة المرور. افتح
              الرابط في هذا المتصفح.
            </AlertDescription>
          </Alert>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button
              type="button"
              variant="outline"
              disabled={sending || sent || submitting || !email}
              onClick={async () => {
                setSending(true);
                setError("");
                try {
                  await sendPasswordReset(email);
                  setSent(true);
                } catch (error) {
                  setError(message(error));
                } finally {
                  setSending(false);
                }
              }}
            >
              {sending ? "جارٍ إرسال الرابط…" : "إرسال رابط تعيين كلمة المرور"}
            </Button>
          )}
        </form.Subscribe>
      </CardContent>
    </Card>
  );
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "حدث خطأ. حاول مجددًا.";
}
