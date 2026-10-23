"use client";

import type { BaseRecord, HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import {
  DataTable as ShuipDataTable,
  DataTableEmpty,
  DataTableToolbar,
  DataTableFilterMenu,
  DataTableSortMenu,
  DataTableViews,
  DataTablePagination,
  type DataTableToolbarProps,
  type DataTablePaginationProps,
  type DataTableProps as ShuipDataTableProps,
} from "@/components/block/shuip/data-table";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type DataTableProps<TData extends BaseRecord> = Omit<
  ShuipDataTableProps<TData>,
  "table" | "isLoading"
> & {
  table: UseTableReturnType<TData, HttpError>;
  toolbar?: boolean;
  toolbarVariant?: DataTableToolbarProps<TData>["variant"];
  toolbarActions?: ReactNode;
  searchPlaceholder?: string;
  filterVariant?: "popover" | "dialog";
  viewsStorageKey?: string;
  paginationVariant?: DataTablePaginationProps<TData>["variant"];
  pageSizeOptions?: number[];
};

export function DataTable<TData extends BaseRecord>({
  table,
  emptyState,
  toolbar = true,
  toolbarVariant = "default",
  toolbarActions,
  searchPlaceholder = "ابحث في البيانات…",
  filterVariant = "popover",
  viewsStorageKey,
  paginationVariant = "simple",
  pageSizeOptions,
  loadingVariant = "skeleton",
  ...props
}: DataTableProps<TData>) {
  const {
    reactTable,
    refineCore: { tableQuery },
  } = table;
  const isLoading = tableQuery.isFetching;
  const isFiltered =
    reactTable.getState().columnFilters.length > 0 ||
    Boolean(reactTable.getState().globalFilter);

  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy={isLoading}>
      {toolbar && (
        <DataTableToolbar
          table={reactTable}
          variant={toolbarVariant}
          searchPlaceholder={searchPlaceholder}
        >
          <DataTableFilterMenu table={reactTable} variant={filterVariant} />
          <DataTableSortMenu table={reactTable} />
          {viewsStorageKey && (
            <DataTableViews table={reactTable} storageKey={viewsStorageKey} />
          )}
          {toolbarActions}
        </DataTableToolbar>
      )}
      {tableQuery.isError && (
        <Card role="alert">
          <CardHeader>
            <CardTitle>تعذّر تحميل البيانات. حاول مرة أخرى.</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void tableQuery.refetch()}
              disabled={isLoading}
            >
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      )}
      {!tableQuery.isError && (
        <ShuipDataTable
          {...props}
          table={reactTable}
          isLoading={isLoading}
          loadingVariant={tableQuery.isLoading ? loadingVariant : "overlay"}
          emptyState={
            emptyState ?? (
              <DataTableEmpty
                variant={isFiltered ? "with-action" : "illustrated"}
                title={
                  isFiltered ? "لا توجد نتائج مطابقة" : "لا توجد بيانات لعرضها"
                }
                description={
                  isFiltered
                    ? "جرّب تعديل البحث أو الفلاتر."
                    : "ستظهر السجلات هنا عند إضافتها."
                }
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      reactTable.resetColumnFilters();
                      reactTable.setGlobalFilter("");
                    }}
                  >
                    مسح البحث والفلاتر
                  </Button>
                }
              />
            )
          }
        />
      )}
      {!tableQuery.isLoading && !tableQuery.isError && (
        <DataTablePagination
          table={reactTable}
          variant={paginationVariant}
          pageSizeOptions={pageSizeOptions}
          total={
            reactTable.options.manualPagination
              ? tableQuery.data?.total
              : undefined
          }
        />
      )}
    </div>
  );
}

DataTable.displayName = "DataTable";
