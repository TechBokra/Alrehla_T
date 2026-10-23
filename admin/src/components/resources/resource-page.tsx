import { useCallback, useRef, useState, type ReactNode } from "react";
import type { BaseRecord, HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/refine-ui/data-table/data-table";

export type ResourceEditorTarget =
  | { action: "create"; key: number }
  | { action: "edit"; id: string; key: number };
export function useResourceEditor() {
  const [target, setTarget] = useState<ResourceEditorTarget | null>(null);
  const sequence = useRef(0);
  const open = useCallback((id?: string) => {
    const key = ++sequence.current;
    setTarget(id ? { action: "edit", id, key } : { action: "create", key });
  }, []);
  const openCreate = useCallback(() => open(), [open]);
  const close = useCallback(() => setTarget(null), []);
  return { target, openCreate, openEdit: open, close };
}
export function ResourcePage<TRecord extends BaseRecord>({
  table,
  onCreate,
  editor,
  storageKey,
}: {
  title: string;
  description: string;
  table: UseTableReturnType<TRecord, HttpError>;
  onCreate: () => void;
  editor: ReactNode;
  storageKey: string;
}) {
  return (
    <section className="flex flex-col gap-6">
      <DataTable
        table={table}
        viewsStorageKey={storageKey}
        toolbarVariant="inline-chips"
        paginationVariant="numbered"
        toolbarActions={
          <Button onClick={onCreate}>
            <Plus data-icon="inline-start" />
            إضافة جديد
          </Button>
        }
      />
      {editor}
    </section>
  );
}
