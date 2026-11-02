import { useCallback, useMemo, useState } from "react";
import type { BaseRecord, HttpError } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import type { UseTableReturnType } from "@refinedev/react-table";
import { DEFAULT_RESOURCE_PAGE_SIZE } from "@/lib/const";
import { useResourceReorder } from "./use-resource-reorder";
import {
  useDataTable,
  type UseDataTableOptions,
} from "@/components/refine-ui/data-table/use-data-table";

type ResourceRecord = BaseRecord & { id: string | number };

export interface UseResourceTableOptions<TRecord extends ResourceRecord> {
  resource: string;
  columns:
    | ColumnDef<TRecord, unknown>[]
    | (() => ColumnDef<TRecord, unknown>[]);
  searchField?: string;
  searchFields?: string[];
  searchDebounceMs?: number;
  initialState?: UseDataTableOptions<TRecord>["initialState"];
  refineCoreProps?: Omit<
    NonNullable<UseDataTableOptions<TRecord>["refineCoreProps"]>,
    "resource"
  >;
  enableRowReordering?: boolean;
  orderField?: Extract<keyof TRecord, string>;
  onReorder?: (orderedIds: string[], orderedRows: TRecord[]) => void;
}

/** Owns Refine list state, immediate drop preview and optional persistence. */
export function useResourceTable<TRecord extends ResourceRecord>({
  resource,
  columns: columnInput,
  searchField,
  searchFields,
  searchDebounceMs,
  initialState,
  refineCoreProps,
  orderField,
  enableRowReordering = Boolean(orderField),
  onReorder,
}: UseResourceTableOptions<TRecord>): {
  table: UseTableReturnType<TRecord, HttpError>;
  reorder: (ids: string[]) => void;
  reorderSaving: boolean;
} {
  const [draft, setDraft] = useState<{
    source: TRecord[];
    ids: string[];
  } | null>(null);
  const mapDisplayRows = useCallback(
    (rows: TRecord[]) => {
      if (!enableRowReordering || !draft || draft.source !== rows) return rows;
      const byId = new Map(rows.map((row) => [String(row.id), row]));
      return draft.ids.map((id) => byId.get(id)!);
    },
    [draft, enableRowReordering],
  );
  const columns = useMemo(
    () => (typeof columnInput === "function" ? columnInput() : columnInput),
    [columnInput],
  );
  const table = useDataTable<TRecord>({
    columns,
    searchField,
    searchFields,
    searchDebounceMs,
    initialState,
    mapDisplayRows,
    refineCoreProps: {
      ...refineCoreProps,
      resource,
      ...(orderField ? { sorters: {
        ...refineCoreProps?.sorters,
        initial: refineCoreProps?.sorters?.initial ?? [{ field: orderField, order: "asc" }, { field: "id", order: "asc" }],
      } } : {}),
      pagination: { pageSize: DEFAULT_RESOURCE_PAGE_SIZE, ...refineCoreProps?.pagination },
    },
  });
  const clearDraft = useCallback(() => setDraft(null), []);
  const persistence = useResourceReorder<TRecord>({
    resource, field: orderField,
    source: table.refineCore.tableQuery.data?.data,
    scopeKey: JSON.stringify([table.refineCore.currentPage, table.refineCore.pageSize,
      table.refineCore.filters, table.refineCore.sorters, table.reactTable.getState().globalFilter,
      table.reactTable.getState().columnFilters, refineCoreProps?.meta]),
    dataProviderName: refineCoreProps?.dataProviderName,
    filters: refineCoreProps?.filters?.permanent,
    meta: refineCoreProps?.meta,
    onSettled: clearDraft,
  });

  const reorder = (ids: string[]) => {
    const source = table.refineCore.tableQuery.data?.data;
    if (
      !enableRowReordering ||
      persistence.saving ||
      !source ||
      ids.length !== source.length ||
      new Set(ids).size !== source.length
    )
      return;
    const byId = new Map(source.map((row) => [String(row.id), row]));
    if (ids.some((id) => !byId.has(id))) return;
    if (orderField && (table.refineCore.sorters[0]?.field !== orderField || table.refineCore.sorters[0]?.order !== "asc")) return;
    if (ids.every((id, index) => id === String(source[index].id))) {
      persistence.cancel();
      setDraft(null);
      return;
    }
    setDraft({ source, ids: [...ids] });
    persistence.schedule(source, [...ids]);
    onReorder?.(
      [...ids],
      ids.map((id) => byId.get(id)!),
    );
  };

  return { table, reorder, reorderSaving: persistence.saving };
}
