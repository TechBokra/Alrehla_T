"use client";

import { useId } from "react";

import type { Field } from "@/components/ui/field";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";

export interface RadioFieldOption {
  label: string;
  value: string;
}

export interface RadioFieldProps {
  options: RadioFieldOption[];
  label?: string;
  required?: boolean;
  description?: string;
  fieldProps?: React.ComponentProps<typeof Field>;
  props?: React.ComponentProps<typeof RadioGroup>;
}

export function RadioField({
  required,
  options,
  label,
  description,
  fieldProps,
  props,
}: RadioFieldProps) {
  const field = useFieldContext<string>();
  const generatedId = useId();
  const controlId = props?.id ?? generatedId;
  const { isValid } = field.state.meta;

  return (
    <BaseFormField
      fieldProps={fieldProps}
      label={label}
      description={description}
      required={required}
      htmlFor={controlId}
      disabled={props?.disabled}
      variant="fieldset"
    >
      <RadioGroup
        name={field.name}
        value={field.state.value}
        onValueChange={(value) => field.handleChange(value)}
        onBlur={field.handleBlur}
        {...props}
        required={required ?? props?.required}
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-3">
            <RadioGroupItem
              id={`${controlId}-${option.value}`}
              value={option.value}
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
            />
            <Label htmlFor={`${controlId}-${option.value}`}>
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </BaseFormField>
  );
}
