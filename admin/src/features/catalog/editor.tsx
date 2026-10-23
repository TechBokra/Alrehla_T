import { useRef, useState } from "react";
import {
  useCreate,
  useUpdate,
  useOne,
  useInvalidate,
  type BaseRecord,
  type HttpError,
} from "@refinedev/core";
import { useStore } from "@tanstack/react-form";
import type { z } from "zod";
import { toast } from "sonner";
import { useAppForm } from "@/components/forms";
import { FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResourceFormDialog,
  ResourceDialogCancel,
} from "@/components/resources/resource-form-dialog";
import type { ResourceEditorTarget } from "@/components/resources/resource-page";
import {
  createSubmissionGuard,
  editRecordState,
  refreshSavedResource,
} from "@/components/resources/lifecycle";
import {
  catalogError,
  defaultCatalogValues,
  type CatalogValues,
} from "./model";

export interface CatalogDefinition<TRecord extends BaseRecord> {
  resource: "personalized_products" | "addon_products";
  title: string;
  schema: z.ZodType<CatalogValues>;
  fromRecord: (row: TRecord) => CatalogValues;
  canEdit: (row: TRecord) => boolean;
  createPayload: (values: CatalogValues) => Record<string, unknown>;
  updatePayload: (values: CatalogValues) => Record<string, unknown>;
}

export function CatalogEditor<TRecord extends BaseRecord>({
  definition,
  target,
  onClose,
}: {
  definition: CatalogDefinition<TRecord>;
  target: ResourceEditorTarget;
  onClose: () => void;
}) {
  const editing = target.action === "edit";
  const loaded = useRef(false);
  const query = useOne<TRecord, HttpError>({
    resource: definition.resource,
    id: editing ? target.id : "",
    queryOptions: {
      enabled: editing,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: "always",
    },
  });
  const row = query.result;
  const title = `${editing ? "تعديل" : "إضافة"} ${definition.title}`;
  const state = editRecordState({
    loading: query.query.isPending || query.query.isFetching,
    error: query.query.error,
    record: row,
    canEdit: definition.canEdit,
  });
  if (editing) {
    if (!loaded.current && state === "loading")
      return (
        <ResourceFormDialog
          title={title}
          pending={false}
          dirty={false}
          onClose={onClose}
        >
          <div role="status" className="flex flex-col gap-3">
            <span>جارٍ تحميل السجل…</span>
            <Skeleton className="h-32 w-full" />
          </div>
        </ResourceFormDialog>
      );
    if (!loaded.current && state !== "ready") {
      const missing = state === "missing";
      const denied = state === "forbidden";
      return (
        <ResourceFormDialog
          title={title}
          pending={false}
          dirty={false}
          onClose={onClose}
        >
          <div role="alert" className="flex flex-col gap-3">
            <p>
              {denied
                ? "هذا السجل غير متاح للتعديل هنا."
                : missing
                  ? "السجل غير موجود أو غير متاح لحسابك."
                  : "تعذّر تحميل السجل. حاول مرة أخرى."}
            </p>
            {!denied && !missing && (
              <Button
                variant="outline"
                onClick={() => void query.query.refetch()}
              >
                إعادة المحاولة
              </Button>
            )}
          </div>
        </ResourceFormDialog>
      );
    }
    loaded.current = true;
  }
  return (
    <CatalogEditorForm
      definition={definition}
      target={target}
      row={row}
      title={title}
      onClose={onClose}
      verifyEdit={async () => {
        const result = await query.query.refetch();
        if (result.error) throw result.error;
        if (!result.data?.data || !definition.canEdit(result.data.data))
          throw { code: "42501" };
      }}
    />
  );
}

