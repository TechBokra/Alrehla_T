import { useCallback, useMemo, useState } from "react";
import type { BaseRecord } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useDataTable,
  type UseDataTableOptions,
} from "@/components/refine-ui/data-table/use-data-table";
import { ResourceScopeProvider } from "./resource-context";
import { ResourcePage } from "./resource-page";
import { ResourceDialogs } from "./resource-dialogs";
import { ResourceEditor, type ResourceFormDefinition } from "./resource-editor";
import type { ResourceRowAction } from "./resource-row-actions";

type ResourceRecord = BaseRecord & { id: string | number };
export interface ResourceProviderProps<TRecord extends ResourceRecord> {
  resource: string;
  title: string;
  description?: string;
  columns:
    ColumnDef<TRecord, unknown>[] | (() => ColumnDef<TRecord, unknown>[]);
  form: ResourceFormDefinition<TRecord>;
  searchField?: string;
  refineCoreProps?: Omit<
    NonNullable<UseDataTableOptions<TRecord>["refineCoreProps"]>,
    "resource"
  >;
  canCreate?: boolean;
  canDelete?: (record: TRecord) => boolean;
  deleteConsequence?: string;
  rowActions?: ResourceRowAction[];
  storageKey?: string;
  enableRowReordering?: boolean;
  getRowLabel?: (row: TRecord) => string;
  /** UI callback only. The provider never persists dragged positions. */
  onReorder?: (orderedIds: string[], orderedRows: TRecord[]) => void;
}

/** Complete resource page; feature callers supply fields, columns and options. */
export function ResourceProvider<TRecord extends ResourceRecord>(
  props: ResourceProviderProps<TRecord>,
) {
  return <ResourceContent key={props.resource} {...props} />;
}
function ResourceContent<TRecord extends ResourceRecord>({
  resource,
  title,
  description = "",
  columns: columnInput,
  form,
  searchField,
  refineCoreProps,
  canCreate = true,
  canDelete = form.canEdit ?? (() => true),
  deleteConsequence,
  rowActions,
  storageKey = `live-${resource}`,
  enableRowReordering = false,
  getRowLabel = (row) => String(row.name ?? row.id),
  onReorder,
}: ResourceProviderProps<TRecord>) {
  const [draft, setDraft] = useState<{
    source: TRecord[];
    ids: string[];
  } | null>(null);
  const mapDisplayRows = useCallback(
    (rows: TRecord[]) => {
      if (!enableRowReordering || !draft || draft.source !== rows) return rows;
      const byId = new Map(rows.map((row) => [String(row.id), row]));
      return draft.ids.map((id) => byId.get(id)!);
    },
    [draft, enableRowReordering],
  );
  const columns = useMemo(
    () => (typeof columnInput === "function" ? columnInput() : columnInput),
    [columnInput],
  );
  const table = useDataTable<TRecord>({
    columns,
    searchField,
    mapDisplayRows,
    refineCoreProps: {
      ...refineCoreProps,
      resource,
      pagination: { pageSize: 20, ...refineCoreProps?.pagination },
    },
  });
  const reorder = (ids: string[]) => {
    const source = table.refineCore.tableQuery.data?.data;
    if (
      !enableRowReordering ||
      !source ||
      ids.length !== source.length ||
      new Set(ids).size !== source.length
    )
      return;
    const byId = new Map(source.map((row) => [String(row.id), row]));
    if (ids.some((id) => !byId.has(id))) return;
    setDraft({ source, ids: [...ids] });
    onReorder?.(
      [...ids],
      ids.map((id) => byId.get(id)!),
    );
  };
  return (
    <ResourceScopeProvider
      resource={resource}
      rows={table.refineCore.tableQuery.data?.data ?? []}
      canDelete={canDelete}
      deleteConsequence={deleteConsequence}
      rowActions={rowActions}
    >
      <ResourcePage
        title={title}
        description={description}
        table={table}
        canCreate={canCreate}
        storageKey={storageKey}
        rowReordering={
          enableRowReordering ? { getRowLabel, onReorder: reorder } : undefined
        }
      >
        <ResourceDialogs>
          <ResourceEditor form={form} />
        </ResourceDialogs>
      </ResourcePage>
    </ResourceScopeProvider>
  );
}
