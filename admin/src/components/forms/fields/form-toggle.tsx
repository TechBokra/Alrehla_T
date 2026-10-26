"use client";

import { Toggle } from "@/components/ui/toggle";
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";

export function FormToggle({
  label,
  description,
  disabled,
  ariaLabel,
}: FieldProps) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy, labelId } = presentation;

  return (
    <FieldFrame presentation={presentation} labelTarget="labelledBy">
      <Toggle
        id={id}
        type="button"
        variant="outline"
        pressed={field.state.value}
        disabled={disabled}
        aria-label={
          !presentation.label ? presentation.accessibleLabel : undefined
        }
        aria-labelledby={presentation.label ? labelId : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={field.handleBlur}
        onPressedChange={field.handleChange}
      >
        {field.state.value ? "مفعّل" : "غير مفعّل"}
      </Toggle>
    </FieldFrame>
  );
}
