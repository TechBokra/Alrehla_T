import { useState } from "react";
import { useSelect } from "@refinedev/core";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/** Refine owns both the searched product list and hydration of saved selections. */
export function ScopeTargetsField({ disabled }: { disabled: boolean }) {
  const field = useFieldContext<string[]>();
  const [open, setOpen] = useState(false);
  const products = useSelect<{ id: string; name: string }>({
    resource: "personalized_products",
    dataProviderName: "default",
    optionLabel: "name",
    optionValue: "id",
    searchField: "name",
    filters: [
      { field: "category", operator: "in", value: ["library", "custom"] },
    ],
    sorters: [
      { field: "name", order: "asc" },
      { field: "id", order: "asc" },
    ],
    pagination: { mode: "server", pageSize: 25 },
    defaultValue: field.state.value.filter((id) => id !== "box"),
    meta: { select: "id,name" },
    queryOptions: { retry: false },
    defaultValueQueryOptions: { retry: false },
  });
  const options = [
    { label: "صندوق الرحلة", value: "box" },
    ...products.options.map((option) => ({
      label: String(option.label),
      value: String(option.value),
    })),
  ];
  const toggle = (value: string) => {
    if (disabled) return;
    field.handleChange(
      field.state.value.includes(value)
        ? field.state.value.filter((id) => id !== value)
        : [...field.state.value, value],
    );
    field.handleBlur();
  };
  const failed =
    products.query.isError || products.defaultValueQuery.query.isError;
  return (
    <BaseFormField
      label="المنتجات وصندوق الرحلة"
      required
      disabled={disabled}
      labelTarget="labelledBy"
    >
      {(control) => (
        <div className="flex flex-col gap-3">
          <Popover
            open={open && !disabled}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) field.handleBlur();
            }}
          >
            <PopoverTrigger asChild>
              <Button
                {...control}
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open && !disabled}
                className="w-full justify-between"
              >
                اختر المنتجات أو صندوق الرحلة
                <ChevronsUpDown data-icon="inline-end" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[var(--radix-popover-trigger-width)] p-0"
            >
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="ابحث باسم المنتج…"
                  onValueChange={products.onSearch}
                />
                <CommandList>
                  {failed ? (
                    <div
                      role="alert"
                      className="flex flex-col gap-2 p-3 text-sm"
                    >
                      تعذّر تحميل المنتجات.
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          void products.query.refetch();
                          void products.defaultValueQuery.query.refetch();
                        }}
                      >
                        إعادة المحاولة
                      </Button>
                    </div>
                  ) : products.query.isFetching ? (
                    <p role="status" className="p-3 text-sm">
                      جارٍ تحميل المنتجات…
                    </p>
                  ) : null}
                  <CommandGroup>
                    {options.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        disabled={disabled}
                        onSelect={() => toggle(option.value)}
                      >
                        <Check
                          className={
                            field.state.value.includes(option.value)
                              ? "opacity-100"
                              : "opacity-0"
                          }
                        />
                        <bdi>{option.label}</bdi>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <p className="p-3 text-sm text-muted-foreground">
                    ابحث للوصول إلى منتجات أخرى.
                  </p>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {field.state.value.length ? (
            <div className="flex flex-wrap gap-2">
              {field.state.value.map((id) => {
                const label =
                  options.find((option) => option.value === id)?.label ?? id;
                return (
                  <Badge key={id} variant="secondary">
                    <bdi>{label}</bdi>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`إزالة ${label}`}
                      onClick={() => toggle(id)}
                    >
                      <X className="size-3.5" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </BaseFormField>
  );
}
