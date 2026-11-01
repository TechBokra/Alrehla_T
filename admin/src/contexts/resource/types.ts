import type { BaseRecord } from "@refinedev/core";
import type { ResourceRowAction } from "@/components/resources/types";

export type ResourceEditorTarget =
  | { action: "create"; key: number }
  | { action: "edit"; id: string; key: number };
export type ResourceActionTarget =
  | ResourceEditorTarget
  | { action: "delete"; id: string; key: number };

export interface ResourceContextValue {
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
