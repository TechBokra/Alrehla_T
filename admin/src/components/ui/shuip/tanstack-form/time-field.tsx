"use client";

import { useId } from "react";

import type { Field } from "@/components/ui/field";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import {
  HOUR_OPTIONS,
  isHourDisabled,
  isMinuteDisabled,
  joinTime,
  MINUTE_OPTIONS,
  splitTime,
} from "@/lib/time";

export function timePartHandlers(
  time: string,
  onChange: (time: string) => void,
) {
  const { hour, minute } = splitTime(time);
  return {
    onHourChange: (next: string | null) =>
      onChange(next === null ? "" : joinTime(next, minute)),
    onMinuteChange: (next: string | null) =>
      onChange(next === null ? "" : joinTime(hour, next)),
  };
}

export interface TimeFieldProps {
  label?: string;
  required?: boolean;
  description?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  fieldProps?: React.ComponentProps<typeof Field>;
}

export function TimeField({
  required,
  label,
  description,
  min,
  max,
  disabled,
  fieldProps,
}: TimeFieldProps) {
  const field = useFieldContext<string>();
  const generatedId = useId();
  const controlId = generatedId;
  const { isValid } = field.state.meta;
  const time = field.state.value ?? "";
  const { hour, minute } = splitTime(time);
  const { onHourChange, onMinuteChange } = timePartHandlers(
    time,
    field.handleChange,
  );
  const bounds = { min, max };

  return (
    <BaseFormField
      fieldProps={fieldProps}
      label={label}
      description={description}
      required={required}
      htmlFor={controlId}
      disabled={disabled}
      variant="fieldset"
    >
      <div dir="ltr" className="flex items-center gap-2">
        <Select value={hour} onValueChange={onHourChange} disabled={disabled}>
          <SelectTrigger
            id={controlId}
            aria-label={(label ?? "الوقت") + " — الساعة"}
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
            className="w-full"
          >
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {HOUR_OPTIONS.map((h) => (
                <SelectItem
                  key={h}
                  value={h}
                  disabled={isHourDisabled(h, bounds)}
                >
                  {h}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">:</span>
        <Select
          value={minute}
          onValueChange={onMinuteChange}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label={(label ?? "الوقت") + " — الدقيقة"}
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
            className="w-full"
          >
            <SelectValue placeholder="mm" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {MINUTE_OPTIONS.map((m) => (
                <SelectItem
                  key={m}
                  value={m}
                  disabled={isMinuteDisabled(m, hour, bounds)}
                >
                  {m}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </BaseFormField>
  );
}
