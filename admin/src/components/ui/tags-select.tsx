import { useId, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type TagOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  description?: string;
};

type TagsSelectProps<TValue extends string> = {
  id: string;
  options: ReadonlyArray<TagOption<TValue>>;
  value: TValue[];
  onValueChange: (value: TValue[]) => void;
  onBlur?: () => void;
  disabled?: boolean;
  maxVisibleTags?: number;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  triggerAriaLabel?: string;
  triggerAriaLabelledBy?: string;
};

export function TagsSelect<TValue extends string>({
  id,
  options,
  value,
  onValueChange,
  onBlur,
  disabled = false,
  maxVisibleTags = 2,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  triggerAriaLabel,
  triggerAriaLabelledBy,
}: TagsSelectProps<TValue>) {
  const instanceId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const visibleLimit = Number.isFinite(maxVisibleTags)
    ? Math.max(0, Math.floor(maxVisibleTags))
    : 2;
  const visibleTags = value.slice(0, visibleLimit);
  const hiddenCount = value.length - visibleTags.length;
  const query = search.trim().toLocaleLowerCase();
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.description ?? ""}`
      .toLocaleLowerCase()
      .includes(query)
  );

  function changeSelection(option: TValue, checked: boolean) {
    onValueChange(
      checked
        ? value.includes(option)
          ? value
          : [...value, option]
        : value.filter((item) => item !== option)
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch("");
          onBlur?.();
        }
      }}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <PopoverAnchor asChild>
          <div
            role="group"
            aria-label="الوسوم المحددة"
            data-slot="tags-select-trigger"
            className={cn(
              "flex min-h-11 min-w-0 flex-wrap items-center gap-2 rounded-lg border bg-background p-2",
              invalid && "border-destructive",
              disabled && "opacity-50"
            )}
          >
            {visibleTags.map((selectedValue) => (
              <Badge
                key={selectedValue}
                className="h-auto gap-1 py-1 pl-2 pr-1"
              >
                <span>
                  {options.find((option) => option.value === selectedValue)
                    ?.label ?? selectedValue}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-4 rounded-full"
                  disabled={disabled}
                  aria-label={`إزالة الوسم ${options.find((option) => option.value === selectedValue)?.label ?? selectedValue}`}
                  onBlur={onBlur}
                  onClick={() => changeSelection(selectedValue, false)}
                >
                  <X />
                </Button>
              </Badge>
            ))}

            {hiddenCount > 0 ? (
              <Badge
                variant="outline"
                className="h-auto py-1"
                title={`وسوم محددة أخرى: ${hiddenCount}`}
              >
                +{hiddenCount}
              </Badge>
            ) : null}
            <PopoverTrigger asChild>
              <Button
                id={id}
                type="button"
                variant="ghost"
                disabled={disabled}
                aria-label={triggerAriaLabel ?? "اختيار الوسوم"}
                aria-labelledby={triggerAriaLabelledBy}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className="min-w-28 flex-1 justify-between"
                onBlur={onBlur}
              >
                {value.length ? "إضافة وسوم" : "اختر وسومًا…"}
                <ChevronsUpDown data-icon="inline-end" />
              </Button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          collisionPadding={12}
          className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden"
          aria-label="خيارات الوسوم"
        >
          <Field className="shrink-0">
            <FieldLabel htmlFor={`${instanceId}-search`} className="sr-only">
              ابحث عن وسوم
            </FieldLabel>
            <Input
              id={`${instanceId}-search`}
              type="search"
              placeholder="ابحث عن وسوم…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
            />
          </Field>

          <div className="max-h-64 min-h-0 overflow-y-auto">
            <FieldSet>
              <FieldLegend className="sr-only">الوسوم المتاحة</FieldLegend>
              <FieldGroup className="gap-2">
                {filteredOptions.map((option) => {
                  const selected = value.includes(option.value);
                  const optionId = `${instanceId}-option-${encodeURIComponent(option.value)}`;
                  return (
                    <Field
                      key={option.value}
                      orientation="horizontal"
                      data-disabled={disabled}
                      className={cn(
                        "rounded-lg border p-3",
                        selected && "border-primary bg-primary/5"
                      )}
                    >
                      <Checkbox
                        id={optionId}
                        checked={selected}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          changeSelection(option.value, checked === true)
                        }
                        onBlur={onBlur}
                        aria-describedby={
                          option.description
                            ? `${optionId}-description`
                            : undefined
                        }
                      />
                      <FieldContent>
                        <FieldLabel htmlFor={optionId}>
                          {option.label}
                        </FieldLabel>
                        {option.description ? (
                          <FieldDescription id={`${optionId}-description`}>
                            {option.description}
                          </FieldDescription>
                        ) : null}
                      </FieldContent>
                    </Field>
                  );
                })}
              </FieldGroup>
              {filteredOptions.length === 0 ? (
                <p role="status" className="text-sm text-muted-foreground">
                  No tags match your search.
                </p>
              ) : null}
            </FieldSet>
          </div>
        </PopoverContent>
      </div>
    </Popover>
  );
}
