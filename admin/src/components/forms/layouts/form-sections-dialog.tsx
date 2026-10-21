"use client";

import * as React from "react";
import { cn } from "cn";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormDialog, type FormDialogProps } from "./form-dialog";

export type FormSectionNavigationItem = {
  id: string;
  title: string;
};

export type FormSectionsDialogProps = Omit<FormDialogProps, "children"> & {
  sections: ReadonlyArray<FormSectionNavigationItem>;
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  navigationClassName?: string;
};

const ActiveFormSectionContext = React.createContext("");

export type FormSectionPanelProps = Omit<
  React.ComponentProps<typeof TabsContent>,
  "value" | "forceMount" | "hidden"
> & {
  value: string;
};

/** Keeps its fields mounted for form validation while hiding inactive sections. */
export function FormSectionPanel({
  value,
  className,
  ...props
}: FormSectionPanelProps) {
  const activeSection = React.useContext(ActiveFormSectionContext);

  return (
    <TabsContent
      {...props}
      value={value}
      forceMount
      hidden={activeSection !== value}
      className={cn("min-w-0 px-6 py-5 md:pl-0", className)}
    />
  );
}

export function FormSectionsDialog({
  sections,
  children,
  value,
  onValueChange,
  navigationClassName,
  bodyClassName,
  open,
  onOpenChange,
  ...dialogProps
}: FormSectionsDialogProps) {
  const isMobile = useIsMobile();
  const firstSectionId = sections[0]?.id ?? "";
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(firstSectionId);
  const activeSection = value ?? uncontrolledValue;
  const setActiveSection = (nextValue: string) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
  };

  React.useEffect(() => {
    if (!open) return;
    setActiveSection(firstSectionId);
  }, [open, firstSectionId]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setActiveSection(firstSectionId);
    onOpenChange(nextOpen);
  };

  return (
    <FormDialog
      {...dialogProps}
      open={open}
      onOpenChange={handleOpenChange}
      className={cn("max-w-5xl sm:max-w-5xl", dialogProps.className)}
      bodyClassName={cn("p-0", bodyClassName)}
    >
      <Tabs
        value={activeSection}
        onValueChange={setActiveSection}
        orientation={isMobile ? "horizontal" : "vertical"}
        className="min-h-full w-full min-w-0 md:flex-row"
      >
        <TabsList
          aria-label="أقسام النموذج"
          variant="line"
          className={cn(
            "sticky top-0 z-10 flex h-auto w-full max-w-full shrink-0 justify-start gap-2 overflow-x-auto rounded-none border-b bg-popover p-3 md:my-6 md:w-48 md:items-stretch md:overflow-visible md:rounded-2xl md:border-0 md:bg-transparent md:p-4",
            navigationClassName
          )}
        >
          {sections.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="min-w-max justify-start md:w-full"
            >
              {section.title}
            </TabsTrigger>
          ))}
        </TabsList>
        <ActiveFormSectionContext.Provider value={activeSection}>
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </ActiveFormSectionContext.Provider>
      </Tabs>
    </FormDialog>
  );
}
