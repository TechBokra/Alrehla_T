import { useCallback, useMemo, useState } from "react";
import type { BaseRecord, HttpError } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import type { UseTableReturnType } from "@refinedev/react-table";
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
  onReorder?: (orderedIds: string[], orderedRows: TRecord[]) => void;
}

/** Owns Refine list state and the table's local, non-persistent reorder draft. */
export function useResourceTable<TRecord extends ResourceRecord>({
  resource,
  columns: columnInput,
  searchField,
  searchFields,
  searchDebounceMs,
  initialState,
  refineCoreProps,
  enableRowReordering = false,
  onReorder,
}: UseResourceTableOptions<TRecord>): {
  table: UseTableReturnType<TRecord, HttpError>;
  reorder: (ids: string[]) => void;
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
      pagination: { pageSize: 20, ...refineCoreProps?.pagination },
    },
  });

  const reorder = (ids: string[]) => {
    const source = table.refineCore.tableQuery.data?.data;
    if (
      !enableRowReordering ||
      !source ||
      ids.length !== source.length ||
      new Set(ids).size !== source.length
    )
      return;
    const byId = new Map(source.map((row) => [String(row.id), row]));
    if (ids.some((id) => !byId.has(id))) return;
    setDraft({ source, ids: [...ids] });
    onReorder?.(
      [...ids],
      ids.map((id) => byId.get(id)!),
    );
  };

  return { table, reorder };
}
