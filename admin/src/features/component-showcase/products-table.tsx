import { useState } from "react";
import { useTable } from "@refinedev/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownToLine, Eye, Pencil, Search, Trash2 } from "lucide-react";
import type { DemoProduct } from "./demo-provider";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { DataTableSorter } from "@/components/refine-ui/data-table/data-table-sorter";
import { CloneButton } from "@/components/refine-ui/buttons/clone";
import { DeleteButton } from "@/components/refine-ui/buttons/delete";
import { EditButton } from "@/components/refine-ui/buttons/edit";
import { ShowButton } from "@/components/refine-ui/buttons/show";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const columns: ColumnDef<DemoProduct>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <span>Product</span>
        <DataTableSorter column={column} />
      </div>
    ),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {row.original.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.sku}
        </p>
      </div>
    ),
    size: 260,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "Active" ? "secondary" : "outline"}>
        <span
          className={`mr-1.5 size-1.5 rounded-full ${row.original.status === "Active" ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        {row.original.status}
      </Badge>
    ),
    size: 115,
  },
  {
    accessorKey: "inventory",
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <span>Inventory</span>
        <DataTableSorter column={column} />
      </div>
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.inventory} in stock
      </span>
    ),
    size: 150,
  },
  {
    accessorKey: "price",
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <span>Price</span>
        <DataTableSorter column={column} />
      </div>
    ),
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(row.original.price)}
      </span>
    ),
    size: 100,
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        <ShowButton
          resource="products"
          recordItemId={row.original.id}
          variant="ghost"
          size="icon"
          aria-label={`Show ${row.original.title}`}
        >
          <Eye />
        </ShowButton>
        <EditButton
          resource="products"
          recordItemId={row.original.id}
          variant="ghost"
          size="icon"
          aria-label={`Edit ${row.original.title}`}
        >
          <Pencil />
        </EditButton>
        <CloneButton
          resource="products"
          recordItemId={row.original.id}
          variant="ghost"
          size="icon"
          aria-label={`Clone ${row.original.title}`}
        >
          <ArrowDownToLine />
        </CloneButton>
        <DeleteButton
          resource="products"
          recordItemId={row.original.id}
          variant="ghost"
          size="icon"
          aria-label={`Delete ${row.original.title}`}
        >
          <Trash2 />
        </DeleteButton>
      </div>
    ),
    size: 170,
  },
];

export function ProductsTablePreview() {
  const [search, setSearch] = useState("");
  const table = useTable<DemoProduct>({
    columns,
    refineCoreProps: {
      resource: "products",
      pagination: { pageSize: 5 },
      filters: { mode: "off" },
      sorters: { mode: "off" },
    },
    globalFilterFn: "includesString",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setSearch(value);
              table.reactTable.setGlobalFilter(value);
            }}
            placeholder="Search sample products…"
            className="pl-9"
            aria-label="Search sample products"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-7 px-2.5 font-normal">
            5 sample records
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              table.reactTable.setGlobalFilter("");
            }}
          >
            Clear filters
          </Button>
        </div>
      </div>
      <DataTable table={table} />
    </div>
  );
}
