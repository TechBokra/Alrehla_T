import type { BaseRecord } from "@refinedev/core";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import { Switch } from "@/components/ui/switch";
import { useResourceBooleanField } from "@/hooks/resources/crud/use-resource-boolean-field";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    resourceBooleanField?: Extract<keyof TData, string>;
  }
}

export type BooleanField<TRecord> = Extract<keyof TRecord, string> &
  {
    [TKey in keyof TRecord]-?: NonNullable<TRecord[TKey]> extends boolean
      ? TKey
      : never;
  }[keyof TRecord];

export function createResourceSwitchColumn<
  TRecord extends BaseRecord & { id: string | number },
>({
  field,
  label,
  trueLabel = "نشط",
  falseLabel = "غير نشط",
}: {
  field: BooleanField<TRecord>;
  label: string;
  trueLabel?: string;
  falseLabel?: string;
}): ColumnDef<TRecord, unknown> {
  return {
    accessorKey: field,
    header: label,
    meta: {
      label,
      variant: "multiSelect",
      resourceBooleanField: field,
      options: [
        { value: "true", label: trueLabel },
        { value: "false", label: falseLabel },
      ],
    },
    cell: ({ row }) => (
      <ResourceSwitchCell
        id={String(row.original.id)}
        field={field}
        label={label}
        trueLabel={trueLabel}
        falseLabel={falseLabel}
      />
    ),
  };
}

export function ResourceSwitchCell({
  id,
  field,
  label,
  trueLabel = "نشط",
  falseLabel = "غير نشط",
}: {
  id: string;
  field: string;
  label: string;
  trueLabel?: string;
  falseLabel?: string;
}) {
  const state = useResourceBooleanField(id, field);
  return (
    <div className="flex items-center gap-2">
      <Switch
        size="sm"
        type="button"
        aria-label={`${label}: ${state.recordLabel} — ${state.pending ? "جارٍ الحفظ…" : state.checked ? trueLabel : falseLabel}`}
        aria-busy={state.pending}
        aria-invalid={Boolean(state.error) || undefined}
        checked={state.checked}
        disabled={state.disabled}
        onCheckedChange={(value) => {
          void state.onCheckedChange(value);
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      />
    </div>
  );
}
