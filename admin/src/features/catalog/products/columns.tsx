import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import { ResourceRowActions, createResourceSwitchColumn } from "@/components/resources";
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
    createResourceSwitchColumn<Product>({
      field: "is_active",
      label: "الحالة",
    }),
    {
      id: "actions",
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      header: "الإجراءات",
      cell: ({ row }) => <ProductRowActions product={row.original} />,
    },
  ];
}

function ProductRowActions({ product }: { product: Product }) {
  return <ResourceRowActions id={String(product.id)} />;
}
