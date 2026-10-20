"use client";

import { TagsSelect, type TagOption } from "@/components/ui/tags-select";
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";

export function FormTags({
  label,
  description,
  disabled,
  ariaLabel,
  options,
  maxVisibleTags = 2,
}: FieldProps & {
  options: ReadonlyArray<TagOption>;
  maxVisibleTags?: number;
}) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy, labelId } = presentation;

  return (
    <FieldFrame presentation={presentation} labelTarget="labelledBy">
      <TagsSelect
        id={id}
        options={options}
        value={field.state.value}
        onValueChange={field.handleChange}
        onBlur={field.handleBlur}
        disabled={disabled}
        maxVisibleTags={maxVisibleTags}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        triggerAriaLabel={
          !presentation.label ? presentation.accessibleLabel : undefined
        }
        triggerAriaLabelledBy={presentation.label ? labelId : undefined}
      />
    </FieldFrame>
  );
}
