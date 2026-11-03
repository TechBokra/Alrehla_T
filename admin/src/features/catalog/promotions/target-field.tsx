import { useState } from "react";
import { useSelect } from "@refinedev/core";
import { ChevronsUpDown, Check } from "lucide-react";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import { Button } from "@/components/ui/button";
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
import { PROMOTIONS_PROVIDER, type TargetType } from "./model";

export function PromotionTargetField({
  type,
  disabled,
}: {
  type: TargetType;
  disabled: boolean;
}) {
  const field = useFieldContext<string>();
  const [open, setOpen] = useState(false);
  const targets = useSelect<{ id: string; name: string; price: number | null }>(
    {
      resource: "promotion_targets",
      dataProviderName: PROMOTIONS_PROVIDER,
      optionLabel: "name",
      optionValue: "id",
      searchField: "name",
      sorters: [
        { field: "name", order: "asc" },
        { field: "id", order: "asc" },
      ],
      pagination: { mode: "server", pageSize: 25 },
      defaultValue: field.state.value || undefined,
      meta: { targetType: type },
      queryOptions: { retry: false },
      defaultValueQueryOptions: { retry: false },
    },
  );
  const failed =
    targets.query.isError || targets.defaultValueQuery.query.isError;
  const selected = targets.options.find(
    (option) => String(option.value) === field.state.value,
  );
  return (
    <BaseFormField
      label="العنصر"
      required
      disabled={disabled}
      labelTarget="labelledBy"
      description="ابحث بالاسم للوصول إلى باقي العناصر. الأسعار الحالية تُقرأ عند حفظ العرض."
    >
      {(control) => (
        <Popover
          open={open && !disabled}
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) field.handleBlur();
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
              <bdi className="truncate">
                {selected?.label ??
                  (field.state.value
                    ? `العنصر: ${field.state.value}`
                    : "اختر العنصر")}
              </bdi>
              <ChevronsUpDown data-icon="inline-end" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] p-0"
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="ابحث باسم العنصر…"
                onValueChange={targets.onSearch}
              />
              <CommandList>
                {failed ? (
                  <div role="alert" className="flex flex-col gap-2 p-3 text-sm">
                    تعذّر تحميل العناصر.
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void targets.query.refetch();
                        void targets.defaultValueQuery.query.refetch();
                      }}
                    >
                      إعادة المحاولة
                    </Button>
                  </div>
                ) : targets.query.isFetching ? (
                  <p role="status" className="p-3 text-sm">
                    جارٍ التحميل…
                  </p>
                ) : !targets.options.length ? (
                  <p className="p-3 text-sm">لا توجد عناصر مطابقة.</p>
                ) : null}
                <CommandGroup>
                  {targets.options.map((option) => (
                    <CommandItem
                      key={String(option.value)}
                      value={String(option.value)}
                      disabled={disabled || targets.query.isFetching || failed}
                      onSelect={() => {
                        field.handleChange(String(option.value));
                        field.handleBlur();
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={
                          field.state.value === String(option.value)
                            ? "opacity-100"
                            : "opacity-0"
                        }
                      />
                      <bdi>{option.label}</bdi>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </BaseFormField>
  );
}
