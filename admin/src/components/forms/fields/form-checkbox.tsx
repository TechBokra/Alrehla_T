"use client";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldHeader } from "../components/field-header";
import { FieldHelp } from "../components/field-help";
import {
  normalizeFieldErrors,
  useFieldPresentation,
} from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";

export function FormCheckbox({
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
  const { field, id, invalid, describedBy, errorId, descriptionId } =
    presentation;

  return (
    <div className="flex flex-col gap-1">
      <Field
        orientation="horizontal"
        data-invalid={invalid}
        data-disabled={disabled}
        aria-label={
          !presentation.label ? presentation.accessibleLabel : undefined
        }
        aria-labelledby={presentation.label ? presentation.labelId : undefined}
        aria-describedby={describedBy}
      >
        <Checkbox
          id={id}
          checked={field.state.value}
          disabled={disabled}
          aria-label={
            !presentation.label ? presentation.accessibleLabel : undefined
          }
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onBlur={field.handleBlur}
          onCheckedChange={(checked) => field.handleChange(checked === true)}
        />
        {presentation.label ? (
          <FieldContent>
            <FieldHeader presentation={presentation} />
            {description ? (
              <FieldDescription id={descriptionId} className="sr-only">
                {description}
              </FieldDescription>
            ) : null}
          </FieldContent>
        ) : description ? (
          <FieldDescription id={descriptionId} className="sr-only">
            {description}
          </FieldDescription>
        ) : null}
      </Field>
      {!presentation.label && description ? (
        <div className="flex items-center">
          <FieldHelp
            description={description}
            label={presentation.accessibleLabel}
          />
        </div>
      ) : null}
      <FieldError
        id={invalid ? errorId : undefined}
        errors={normalizeFieldErrors(presentation.errors)}
      />
    </div>
  );
}
