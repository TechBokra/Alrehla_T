import { useState } from "react";
import { useStore } from "@tanstack/react-form";
import { productSchema } from "@/lib/schema";
import { useAppForm } from "@/lib/form";
import { FieldGroup } from "@/components/ui/field";
import type {
  ResourceFormDefinition,
  ResourceFormFieldsContext,
} from "@/components/resources/resource-editor";
import { catalogError } from "../model";
import {
  defaultProductValues,
  isEditableProduct,
  productCreate,
  productUpdate,
  productValues,
  type Product,
} from "./model";

export const productForm: ResourceFormDefinition<Product> = {
  title: "منتج للمنصة",
  canEdit: isEditableProduct,
  getErrorMessage: catalogError,
  fields: (context) => <ProductDialogFields {...context} />,
};

function ProductDialogFields({
  action,
  record,
  formId,
  disabled,
  onSave,
}: ResourceFormFieldsContext<Product>) {
  const [defaults] = useState(() =>
    record ? productValues(record) : defaultProductValues(),
  );
  const form = useAppForm({
    defaultValues: defaults,
    validators: { onChange: productSchema, onSubmit: productSchema },
    onSubmit: async ({ value }) => {
      const values = productSchema.parse(value);
      await onSave(
        action === "edit" ? productUpdate(values) : productCreate(values),
      );
    },
  });
  const category = useStore(form.store, (state) => state.values.category);

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
          <form.AppField name="category">
            {(Fields) => (
              <Fields.SelectField
                label="التصنيف"
                options={{
                  "المكتبة — تخصيص الغلاف": "library",
                  "قصة مخصصة": "custom",
                }}
                props={{ disabled }}
              />
            )}
          </form.AppField>
          <form.AppField name="price">
            {(Fields) => (
              <Fields.InputField
                label="السعر الورقي (ج.م)"
                props={{ inputMode: "decimal", disabled }}
              />
            )}
          </form.AppField>
          {category === "custom" && (
            <form.AppField name="electronicPrice">
              {(Fields) => (
                <Fields.InputField
                  label="السعر الإلكتروني (اختياري)"
                  props={{ inputMode: "decimal", disabled }}
                />
              )}
            </form.AppField>
          )}
          <form.AppField name="imageUrl">
            {(Fields) => (
              <Fields.InputField
                label="رابط الصورة الرئيسية"
                description="رابط صورة HTTP أو HTTPS"
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
                  label="المنتج نشط"
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
