"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";

type FormInputProps = FieldProps & {
  type?: ComponentProps<typeof Input>["type"];
  placeholder?: string;
};

export function FormInput({
  label,
  description,
  disabled,
  ariaLabel,
  type = "text",
  placeholder,
}: FormInputProps) {
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
        type={type}
        value={field.state.value ?? ""}
        placeholder={placeholder}
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
