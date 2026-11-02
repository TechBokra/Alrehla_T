import type { ReactNode } from "react";
import type { BaseRecord, HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/refine-ui/buttons/create";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import type { RowReordering } from "@/components/block/shuip/data-table";
import type { ResourceFormMode } from "../types";

import { useResourceContext } from "@/hooks/resources";

export function ResourcePage<TRecord extends BaseRecord>({
  resource,
  title,
  description,
  formMode,
  canCreate = true,
  createAction,
  pageSizeOptions,
  toolbarContent,
  table,
  children,
  storageKey,
  rowReordering,
}: {
  resource: string;
  title: string;
  description?: ReactNode;
  formMode: ResourceFormMode;
  canCreate?: boolean;
  createAction?: ReactNode;
  pageSizeOptions?: number[];
  toolbarContent?: ReactNode;
  table: UseTableReturnType<TRecord, HttpError>;
  children?: ReactNode;
  storageKey: string;
  rowReordering?: RowReordering<TRecord>;
}) {
  const { openCreate } = useResourceContext();
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          typeof description === "string" ? (
            <div className="space-y-2 text-muted-foreground text-sm leading-relaxed">
              {description.split(/\n\s*\n/).map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line">
                  {paragraph.trim()}
                </p>
              ))}
            </div>
          ) : (
            description
          )
        )}
      </header>
      <DataTable
        table={table}
        pageSizeOptions={pageSizeOptions}
        rowReordering={rowReordering}
        viewsStorageKey={storageKey}
        toolbarVariant="inline-chips"
        paginationVariant="numbered"
        toolbarActions={
          canCreate ? (
            <div className="flex flex-wrap items-center gap-2">
              {toolbarContent}
              {createAction ??
                (formMode === "page" ? (
                  <CreateButton resource={resource}>
                    <Plus data-icon="inline-start" />
                    إضافة جديد
                  </CreateButton>
                ) : (
                  <Button onClick={openCreate}>
                    <Plus data-icon="inline-start" />
                    إضافة جديد
                  </Button>
                ))}
            </div>
          ) : null
        }
      />
      {children}
    </section>
  );
}
