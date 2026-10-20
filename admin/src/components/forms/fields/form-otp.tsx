"use client";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";

export function FormOTP({
  label,
  description,
  disabled,
  ariaLabel,
  maxLength = 6,
}: FieldProps & { maxLength?: number }) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy, labelId } = presentation;

  return (
    <FieldFrame presentation={presentation}>
      <InputOTP
        id={id}
        name={field.name}
        maxLength={maxLength}
        value={field.state.value}
        disabled={disabled}
        aria-label={
          !presentation.label ? presentation.accessibleLabel : undefined
        }
        aria-labelledby={presentation.label ? labelId : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={field.handleBlur}
        onChange={field.handleChange}
      >
        <InputOTPGroup>
          {Array.from({ length: maxLength }, (_, index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </FieldFrame>
  );
}
