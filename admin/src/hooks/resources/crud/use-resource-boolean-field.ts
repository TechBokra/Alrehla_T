import { useRef, useState } from "react";
import { useDataProvider, useInvalidate, useResourceParams, useUpdate } from "@refinedev/core";
import { toast } from "sonner";
import { useResourceContext } from "../scope/use-resource-context";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";
import { updateResourceBooleanField } from "./boolean-field-update";

/** Each cell owns its Refine mutation; context supplies resource identity/rules. */
export function useResourceBooleanField(id: string, field: string) {
  const context = useResourceContext();
  const config = context.fieldUpdates;
  const record = context.getRecord(id);
  const resources = useResourceParams({ resource: context.resource });
  const providerName = config?.dataProviderName ?? resources.resource?.meta?.dataProviderName ?? "default";
  const providers = useDataProvider();
  const invalidate = useInvalidate();
  const guard = useRef({ pending: false });
  const [phase, setPhase] = useState<"idle" | "checking" | "refreshing">("idle");
  const mutation = useUpdate({
    mutationMode: "pessimistic", invalidates: [],
    successNotification: false, errorNotification: false,
    mutationOptions: { retry: false },
  });
  const allowed = Boolean(config?.fields.includes(field) && record &&
    typeof record[field] === "boolean" && context.canEditRow(id));
  const pending = phase !== "idle" || mutation.mutation.isPending;
  const formatError = config?.getErrorMessage ?? (() => "تعذّر حفظ الحالة. حاول مرة أخرى.");

  async function onCheckedChange(value: boolean) {
    if (!allowed || !record || !config || guard.current.pending) return;
    mutation.mutation.reset();
    setPhase("checking");
    let providerFailed = false;
    try {
      const result = await updateResourceBooleanField({
        id, field, value, record, allowedFields: config.fields,
        canEditRecord: config.canEditRecord,
      }, {
        authorize: async (row) => { await assertResourceAccess(context.resource, "edit", { id, record: row }); },
        read: async () => {
          try { return (await providers(providerName).getOne({ resource: context.resource, id, meta: config.meta })).data; }
          catch (error) { providerFailed = true; throw error; }
        },
        update: async (values) => {
          setPhase("idle");
          try {
            return (await mutation.mutateAsync({
              resource: context.resource, dataProviderName: providerName, id,
              values, meta: config.meta, invalidates: [],
            })).data;
          } catch (error) { providerFailed = true; throw error; }
        },
        invalidate: async () => {
          setPhase("refreshing");
          await invalidate({ resource: context.resource, dataProviderName: providerName, id, invalidates: ["list", "many", "detail"] });
        },
      }, guard.current);
      if (result && result.refreshFailed) toast.error("تم حفظ الحالة، لكن تعذّر تحديث البيانات. أعد تحميل الصفحة.");
      else if (result && result.changed) toast.success("تم حفظ الحالة.");
    } catch (error) {
      toast.error(!providerFailed && error instanceof Error ? error.message : formatError(error));
    } finally {
      setPhase("idle");
    }
  }

  return {
    recordLabel: String(record?.name ?? record?.title ?? id),
    checked: record?.[field] === true,
    disabled: !allowed || pending,
    pending,
    error: mutation.mutation.error ? formatError(mutation.mutation.error) : undefined,
    onCheckedChange,
  };
}
