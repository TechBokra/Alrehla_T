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

export type SelectFieldOption = Record<string, string>;

export interface SelectFieldProps {
  options: SelectFieldOption;
  label?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  fieldProps?: React.ComponentProps<typeof Field>;
  props?: React.ComponentProps<typeof Select>;
}

export function SelectField({
  required,
  options,
  label,
  description,
  placeholder,
  fieldProps,
  props,
}: SelectFieldProps) {
  const field = useFieldContext<string>();
  const generatedId = useId();
  const controlId = generatedId;
  const { isValid } = field.state.meta;
  const selectedLabel =
    Object.entries(options).find(
      ([, value]) => value === field.state.value,
    )?.[0] ??
    (field.state.value || undefined);

  return (
    <BaseFormField
      fieldProps={fieldProps}
      label={label}
      description={description}
      required={required}
      htmlFor={controlId}
      disabled={props?.disabled}
    >
      <Select
        name={field.name}
        value={field.state.value}
        onValueChange={(value) =>
          field.handleChange(typeof value === "string" ? value : "")
        }
        {...props}
        required={required ?? props?.required}
      >
        <SelectTrigger
          id={controlId}
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
        >
          <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(options).map(([optionLabel, value]) => (
              <SelectItem key={value} value={value}>
                {optionLabel}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </BaseFormField>
  );
}
