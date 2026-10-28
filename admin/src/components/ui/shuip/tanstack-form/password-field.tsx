"use client";

import { useId } from "react";

import { Eye, EyeOff, InfoIcon } from "lucide-react";
import React from "react";
import type { Field } from "@/components/ui/field";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface PasswordFieldProps {
  label?: string;
  required?: boolean;
  description?: string;
  fieldProps?: React.ComponentProps<typeof Field>;
  props?: React.ComponentProps<"input">;
  tooltip?: React.ReactNode;
}

export function PasswordField({
  required,
  label,
  description,
  fieldProps,
  props,
  tooltip,
}: PasswordFieldProps) {
  const field = useFieldContext<string>();
  const generatedId = useId();
  const controlId = props?.id ?? generatedId;
  const { isValid } = field.state.meta;
  const [showPassword, setShowPassword] = React.useState(false);

  const handleTogglePassword = React.useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <BaseFormField
      fieldProps={fieldProps}
      label={label}
      description={description}
      required={required}
      htmlFor={controlId}
      disabled={props?.disabled}
    >
      <InputGroup>
        <InputGroupInput
          type={showPassword ? "text" : "password"}
          placeholder="أدخل كلمة المرور"
          name={field.name}
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          aria-describedby={
            [
              description ? controlId + "-description" : undefined,
              !isValid ? controlId + "-error" : undefined,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-required={required || undefined}
          aria-invalid={!isValid}
          {...props}
          id={controlId}
          required={required ?? props?.required}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            disabled={props?.disabled}
            aria-label={
              showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
            }
            onClick={handleTogglePassword}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </InputGroupButton>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton aria-label="Info" size="icon-xs">
                  <InfoIcon />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </InputGroupAddon>
      </InputGroup>
    </BaseFormField>
  );
}
