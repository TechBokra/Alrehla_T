import { useRef } from "react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useUpdate } from "@refinedev/core";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { useAppForm } from "@/lib/form";
import { productPageSchema, preparationDaysSchema } from "./schema";
import { catalogError } from "../../model";
import {
  defaultValues,
  hasPreparationDaysColumns,
  toCreatePayload,
  toUpdatePayload,
  valuesFromProduct,
  type ProductPreparationRow,
} from "./model";
import { isEditableProduct, type Product } from "../model";
import { createResourcePage } from "@/components/resources/page";
import type {
  ResourceFormFactory,
  ResourceFormFeatureContext,
} from "@/components/resources/page";
import { useResourcePage, useResourceFormBaseline } from "@/hooks/resources";
import {
  ResourceFormDirtyGuard,
  ResourceFormFooter,
} from "@/components/resources/forms/page";
import { Badge } from "@/components/ui/badge";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductImageLibraryPicker } from "./images-field";
import { ProductPersonalizationSection } from "./personalization-section";
import { useResourceAuthorization } from "@/hooks/resources";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";

const writingStyleOptions = [
  { value: "fusha", label: "فصحى" },
  { value: "simple", label: "عربية مبسطة" },
  { value: "dialect", label: "لهجة" },
] as const;

function useProductFeatureForm(context: ResourceFormFeatureContext<Product>) {
  const { mode, record, submit, resolveImages } = context;
  const baseline = useResourceFormBaseline(() =>
    record ? valuesFromProduct(record) : defaultValues(),
  );
  const form = useAppForm({
    defaultValues: baseline.defaultValues,
    // Start validation on submit. After an invalid submit, revalidate as the
    // user edits so errors and the footer recover without painting a fresh form.
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    validators: { onDynamic: productPageSchema },
    onSubmit: async ({ value }) => {
      await submit({
        prepare: async () => {
          const values = productPageSchema.parse(value);
          const imageUrls = await resolveImages("cover", values.images);
          return mode === "edit"
            ? toUpdatePayload(values, imageUrls)
            : toCreatePayload(values, imageUrls);
        },
        reset: (saved) => baseline.reset(form, valuesFromProduct(saved)),
      });
    },
  });
  const isDirty = useStore(form.store, (state) => state.isDirty);
  return { form, isDirty };
}

type ProductFeatureForm = ReturnType<typeof useProductFeatureForm>;

export const productForm: ResourceFormFactory<Product, ProductFeatureForm> =
  createResourcePage<Product, ProductFeatureForm>({
    kind: "form",
    resource: "personalized_products",
    dataProviderName: "default",
    page: {
      title: (mode) =>
        mode === "create" ? "إضافة منتج للمنصة" : "تعديل المنتج",
      successMessage: (mode) =>
        mode === "edit" ? "تم حفظ التغييرات." : "تم حفظ المنتج.",
      uploads: {
        cover: {
          folder: "alrehla/products",
          accept: "image/jpeg,image/png,image/webp,image/avif",
          maxSize: 5 * 1024 * 1024,
          maxFiles: 1,
        },
      },
      canEdit: isEditableProduct,
      getErrorMessage: catalogError,
      useFeatureForm: useProductFeatureForm,
      Content: ProductFormContent,
      Fields: ProductFormFields,
    },
  });

export function ProductFormPage({ id }: { id?: string }) {
  const Page = productForm.Page;
  return <Page id={id} />;
}

