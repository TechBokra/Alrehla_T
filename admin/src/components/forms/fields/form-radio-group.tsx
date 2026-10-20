"use client";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldsetFrame } from "../components/fieldset-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps, Option } from "../types";

export function FormRadioGroup({
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
  const { field, id, invalid, describedBy, labelId } = presentation;

  return (
    <FieldsetFrame presentation={presentation}>
      <RadioGroup
        value={field.state.value}
        disabled={disabled}
        aria-label={
          !presentation.label ? presentation.accessibleLabel : undefined
        }
        aria-labelledby={presentation.label ? labelId : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={field.handleBlur}
        onValueChange={field.handleChange}
      >
        <FieldGroup className="gap-3">
          {options.map((option) => (
            <Field
              key={option.value}
              orientation="horizontal"
              data-invalid={invalid}
              data-disabled={disabled}
            >
              <RadioGroupItem
                id={id + "-" + option.value}
                value={option.value}
                aria-invalid={invalid}
                aria-describedby={describedBy}
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
      </RadioGroup>
    </FieldsetFrame>
  );
}
