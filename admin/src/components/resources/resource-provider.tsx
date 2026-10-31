import { type ReactNode } from "react";
import type { BaseRecord, HttpError } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { UseDataTableOptions } from "@/components/refine-ui/data-table/use-data-table";
import { ResourceAccessGate } from "./resource-access-gate";
import { useResourceAuthorization } from "@/hooks/resources/use-resource-authorization";
import { useResourceTable } from "@/hooks/resources/use-resource-table";
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
  searchFields?: string[];
  searchDebounceMs?: number;
  pageSizeOptions?: number[];
  initialState?: UseDataTableOptions<TRecord>["initialState"];
  toolbarContent?: (table: UseTableReturnType<TRecord, HttpError>) => ReactNode;
  children?: ReactNode;
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
  return (
    <ResourceAccessGate key={props.resource} resource={props.resource}>
      <ResourceContent {...props} />
    </ResourceAccessGate>
  );
}
function ResourceContent<TRecord extends ResourceRecord>({
  resource,
  title,
  description = "",
  columns: columnInput,
  form,
  searchField,
  searchFields,
  searchDebounceMs,
  pageSizeOptions,
  initialState,
  toolbarContent,
  children,
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
  const createAccess = useResourceAuthorization(resource, "create");
  const editAccess = useResourceAuthorization(resource, "edit");
  const deleteAccess = useResourceAuthorization(resource, "delete");
  const sortAccess = useResourceAuthorization(resource, "sort");
  const canSort = enableRowReordering && sortAccess.allowed;
  const canCreateResource = canCreate && createAccess.allowed;
  const canEditRecord = (record: TRecord) => editAccess.allowed && (form.canEdit?.(record) ?? true);
  const canDeleteRecord = (record: TRecord) => deleteAccess.allowed && canDelete(record);
  const { table, reorder } = useResourceTable<TRecord>({
    resource,
    columns: columnInput,
    searchField,
    searchFields,
    searchDebounceMs,
    initialState,
    enableRowReordering: canSort,
    onReorder,
    refineCoreProps: {
      ...refineCoreProps,
      pagination: { pageSize: 20, ...refineCoreProps?.pagination },
    },
  });
  return (
    <ResourceScopeProvider
      resource={resource}
      rows={table.refineCore.tableQuery.data?.data ?? []}
      canCreate={canCreateResource}
      canEdit={canEditRecord}
      canDelete={canDeleteRecord}
      deleteConsequence={deleteConsequence}
      rowActions={rowActions}
    >
      <ResourcePage
        title={title}
        description={description}
        table={table}
        pageSizeOptions={pageSizeOptions}
        toolbarContent={toolbarContent?.(table)}
        canCreate={canCreateResource}
        storageKey={storageKey}
        rowReordering={
          canSort ? { getRowLabel, onReorder: reorder } : undefined
        }
      >
        <ResourceDialogs>
          <ResourceEditor form={form} />
        </ResourceDialogs>
        {children}
      </ResourcePage>
    </ResourceScopeProvider>
  );
}
