"use client";

import { useId } from "react";

import * as React from "react";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import { Input } from "@/components/ui/input";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InlineEditSize = "sm" | "default" | "title";
type InlineEditVariant = "ghost" | "boxed";
type InlineEditInput = "text" | "textarea";

interface InlineEditProps {
  value: string;
  id: string;
  label?: string;
  descriptionId?: string;
  onCommit: (next: string) => Promise<string | undefined> | string | undefined;
  input?: InlineEditInput;
  variant?: InlineEditVariant;
  size?: InlineEditSize;
  placeholder?: string;
  canEdit?: boolean;
  children?: (api: {
    value: string;
    setValue: (v: string) => void;
    commit: (next?: string) => void;
    cancel: () => void;
    className: string;
    autoFocus: true;
  }) => React.ReactNode;
}

type State =
  | { kind: "reading" }
  | { kind: "editing"; draft: string; error?: string }
  | { kind: "saving"; draft: string };

const sizeClasses: Record<InlineEditSize, string> = {
  sm: "px-1.5 py-0.5 text-xs",
  default: "px-2 py-1 text-sm",
  title: "px-2 py-1 text-3xl font-semibold tracking-tight",
};

const variantClasses: Record<InlineEditVariant, string> = {
  ghost:
    "border border-transparent bg-transparent hover:bg-muted focus-visible:bg-muted dark:bg-transparent dark:hover:bg-muted",
  boxed:
    "border border-input bg-transparent shadow-xs focus-visible:border-ring",
};

function InlineEdit({
  value,
  id,
  label,
  descriptionId,
  onCommit,
  input = "text",
  variant = "ghost",
  size = "default",
  placeholder = "—",
  canEdit = true,
  children,
}: InlineEditProps) {
  const [state, setState] = React.useState<State>({ kind: "reading" });
  const errorId = React.useId();

  const fieldClassName = cn(
    "w-full rounded-md text-start outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
    sizeClasses[size],
    variantClasses[variant],
  );

  const startEdit = () => {
    if (canEdit) setState({ kind: "editing", draft: value });
  };

  const cancel = () => setState({ kind: "reading" });

  const setDraft = (draft: string) =>
    setState((s) => (s.kind === "editing" ? { kind: "editing", draft } : s));

  const commit = async (override?: string) => {
    if (state.kind !== "editing") return;
    const draft = override ?? state.draft;
    if (draft === value) {
      setState({ kind: "reading" });
      return;
    }
    setState({ kind: "saving", draft });
    try {
      const error = await onCommit(draft);
      setState(error ? { kind: "editing", draft, error } : { kind: "reading" });
    } catch {
      setState({ kind: "editing", draft, error: "تعذر الحفظ. حاول مرة أخرى." });
    }
  };

  const displayedError = state.kind === "editing" ? state.error : undefined;
  const isSaving = state.kind === "saving";

  let content: React.ReactNode;
  if (state.kind === "reading") {
    const isEmpty = value === "";
    content = (
      <span
        id={id}
        aria-label={label}
        aria-describedby={descriptionId}
        data-slot="inline-edit"
        role={canEdit ? "button" : undefined}
        tabIndex={canEdit ? 0 : undefined}
        onClick={canEdit ? startEdit : undefined}
        onKeyDown={
          canEdit
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startEdit();
                }
              }
            : undefined
        }
        className={cn(
          fieldClassName,
          "block",
          canEdit ? "cursor-text" : "cursor-default",
          input === "textarea" && "whitespace-pre-wrap",
          isEmpty && "text-muted-foreground",
        )}
      >
        {isEmpty ? placeholder : value}
      </span>
    );
  } else {
    const { draft } = state;
    const editorClassName = cn(
      fieldClassName,
      "h-auto min-w-0",
      variant === "ghost" && "shadow-none",
      input === "textarea" && "field-sizing-content min-h-0",
    );
    const handleKeyDown: React.KeyboardEventHandler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
      if (e.key === "Enter" && input === "text") {
        e.preventDefault();
        void commit();
      }
    };

    content = children ? (
      children({
        value: draft,
        setValue: setDraft,
        commit: (next?: string) => void commit(next),
        cancel,
        className: editorClassName,
        autoFocus: true,
      })
    ) : input === "textarea" ? (
      <Textarea
        id={id}
        aria-label={label}
        autoFocus
        value={draft}
        disabled={isSaving}
        aria-invalid={!!displayedError}
        aria-describedby={
          [descriptionId, displayedError ? errorId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={handleKeyDown}
        className={editorClassName}
      />
    ) : (
      <Input
        id={id}
        aria-label={label}
        autoFocus
        type="text"
        value={draft}
        disabled={isSaving}
        aria-invalid={!!displayedError}
        aria-describedby={
          [descriptionId, displayedError ? errorId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={handleKeyDown}
        className={editorClassName}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{content}</div>
        {isSaving && (
          <span
            aria-hidden
            className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary/60"
          />
        )}
      </div>
      {displayedError && (
        <p id={errorId} className="text-xs text-destructive">
          {displayedError}
        </p>
      )}
    </div>
  );
}

export interface InlineEditFieldProps
  extends Pick<
    InlineEditProps,
    "input" | "variant" | "size" | "placeholder" | "canEdit" | "children"
  > {
  label?: string;
  description?: string;
  orientation?: "vertical" | "horizontal";
}

export function InlineEditField({
  label,
  description,
  orientation = "vertical",
  ...props
}: InlineEditFieldProps) {
  const field = useFieldContext<string>();
  const generatedId = useId();
  const controlId = generatedId;

  const handleCommit = async (next: string) => {
    field.handleChange(next);
    await field.validate("change");
    if (!field.state.meta.isValid) {
      const first = field.state.meta.errors[0];
      return typeof first === "string"
        ? first
        : (first?.message ?? "Invalid value");
    }
    await field.form.handleSubmit();
    return undefined;
  };

  return (
    <BaseFormField
      label={label}
      description={description}
      htmlFor={controlId}
      labelTarget="labelledBy"
      orientation={orientation}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          orientation === "horizontal" && "flex-1",
        )}
      >
        <InlineEdit
          {...props}
          id={controlId}
          label={label}
          descriptionId={description ? controlId + "-description" : undefined}
          value={field.state.value ?? ""}
          onCommit={handleCommit}
        />
      </div>
    </BaseFormField>
  );
}
