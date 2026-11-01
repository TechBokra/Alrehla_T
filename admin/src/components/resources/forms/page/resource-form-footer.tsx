import { useFormContext } from "@/components/ui/shuip/tanstack-form/form-context";
import { FormActions } from "@/components/forms/components/form-actions";
import { SubmitButton } from "@/components/ui/shuip/tanstack-form/submit-button";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export function ResourceFormFooter({
  mode,
  disabled = false,
  onCancel,
  saveLabel,
  showCancel = true,
  className,
}: {
  mode: "create" | "edit";
  disabled?: boolean;
  onCancel?: () => void;
  saveLabel?: string;
  showCancel?: boolean;
  className?: string;
}) {
  const form = useFormContext();
  return (
    <form.Subscribe
      selector={(state) => [
        state.canSubmit,
        state.isSubmitting,
        state.isValidating,
      ]}
    >
      {([canSubmit, isSubmitting, isValidating]) => (
        <FormActions className={cn("sticky bottom-0 -mx-4 justify-end border-t bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6", className)}>
          {showCancel && mode === "edit" && onCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || isSubmitting}
              onClick={onCancel}
            >
              إلغاء
            </Button>
          ) : null}
          <SubmitButton
            props={{
              disabled: disabled || !canSubmit || isValidating,
              "aria-busy": isSubmitting,
            }}
          >
            {isSubmitting
              ? "جارٍ الحفظ…"
              : saveLabel ?? (mode === "edit"
                ? "حفظ التغييرات"
                : "حفظ")}
          </SubmitButton>
        </FormActions>
      )}
    </form.Subscribe>
  );
}
