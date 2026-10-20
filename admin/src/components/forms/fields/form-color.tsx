"use client";

import { FormInput } from "./form-input";
import type { FieldProps } from "../types";

export function FormColor(props: FieldProps) {
  return <FormInput {...props} type="color" />;
}
