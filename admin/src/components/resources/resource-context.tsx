import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BaseRecord } from "@refinedev/core";
import type { ResourceRowAction } from "./resource-row-actions";

export type ResourceEditorTarget =
  | { action: "create"; key: number }
  | { action: "edit"; id: string; key: number };
export type ResourceActionTarget =
  ResourceEditorTarget | { action: "delete"; id: string; key: number };
interface ResourceContextValue {
  resource: string;
  target: ResourceActionTarget | null;
  rowId?: string;
  selectedRow?: BaseRecord;
  canDeleteSelected: boolean;
  getRecord: (id: string) => BaseRecord | undefined;
  canEditRow: (id: string) => boolean;
  canDeleteRow: (id: string) => boolean;
  deleteConsequence?: string;
  rowActions?: ResourceRowAction[];
  openCreate: () => void;
  openEdit: (id: string) => void;
  openDelete: (id: string) => void;
  close: () => void;
}
export const ResourceContext = createContext<ResourceContextValue | null>(null);
export function useResourceContext() {
  const context = useContext(ResourceContext);
  if (!context)
    throw new Error("Resource components must be inside ResourceProvider.");
  return context;
}

/** Each resource page owns its selection; nested pages cannot share dialog state. */
export function ResourceScopeProvider<
  TRecord extends BaseRecord & { id: string | number },
>({
  resource,
  rows,
  canCreate,
  canEdit,
  canDelete,
  deleteConsequence,
  rowActions,
  children,
}: {
  resource: string;
  rows: TRecord[];
  canCreate: boolean;
  canEdit: (record: TRecord) => boolean;
  canDelete: (record: TRecord) => boolean;
  deleteConsequence?: string;
  rowActions?: ResourceRowAction[];
  children: ReactNode;
}) {
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
  const value = useMemo(
    () => ({
      resource,
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
    }),
    [
      resource,
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
    ],
  );
  return (
    <ResourceContext.Provider value={value}>
      {children}
    </ResourceContext.Provider>
  );
}
