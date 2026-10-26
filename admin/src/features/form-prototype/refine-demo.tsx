"use client";

import { useEffect, useRef, useState } from "react";
import {
  HttpError,
  Refine,
  useForm as useRefineForm,
  useList,
} from "@refinedev/core";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { arabicEgyptI18nProvider } from "@/lib/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPrototypeDataProvider,
  type ProviderEvent,
  type PrototypeProduct,
} from "./data-provider";
import { useAppForm } from "@/components/forms";

const productValuesSchema = z.object({
  title: z.string().trim().min(2, "اكتب حرفين على الأقل."),
  sku: z.string().trim().min(3, "اكتب ٣ أحرف على الأقل."),
  price: z.number().positive("السعر لازم يكون أكبر من صفر."),
  inventory: z.number().int().min(0, "المخزون لا يمكن أن يكون أقل من صفر."),
  status: z.enum(["draft", "active"]),
});

type ProductValues = z.infer<typeof productValuesSchema>;
type FormAction = "create" | "edit";
const operationLabels = {
  getOne: "تحميل السجل",
  create: "إنشاء سجل",
  update: "تحديث سجل",
} as const;

const createValues: ProductValues = {
  title: "وشاح قطني جديد",
  sku: "ACC-301",
  price: 28,
  inventory: 20,
  status: "draft",
};

function toFormValues(product: PrototypeProduct): ProductValues {
  return {
    title: product.title,
    sku: product.sku,
    price: product.price,
    inventory: product.inventory,
    status: product.status,
  };
}

function RefineProductForm({
  action,
  id,
  onCreated,
}: {
  action: FormAction;
  id: string;
  onCreated: (product: PrototypeProduct) => void;
}) {
  const inFlight = useRef(false);
  const hydratedId = useRef<string | undefined>(undefined);
  const [defaultValues, setDefaultValues] =
    useState<ProductValues>(createValues);
  const [saveMessage, setSaveMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const { onFinish, query, mutation } = useRefineForm<
    PrototypeProduct,
    HttpError,
    ProductValues,
    PrototypeProduct
  >({
    resource: "products",
    action,
    id: action === "edit" ? id : undefined,
    redirect: false,
    successNotification: false,
    errorNotification: false,
    queryOptions: { retry: false },
  });
  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: productValuesSchema,
      onSubmit: productValuesSchema,
    },
    onSubmit: async ({ value }) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaveMessage(null);
      try {
        const result = await onFinish(productValuesSchema.parse(value));
        const record = result?.data as PrototypeProduct | undefined;
        if (record) {
          const savedValues = toFormValues(record);
          setDefaultValues(savedValues);
          form.reset(savedValues);
          setSaveMessage({
            kind: "success",
            text: `${action === "create" ? "تم إنشاء" : "تم تحديث"} ${record.title}.`,
          });
          if (action === "create") onCreated(record);
        }
      } catch (error) {
        setSaveMessage({
          kind: "error",
          text: error instanceof Error ? error.message : "تعذّر الحفظ.",
        });
      } finally {
        inFlight.current = false;
      }
    },
  });
  const product = query?.data?.data;

  useEffect(() => {
    if (action !== "edit" || !product) return;
    if (hydratedId.current !== product.id || !form.state.isDirty) {
      const recordValues = toFormValues(product);
      setDefaultValues(recordValues);
      form.reset(recordValues);
      hydratedId.current = product.id;
    }
  }, [action, id, product]);

  const loadingRecord = action === "edit" && query?.isLoading;
  const isSubmitting = mutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">نموذج Refine</Badge>
          <Badge variant="secondary">
            {action === "create" ? "إنشاء" : `تعديل ${id}`}
          </Badge>
          {isSubmitting ? (
            <Badge>
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
              جارٍ الحفظ
            </Badge>
          ) : null}
        </div>
        <CardTitle>{action === "create" ? "إنشاء منتج" : "تعديل منتج"}</CardTitle>
        <CardDescription>
          يتولى Refine تحميل السجل وحفظه، بينما يدير النموذج الحقول والتحقق والتغييرات.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingRecord ? (
          <div
            className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircle className="animate-spin" />
            جارٍ تحميل المنتج من مصدر البيانات المحلي…
          </div>
        ) : null}
        {action === "edit" ? (
          <Button
            type="button"
            variant="outline"
            className="mb-5"
            disabled={query?.isFetching}
            onClick={() => void query?.refetch()}
          >
            <RefreshCw data-icon="inline-start" />
            تحديث بيانات المنتج
          </Button>
        ) : null}
        <form.AppForm>
          <form
            className="flex flex-col gap-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="grid gap-5 md:grid-cols-2">
              <form.AppField name="title">
                {(field) => (
                  <field.Input
                    label="اسم المنتج"
                    disabled={Boolean(loadingRecord) || isSubmitting}
                  />
                )}
              </form.AppField>
              <form.AppField name="sku">
                {(field) => (
                  <field.GroupedInput
                    label="كود المنتج"
                    prefix="SKU"
                    disabled={Boolean(loadingRecord) || isSubmitting}
                  />
                )}
              </form.AppField>
              <form.AppField name="price">
                {(field) => (
                  <field.Number
                    label="السعر"
                    min={0.01}
                    step={0.01}
                    disabled={Boolean(loadingRecord) || isSubmitting}
                  />
                )}
              </form.AppField>
              <form.AppField name="inventory">
                {(field) => (
                  <field.Number
                    label="المخزون"
                    min={0}
                    disabled={Boolean(loadingRecord) || isSubmitting}
                  />
                )}
              </form.AppField>
              <form.AppField name="status">
                {(field) => (
                  <field.Select
                    label="الحالة"
                    disabled={Boolean(loadingRecord) || isSubmitting}
                    options={[
                      { value: "draft", label: "مسودة" },
                      { value: "active", label: "نشط" },
                    ]}
                  />
                )}
              </form.AppField>
            </FieldGroup>
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                القيم الحالية للنموذج
              </summary>
              <form.Subscribe selector={(state: any) => state.values}>
                {(values: ProductValues) => (
                  <pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {JSON.stringify(values, null, 2)}
                  </pre>
                )}
              </form.Subscribe>
            </details>
            <form.FormErrorSummary />
            {saveMessage ? (
              <p
                className={
                  saveMessage.kind === "error"
                    ? "flex items-center gap-2 text-sm text-destructive"
                    : "flex items-center gap-2 text-sm text-muted-foreground"
                }
                role={saveMessage.kind === "error" ? "alert" : "status"}
              >
                {saveMessage.kind === "error" ? (
                  <AlertCircle />
                ) : (
                  <CheckCircle2 />
                )}
                {saveMessage.text}
              </p>
            ) : null}
            <form.FormActions>
              <form.SubmitButton>
                {action === "create" ? "إنشاء المنتج" : "حفظ المنتج"}
              </form.SubmitButton>
              <form.ResetButton />
              <form.UnsavedChangesIndicator />
            </form.FormActions>
          </form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

