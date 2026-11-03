import { useEffect, useRef, useState } from "react";
import { useDataProvider, useInvalidate, useResourceParams, useUpdate, type BaseRecord, type CrudFilters, type MetaQuery } from "@refinedev/core";
import { toast } from "sonner";
import { DEFAULT_DEBOUNCE_MS } from "@/lib/const";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";
import { createDropDebouncer, persistResourceReorder, readResourceOrder } from "./reorder";

type ResourceRecord = BaseRecord & { id: string | number };

export function useResourceReorder<TRecord extends ResourceRecord>({
  resource, field, source, scopeKey, dataProviderName, filters, meta, canReorderRow, onSettled,
}: {
  resource: string;
  field?: string;
  source?: TRecord[];
  scopeKey: string;
  dataProviderName?: string;
  filters?: CrudFilters;
  meta?: MetaQuery;
  canReorderRow?: (record: TRecord) => boolean;
  onSettled: () => void;
}) {
  const providers = useDataProvider();
  const resourceParams = useResourceParams({ resource });
  const providerName = dataProviderName ?? resourceParams.resource?.meta?.dataProviderName ?? "default";
  const invalidate = useInvalidate();
  const mutation = useUpdate<TRecord>({
    mutationMode: "pessimistic", invalidates: [],
    successNotification: false, errorNotification: false,
    mutationOptions: { retry: false },
  });
  const [scheduler] = useState(() => createDropDebouncer(DEFAULT_DEBOUNCE_MS));
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  // A navigation/filter refresh before the delay expires discards that drop.
  useEffect(() => () => scheduler.cancel(), [scheduler, source, scopeKey, resource, field, providerName]);

  function schedule(rows: TRecord[], ids: string[]) {
    if (!field || lock.current) return;
    scheduler.schedule(() => {
      lock.current = true;
      setSaving(true);
      const message = toast.loading("جارٍ حفظ الترتيب…");
      void persistResourceReorder(rows, ids, field!, {
        authorize: async (record) => { await assertResourceAccess(resource, "sort", record ? { id: record.id, record } : undefined); },
        read: () => readResourceOrder<TRecord>((currentPage, pageSize) =>
          providers(providerName).getList<TRecord>({
              resource, filters, meta,
              pagination: { currentPage, pageSize, mode: "server" },
              sorters: [{ field: field!, order: "asc" }, { field: "id", order: "asc" }],
          })),
        update: async (record, position) => {
          await mutation.mutateAsync({ resource, dataProviderName: providerName, id: record.id, values: { [field!]: position }, meta, invalidates: [] });
        },
        invalidate: async () => { await invalidate({ resource, dataProviderName: providerName, invalidates: ["resourceAll"] }); },
        canReorderRow,
      }).then(({ updated, refreshFailed }) => {
        if (refreshFailed) toast.error("تم حفظ الترتيب، لكن تعذّر تحديث الجدول. أعد تحميل الصفحة.", { id: message });
        else if (updated) toast.success("تم حفظ الترتيب.", { id: message });
        else toast.dismiss(message);
      }).catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "تعذّر حفظ الترتيب.", { id: message });
      }).finally(() => {
        lock.current = false;
        setSaving(false);
        onSettled();
      });
    });
  }
  return { schedule, cancel: scheduler.cancel, saving };
}
