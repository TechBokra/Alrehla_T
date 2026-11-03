import { useCallback } from "react";
import { useResourceAuthorization } from "../authorization";
import { useResourceTable } from "../table";
import { useResourceScope } from "../scope";
import type { ResourceViewProps } from "@/components/resources/types";
import type { BaseRecord } from "@refinedev/core";

type ResourceRecord = BaseRecord & { id: string | number };

/** Prepare all authorized table and page state after list access has passed. */
export function useResourceController<TRecord extends ResourceRecord>(
  props: ResourceViewProps<TRecord>,
) {
  const {
    resource,
    columns,
    mode,
    canEdit,
    enableRowReordering = false,
    canReorderRow,
    orderField,
    onReorder,
    refineCoreProps,
  } = props;
  const createAccess = useResourceAuthorization(resource, "create");
  const editAccess = useResourceAuthorization(resource, "edit");
  const deleteAccess = useResourceAuthorization(resource, "delete");
  const sortAccess = useResourceAuthorization(resource, "sort");
  const reorderAllowed = (enableRowReordering || Boolean(orderField)) && sortAccess.allowed;
  const canCreateResource = createAccess.allowed;
  const editRecordRule = canEdit ?? (mode === "page" ? props.form.page?.canEdit : props.form.dialog?.canEdit);
  const canEditRecord = useCallback((record: TRecord) =>
    editAccess.allowed && (editRecordRule?.(record) ?? true), [editAccess.allowed, editRecordRule]);
  const canDeleteRecord = useCallback((record: TRecord) =>
    deleteAccess.allowed && (canEdit?.(record) ?? true), [deleteAccess.allowed, canEdit]);
  const { table, reorder, reorderSaving } = useResourceTable<TRecord>({
    resource,
    columns,
    searchField: props.searchField,
    searchFields: props.searchFields,
    searchDebounceMs: props.searchDebounceMs,
    initialState: props.initialState,
    enableRowReordering: reorderAllowed,
    canReorderRow,
    orderField,
    onReorder,
    refineCoreProps,
  });
  const canSort = reorderAllowed && (!orderField ||
    (table.refineCore.sorters[0]?.field === orderField && table.refineCore.sorters[0]?.order === "asc"));
  const scope = useResourceScope({
    resource,
    formMode: mode,
    rows: table.refineCore.tableQuery.data?.data ?? [],
    canCreate: canCreateResource,
    canEdit: canEditRecord,
    canDelete: canDeleteRecord,
    deleteConsequence: props.deleteConsequence,
    rowActions: props.rowActions,
  });
  return {
    table, reorder, reorderSaving,
    scope: {
      ...scope,
      fieldUpdates: {
        fields: table.reactTable.getAllLeafColumns().flatMap((column) =>
          column.columnDef.meta?.resourceBooleanField ? [column.columnDef.meta.resourceBooleanField] : []),
        dataProviderName: refineCoreProps?.dataProviderName,
        meta: refineCoreProps?.meta,
        canEditRecord: (record: BaseRecord) => canEditRecord(record as TRecord),
        getErrorMessage: mode === "page" ? props.form.page?.getErrorMessage : props.form.dialog?.getErrorMessage,
      },
    },
    canCreate: canCreateResource, canSort,
  };
}
