"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FieldFrame } from "../components/field-frame";
import { useFieldPresentation } from "../hooks/use-field-presentation";
import type { FieldProps, Option } from "../types";

export function FormCombobox({
  label,
  description,
  disabled,
  ariaLabel,
  options,
  placeholder = "Search options…",
}: FieldProps & { options: ReadonlyArray<Option>; placeholder?: string }) {
  const presentation = useFieldPresentation({
    label,
    description,
    disabled,
    ariaLabel,
  });
  const { field, id, invalid, describedBy, labelId } = presentation;
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === field.state.value);

  return (
    <FieldFrame presentation={presentation} labelTarget="labelledBy">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={
              !presentation.label ? presentation.accessibleLabel : undefined
            }
            aria-labelledby={presentation.label ? labelId : undefined}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            disabled={disabled}
            className="w-full justify-between"
            onBlur={field.handleBlur}
          >
            {selected?.label ?? "Choose an option"}
            <ChevronsUpDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>No matching options.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      field.handleChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={
                        field.state.value === option.value
                          ? "opacity-100"
                          : "opacity-0"
                      }
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FieldFrame>
  );
}
