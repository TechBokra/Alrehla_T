"use client";

import { useId } from "react";

import type { Locale } from "date-fns";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import type { Matcher } from "react-day-picker";
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

export interface MonthFieldProps {
  label?: string;
  required?: boolean;
  description?: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  locale?: Locale;
  disabled?: boolean;
  fieldProps?: React.ComponentProps<typeof Field>;
  className?: string;
}

const toFirstOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);
const toLastOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

export function MonthField({
  required,
  label,
  description,
  placeholder = "Pick a month",
  minDate,
  maxDate,
  locale,
  disabled,
  fieldProps,
  className,
}: MonthFieldProps) {
  const field = useFieldContext<Date | undefined>();
  const generatedId = useId();
  const controlId = generatedId;
  const { isValid } = field.state.meta;
  const [open, setOpen] = React.useState(false);

  const value = field.state.value;

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      field.handleChange(undefined);
      return;
    }
    field.handleChange(toFirstOfMonth(date));
    setOpen(false);
  };

  const minMonth = minDate ? toFirstOfMonth(minDate) : undefined;
  const maxMonth = maxDate ? toLastOfMonth(maxDate) : undefined;

  const disabledMatchers: Matcher[] = [];
  if (minMonth) disabledMatchers.push({ before: minMonth });
  if (maxMonth) disabledMatchers.push({ after: maxMonth });

  return (
    <BaseFormField
      fieldProps={fieldProps}
      label={label}
      description={description}
      required={required}
      htmlFor={controlId}
      disabled={disabled}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={controlId}
            type="button"
            variant="outline"
            disabled={disabled}
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
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          >
            {value ? format(value, "MMMM yyyy", { locale }) : placeholder}
            <CalendarIcon className="size-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={value}
            onSelect={handleSelect}
            disabled={disabledMatchers.length ? disabledMatchers : undefined}
            startMonth={minMonth}
            endMonth={maxMonth}
            defaultMonth={value ?? minMonth}
            locale={locale}
          />
        </PopoverContent>
      </Popover>
    </BaseFormField>
  );
}
