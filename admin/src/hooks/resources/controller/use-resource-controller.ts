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
  const canEditRecord = useCallback((record: TRecord) =>
    editAccess.allowed && (canEdit?.(record) ?? true), [editAccess.allowed, canEdit]);
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
  return { table, reorder, reorderSaving, scope, canCreate: canCreateResource, canSort };
}
