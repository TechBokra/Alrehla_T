"use client";

import { createFormHookContexts } from "@tanstack/react-form";
import * as React from "react";

export const { fieldContext, formContext, useFieldContext } =
  createFormHookContexts();

export function useAdminFormContext() {
  const form = React.useContext(formContext);
  if (!form) {
    throw new Error("Form components must be rendered inside form.AppForm.");
  }
  return form as any;
}
