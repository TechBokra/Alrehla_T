"use client";

import { useId } from "react";

import { type Field, FieldLabel } from "@/components/ui/field";
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
  addOneHour,
  HOUR_OPTIONS,
  isHourDisabled,
  isMinuteDisabled,
  joinTime,
  MINUTE_OPTIONS,
  nextSlot,
  splitTime,
  type TimeRangeValue,
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

interface TimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  disabled?: boolean;
  invalid?: boolean;
  label: string;
  onBlur: () => void;
}

function TimePicker({
  id,
  value,
  onChange,
  min,
  disabled,
  invalid,
  label,
  onBlur,
}: TimePickerProps) {
  const { hour, minute } = splitTime(value);
  const { onHourChange, onMinuteChange } = timePartHandlers(value, onChange);
  const bounds = { min };

  return (
    <div dir="ltr" className="flex items-center gap-2">
      <Select value={hour} onValueChange={onHourChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          aria-label={label + " — الساعة"}
          onBlur={onBlur}
          aria-invalid={invalid}
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
      <Select value={minute} onValueChange={onMinuteChange} disabled={disabled}>
        <SelectTrigger
          aria-label={label + " — الدقيقة"}
          onBlur={onBlur}
          aria-invalid={invalid}
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
  );
}

export interface TimeRangeFieldProps {
  label?: string;
  required?: boolean;
  description?: string;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  fieldProps?: React.ComponentProps<typeof Field>;
}

export function TimeRangeField({
  required,
  label,
  description,
  startLabel = "البداية",
  endLabel = "النهاية",
  disabled,
  fieldProps,
}: TimeRangeFieldProps) {
  const field = useFieldContext<TimeRangeValue>();
  const generatedId = useId();
  const controlId = generatedId;
  const { isValid } = field.state.meta;
  const value: TimeRangeValue = field.state.value ?? { start: "", end: "" };

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <FieldLabel htmlFor={`${controlId}-start`} className="text-xs">
            {startLabel}
          </FieldLabel>
          <TimePicker
            id={`${controlId}-start`}
            label={startLabel}
            onBlur={field.handleBlur}
            value={value.start}
            onChange={(start) =>
              field.handleChange({ start, end: addOneHour(start) })
            }
            disabled={disabled}
            invalid={!isValid}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <FieldLabel htmlFor={`${controlId}-end`} className="text-xs">
            {endLabel}
          </FieldLabel>
          <TimePicker
            id={`${controlId}-end`}
            label={endLabel}
            onBlur={field.handleBlur}
            value={value.end}
            onChange={(end) => field.handleChange({ ...value, end })}
            min={value.start ? nextSlot(value.start) : undefined}
            disabled={disabled}
            invalid={!isValid}
          />
        </div>
      </div>
    </BaseFormField>
  );
}
