import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import type { BooleanField } from "@/components/resources/columns/resource-switch-column";
import {
  createResourceSwitchColumn,
  ResourceRowActions,
  ResourceActionsColumnHeader,
} from "@/components/resources";
import { Badge } from "@/components/ui/badge";
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
    size: 50,
    minSize: 50,
    maxSize: 70,
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false,
    header: () => <ResourceActionsColumnHeader />,
    meta: { label: "الإجراءات" },
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
    {
      accessorKey: "label",
      meta: { label: "خانة التخصيص", variant: "text" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="خانة التخصيص" />
      ),
      size: 380,
      cell: ({ row }) => {
        const field = row.original;
        const products =
          field.applies_to?.filter((target) => target !== "box").length ?? 0;
        const includesBox = field.applies_to?.includes("box") ?? false;
        const scope = !field.applies_to?.length
          ? "كل المنتجات وصندوق الرحلة"
          : [
              products === 1
                ? "منتج واحد"
                : products > 1
                  ? `${new Intl.NumberFormat("ar-EG").format(products)} من المنتجات`
                  : "",
              includesBox ? "صندوق الرحلة" : "",
            ]
              .filter(Boolean)
              .join("، ");

        return (
          <div className="flex min-w-64 flex-col items-start gap-1.5 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <bdi className="font-medium">{field.label}</bdi>
              {field.is_required ? (
                <Badge variant="secondary">إلزامية</Badge>
              ) : null}
            </div>
            {field.placeholder ? (
              <p className="text-sm text-muted-foreground">
                <span>مثال: </span>
                <bdi>{field.placeholder}</bdi>
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">يظهر في: {scope}</p>
          </div>
        );
      },
    },
    activeColumn(),
    actionsColumn(),
  ];
}
export function storyGoalColumns(): ColumnDef<StoryGoal, unknown>[] {
  return [labelColumn(), scopeColumn(), activeColumn(), actionsColumn()];
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
