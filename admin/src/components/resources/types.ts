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

export type ResourceFormMode = "dialog" | "page";

export interface ResourceDialogFormDefinition<TRecord extends BaseRecord> {
  title: string;
  dataProviderName?: string;
  /** Maps save/backend failures to user-facing copy; form field validation stays in the form. */
  getErrorMessage?: (error: unknown) => string;
  onSaved?: (record: TRecord, action: "create" | "edit") => void;
  fields: (context: ResourceFormFieldsContext<TRecord>) => ReactNode;
}

/** Kept as the concise name used by resource dialog definitions. */
export type ResourceFormDefinition<TRecord extends BaseRecord> =
  ResourceDialogFormDefinition<TRecord>;

type ResourceRecord = BaseRecord & { id: string | number };
interface ResourceViewBaseProps<TRecord extends ResourceRecord> {
  resource: string;
  title: string;
  description?: string;
  columns: ColumnDef<TRecord, unknown>[] | (() => ColumnDef<TRecord, unknown>[]);
  /** Additional record-level rule; authorization still comes from Refine. */
  canEdit?: (record: TRecord) => boolean;
  searchField?: string;
  searchFields?: string[];
  /** Defaults to DEFAULT_SEARCH_DEBOUNCE_MS (300 ms). */
  searchDebounceMs?: number;
  /** Page-size choices shown by the table; the default request size is 20. */
  pageSizeOptions?: number[];
  initialState?: UseDataTableOptions<TRecord>["initialState"];
  toolbarContent?: (table: UseTableReturnType<TRecord, HttpError>) => ReactNode;
  /** Optional override for the create action selected by mode. */
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

/** Dialog resources require fields; page resources use standalone route forms. */
export type ResourceViewProps<TRecord extends ResourceRecord> =
  ResourceViewBaseProps<TRecord> &
    (
      | { mode: "page"; form?: never }
      | { mode: "dialog"; form: ResourceFormDefinition<TRecord> }
    );

export interface ResourceDeleteDialogProps {
  resource: string;
  id: string;
  name?: string;
  canDelete: boolean;
  record?: BaseRecord;
  consequence?: string;
  onClose: () => void;
}
