import { useState } from "react";
import { addonSchema } from "@/lib/schema";
import { useAppForm } from "@/lib/form";
import { FieldGroup } from "@/components/ui/field";
import type {
  ResourceFormDefinition,
  ResourceFormFieldsContext,
} from "@/components/resources/resource-editor";
import { catalogError } from "../model";
import {
  addonCreate,
  addonUpdate,
  addonValues,
  defaultAddonValues,
  type Addon,
} from "./model";

export const addonForm: ResourceFormDefinition<Addon> = {
  title: "إضافة",
  getErrorMessage: catalogError,
  fields: (context) => <AddonDialogFields {...context} />,
};

function AddonDialogFields({
  action,
  record,
  formId,
  disabled,
  onSave,
}: ResourceFormFieldsContext<Addon>) {
  const [defaults] = useState(() =>
    record ? addonValues(record) : defaultAddonValues(),
  );
  const form = useAppForm({
    defaultValues: defaults,
    validators: { onChange: addonSchema, onSubmit: addonSchema },
    onSubmit: async ({ value }) => {
      const values = addonSchema.parse(value);
      await onSave(action === "edit" ? addonUpdate(values) : addonCreate(values));
    },
  });

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
        className="flex flex-col gap-5"
      >
        <form.FormErrorSummary />
        <FieldGroup>
          <form.AppField name="name">
            {(Fields) => (
              <Fields.InputField label="الاسم" props={{ disabled }} />
            )}
          </form.AppField>
          <form.AppField name="description">
            {(Fields) => (
              <Fields.TextareaField
                label="الوصف المختصر"
                props={{ disabled }}
              />
            )}
          </form.AppField>
          <form.AppField name="longDescription">
            {(Fields) => (
              <Fields.TextareaField
                label="الوصف الكامل"
                props={{ disabled }}
              />
            )}
          </form.AppField>
          <form.AppField name="price">
            {(Fields) => (
              <Fields.InputField
                label="السعر الشامل للتخصيص (ج.م)"
                props={{ inputMode: "decimal", disabled }}
              />
            )}
          </form.AppField>
          <form.AppField name="imageUrl">
            {(Fields) => (
              <Fields.InputField
                label="رابط الصورة الرئيسية"
                description="رابط من https://res.cloudinary.com/"
                props={{ dir: "ltr", inputMode: "url", disabled }}
              />
            )}
          </form.AppField>
          <form.AppField name="sortOrder">
            {(Fields) => (
              <Fields.InputField
                label="ترتيب العرض"
                props={{ inputMode: "numeric", disabled }}
              />
            )}
          </form.AppField>
          {action === "edit" && (
            <form.AppField name="isActive">
              {(Fields) => (
                <Fields.CheckboxField
                  label="الإضافة نشطة"
                  props={{ disabled }}
                />
              )}
            </form.AppField>
          )}
        </FieldGroup>
      </form>
    </form.AppForm>
  );
}
