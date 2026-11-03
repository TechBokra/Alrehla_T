import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import {
  ResourceRowActions,
  createResourceSwitchColumn,
} from "@/components/resources";
import type { Addon } from "./model";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PackagePlus } from "lucide-react";

export function addonColumns(): ColumnDef<Addon, unknown>[] {
  return [
    {
      accessorKey: "name",
      meta: { label: "الإضافة", variant: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="الإضافة" />
      ),
      size: 620,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="mt-0.5 size-14 shrink-0 rounded-lg">
            <AvatarImage
              src={row.original.image_url ?? undefined}
              alt=""
              className="object-cover"
            />
            <AvatarFallback className="rounded-lg">
              <PackagePlus aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <bdi className="break-words font-medium">{row.original.name}</bdi>
            <p
              className="whitespace-pre-wrap break-words text-sm text-muted-foreground"
              dir="auto"
            >
              {row.original.description || "بدون وصف"}
            </p>
          </div>
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
      size: 90,
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      header: "الإجراءات",
      cell: ({ row }) => <ResourceRowActions id={row.original.id} />,
    },
  ];
}
