import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGo } from "@refinedev/core";
import {
  formatDate,
  money,
  orderItemsLabel,
  orderReference,
  orderStatusLabels,
  orderStatusOptions,
  paymentMethodOptions,
  type OrderDetail,
} from "./model";

export function orderColumns(): ColumnDef<OrderDetail, unknown>[] {
  return [
    {
      id: "reference",
      accessorKey: "payment_reference",
      meta: { label: "رقم الطلب", variant: "text" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="رقم الطلب / التاريخ" />,
      cell: ({ row }) => (
        <div className="flex min-w-36 flex-col gap-1">
          <bdi dir="ltr" className="font-medium">{orderReference(row.original)}</bdi>
          <span className="text-xs text-muted-foreground">{formatDate(row.original.created_at)}</span>
        </div>
      ),
    },
    {
      id: "recipient_name",
      accessorKey: "recipient_name",
      meta: { label: "العميل", variant: "text" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="العميل" />,
      cell: ({ row }) => (
        <div className="flex min-w-32 flex-col gap-1">
          <span>{row.original.recipient_name || row.original.customer?.full_name || "—"}</span>
          {row.original.recipient_phone ? <bdi dir="ltr" className="text-xs text-muted-foreground">{row.original.recipient_phone}</bdi> : null}
        </div>
      ),
    },
    {
      id: "items_summary",
      accessorFn: (row) => orderItemsLabel(row),
      enableColumnFilter: false,
      enableSorting: false,
      meta: { label: "المنتجات والإضافات", variant: "text" },
      header: "المنتجات والإضافات",
      cell: ({ row }) => <span className="line-clamp-2 min-w-48 max-w-72 text-sm">{orderItemsLabel(row.original)}</span>,
    },
    {
      accessorKey: "discount_amount",
      meta: { label: "الخصم", variant: "number" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="الخصم" />,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {row.original.discount_code ? <bdi dir="ltr" className="text-xs text-muted-foreground">{row.original.discount_code}</bdi> : null}
          <span>{row.original.discount_amount ? money(row.original.discount_amount) : "—"}</span>
        </div>
      ),
    },
    {
      accessorKey: "total_amount",
      meta: { label: "الإجمالي", variant: "number" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="الإجمالي" />,
      cell: ({ row }) => <bdi>{money(row.original.total_amount)}</bdi>,
    },
    {
      accessorKey: "status",
      meta: { label: "الحالة", variant: "multiSelect", options: orderStatusOptions },
      header: ({ column }) => <DataTableColumnHeader column={column} title="الحالة" />,
      cell: ({ row }) => <Badge variant={row.original.status === "paid" || row.original.status === "delivered" ? "secondary" : "outline"}>{orderStatusLabels[row.original.status]}</Badge>,
    },
    {
      accessorKey: "payment_method",
      meta: { label: "طريقة الدفع", variant: "multiSelect", options: paymentMethodOptions },
      header: "طريقة الدفع",
      cell: ({ row }) => row.original.payment_provider.toLowerCase().includes("xpay")
        ? "XPay"
        : paymentMethodOptions.find((method) => method.value === row.original.payment_method)?.label ?? row.original.payment_method ?? "—",
    },
    {
      accessorKey: "created_at",
      meta: { label: "تاريخ الطلب", variant: "date" },
      header: "تاريخ الطلب",
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: "actions",
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      header: "الإجراءات",
      cell: ({ row }) => <OrderOpenButton id={row.original.id} />,
    },
  ];
}

function OrderOpenButton({ id }: { id: string }) {
  const go = useGo();
  return (
    <Button size="sm" variant="ghost" onClick={() => go({ to: { resource: "orders", action: "show", id }, type: "push" })}>
      <Eye data-icon="inline-start" />
      عرض الطلب
    </Button>
  );
}
