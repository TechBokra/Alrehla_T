"use client";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldsetFrame } from "../components/fieldset-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps, Option } from "../types";

export function FormCheckboxGroup({
  label,
  description,
  disabled,
  ariaLabel,
  options,
}: FieldProps & { options: ReadonlyArray<Option> }) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy } = presentation;
  const value = field.state.value as string[];

  return (
    <FieldsetFrame presentation={presentation}>
      <FieldGroup className="gap-3">
        {options.map((option) => (
          <Field
            key={option.value}
            orientation="horizontal"
            data-invalid={invalid}
            data-disabled={disabled}
          >
            <Checkbox
              id={id + "-" + option.value}
              checked={value.includes(option.value)}
              disabled={disabled}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onBlur={field.handleBlur}
              onCheckedChange={(checked) =>
                field.handleChange(
                  checked === true
                    ? [...value, option.value]
                    : value.filter((entry) => entry !== option.value)
                )
              }
            />
            <FieldLabel
              htmlFor={id + "-" + option.value}
              className="font-normal"
            >
              {option.label}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>
    </FieldsetFrame>
  );
}
