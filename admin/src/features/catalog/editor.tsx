import { useState } from "react";
import type { BaseRecord } from "@refinedev/core";
import { useStore } from "@tanstack/react-form";
import type { z } from "zod";
import { useAppForm } from "@/components/forms";
import { FieldGroup } from "@/components/ui/field";
import type { ResourceFormFieldsContext } from "@/components/resources/resource-editor";
import { defaultCatalogValues } from "./model";
import type { CatalogValues, AdminResourceName } from "@/lib/schema";

export type CatalogResourceName = Extract<
  AdminResourceName,
  "personalized_products" | "addon_products"
>;
export interface CatalogDefinition<TRecord extends BaseRecord> {
  title: string;
  schema: z.ZodType<CatalogValues>;
  fromRecord: (row: TRecord) => CatalogValues;
  canEdit: (row: TRecord) => boolean;
  createPayload: (values: CatalogValues) => Record<string, unknown>;
  updatePayload: (values: CatalogValues) => Record<string, unknown>;
}

export function CatalogFormFields<TRecord extends BaseRecord>({
  resource,
  action,
  definition,
  record,
  formId,
  disabled,
  onSave,
}: {
  definition: CatalogDefinition<TRecord>;
} & ResourceFormFieldsContext<TRecord>) {
  const [defaults] = useState(() =>
    record ? definition.fromRecord(record) : defaultCatalogValues(),
  );
  const form = useAppForm({
    defaultValues: defaults,
    validators: { onChange: definition.schema, onSubmit: definition.schema },
    onSubmit: async ({ value }) => {
      const values = definition.schema.parse(value);
      await onSave(
        action === "edit"
          ? definition.updatePayload(values)
          : definition.createPayload(values),
      );
    },
  });
  const category = useStore(form.store, (state) => state.values.category);
  const product = resource === "personalized_products";
  return (
    <form.AppForm>
      <form
        id={formId}
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
            {(Fields) => <Fields.Input label="الاسم" disabled={disabled} />}
          </form.AppField>
          <form.AppField name="description">
            {(Fields) => (
              <Fields.Textarea label="الوصف المختصر" disabled={disabled} />
            )}
          </form.AppField>
          <form.AppField name="longDescription">
            {(Fields) => (
              <Fields.Textarea label="الوصف الكامل" disabled={disabled} />
            )}
          </form.AppField>
          {product && (
            <form.AppField name="category">
              {(Fields) => (
                <Fields.Select
                  label="التصنيف"
                  disabled={disabled}
                  options={[
                    { value: "library", label: "المكتبة — تخصيص الغلاف" },
                    { value: "custom", label: "قصة مخصصة" },
                  ]}
                />
              )}
            </form.AppField>
          )}
          <form.AppField name="price">
            {(Fields) => (
              <Fields.Input
                label={
                  product ? "السعر الورقي (ج.م)" : "السعر الشامل للتخصيص (ج.م)"
                }
                inputMode="decimal"
                disabled={disabled}
              />
            )}
          </form.AppField>
          {product && category === "custom" && (
            <form.AppField name="electronicPrice">
              {(Fields) => (
                <Fields.Input
                  label="السعر الإلكتروني (اختياري)"
                  inputMode="decimal"
                  disabled={disabled}
                />
              )}
            </form.AppField>
          )}
          <form.AppField name="imageUrl">
            {(Fields) => (
              <Fields.Input
                label="رابط الصورة الرئيسية"
                dir="ltr"
                inputMode="url"
                disabled={disabled}
                description={
                  product
                    ? "رابط صورة HTTP أو HTTPS"
                    : "رابط من https://res.cloudinary.com/"
                }
              />
            )}
          </form.AppField>
          <form.AppField name="sortOrder">
            {(Fields) => (
              <Fields.Input
                label="ترتيب العرض"
                inputMode="numeric"
                disabled={disabled}
              />
            )}
          </form.AppField>
          {action === "edit" && (
            <form.AppField name="isActive">
              {(Fields) => (
                <Fields.Switch label="المنتج نشط" disabled={disabled} />
              )}
            </form.AppField>
          )}
        </FieldGroup>
      </form>
    </form.AppForm>
  );
}
