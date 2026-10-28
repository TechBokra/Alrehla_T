"use client";

import { useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import type { Field } from "@/components/ui/field";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";

export interface CheckboxFieldProps {
  label: string;
  required?: boolean;
  description?: string;
  fieldProps?: React.ComponentProps<typeof Field>;
  props?: React.ComponentProps<typeof Checkbox>;
}

export function CheckboxField({
  required,
  label,
  description,
  fieldProps,
  props,
}: CheckboxFieldProps) {
  const field = useFieldContext<boolean>();
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
      orientation="horizontal"
      controlPosition="start"
    >
      <div className="flex items-center gap-2">
        <Checkbox
          name={field.name}
          checked={field.state.value}
          onCheckedChange={(checked) => field.handleChange(checked === true)}
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
          {...props}
          id={controlId}
          required={required ?? props?.required}
        />
      </div>
    </BaseFormField>
  );
}
