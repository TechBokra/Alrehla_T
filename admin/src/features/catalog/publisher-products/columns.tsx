import type { ColumnDef } from "@tanstack/react-table";
import { Package } from "lucide-react";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import { createResourceSwitchColumn } from "@/components/resources";
import type { Database } from "@/types/supabase";
import type { Product } from "../products/model";

export type PublisherSummary = Pick<
  Database["public"]["Tables"]["publishers"]["Row"],
  "id" | "name"
>;

const categoryLabels: Record<string, string> = {
  library: "مكتبة",
  custom: "مخصص",
  subscription: "اشتراك",
};

const currency = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
});
const number = new Intl.NumberFormat("ar-EG");

function ageLabel(minAge: number | null, maxAge: number | null) {
  if (minAge == null) return "—";
  if (maxAge == null) return `من ${number.format(minAge)} سنة فأكبر`;
  if (minAge === maxAge) return `${number.format(minAge)} سنة`;
  return `من ${number.format(minAge)} لـ${number.format(maxAge)} سنة`;
}

export function publisherProductColumns(
  publisherRows: PublisherSummary[],
): ColumnDef<Product, unknown>[] {
  const publisherNames = new Map(
    publisherRows.map((publisher) => [publisher.id, publisher.name]),
  );

  return [
    {
      accessorKey: "name",
      meta: { label: "اسم المنتج", variant: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="اسم المنتج" />
      ),
      maxSize: 250,
      size: 250,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex min-w-56 items-center gap-3">
            {product.cover_image_url ? (
              <img
                className="size-10 shrink-0 rounded object-cover"
                src={product.cover_image_url}
                alt={product.name}
                title={product.name}
              />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                <Package className="size-5" />
              </div>
            )}
            <span className="font-semibold" dir="auto" title={product.name}>
              {product.name}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      meta: { label: "النوع" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="النوع" />
      ),
      cell: ({ row }) =>
        categoryLabels[row.original.category] ?? row.original.category,
    },
    {
      accessorKey: "publisher_id",
      meta: {
        label: "دار النشر",
        variant: "multiSelect",
        options: publisherRows.map((publisher) => ({
          value: publisher.id,
          label: publisher.name,
        })),
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="دار النشر" />
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const publisherId = row.original.publisher_id;
        if (!publisherId) return "من غير دار نشر";
        return publisherNames.get(publisherId) ?? "دار غير متاحة";
      },
    },
    {
      id: "age_range",
      accessorFn: (product) => ageLabel(product.min_age, product.max_age),
      enableColumnFilter: false,
      enableSorting: false,
      meta: { label: "السنّ" },
      header: "السنّ",
      cell: ({ row }) => ageLabel(row.original.min_age, row.original.max_age),
    },
    {
      accessorKey: "price",
      meta: { label: "السعر" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="السعر" />
      ),
      cell: ({ row }) => <bdi>{currency.format(row.original.price)}</bdi>,
    },
    createResourceSwitchColumn<Product>({
      field: "is_active",
      label: "الحالة",
      trueLabel: "مفعّل",
      falseLabel: "موقوف",
    }),
  ];
}
