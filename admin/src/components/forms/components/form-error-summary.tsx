"use client";

import { FieldError } from "@/components/ui/field";
import { useAdminFormContext } from "../context";

export function FormErrorSummary() {
  const form = useAdminFormContext();
  return (
    <form.Subscribe
      selector={(state: any) =>
        [state.isFormValid, state.submissionAttempts] as const
      }
    >
      {([isValid, attempts]: [boolean, number]) =>
        attempts > 0 && !isValid ? (
          <FieldError role="alert">
            Fix the highlighted fields before submitting.
          </FieldError>
        ) : null
      }
    </form.Subscribe>
  );
}
