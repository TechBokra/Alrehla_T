import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import { ResourceRowActions } from "@/components/resources/resource-row-actions";
import { Badge } from "@/components/ui/badge";
import type { Product } from "./model";

const categories = [
  { value: "library", label: "المكتبة" },
  { value: "custom", label: "قصة مخصصة" },
];

export function productColumns(): ColumnDef<Product, unknown>[] {
  return [
    {
      accessorKey: "name",
      meta: { label: "الاسم", variant: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="الاسم" />
      ),
      size: 260,
    },
    {
      accessorKey: "category",
      meta: { label: "التصنيف", variant: "multiSelect", options: categories },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="التصنيف" />
      ),
      cell: ({ row }) =>
        categories.find((category) => category.value === row.original.category)
          ?.label ?? "اشتراك",
    },
    {
      accessorKey: "price",
      meta: { label: "السعر", variant: "number" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="السعر" />
      ),
      cell: ({ row }) => (
        <bdi>
          {new Intl.NumberFormat("ar-EG", {
            style: "currency",
            currency: "EGP",
          }).format(row.original.price)}
        </bdi>
      ),
    },
    {
      accessorKey: "is_active",
      meta: {
        label: "الحالة",
        variant: "multiSelect",
        options: [
          { value: "true", label: "نشط" },
          { value: "false", label: "غير نشط" },
        ],
      },
      header: "الحالة",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "secondary" : "outline"}>
          {row.original.is_active ? "نشط" : "غير نشط"}
        </Badge>
      ),
    },
    {
      accessorKey: "sort_order",
      meta: { label: "ترتيب العرض", variant: "number" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ترتيب العرض" />
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      header: "الإجراءات",
      cell: ({ row }) => <ResourceRowActions id={row.original.id} />,
    },
  ];
}
