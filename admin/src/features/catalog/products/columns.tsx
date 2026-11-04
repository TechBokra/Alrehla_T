import type { ColumnDef } from "@tanstack/react-table";
import { Package } from "lucide-react";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import {
  ResourceRowActions,
  ResourceActionsColumnHeader,
  createResourceSwitchColumn,
} from "@/components/resources";
import { CatalogImageAvatar } from "../catalog-image-avatar";
import type { Product } from "./model";

const categories = [
  { value: "library", label: "المكتبة" },
  { value: "custom", label: "قصة مخصصة" },
];

export function productColumns(): ColumnDef<Product, unknown>[] {
  return [
    {
      id: "image",
      meta: { label: "صورة المنتج", compactCell: true },
      header: () => <span className="sr-only">صورة المنتج</span>,
      size: 50,
      minSize: 50,
      maxSize: 70,
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      cell: ({ row }) => (
        <CatalogImageAvatar
          src={row.original.cover_image_url}
          fallback={<Package aria-hidden="true" />}
        />
      ),
    },
    {
      accessorKey: "name",
      meta: { label: "اسم المنتج", variant: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="اسم المنتج" />
      ),
      size: 220,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <bdi className="break-words font-bold text-sm" title={product.name}>
            {product.name}
          </bdi>
        );
      },
    },
    {
      accessorKey: "category",
      meta: { label: "النوع", variant: "multiSelect", options: categories },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="النوع" />
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
      size: 50,
      minSize: 50,
      maxSize: 70,
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      header: () => <ResourceActionsColumnHeader />,
      meta: { label: "الإجراءات" },
      cell: ({ row }) => <ProductRowActions product={row.original} />,
    },
  ];
}

function ProductRowActions({ product }: { product: Product }) {
  return <ResourceRowActions id={String(product.id)} />;
}
