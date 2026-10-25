import { useState } from "react";
import type { BaseRecord } from "@refinedev/core";
import { useStore } from "@tanstack/react-form";
import type { z } from "zod";
import { useAppForm } from "@/components/forms";
import { FieldGroup } from "@/components/ui/field";
import {
  ResourceFormDialog,
  type ResourceFormDialogContext,
} from "@/components/resources/resource-form-dialog";
import {
  useResourceContext,
  type ResourceEditorTarget,
} from "@/components/resources/resource-context";
import {
  catalogError,
  defaultCatalogValues,
  type CatalogValues,
} from "./model";

export type CatalogResourceName = "personalized_products" | "addon_products";
export interface CatalogDefinition<TRecord extends BaseRecord> {
  title: string;
  schema: z.ZodType<CatalogValues>;
  fromRecord: (row: TRecord) => CatalogValues;
  canEdit: (row: TRecord) => boolean;
  createPayload: (values: CatalogValues) => Record<string, unknown>;
  updatePayload: (values: CatalogValues) => Record<string, unknown>;
}

export function CatalogEditor<TRecord extends BaseRecord>({
  definition,
}: {
  definition: CatalogDefinition<TRecord>;
}) {
  const { resource, target, close } = useResourceContext();
  if (!target || target.action === "delete") return null;
  return (
    <ResourceFormDialog<TRecord>
      resource={resource}
      id={target.action === "edit" ? target.id : undefined}
      title={`${target.action === "edit" ? "تعديل" : "إضافة"} ${definition.title}`}
      canEdit={definition.canEdit}
      getErrorMessage={catalogError}
      onClose={close}
    >
      {(context) => (
        <CatalogEditorForm
          resource={resource}
          definition={definition}
          target={target}
          {...context}
        />
      )}
    </ResourceFormDialog>
  );
}

function CatalogEditorForm<TRecord extends BaseRecord>({
  resource,
  definition,
  target,
  record,
  formId,
  disabled,
  onSave,
}: {
  resource: string;
  definition: CatalogDefinition<TRecord>;
  target: ResourceEditorTarget;
} & ResourceFormDialogContext<TRecord>) {
  const [defaults] = useState(() =>
    record ? definition.fromRecord(record) : defaultCatalogValues(),
  );
  const form = useAppForm({
    defaultValues: defaults,
    validators: { onChange: definition.schema, onSubmit: definition.schema },
    onSubmit: async ({ value }) => {
      const values = definition.schema.parse(value);
      await onSave(
        target.action === "edit"
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
          {target.action === "edit" && (
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
