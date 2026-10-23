"use client";

import { useState, type ChangeEvent, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps } from "../types";

type FormInputProps = FieldProps & Pick<
  ComponentProps<typeof Input>,
  "type" | "placeholder" | "autoComplete" | "dir" | "inputMode" | "autoCapitalize" | "spellCheck"
> & {
  withPasswordToggle?: boolean;
};

export function FormInput({
  label,
  description,
  disabled,
  ariaLabel,
  type = "text",
  placeholder,
  autoComplete,
  dir,
  inputMode,
  autoCapitalize,
  spellCheck,
  withPasswordToggle = false,
}: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy } = presentation;
  const inputProps = {
    id,
    name: field.name,
    type: type === "password" && showPassword ? "text" : type,
    value: field.state.value ?? "",
    placeholder,
    disabled,
    autoComplete,
    dir,
    inputMode,
    autoCapitalize,
    spellCheck,
    "aria-label": !presentation.label ? presentation.accessibleLabel : undefined,
    "aria-invalid": invalid,
    "aria-describedby": describedBy,
    onBlur: field.handleBlur,
    onChange: (event: ChangeEvent<HTMLInputElement>) => field.handleChange(event.target.value),
  };

  return (
    <FieldFrame presentation={presentation}>
      {type === "password" && withPasswordToggle ? (
        <InputGroup dir={dir} data-disabled={disabled}>
          <InputGroupInput {...inputProps} />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-sm"
              disabled={disabled}
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              aria-pressed={showPassword}
              aria-controls={id}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      ) : <Input {...inputProps} />}
    </FieldFrame>
  );
}
