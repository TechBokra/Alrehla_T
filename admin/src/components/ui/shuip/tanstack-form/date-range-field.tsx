"use client";

import { useId } from "react";

import type { Locale } from "date-fns";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import type { DateRange, Matcher } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import type { Field } from "@/components/ui/field";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import { cn } from "@/lib/utils";

export interface DateRangeFieldProps {
  label?: string;
  required?: boolean;
  description?: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  locale?: Locale;
  fieldProps?: React.ComponentProps<typeof Field>;
  triggerProps?: React.ComponentProps<typeof Button>;
}

export function dateBoundsMatcher(
  minDate?: Date,
  maxDate?: Date,
): Matcher[] | undefined {
  if (!minDate && !maxDate) return undefined;
  return [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];
}

function formatRange(
  value: DateRange | undefined,
  locale: Locale | undefined,
): string | null {
  if (!value?.from) return null;
  const fromLabel = format(value.from, "PPP", { locale });
  if (!value.to) return fromLabel;
  return `${fromLabel} – ${format(value.to, "PPP", { locale })}`;
}

export function DateRangeField({
  required,
  label,
  description,
  placeholder = "Pick a date range",
  minDate,
  maxDate,
  locale,
  fieldProps,
  triggerProps,
}: DateRangeFieldProps) {
  const field = useFieldContext<DateRange | undefined>();
  const generatedId = useId();
  const controlId = triggerProps?.id ?? generatedId;
  const { isValid } = field.state.meta;
  const value = field.state.value;
  const [open, setOpen] = React.useState(false);

  const disabledMatcher = React.useMemo(
    () => dateBoundsMatcher(minDate, maxDate),
    [minDate, maxDate],
  );

  const triggerLabel = formatRange(value, locale);

  return (
    <BaseFormField
      fieldProps={fieldProps}
      label={label}
      description={description}
      required={required}
      htmlFor={controlId}
      disabled={triggerProps?.disabled}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={controlId}
            type="button"
            variant="outline"
            onBlur={field.handleBlur}
            aria-describedby={
              [
                description ? controlId + "-description" : undefined,
                !isValid ? controlId + "-error" : undefined,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-required={required || undefined}
            aria-invalid={!isValid}
            {...triggerProps}
            className={cn(
              "w-full justify-between font-normal",
              !triggerLabel && "text-muted-foreground",
              triggerProps?.className,
            )}
          >
            <span className="truncate">{triggerLabel ?? placeholder}</span>
            <CalendarIcon className="size-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value}
            onSelect={(range) => field.handleChange(range)}
            numberOfMonths={2}
            defaultMonth={value?.from ?? minDate}
            disabled={disabledMatcher}
            locale={locale}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </BaseFormField>
  );
}
