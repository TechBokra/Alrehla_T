import { useMemo } from "react";
import type { CrudFilter } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ResourcePage,
  useResourceEditor,
} from "@/components/resources/resource-page";
import { useDataTable } from "@/components/refine-ui/data-table/use-data-table";
import { CatalogEditor, type CatalogDefinition } from "./editor";
import type { CatalogRow } from "./columns";

export function CatalogResource<TRecord extends CatalogRow>({
  definition,
  title,
  description,
  columns: createColumns,
  filters,
}: {
  definition: CatalogDefinition<TRecord>;
  title: string;
  description: string;
  columns: (edit: (id: string) => void) => ColumnDef<TRecord, unknown>[];
  filters?: CrudFilter[];
}) {
  const editor = useResourceEditor();
  const columns = useMemo(
    () => createColumns(editor.openEdit),
    [createColumns, editor.openEdit],
  );
  const table = useDataTable<TRecord>({
    columns,
    searchField: "name",
    refineCoreProps: {
      resource: definition.resource,
      pagination: { pageSize: 20 },
      filters: { permanent: filters },
      sorters: {
        initial: [
          { field: "sort_order", order: "asc" },
          { field: "id", order: "asc" },
        ],
      },
    },
  });
  return (
    <ResourcePage
      title={title}
      description={description}
      table={table}
      onCreate={editor.openCreate}
      storageKey={`live-${definition.resource}`}
      editor={
        editor.target ? (
          <CatalogEditor
            key={editor.target.key}
            definition={definition}
            target={editor.target}
            onClose={editor.close}
          />
        ) : null
      }
    />
  );
}
