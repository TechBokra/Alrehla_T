import { useRef, useState } from "react";
import { revalidateLogic, useStore } from "@tanstack/react-form";
import { useOne, useUpdate } from "@refinedev/core";
import { useNavigate } from "@tanstack/react-router";
import { useUploader, useUploadSelector } from "@uploadcn/react";
import type { CloudinaryUploadResult, UploadAdapter } from "@uploadcn/core";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { useAppForm } from "@/lib/form";
import { productPageSchema, preparationDaysSchema, type ProductImageSelection } from "./schema";
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
import type { ResourceFormPageContext } from "@/components/resources/forms/types";
import { resourcePageForms } from "@/components/resources/forms/page";
import { FormSection } from "@/components/forms";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLibraryUploadAdapter } from "@/features/uploads/use-upload-adapter";
import { ProductImagesField } from "./images-field";
import { useResourceAuthorization } from "@/hooks/resources";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";

const writingStyleOptions = [
  { value: "fusha", label: "فصحى" },
  { value: "simple", label: "عربية مبسطة" },
  { value: "dialect", label: "لهجة" },
] as const;

const { Footer: ResourceFormFooter, DirtyGuard: ResourceFormDirtyGuard } = resourcePageForms;

const unavailableUploadAdapter: UploadAdapter<CloudinaryUploadResult> = {
  name: "cloudinary-unconfigured",
  async upload() {
    throw new Error("إعداد Cloudinary غير مكتمل.");
  },
};

