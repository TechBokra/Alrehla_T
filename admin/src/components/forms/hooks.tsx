"use client";

import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext } from "./context";
import { adminFieldComponents } from "./fields";
import {
  FormActions,
  FormErrorSummary,
  ResetButton,
  SubmitButton,
  UnsavedChangesIndicator,
} from "./components";

export const adminFormHooks = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: adminFieldComponents,
  formComponents: {
    SubmitButton,
    ResetButton,
    FormActions,
    FormErrorSummary,
    UnsavedChangesIndicator,
  },
});

export const { useAppForm, withForm, withFieldGroup } = adminFormHooks;
export type AdminFormHooks = typeof adminFormHooks;
