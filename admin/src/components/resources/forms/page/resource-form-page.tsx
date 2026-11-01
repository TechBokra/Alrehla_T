import type { BaseRecord } from "@refinedev/core";
import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useResourceFormCrud } from "@/hooks/resources";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ResourceFormPageContext } from "../types";

export type { ResourceFormPageContext } from "../types";

export function ResourceFormPage<TRecord extends BaseRecord>({
  resource,
  id,
  title,
  description,
  dataProviderName,
  canEdit,
  getErrorMessage,
  children,
}: {
  resource: string;
  id?: string;
  title: string;
  description?: string;
  dataProviderName?: string;
  canEdit?: (record: TRecord) => boolean;
  getErrorMessage?: (error: unknown) => string;
  children: (context: ResourceFormPageContext<TRecord>) => ReactNode;
}) {
  const crud = useResourceFormCrud<TRecord>({
    resource,
    id,
    dataProviderName,
    canEdit,
    getErrorMessage,
    suppressNotifications: true,
  });
  const mode = id === undefined ? "create" : "edit";

  return (
    <section className="flex flex-col gap-6" aria-busy={crud.busy}>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </header>
      {crud.initialLoading ? (
        <div role="status" className="flex flex-col gap-4">
          <span>جارٍ تحميل {title}…</span>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : crud.initialError ? (
        <Alert variant={crud.state === "failed" ? "destructive" : "default"}>
          <AlertTitle>
            {crud.state === "forbidden"
              ? "لا تملك صلاحية الوصول إلى هذا المورد"
              : crud.state === "missing"
                ? "السجل غير متاح"
                : "تعذّر تحميل البيانات"}
          </AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-3">
            <p>
              {crud.error ??
                (crud.state === "forbidden"
                  ? "هذا السجل غير متاح لهذا الإجراء أو لا تملك صلاحية الوصول إليه."
                  : crud.state === "missing"
                    ? "قد يكون السجل غير موجود أو غير متاح لحسابك."
                    : "تحقق من الاتصال ثم حاول تحميل السجل مرة أخرى.")}
            </p>
            {crud.canRetry ? (
              <Button
                variant="outline"
                disabled={crud.busy}
                onClick={() => void crud.retryLoad()}
              >
                {crud.busy ? <LoaderCircle className="animate-spin" /> : null}
                إعادة المحاولة
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : crud.unavailable ? (
        <Alert>
          <AlertTitle>المنتج غير متاح للتعديل</AlertTitle>
          <AlertDescription>
            لا يمكن تعديل هذا السجل من صفحة منتجات المنصة.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {children({
            record: crud.record,
            mode,
            disabled: crud.busy || crud.unavailable,
            pending: crud.pending,
            save: crud.save,
            getLastError: crud.getLastError,
          })}
        </>
      )}
    </section>
  );
}
