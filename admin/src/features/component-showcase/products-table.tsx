import { useDataTable } from "@/components/refine-ui/data-table/use-data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownToLine, Eye, Pencil, Trash2 } from "lucide-react";
import type { DemoProduct } from "./demo-provider";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import { CloneButton } from "@/components/refine-ui/buttons/clone";
import { DeleteButton } from "@/components/refine-ui/buttons/delete";
import { EditButton } from "@/components/refine-ui/buttons/edit";
import { ShowButton } from "@/components/refine-ui/buttons/show";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const columns: ColumnDef<DemoProduct>[] = [
  {
    id: "select",
    header: ({ table }) => <Checkbox
      aria-label="تحديد كل صفوف الصفحة"
      checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
      onCheckedChange={value => table.toggleAllPageRowsSelected(Boolean(value))}
    />,
    cell: ({ row }) => <Checkbox aria-label={`تحديد ${row.original.title}`}
      checked={row.getIsSelected()} onCheckedChange={value => row.toggleSelected(Boolean(value))} />,
    size: 48,
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "title",
    meta: { label: "المنتج", variant: "text" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="المنتج" />
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
    header: ({ column }) => <DataTableColumnHeader column={column} title="الحالة" />,
    meta: { label: "الحالة", variant: "multiSelect", options: [
      { label: "نشط", value: "Active" }, { label: "مسودة", value: "Draft" },
    ] },
    cell: ({ row }) => (
      <Badge variant={row.original.status === "Active" ? "secondary" : "outline"}>
        <span
          className={`me-1.5 size-1.5 rounded-full ${row.original.status === "Active" ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        {row.original.status === "Active" ? "نشط" : "مسودة"}
      </Badge>
    ),
    size: 115,
  },
  {
    accessorKey: "inventory",
    meta: { label: "المخزون", variant: "number" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="المخزون" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {new Intl.NumberFormat("ar-EG").format(row.original.inventory)} قطعة متاحة
      </span>
    ),
    size: 150,
  },
  {
    accessorKey: "price",
    meta: { label: "السعر", variant: "number" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="السعر" />
    ),
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {new Intl.NumberFormat("ar-EG", {
          style: "currency",
          currency: "EGP",
          maximumFractionDigits: 0,
        }).format(row.original.price)}
      </span>
    ),
    size: 100,
  },
  {
    id: "actions",
    enableHiding: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        <ShowButton
          resource="products"
          recordItemId={row.original.id}
          variant="ghost"
          size="icon"
          aria-label={`عرض ${row.original.title}`}
        >
          <Eye />
        </ShowButton>
        <EditButton
          resource="products"
          recordItemId={row.original.id}
          variant="ghost"
          size="icon"
          aria-label={`تعديل ${row.original.title}`}
        >
          <Pencil />
        </EditButton>
        <CloneButton
          resource="products"
          recordItemId={row.original.id}
          variant="ghost"
          size="icon"
          aria-label={`نسخ ${row.original.title}`}
        >
          <ArrowDownToLine />
        </CloneButton>
        <DeleteButton
          resource="products"
          recordItemId={row.original.id}
          variant="ghost"
          size="icon"
          aria-label={`حذف ${row.original.title}`}
        >
          <Trash2 />
        </DeleteButton>
      </div>
    ),
    size: 170,
  },
];

export function ProductsTablePreview() {
  const table = useDataTable<DemoProduct>({
    columns,
    mode: "client",
    enableRowSelection: true,
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    refineCoreProps: { resource: "products" },
  });

  return (
    <DataTable
      table={table}
      searchPlaceholder="ابحث عن منتج تجريبي…"
      toolbarVariant="inline-chips"
      viewsStorageKey="refine-preview-products"
      paginationVariant="numbered"
      pageSizeOptions={[5, 10, 20]}
    />
  );
}
