import { useMemo } from "react";
import type { BaseRecord } from "@refinedev/core";
import { LoaderCircle } from "lucide-react";
import { useAppForm } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FieldGroup } from "@/components/ui/field";
import { useResourcePageContext } from "@/contexts/resource-page";
import type { ResourceCommandDefinition } from "@/hooks/resources/page/use-resource-commands";

export function ResourceCommandDialogs<TRecord extends BaseRecord>({
  commands,
}: {
  commands: Record<string, ResourceCommandDefinition<TRecord>>;
}) {
  const page = useResourcePageContext<TRecord>();
  const key = page.activeCommandKey;
  const command = key ? commands[key] : undefined;
  const action = key ? page.actions[key] : undefined;
  if (!key || !command || !action) return null;
  return command.fields?.length ? (
    <CommandInputDialog
      key={key}
      command={command}
      action={action}
      onClose={() => page.closeCommand?.()}
    />
  ) : (
    <AlertDialog open onOpenChange={(open) => !open && page.closeCommand?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{command.label}</AlertDialogTitle>
          <AlertDialogDescription>{command.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={action.isPending}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            disabled={action.disabled}
            onClick={(event) => {
              event.preventDefault();
              void action.execute({});
            }}
          >
            {action.isPending ? <LoaderCircle className="animate-spin" /> : null}
            {action.isPending ? "جارٍ التنفيذ…" : "تأكيد"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CommandInputDialog<TRecord extends BaseRecord>({
  command,
  action,
  onClose,
}: {
  command: ResourceCommandDefinition<TRecord>;
  action: ReturnType<typeof useResourcePageContext<TRecord>>["actions"][string];
  onClose: () => void;
}) {
  const defaultValues = useMemo(() => Object.fromEntries(
    (command.fields ?? []).map((field) => [field.name, ""]),
  ) as Record<string, string>, [command.fields]);
  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const result = await action.execute(value);
      if (result !== false) onClose();
    },
  });
  const fields = command.fields ?? [];
  return (
    <Dialog open onOpenChange={(open) => !open && !action.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{command.label}</DialogTitle>
          <DialogDescription>{command.description}</DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              {fields.map((field) => (
                <form.AppField key={field.name} name={field.name as never}>
                  {(Fields) => field.kind === "textarea" ? (
                    <Fields.TextareaField
                      label={field.label}
                      required={field.required}
                      props={{ disabled: action.isPending, minLength: field.minLength, maxLength: field.maxLength, placeholder: field.placeholder }}
                    />
                  ) : (
                    <Fields.InputField
                      label={field.label}
                      required={field.required}
                      props={{ disabled: action.isPending, minLength: field.minLength, maxLength: field.maxLength, placeholder: field.placeholder }}
                    />
                  )}
                </form.AppField>
              ))}
            </FieldGroup>
            {action.error ? <p role="alert" className="text-sm text-destructive">{action.error}</p> : null}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <DialogFooter>
                  <Button type="button" variant="outline" disabled={action.isPending || isSubmitting} onClick={onClose}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={action.isPending || isSubmitting} aria-busy={action.isPending || isSubmitting}>
                    {action.isPending || isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
                    {action.isPending || isSubmitting ? "جارٍ التنفيذ…" : "تأكيد"}
                  </Button>
                </DialogFooter>
              )}
            </form.Subscribe>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
