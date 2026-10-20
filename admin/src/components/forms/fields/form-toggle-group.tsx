"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FieldsetFrame } from "../components/fieldset-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps, Option } from "../types";

export function FormToggleGroup({
  label,
  description,
  disabled,
  ariaLabel,
  options,
  multiple = false,
}: FieldProps & { options: ReadonlyArray<Option>; multiple?: boolean }) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, invalid, describedBy, labelId } = presentation;

  return (
    <FieldsetFrame presentation={presentation}>
      <ToggleGroup
        type={multiple ? "multiple" : "single"}
        variant="outline"
        value={field.state.value}
        disabled={disabled}
        aria-label={
          !presentation.label ? presentation.accessibleLabel : undefined
        }
        aria-labelledby={presentation.label ? labelId : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={field.handleBlur}
        onValueChange={(value: string | string[]) => {
          if (multiple) field.handleChange(value);
          else if (value) field.handleChange(value);
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </FieldsetFrame>
  );
}
