import {
  useTable as useRefineTable,
  type BaseRecord,
  type CrudFilter,
  type HttpError,
  type LogicalFilter,
  type useTableProps,
} from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import {
  useDataTable as useShuipTable,
  type FilterCondition,
  type FilterOperator,
  type UseDataTableProps,
} from "@/components/block/shuip/data-table";
import type { ColumnFiltersState, Updater } from "@tanstack/react-table";
import { useState } from "react";

const searchKey = "__data_table_search";
const emptyRows: never[] = [];
const operators: Record<FilterOperator, LogicalFilter["operator"]> = {
  contains: "contains", notContains: "ncontains", is: "eq", isNot: "ne",
  isEmpty: "null", isNotEmpty: "nnull", eq: "eq", ne: "ne",
  gt: "gt", lt: "lt", gte: "gte", lte: "lte", before: "lt", after: "gt",
  onOrBefore: "lte", onOrAfter: "gte", isAnyOf: "in", isNoneOf: "nin",
};

function resolve<T>(updater: Updater<T>, previous: T): T {
  return typeof updater === "function" ? (updater as (value: T) => T)(previous) : updater;
}

export function toRefineFilters(filters: ColumnFiltersState): CrudFilter[] {
  return filters.flatMap(({ id, value }): LogicalFilter[] => {
    if (Array.isArray(value)) return value.length ? [{ field: id, operator: "in", value }] : [];
    if (!value || typeof value !== "object" || !("operator" in value) || !("value" in value)) return [];
    const condition = value as FilterCondition;
    const operator = operators[condition.operator];
    if (!operator) throw new Error(`Unsupported table filter: ${condition.operator}`);
    const noValue = operator === "null" || operator === "nnull";
    if (!noValue && (condition.value == null || condition.value === "" ||
      (Array.isArray(condition.value) && !condition.value.length))) return [];
    // Supabase's Refine adapter forwards these two operators to PostgREST's
    // raw filter method, which requires wildcards / a parenthesized list.
    const serverValue = operator === "ncontains" ? `%${String(condition.value)}%`
      : operator === "nin" && Array.isArray(condition.value)
        ? `(${condition.value.map(item => JSON.stringify(String(item))).join(",")})`
        : condition.value;
    return [{ field: id, operator, value: noValue ? null : serverValue }];
  });
}

export type UseDataTableOptions<TData extends BaseRecord> = Pick<
  UseDataTableProps<TData>, "columns" | "initialState" | "enableRowSelection" | "enableColumnPinning"
> & {
  refineCoreProps: useTableProps<TData, HttpError, TData>;
  mode?: "server" | "client";
  /** Required for global search in server mode; must name a text field. */
  searchField?: string;
};

