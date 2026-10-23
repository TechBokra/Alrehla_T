import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface CatalogRow {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  sort_order: number;
}
export function catalogColumns<TRecord extends CatalogRow>(
  onEdit: (id: string) => void,
): ColumnDef<TRecord, unknown>[] {
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
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(row.original.id)}
        >
          <Pencil data-icon="inline-start" />
          تعديل
        </Button>
      ),
    },
  ];
}
