import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import type { BooleanField } from "@/components/resources/columns/resource-switch-column";
import {
  createResourceSwitchColumn,
  ResourceRowActions,
} from "@/components/resources";
import {
  scopeLabel,
  type CustomizationField,
  type StoryGoal,
  type WritingDialect,
} from "./model";

function activeColumn<
  T extends { id: string | number; is_active: boolean },
>(): ColumnDef<T, unknown> {
  return createResourceSwitchColumn<T>({
    field: "is_active" as BooleanField<T>,
    label: "الحالة",
    trueLabel: "ظاهر",
    falseLabel: "موقوف",
  });
}
function actionsColumn<T extends { id: string }>(): ColumnDef<T, unknown> {
  return {
    id: "actions",
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false,
    header: "الإجراءات",
    cell: ({ row }) => <ResourceRowActions id={row.original.id} />,
  };
}
function labelColumn<T extends { label: string }>(): ColumnDef<T, unknown> {
  return {
    accessorKey: "label",
    meta: { label: "الاسم", variant: "text" },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="الاسم" />
    ),
    cell: ({ row }) => <bdi>{row.original.label}</bdi>,
  };
}
function scopeColumn<T extends { applies_to: string[] | null }>(): ColumnDef<
  T,
  unknown
> {
  return {
    id: "scope",
    header: "يظهر في",
    enableSorting: false,
    enableColumnFilter: false,
    cell: ({ row }) => scopeLabel(row.original.applies_to),
  };
}

export function customizationFieldColumns(): ColumnDef<
  CustomizationField,
  unknown
>[] {
  return [
    labelColumn(),
    {
      accessorKey: "placeholder",
      header: "مثال داخل الخانة",
      enableSorting: false,
      cell: ({ row }) => <bdi>{row.original.placeholder || "—"}</bdi>,
    },
    {
      accessorKey: "is_required",
      header: "إلزامية",
      cell: ({ row }) => (row.original.is_required ? "نعم" : "لا"),
    },
    scopeColumn(),
    activeColumn(),
    actionsColumn(),
  ];
}
export function storyGoalColumns(): ColumnDef<StoryGoal, unknown>[] {
  return [
    labelColumn(),
    scopeColumn(),
    activeColumn(),
    actionsColumn(),
  ];
}
export function writingDialectColumns(): ColumnDef<WritingDialect, unknown>[] {
  return [
    {
      accessorKey: "name_ar",
      meta: { label: "اللهجة", variant: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="اللهجة" />
      ),
    },
    {
      accessorKey: "code",
      header: "الكود",
      cell: ({ row }) => <bdi dir="ltr">{row.original.code}</bdi>,
    },
    activeColumn(),
    actionsColumn(),
  ];
}
