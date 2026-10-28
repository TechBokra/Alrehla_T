"use client";

import { useId } from "react";

import { format } from "date-fns";
import type { Locale } from "date-fns/locale";
import { enUS } from "date-fns/locale";
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

export interface DateFieldProps {
  label?: string;
  required?: boolean;
  description?: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  locale?: Locale;
  dateFormat?: string;
  disabled?: boolean;
  fieldProps?: React.ComponentProps<typeof Field>;
  triggerProps?: React.ComponentProps<typeof Button>;
}

export function DateField({
  required,
  label,
  description,
  placeholder = "Pick a date",
  minDate,
  maxDate,
  locale = enUS,
  dateFormat = "PPP",
  disabled,
  fieldProps,
  triggerProps,
}: DateFieldProps) {
  const field = useFieldContext<Date | undefined>();
  const generatedId = useId();
  const controlId = triggerProps?.id ?? generatedId;
  const { isValid } = field.state.meta;
  const [open, setOpen] = React.useState(false);

  const value = field.state.value;
  const disabledMatchers: Matcher[] = [];
  if (minDate) disabledMatchers.push({ before: minDate });
  if (maxDate) disabledMatchers.push({ after: maxDate });

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
            type="button"
            id={controlId}
            variant="outline"
            disabled={disabled}
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
            onBlur={field.handleBlur}
            {...triggerProps}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              triggerProps?.className,
            )}
          >
            <span>
              {value ? format(value, dateFormat, { locale }) : placeholder}
            </span>
            <CalendarIcon className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              field.handleChange(date);
              setOpen(false);
            }}
            disabled={
              disabledMatchers.length > 0 ? disabledMatchers : undefined
            }
            locale={locale}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </BaseFormField>
  );
}
