import { useCallback, useMemo, useRef, useState } from "react";
import { useCustomMutation, useInvalidate, type BaseRecord } from "@refinedev/core";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";
import type { ResourcePageActionDescriptor } from "@/contexts/resource-page/types";

export interface ResourceCommandField {
  name: string;
  label: string;
  kind?: "text" | "textarea";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
}

export interface ResourceCommandDefinition<TRecord extends BaseRecord> {
  label: string;
  description: string;
  authorizationAction: string;
  command: string;
  method?: "post" | "put" | "patch" | "delete";
  isEligible: (record: TRecord) => boolean;
  fields?: ResourceCommandField[];
  validate?: (input: Record<string, string>) => string | undefined;
  toValues: (record: TRecord, input: Record<string, string>) => unknown;
  invalidates?: Array<{
    resource: string;
    dataProviderName?: string;
    invalidates: Array<"list" | "many" | "detail" | "resourceAll">;
    id?: string;
  }>;
  errorMessage?: (error: unknown) => string;
}

export type ResourceCommandMap<TRecord extends BaseRecord> = Record<
  string,
  ResourceCommandDefinition<TRecord>
>;

type CommandFeedback = { message: string; kind: "success" | "warning" | "error" };

/** One Refine custom mutation and one execution guard per mounted detail scope. */
export function useResourceCommands<TRecord extends BaseRecord>({
  resource,
  id,
  record,
  dataProviderName,
  commands,
  refetchRecord,
  enabled = true,
  blockedMessage,
}: {
  resource: string;
  id: string;
  record: TRecord;
  dataProviderName: string;
  commands: ResourceCommandMap<TRecord>;
  refetchRecord: () => Promise<TRecord | undefined>;
  enabled?: boolean;
  blockedMessage?: string;
}) {
  const mutation = useCustomMutation({ mutationOptions: { retry: false } });
  const invalidate = useInvalidate();
  const inFlight = useRef(false);
  const [checking, setChecking] = useState(false);
  const [activeCommandKey, setActiveCommandKey] = useState<string>();
  const [feedback, setFeedback] = useState<CommandFeedback>();
  const [preflightError, setPreflightError] = useState<string>();

  const open = useCallback((key: string) => {
    if (!enabled || inFlight.current) return;
    const command = commands[key];
    if (!command || !command.isEligible(record)) return;
    mutation.mutation.reset();
    setPreflightError(undefined);
    setFeedback(undefined);
    setActiveCommandKey(key);
  }, [commands, record, mutation.mutation, enabled]);

  const close = useCallback(() => {
    if (!inFlight.current) setActiveCommandKey(undefined);
  }, []);

  const execute = useCallback(async (
    key: string,
    input: Record<string, string> = {},
  ) => {
    const command = commands[key];
    if (!enabled) {
      setPreflightError(blockedMessage ?? "احفظ التغييرات أو ألغِها قبل تنفيذ الإجراء.");
      return false;
    }
    if (!command || inFlight.current || !command.isEligible(record)) return false;
    const validationError = command.validate?.(input);
    if (validationError) {
      setPreflightError(validationError);
      return false;
    }
    inFlight.current = true;
    let mutationStarted = false;
    setChecking(true);
    setPreflightError(undefined);
    setFeedback(undefined);
    try {
      await assertResourceAccess(resource, command.authorizationAction, {
        id,
        record,
      });
      const fresh = await refetchRecord();
      if (!fresh || !command.isEligible(fresh)) {
        throw new Error("تغيّرت حالة الطلب. حدّث التفاصيل قبل تنفيذ الإجراء.");
      }
      await assertResourceAccess(resource, command.authorizationAction, {
        id,
        record: fresh,
      });
      setChecking(false);
      mutationStarted = true;
      const response = await mutation.mutateAsync({
        url: command.command,
        method: command.method ?? "post",
        values: command.toValues(fresh, input) as Record<string, unknown>,
        dataProviderName,
        successNotification: false,
        errorNotification: false,
      });

      let refreshFailed = false;
      try {
        for (const target of command.invalidates ?? [
          { resource, dataProviderName, invalidates: ["list", "detail"] as const, id },
        ]) {
          await invalidate({
            resource: target.resource,
            dataProviderName: target.dataProviderName,
            invalidates: target.invalidates,
            ...((target.id ?? (target.resource === resource ? id : undefined))
              ? { id: target.id ?? id }
              : {}),
          });
        }
      } catch {
        refreshFailed = true;
      }
      const data = (response as { data?: unknown }).data;
      const warnings = data && typeof data === "object" && "warnings" in data
        ? (data as { warnings?: unknown }).warnings
        : undefined;
      const hasWarnings = Array.isArray(warnings) && warnings.length > 0;
      setFeedback({
        kind: refreshFailed || hasWarnings ? "warning" : "success",
        message: refreshFailed
          ? "اكتمل الإجراء، لكن تعذّر تحديث العرض. أعد تحميل التفاصيل."
          : hasWarnings
            ? (warnings as string[]).join(" ")
            : "تم تنفيذ الإجراء بنجاح.",
      });
      setActiveCommandKey(undefined);
      return response;
    } catch (error) {
      if (!mutationStarted) {
        setPreflightError(
          command.errorMessage?.(error) ??
            (error instanceof Error ? error.message : "تعذّر تنفيذ الإجراء. حاول مرة أخرى."),
        );
      }
      return false;
    } finally {
      setChecking(false);
      inFlight.current = false;
    }
  }, [commands, record, resource, id, refetchRecord, mutation.mutateAsync,
    enabled, blockedMessage,
    dataProviderName, invalidate]);

  const actions = useMemo(() => Object.fromEntries(
    Object.entries(commands).map(([key, command]) => {
      // Detail pages mount this hook before their initial query resolves. Do
      // not evaluate feature predicates against the temporary empty record.
      const eligible = enabled && command.isEligible(record);
      const disabled = !enabled || !eligible || checking || mutation.mutation.isPending;
      const descriptor: ResourcePageActionDescriptor<Record<string, string>> = {
        label: command.label,
        disabled,
        isPending: checking || mutation.mutation.isPending,
        error: activeCommandKey === key
          ? preflightError ?? (mutation.mutation.error
            ? command.errorMessage?.(mutation.mutation.error) ?? "تعذّر تنفيذ الإجراء. حاول مرة أخرى."
            : undefined)
          : undefined,
        buttonProps: {
          type: "button",
          disabled,
          onClick: () => open(key),
        },
        menuItemProps: {
          disabled,
          onSelect: () => open(key),
        },
        open: () => open(key),
        execute: (input) => execute(key, input),
      };
      return [key, descriptor];
    }),
  ), [commands, record, checking, mutation.mutation.isPending, activeCommandKey,
    preflightError, open, execute, enabled]);

  return {
    actions,
    activeCommandKey,
    activeCommand: activeCommandKey ? commands[activeCommandKey] : undefined,
    feedback,
    preflightError,
    pending: checking || mutation.mutation.isPending,
    mutationError: mutation.mutation.error,
    close,
    executeActive: (input?: Record<string, string>) =>
      activeCommandKey ? execute(activeCommandKey, input) : Promise.resolve(false),
  };
}
