import type { ReactNode } from "react";
import type { BaseRecord, HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import type { RowReordering } from "@/components/block/shuip/data-table";

import { useResourceContext } from "./resource-context";

export function ResourcePage<TRecord extends BaseRecord>({
  table,
  children,
  storageKey,
  rowReordering,
}: {
  title: string;
  description: string;
  table: UseTableReturnType<TRecord, HttpError>;
  children?: ReactNode;
  storageKey: string;
  rowReordering?: RowReordering<TRecord>;
}) {
  const { openCreate } = useResourceContext();
  return (
    <section className="flex flex-col gap-6">
      <DataTable
        table={table}
        rowReordering={rowReordering}
        viewsStorageKey={storageKey}
        toolbarVariant="inline-chips"
        paginationVariant="numbered"
        toolbarActions={
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" />
            إضافة جديد
          </Button>
        }
      />
      {children}
    </section>
  );
}
