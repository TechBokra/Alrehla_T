"use client";

import { FormInput } from "./form-input";
import type { FieldProps } from "../types";

export function FormDate(props: FieldProps) {
  return <FormInput {...props} type="date" />;
}
