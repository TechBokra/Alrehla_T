import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import {
  ResourceRowActions,
  ResourceActionsColumnHeader,
  createResourceSwitchColumn,
} from "@/components/resources";
import type { Addon } from "./model";
import { PackagePlus } from "lucide-react";
import { CatalogImageAvatar } from "../catalog-image-avatar";

export function addonColumns(): ColumnDef<Addon, unknown>[] {
  return [
    {
      id: "image",
      meta: { label: "صورة الإضافة", compactCell: true },
      header: () => <span className="sr-only">صورة الإضافة</span>,
      size: 50,
      minSize: 50,
      maxSize: 70,
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      cell: ({ row }) => (
        <CatalogImageAvatar
          src={row.original.image_url}
          fallback={<PackagePlus aria-hidden="true" />}
        />
      ),
    },
    {
      accessorKey: "name",
      meta: { label: "الإضافة", variant: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="الإضافة" />
      ),
      size: 520,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <bdi className="break-words font-medium">{row.original.name}</bdi>
          <p
            className="whitespace-pre-wrap break-words text-sm text-muted-foreground"
            dir="auto"
          >
            {row.original.description || "بدون وصف"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "price",
      meta: { label: "السعر", variant: "number" },
      size: 140,
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
      id: "actions",
      size: 50,
      minSize: 50,
      maxSize: 70,
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      header: () => <ResourceActionsColumnHeader />,
      meta: { label: "الإجراءات" },
      cell: ({ row }) => <ResourceRowActions id={row.original.id} />,
    },
  ];
}