export function ProductForm({
  mode,
  record,
  disabled,
  save,
  getLastError,
}: ResourceFormPageContext<Product>) {
  const navigate = useNavigate();
  const access = useResourceAuthorization("uploads", "upload");
  const adapter = useLibraryUploadAdapter("alrehla/products");
  const uploader = useUploader<CloudinaryUploadResult>({
    adapter: adapter ?? unavailableUploadAdapter,
    autoUpload: false,
    accept: "image/jpeg,image/png,image/webp,image/avif",
    maxSize: 5 * 1024 * 1024,
    maxFiles: 9,
    retry: false,
  });
  const queuedItems = useUploadSelector(uploader, (state) => state.items);
  const failedUpload = queuedItems.some((item) => ["error", "rejected", "cancelled"].includes(item.status));
  const [defaults] = useState(() => record ? valuesFromProduct(record) : defaultValues());
  const form = useAppForm({
    defaultValues: defaults,
    // Start validation on submit. After an invalid submit, revalidate as the
    // user edits so errors and the footer recover without painting a fresh form.
    validationLogic: revalidateLogic({ mode: "submit", modeAfterSubmission: "change" }),
    validators: { onDynamic: productPageSchema },
    onSubmit: async ({ value }) => {
      const values = productPageSchema.parse(value);
      let imageUrls: string[];
      try {
        imageUrls = await resolveImageUrls(values.images, uploader);
      } catch {
        toast.error("تعذّر رفع إحدى الصور. أعد محاولة رفع الملف الفاشل ثم احفظ المنتج.");
        return;
      }
      const payload = mode === "edit"
        ? toUpdatePayload(values, imageUrls)
        : toCreatePayload(values, imageUrls);
      const saved = await save(payload as Record<string, unknown>);
      if (!saved) {
        toast.error(catalogError(getLastError()));
        return;
      }
      uploader.clearCompleted();
      form.reset(valuesFromProduct(saved));
      toast.success(mode === "edit" ? "تم حفظ التغييرات." : "تم حفظ المنتج.");
      if (mode === "create") {
        await navigate({
          to: "/catalog/products/$id/edit",
          params: { id: String(saved.id) },
          replace: true,
        });
      }
    },
  });
  const category = useStore(form.store, (state) => state.values.category);
  const values = useStore(form.store, (state) => state.values);
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const formDisabled = disabled || submitting;
  const hasQueuedImages = values.images.some((image) => image.kind === "queued");
  const saveDisabled = disabled || failedUpload || (hasQueuedImages && (!adapter || !access.allowed || access.isPending));
  const cancel = () => void navigate({ to: "/catalog/products" });

  return (
    <div className="flex flex-col gap-6">
      <form.AppForm>
        <ResourceFormDirtyGuard />
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!formDisabled && !saveDisabled) void form.handleSubmit();
          }}
          className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
        >
          <FormSection
            title="البيانات الأساسية"
            description="معلومات العرض والتصنيف الأساسية للمنتج."
            className="rounded-2xl border bg-card p-5 shadow-sm md:col-span-2 sm:p-6"
          >
            <form.AppField name="name">
              {(Fields) => <Fields.InputField label="اسم المنتج" required props={{ disabled: formDisabled }} />}
            </form.AppField>
            <form.AppField name="category">
              {(Fields) => <Fields.SelectField label="التصنيف" required options={{ "منتج المكتبة": "library", "قصة مخصصة": "custom" }} props={{ disabled: formDisabled }} />}
            </form.AppField>
            <Field className="justify-center rounded-lg border bg-muted/30 p-4">
              <FieldLabel>مالك المنتج</FieldLabel>
              <Badge variant="secondary" className="w-fit">المنصة</Badge>
              <FieldDescription>منتجات هذه الصفحة تابعة للمنصة.</FieldDescription>
            </Field>
            <form.AppField name="description">
              {(Fields) => <Fields.TextareaField label="الوصف المختصر" description="يظهر في بطاقة المنتج." props={{ disabled: formDisabled, maxLength: 600, rows: 3 }} />}
            </form.AppField>
          </FormSection>

          <FormSection
            title="الأسعار"
            description="السعر الورقي مطلوب، والسعر الإلكتروني اختياري للقصص المخصصة."
            className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
          >
            <form.AppField name="price">
              {(Fields) => <Fields.InputField label="السعر الورقي (ج.م)" required props={{ disabled: formDisabled, inputMode: "decimal" }} />}
            </form.AppField>
            {category === "custom" ? (
              <form.AppField name="electronicPrice">
                {(Fields) => <Fields.InputField label="السعر الإلكتروني (ج.م)" description="اتركه فارغًا إذا لم يكن للمنتج سعر إلكتروني." props={{ disabled: formDisabled, inputMode: "decimal" }} />}
              </form.AppField>
            ) : null}
          </FormSection>

          {category === "custom" ? (
            <FormSection title="خيارات القصة المخصصة" description="اختر أسلوب كتابة واحدًا على الأقل. حفظ الأساليب الثلاثة يعني استخدام كل الأساليب." className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
              <form.AppField name="writingStyles">
                {(field) => (
                  <BaseFormField label="أساليب الكتابة" required description="يحدد الأسلوب الذي يختاره العميل عند تخصيص القصة." variant="fieldset">
                    <div role="group" aria-label="أساليب الكتابة" className="flex flex-wrap gap-2">
                      {writingStyleOptions.map((option) => {
                        const selected = field.state.value.includes(option.value);
                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant={selected ? "secondary" : "outline"}
                            aria-pressed={selected}
                            disabled={formDisabled}
                            onClick={() => field.handleChange(selected ? field.state.value.filter((value) => value !== option.value) : [...field.state.value, option.value])}
                          >
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                  </BaseFormField>
                )}
              </form.AppField>
            </FormSection>
          ) : null}

          <FormSection
            title="الفئة العمرية"
            description="المدى اختياري. اترك الحقلين فارغين إذا لم يكن هناك تحديد للعمر."
            className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
          >
            <form.AppField name="minAge">
              {(Fields) => <Fields.InputField label="العمر من" props={{ type: "number", min: 0, max: 20, disabled: formDisabled }} />}
            </form.AppField>
            <form.AppField name="maxAge">
              {(Fields) => <Fields.InputField label="العمر إلى" props={{ type: "number", min: 0, max: 20, disabled: formDisabled }} />}
            </form.AppField>
          </FormSection>

          <FormSection title="المحتوى" description="الوصف الكامل يدعم Markdown، والميزات تُكتب كسطر مستقل لكل ميزة." className="rounded-2xl border bg-card p-5 shadow-sm md:col-span-2 xl:col-span-3 sm:p-6">
            <form.AppField name="longDescription">
              {(Fields) => <Fields.TextareaField label="الوصف الكامل" description="يمكنك استخدام Markdown للعناوين والروابط والقوائم." props={{ disabled: formDisabled, rows: 8, maxLength: 5000 }} />}
            </form.AppField>
            <form.AppField name="featuresText">
              {(Fields) => <Fields.TextareaField label="مميزات المنتج" description="اكتب كل ميزة في سطر منفصل." props={{ disabled: formDisabled, rows: 8, maxLength: 5000 }} />}
            </form.AppField>
          </FormSection>

          <FormSection title="الصور" description="ارفع صورًا جديدة أو اختر من مكتبة الصور. لا يبدأ الرفع إلا عند حفظ المنتج." className="rounded-2xl border bg-card p-5 shadow-sm md:col-span-2 xl:col-span-3 sm:p-6">
            <form.AppField name="images">
              {(field) => (
                <ProductImagesField
                  value={field.state.value as ProductImageSelection[]}
                  onChange={field.handleChange}
                  uploader={uploader}
                  disabled={formDisabled}
                  uploadConfigured={Boolean(adapter)}
                />
              )}
            </form.AppField>
            {hasQueuedImages && !adapter ? (
              <Alert variant="destructive">
                <AlertTitle>إعداد رفع الصور غير مكتمل</AlertTitle>
                <AlertDescription>أضف إعداد Cloudinary الموقّع قبل استخدام صور جديدة.</AlertDescription>
              </Alert>
            ) : null}
          </FormSection>

          {mode === "edit" ? (
            <FormSection title="العرض" description="حالة المنتج في واجهة المتجر." className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
              <form.AppField name="isActive">
                {(Fields) => <Fields.CheckboxField label="المنتج نشط" description="إيقاف المنتج يخفيه من الشراء الجديد، مع الاحتفاظ ببياناته." props={{ disabled: formDisabled }} />}
              </form.AppField>
            </FormSection>
          ) : null}

          <ResourceFormFooter
            mode={mode}
            disabled={saveDisabled}
            onCancel={mode === "edit" ? cancel : undefined}
            className="col-span-full"
          />
        </form>
      </form.AppForm>

      {mode === "edit" && record ? (
        <PreparationDaysSection record={record} disabled={disabled || submitting} />
      ) : null}
    </div>
  );
}

async function resolveImageUrls(
  images: ProductImageSelection[],
  uploader: ReturnType<typeof useUploader<CloudinaryUploadResult>>,
) {
  const queued = images.filter((image): image is Extract<ProductImageSelection, { kind: "queued" }> => image.kind === "queued");
  const ids = queued.map((image) => image.uploadId);
  const pending = ids.filter((id) => uploader.getItem(id)?.status !== "success");
  if (pending.length) {
    await new Promise<void>((resolve, reject) => {
      let unsubscribe = () => {};
      const inspect = () => {
        const current = pending.map((id) => uploader.getItem(id));
        if (current.some((item) => !item || ["error", "rejected", "cancelled"].includes(item.status))) {
          unsubscribe();
          reject(new Error("تعذّر رفع الصورة."));
        } else if (current.every((item) => item?.status === "success")) {
          unsubscribe();
          resolve();
        }
      };
      unsubscribe = uploader.subscribe(inspect);
      uploader.start(pending);
      inspect();
    });
  }
  return images.map((image) => {
    if (image.kind === "saved") return image.url;
    const result = uploader.getItem(image.uploadId)?.result;
    if (!result?.secure_url) throw new Error("لم يرجع رفع الصورة رابطًا صالحًا.");
    return result.secure_url;
  });
}

function PreparationDaysSection({ record, disabled }: { record: Product; disabled: boolean }) {
  const canEdit = isEditableProduct(record);
  const access = useResourceAuthorization("personalized_products", "edit", { id: record.id, record });
  const available = hasPreparationDaysColumns(record);
  const detail = useOne<Product>({
    resource: "personalized_products",
    id: record.id,
    errorNotification: false,
    queryOptions: { enabled: available, retry: false, refetchOnWindowFocus: false },
  });
  const mutation = useUpdate<Product>({
    successNotification: false,
    errorNotification: false,
    mutationOptions: { retry: false },
  });
  const inFlight = useRef(false);
  const row = record as ProductPreparationRow;
  const [defaults] = useState(() => ({
    electronic: row.delivery_days_electronic == null ? "" : String(row.delivery_days_electronic),
    printed: row.delivery_days_printed == null ? "" : String(row.delivery_days_printed),
  }));
  const form = useAppForm({
    defaultValues: defaults,
    validationLogic: revalidateLogic({ mode: "submit", modeAfterSubmission: "change" }),
    validators: { onDynamic: preparationDaysSchema },
    onSubmit: async ({ value }) => {
      if (inFlight.current || !available || !canEdit || !access.allowed) return;
      inFlight.current = true;
      try {
        const refreshed = await detail.query.refetch();
        if (refreshed.error) throw refreshed.error;
        const currentRecord = refreshed.data?.data;
        if (!currentRecord || !isEditableProduct(currentRecord)) {
          throw new Error("هذا المنتج غير متاح للتعديل.");
        }
        await assertResourceAccess("personalized_products", "edit", { id: record.id, record: currentRecord });
        const parsed = preparationDaysSchema.parse(value);
        const saved = await mutation.mutateAsync({
          resource: "personalized_products",
          id: record.id,
          values: {
            delivery_days_electronic: parsed.electronic ? Number(parsed.electronic) : null,
            delivery_days_printed: parsed.printed ? Number(parsed.printed) : null,
          },
        });
        const next = saved.data as ProductPreparationRow;
        form.reset({
          electronic: next.delivery_days_electronic == null ? "" : String(next.delivery_days_electronic),
          printed: next.delivery_days_printed == null ? "" : String(next.delivery_days_printed),
        });
        toast.success("تم حفظ مدة التجهيز.");
      } catch (error) {
        toast.error(catalogError(error));
      } finally {
        inFlight.current = false;
      }
    },
  });
  const formDisabled = disabled || mutation.mutation.isPending || !access.allowed || !available;
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
        className="flex flex-col gap-6 rounded-2xl border bg-card p-5 sm:p-6"
      >
        <FormSection title="مدة التجهيز" description="تُحفظ هذه المدد بشكل مستقل عن بقية بيانات المنتج." className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          {!available ? (
            <Alert>
              <AlertCircle />
              <AlertTitle>مدة التجهيز غير مفعّلة في هذه البيئة</AlertTitle>
              <AlertDescription>تحتاج قاعدة البيانات إلى ترقية أعمدة مدة التجهيز قبل حفظها. بقية بيانات المنتج متاحة للحفظ.</AlertDescription>
            </Alert>
          ) : null}
          <form.AppField name="electronic">
            {(Fields) => <Fields.InputField label="مدة تجهيز النسخة الإلكترونية (يوم)" description="من يوم إلى ١٢٠ يومًا أو اتركه فارغًا." props={{ type: "number", min: 1, max: 120, disabled: fieldsDisabled }} />}
          </form.AppField>
          <form.AppField name="printed">
            {(Fields) => <Fields.InputField label="مدة تجهيز النسخة المطبوعة (يوم)" description="من يوم إلى ١٢٠ يومًا أو اتركه فارغًا." props={{ type: "number", min: 1, max: 120, disabled: fieldsDisabled }} />}
          </form.AppField>
        </FormSection>
        <ResourceFormFooter mode="create" saveLabel="حفظ المدة" showCancel={false} disabled={formDisabled} />
      </form>
    </form.AppForm>
  );
}

