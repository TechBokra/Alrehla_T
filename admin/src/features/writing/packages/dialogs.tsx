import { useEffect, useState } from "react";
import { useStore } from "@tanstack/react-form";
import { BookOpen } from "lucide-react";
import { createResourcePage } from "@/components/resources/page";
import type { ResourceFormFieldsContext } from "@/components/resources/types";
import { CatalogImageAvatar } from "@/features/catalog/catalog-image-avatar";
import { FieldGroup } from "@/components/ui/field";
import { useAppForm } from "@/lib/form";
import {
  WRITING_PACKAGES_RESOURCE,
  writingPackageCreate,
  writingPackageDialogSchema,
  writingPackageError,
  writingPackageUpdate,
  writingPackageValues,
  type WritingPackage,
} from "./model";

export const writingPackageForm = createResourcePage<WritingPackage>({
  kind: "form",
  resource: WRITING_PACKAGES_RESOURCE,
  dialog: {
    title: "باقة الكتابة الإبداعية",
    getErrorMessage: writingPackageError,
    fields: (context) => <WritingPackageDialogFields {...context} />,
  },
});

function WritingPackageDialogFields({
  action,
  record,
  formId,
  disabled,
  onFormValidityChange,
  onSave,
}: ResourceFormFieldsContext<WritingPackage>) {
  const [defaultValues] = useState(() => writingPackageValues(record));
  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: writingPackageDialogSchema,
      onSubmit: writingPackageDialogSchema,
    },
    onSubmit: async ({ value }) => {
      const payload =
        action === "edit"
          ? writingPackageUpdate(value)
          : writingPackageCreate(value);
      await onSave(payload);
    },
  });
  const valid = useStore(form.store, (state) => state.isFormValid);
  useEffect(() => onFormValidityChange(valid), [valid, onFormValidityChange]);

  return (
    <form.AppForm>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) void form.handleSubmit();
        }}
      >
        <div dir="rtl" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex min-h-24 items-center gap-3 rounded-xl border border-border p-3">
            <CatalogImageAvatar
              src={null}
              fallback={<BookOpen aria-hidden="true" />}
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">صورة الباقة</p>
              <p className="text-sm text-muted-foreground">
                لا توجد صورة محفوظة لباقات الكتابة حاليًا.
              </p>
            </div>
          </div>
          <form.AppField name="name">
            {(Fields) => (
              <Fields.InputField
                label="اسم الباقة"
                required
                props={{ disabled, dir: "auto" }}
              />
            )}
          </form.AppField>
        </div>

        <FieldGroup className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="ageGroup">
            {(Fields) => (
              <Fields.SelectField
                label="الفئة العمرية"
                description="توضيح للأهل، ولا يمنع الحجز حسب العمر."
                required
                options={{ "أقل من ١٢ سنة": "under_12", "١٢ سنة فأكثر": "12_plus" }}
                props={{ disabled }}
              />
            )}
          </form.AppField>
          <form.AppField name="track">
            {(Fields) => (
              <Fields.SelectField
                label="المسار"
                description="المسار مستقل عن الفئة العمرية."
                options={{
                  "بدون مسار": "",
                  "مسار التأسيس": "foundation",
                  "مسار اليافعين والكبار": "youth",
                  "مسار التخصص": "specialization",
                }}
                props={{ disabled }}
              />
            )}
          </form.AppField>
          <form.AppField name="shortDescription">
            {(Fields) => (
              <Fields.TextareaField
                label="الوصف القصير"
                description="يظهر على بطاقة الباقة وأعلى صفحة التفاصيل."
                required
                props={{ disabled, rows: 2, className: "resize-y" }}
              />
            )}
          </form.AppField>
          <form.AppField name="targetAudience">
            {(Fields) => (
              <Fields.TextareaField
                label="الفئة المستهدفة"
                description="تظهر في تفاصيل الباقة تحت «لمن تناسب؟»."
                required
                props={{ disabled, rows: 2, className: "resize-y" }}
              />
            )}
          </form.AppField>
          <form.AppField name="fullDescription">
            {(Fields) => (
              <Fields.TextareaField
                label="الوصف الكامل"
                required
                props={{ disabled, rows: 4, className: "resize-y" }}
                fieldProps={{ className: "sm:col-span-2" }}
              />
            )}
          </form.AppField>
          <form.AppField name="price">
            {(Fields) => (
              <Fields.InputField
                label="السعر (ج.م)"
                description="سعر الباقة كاملة، ويظهر في البطاقة والحجز."
                required
                props={{ disabled, type: "number", min: 0, step: "any", inputMode: "decimal", dir: "ltr" }}
              />
            )}
          </form.AppField>
          <form.AppField name="sessionsCount">
            {(Fields) => (
              <Fields.InputField
                label="عدد الجلسات"
                required
                props={{ disabled, type: "number", min: 1, step: 1, inputMode: "numeric", dir: "ltr" }}
              />
            )}
          </form.AppField>
          <form.AppField name="sessionDuration">
            {(Fields) => (
              <Fields.InputField
                label="مدة الجلسة"
                description="مثال: ٤٠ دقيقة."
                required
                props={{ disabled, dir: "auto" }}
              />
            )}
          </form.AppField>
          <form.AppField name="durationText">
            {(Fields) => (
              <Fields.InputField
                label="مدة البرنامج الإجمالية"
                description="مثال: شهران أو ٨ أسابيع."
                required
                props={{ disabled, dir: "auto" }}
              />
            )}
          </form.AppField>
          <form.AppField name="prerequisiteNote">
            {(Fields) => (
              <Fields.InputField
                label="ملاحظة المتطلبات السابقة"
                description="اختياري، وتظهر في صفحة تفاصيل الباقة."
                props={{ disabled, dir: "auto" }}
              />
            )}
          </form.AppField>
          <form.AppField name="isActive">
            {(Fields) => (
              <Fields.CheckboxField
                label="الباقة نشطة ومتاحة للحجز"
                props={{ disabled }}
                fieldProps={{ className: "sm:col-span-2" }}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </form>
    </form.AppForm>
  );
}
