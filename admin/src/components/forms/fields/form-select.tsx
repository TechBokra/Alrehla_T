"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps, Option } from "../types";

export function FormSelect({
  label,
  description,
  disabled,
  ariaLabel,
  options,
  placeholder = "اختر خيارًا",
}: FieldProps & { options: ReadonlyArray<Option>; placeholder?: string }) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy, labelId } = presentation;

  return (
    <FieldFrame presentation={presentation} labelTarget="labelledBy">
      <Select
        value={field.state.value}
        onValueChange={field.handleChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-label={
            !presentation.label ? presentation.accessibleLabel : undefined
          }
          aria-labelledby={presentation.label ? labelId : undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onBlur={field.handleBlur}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FieldFrame>
  );
}
