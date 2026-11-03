import { useUpdate } from "@refinedev/core";
import { toast } from "sonner";
import { useAppForm } from "@/lib/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import type { SiteIdentityContactRecord } from "./model";
import { siteIdentityContactSchema, siteIdentityContactValues } from "./model";

export function SiteIdentityContactForm({
  record,
}: {
  record: SiteIdentityContactRecord;
}) {
  const { mutateAsync: update, mutation } =
    useUpdate<SiteIdentityContactRecord>({ mutationOptions: { retry: false } });
  const form = useAppForm({
    defaultValues: siteIdentityContactValues(record),
    validators: {
      onChange: siteIdentityContactSchema,
      onSubmit: siteIdentityContactSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const values = siteIdentityContactSchema.parse(value);
        await update({
          resource: "site_settings",
          id: "general",
          dataProviderName: "siteSettings",
          values,
          meta: { idColumnName: "key" },
          invalidates: ["detail"],
          mutationMode: "pessimistic",
          errorNotification: false,
          successNotification: false,
        });
        form.reset(values);
        toast.success("تم حفظ بيانات الهوية والتواصل");
      } catch (error) {
        toast.error(
          error instanceof Error && error.message.trim()
            ? error.message
            : "تعذر حفظ بيانات الهوية والتواصل. حاول مرة أخرى.",
        );
      }
    },
  });

  return (
    <form.AppForm>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!mutation.isPending) void form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>بيانات المنصة</CardTitle>
              <CardDescription>
                الاسم الذي يظهر للعملاء في صفحات المنصة.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <form.AppField name="siteName">
                    {(field) => (
                      <field.InputField
                        label="اسم الموقع"
                        description="اتركه فارغًا لاستخدام الاسم الافتراضي «الرحلة»."
                        props={{ maxLength: 120, disabled: mutation.isPending }}
                      />
                    )}
                  </form.AppField>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>قنوات التواصل</CardTitle>
              <CardDescription>
                المعلومات التي يستطيع العملاء استخدامها للتواصل مع المنصة.
                الحقول الاختيارية الفارغة لا تظهر في الموقع.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-5 sm:grid-cols-2">
                <form.AppField name="contactEmail">
                  {(field) => (
                    <field.InputField
                      label="بريد التواصل"
                      description="يظهر في صفحة التواصل."
                      props={{
                        type: "email",
                        dir: "ltr",
                        className: "text-left",
                        disabled: mutation.isPending,
                      }}
                    />
                  )}
                </form.AppField>
                <form.AppField name="contactPhone">
                  {(field) => (
                    <field.InputField
                      label="رقم الهاتف"
                      description="يظهر للزائر عند توفره."
                      props={{
                        type: "tel",
                        dir: "ltr",
                        className: "text-left",
                        disabled: mutation.isPending,
                      }}
                    />
                  )}
                </form.AppField>
                <form.AppField name="whatsappNumber">
                  {(field) => (
                    <field.InputField
                      label="رقم الواتساب"
                      description="رقم دولي بدون علامة + أو الصفر المحلي، مثل 201012345678."
                      props={{
                        type: "tel",
                        placeholder: "201012345678",
                        dir: "ltr",
                        className: "text-left",
                        disabled: mutation.isPending,
                      }}
                    />
                  )}
                </form.AppField>
                <form.AppField name="workingHours">
                  {(field) => (
                    <field.InputField
                      label="مواعيد العمل"
                      description="تظهر للزائر في صفحة التواصل."
                      props={{
                        placeholder: "السبت – الخميس، ١٠ص – ٦م",
                        disabled: mutation.isPending,
                      }}
                    />
                  )}
                </form.AppField>
                <div className="sm:col-span-2">
                  <form.AppField name="address">
                    {(field) => (
                      <field.InputField
                        label="العنوان"
                        description="يظهر للزائر عند توفره."
                        props={{
                          maxLength: 240,
                          disabled: mutation.isPending,
                        }}
                      />
                    )}
                  </form.AppField>
                </div>
                <form.AppField name="facebookUrl">
                  {(field) => (
                    <field.InputField
                      label="رابط فيسبوك"
                      description="يقبل روابط HTTP أو HTTPS."
                      props={{
                        type: "url",
                        dir: "ltr",
                        className: "text-left",
                        disabled: mutation.isPending,
                      }}
                    />
                  )}
                </form.AppField>
                <form.AppField name="instagramUrl">
                  {(field) => (
                    <field.InputField
                      label="رابط إنستجرام"
                      description="يقبل روابط HTTP أو HTTPS."
                      props={{
                        type: "url",
                        dir: "ltr",
                        className: "text-left",
                        disabled: mutation.isPending,
                      }}
                    />
                  )}
                </form.AppField>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
        <form.FormActions className="mt-6">
          <form.SubmitButton props={{ disabled: mutation.isPending }}>
            حفظ
          </form.SubmitButton>
        </form.FormActions>
      </form>
    </form.AppForm>
  );
}
