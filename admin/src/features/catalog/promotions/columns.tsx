import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import {
  createResourceSwitchColumn,
  ResourceRowActions,
} from "@/components/resources";
import { Badge } from "@/components/ui/badge";
import {
  promotionState,
  targetLabels,
  type Promotion,
  type TargetType,
} from "./model";

const date = new Intl.DateTimeFormat("ar-EG", {
  timeZone: "Africa/Cairo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const number = new Intl.NumberFormat("ar-EG");
const currency = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
});

export function promotionColumns(now: number): ColumnDef<Promotion, unknown>[] {
  return [
    {
      accessorKey: "target_type",
      header: ({ column }) => (
        <div dir="rtl" className="flex w-full justify-start">
          <DataTableColumnHeader
            column={column}
            title="العرض"
            className="ms-0 justify-start"
          />
        </div>
      ),
      meta: {
        label: "العرض",
        variant: "multiSelect",
        options: Object.entries(targetLabels).map(([value, label]) => ({
          value,
          label,
        })),
      },
      size: 520,
      cell: ({ row }) => {
        const promotion = row.original;
        const targetType =
          targetLabels[promotion.target_type as TargetType] ??
          promotion.target_type;
        const price =
          promotion.kind === "percent"
            ? `خصم ${number.format(promotion.value)}٪`
            : `سعر العرض ${currency.format(promotion.value)}`;
        const dateRange = `من ${date.format(new Date(promotion.starts_at))} إلى ${date.format(new Date(promotion.ends_at))}`;

        return (
          <div dir="rtl" className="flex min-w-0 flex-col gap-1 py-1 text-start">
            <bdi className="font-semibold text-foreground text-start">
              {promotion.target_name ?? `عنصر غير متاح: ${promotion.target_id}`}{" "}
              <span>({targetType})</span>
            </bdi>
            <span className="text-sm text-muted-foreground">
              {price}
              {promotion.label?.trim() ? ` — ${promotion.label.trim()}` : ""}
            </span>
            <bdi className="text-xs text-muted-foreground">{dateRange}</bdi>
          </div>
        );
      },
    },
    {
      id: "period_state",
      header: "حالة الفترة",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <Badge
          variant={
            promotionState(row.original, now) === "ساري الآن"
              ? "default"
              : "secondary"
          }
        >
          {promotionState(row.original, now)}
        </Badge>
      ),
    },
    createResourceSwitchColumn<Promotion>({
      field: "is_active",
      label: "الحالة",
      trueLabel: "مفعّل",
      falseLabel: "موقوف",
    }),
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
