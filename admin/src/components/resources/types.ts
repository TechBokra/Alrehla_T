import type { ReactNode, ComponentType } from "react";
import type { BaseRecord, HttpError } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { UseDataTableOptions } from "@/components/refine-ui/data-table/use-data-table";
import type { RowReordering } from "@/components/block/shuip/data-table";
import type { ResourceFormDialogContext } from "./forms/types";
import type { ResourceFormFactory } from "./page/types";

export interface ResourceRowAction {
  key: string;
  authorizationAction: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: (id: string) => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}

export interface ResourceFormFieldsContext<TRecord>
  extends ResourceFormDialogContext<TRecord> {
  resource: string;
  action: "create" | "edit";
}

export type ResourceFormMode = "dialog" | "page";

export type ResourceDialogFormDefinition<TRecord extends BaseRecord> =
  ResourceFormFactory<TRecord>;
export type ResourceFormDefinition<TRecord extends BaseRecord> =
  ResourceFormFactory<TRecord>;

type ResourceRecord = BaseRecord & { id: string | number };
interface ResourceViewBaseProps<TRecord extends ResourceRecord> {
  resource: string;
  title: string;
  description?: ReactNode;
  columns: ColumnDef<TRecord, unknown>[] | (() => ColumnDef<TRecord, unknown>[]);
  /** Additional record-level rule; authorization still comes from Refine. */
  canEdit?: (record: TRecord) => boolean;
  /** Hides creation and prevents create actions for read-only resource views. */
  canCreate?: boolean;
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
  /** Restricts dragging and dropping to rows that pass this record rule. */
  canReorderRow?: (record: TRecord) => boolean;
  /** Numeric position column; enables debounced drop persistence. */
  orderField?: Extract<keyof TRecord, string>;
  getRowLabel?: (row: TRecord) => string;
  /** Optional drop notification; persistence is configured through orderField. */
  onReorder?: (orderedIds: string[], orderedRows: TRecord[]) => void;
}

/** Page and dialog modes share the same module-scope form definition. */
export type ResourceViewProps<TRecord extends ResourceRecord> =
  ResourceViewBaseProps<TRecord> &
    (
      | { mode: "page"; form: ResourceFormDefinition<TRecord> }
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
