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
    form,
    enableRowReordering = false,
    onReorder,
    refineCoreProps,
  } = props;
  const createAccess = useResourceAuthorization(resource, "create");
  const editAccess = useResourceAuthorization(resource, "edit");
  const deleteAccess = useResourceAuthorization(resource, "delete");
  const sortAccess = useResourceAuthorization(resource, "sort");
  const canSort = enableRowReordering && sortAccess.allowed;
  const canCreateResource = createAccess.allowed;
  const canEditRecord = useCallback((record: TRecord) =>
    editAccess.allowed && (form.canEdit?.(record) ?? true), [editAccess.allowed, form.canEdit]);
  const canDeleteRecord = useCallback((record: TRecord) =>
    deleteAccess.allowed && (form.canEdit?.(record) ?? true), [deleteAccess.allowed, form.canEdit]);
  const { table, reorder } = useResourceTable<TRecord>({
    resource,
    columns,
    searchField: props.searchField,
    searchFields: props.searchFields,
    searchDebounceMs: props.searchDebounceMs,
    initialState: props.initialState,
    enableRowReordering: canSort,
    onReorder,
    refineCoreProps,
  });
  const scope = useResourceScope({
    resource,
    rows: table.refineCore.tableQuery.data?.data ?? [],
    canCreate: canCreateResource,
    canEdit: canEditRecord,
    canDelete: canDeleteRecord,
    deleteConsequence: props.deleteConsequence,
    rowActions: props.rowActions,
  });
  return { table, reorder, scope, canCreate: canCreateResource, canSort };
}
