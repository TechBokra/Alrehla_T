import { useState } from "react";
import type { BaseRecord } from "@refinedev/core";
import { useStore } from "@tanstack/react-form";
import type { z } from "zod";
import { useAppForm } from "@/lib/form";
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
            {(Fields) => (
              <Fields.InputField
                label="الاسم"
                props={{
                  disabled: disabled,
                }}
              />
            )}
          </form.AppField>
          <form.AppField name="description">
            {(Fields) => (
              <Fields.TextareaField
                label="الوصف المختصر"
                props={{
                  disabled: disabled,
                }}
              />
            )}
          </form.AppField>
          <form.AppField name="longDescription">
            {(Fields) => (
              <Fields.TextareaField
                label="الوصف الكامل"
                props={{
                  disabled: disabled,
                }}
              />
            )}
          </form.AppField>
          {product && (
            <form.AppField name="category">
              {(Fields) => (
                <Fields.SelectField
                  label="التصنيف"
                  options={{
                    "المكتبة — تخصيص الغلاف": "library",
                    "قصة مخصصة": "custom",
                  }}
                  props={{
                    disabled: disabled,
                  }}
                />
              )}
            </form.AppField>
          )}
          <form.AppField name="price">
            {(Fields) => (
              <Fields.InputField
                label={
                  product ? "السعر الورقي (ج.م)" : "السعر الشامل للتخصيص (ج.م)"
                }
                props={{
                  inputMode: "decimal",
                  disabled: disabled,
                }}
              />
            )}
          </form.AppField>
          {product && category === "custom" && (
            <form.AppField name="electronicPrice">
              {(Fields) => (
                <Fields.InputField
                  label="السعر الإلكتروني (اختياري)"
                  props={{
                    inputMode: "decimal",
                    disabled: disabled,
                  }}
                />
              )}
            </form.AppField>
          )}
          <form.AppField name="imageUrl">
            {(Fields) => (
              <Fields.InputField
                label="رابط الصورة الرئيسية"
                description={
                  product
                    ? "رابط صورة HTTP أو HTTPS"
                    : "رابط من https://res.cloudinary.com/"
                }
                props={{ dir: "ltr", inputMode: "url", disabled }}
              />
            )}
          </form.AppField>
          <form.AppField name="sortOrder">
            {(Fields) => (
              <Fields.InputField
                label="ترتيب العرض"
                props={{
                  inputMode: "numeric",
                  disabled: disabled,
                }}
              />
            )}
          </form.AppField>
          {action === "edit" && (
            <form.AppField name="isActive">
              {(Fields) => (
                <Fields.CheckboxField
                  label="المنتج نشط"
                  props={{
                    disabled: disabled,
                  }}
                />
              )}
            </form.AppField>
          )}
        </FieldGroup>
      </form>
    </form.AppForm>
  );
}
