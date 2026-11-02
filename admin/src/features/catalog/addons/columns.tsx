import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import { ResourceRowActions, createResourceSwitchColumn } from "@/components/resources";
import type { Addon } from "./model";

export function addonColumns(): ColumnDef<Addon, unknown>[] {
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
    createResourceSwitchColumn<Addon>({
      field: "is_active",
      label: "الحالة",
    }),
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
