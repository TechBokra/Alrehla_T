import type { ColumnDef } from "@tanstack/react-table";
import { UserRoundCheck } from "lucide-react";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import { Badge } from "@/components/ui/badge";
import { userRoleLabels, userStatusLabels, type UserRecord } from "./model";
import { Tooltip } from "@/components/ui/tooltip";

function StatusBadge({ status }: { status: UserRecord["status"] }) {
  const variant =
    status === "fully_suspended"
      ? "destructive"
      : status === "active"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{userStatusLabels[status]}</Badge>;
}

export const usersColumn: ColumnDef<UserRecord, unknown>[] = [
  {
    accessorKey: "full_name",
    meta: { label: "الاسم", variant: "text" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="الاسم" />
    ),
    cell: ({ row }) => (
      <div className="flex min-w-40 flex-col items-start gap-1.5 py-1">
        <div>
          <span className="font-medium">{row.original.full_name || "—"}</span>
          {row.original.is_guardian && (
            <Badge variant="secondary">
              <UserRoundCheck data-icon="inline-start" />
            </Badge>
          )}
        </div>
        <StatusBadge status={row.original.status} />
      </div>
    ),
  },
  {
    accessorKey: "email",
    meta: { label: "البريد الإلكتروني", variant: "text" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="البريد الإلكتروني" />
    ),
  },
  {
    accessorKey: "role",
    meta: {
      label: "الدور",
      variant: "select",
      options: Object.entries(userRoleLabels).map(([value, label]) => ({
        value,
        label,
      })),
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="الدور" />
    ),
    cell: ({ row }) => userRoleLabels[row.original.role],
  },
];
