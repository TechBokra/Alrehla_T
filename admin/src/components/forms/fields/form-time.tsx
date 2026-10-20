"use client";

import { FormInput } from "./form-input";
import type { FieldProps } from "../types";

export function FormTime(props: FieldProps) {
  return <FormInput {...props} type="time" />;
}
