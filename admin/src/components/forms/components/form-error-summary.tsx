"use client";

import { FieldError } from "@/components/ui/field";
import { useFormContext } from "@/components/ui/shuip/tanstack-form/form-context";

export function FormErrorSummary() {
  const form = useFormContext();
  return (
    <form.Subscribe
      selector={(state: any) =>
        [state.isFormValid, state.submissionAttempts] as const
      }
    >
      {([isValid, attempts]: readonly [boolean, number]) =>
        attempts > 0 && !isValid ? (
          <FieldError role="alert">صحح الحقول الموضحة قبل الحفظ.</FieldError>
        ) : null
      }
    </form.Subscribe>
  );
}
