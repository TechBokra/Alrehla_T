import { useEffect, useState } from "react";
import { useStore } from "@tanstack/react-form";
import { useAppForm } from "@/lib/form";
import { createResourcePage } from "@/components/resources/page";
import type { ResourceFormFieldsContext } from "@/components/resources/types";
import { FieldGroup } from "@/components/ui/field";
import {
  CATALOG_SETTINGS_PROVIDER,
  catalogSettingsError,
  dialectDialogSchema,
  dialectPayload,
  dialectValues,
  type WritingDialect,
} from "./model";

export const writingDialectForm = createResourcePage<WritingDialect>({
  kind: "form",
  resource: "writing_dialects",
  dataProviderName: CATALOG_SETTINGS_PROVIDER,
  dialog: {
    title: "لهجة كتابة",
    getErrorMessage: catalogSettingsError,
    fields: (context) => <DialectDialogFields {...context} />,
  },
});

function DialectDialogFields({
  action,
  record,
  formId,
  disabled,
  onFormValidityChange,
  onSave,
}: ResourceFormFieldsContext<WritingDialect>) {
  const [defaultValues] = useState(() => dialectValues(record));
  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: dialectDialogSchema,
      onSubmit: dialectDialogSchema,
    },
    onSubmit: async ({ value }) => {
      await onSave(dialectPayload(value, action === "create"));
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
        <FieldGroup>
          <form.AppField name="nameAr">
            {(Fields) => (
              <Fields.InputField
                required
                label="اسم اللهجة"
                props={{ disabled, dir: "auto" }}
              />
            )}
          </form.AppField>
          <form.AppField name="code">
            {(Fields) => (
              <Fields.InputField
                required
                label="الكود"
                description="حروف إنجليزية صغيرة وشرطة سفلية. الكود ثابت بعد الإنشاء."
                props={{
                  disabled: disabled || action === "edit",
                  dir: "ltr",
                  autoCapitalize: "none",
                  spellCheck: false,
                }}
              />
            )}
          </form.AppField>
          <form.AppField name="isActive">
            {(Fields) => (
              <Fields.CheckboxField
                label="اللهجة متاحة للعملاء"
                description="أوقف اللهجة لإخفائها مع الاحتفاظ بالطلبات السابقة."
                props={{ disabled }}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </form>
    </form.AppForm>
  );
}
