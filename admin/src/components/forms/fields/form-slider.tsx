"use client";

import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";
import { Slider } from "@/components/ui/slider";

export function FormSlider({
  label,
  description,
  disabled,
  ariaLabel,
  min = 0,
  max = 100,
  step = 1,
}: FieldProps & { min?: number; max?: number; step?: number }) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy, labelId } = presentation;

  return (
    <FieldFrame presentation={presentation} labelTarget="labelledBy">
      <Slider
        value={[field.state.value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={invalid}
        onBlur={field.handleBlur}
        thumbProps={{
          id,
          "aria-label": !presentation.label
            ? presentation.accessibleLabel
            : undefined,
          "aria-labelledby": presentation.label ? labelId : undefined,
          "aria-invalid": invalid,
          "aria-describedby": describedBy,
        }}
        onValueChange={(values) => field.handleChange(values[0] ?? min)}
      />
      <output className="text-sm text-muted-foreground">
        {field.state.value}
      </output>
    </FieldFrame>
  );
}
