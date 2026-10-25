import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ResourcePage } from "@/components/resources/resource-page";
import {
  useDataTable,
  type UseDataTableOptions,
} from "@/components/refine-ui/data-table/use-data-table";
import {
  CatalogEditor,
  type CatalogDefinition,
  type CatalogResourceName,
} from "./editor";
import type { CatalogRow } from "./columns";
import { ResourceProvider } from "@/components/resources/resource-context";
import { ResourceDialogs } from "@/components/resources/resource-dialogs";
import type { ResourceRowAction } from "@/components/resources/resource-row-actions";

export function CatalogResource<TRecord extends CatalogRow>({
  resource,
  definition,
  title,
  description,
  columns: createColumns,
  searchField = "name",
  refineCoreProps,
  deleteConsequence,
  rowActions,
}: {
  resource: CatalogResourceName;
  definition: CatalogDefinition<TRecord>;
  title: string;
  description: string;
  columns: () => ColumnDef<TRecord, unknown>[];
  deleteConsequence?: string;
  rowActions?: ResourceRowAction[];
  searchField?: string;
  refineCoreProps?: Omit<
    NonNullable<UseDataTableOptions<TRecord>["refineCoreProps"]>,
    "resource"
  >;
}) {
  const [draft, setDraft] = useState<{
    source: TRecord[];
    ids: string[];
  } | null>(null);
  const mapDisplayRows = useCallback(
    (rows: TRecord[]) => {
      if (!draft || draft.source !== rows) return rows;
      const byId = new Map(rows.map((row) => [row.id, row]));
      return draft.ids.map((id) => byId.get(id)!);
    },
    [draft],
  );
  const columns = useMemo(createColumns, [createColumns]);
  const table = useDataTable<TRecord>({
    columns,
    searchField,
    mapDisplayRows,
    refineCoreProps: {
      ...refineCoreProps,
      resource,
      pagination: { pageSize: 20, ...refineCoreProps?.pagination },
      sorters: refineCoreProps?.sorters ?? {
        initial: [
          { field: "sort_order", order: "asc" },
          { field: "id", order: "asc" },
        ],
      },
    },
  });
  return (
    <ResourceProvider
      key={resource}
      resource={resource}
      rows={table.refineCore.tableQuery.data?.data ?? []}
      canDelete={definition.canEdit}
      deleteConsequence={deleteConsequence}
      rowActions={rowActions}
    >
      <ResourcePage
        title={title}
        description={description}
        table={table}
        rowReordering={{
          getRowLabel: (row) => row.name,
          onReorder: (ids) => {
            const source = table.refineCore.tableQuery.data?.data;
            if (
              !source ||
              ids.length !== source.length ||
              new Set(ids).size !== source.length ||
              ids.some((id) => !source.some((row) => row.id === id))
            )
              return;
            setDraft({ source, ids });
          },
        }}
        storageKey={`live-${resource}`}
      >
        <ResourceDialogs>
          <CatalogEditor definition={definition} />
        </ResourceDialogs>
      </ResourcePage>
    </ResourceProvider>
  );
}