function ProviderActivity({ events }: { events: ProviderEvent[] }) {
  const latestRequest = events.find(
    (event) => event.operation === "create" || event.operation === "update"
  );
  const latestResult = latestRequest
    ? events.find(
        (event) =>
          event.operation === latestRequest.operation &&
          event.at === latestRequest.at &&
          (event.response !== undefined || event.error !== undefined)
      )
    : undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle>طلب واستجابة مصدر البيانات</CardTitle>
        <CardDescription>
          يتصل Refine بمصدر بيانات محلي في الذاكرة، ولا يوجد اتصال بخادم.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {latestRequest ? (
          <>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                العملية · {operationLabels[latestRequest.operation]} ({latestRequest.resource === "products" ? "المنتجات" : latestRequest.resource}
                {latestRequest.id ? `، المعرّف: ${latestRequest.id}` : ""})
              </p>
              <pre className="overflow-auto rounded-xl bg-muted p-4 text-xs">
                {JSON.stringify(latestRequest.variables ?? {}, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                الاستجابة
              </p>
              <pre className="overflow-auto rounded-xl bg-muted p-4 text-xs">
                {latestResult?.error ??
                  JSON.stringify(
                    latestResult?.response ?? { pending: true },
                    null,
                    2
                  )}
              </pre>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            أرسل نموذج الإنشاء أو التعديل لمراجعة العملية التي نُفذت.
          </p>
        )}
        <div className="border-t pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            أحدث عمليات مصدر البيانات
          </p>
          <div className="flex flex-col gap-2">
            {events.slice(0, 5).map((event, index) => (
              <div
                key={`${event.at}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span>
                  {operationLabels[event.operation]} · {event.id ?? "سجل جديد"}
                </span>
                <span
                  className={
                    event.error ? "text-destructive" : "text-muted-foreground"
                  }
                >
                  {event.error
                    ? "فشل"
                    : event.response
                      ? "اكتمل"
                      : "قيد التنفيذ"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RefineFormDemo() {
  const [events, setEvents] = useState<ProviderEvent[]>([]);
  const [action, setAction] = useState<FormAction>("create");
  const [selectedId, setSelectedId] = useState("demo-204");
  const [failureArmed, setFailureArmed] = useState(false);
  const failureRef = useRef(false);
  const [provider] = useState(() =>
    createPrototypeDataProvider({
      publish: (event) =>
        setEvents((current) => {
          const existingIndex = current.findIndex(
            (entry) =>
              entry.operation === event.operation && entry.at === event.at
          );
          if (existingIndex < 0) return [event, ...current].slice(0, 12);
          const updated = [...current];
          updated[existingIndex] = event;
          return updated;
        }),
      shouldFail: () => {
        if (!failureRef.current) return false;
        failureRef.current = false;
        setFailureArmed(false);
        return true;
      },
    })
  );

  return (
    <Refine
      resources={[{ name: "products" }]}
      dataProvider={provider}
      i18nProvider={arabicEgyptI18nProvider}
      options={{
        disableTelemetry: true,
        syncWithLocation: false,
        disableRouteChangeHandler: true,
      }}
    >
      <ProductDemoContent
        action={action}
        selectedId={selectedId}
        events={events}
        failureArmed={failureArmed}
        onActionChange={setAction}
        onSelectedIdChange={setSelectedId}
        onArmFailure={() => {
          failureRef.current = true;
          setFailureArmed(true);
        }}
      />
    </Refine>
  );
}

function ProductDemoContent({
  action,
  selectedId,
  events,
  failureArmed,
  onActionChange,
  onSelectedIdChange,
  onArmFailure,
}: {
  action: FormAction;
  selectedId: string;
  events: ProviderEvent[];
  failureArmed: boolean;
  onActionChange: (action: FormAction) => void;
  onSelectedIdChange: (id: string) => void;
  onArmFailure: () => void;
}) {
  const { result } = useList<PrototypeProduct>({
    resource: "products",
    pagination: { pageSize: 10 },
  });
  const products = result.data ?? [];
  const currentId = products.some((product) => product.id === selectedId)
    ? selectedId
    : (products[0]?.id ?? selectedId);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Refine · مصدر بيانات محلي</Badge>
          <Badge variant="secondary">بدون خادم</Badge>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          إنشاء المنتجات وتعديلها باستخدام Refine
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          يحدد Refine ما إذا كانت العملية إنشاءً أو تعديلًا، ويحمل بيانات المنتج. ثم يرسل القيم التي تم التحقق منها إلى مصدر البيانات المحلي.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>اختار إجراء النموذج</CardTitle>
          <CardDescription>
            يؤدي تغيير الإجراء أو السجل المحدد إلى بدء نموذج جديد.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={action === "create" ? "default" : "outline"}
              onClick={() => onActionChange("create")}
            >
              إنشاء
            </Button>
            <Button
              type="button"
              variant={action === "edit" ? "default" : "outline"}
              onClick={() => onActionChange("edit")}
            >
              تعديل منتج موجود
            </Button>
          </div>
          {action === "edit" ? (
            <div className="flex min-w-56 flex-col gap-2">
              <label
                className="text-sm font-medium"
                htmlFor="prototype-product-select"
              >
                سجل المنتج
              </label>
              <Select value={currentId} onValueChange={onSelectedIdChange}>
                <SelectTrigger id="prototype-product-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <Button
            type="button"
            variant={failureArmed ? "destructive" : "outline"}
            onClick={onArmFailure}
          >
            {failureArmed ? "عملية الحفظ التالية ستفشل" : "محاكاة فشل الحفظ التالي"}
          </Button>
        </CardContent>
      </Card>
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
        <RefineProductForm
          key={`${action}:${action === "edit" ? currentId : "new"}`}
          action={action}
          id={currentId}
          onCreated={(product) => onSelectedIdChange(product.id)}
        />
        <ProviderActivity events={events} />
      </div>
    </section>
  );
}