function CatalogEditorForm<TRecord extends BaseRecord>({
  definition,
  target,
  row,
  title,
  onClose,
  verifyEdit,
}: {
  definition: CatalogDefinition<TRecord>;
  target: ResourceEditorTarget;
  row?: TRecord;
  title: string;
  onClose: () => void;
  verifyEdit: () => Promise<void>;
}) {
  const create = useCreate<TRecord, HttpError, Record<string, unknown>>({
    mutationOptions: { retry: false },
  });
  const update = useUpdate<TRecord, HttpError, Record<string, unknown>>({
    mutationOptions: { retry: false },
  });
  const invalidate = useInvalidate();
  const [guard] = useState(createSubmissionGuard);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [defaults] = useState(() =>
    row ? definition.fromRecord(row) : defaultCatalogValues(),
  );
  const form = useAppForm({
    defaultValues: defaults,
    validators: { onChange: definition.schema, onSubmit: definition.schema },
    onSubmit: async ({ value }) => {
      if (!guard.begin()) return;
      setError(null);
      try {
        const values = definition.schema.parse(value);
        const common = {
          resource: definition.resource,
          successNotification: false as const,
          errorNotification: false as const,
          invalidates: [],
        };
        if (target.action === "edit") {
          if (!row || !definition.canEdit(row))
            throw new Error("Forbidden record");
          await verifyEdit();
          await update.mutateAsync({
            ...common,
            id: target.id,
            values: definition.updatePayload(values),
          });
        } else
          await create.mutateAsync({
            ...common,
            values: definition.createPayload(values),
          });
      } catch (failure) {
        setError(catalogError(failure));
        guard.failed();
        return;
      }
      setSaved(true);
      guard.completed();
      const refreshFailed = !(await refreshSavedResource(() =>
        invalidate({
          resource: definition.resource,
          invalidates:
            target.action === "edit"
              ? ["list", "many", "detail"]
              : ["list", "many"],
          ...(target.action === "edit" ? { id: target.id } : {}),
        }),
      ));
      toast.success("تم حفظ البيانات", {
        description: refreshFailed
          ? "تعذّر تحديث القائمة. أعد تحميلها لعرض آخر البيانات."
          : undefined,
      });
      onClose();
    },
  });
  const dirty = useStore(form.store, (state) => state.isDirty);
  const pending = useStore(form.store, (state) => state.isSubmitting);
  const category = useStore(form.store, (state) => state.values.category);
  const product = definition.resource === "personalized_products";
  return (
    <ResourceFormDialog
      title={title}
      pending={pending}
      dirty={!saved && dirty}
      onClose={onClose}
    >
      <form.AppForm>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          className="flex flex-col gap-5"
        >
          <form.FormErrorSummary />
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <FieldGroup>
            <form.AppField name="name">
              {(Fields) => <Fields.Input label="الاسم" disabled={pending} />}
            </form.AppField>
            <form.AppField name="description">
              {(Fields) => (
                <Fields.Textarea label="الوصف المختصر" disabled={pending} />
              )}
            </form.AppField>
            <form.AppField name="longDescription">
              {(Fields) => (
                <Fields.Textarea label="الوصف الكامل" disabled={pending} />
              )}
            </form.AppField>
            {product && (
              <form.AppField name="category">
                {(Fields) => (
                  <Fields.Select
                    label="التصنيف"
                    disabled={pending}
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
                    product
                      ? "السعر الورقي (ج.م)"
                      : "السعر الشامل للتخصيص (ج.م)"
                  }
                  inputMode="decimal"
                  disabled={pending}
                />
              )}
            </form.AppField>
            {product && category === "custom" && (
              <form.AppField name="electronicPrice">
                {(Fields) => (
                  <Fields.Input
                    label="السعر الإلكتروني (اختياري)"
                    inputMode="decimal"
                    disabled={pending}
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
                  disabled={pending}
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
                  disabled={pending}
                />
              )}
            </form.AppField>
            {target.action === "edit" && (
              <form.AppField name="isActive">
                {(Fields) => (
                  <Fields.Switch label="المنتج نشط" disabled={pending} />
                )}
              </form.AppField>
            )}
          </FieldGroup>
          <form.FormActions>
            <form.SubmitButton />
            <ResourceDialogCancel disabled={pending} />
          </form.FormActions>
        </form>
      </form.AppForm>
    </ResourceFormDialog>
  );
}
