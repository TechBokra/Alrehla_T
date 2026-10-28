"use client";

import { useId } from "react";

import { Loader2 } from "lucide-react";
import * as React from "react";
import type { Field } from "@/components/ui/field";
import { BaseFormField } from "@/components/forms/components/base-form-field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  listboxClassName,
  SuggestionEmpty,
  SuggestionOption,
  useSuggestionList,
} from "@/components/ui/shuip/suggestion-list";
import { useFieldContext } from "@/components/ui/shuip/tanstack-form/form-context";

const DEBOUNCE_TIME = 300;

function defaultFilter(suggestion: string, query: string) {
  return suggestion.toLowerCase().includes(query.toLowerCase());
}

export interface AutocompleteFieldProps {
  label?: string;
  required?: boolean;
  description?: string;
  placeholder?: string;
  suggestions?: string[];
  onSearch?: (query: string) => Promise<string[]>;
  emptyText?: string;
  debounceMs?: number;
  filter?: (suggestion: string, query: string) => boolean;
  fieldProps?: React.ComponentProps<typeof Field>;
  props?: Omit<React.ComponentProps<"input">, "value" | "onChange">;
}

export function AutocompleteField({
  required,
  label,
  description,
  placeholder,
  suggestions,
  onSearch,
  emptyText = "No results",
  debounceMs = DEBOUNCE_TIME,
  filter = defaultFilter,
  fieldProps,
  props,
}: AutocompleteFieldProps) {
  const field = useFieldContext<string>();
  const generatedId = useId();
  const controlId = props?.id ?? generatedId;
  const { isValid } = field.state.meta;

  const [open, setOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [results, setResults] = React.useState<string[]>([]);
  const [isPending, startTransition] = React.useTransition();
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = React.useRef(0);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const query = field.state.value ?? "";

  const items = React.useMemo(() => {
    if (onSearch) return results;
    if (!suggestions) return [];
    if (!query) return suggestions;
    return suggestions.filter((suggestion) => filter(suggestion, query));
  }, [onSearch, results, suggestions, query, filter]);

  React.useEffect(() => {
    if (!onSearch || !open) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query) {
      requestIdRef.current++;
      setResults([]);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      startTransition(async () => {
        try {
          const res = await onSearch(query);
          if (requestId !== requestIdRef.current) return;
          setResults(res);
        } catch {
          if (requestId !== requestIdRef.current) return;
          setResults([]);
        }
      });
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      requestIdRef.current++;
    };
  }, [query, onSearch, open, debounceMs]);

  const handleSelect = (value: string) => {
    field.handleChange(value);
    setOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSelectedIndex(-1);
      return;
    }

    if (items.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
        break;
      case "Enter":
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault();
          handleSelect(items[selectedIndex]);
        }
        break;
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (popoverRef.current?.contains(relatedTarget)) {
      return;
    }
    field.handleBlur();
    setTimeout(() => {
      setOpen(false);
      setSelectedIndex(-1);
    }, 150);
  };

  const id = controlId;
  const suggestionList = useSuggestionList({
    inputId: id,
    label,
    ariaLabel: props?.["aria-label"],
    placeholder,
    open,
    count: items.length,
    selectedIndex,
    busy: isPending,
  });

  return (
    <BaseFormField
      fieldProps={fieldProps}
      label={label}
      description={description}
      required={required}
      htmlFor={controlId}
      disabled={props?.disabled}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              name={field.name}
              value={query}
              placeholder={placeholder}
              autoComplete="off"
              {...props}
              required={required ?? props?.required}
              id={id}
              onChange={(e) => {
                field.handleChange(e.target.value);
                setOpen(true);
                setSelectedIndex(-1);
              }}
              onFocus={() => setOpen(true)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              {...suggestionList.inputProps}
              aria-describedby={
                [
                  description ? id + "-description" : undefined,
                  !isValid ? id + "-error" : undefined,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              aria-required={required || undefined}
              aria-invalid={!isValid}
            />
            {isPending && (
              <div className="absolute inset-y-0 end-0 flex items-center pe-3">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={popoverRef}
          {...suggestionList.listboxProps}
          className={listboxClassName}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          {items.length === 0 && (
            <SuggestionEmpty>
              {isPending ? "Searching…" : emptyText}
            </SuggestionEmpty>
          )}
          {items.map((item, index) => (
            <SuggestionOption
              key={`${item}-${index}`}
              id={suggestionList.optionId(index)}
              highlighted={selectedIndex === index}
              onSelect={() => handleSelect(item)}
              onHighlight={() => setSelectedIndex(index)}
            >
              {item}
            </SuggestionOption>
          ))}
        </PopoverContent>
      </Popover>
    </BaseFormField>
  );
}