function ProductFormContent() {
  const page = useResourcePage(productForm);
  const form = page.form;
  const upload = page.uploads?.cover;
  const navigate = useNavigate();
  const values = useStore(form.store, (state) => state.values);
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const formDirty = useStore(form.store, (state) => state.isDirty);
  const formDisabled = page.disabled || submitting;
  const hasQueuedImages = values.images.some(
    (image) => image.kind === "queued",
  );
  const saveDisabled =
    page.disabled ||
    Boolean(upload?.failed) ||
    (hasQueuedImages &&
      (!upload?.adapter || !upload.allowed || upload.accessPending));
  const cancel = () => void navigate({ to: "/catalog/products" });
  return (
    <div className="flex flex-col gap-6">
      <form.AppForm>
        <productForm.DirtyGuard />
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!formDisabled && !saveDisabled) void form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <productForm.Fields />
          <productForm.Footer
            disabled={saveDisabled}
            onCancel={page.mode === "edit" ? cancel : undefined}
            className="sticky bottom-0 z-10 -mx-1 rounded-xl border bg-background px-3 py-3 shadow-sm"
          />
        </form>
      </form.AppForm>

      <ProductPersonalizationSection
        productId={page.record?.id}
        disabled={page.disabled || submitting || formDirty}
      />

      {page.mode === "edit" && page.record ? (
        <Card>
          <CardHeader>
            <CardTitle>مدة التجهيز</CardTitle>
            <CardDescription>حدد الوقت المتوقع لتجهيز كل نسخة.</CardDescription>
          </CardHeader>
          <CardContent>
            <PreparationDaysSection
              record={page.record}
              disabled={page.disabled || submitting || formDirty}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ProductFormFields() {
  const page = useResourcePage(productForm);
  const form = page.form;
  const category = useStore(form.store, (state) => state.values.category);
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const formDisabled = page.disabled || submitting;

  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.38fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>بيانات المنتج</CardTitle>
            <CardDescription>الاسم والتصنيف الأساسيان للمنتج.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <form.AppField name="name">
                  {(Fields) => (
                    <Fields.InputField
                      label="اسم المنتج"
                      required
                      props={{ disabled: formDisabled }}
                    />
                  )}
                </form.AppField>
              </div>
              <div className="min-w-0">
                <form.AppField name="category">
                  {(Fields) => (
                    <Fields.SelectField
                      label="التصنيف"
                      required
                      options={{
                        "منتج المكتبة": "library",
                        "قصة مخصصة": "custom",
                      }}
                      props={{ disabled: formDisabled }}
                    />
                  )}
                </form.AppField>
              </div>
              <Field className="sm:col-span-2">
                <FieldLabel>مالك المنتج</FieldLabel>
                <Badge variant="secondary" className="w-fit">
                  المنصة
                </Badge>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>محتوى القصة</CardTitle>
            <CardDescription>
              اكتب وصفاً موجزاً ثم أضف التفاصيل والمميزات.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <form.AppField name="description">
                {(Fields) => (
                  <Fields.TextareaField
                    label="الوصف المختصر"
                    props={{ disabled: formDisabled, maxLength: 600, rows: 3 }}
                  />
                )}
              </form.AppField>
              <form.AppField name="longDescription">
                {(Fields) => (
                  <Fields.TextareaField
                    label="الوصف الكامل"
                    description="اختياري — بيظهر في صفحة المنتج. يدعم ## عنوان و- نقطة و**عريض**."
                    props={{ disabled: formDisabled, rows: 8, maxLength: 5000 }}
                  />
                )}
              </form.AppField>
              <form.AppField name="featuresText">
                {(Fields) => (
                  <Fields.TextareaField
                    label="مميزات المنتج"
                    props={{ disabled: formDisabled, rows: 6, maxLength: 5000 }}
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>السعر والتخصيص</CardTitle>
            <CardDescription>
              الأسعار المتاحة وأنماط كتابة القصة المخصصة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <form.AppField name="price">
                  {(Fields) => (
                    <Fields.InputField
                      label="السعر الورقي (ج.م)"
                      required
                      props={{ disabled: formDisabled, inputMode: "decimal" }}
                    />
                  )}
                </form.AppField>
              </div>
              {category === "custom" ? (
                <div className="min-w-0">
                  <form.AppField name="electronicPrice">
                    {(Fields) => (
                      <Fields.InputField
                        label="السعر الإلكتروني (ج.م)"
                        props={{ disabled: formDisabled, inputMode: "decimal" }}
                      />
                    )}
                  </form.AppField>
                </div>
              ) : null}
              {category === "custom" ? (
                <form.AppField name="writingStyles">
                  {(field) => {
                    return (
                      <BaseFormField
                        label="أساليب الكتابة"
                        required
                        disabled={formDisabled}
                        variant="fieldset"
                        fieldProps={{ className: "min-w-0 sm:col-span-2" }}
                      >
                        {({
                          id,
                          disabled,
                          "aria-invalid": ariaInvalid,
                          "aria-describedby": describedBy,
                        }) => (
                          <ToggleGroup
                            id={id}
                            type="multiple"
                            value={field.state.value}
                            onValueChange={(value) =>
                              field.handleChange(
                                value as typeof field.state.value,
                              )
                            }
                            onBlur={field.handleBlur}
                            disabled={disabled}
                            aria-label="أساليب الكتابة"
                            aria-invalid={ariaInvalid}
                            aria-describedby={describedBy}
                            className="flex-wrap"
                          >
                            {writingStyleOptions.map((option) => (
                              <ToggleGroupItem
                                key={option.value}
                                value={option.value}
                                variant="outline"
                              >
                                {option.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        )}
                      </BaseFormField>
                    );
                  }}
                </form.AppField>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <aside className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>غلاف المنتج</CardTitle>
            <CardDescription>اختر صورة طولية واضحة للغلاف.</CardDescription>
          </CardHeader>
          <CardContent>
            <form.AppField name="images">
              {(Fields) => (
                <Fields.ImageUploadField
                  label="غلاف الكتاب — يفضّل طولي (3:4)"
                  uploadKey="cover"
                  disabled={formDisabled}
                  renderSourcePicker={({ disabled, onPick }) => (
                    <ProductImageLibraryPicker
                      disabled={disabled}
                      onPick={(asset) => onPick(asset.url)}
                    />
                  )}
                />
              )}
            </form.AppField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الفئة العمرية</CardTitle>
            <CardDescription>
              ساعد العملاء على معرفة العمر المناسب.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              <form.AppField name="minAge">
                {(Fields) => (
                  <Fields.InputField
                    label="العمر من"
                    props={{
                      type: "number",
                      min: 0,
                      max: 20,
                      disabled: formDisabled,
                    }}
                  />
                )}
              </form.AppField>
              <form.AppField name="maxAge">
                {(Fields) => (
                  <Fields.InputField
                    label="العمر إلى"
                    props={{
                      type: "number",
                      min: 0,
                      max: 20,
                      disabled: formDisabled,
                    }}
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </CardContent>
        </Card>

        {page.mode === "edit" ? (
          <Card>
            <CardHeader>
              <CardTitle>حالة المنتج</CardTitle>
              <CardDescription>تحكم في ظهور المنتج في المنصة.</CardDescription>
            </CardHeader>
            <CardContent>
              <form.AppField name="isActive">
                {(Fields) => (
                  <Fields.CheckboxField
                    label="المنتج نشط"
                    props={{ disabled: formDisabled }}
                  />
                )}
              </form.AppField>
            </CardContent>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}

function PreparationDaysSection({
  record,
  disabled,
}: {
  record: Product;
  disabled: boolean;
}) {
  const page = useResourcePage(productForm);
  const canEdit = isEditableProduct(record);
  const access = useResourceAuthorization("personalized_products", "edit", {
    id: record.id,
    record,
  });
  const available = hasPreparationDaysColumns(record);
  const mutation = useUpdate<Product>({
    mutationMode: "pessimistic",
    successNotification: false,
    errorNotification: false,
    mutationOptions: { retry: false },
  });
  const inFlight = useRef(false);
  const row = record as ProductPreparationRow;
  const baseline = useResourceFormBaseline(() => ({
    electronic:
      row.delivery_days_electronic == null
        ? ""
        : String(row.delivery_days_electronic),
    printed:
      row.delivery_days_printed == null
        ? ""
        : String(row.delivery_days_printed),
  }));
  const form = useAppForm({
    defaultValues: baseline.defaultValues,
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    validators: { onDynamic: preparationDaysSchema },
    onSubmit: async ({ value }) => {
      if (inFlight.current || !available || !canEdit || !access.allowed) return;
      inFlight.current = true;
      try {
        const currentRecord = await page.refreshRecord?.();
        if (!currentRecord || !isEditableProduct(currentRecord)) {
          throw new Error("هذا المنتج غير متاح للتعديل.");
        }
        await assertResourceAccess("personalized_products", "edit", {
          id: record.id,
          record: currentRecord,
        });
        const parsed = preparationDaysSchema.parse(value);
        const saved = await mutation.mutateAsync({
          resource: "personalized_products",
          id: record.id,
          values: {
            delivery_days_electronic: parsed.electronic
              ? Number(parsed.electronic)
              : null,
            delivery_days_printed: parsed.printed
              ? Number(parsed.printed)
              : null,
          },
        });
        const next = saved.data as ProductPreparationRow;
        baseline.reset(form, {
          electronic:
            next.delivery_days_electronic == null
              ? ""
              : String(next.delivery_days_electronic),
          printed:
            next.delivery_days_printed == null
              ? ""
              : String(next.delivery_days_printed),
        });
        toast.success("تم حفظ مدة التجهيز.");
      } catch (error) {
        toast.error(catalogError(error));
      } finally {
        inFlight.current = false;
      }
    },
  });
  const formDisabled =
    disabled ||
    mutation.mutation.isPending ||
    !access.allowed ||
    access.isPending ||
    !available;
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const fieldsDisabled = formDisabled || submitting;
  return (
    <form.AppForm>
      <ResourceFormDirtyGuard />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!fieldsDisabled) void form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2"
      >
        {!available ? (
          <Alert className="col-span-full">
            <AlertCircle />
            <AlertTitle>مدة التجهيز غير مفعّلة في هذه البيئة</AlertTitle>
            <AlertDescription>
              تحتاج قاعدة البيانات إلى ترقية أعمدة مدة التجهيز قبل حفظها. بقية
              بيانات المنتج متاحة للحفظ.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="min-w-0">
          <form.AppField name="electronic">
            {(Fields) => (
              <Fields.InputField
                label="مدة تجهيز النسخة الإلكترونية (يوم)"
                props={{
                  type: "number",
                  min: 1,
                  max: 120,
                  disabled: fieldsDisabled,
                }}
              />
            )}
          </form.AppField>
        </div>
        <div className="min-w-0">
          <form.AppField name="printed">
            {(Fields) => (
              <Fields.InputField
                label="مدة تجهيز النسخة المطبوعة (يوم)"
                props={{
                  type: "number",
                  min: 1,
                  max: 120,
                  disabled: fieldsDisabled,
                }}
              />
            )}
          </form.AppField>
        </div>
        <ResourceFormFooter
          mode="create"
          saveLabel="حفظ المدة"
          showCancel={false}
          disabled={formDisabled}
          className="col-span-full"
        />
      </form>
    </form.AppForm>
  );
}
