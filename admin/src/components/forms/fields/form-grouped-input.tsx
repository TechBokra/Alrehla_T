"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";

export function FormGroupedInput({
  label,
  description,
  disabled,
  ariaLabel,
  prefix = "SKU",
}: FieldProps & { prefix?: string }) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy } = presentation;

  return (
    <FieldFrame presentation={presentation}>
      <InputGroup data-disabled={disabled}>
        <InputGroupAddon>
          <InputGroupText>{prefix}</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          name={field.name}
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
      </InputGroup>
    </FieldFrame>
  );
}
