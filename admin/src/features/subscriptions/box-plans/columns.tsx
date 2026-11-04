import type { ColumnDef } from "@tanstack/react-table";
import { PackageOpen } from "lucide-react";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import { ResourceRowActions } from "@/components/resources";
import { Badge } from "@/components/ui/badge";
import { CatalogImageAvatar } from "@/features/catalog/catalog-image-avatar";
import type { BoxPlan } from "./model";

const currency = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("ar-EG");

export function boxPlanColumns(): ColumnDef<BoxPlan, unknown>[] {
  return [
    {
      accessorKey: "name",
      meta: { label: "اسم الباقة", variant: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="اسم الباقة" />
      ),
      size: 340,
      cell: ({ row }) => {
        const plan = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <CatalogImageAvatar
              src={plan.image_url}
              fallback={<PackageOpen aria-hidden="true" />}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <bdi className="break-words font-bold text-sm" title={plan.name}>
                {plan.name}
              </bdi>
              <div className="flex flex-wrap gap-1">
                <Badge variant={plan.is_active ? "default" : "secondary"}>
                  {plan.is_active ? "ظاهرة" : "موقوفة"}
                </Badge>
                {plan.is_highlighted && (
                  <Badge variant="outline">الأكثر اختيارًا</Badge>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "duration_months",
      meta: { label: "المدة", variant: "number" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="المدة" />
      ),
      cell: ({ row }) => <bdi>{number.format(row.original.duration_months)} شهر</bdi>,
    },
    {
      accessorKey: "price_total",
      meta: { label: "السعر الإجمالي", variant: "number" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="السعر الإجمالي" />
      ),
      cell: ({ row }) => <bdi>{currency.format(row.original.price_total)}</bdi>,
    },
    {
      accessorKey: "price_monthly",
      meta: { label: "السعر الشهري", variant: "number" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="السعر الشهري" />
      ),
      cell: ({ row }) => <bdi>{currency.format(row.original.price_monthly)}</bdi>,
    },
    {
      id: "actions",
      header: "الإجراءات",
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      cell: ({ row }) => <ResourceRowActions id={row.original.id} />,
    },
  ];
}
