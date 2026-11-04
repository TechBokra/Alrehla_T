import { useEffect, useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { useStore } from "@tanstack/react-form";
import { createResourcePage } from "@/components/resources/page";
import type { ResourceFormFieldsContext } from "@/components/resources/types";
import { FieldGroup } from "@/components/ui/field";
import { useAppForm } from "@/lib/form";
import {
  BOX_PLANS_PROVIDER,
  boxPlanDialogSchema,
  boxPlanError,
  boxPlanPayload,
  boxPlanValues,
  type BoxPlan,
  type BoxPlanAddon,
} from "./model";

export const boxPlanForm = createResourcePage<BoxPlan>({
  kind: "form",
  resource: "box_subscription_plans",
  dataProviderName: BOX_PLANS_PROVIDER,
  dialog: {
    title: "خطة صندوق الرحلة",
    uploads: {
      planImage: {
        folder: "alrehla/box-plans",
        accept: "image/jpeg,image/png,image/webp,image/avif",
        maxSize: 5 * 1024 * 1024,
        // Keep one final image but allow the UploadCN queue to replace a selected file.
        maxFiles: 2,
      },
    },
    getErrorMessage: boxPlanError,
    fields: (context) => <BoxPlanDialogFields {...context} />,
  },
});

function BoxPlanDialogFields({
  record,
  formId,
  disabled,
  onFormValidityChange,
  resolveImages,
  submit,
}: ResourceFormFieldsContext<BoxPlan>) {
  const [defaultValues] = useState(() => boxPlanValues(record));
  const addonsQuery = useList<BoxPlanAddon>({
    resource: "box_plan_addons",
    dataProviderName: BOX_PLANS_PROVIDER,
    pagination: { mode: "off" },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { retry: false },
  });
  const addons = addonsQuery.query.data?.data ?? [];
  const addonOptions = useMemo(() => {
    const entries: [string, string][] = [["من غير إضافة مجانية", ""]];
    const labels = new Set<string>();
    for (const addon of addons) {
      let label = addon.is_active ? addon.name : `${addon.name} (موقوفة)`;
      if (labels.has(label)) label = `${label} · ${addon.id.slice(0, 6)}`;
      labels.add(label);
      entries.push([label, addon.id]);
    }
    return Object.fromEntries(entries);
  }, [addons]);
  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: boxPlanDialogSchema,
      onSubmit: boxPlanDialogSchema,
    },
    onSubmit: async ({ value }) => {
      await submit(async () => {
        const [imageUrl] = await resolveImages("planImage", value.image);
        return boxPlanPayload(value, imageUrl ?? "");
      });
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
        <div dir="ltr" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div dir="rtl" className="flex flex-col gap-4">
            <form.AppField name="name">
              {(Fields) => (
                <Fields.InputField label="اسم الباقة" required props={{ disabled, dir: "auto" }} />
              )}
            </form.AppField>
            <form.AppField name="description">
              {(Fields) => (
                <Fields.TextareaField
                  label="وصف مختصر"
                  props={{ disabled, rows: 3, className: "resize-y" }}
                />
              )}
            </form.AppField>
          </div>
          <div dir="rtl">
            <form.AppField name="image">
              {(Fields) => (
                <Fields.ImageUploadField
                  label="صورة الباقة"
                  description="اختر صورة توضح الباقة للعميل."
                  uploadKey="planImage"
                  appearance="box-plan"
                  disabled={disabled}
                />
              )}
            </form.AppField>
          </div>
        </div>
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="durationMonths">
            {(Fields) => (
              <Fields.InputField
                label="المدة بالأشهر"
                description="عدد الصناديق — صندوق كل شهر."
                required
                props={{ disabled, type: "number", min: 1, step: 1, inputMode: "numeric", dir: "ltr" }}
              />
            )}
          </form.AppField>
          <form.AppField name="priceTotal">
            {(Fields) => (
              <Fields.InputField
                label="السعر الإجمالي (ج.م)"
                description="إجمالي ما يدفعه العميل للمدة كلها."
                required
                props={{ disabled, type: "number", min: 0, step: "any", inputMode: "decimal", dir: "ltr" }}
              />
            )}
          </form.AppField>
          <form.AppField name="priceMonthly">
            {(Fields) => (
              <Fields.InputField
                label="السعر الشهري المعروض (ج.م)"
                description="الإجمالي لازم يساوي السعر الشهري × المدة أو يقل عنه."
                required
                props={{ disabled, type: "number", min: 0, step: "any", inputMode: "decimal", dir: "ltr" }}
              />
            )}
          </form.AppField>
          <form.AppField name="savingsNote">
            {(Fields) => (
              <Fields.InputField
                label="ملاحظة التوفير"
                description="مثال: وفّر ٦٠٠ ج.م"
                props={{ disabled, dir: "auto" }}
              />
            )}
          </form.AppField>
          <form.AppField name="addonDiscountPercent">
            {(Fields) => (
              <Fields.InputField
                label="خصم المشترك على الإضافات ٪"
                description="من ٠ إلى ٩٠٪. اكتب ٠ من غير خصم."
                props={{ disabled, type: "number", min: 0, max: 90, step: 1, inputMode: "numeric", dir: "ltr" }}
              />
            )}
          </form.AppField>
          <form.AppField name="freeAddonId">
            {(Fields) => (
              <Fields.SelectField
                label="إضافة مجانية في كل صندوق"
                description={
                  addonsQuery.query.isError
                    ? "تعذّر تحميل الإضافات؛ يمكنك ترك الاختيار فارغًا والمحاولة لاحقًا."
                    : "اختياري — تظهر للإدارة مع كل شهر من الاشتراك."
                }
                options={addonOptions}
                props={{ disabled: disabled || addonsQuery.query.isError }}
              />
            )}
          </form.AppField>
          <form.AppField name="featuresText">
            {(Fields) => (
              <Fields.TextareaField
                label="مزايا الباقة"
                description="اكتب ميزة واحدة في كل سطر."
                props={{
                  disabled,
                  rows: 4,
                  placeholder: "كتاب مخصص كل شهر\nأنشطة ورقية\nشحن مجاني",
                  className: "resize-y",
                }}
                fieldProps={{ className: "sm:col-span-2" }}
              />
            )}
          </form.AppField>
          <form.AppField name="isHighlighted">
            {(Fields) => (
              <Fields.CheckboxField
                label="الأكثر اختيارًا"
                description="خطة واحدة فقط تحمل هذه العلامة."
                props={{ disabled }}
              />
            )}
          </form.AppField>
          <form.AppField name="isActive">
            {(Fields) => (
              <Fields.CheckboxField
                label="ظاهرة للعملاء"
                props={{ disabled }}
              />
            )}
          </form.AppField>
        </FieldGroup>
      </form>
    </form.AppForm>
  );
}
