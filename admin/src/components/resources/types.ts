import type { ReactNode, ComponentType } from "react";
import type { BaseRecord, HttpError } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { UseDataTableOptions } from "@/components/refine-ui/data-table/use-data-table";
import type { RowReordering } from "@/components/block/shuip/data-table";

export interface ResourceRowAction {
  key: string;
  authorizationAction: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: (id: string) => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}

export interface ResourceFormFieldsContext<TRecord> {
  record?: TRecord;
  formId: string;
  disabled: boolean;
  onFormValidityChange: (isValid: boolean) => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  resource: string;
  action: "create" | "edit";
}

export interface ResourceFormDefinition<TRecord extends BaseRecord> {
  title: string;
  dataProviderName?: string;
  canEdit?: (record: TRecord) => boolean;
  /** Maps save/backend failures to user-facing copy; form field validation stays in the form. */
  getErrorMessage?: (error: unknown) => string;
  onSaved?: (record: TRecord, action: "create" | "edit") => void;
  fields: (context: ResourceFormFieldsContext<TRecord>) => ReactNode;
}

type ResourceRecord = BaseRecord & { id: string | number };
export interface ResourceViewProps<TRecord extends ResourceRecord> {
  resource: string;
  title: string;
  description?: string;
  columns: ColumnDef<TRecord, unknown>[] | (() => ColumnDef<TRecord, unknown>[]);
  form: ResourceFormDefinition<TRecord>;
  searchField?: string;
  searchFields?: string[];
  /** Defaults to DEFAULT_SEARCH_DEBOUNCE_MS (300 ms). */
  searchDebounceMs?: number;
  /** Page-size choices shown by the table; the default request size is 20. */
  pageSizeOptions?: number[];
  initialState?: UseDataTableOptions<TRecord>["initialState"];
  toolbarContent?: (table: UseTableReturnType<TRecord, HttpError>) => ReactNode;
  /** Replace the default create-dialog trigger with a route-based action. */
  createAction?: ReactNode;
  children?: ReactNode;
  refineCoreProps?: Omit<NonNullable<UseDataTableOptions<TRecord>["refineCoreProps"]>, "resource">;
  deleteConsequence?: string;
  rowActions?: ResourceRowAction[];
  storageKey?: string;
  enableRowReordering?: boolean;
  getRowLabel?: (row: TRecord) => string;
  /** UI callback only. The resource view does not persist dragged positions. */
  onReorder?: (orderedIds: string[], orderedRows: TRecord[]) => void;
}

export interface ResourceDeleteDialogProps {
  resource: string;
  id: string;
  name?: string;
  canDelete: boolean;
  record?: BaseRecord;
  consequence?: string;
  onClose: () => void;
}
