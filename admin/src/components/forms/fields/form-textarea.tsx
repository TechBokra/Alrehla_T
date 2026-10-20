"use client";

import { Textarea } from "@/components/ui/textarea";
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";

export function FormTextarea({
  label,
  description,
  disabled,
  ariaLabel,
  placeholder,
  rows = 4,
}: FieldProps & { placeholder?: string; rows?: number }) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy } = presentation;

  return (
    <FieldFrame presentation={presentation}>
      <Textarea
        id={id}
        name={field.name}
        rows={rows}
        placeholder={placeholder}
        value={field.state.value ?? ""}
        disabled={disabled}
        aria-label={
          !presentation.label ? presentation.accessibleLabel : undefined
        }
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
    </FieldFrame>
  );
}
