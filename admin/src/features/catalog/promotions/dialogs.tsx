import { useEffect, useState } from "react";
import { useStore } from "@tanstack/react-form";
import { useAppForm } from "@/lib/form";
import { createResourcePage } from "@/components/resources/page";
import type { ResourceFormFieldsContext } from "@/components/resources/types";
import { FieldGroup } from "@/components/ui/field";
import {
  PROMOTIONS_PROVIDER,
  promotionDialogSchema,
  promotionError,
  promotionPayload,
  promotionValues,
  targetLabels,
  type Promotion,
  type TargetType,
} from "./model";
import { PromotionTargetField } from "./target-field";

export const promotionForm = createResourcePage<Promotion>({
  kind: "form",
  resource: "price_promotions",
  dataProviderName: PROMOTIONS_PROVIDER,
  dialog: {
    title: "عرض",
    getErrorMessage: promotionError,
    fields: (context) => <PromotionDialogFields {...context} />,
  },
});
function PromotionDialogFields({
  record,
  formId,
  disabled,
  onFormValidityChange,
  onSave,
}: ResourceFormFieldsContext<Promotion>) {
  const [defaultValues] = useState(() => promotionValues(record));
  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: promotionDialogSchema,
      onSubmit: promotionDialogSchema,
    },
    onSubmit: async ({ value }) => {
      await onSave(promotionPayload(value));
    },
  });
  const valid = useStore(form.store, (state) => state.isFormValid);
  const target = useStore(form.store, (state) => state.values.targetType);
  const kind = useStore(form.store, (state) => state.values.kind);
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
          <form.AppField name="targetType">
            {(field) => (
              <field.SelectField
                label="ينطبق على"
                required
                options={Object.fromEntries(
                  Object.entries(targetLabels).map(([value, label]) => [
                    label,
                    value,
                  ]),
                )}
                props={{
                  disabled,
                  onValueChange: (value) => {
                    field.handleChange(value as TargetType);
                    form.setFieldValue("targetId", "");
                  },
                }}
              />
            )}
          </form.AppField>
          <form.AppField name="targetId">
            {() => (
              <PromotionTargetField
                key={target}
                type={target}
                disabled={disabled}
              />
            )}
          </form.AppField>
          <form.AppField name="kind">
            {(field) => (
              <field.SelectField
                label="نوع الخصم"
                required
                options={{ "نسبة خصم": "percent", "سعر العرض": "sale_price" }}
                props={{ disabled }}
              />
            )}
          </form.AppField>
          <form.AppField name="value">
            {(field) => (
              <field.InputField
                label={
                  kind === "percent" ? "نسبة الخصم (%)" : "سعر العرض (ج.م)"
                }
                description={
                  kind === "percent"
                    ? "عدد صحيح من ١ إلى ٩٩."
                    : "عدد صحيح أقل من السعر الأصلي الحالي."
                }
                required
                props={{ disabled, inputMode: "numeric", dir: "ltr" }}
              />
            )}
          </form.AppField>
          <form.AppField name="startsAtLocal">
            {(field) => (
              <field.InputField
                label="يبدأ — بتوقيت القاهرة"
                required
                props={{ disabled, type: "datetime-local", dir: "ltr" }}
              />
            )}
          </form.AppField>
          <form.AppField name="endsAtLocal">
            {(field) => (
              <field.InputField
                label="ينتهي — بتوقيت القاهرة"
                required
                props={{ disabled, type: "datetime-local", dir: "ltr" }}
              />
            )}
          </form.AppField>
          <form.AppField name="label">
            {(field) => (
              <field.InputField
                label="عنوان الشارة (اختياري)"
                description="حتى ٦٠ حرفًا، مثل: عرض نهاية الأسبوع."
                props={{ disabled, dir: "auto" }}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </form>
    </form.AppForm>
  );
}