/** Refine owns requests; Shuip owns rendering and local table features. */
export function useDataTable<TData extends BaseRecord>({
  refineCoreProps, mode = "server", searchField, ...options
}: UseDataTableOptions<TData>): UseTableReturnType<TData, HttpError> {
  const server = mode === "server";
  // Keep unfinished builder rows visible while only complete conditions reach the provider.
  const [draftFilters, setDraftFilters] = useState<ColumnFiltersState>([]);
  const refineCore = useRefineTable<TData, HttpError, TData>({
    ...refineCoreProps,
    pagination: {
      pageSize: options.initialState?.pagination?.pageSize,
      ...refineCoreProps.pagination,
      mode: server ? "server" : "off",
    },
    filters: { ...refineCoreProps.filters, mode: server ? "server" : "off" },
    sorters: { ...refineCoreProps.sorters, mode: server ? "server" : "off" },
  });

  const committedFilters: ColumnFiltersState = refineCore.filters.flatMap((filter) => {
    if (!("field" in filter)) return [];
    const field = options.columns.find(column => column.id === filter.field ||
      ("accessorKey" in column && column.accessorKey === filter.field));
    if (!field) return [];
    const variant = field.meta?.variant;
    const operator = (Object.keys(operators) as FilterOperator[]).find(key => operators[key] === filter.operator);
    if (!operator) return [];
    // Faceted filters use arrays; the advanced builder also understands this shape.
    if (filter.operator === "in") return [{ id: filter.field, value: filter.value }];
    const dateOperators: Record<string, FilterOperator> = { lt: "before", gt: "after", lte: "onOrBefore", gte: "onOrAfter" };
    const condition: FilterCondition = {
      operator: variant === "date" ? dateOperators[filter.operator] ?? operator
        : variant === "number" && (filter.operator === "eq" || filter.operator === "ne") ? filter.operator : operator,
      value: filter.operator === "ncontains" && typeof filter.value === "string"
        ? filter.value.replace(/^%|%$/g, "")
        : filter.operator === "nin" && typeof filter.value === "string"
          ? JSON.parse(`[${filter.value.slice(1, -1)}]`) as string[]
          : filter.value,
    };
    return [{ id: filter.field, value: condition }];
  });
  const columnFilters = [...committedFilters.filter(filter => !draftFilters.some(draft => draft.id === filter.id)), ...draftFilters];
  const searchFilter = refineCore.filters.find(filter => !("field" in filter) && filter.key === searchKey);
  const globalFilter = searchFilter && !("field" in searchFilter)
    ? String(searchFilter.value[0]?.value ?? "").replace(/\\(["\\])/g, "$1") : "";

  function setColumnFilters(next: ColumnFiltersState) {
    setDraftFilters(next.filter(filter => !toRefineFilters([filter]).length));
    refineCore.setFilters(previous => [
      ...previous.filter(filter => !("field" in filter) || !options.columns.some(column => column.id === filter.field ||
        ("accessorKey" in column && column.accessorKey === filter.field))),
      ...toRefineFilters(next),
    ]);
    refineCore.setCurrentPage(1);
  }

  function setSearch(search: string) {
    // The installed provider interpolates OR values into quoted PostgREST syntax.
    const escaped = search.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const searchFilters: CrudFilter[] = searchField && search
      ? [{ key: searchKey, operator: "or", value: [{ field: searchField, operator: "contains", value: escaped }] }]
      : [];
    refineCore.setFilters(previous => [
      ...previous.filter(filter => "field" in filter || filter.key !== searchKey),
      ...searchFilters,
    ]);
    refineCore.setCurrentPage(1);
  }

  const { table } = useShuipTable<TData>({
    ...options,
    data: refineCore.tableQuery.data?.data ?? emptyRows,
    getRowId: (row, index) => String(row.id ?? index),
    enableGlobalFilter: !server || Boolean(searchField),
    ...(server ? {
      pageCount: refineCore.pageCount,
      state: {
        pagination: { pageIndex: refineCore.currentPage - 1, pageSize: refineCore.pageSize },
        sorting: refineCore.sorters.map(sort => ({ id: sort.field, desc: sort.order === "desc" })),
        columnFilters,
        globalFilter,
      },
      onPaginationChange: (updater) => {
        const previous = { pageIndex: refineCore.currentPage - 1, pageSize: refineCore.pageSize };
        const next = resolve(updater, previous);
        refineCore.setPageSize(next.pageSize);
        refineCore.setCurrentPage(next.pageSize !== previous.pageSize ? 1 : next.pageIndex + 1);
      },
      onSortingChange: (updater) => {
        const previous = refineCore.sorters.map(sort => ({ id: sort.field, desc: sort.order === "desc" }));
        refineCore.setSorters(resolve(updater, previous).map(sort => ({ field: sort.id, order: sort.desc ? "desc" : "asc" })));
        refineCore.setCurrentPage(1);
      },
      onColumnFiltersChange: (updater) => setColumnFilters(resolve(updater, columnFilters)),
      onGlobalFilterChange: (updater) => setSearch(resolve(updater, globalFilter)),
    } satisfies Partial<UseDataTableProps<TData>> : {}),
  });
  return { reactTable: table, refineCore };
}
