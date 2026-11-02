import { useCallback, useMemo, useRef, useState } from "react";
import type { BaseRecord } from "@refinedev/core";
import type { ResourceContextValue, ResourceActionTarget } from "@/contexts/resource/types";
import type { ResourceRowAction } from "@/components/resources/types";

export function useResourceScope<TRecord extends BaseRecord & { id: string | number }>({
  resource,
  formMode,
  rows,
  canCreate,
  canEdit,
  canDelete,
  deleteConsequence,
  rowActions,
}: {
  resource: string;
  formMode: ResourceContextValue["formMode"];
  rows: TRecord[];
  canCreate: boolean;
  canEdit: (record: TRecord) => boolean;
  canDelete: (record: TRecord) => boolean;
  deleteConsequence?: string;
  rowActions?: ResourceRowAction[];
}): ResourceContextValue {
  const [target, setTarget] = useState<ResourceActionTarget | null>(null);
  const sequence = useRef(0);
  const getRecord = useCallback((id: string) => rows.find((row) => String(row.id) === id), [rows]);
  const canEditRow = useCallback((id: string) => {
    const record = getRecord(id);
    return Boolean(record && canEdit(record));
  }, [getRecord, canEdit]);
  const canDeleteRow = useCallback((id: string) => {
    const record = getRecord(id);
    return Boolean(record && canDelete(record));
  }, [getRecord, canDelete]);
  const openCreate = useCallback(() => {
    if (canCreate) setTarget({ action: "create", key: ++sequence.current });
  }, [canCreate]);
  const openEdit = useCallback((id: string) => {
    if (canEditRow(id)) setTarget({ action: "edit", id, key: ++sequence.current });
  }, [canEditRow]);
  const openDelete = useCallback((id: string) => {
    if (canDeleteRow(id)) setTarget({ action: "delete", id, key: ++sequence.current });
  }, [canDeleteRow]);
  const close = useCallback(() => setTarget(null), []);
  const rowId = target && "id" in target ? target.id : undefined;
  const selectedRow = rows.find((row) => String(row.id) === rowId);
  const canDeleteSelected = Boolean(selectedRow && canDelete(selectedRow));

  return useMemo(() => ({
    resource,
    formMode,
    target,
    rowId,
    selectedRow,
    canDeleteSelected,
    getRecord,
    canEditRow,
    canDeleteRow,
    deleteConsequence,
    rowActions,
    openCreate,
    openEdit,
    openDelete,
    close,
  }), [resource, formMode, target, rowId, selectedRow, canDeleteSelected, getRecord,
    canEditRow, canDeleteRow, deleteConsequence, rowActions, openCreate,
    openEdit, openDelete, close]);
}
