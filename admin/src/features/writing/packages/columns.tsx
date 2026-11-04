import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen } from "lucide-react";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import {
  createResourceSwitchColumn,
  ResourceActionsColumnHeader,
  ResourceRowActions,
} from "@/components/resources";
import { CatalogImageAvatar } from "@/features/catalog/catalog-image-avatar";
import type { WritingPackage } from "./model";

const number = new Intl.NumberFormat("ar-EG");
const currency = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

export function writingPackageColumns(): ColumnDef<WritingPackage, unknown>[] {
  return [
    {
      id: "image",
      meta: { label: "صورة الباقة", compactCell: true },
      header: () => <span className="sr-only">صورة الباقة</span>,
      size: 50,
      minSize: 50,
      maxSize: 70,
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      cell: () => (
        <CatalogImageAvatar
          src={null}
          fallback={<BookOpen aria-hidden="true" />}
        />
      ),
    },
    {
      accessorKey: "name",
      meta: { label: "اسم الباقة", variant: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="اسم الباقة" />
      ),
      size: 220,
      cell: ({ row }) => (
        <bdi className="break-words font-bold">{row.original.name}</bdi>
      ),
    },
    {
      accessorKey: "sessions_count",
      meta: { label: "عدد الجلسات", variant: "number" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="عدد الجلسات" />
      ),
      cell: ({ row }) => (
        <bdi>{number.format(row.original.sessions_count ?? 0)} جلسة</bdi>
      ),
    },
    {
      accessorKey: "price",
      meta: { label: "السعر", variant: "number" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="السعر" />
      ),
      cell: ({ row }) => <bdi>{currency.format(row.original.price)}</bdi>,
    },
    createResourceSwitchColumn<WritingPackage>({
      field: "is_active",
      label: "الحالة",
      trueLabel: "متاحة",
      falseLabel: "متوقفة",
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
