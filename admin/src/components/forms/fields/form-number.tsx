"use client";

import { Input } from "@/components/ui/input";
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";

export function FormNumber({
  label,
  description,
  disabled,
  ariaLabel,
  min,
  max,
  step = 1,
}: FieldProps & { min?: number; max?: number; step?: number }) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy } = presentation;

  return (
    <FieldFrame presentation={presentation}>
      <Input
        id={id}
        name={field.name}
        type="number"
        min={min}
        max={max}
        step={step}
        value={field.state.value ?? ""}
        disabled={disabled}
        aria-label={
          !presentation.label ? presentation.accessibleLabel : undefined
        }
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={field.handleBlur}
        onChange={(event) =>
          field.handleChange(
            event.target.value === "" ? 0 : Number(event.target.value)
          )
        }
      />
    </FieldFrame>
  );
}
